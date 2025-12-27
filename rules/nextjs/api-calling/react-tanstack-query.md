# React Query (TanStack Query) Best Practices

## Architecture

### Two-Layer Approach
- **Services Layer**: Handle API calls in `services/` directory
- **Queries Layer**: Create React Query hooks in `queries/` directory  
- **Never call APIs directly** from components

```typescript
// ❌ Don't do this in components
fetch('/api/users').then(...)

// ✅ Use service + query layers
const { data, isLoading } = useUsers();
```

## Query Key Factory Pattern

Use consistent query key factories for better organization:

```typescript
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: string) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  profile: () => [...userKeys.all, 'profile'] as const,
};
```

## Service Layer

Create API service methods with type safety:

```typescript
// services/user.service.ts
import { ApiClient } from '@/lib/api-client';

export class UserService {
  static async getProfile() {
    return await ApiClient.get<User>('/api/users/profile');
  }

  static async updateProfile(data: UpdateUserDto) {
    return await ApiClient.patch<User>('/api/users/profile', data);
  }
}
```

## Query Hooks

### Basic Query
```typescript
export function useUserProfile() {
  return useQuery({
    queryKey: userKeys.profile(),
    queryFn: () => UserService.getProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### Mutation with Error Handling
```typescript
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: UserService.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.profile() });
      toast.success('Profile updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });
}
```

## Essential Configurations

### 1. Stale Time
Set appropriate stale time based on data freshness needs:
```typescript
staleTime: 5 * 60 * 1000, // 5 minutes for relatively static data
staleTime: 30 * 1000,     // 30 seconds for frequently changing data
```

### 2. Error Handling
Always handle errors with user feedback:
```typescript
onError: (error: Error) => {
  toast.error(error.message || 'Something went wrong');
}
```

### 3. Query Invalidation
Invalidate related queries after mutations:
```typescript
onSuccess: () => {
  // Invalidate specific query
  queryClient.invalidateQueries({ queryKey: userKeys.profile() });
  
  // Invalidate all user queries
  queryClient.invalidateQueries({ queryKey: userKeys.all });
}
```

## Advanced Patterns

### Optimistic Updates
```typescript
const updateMutation = useMutation({
  mutationFn: UserService.updateProfile,
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: userKeys.profile() });
    const previousData = queryClient.getQueryData(userKeys.profile());
    
    queryClient.setQueryData(userKeys.profile(), newData);
    
    return { previousData };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(userKeys.profile(), context?.previousData);
    toast.error('Update failed');
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: userKeys.profile() });
  },
});
```

### Dependent Queries
```typescript
export function useUserPosts(userId?: string) {
  return useQuery({
    queryKey: postKeys.byUser(userId!),
    queryFn: () => PostService.getByUser(userId!),
    enabled: !!userId, // Only run when userId exists
  });
}
```

### Infinite Queries
```typescript
export function useInfinitePosts() {
  return useInfiniteQuery({
    queryKey: postKeys.lists(),
    queryFn: ({ pageParam = 1 }) => PostService.getPaginated(pageParam),
    getNextPageParam: (lastPage, pages) => lastPage.hasMore ? pages.length + 1 : undefined,
    initialPageParam: 1,
  });
}
```

## File Organization

### Directory Structure
```
queries/
├── index.ts          # Export all queries
├── user.query.ts     # User-related queries
├── post.query.ts     # Post-related queries
└── auth.query.ts     # Auth-related queries
```

### Export Pattern
```typescript
// queries/index.ts
export * from './user.query';
export * from './post.query';
export * from './auth.query';
```

## Component Usage

### Loading States
```typescript
function UserProfile() {
  const { data: user, isLoading, error } = useUserProfile();

  if (isLoading) return <UserProfileSkeleton />;
  if (error) return <ErrorMessage error={error} />;

  return <div>{user?.name}</div>;
}
```

### Mutations in Components
```typescript
function UpdateProfileForm() {
  const updateMutation = useUpdateProfile();

  const handleSubmit = (data: UpdateUserDto) => {
    updateMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit" disabled={updateMutation.isPending}>
        {updateMutation.isPending ? 'Updating...' : 'Update'}
      </button>
    </form>
  );
}
```


