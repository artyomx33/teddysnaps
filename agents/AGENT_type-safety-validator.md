# Type Safety Validator Agent

## Agent Specification

**Name**: Type Safety Validator  
**Purpose**: Ensure strict TypeScript type safety across TeddySnaps  
**Target**: All TypeScript files in src/  

## BRUTAL_LUNA Type Rules

1. **No `any`** - EVER. Use `unknown` with type guards.
2. **No type assertions** without validation (`as X` is banned without guard)
3. **Explicit return types** on exported functions
4. **No `!` operator** without justification comment

## What This Agent Checks

### 1. Function Signatures
```typescript
// BAD: Missing return type
export async function getPhotos() {
  return await supabase.from("photos").select();
}

// GOOD: Explicit return type
export async function getPhotos(): Promise<Photo[]> {
  const { data, error } = await supabase.from("photos").select();
  if (error) throw new Error(error.message);
  return data;
}
```

### 2. Supabase Query Typing
```typescript
// BAD: Untyped query result
const { data } = await supabase.from("photos").select("*");
const photo = data[0]; // any

// GOOD: Properly typed
const { data } = await supabase
  .from("photos")
  .select("id, url, family_id")
  .returns<Photo[]>();
```

### 3. Server Action Types
```typescript
// BAD: No input validation
export async function createOrder(input: any) {
  // dangerous
}

// GOOD: Zod validation
import { z } from "zod";

const OrderInput = z.object({
  familyId: z.string().uuid(),
  items: z.array(z.object({
    photoId: z.string().uuid(),
    quantity: z.number().positive()
  }))
});

export async function createOrder(input: z.infer<typeof OrderInput>) {
  const validated = OrderInput.parse(input);
  // safe to use
}
```

### 4. React Props
```typescript
// BAD: Inline props
function PhotoCard({ photo, onSelect }) {
  // untyped
}

// GOOD: Interface defined
interface PhotoCardProps {
  photo: Photo;
  onSelect: (id: string) => void;
}

function PhotoCard({ photo, onSelect }: PhotoCardProps) {
  // typed
}
```

### 5. Event Handlers
```typescript
// BAD: Implicit any
const handleClick = (e) => { ... }

// GOOD: Explicit type
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => { ... }
```

## Quick Commands

```
@type-safety-validator check src/lib/actions/
@type-safety-validator validate this file
@type-safety-validator find any usage
```

## Success Metrics

- Zero `any` types in production code
- All exported functions have explicit return types
- All Supabase queries are properly typed
- All React components have typed props
