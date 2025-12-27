# API Client Rules & Best Practices
### Service Layer Pattern
- **NEVER** call API endpoints directly from components
- **ALWAYS** create service methods that use ApiClient
- Place all API services in `services/` directory with `.service.ts` extension
- Export all services from `services/index.ts`

## ApiClient Usage Patterns
### Response Handling
```typescript
// Handle success/error responses
const response = await ApiClient.get<User>('/api/users/profile');

if (response.data) {
  // Success case - response.data is typed
  console.log(response.data.name);
} else {
  // Error case - response.error contains formatted details
  console.error(response.error.message);
  console.error(response.error.status);
}
```

## Service Organization

### 1. Service Class Structure
```typescript
// services/user.service.ts
import { ApiClient } from '@/lib/api-client';
import { User, CreateUserDto, UpdateUserDto } from '@/types';

export class UserService {
  static async getAll() {
    return await ApiClient.get<User[]>('/api/users');
  }

  static async getById(id: string) {
    return await ApiClient.get<User>(`/api/users/${id}`);
  }

  static async create(data: CreateUserDto) {
    return await ApiClient.post<User>('/api/users', data);
  }

  static async update(id: string, data: UpdateUserDto) {
    return await ApiClient.patch<User>(`/api/users/${id}`, data);
  }

  static async delete(id: string) {
    return await ApiClient.delete(`/api/users/${id}`);
  }
}
```

### 2. Service Export Pattern
```typescript
// services/index.ts
export * from './user.service';
export * from './auth.service';
export * from './product.service';
```

## Error Handling Best Practices

### Component-Level Usage
```typescript
// components/UserProfile.tsx
import { UserService } from '@/services';

export function UserProfile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchUser = async () => {
      const response = await UserService.getProfile();
      
      if (response.data) {
        setUser(response.data);
      } else {
        setError(response.error.message);
      }
      
      setLoading(false);
    };

    fetchUser();
  }, []);

  // Component JSX...
}
```

## Advanced Patterns

### 1. Query Parameters
```typescript
// Handle query parameters properly
export class ProductService {
  static async search(params: { query: string; category?: string }) {
    return await ApiClient.get<Product[]>('/api/products', params);
  }
}
```

### 2. File Uploads
```typescript
export class FileService {
  static async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    return await ApiClient.post<FileUploadResponse>('/api/files/upload', formData);
  }
}
```

## Common Mistakes to Avoid

### ❌ Don't Do These
```typescript
// Don't call ApiClient directly in components
const response = await ApiClient.get('/api/users');

// Don't skip error handling
const response = await ApiClient.get<User>('/api/users');
const user = response.data; // Could be undefined!

// Don't ignore TypeScript types
const response = await ApiClient.get('/api/users'); // Missing generic type

// Don't create inline API calls
const handleSubmit = async () => {
  await ApiClient.post('/api/users', data); // Should be in service
};
```

### ✅ Do These Instead
```typescript
// Create proper service methods
export class UserService {
  static async create(userData: CreateUserDto) {
    return await ApiClient.post<User>('/api/users', userData);
  }
}

// Use services in components with proper error handling
const response = await UserService.create(userData);
if (response.data) {
  // Handle success
} else {
  // Handle error
  setError(response.error.message);
}
```


