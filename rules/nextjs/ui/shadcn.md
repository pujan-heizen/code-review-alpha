# shadcn/ui Best Practices & Rules
## Component Usage
### Prioritization
- **Always use shadcn components first** before custom components
- Only create custom components when shadcn doesn't provide the required functionality
- Extend shadcn components using composition rather than modification
## Styling & Customization
- Use shadcn defined colors instead of hard coded colors from tailwind css
## Code Organization
### Component Structure
- Keep shadcn components in `components/ui/` directory
- Create composite components in `components/` for business logic
### Reusability
- Wrap shadcn components in business-specific components
- Pass through all native props using `...props`
- Maintain component API consistency
```typescript
interface CustomButtonProps extends ButtonProps {
  loading?: boolean;
}

export function CustomButton({ loading, children, ...props }: CustomButtonProps) {
  return (
    <Button {...props} disabled={loading || props.disabled}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  )
}
```
## Form Integration
### Form Components
- Use shadcn Form components with react-hook-form
- Combine FormField, FormItem, FormLabel, FormControl for consistent structure
- Apply proper validation feedback with FormMessage
### Input Patterns
- Use controlled components with form state
- Implement proper error states and loading states
- Maintain consistent spacing and layout
## Anti-Patterns
### Avoid
- ❌ Direct modification of shadcn component files
- ❌ Mixing shadcn with other UI libraries
- ❌ Hardcoding colors instead of using theme variables
- ❌ Creating duplicate functionality that shadcn already provides
### Prefer
- ✅ Composition over modification
- ✅ Theme variables over hardcoded values
- ✅ Component variants over conditional styling
- ✅ Proper TypeScript interfaces for props
- ✅ Consistent naming conventions
## Common Patterns
### Dialog/Modal Usage
```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Modal Title</DialogTitle>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button onClick={() => setOpen(false)}>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```
### Table Implementation
- Use DataTable pattern for complex tables
- Implement sorting, filtering, and pagination
- Maintain responsive behavior with horizontal scroll
### Form Validation
- Combine zod schemas with shadcn Form components
- Display validation errors using FormMessage
- Implement real-time validation feedback


