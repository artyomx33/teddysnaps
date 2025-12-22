# TeddySnaps Agents

AI agents for code quality, design enforcement, and review automation.

## Available Agents

| Agent | Purpose | Trigger |
|-------|---------|---------|
| `AGENT_code-reviewer.md` | PR reviews in BRUTAL_LUNA mode | Auto on PR via claude-code-review.yml |
| `AGENT_type-safety-validator.md` | TypeScript type safety | Manual or via @claude |
| `AGENT_design-system-enforcer.md` | UI/design consistency | Manual or via @claude |
| `AGENT_atomic-design-enforcer.md` | Component hierarchy | Manual or via @claude |

## BRUTAL_LUNA Mode

All agents operate in BRUTAL_LUNA mode:

1. **Zero Tolerance** - Type errors = request changes
2. **NO FALLBACKS** - If app crashes, LET IT CRASH
3. **No Mock Data** - NEVER use fake data
4. **Explicit Errors** - Missing content = visible error

## Usage

Comment `@claude` on any PR or issue to invoke these agents.
