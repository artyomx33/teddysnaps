# TeddySnaps - GitHub Workflows & Agents Implementation Plan

## Overview

**Goal**: Copy and adapt GitHub workflows and agents from teddykids-lms-main to TeddySnaps, optimizing for the TeddySnaps stack.

**TeddySnaps Stack**:
- Next.js 15 with React 19
- TypeScript 5
- Supabase (database, auth, storage) - **NO RLS enforcement**
- Tailwind CSS 4
- face-api.js (AI face recognition)
- Mollie (payments)
- Lucide icons

**Source Project**: teddykids-lms-main
**Target Project**: teddysnaps

---

## BRUTAL_LUNA MODE - Defined

When activated, the reviewer operates with:

1. **Zero Tolerance** - Any type error = request changes
2. **NO FALLBACKS** - If app crashes, LET IT CRASH so we can fix it
3. **No Mock Data** - NEVER use fake/sample data
4. **Performance Obsessed** - Flag n+1 queries, unnecessary re-renders
5. **Security First** - Block hardcoded credentials, unvalidated input
6. **No Handwaving** - Vague variable names get called out
7. **Explicit Errors** - Missing content = visible error, not hidden fallback

### BRUTAL_LUNA Checklist
- [ ] Types are explicit (no `any`)
- [ ] Error handling shows real errors (no silent catch)
- [ ] Loading states exist
- [ ] Edge cases covered
- [ ] No console.logs in production code
- [ ] NO try/catch that silently falls back to mock data

---

## Phase 1: GitHub Workflows

### Task 1.1: Create Directory Structure
- [ ] Create `.github/workflows/` directory in teddysnaps

### Task 1.2: Implement `claude.yml` (Claude Code Trigger)
- [ ] Copy `claude.yml` from teddykids-lms-main
- [ ] Adapt for TeddySnaps:
  - Keep @claude mention triggers
  - Keep issue/PR comment triggers
  - Add `CLAUDE_CODE_OAUTH_TOKEN` secret requirement to docs

### Task 1.3: Implement `claude-code-review.yml` (Auto PR Review)
- [ ] Copy `claude-code-review.yml` from teddykids-lms-main
- [ ] Adapt review prompt for TeddySnaps context:
  - Focus on Next.js 15 patterns
  - Check face-api.js integration
  - Verify Mollie payment flow
  - Check Supabase RLS policies
- [ ] Keep BRUTAL_LUNA mode for surgical reviews

### Task 1.4: Implement `gate-system.yml` (Quality Gates)
- [ ] Create simplified gate system for TeddySnaps
- [ ] Gates to include:
  1. **Type Check**: `npx tsc --noEmit`
  2. **Lint**: `npm run lint`
  3. **Build**: `npm run build`
- [ ] Add PR comment with gate results
- [ ] Block merge on gate failure

---

## Phase 2: Agents for TeddySnaps

### Task 2.1: Create Agents Directory
- [ ] Create `agents/` directory in teddysnaps root

### Task 2.2: Core Agent - Type Safety Validator
**File**: `agents/AGENT_type-safety-validator.md`
- [ ] Adapt from agent_03_type-safety-validator.md
- [ ] Focus on:
  - Next.js 15 server actions types
  - Supabase client typing
  - React 19 JSX types
  - face-api.js type definitions

### Task 2.3: Core Agent - Code Reviewer
**File**: `agents/AGENT_code-reviewer.md`
- [ ] Adapt from agent_11_code-reviewer.md
- [ ] TeddySnaps-specific checks:
  - Server actions proper error handling
  - Supabase RLS awareness
  - Mollie payment flow validation
  - Image optimization patterns

### Task 2.4: Core Agent - Design System Enforcer
**File**: `agents/AGENT_design-system-enforcer.md`
- [ ] Adapt from agent_12_design-system-enforcer.md
- [ ] TeddySnaps UI rules:
  - Lucide icons only
  - Tailwind CSS 4 patterns
  - Consistent spacing (4-point grid)
  - Semantic color tokens

### Task 2.5: NEW Agent - Atomic Design Enforcer
**File**: `agents/AGENT_atomic-design-enforcer.md`
- [ ] Create new agent for atomic design principles
- [ ] Enforce component hierarchy:
  - **Atoms**: Buttons, inputs, labels, icons
  - **Molecules**: Form fields, cards, badges
  - **Organisms**: Forms, galleries, navigation
  - **Templates**: Page layouts
  - **Pages**: Complete views
- [ ] Directory structure enforcement:
  ```
  src/components/
    atoms/
    molecules/
    organisms/
    templates/
  ```
- [ ] Import rules:
  - Atoms can only import atoms
  - Molecules can import atoms + molecules
  - Organisms can import all below
- [ ] Naming conventions check

---

## Phase 3: Gate Scripts

### Task 3.1: Add Gate Scripts to package.json
- [ ] Add `gates:types` script
- [ ] Add `gates:lint` script
- [ ] Add `gates:build` script
- [ ] Add `gates:all` script (runs all gates)

---

## Implementation Details

### claude.yml Structure
```yaml
name: Claude Code

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]
  pull_request_review:
    types: [submitted]

jobs:
  claude:
    if: contains trigger for @claude
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
```

### claude-code-review.yml Structure
```yaml
name: Claude Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  claude-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          prompt: BRUTAL_LUNA review focusing on:
            - Next.js 15 best practices
            - Server actions security
            - Supabase RLS compliance
            - Mollie payment flow
            - Face recognition integration
```

### gate-system.yml Structure
```yaml
name: Gate System

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run gates:all
```

### Atomic Design Agent Key Rules
1. **Component Location**: Each component must be in its correct atomic level
2. **Import Restrictions**: No importing from higher levels
3. **Props Interface**: Each component must have typed props
4. **Composition**: Higher levels compose lower levels
5. **No Skipping**: Don't put organisms in atoms folder

---

## Success Criteria

1. **Workflows functional**: All 3 workflows run on GitHub Actions
2. **Gates pass**: Type check, lint, and build all pass
3. **Agents documented**: All 4 agents have clear instructions
4. **Atomic design ready**: Structure and rules defined

---

## Files to Create

```
teddysnaps/
  .github/
    workflows/
      claude.yml
      claude-code-review.yml
      gate-system.yml
  agents/
    README.md
    AGENT_type-safety-validator.md
    AGENT_code-reviewer.md
    AGENT_design-system-enforcer.md
    AGENT_atomic-design-enforcer.md
```

---

## Dependencies

- `CLAUDE_CODE_OAUTH_TOKEN` secret must be set in GitHub repo settings
- `GITHUB_TOKEN` is automatic
- npm scripts must exist in package.json

---

## Estimated Tasks: 12
## Complexity: Medium
## Priority: High (enables CI/CD quality)
