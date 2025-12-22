# Atomic Design Enforcer Agent

## Agent Specification

**Name**: Atomic Design Enforcer  
**Purpose**: Enforce component hierarchy and organization  
**Target**: Components in src/components/  

## Simplified 3-Level Structure

TeddySnaps uses a simplified atomic design with 3 levels:

```
src/components/
  ui/          # Atoms + Molecules (reusable, no business logic)
  features/    # Feature-specific (business logic allowed)
  layout/      # Page structure components
```

## Level Rules

### 1. ui/ (Atoms + Molecules)
- Reusable across features
- NO business logic
- NO direct API calls
- Props-driven only
- Examples: Button, Input, Card, Badge, Avatar, Modal

```typescript
// GOOD: Pure UI component
function Badge({ children, variant }: BadgeProps) {
  return (
    <span className={cn("rounded-full px-2 py-1", variants[variant])}>
      {children}
    </span>
  );
}

// BAD: Business logic in ui/
function Badge({ photoId }: { photoId: string }) {
  const { data } = useQuery(["photo", photoId]); // NO!
  return <span>{data.status}</span>;
}
```

### 2. features/ (Organisms)
- Feature-specific components
- Business logic allowed
- Can call APIs/hooks
- Can import from ui/ and other features/
- Examples: PhotoGrid, FaceNaming, OrderCart, PaymentForm

```typescript
// GOOD: Feature with business logic
function PhotoGrid({ sessionId }: { sessionId: string }) {
  const { data: photos } = usePhotos(sessionId);
  
  return (
    <div className="grid grid-cols-3 gap-4">
      {photos.map(photo => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </div>
  );
}
```

### 3. layout/ (Templates)
- Page structure components
- Handle navigation, headers, sidebars
- Compose features and ui components
- Examples: Navbar, Sidebar, PageWrapper, Footer

```typescript
// GOOD: Layout component
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
```

## Import Rules

| From | Can Import |
|------|------------|
| ui/ | Only other ui/ components |
| features/ | ui/ + other features/ |
| layout/ | ui/ + features/ + layout/ |
| pages/ | Everything |

```typescript
// BAD: ui/ importing from features/
// src/components/ui/Button.tsx
import { usePhotos } from "@/components/features/hooks"; // NO!

// GOOD: features/ importing from ui/
// src/components/features/PhotoGrid.tsx
import { Button } from "@/components/ui/button"; // OK
import { Card } from "@/components/ui/card"; // OK
```

## Naming Conventions

| Level | Convention | Example |
|-------|------------|---------|
| ui/ | PascalCase, generic | `Button.tsx`, `Card.tsx` |
| features/ | PascalCase, descriptive | `PhotoGrid.tsx`, `FaceNaming.tsx` |
| layout/ | PascalCase, structure | `Navbar.tsx`, `PageWrapper.tsx` |

## Common Violations

### 1. Business Logic in ui/
```typescript
// BAD: src/components/ui/PhotoCard.tsx
function PhotoCard({ id }: { id: string }) {
  const { data } = usePhoto(id); // Move to features/
  return <div>...</div>;
}
```

### 2. UI Component in features/
```typescript
// BAD: src/components/features/Button.tsx
function Button({ children }) { ... } // Move to ui/
```

### 3. Cross-level Imports
```typescript
// BAD: ui/ importing from features/
import { useSession } from "../features/hooks";
```

## Quick Commands

```
@atomic-design-enforcer audit src/components/
@atomic-design-enforcer check imports
@atomic-design-enforcer suggest reorganization
```

## Migration Checklist

When adding new components:
1. [ ] Does it have business logic? → features/
2. [ ] Is it purely visual/reusable? → ui/
3. [ ] Is it page structure? → layout/
4. [ ] Check import direction is correct
