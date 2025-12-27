# Next.js Development Rules & Best Practices
## Core Architecture Principles
* **Modularize logic and components** for maximum reusability
* **Organize code** in a clean, maintainable folder structure
* **Strictly prioritize shadcn/ui components** for all UI elements
* **Optimize performance** and follow Next.js best practices by default
* **Write production-ready code only** with no unnecessary repetition
* **Use TypeScript** exclusively for type safety
* **Use Tailwind CSS** with defined theme colors and responsive design

## Directory Structure Standards
### Required Folder Organization
```
src/
├── app/                    # App Router (Next.js 13+)
├── components/             # Reusable UI components (no absolute exports)
├── services/               # API calls (absolute exports via index.ts)
│   └── *.service.ts       # Format: xx.service.ts
├── types/                  # TypeScript definitions (absolute exports)
├── validations/            # Zod schemas (absolute exports)
│   └── *.schema.ts        # Format: xx.schema.ts
├── utils/                  # Utility functions
├── stores/                 # Zustand state management
├── contexts/               # React contexts
├── hooks/                  # Custom hooks
└── constants/              # App constants
```

## Next.js Specific Rules
### Server vs Client Components
* **Default to Server Components** unless client interactivity is needed
* **Use 'use client' directive** only when necessary:
  - Event handlers
  - Browser-only APIs
  - State management
  - Interactive components
* **Keep Server Components** for:
  - Data fetching
  - SEO content
  - Static content
### Performance Optimization
* **Use Next.js Image component** for all images
* **Implement lazy loading** for heavy components
* **Prefer Skeleton loading** instead of simple loaders
* **Use dynamic imports** for code splitting
* **Optimize fonts** with next/font
### Form Management
* **Use shadcn/ui form components** with react-hook-form if shadcn is used otherwise user react-hook-form directly
* **Implement Zod validation** for all forms
* **Handle form states** properly (loading, error, success)
### SEO & Metadata
* **Use Next.js Metadata API** for all pages
* **Implement structured data** where applicable
* **Use proper heading hierarchy** (h1, h2, h3...)
### Styling Standards
* **Implement responsive design** (mobile-first)
### State Management
* **Use Zustand** for global state
* **Keep state local** when possible (useState)
* **Use React Context** wherever needed
* **Avoid prop drilling** beyond 2-3 levels, use react context when that happen
## Code Quality Standards
### Component Structure
```typescript
// Imports 
import Image from 'next/image';
// more imports here

// Good: Component structure
type ComponentProps = {
  // Props with proper types
}

export function Component({ prop }: ComponentProps) {
  // Hooks first
  // Event handlers, e.g useEffect etc
  // Render logic
  return (
    <div className="tailwind-classes">
      {/* JSX content */}
    </div>
  );
}
```

### File Naming Conventions
* **Use kebab-case** for files and folders
* **Use PascalCase** for component files
* **Use camelCase** for utility functions
* **Add proper extensions** (.tsx, .ts, .service.ts, .schema.ts)


