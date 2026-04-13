# CLAUDE.md

## Project: AnalyticsMap

Analytics governance dev tool for mobile apps. Scans codebases (React Native, Swift, Kotlin, Flutter), detects user interactions via LLM, maps features, shows tracking coverage visually, and lets devs define tracking rules.

### Architecture

Monorepo with pnpm workspaces:
- `packages/shared` — TypeScript types shared across CLI and UI
- `packages/cli` — Node.js CLI (Commander.js) with scan, map, validate, ask, ui commands
- `packages/ui` — React dashboard (Vite + Tailwind + React Flow + Recharts + Monaco)

### Key patterns

- LLM (Claude Sonnet) for interaction detection instead of AST parsing
- RAG (Vectra local + Voyage embeddings) for chat queries and smart scanning
- YAML config in `.analyticsmap/` directory per project
- Provider pattern for analytics providers (Segment, PostHog, Amplitude, etc.)
- Dashboard runs locally like Storybook (`analyticsmap ui` → localhost:4821)

### Commands

```bash
pnpm build          # Build all packages
pnpm test           # Run vitest
pnpm dev            # Dev mode
```

### Important constraints

- Keep CLI logic independent from UI
- Shared types in packages/shared are the contract between CLI and UI
- LLM prompts must enforce naming conventions from config
- All scan results persisted in .analyticsmap/plan.yml (YAML, human-editable)
- Vector index stored in .analyticsmap/index/ (git-ignored)
