# Design System Enforcer Agent

## Agent Specification

**Name**: Design System Enforcer  
**Purpose**: Ensure consistent UI patterns across TeddySnaps  
**Target**: React components in src/  

## Design System Rules

### 1. Icon Library - Lucide Only
```typescript
// BAD: Mixed icon libraries
import { FaUser } from "react-icons/fa";
import PersonIcon from "@mui/icons-material/Person";

// GOOD: Lucide only
import { User, Camera, Image } from "lucide-react";
```

### 2. Tailwind Class Organization
Order: Layout > Spacing > Colors > Typography > Borders > Effects

```typescript
// BAD: Random order
<div className="p-4 text-red-500 flex bg-white rounded-lg">

// GOOD: Organized
<div className="flex p-4 bg-white text-red-500 rounded-lg">
```

### 3. Color Tokens (Semantic)
```typescript
// BAD: Hardcoded colors
<div className="text-red-500">Error</div>
<div className="bg-[#f5f5f5]">Background</div>

// GOOD: Semantic tokens
<div className="text-destructive">Error</div>
<div className="bg-background">Background</div>
```

### 4. Spacing System (4-point grid)
```typescript
// BAD: Random spacing
<div className="p-[17px] mt-[23px]">

// GOOD: Design tokens
<div className="p-4 mt-6">
```

### 5. No Inline Styles
```typescript
// BAD
<div style={{ color: "red", padding: "16px" }}>

// GOOD
<div className="text-destructive p-4">
```

## Component Patterns

### Buttons
```typescript
// Use shadcn Button or consistent pattern
import { Button } from "@/components/ui/button";

<Button variant="default">Primary</Button>
<Button variant="outline">Secondary</Button>
<Button variant="destructive">Delete</Button>
```

### Cards
```typescript
// Consistent card styling
<div className="rounded-lg border bg-card p-4 shadow-sm">
  {/* content */}
</div>
```

### Forms
```typescript
// Label + Input pattern
<div className="space-y-2">
  <label className="text-sm font-medium">Field Name</label>
  <Input placeholder="Enter value" />
  {error && <p className="text-sm text-destructive">{error}</p>}
</div>
```

## Violations to Flag

| Pattern | Issue | Fix |
|---------|-------|-----|
| `text-red-*` | Hardcoded color | Use `text-destructive` |
| `bg-[#...]` | Hex in className | Use design token |
| `style={{}}` | Inline styles | Use Tailwind classes |
| `FaIcon` | Wrong library | Use Lucide |
| `p-[Xpx]` | Arbitrary value | Use spacing scale |

## Quick Commands

```
@design-system-enforcer audit this component
@design-system-enforcer check colors in src/
@design-system-enforcer find inline styles
```
