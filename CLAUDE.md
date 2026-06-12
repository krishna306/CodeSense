# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start Electron app with HMR (renderer hot-reloads via Vite)
npm run build         # Vite build + electron-builder for current platform
npm run build:mac     # macOS .dmg (x64 + arm64)
npm run build:win     # Windows .exe NSIS installer
npm run build:linux   # Linux .deb / .rpm / .AppImage
npm run preview       # Preview the production build without packaging
npm run lint          # ESLint over src/ electron/ shared/
npm run typecheck     # tsc --noEmit (no emit, type errors only)
```

There is no test runner configured yet (Phase 1 scope).

## Architecture

### Process Separation

This is a strict two-process Electron app. **Never mix concerns across the boundary.**

- **Main process** (`electron/`) — Node.js, full OS access. All network calls (GitLab API, Claude API), all secret access (keychain), all SQLite reads/writes happen here.
- **Renderer process** (`src/`) — React, zero Node access. Communicates exclusively through `window.api` (the contextBridge surface defined in `electron/preload.ts`).
- **Shared types** (`shared/types.ts`) — Zero-dependency interfaces used by both sides (`Suggestion`, `MRSummary`, `ReviewStatus`).

The `preload.ts` contextBridge is the **only** security boundary. `nodeIntegration: false` and `contextIsolation: true` are enforced on every `BrowserWindow`.

### IPC Contract

`window.api` exposes four namespaces: `auth`, `gitlab`, `review`, `storage`. These are defined in `electron/preload.ts` and mirrored as TypeScript interfaces in `src/types/ipc.ts`. Each namespace maps to a handler file in `electron/ipc/`. When adding a new IPC channel, update all three: the handler, the preload bridge, and the renderer type.

One-way events from main → renderer use `window.api.on('review:suggestion' | 'review:complete' | 'review:error', cb)`.

### AI Review Pipeline

`review.ipc.ts` → `GitLabService` (fetch diff) → `ContextEnricher` (±50 lines context + project standards from repo) → parallel: `StaticAnalyzer` (ESLint/Semgrep) + `AnthropicService` (Claude streaming, up to 10 concurrent file calls) → `SuggestionRanker` (dedup, score, persist to SQLite, emit `review:complete`).

Suggestions are streamed incrementally: `AnthropicService` emits each parsed `Suggestion` object as JSON tokens arrive, which flows through `review.ipc.ts` → IPC event → `reviewStore.suggestions` (Zustand) → `DiffViewer` inserts inline `<AIAnnotation>` components in real time.

### Claude API Usage

`AnthropicService.ts` uses `@anthropic-ai/sdk` with prompt caching. The system prompt and project standards are marked `cache_control: { type: "ephemeral" }` so they are reused across all parallel file calls in a session (target >75% cache hit rate). Model is `claude-sonnet-4-6`, `max_tokens: 2048`. The API key comes from the OS keychain via `keytar`, never from env vars or config files.

### State Management

Three Zustand stores in `src/store/`:
- `mrStore` — MR list, active MR, pagination
- `reviewStore` — suggestions array (grows as stream arrives), risk score, review status
- `settingsStore` — GitLab URL, model choice, severity threshold; persisted on every change via `storage` IPC

Data fetching for MR list uses SWR over `window.api` calls. Streaming review results are handled manually (no SWR) in `useReview.ts`.

### Platform Abstractions

OS-specific code lives in `electron/platform/`. A factory (`platform.ts`) returns the correct implementation for `titlebar` and `tray` based on `process.platform`. The renderer handles platform differences through `src/styles/platform.css` loaded at runtime and the `TitleBar` component which reads `window.api.platform` to adapt its layout.

Key per-platform differences:
- Window chrome: `frame: false` everywhere, but `titleBarStyle: 'hiddenInset'` on macOS vs `'hidden'` elsewhere
- Secrets: `keytar` wraps macOS Keychain / Windows Credential Manager / libsecret transparently
- File paths: always use `app.getPath()` wrappers from `electron/utils/paths.ts` — never hardcode paths
- Tray icon: `trayTemplate.png` (monochrome 16×16) on macOS; full-colour 32×32 PNG on Windows/Linux

### Build & Packaging

`electron-vite` produces three separate bundles into `dist/main`, `dist/preload`, `dist/renderer`. `electron-builder` then packages them using `electron-builder.yml`. Output lands in `dist-electron/`. CI uses a GitHub Actions matrix: one runner per platform (macos-14, windows-latest, ubuntu-22.04); macOS notarisation requires `APPLE_ID` + `APPLE_TEAM_ID` secrets; Windows signing requires `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD`.

### Security Rules

- **Secrets** (API keys, OAuth tokens) go in OS keychain via `keytar` only — never SQLite, localStorage, or `.env`
- **HTTP calls** happen in the main process only; the renderer must never make network requests directly
- `ContextEnricher` strips token/key/password patterns from diffs before sending to Claude
- Raw diff blobs stored to disk are AES-256 encrypted
