# React Hook Form + Zod + Shadcn Form Best Practices

## Core Setup Pattern

```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

// Schema in validations/xx.schema.ts
const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

type FormData = z.infer<typeof formSchema>

export function MyForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: FormData) {
    // Handle form submission
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* More fields */}
      </form>
    </Form>
  )
}
```

## Key Rules

### Schema Organization
- Store all zod schemas in `validations/` folder with `.schema.ts` extension
- Use `z.infer<typeof schema>` for TypeScript types
- Export both schema and type from schema files

```tsx
// validations/user.schema.ts
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export type CreateUserData = z.infer<typeof createUserSchema>
```

### Form Configuration
- Always use `zodResolver` for validation
- Set meaningful `defaultValues` to prevent uncontrolled inputs
- Use `mode: "onChange"` for real-time validation on critical forms
- Use `mode: "onBlur"` for better UX on longer forms

```tsx
const form = useForm<FormData>({
  resolver: zodResolver(schema),
  mode: "onBlur", // or "onChange" for real-time
  defaultValues: {
    // Always provide defaults
  },
})
```

### Field Patterns
- Always wrap fields in `FormField` component
- Use `FormControl` to connect input with form state
- Include `FormMessage` for error display
- Destructure `field` props with spread operator

```tsx
<FormField
  control={form.control}
  name="fieldName"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Label</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Conditional Fields
```tsx
<FormField
  control={form.control}
  name="conditionalField"
  render={({ field }) => (
    <FormItem className={cn(
      !watchedValue && "hidden"
    )}>
      <FormLabel>Conditional Field</FormLabel>
      <FormControl>
        <Input {...field} disabled={!watchedValue} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

## Advanced Patterns

### Dynamic Arrays
```tsx
const { fields, append, remove } = useFieldArray({
  control: form.control,
  name: "items",
})

{fields.map((field, index) => (
  <FormField
    key={field.id}
    control={form.control}
    name={`items.${index}.name`}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          <Input {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
))}
```

### Async Validation
```tsx
const emailSchema = z.string().email().refine(
  async (email) => {
    const exists = await checkEmailExists(email)
    return !exists
  },
  { message: "Email already exists" }
)
```

### Custom Validation
```tsx
const schema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})
```

## Performance Optimizations

### Controlled Re-renders
```tsx
// Watch specific fields only
const watchedField = form.watch("specificField")

// Use callback version for complex logic
const watchedValue = form.watch((data) => data.field1 + data.field2)
```

### Memoization
```tsx
const MemoizedFormField = memo(({ name }: { name: string }) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          <Input {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
))
```

## Common Patterns

### Reset Form After Submit
```tsx
async function onSubmit(values: FormData) {
  await submitData(values)
  form.reset() // Reset to default values
}
```

### Dirty State Check
```tsx
const isDirty = form.formState.isDirty

// Warn before leaving
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault()
    }
  }
  window.addEventListener("beforeunload", handleBeforeUnload)
  return () => window.removeEventListener("beforeunload", handleBeforeUnload)
}, [isDirty])
```

## File Upload Pattern
```tsx
<FormField
  control={form.control}
  name="file"
  render={({ field: { value, onChange, ...field } }) => (
    <FormItem>
      <FormLabel>Upload File</FormLabel>
      <FormControl>
        <Input
          {...field}
          type="file"
          onChange={(e) => onChange(e.target.files?.[0])}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```


