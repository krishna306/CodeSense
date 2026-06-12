# CodeSense — AI-Powered GitLab Code Review Desktop App

> Built with Electron.js + React · Powered by Claude (Anthropic)
> Supported platforms: **macOS** (12+) · **Windows** (10/11) · **Linux** (Ubuntu 20.04+, Fedora 38+, Arch)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [How Electron.js Works](#2-how-electronjs-works)
3. [Top-Level Directory Structure](#3-top-level-directory-structure)
4. [Process Architecture](#4-process-architecture)
5. [IPC Contract](#5-ipc-contract-preloadts--sharedtypests)
6. [AI Review Pipeline](#6-ai-review-pipeline-main-process)
7. [Claude API Integration](#7-claude-api-integration-anthropicservicets)
8. [State Management](#8-state-management-zustand)
9. [Key React Components](#9-key-react-components)
10. [OAuth Flow](#10-oauth-flow-gitlab)
11. [Local Storage Schema](#11-local-storage-schema-schemasql)
12. [Build & Packaging](#12-build--packaging)
13. [Technology Stack](#13-technology-stack-summary)
14. [Security Boundaries](#14-security-boundaries)
15. [Cross-Platform Considerations](#15-cross-platform-considerations)
16. [Suggestion Severity Reference](#16-suggestion-severity-reference)
17. [Phased Rollout Plan](#17-phased-rollout-plan)

---

## 1. Project Overview

A cross-platform desktop app (macOS, Windows, Linux) that connects to self-hosted or cloud GitLab instances, fetches MR diffs, runs AI analysis via Claude, and renders inline annotations — all from a single native window. The same codebase ships on all three platforms with OS-appropriate window chrome, keychain integration, and installer formats.

**Supported platforms:**

| Platform | Minimum Version | Installer | Keychain Backend |
|---|---|---|---|
| macOS | 12 Monterey | `.dmg` | macOS Keychain (Security framework) |
| Windows | 10 (1903) / 11 | `.exe` NSIS installer | Windows Credential Manager (DPAPI) |
| Linux | Ubuntu 20.04 · Fedora 38 · Arch | `.deb` · `.rpm` · `.AppImage` | libsecret / GNOME Keyring / KWallet |

**Key capabilities:**
- Automatically review every MR diff using AI before a human reviewer sees it
- Suggest improvements for code quality, security, performance, and maintainability
- Reduce review cycle time by catching common issues early
- Learn from accepted/rejected suggestions to improve over time
- Integrate seamlessly into existing Git workflows with zero friction
- Native look and feel on every OS — system fonts, window controls, and tray icons adapt per platform

---

## 2. How Electron.js Works

Electron bundles **Chromium** (for rendering UI) and **Node.js** (for OS access) into a single desktop app. Your web code becomes a native app.

### Two-Process Model

```
┌─────────────────────────────┐
│      Main Process           │
│  (Node.js — full OS access) │
│                             │
│  • Creates windows          │
│  • File system, network     │
│  • OS APIs (tray, keychain) │
│  • App lifecycle            │
└────────────┬────────────────┘
             │  IPC (inter-process communication)
             │  ipcMain / ipcRenderer
┌────────────▼────────────────┐
│     Renderer Process        │
│  (Chromium — one per window)│
│                             │
│  • HTML / CSS / JavaScript  │
│  • React, Vue, etc.         │
│  • NO direct Node access    │
└─────────────────────────────┘
```

- **Main process** — runs `main.ts`, one instance for the whole app. Full Node.js access.
- **Renderer process** — one per `BrowserWindow`, runs your frontend code. Sandboxed like a browser tab.

### The Preload Script (Security Bridge)

The preload script runs in a privileged context between the two processes. It uses `contextBridge` to safely expose specific Node/main-process APIs to the renderer:

```js
// preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  readFile: (path) => ipcRenderer.invoke('read-file', path)
})
```

```js
// renderer (React, etc.)
window.api.readFile('/some/path')  // safe — only what preload exposed
```

This is why `nodeIntegration: false` + `contextIsolation: true` is the modern secure default.

### IPC (Inter-Process Communication)

Two patterns:

| Pattern | Use case |
|---|---|
| `ipcRenderer.invoke` / `ipcMain.handle` | Request/response (async, returns a value) |
| `ipcRenderer.on` / `webContents.send` | One-way push events (e.g. streaming data) |

### App Lifecycle

```js
const { app, BrowserWindow } = require('electron')

app.whenReady().then(() => {
  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.loadURL('http://localhost:5173')  // dev
  // win.loadFile('dist/index.html')   // prod
})

app.on('window-all-closed', () => app.quit())
```

### Build & Distribution

```
Source code
    │
    ▼
electron-vite / Vite     ← bundles renderer (React etc.)
    │
    ▼
electron-builder         ← packages Chromium + Node + your app
    │
    ▼
.dmg (mac) / .exe (win) / .AppImage (linux)
```

### In This Project (CodeSense)

| File | Role |
|---|---|
| `electron/main.ts` | Main process — IPC handlers, services, window creation |
| `electron/preload.ts` | Exposes `window.api.{auth, gitlab, review, storage}` to renderer |
| `src/` | React renderer — calls only `window.api.*`, never Node directly |

---

## 3. Top-Level Directory Structure

```
codesense/
├── electron/                    # Main process (Node.js, never bundled with React)
│   ├── main.ts                  # App entry — creates BrowserWindow, registers IPC
│   ├── preload.ts               # contextBridge — only surface allowed IPC
│   ├── ipc/                     # IPC route handlers (called by renderer)
│   │   ├── auth.ipc.ts          # OAuth handshake, token refresh, keychain
│   │   ├── gitlab.ipc.ts        # GitLab REST API calls
│   │   ├── review.ipc.ts        # Orchestrates full AI review pipeline
│   │   └── storage.ipc.ts       # SQLite read/write
│   ├── services/                # Business logic, no IPC awareness
│   │   ├── GitLabService.ts     # Typed GitLab API client (axios)
│   │   ├── AnthropicService.ts  # Claude API with prompt caching + streaming
│   │   ├── DiffParser.ts        # Unified diff → structured hunks
│   │   ├── ContextEnricher.ts   # Fetches ±50 lines, full file, standards
│   │   ├── StaticAnalyzer.ts    # Shells out to ESLint / Semgrep / language tools
│   │   └── SuggestionRanker.ts  # Dedup, score, merge LLM + static results
│   ├── storage/
│   │   ├── database.ts          # better-sqlite3 singleton
│   │   └── schema.sql           # Tables mirroring design doc data model
│   ├── platform/                # OS-specific adapters (imported via platform.ts factory)
│   │   ├── platform.ts          # getPlatform() → 'darwin' | 'win32' | 'linux'
│   │   ├── titlebar.darwin.ts   # macOS: frameless + traffic-light controls
│   │   ├── titlebar.win32.ts    # Windows: custom caption buttons (right-aligned)
│   │   ├── titlebar.linux.ts    # Linux: minimal bar, respects DE settings
│   │   ├── tray.darwin.ts       # macOS menu bar tray icon
│   │   ├── tray.win32.ts        # Windows system tray icon + context menu
│   │   └── tray.linux.ts        # Linux AppIndicator / StatusIcon
│   └── utils/
│       ├── keychain.ts          # OS keychain via keytar (darwin/win32/linux backends)
│       ├── paths.ts             # app.getPath() wrappers — cross-platform userData/logs
│       └── logger.ts            # electron-log wrapper (writes to platform log dir)
│
├── src/                         # Renderer process — pure React, zero Node access
│   ├── main.tsx                 # ReactDOM.createRoot entry
│   ├── App.tsx                  # Root layout: Sidebar + Main + AIPanel
│   ├── components/
│   │   ├── TitleBar/            # Cross-platform titlebar — layout adapts per OS
│   │   ├── Sidebar/
│   │   │   ├── ConnectionBadge.tsx
│   │   │   └── MRList.tsx       # Virtualised list (react-window)
│   │   ├── MRHeader/
│   │   │   └── MRHeader.tsx     # MR number, title, stats strip
│   │   ├── TabBar/
│   │   │   └── TabBar.tsx       # Diff / Files / Comments / Commits
│   │   ├── DiffViewer/
│   │   │   ├── DiffViewer.tsx   # File sections, scroll sync
│   │   │   ├── DiffLine.tsx     # Single +/−/ctx line
│   │   │   └── AIAnnotation.tsx # Inline annotation card (bug/security/suggestion)
│   │   ├── AIPanel/
│   │   │   ├── AIPanel.tsx      # Right panel shell
│   │   │   ├── RiskMeter.tsx    # Animated risk bar
│   │   │   └── IssueList.tsx    # Clickable issue rows, severity badges
│   │   └── Toolbar/
│   │       └── Toolbar.tsx      # Split/whitespace/filter buttons
│   ├── hooks/
│   │   ├── useGitLab.ts         # Calls window.api.gitlab.*; returns SWR state
│   │   ├── useReview.ts         # Initiates review, subscribes to streaming events
│   │   └── useSettings.ts       # Reads/writes settings store → persists via IPC
│   ├── store/                   # Zustand slices (no redux boilerplate)
│   │   ├── mrStore.ts           # mrList, activeMR, pagination cursor
│   │   ├── reviewStore.ts       # suggestions[], riskScore, reviewStatus
│   │   └── settingsStore.ts     # gitlabUrl, model choice, severity threshold
│   ├── types/
│   │   ├── gitlab.ts            # MR, Diff, Commit interfaces
│   │   ├── review.ts            # Suggestion, Severity, Category
│   │   └── ipc.ts               # Mirror of preload API surface (shared with electron/)
│   └── styles/
│       ├── globals.css          # CSS vars for dark theme tokens
│       ├── tokens.css           # --color-bg, --color-add, --font-mono, etc.
│       └── platform.css         # Per-OS overrides loaded at runtime (darwin/win32/linux)
│
├── shared/                      # Zero-dependency types shared by both sides
│   └── types.ts                 # Suggestion, MRSummary, ReviewStatus
│
├── assets/
│   └── icons/                   # App icon sets (icns / ico / png)
│
├── vite.config.ts               # Vite + electron-vite plugin
├── electron-builder.yml         # Packaging: dmg, deb, NSIS
├── tsconfig.json
└── package.json
```

---

## 4. Process Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    MAIN PROCESS (Node.js)                 │
│                                                          │
│  BrowserWindow ──► loads renderer via localhost (dev)    │
│                    or file:// (prod)                     │
│                                                          │
│  IPC Handlers                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ auth.ipc     │  │ gitlab.ipc   │  │ review.ipc     │ │
│  │ • OAuth flow │  │ • list MRs   │  │ • fetch diff   │ │
│  │ • keytar     │  │ • get diff   │  │ • enrich ctx   │ │
│  │ • token store│  │ • post cmnt  │  │ • call Claude  │ │
│  └──────────────┘  └──────────────┘  │ • stream back  │ │
│                                       └────────────────┘ │
│  Services (no IPC)                                       │
│  GitLabService → AnthropicService → SuggestionRanker     │
│                                                          │
│  Storage: better-sqlite3 (local reviews, feedback)       │
│  Secrets: keytar (OS keychain — never SQLite)            │
└──────────────────────┬───────────────────────────────────┘
                       │  contextBridge (preload.ts)
                       │  window.api.{auth, gitlab, review, storage}
                       ▼
┌──────────────────────────────────────────────────────────┐
│                  RENDERER PROCESS (React)                 │
│                                                          │
│  App.tsx                                                 │
│  ├── Sidebar (MR list, connection status)                │
│  ├── Main                                                │
│  │   ├── MRHeader                                        │
│  │   ├── TabBar (Diff / Files / Comments / Commits)      │
│  │   ├── Toolbar                                         │
│  │   └── DiffViewer ── AIAnnotation (inline cards)       │
│  └── AIPanel (risk score, issue list, report button)     │
│                                                          │
│  State: Zustand (mrStore, reviewStore, settingsStore)    │
│  Data fetching: SWR over window.api calls                │
└──────────────────────────────────────────────────────────┘
```

---

## 5. IPC Contract (`preload.ts` / `shared/types.ts`)

The preload script is the only security boundary. The renderer never touches Node APIs directly.

```ts
// preload.ts — contextBridge surface
window.api = {
  auth: {
    login(gitlabUrl: string): Promise<void>,
    logout(): Promise<void>,
    status(): Promise<{ connected: boolean; user: string; url: string }>
  },
  gitlab: {
    listMRs(params: MRListParams): Promise<MRSummary[]>,
    getMRDiff(mrIid: number): Promise<DiffFile[]>,
    postComment(mrIid: number, comment: InlineComment): Promise<void>
  },
  review: {
    // Returns reviewId immediately; streams suggestions via 'review:suggestion' event
    startReview(mrIid: number): Promise<string>,
    getReview(reviewId: string): Promise<ReviewResult>,
    submitFeedback(suggestionId: string, action: FeedbackAction): Promise<void>
  },
  storage: {
    getReviewHistory(repoId: string): Promise<ReviewResult[]>,
    getSettings(): Promise<AppSettings>,
    saveSettings(settings: AppSettings): Promise<void>
  },
  // One-way events renderer listens to
  on(channel: 'review:suggestion', cb: (s: Suggestion) => void): void,
  on(channel: 'review:complete', cb: (summary: ReviewSummary) => void): void,
  on(channel: 'review:error', cb: (err: string) => void): void,
  off(channel: string, cb: Function): void
}
```

---

## 6. AI Review Pipeline (Main Process)

```
review.ipc.ts:startReview(mrIid)
│
├── GitLabService.getMRDiff(mrIid)
│     └── GET /api/v4/merge_requests/:iid/diffs
│
├── ContextEnricher.enrich(diffFiles)
│     ├── GET surrounding ±50 lines per hunk
│     ├── Fetch CLAUDE.md / .ai-review.yml from repo
│     └── Load past review dismissals for this file
│
├── StaticAnalyzer.run(diffFiles)          ─────┐ parallel
│     └── ESLint / Semgrep / language tools      │
│                                                │
├── AnthropicService.reviewChunks(chunks)  ──────┤ parallel per file
│     ├── Prompt caching: system + standards     │
│     ├── claude-sonnet-4-6, max_tokens=2048     │
│     ├── Streaming: emit 'review:suggestion'    │
│     │   on each parsed JSON object             │
│     └── Up to 10 concurrent file calls         │
│                                          ──────┘
└── SuggestionRanker.merge(llmResults, staticResults)
      ├── Dedup by (file, line, category)
      ├── Score: severity × confidence × recurrence
      ├── Compute risk score (0–100)
      ├── Persist to SQLite
      └── emit 'review:complete' with ReviewSummary
```

**Suggestion scoring weights:**

| Factor | Weight |
|---|---|
| `severity_score` | critical=4, major=3, minor=2, suggestion=1 |
| `confidence` | LLM self-reported confidence (0–1) |
| `recurrence` | Same pattern flagged in past MRs of this repo |
| `user_acceptance_rate` | Historical accept/dismiss ratio for this suggestion type |

---

## 7. Claude API Integration (`AnthropicService.ts`)

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: await keychain.get("anthropic_key") });

const SYSTEM_PROMPT = `You are a senior software engineer performing a code review.
Identify real issues only. Return a JSON array — no prose outside the array.`;

async function reviewChunk(
  chunk: DiffChunk,
  standards: string,
  language: string,
  onSuggestion: (s: Suggestion) => void
): Promise<Suggestion[]> {
  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }       // cached across all file calls
      },
      {
        type: "text",
        text: `Project standards:\n${standards}`,
        cache_control: { type: "ephemeral" }       // cached per repo session
      }
    ],
    messages: [{ role: "user", content: buildPrompt(chunk, language) }]
  });

  // Stream-parse JSON array as tokens arrive
  let buffer = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta") {
      buffer += event.delta.text;
      const parsed = tryParsePartialSuggestions(buffer);
      parsed.forEach(onSuggestion);               // emit each suggestion as it lands
    }
  }
  return parseFinalSuggestions(buffer);
}
```

**Prompt structure sent per file chunk:**

```
System: You are a senior software engineer performing a code review.
        Project standards: {project_standards}
        Language: {language}

User: Review the following diff for:
  1. Correctness & logic errors
  2. Security vulnerabilities (OWASP Top 10)
  3. Performance issues
  4. Maintainability & readability
  5. Missing tests or edge cases
  6. Adherence to project coding standards

Return a JSON array of suggestions:
{
  "line": <line_number>,
  "severity": "critical|major|minor|suggestion",
  "category": "security|performance|quality|style|test",
  "title": "<short title>",
  "explanation": "<why this is an issue>",
  "suggestion": "<concrete improved code or approach>"
}

DIFF: {diff_chunk}
CONTEXT: {surrounding_code}
```

**Prompt caching strategy:**
- System prompt + project standards cached (TTL: 5 min)
- Each file chunk is a fresh user turn
- Cache hit rate target: >75% on active repos
- Saves ~80% tokens on repeated calls to the same repo

---

## 8. State Management (Zustand)

```ts
// store/mrStore.ts
interface MRStore {
  mrs: MRSummary[];
  activeMRIid: number | null;
  loading: boolean;
  fetchMRs: () => Promise<void>;
  setActiveMR: (iid: number) => void;
}

// store/reviewStore.ts
interface ReviewStore {
  reviewId: string | null;
  status: "idle" | "running" | "complete" | "error";
  suggestions: Suggestion[];         // grows incrementally as stream arrives
  riskScore: number;
  summary: ReviewSummary | null;
  startReview: (mrIid: number) => void;
  submitFeedback: (id: string, action: FeedbackAction) => void;
}

// store/settingsStore.ts
interface SettingsStore {
  gitlabUrl: string;
  model: string;
  minSeverity: Severity;
  rules: RuleConfig;
  // persisted via storage IPC on every change
}
```

---

## 9. Key React Components

### `DiffViewer.tsx`
- Renders `DiffFile[]` as collapsible `<FileSection>` blocks
- After each `diff-line.add` in the hunk, inserts matching `<AIAnnotation>` from `reviewStore.suggestions` filtered by `(filePath, lineNumber)`
- Uses `react-window` for virtualised rendering on large diffs (>2,000 lines)

### `AIAnnotation.tsx`
- Variant prop: `"bug" | "security" | "suggestion" | "warning"`
- Shows type badge, explanation text, and optional code block
- Accept / Dismiss buttons call `reviewStore.submitFeedback()`

### `AIPanel.tsx`
- `RiskMeter` animated bar uses `framer-motion` spring on mount
- `IssueList` rows are click-navigable — clicking an issue scrolls `DiffViewer` to that line
- "Generate full review report" button calls `startReview()` which streams suggestions live into the diff

### `MRList.tsx`
- Virtualised with `react-window` for repos with hundreds of open MRs
- Each row shows: MR ID, title, source branch, and severity badge if a review exists
- Active item highlighted with blue accent border

### `TitleBar.tsx`
- Reads `window.api.platform` (exposed via preload) and renders the correct layout:
  - **macOS** — frameless window; traffic-light dots left-aligned; full-width drag region
  - **Windows** — custom caption bar; Minimize / Maximize / Close buttons right-aligned; Snap Layout support via `WM_NCHITTEST` pass-through
  - **Linux** — minimal titlebar with right-aligned controls; `GTK_DECORATION_LAYOUT` env var honoured when running under GNOME/KDE
- Drag region always covers the full bar (`-webkit-app-region: drag`) with pointer-events exceptions on interactive controls
- Window control actions (`close`, `minimize`, `maximize`, `unmaximize`) sent to main process via IPC

---

## 10. OAuth Flow (GitLab)

```
Renderer: window.api.auth.login(gitlabUrl)
  │
Main: opens hidden BrowserWindow to:
      {gitlabUrl}/oauth/authorize?client_id=...&redirect_uri=codesense://oauth
  │
User authenticates in native GitLab window
  │
GitLab redirects to codesense://oauth?code=...
  │
Main: protocol handler catches redirect
      → exchanges code for access + refresh tokens
      → stores in OS keychain via keytar
      → closes auth window, resolves IPC promise
  │
Renderer: connection badge turns green
```

**Token refresh strategy:**
- Access token expiry checked before every GitLab API call
- Refresh token used automatically in `GitLabService` interceptor
- On refresh failure → emit `auth:expired` event → renderer shows re-login prompt

---

## 11. Local Storage Schema (`schema.sql`)

```sql
CREATE TABLE connections (
  id           TEXT PRIMARY KEY,
  url          TEXT NOT NULL,
  user         TEXT,
  connected_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- One record per MR review run
CREATE TABLE reviews (
  id           TEXT PRIMARY KEY,
  mr_iid       INTEGER,
  repo_path    TEXT,
  status       TEXT,             -- pending | running | completed | failed
  risk_score   REAL,
  summary_json TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Individual AI suggestions
CREATE TABLE suggestions (
  id          TEXT PRIMARY KEY,
  review_id   TEXT REFERENCES reviews(id),
  file_path   TEXT,
  line_number INTEGER,
  severity    TEXT,              -- critical | major | minor | suggestion
  category    TEXT,              -- security | performance | quality | style | test
  title       TEXT,
  explanation TEXT,
  suggestion  TEXT,
  confidence  REAL,
  source      TEXT,              -- llm | static | hybrid
  feedback    TEXT               -- accepted | dismissed | NULL
);

-- Developer feedback for ranker improvement
CREATE TABLE suggestion_feedback (
  id            TEXT PRIMARY KEY,
  suggestion_id TEXT REFERENCES suggestions(id),
  action        TEXT,            -- accept | dismiss | modify
  comment       TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 12. Build & Packaging

```yaml
# electron-builder.yml
appId: io.codesense.app
productName: CodeSense
directories:
  output: dist-electron

# ── macOS ──────────────────────────────────────────────────
mac:
  target:
    - target: dmg
      arch: [x64, arm64]        # Intel + Apple Silicon universal
    - target: zip
      arch: [x64, arm64]
  category: public.app-category.developer-tools
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  notarize: true                # requires APPLE_ID + APPLE_TEAM_ID env vars in CI

dmg:
  background: assets/dmg-background.png
  icon: assets/icons/icon.icns
  window: { width: 540, height: 380 }

# ── Windows ────────────────────────────────────────────────
win:
  target:
    - target: nsis
      arch: [x64, ia32, arm64]
  icon: assets/icons/icon.ico
  certificateSubjectName: ""   # set in CI via WIN_CSC_LINK / WIN_CSC_KEY_PASSWORD
  signingHashAlgorithms: [sha256]
  publisherName: CodeSense

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  installerIcon: assets/icons/icon.ico
  createDesktopShortcut: true
  createStartMenuShortcut: true
  runAfterFinish: true

# ── Linux ──────────────────────────────────────────────────
linux:
  target:
    - target: deb
      arch: [x64, arm64]
    - target: rpm
      arch: [x64, arm64]
    - target: AppImage
      arch: [x64, arm64]
  icon: assets/icons/
  category: Development
  desktop:
    Name: CodeSense
    Comment: AI-Powered GitLab Code Review
    StartupWMClass: codesense

# ── Auto-update (electron-updater) ─────────────────────────
publish:
  provider: github
  owner: your-org
  repo: codesense
```

```ts
// vite.config.ts — electron-vite split build
export default defineConfig({
  main:     { build: { outDir: "dist/main"     } },  // electron/
  preload:  { build: { outDir: "dist/preload"  } },  // preload.ts
  renderer: { build: { outDir: "dist/renderer" } },  // src/
})
```

**Scripts (`package.json`):**

```json
{
  "scripts": {
    "dev":            "electron-vite dev",
    "build":          "electron-vite build && electron-builder",
    "build:mac":      "electron-vite build && electron-builder --mac",
    "build:win":      "electron-vite build && electron-builder --win",
    "build:linux":    "electron-vite build && electron-builder --linux",
    "preview":        "electron-vite preview",
    "lint":           "eslint src electron shared",
    "typecheck":      "tsc --noEmit"
  }
}
```

**CI/CD — GitHub Actions matrix build:**

```yaml
# .github/workflows/release.yml
jobs:
  build:
    strategy:
      matrix:
        include:
          - os: macos-14        # Apple Silicon runner — builds x64 + arm64
            platform: mac
          - os: windows-latest
            platform: win
          - os: ubuntu-22.04
            platform: linux
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run build:${{ matrix.platform }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
      - uses: actions/upload-artifact@v4
        with:
          name: codesense-${{ matrix.platform }}
          path: dist-electron/
```

---

## 13. Technology Stack Summary

| Layer | Choice | Reason |
|---|---|---|
| Layer | Choice | Reason |
|---|---|---|
| Desktop shell | Electron 33 | Cross-platform native shell; handles protocol, keychain, tray on all OSes |
| Renderer framework | React 19 + TypeScript | Component model matches the panel/diff UI |
| Build toolchain | electron-vite + Vite 6 | Fast HMR for renderer, proper main/preload split |
| Styling | CSS Modules + CSS vars | Dark theme tokens; `platform.css` layer handles OS-specific overrides |
| State | Zustand | Minimal boilerplate; slices map 1:1 to UI panels |
| Data fetching | SWR | Cache + revalidate for MR list; streaming handled manually |
| Animations | Framer Motion | Risk meter spring, annotation slide-in |
| Virtualisation | react-window | Large diffs without DOM thrashing |
| GitLab client | axios (main process only) | Never in renderer — keeps tokens off window |
| AI client | @anthropic-ai/sdk (main process) | Prompt caching, streaming, API key in keychain |
| Local DB | better-sqlite3 | Synchronous, fast, no separate process; `app.getPath('userData')` locates DB cross-platform |
| Secrets | keytar | macOS Keychain · Windows Credential Manager (DPAPI) · Linux libsecret/KWallet |
| Auto-update | electron-updater | Squirrel.Mac (macOS) · NSIS delta (Windows) · AppImage (Linux) |
| Packaging | electron-builder | dmg (mac) · NSIS exe (win) · deb / rpm / AppImage (linux); GitHub Releases provider |
| CI/CD | GitHub Actions matrix | Separate runner per platform; notarisation on mac, code-signing on win |

---

## 14. Security Boundaries

- **API keys and OAuth tokens** — stored exclusively in OS keychain via `keytar`; never written to SQLite, localStorage, or env vars
- **All network calls** — happen in the main process only; renderer cannot make HTTP calls directly
- **contextBridge** — preload exposes only typed, whitelisted methods; `nodeIntegration: false`, `contextIsolation: true` enforced on every BrowserWindow
- **Webhook signature** — HMAC-SHA256 verification before any payload is parsed
- **PII scrubbing** — `ContextEnricher` strips patterns matching tokens/keys/passwords before sending to Claude API
- **Diffs encrypted at rest** — AES-256 for raw diff blobs stored to disk; in-transit via TLS 1.3
- **No diff data logged** — Anthropic SDK calls made with logging disabled by default
- **Self-hosted LLM option** — `AnthropicService` base URL configurable for Ollama/vLLM in air-gapped environments

---

## 15. Cross-Platform Considerations

### Window Chrome

| Concern | macOS | Windows | Linux |
|---|---|---|---|
| Frame style | Frameless (`frame: false`); custom traffic-light dots via CSS | Frameless with custom caption; pass `WM_NCHITTEST` for resize/snap | Frameless; minimal controls, right-aligned |
| Window controls position | Left | Right | Right (configurable via `GTK_DECORATION_LAYOUT`) |
| Snap / tile support | macOS Stage Manager via native | Windows Snap Layout — resize hit-areas exposed in `main.ts` `WM_NCHITTEST` handler | None required |
| Vibrancy / blur | `vibrancy: 'under-window'` on BrowserWindow | `backgroundMaterial: 'mica'` (Win 11 only, graceful fallback) | Solid background |

```ts
// electron/main.ts — window creation adapts per platform
const win = new BrowserWindow({
  frame: false,
  titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
  trafficLightPosition: { x: 16, y: 12 },   // macOS only, ignored elsewhere
  vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
  backgroundMaterial: process.platform === 'win32' ? 'mica' : undefined,
  webPreferences: { preload, contextIsolation: true, nodeIntegration: false }
});
```

---

### Keychain / Secret Storage

`keytar` wraps the native keychain on every platform — no code-path differences in `keychain.ts`:

| OS | Backend | Where secrets live |
|---|---|---|
| macOS | Security framework | macOS Keychain (`login.keychain`) |
| Windows | Credential Manager | Windows Credential Manager (DPAPI-encrypted) |
| Linux | libsecret | GNOME Keyring · KWallet · or encrypted file fallback |

If `libsecret` is unavailable on a headless Linux build machine, `keytar` falls back to an AES-256 encrypted file in `app.getPath('userData')` with the machine ID as the key.

---

### File System Paths

All paths use `app.getPath()` so they resolve correctly on every OS:

```ts
// electron/utils/paths.ts
import { app } from 'electron';
import path from 'path';

export const paths = {
  userData:  app.getPath('userData'),          // ~/Library/… | %APPDATA%\… | ~/.config/…
  logs:      app.getPath('logs'),              // ~/Library/Logs/… | %APPDATA%\…\logs | ~/.config/…
  downloads: app.getPath('downloads'),
  db:        path.join(app.getPath('userData'), 'codesense.db'),
  diffCache: path.join(app.getPath('userData'), 'diff-cache'),
};
```

---

### System Font Stack

```css
/* styles/tokens.css */
--font-sans:
  -apple-system,            /* macOS / iOS SF Pro */
  "Segoe UI Variable",      /* Windows 11 */
  "Segoe UI",               /* Windows 10 */
  "Ubuntu", "Cantarell",    /* Ubuntu / GNOME */
  sans-serif;

--font-mono:
  "SF Mono",                /* macOS */
  "Cascadia Code",          /* Windows Terminal default */
  "JetBrains Mono",         /* popular on Linux */
  "Fira Code",
  monospace;
```

---

### Native Menus

```ts
// electron/main.ts
import { Menu } from 'electron';

// macOS: app menu in the menu bar (standard About / Preferences / Quit)
// Windows / Linux: no native menu bar — hamburger menu rendered in React TitleBar
if (process.platform === 'darwin') {
  Menu.setApplicationMenu(buildMacMenu());
} else {
  Menu.setApplicationMenu(null);   // React renders its own menu button
}
```

---

### System Tray

All three platforms get a tray icon with a context menu:

```ts
// electron/platform/tray.ts (factory)
import { Tray, Menu, nativeImage } from 'electron';
import { paths } from '../utils/paths';

export function createTray(): Tray {
  const icon = nativeImage.createFromPath(
    path.join(paths.assets, `tray${process.platform === 'darwin' ? 'Template' : ''}.png`)
  );
  const tray = new Tray(icon);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open CodeSense', click: () => win.show() },
    { label: 'Check for Updates', click: checkForUpdates },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' }
  ]));
  return tray;
}
```

`trayTemplate.png` (macOS) is a 16×16 monochrome PNG that automatically inverts for dark/light menu bar. Windows and Linux use a full-colour 32×32 PNG.

---

### Auto-Update

`electron-updater` handles the full update lifecycle per platform:

```ts
// electron/main.ts
import { autoUpdater } from 'electron-updater';

autoUpdater.checkForUpdatesAndNotify();

autoUpdater.on('update-downloaded', () => {
  // On macOS: Squirrel.Mac relaunches automatically
  // On Windows: NSIS delta patch applied on next launch
  // On Linux: new AppImage downloaded; user prompted to relaunch
  dialog.showMessageBox({ message: 'Update ready. Restart to apply.' });
});
```

---

### Linux-Specific Notes

- **AppImage** — self-contained, no install required; auto-update works via zsync delta
- **Wayland** — set `ELECTRON_OZONE_PLATFORM_HINT=auto` (already set in `.desktop` file) for native Wayland rendering; XWayland fallback always available
- **`libsecret` dependency** — listed in `deb` / `rpm` package dependencies so it is installed automatically
- **Font rendering** — `font-feature-settings: "kern" 1, "liga" 1` applied globally; relies on fontconfig, which is standard on all major distros

---

## 16. Suggestion Severity Reference

| Severity | Description | Example |
|---|---|---|
| **Critical** | Must fix before merge; security or data-loss risk | SQL injection, hardcoded secret, null deref crash |
| **Major** | Significant quality or correctness concern | Off-by-one in loop, missing error handling, N+1 query |
| **Minor** | Correctness preserved but code is fragile | Magic number, overly complex condition, missing type hint |
| **Suggestion** | Style, readability, best practice | Variable naming, extract method, add docstring |

---

## 17. Phased Rollout Plan

| Phase | Scope | Duration |
|---|---|---|
| **Phase 1 — MVP** | GitLab only, Python + JS/TS, inline comments, 5 suggestion types | 6 weeks |
| **Phase 2 — Expand** | All languages, feedback loop, dashboard tab, settings UI | 8 weeks |
| **Phase 3 — Intelligence** | Ranker tuning from feedback, custom rules, Slack notifications | 6 weeks |
| **Phase 4 — Enterprise** | Self-hosted LLM option, SSO/SAML, audit logs, GitHub/Bitbucket | 8 weeks |

---

*Based on design document v1.0 (2026-05-11) and cross-platform desktop mockup. Updated 2026-05-13 to cover macOS, Windows, and Linux targets.*
