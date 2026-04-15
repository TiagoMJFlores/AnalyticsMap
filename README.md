# AnalyticsMap

Analytics coverage tool for mobile and web apps. Scans your codebase, detects which analytics providers you're using, groups files by feature, and shows what's tracked and what's missing.

Works with React Native, Swift, Kotlin, Flutter, and React web projects.

## What it does

- Detects analytics providers already in your code (Firebase, Sentry, PostHog, Mixpanel, Amplitude, Segment, and more)
- Groups your files by business feature using Claude
- Shows analytics coverage per feature with a visual dashboard
- Lists every tracked and missing event with file and line number
- Checks event naming quality and implementation patterns
- Flags hardcoded event names, missing facades, duplicate events, and inconsistent naming
- Shows code context and suggested tracking code for missing events

## Quick start

```bash
# Install
npm install -g analyticsmap

# Point it at your project and open the dashboard
analyticsmap ui --path ./your-app
```

The dashboard opens at `localhost:4821`. Click "Map Features" to detect your project's features, then "Analyze" on any feature to see its coverage.

You need an `ANTHROPIC_API_KEY` for feature detection and coverage analysis. Provider detection and health checks work without it.

```bash
export ANTHROPIC_API_KEY=sk-...
```

## CLI commands

```bash
# Detect features in your project
analyticsmap map --path ./your-app --init

# Analyze coverage for one feature
analyticsmap scan --feature "Checkout" --path ./your-app

# Analyze all features
analyticsmap scan --all --path ./your-app

# Check tracking rules in CI
analyticsmap validate --path ./your-app --ci

# Open the visual dashboard
analyticsmap ui --path ./your-app
```

## Dashboard

Three pages:

**Dashboard** -- overview with provider cards, health score, coverage bars per feature, and feature cards with analyze buttons.

**Files** -- file tree with coverage indicators. Click a file to see its code with tracked lines highlighted and missing events listed.

**Events** -- table of every event in the project. Filter by feature, provider, or status. Expand a row to see:
- Code context around the event
- Suggested tracking code for missing events
- Naming and quality feedback per event

## Health checks

Runs without API key. Detects:

- No analytics facade (direct SDK calls without a wrapper function)
- Duplicate events across providers
- Inconsistent naming conventions (mixed snake_case and camelCase)
- Hardcoded event names (no centralized constants)
- Error-only tracking (catch blocks tracked, success paths not)

Each issue includes a description, affected files, and a suggested fix with code.

## Configuration

`analyticsmap map --init` creates `.analyticsmap/config.yml`:

```yaml
platform: "auto"               # auto | react-native | swift | kotlin | flutter | react-web
naming: "{screen}_{element}_{action}"
requiredProperties: ["screen", "element_type"]
ignore:
  - "**/*.test.*"
  - "**/node_modules/**"
trackingFunction: "analytics.track"
provider: "auto"
```

Scan results are saved to `.analyticsmap/plan.yml` and `.analyticsmap/features.yml`. Both are human-readable YAML you can edit.

## How it works

Provider detection and health checks use regex pattern matching -- no API calls, instant results.

Feature detection and coverage analysis send your code to Claude Sonnet, which understands the semantics of your components (buttons, forms, navigation, gestures) across all supported platforms. This is more accurate than AST parsing and works with any framework without per-language parsers.

The two-phase flow (map features first, then analyze per feature) means you only pay for the features you care about.

## Supported providers

Firebase, Sentry, PostHog, Mixpanel, Amplitude, Segment, Google Analytics, Datadog. Custom tracking functions are configurable.

## Supported platforms

React Native, Swift/SwiftUI, Kotlin/Jetpack Compose, Flutter, React web. Platform is auto-detected from your project files.

## Project structure

```
packages/
  shared/    types shared between CLI and UI
  cli/       analysis engine, API server, CLI commands
  ui/        React dashboard (Vite + Tailwind)
```

## Development

```bash
pnpm install
pnpm build

# Run CLI
node packages/cli/dist/index.js --help

# Dev mode for UI
cd packages/ui && pnpm dev
```

## License

MIT
