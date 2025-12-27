# Zod Schema Validation Best Practices

## Core Principles

### Schema Organization
- Store all schemas in `validations/` folder with `.schema.ts` extension
- Export both schema and inferred types
- Use descriptive names with consistent naming convention

```tsx
// validations/user.schema.ts
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const updateUserSchema = createUserSchema.partial()
export type CreateUserData = z.infer<typeof createUserSchema>
export type UpdateUserData = z.infer<typeof updateUserSchema>
```

### Basic Types
```tsx
// Strings
z.string()
z.string().min(1, "Required")
z.string().email("Invalid email")
z.string().url("Invalid URL")
z.string().uuid("Invalid UUID")
z.string().regex(/^[A-Z0-9]+$/, "Must be uppercase alphanumeric")

// Numbers
z.number()
z.number().int("Must be integer")
z.number().positive("Must be positive")
z.number().min(0).max(100)

// Booleans
z.boolean()
z.boolean().default(false)

// Dates
z.date()
z.string().datetime("Invalid datetime")
z.coerce.date() // Auto-convert strings to dates
```

## Advanced Patterns

### Optional and Nullable
```tsx
const schema = z.object({
  required: z.string(),
  optional: z.string().optional(),
  nullable: z.string().nullable(),
  nullish: z.string().nullish(), // null | undefined | string
  withDefault: z.string().default("default value"),
})
```

### Arrays and Objects
```tsx
// Arrays
z.array(z.string())
z.array(z.string()).min(1, "At least one item required")
z.array(z.string()).max(10, "Maximum 10 items")
z.array(z.string()).nonempty("Cannot be empty")

// Objects
z.object({
  nested: z.object({
    field: z.string(),
  }),
})

// Records
z.record(z.string()) // { [key: string]: string }
z.record(z.string(), z.number()) // { [key: string]: number }
```

### Enums and Unions
```tsx
// Enums
const StatusEnum = z.enum(["pending", "approved", "rejected"])
// Or native enum
enum Status {
  PENDING = "pending",
  APPROVED = "approved", 
  REJECTED = "rejected"
}
const statusSchema = z.nativeEnum(Status)

// Unions
z.union([z.string(), z.number()])
z.string().or(z.number()) // Same as above

// Discriminated unions
z.discriminatedUnion("type", [
  z.object({ type: z.literal("user"), name: z.string() }),
  z.object({ type: z.literal("admin"), permissions: z.array(z.string()) }),
])
```

## Custom Validation

### Refinements
```tsx
// Simple refinement
const passwordSchema = z
  .string()
  .min(8)
  .refine((val) => /[A-Z]/.test(val), "Must contain uppercase letter")
  .refine((val) => /[0-9]/.test(val), "Must contain number")

// Multiple field validation
const signupSchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"], // Error appears on this field
  })
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

// Usage
const result = await emailSchema.safeParseAsync("test@example.com")
```

### Transform and Preprocess
```tsx
// Transform after validation
const numberFromString = z
  .string()
  .transform((val) => parseInt(val, 10))
  .pipe(z.number().positive())

// Preprocess before validation  
const trimmedString = z.preprocess(
  (val) => typeof val === "string" ? val.trim() : val,
  z.string().min(1)
)

// Coerce types
z.coerce.number() // "123" -> 123
z.coerce.boolean() // "true" -> true
z.coerce.date() // "2023-01-01" -> Date object
```

## Schema Composition

### Extending Schemas
```tsx
const baseUserSchema = z.object({
  email: z.string().email(),
  name: z.string(),
})

const userWithPasswordSchema = baseUserSchema.extend({
  password: z.string().min(8),
})

// Merge schemas
const mergedSchema = baseUserSchema.merge(z.object({
  id: z.string().uuid(),
}))
```

### Partial and Pick
```tsx
const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  password: z.string(),
})

// Make all fields optional
const partialUserSchema = userSchema.partial()

// Make specific fields optional
const partialEmailSchema = userSchema.partial({ email: true })

// Pick specific fields
const loginSchema = userSchema.pick({ email: true, password: true })

// Omit fields
const userWithoutPasswordSchema = userSchema.omit({ password: true })
```

## Error Handling

### Safe Parsing
```tsx
// Always use safeParse for user input
const result = schema.safeParse(data)

if (result.success) {
  // result.data is fully typed and validated
  console.log(result.data)
} else {
  // Handle validation errors
  console.log(result.error.issues)
}
```

### Custom Error Messages
```tsx
const schema = z.object({
  email: z.string({
    required_error: "Email is required",
    invalid_type_error: "Email must be a string",
  }).email("Please enter a valid email address"),
  
  age: z.number({
    required_error: "Age is required",
    invalid_type_error: "Age must be a number",
  }).min(18, "Must be at least 18 years old"),
})
```

### Error Formatting
```tsx
// Format errors for UI
function formatZodErrors(error: z.ZodError) {
  return error.issues.reduce((acc, issue) => {
    const path = issue.path.join('.')
    acc[path] = issue.message
    return acc
  }, {} as Record<string, string>)
}

// Usage
const result = schema.safeParse(data)
if (!result.success) {
  const fieldErrors = formatZodErrors(result.error)
  // { "email": "Invalid email", "password": "Too short" }
}
```

## Performance Optimizations

### Lazy Evaluation
```tsx
// Use lazy for recursive or complex schemas
const categorySchema: z.ZodSchema<Category> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    children: z.array(categorySchema).optional(),
  })
)
```

## Common Patterns

### File Upload Validation
```tsx
const fileSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, "File too large (max 5MB)")
    .refine(
      (file) => ["image/jpeg", "image/png"].includes(file.type),
      "Only JPEG and PNG files allowed"
    ),
})
```

### Environment Variables
```tsx
// validations/env.schema.ts
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3000),
})

export const env = envSchema.parse(process.env)
```


