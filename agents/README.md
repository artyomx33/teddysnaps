# TeddySnaps AI Agents

This directory contains AI agent specifications for code quality and review automation.

## Available Agents

| Agent | Purpose |
|-------|---------|
| `AGENT_code-reviewer.md` | PR review in BRUTAL_LUNA mode |
| `AGENT_type-safety-validator.md` | TypeScript type safety enforcement |
| `AGENT_design-system-enforcer.md` | UI consistency and design tokens |
| `AGENT_atomic-design-enforcer.md` | Component hierarchy enforcement |

## BRUTAL_LUNA Mode

All agents operate in BRUTAL_LUNA mode:

1. **Zero Tolerance** - Any type error = request changes
2. **NO FALLBACKS** - If app crashes, LET IT CRASH so we can fix it
3. **No Mock Data** - NEVER use fake/sample data
4. **Performance Obsessed** - Flag n+1 queries, unnecessary re-renders
5. **Security First** - Block hardcoded credentials, unvalidated input
6. **No Handwaving** - Vague variable names get called out
7. **Explicit Errors** - Missing content = visible error, not hidden fallback

## TeddySnaps Stack

- Next.js 15 with React 19
- TypeScript 5
- Supabase (database, storage)
- face-api.js (AI face recognition)
- Mollie (payments)
- Tailwind CSS 4
- Lucide icons

## Usage

These agents are invoked automatically via GitHub Actions:
- `claude-code-review.yml` - Auto PR review
- `claude.yml` - @claude mentions
