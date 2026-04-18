# AnalyticsMap

## The problem

A PM asks how many users tapped the new checkout button last week. Nobody knows. The button was shipped three releases ago, the person who added it didn't add tracking, and now someone has to read through the codebase to figure out what's tracked and what isn't. By the time the answer comes back, the PM has moved on.

Analytics tends to rot quietly. A new screen ships without tracking. Someone adds a second provider "temporarily" and it stays for a year. The same event gets named `checkout_click` in one file, `onCheckoutPressed` in another, and `cart_buy_pressed` in a third. Nobody notices because it doesn't break the build. It just makes every product question take a week.

AnalyticsMap scans your mobile or web codebase and answers three questions: what analytics providers are already in the code, what user interactions have tracking and which don't, and where is the existing tracking sloppy.

It's meant to run locally (dashboard opens in your browser like Storybook) and in CI (fails the build when coverage drops or rules are violated).

## What it does

Runs on React Native, Swift/SwiftUI, Kotlin/Compose, Flutter, and React web projects. Two layers:

**Static analysis (no API key needed, instant):**
- Detects which analytics SDKs are imported and used (Firebase, Sentry, PostHog, Mixpanel, Amplitude, Segment, Google Analytics, Datadog)
- Flags common problems: no analytics facade, duplicate events across providers, inconsistent naming, hardcoded event names, error-only tracking

**LLM analysis (Claude):**
- Groups your files into business features ("Checkout", "Auth", "Profile") without manual configuration
- Finds every user-facing interaction in a feature (buttons, forms, navigation, gestures) and checks whether it has tracking
- Generates a suggested tracking call for missing events, placed correctly inside the relevant function

The LLM approach means the same tool works across all mobile platforms without per-language parsers. Claude understands that a `<Pressable onPress>` in React Native, a `Button(action:)` in SwiftUI, a `Modifier.clickable` in Compose, and a `GestureDetector` in Flutter are all the same kind of thing.

## Quick start

```bash
# Clone and install
git clone https://github.com/TiagoMJFlores/AnalyticsMap.git
cd AnalyticsMap
pnpm install
pnpm build

# Set your Anthropic API key (needed for feature detection and coverage analysis)
export ANTHROPIC_API_KEY=sk-...

# Open the dashboard pointing at your project
node packages/cli/dist/index.js ui --path /path/to/your-app
```

The dashboard opens at `localhost:4821`. Click "Map Features" to detect your project's features, then "Analyze" on any feature to see its coverage.

Provider detection and health checks work without an API key.

## CLI commands

```bash
# Shorthand: alias for convenience
alias analyticsmap="node /path/to/AnalyticsMap/packages/cli/dist/index.js"

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
