# CodeSense — Comprehensive Technical Documentation

**Version**: 0.1.0  
**Purpose**: AI-powered GitLab merge request code review desktop application  
**Supported Platforms**: macOS (12+), Windows (10/11), Linux (Ubuntu 20.04+, Fedora 38+, Arch)

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Application Capabilities](#2-application-capabilities)
3. [GitLab API Integration](#3-gitlab-api-integration)
4. [AI Provider Integration](#4-ai-provider-integration)
5. [Supported AI Models](#5-supported-ai-models)
6. [System Architecture](#6-system-architecture)
7. [Core Components & Services](#7-core-components--services)
8. [Data Flow & Review Pipeline](#8-data-flow--review-pipeline)
9. [Security & Privacy](#9-security--privacy)
10. [Code Review Categories](#10-code-review-categories)
11. [Installation & Deployment](#11-installation--deployment)
12. [Key Dependencies](#12-key-dependencies)

---

## 1. Technology Stack

### Frontend
- **Framework**: React 18.3.1
  - Component-based UI with hooks
  - Markdown rendering with `react-markdown`
  - Git-flavored markdown (GFM) support via `remark-gfm`
- **State Management**: Zustand 4.5.4
  - Lightweight, immutable state stores
  - Used for: MR state, review results, settings, UI state
- **Build Tool**: Vite 5.3.1
  - Lightning-fast HMR (hot module replacement)
  - Optimized production builds
  - React plugin via `@vitejs/plugin-react`
- **Styling**: CSS (custom, not a framework)
  - Per-component `.css` files
  - Platform-specific adaptations (macOS, Windows, Linux)
- **Data Fetching**: SWR 2.2.5
  - Client-side data fetching and caching
  - Request deduplication, auto-revalidation

### Backend (Main Process)
- **Runtime**: Node.js 20+ (via Electron)
  - Full OS access for keychain, file system, network
  - TypeScript support via Vite build step
- **HTTP Client**: Native `fetch` API
  - No external HTTP library (using modern Node.js `fetch`)
  - Used for GitLab API calls and AI provider requests
- **Database**: SQLite 3 (via `better-sqlite3` 11.0.0)
  - Synchronous, embedded database
  - Used for local caching and settings
  - Compiled native module (requires `electron-rebuild` on install)
- **Credential Storage**: 
  - **macOS**: Keychain (via `keytar` 7.9.0)
  - **Windows**: Windows Credential Manager
  - **Linux**: libsecret / GNOME Keyring / KWallet
  - Package: `keytar` 7.9.0 (native module)

### Desktop Framework
- **Framework**: Electron 30.5.1
  - Multi-process architecture (Main + Renderer)
  - Cross-platform native UI
  - IPC (inter-process communication) for security boundaries
- **Build System**: Electron Vite 2.3.0
  - Specialized Vite configuration for Electron
  - Separate build pipelines for main, preload, renderer
- **Packaging**: Electron Builder 24.13.3
  - Creates platform-specific installers
  - macOS: `.dmg` (Disk Image)
  - Windows: `.exe` (NSIS installer)
  - Linux: `.deb`, `.rpm`, `.AppImage`

### Image Processing
- **Library**: Sharp 0.35.0
  - High-performance image resizing, format conversion
  - Used for icon generation and assets (dev only)

### Development Tools
- **Language**: TypeScript 5.4.5
  - Type safety across frontend, main, and preload
  - Strict mode enabled
- **Linting**: ESLint 9.5.0
  - Code quality and consistency
- **Build Verification**: TypeScript `--noEmit`
  - Type checking without emitting JS

### Build & Runtime Configuration
- **Main tsconfig**: Targets ES2020, CommonJS modules
- **Web tsconfig**: Targets ES2020, ESM modules, DOM lib
- **Node tsconfig**: Targets ES2020, CommonJS, Node lib

---

## 2. Application Capabilities

### Core Features
1. **GitLab MR Browsing**
   - Connect to GitLab.com or self-hosted GitLab instances
   - List open merge requests with pagination (25 per page)
   - Display MR metadata: title, author, branches, file count, timestamps
   - View full MR descriptions rendered as markdown
   - Access MR link in GitLab for context

2. **AI-Powered Code Review**
   - Fetch and parse complete MR diffs
   - Send diffs to selected AI model (Anthropic, OpenAI, xAI, or Google)
   - Live streaming of findings (Anthropic/Claude only)
   - Parse and categorize AI responses into structured findings
   - Fallback salvage mode for truncated/malformed responses

3. **Finding Management**
   - Group findings by file, severity, and category
   - Pin findings inline with diff hunks
   - Display out-of-context findings in separate sections
   - Calculate risk score (0–100) based on severity distribution
   - Sort by severity: critical → error → warning → info

4. **Diff Visualization**
   - Collapsible diff sections per file
   - Line-number tracking across diffs
   - Support for file operations: renamed, new, deleted
   - Inline annotations with finding details

5. **Report Generation**
   - **PDF Export**: A4-sized print-ready document
     - MR metadata table
     - Findings summary with statistics
     - Per-file findings with full diffs
     - Raw AI response (unparsed)
   - **Markdown Export**: Markdown with collapsible diffs
     - Suitable for pasting into GitLab wikis, issues
     - Includes all metadata and findings

6. **Settings & Configuration**
   - Switch AI providers without restarting
   - Change AI models per review
   - Update GitLab connection (URL, token)
   - Toggle appearance (System/Light/Dark)
   - Clear all credentials from keychain
   - Live validation of all credentials

7. **Security & Privacy**
   - Secrets scrubbing (redacts tokens, keys, passwords before sending to AI)
   - OS keychain storage (not in files, not in database)
   - Sandboxed renderer process (no direct network access)
   - Preload script enforcing security boundary
   - Context isolation in Electron window

---

## 3. GitLab API Integration

### Base URL
- Default: `https://gitlab.com/api/v4`
- Configurable: Custom self-hosted GitLab instances supported
- Format: `https://<your-gitlab-instance>/api/v4`

### Authentication
- **Header**: `PRIVATE-TOKEN: <personal-access-token>`
- **Scope Required**: `read_api` (minimum for MR/diff access)
- **Token Creation**: GitLab Settings → Access Tokens

### Endpoints Used

#### 1. List Merge Requests
```
GET /projects/{id}/merge_requests?state=opened&per_page=25&page={page}
```
- **Parameters**:
  - `{id}`: URL-encoded project path (e.g., `group%2Fsubgroup%2Fproject`) or numeric project ID
  - `state`: Always `"opened"` (only open MRs)
  - `per_page`: 25 (pagination)
  - `page`: 1-indexed page number
- **Response Fields Parsed**:
  - `id`: Merge request internal ID
  - `iid`: Internal issue ID (MR number in UI)
  - `title`: MR title
  - `description`: MR description
  - `author.username`: MR author
  - `source_branch`: Source branch name
  - `target_branch`: Target branch name
  - `web_url`: Link to GitLab MR page
  - `created_at`: ISO 8601 timestamp
  - `updated_at`: ISO 8601 timestamp
  - `changes_count`: Number of changed files

#### 2. Get MR Diff
```
GET /projects/{id}/merge_requests/{iid}/changes
```
- **Parameters**:
  - `{id}`: URL-encoded project path or numeric ID
  - `{iid}`: MR internal issue ID (not global ID)
- **Response Fields Parsed**:
  - `changes[]`:
    - `old_path`: Previous file path
    - `new_path`: Current file path
    - `diff`: Unified diff text with @@ hunks
    - `new_file`: Boolean, true if file is newly created
    - `deleted_file`: Boolean, true if file is deleted
    - `renamed_file`: Boolean, true if file is renamed
- **Error Handling**:
  - 404: Project not found (or user not a member)
  - 401: Invalid/expired token
  - 403: Token user lacks access
  - Other 4xx/5xx: Passed to user as error message

### Project Identification
- **By Path**: `group/subgroup/project` (case-sensitive, must match exactly)
- **By ID**: Numeric project ID from GitLab UI
- **URL Encoding**: Paths with `/` are percent-encoded as `%2F` (e.g., `group%2Fproject`)

---

## 4. AI Provider Integration

### Architecture
- **AnthropicService**: Dedicated streaming client for Claude
- **OpenAICompatService**: Generic OpenAI-compatible client for OpenAI, xAI, Gemini
- Both implement same interface: `review(diff, onSuggestion) → {suggestions, raw}`

### Provider Details

#### Anthropic (Claude)
- **Base URL**: Official Anthropic API
- **Authentication**: `apiKey` parameter in constructor
- **Features**:
  - Streaming response with `stream: true`
  - Prompt caching (ephemeral cache_control)
  - Max tokens: 30,000
- **Models**: See [Section 5](#5-supported-ai-models)
- **API Reference**: `@anthropic-ai/sdk` v0.30.0
- **Key Advantage**: Only provider with real-time streaming of findings

#### OpenAI (ChatGPT)
- **Base URL**: `https://api.openai.com/v1`
- **Authentication**: `Authorization: Bearer <api-key>`
- **Features**:
  - HTTP request/response (non-streaming)
  - JSON response format
  - Max tokens: 16,384 (GPT-4o hard limit)
- **Models**: See [Section 5](#5-supported-ai-models)

#### xAI (Grok)
- **Base URL**: `https://api.x.ai/v1`
- **Authentication**: `Authorization: Bearer <api-key>`
- **Features**:
  - Compatible with OpenAI API schema
  - HTTP request/response (non-streaming)
  - Max tokens: 30,000
- **Models**: See [Section 5](#5-supported-ai-models)

#### Google (Gemini)
- **Base URL**: `https://generativelanguage.googleapis.com/v1beta/openai`
- **Authentication**: `Authorization: Bearer <api-key>`
- **Features**:
  - Compatible with OpenAI API schema
  - Free tier available (Gemini 2.5 Flash)
  - Max tokens: 30,000
- **Models**: See [Section 5](#5-supported-ai-models)

### Request Format (All Providers)

**System Prompt**: Comprehensive code review instructions (see [Section 10](#10-code-review-categories))
- Instructs AI to check 6 categories of issues
- Specifies JSON array output format
- Severity levels: `critical`, `error`, `warning`, `info`

**User Message**: `Review this diff:\n\n{diff_text}`

**Response Parsing**:
1. Try full JSON parse
2. If fails, salvage complete JSON objects from partial/truncated response
3. Validate each object has required fields: `filePath`, `line`, `severity`, `title`, `body`
4. Filter duplicates based on `filePath:line:title` key
5. Sort by severity score

### Secrets Scrubbing
Before sending diff to AI:
- Pattern: `/(?:token|key|password|secret|credential)\s*[:=]\s*\S+/gi`
- Replaces matching lines with `[REDACTED]`
- Prevents accidental credential leakage to AI providers

---

## 5. Supported AI Models

### Anthropic Models (Primary Provider)

| Model ID | Name | Description | Speed | Quality | Cost |
|---|---|---|---|---|---|
| `claude-fable-5` | Fable 5 | Most capable — deepest reasoning, highest cost | Slow | Highest | $$$$ |
| `claude-opus-4-8` | Opus 4.8 | Very capable — thorough reviews of complex changes | Slow | Very High | $$$ |
| `claude-sonnet-4-6` | Sonnet 4.6 | **Recommended** — fast, accurate, cost-efficient | Fast | High | $$ |
| `claude-haiku-4-5-20251001` | Haiku 4.5 | Cheapest Claude — quick checks, ~⅓ cost of Sonnet | Very Fast | Good | $ |

**Default**: `claude-sonnet-4-6`  
**Streaming**: ✅ All models support real-time streaming  
**Output Tokens**: Up to 30,000

### OpenAI Models

| Model ID | Name | Description | Speed | Quality | Cost |
|---|---|---|---|---|---|
| `gpt-4o` | GPT-4o | OpenAI flagship — strong general code review | Fast | High | $$ |
| `gpt-4o-mini` | GPT-4o mini | Cheap and fast — lighter reviews | Very Fast | Good | $ |

**Streaming**: ❌ Non-streaming (full response at once)  
**Output Tokens**: Up to 16,384

### xAI Models

| Model ID | Name | Description | Speed | Quality | Cost |
|---|---|---|---|---|---|
| `grok-3` | Grok 3 | xAI flagship model | Fast | High | $$ |
| `grok-3-mini` | Grok 3 mini | Smaller, cheaper Grok | Very Fast | Good | $ |

**Streaming**: ❌ Non-streaming  
**Output Tokens**: Up to 30,000

### Google Models

| Model ID | Name | Description | Speed | Quality | Cost | Free Tier |
|---|---|---|---|---|---|---|
| `gemini-2.5-pro` | Gemini 2.5 Pro | Google flagship — strong reasoning, large context | Fast | High | $$ | ❌ |
| `gemini-2.5-flash` | Gemini 2.5 Flash | Fast and cheap — generous free tier | Very Fast | Good | $ | ✅ |

**Streaming**: ❌ Non-streaming  
**Output Tokens**: Up to 30,000  
**Recommended for Budget**: Gemini 2.5 Flash (free daily quota, no credit card required)

### Cost Guide (Approximate, per medium MR)
- **Claude Sonnet 4.6**: $0.05–0.10
- **Claude Haiku 4.5**: ~⅓ of Sonnet (~$0.02–0.03)
- **GPT-4o mini**: ~$0.01–0.03
- **Gemini 2.5 Flash**: **FREE** (within daily quota)

---

## 6. System Architecture

### Multi-Process Model

```
┌─────────────────────────────────────┐
│     Main Process (Node.js)          │
│  • Electron app lifecycle           │
│  • IPC handlers & routing           │
│  • GitLab API calls                 │
│  • AI provider requests             │
│  • Credential storage (keytar)      │
│  • SQLite database                  │
│  • File system, OS APIs             │
└────────┬────────────────────────────┘
         │
         │ IPC: ipcMain.handle / ipcRenderer.invoke
         │
┌────────▼────────────────────────────┐
│  Preload Script (Privileged Bridge) │
│  • contextBridge.exposeInMainWorld  │
│  • Limited API exposure             │
│  • Security boundary enforcement    │
└────────┬────────────────────────────┘
         │
         │ ipcRenderer.invoke
         │
┌────────▼────────────────────────────┐
│   Renderer Process (React)           │
│  • React UI & components            │
│  • Zustand state management         │
│  • User interactions                │
│  • No direct OS access (sandboxed)  │
└─────────────────────────────────────┘
```

### Security Boundaries
- **Renderer is Sandboxed**: Cannot access Node.js, file system, or network directly
- **Preload Script**: Controlled exposure layer
  - Only specified methods are available to renderer
  - No `nodeIntegration: true`
  - `contextIsolation: true` enabled
- **Main Process**: Full OS access, guarded by IPC validation

### IPC Channels (Main → Renderer)
- `review:progress` — Updates during review (analysis status, findings count)
- `review:error` — Error messages

### IPC Handlers (Renderer → Main, Async)
- `auth:test-gitlab` — Validate GitLab URL & token
- `auth:test-provider` — Validate AI provider API key
- `gitlab:list-mrs` — Fetch MRs for a project
- `review:start` — Initiate AI review of an MR
- `report:generate-pdf` — Export review to PDF
- `report:generate-markdown` — Export review to Markdown
- `storage:get` / `storage:set` — Keychain operations

---

## 7. Core Components & Services

### Backend Services (Main Process)

#### GitLabService
**File**: `electron/services/GitLabService.ts`
- **Responsibility**: All GitLab API communication
- **Methods**:
  - `constructor(token, baseUrl)` — Initialize with credentials
  - `listMRs(projectId, page)` → `Promise<MRSummary[]>` — Fetch open MRs
  - `getMRDiff(projectId, mrIid)` → `Promise<FileDiff[]>` — Fetch diffs
- **Error Handling**: Throws on HTTP errors, includes status code and response text
- **URL Encoding**: Handles project paths with `/` → `%2F` conversion

#### AnthropicService
**File**: `electron/services/AnthropicService.ts`
- **Responsibility**: Claude API streaming & response parsing
- **Methods**:
  - `constructor(apiKey, model)` — Initialize Claude client
  - `review(diff, onSuggestion)` → `Promise<{suggestions, raw}>` — Stream review findings
- **Features**:
  - Real-time streaming with `stream: true`
  - Prompt caching (ephemeral) for cost savings
  - Partial JSON parsing (extracts complete objects mid-stream)
  - Max output: 30,000 tokens

#### OpenAICompatService
**File**: `electron/services/OpenAICompatService.ts`
- **Responsibility**: OpenAI-compatible API (OpenAI, xAI, Gemini)
- **Methods**:
  - `constructor(provider, apiKey, model)` — Select provider + credentials
  - `review(diff, onSuggestion)` → `Promise<{suggestions, raw}>` — Send review request
- **Features**:
  - Single fetch-based implementation for 3 providers
  - JSON parsing with salvage mode for truncated responses
  - Provider-specific max tokens and base URLs
  - Non-streaming (full response at end)

#### ContextEnricher
**File**: `electron/services/ContextEnricher.ts`
- **Responsibility**: Scrub secrets from diffs before sending to AI
- **Methods**:
  - `enrich(rawDiff)` → `Promise<string>` — Redact credentials
- **Pattern**: `/(?:token|key|password|secret|credential)\s*[:=]\s*\S+/gi`
- **Replaces**: Matching lines with `[REDACTED]`

#### StaticAnalyzer
**File**: `electron/services/StaticAnalyzer.ts`
- **Responsibility**: Placeholder for ESLint/Semgrep integration
- **Current State**: Returns empty array (not yet implemented)
- **Future**: Will run linters in child processes

#### SuggestionRanker
**File**: `electron/services/SuggestionRanker.ts`
- **Responsibility**: Score, deduplicate, and sort findings
- **Methods**:
  - `rank(suggestions)` → `Suggestion[]` — Assign scores, remove duplicates, sort by severity
  - `riskScore(suggestions)` → `number` — Calculate 0–100 risk score (average severity)
- **Severity Scores**: critical=100, error=75, warning=40, info=10
- **Deduplication**: By `filePath:line:title` key

#### Review Pipeline (review.ipc.ts)
**File**: `electron/ipc/review.ipc.ts`
- **Flow**:
  1. Fetch MR diff from GitLab
  2. Enrich (scrub secrets)
  3. Run static analyzer (currently no-op)
  4. Send to selected AI provider (Claude, GPT, Grok, Gemini)
  5. Parse findings, emit via IPC
  6. Rank findings by severity
  7. Calculate risk score
  8. Return complete review results

### Frontend Components (React)

#### State Management (Zustand Stores)
- `mrStore` — Current MR, list of MRs, pagination
- `reviewStore` — Review results, findings, status
- `settingsStore` — GitLab URL, token, AI provider, model, appearance

#### Key Components
- `MRList` / `MRListItem` — List and select merge requests
- `ReviewPanel` — Main review view with findings
- `FindingsList` — Grouped findings by file/severity
- `DiffViewer` — Collapsible diff display with annotations
- `SettingsScreen` — Configure credentials and preferences
- `OnboardingScreen` — First-time setup flow
- `AIAnnotation` — Inline finding display

---

## 8. Data Flow & Review Pipeline

### Step-by-Step Flow

```
1. User Action
   └─> Input project ID + press "→"
       └─> IPC: gitlab:list-mrs(projectId, page=1)

2. GitLab Data Fetch
   └─> GitLabService.listMRs()
       └─> GET /projects/{id}/merge_requests?state=opened&per_page=25&page=1
           └─> Parse response, emit MRSummary[]
               └─> Render MRList in UI

3. User Clicks MR
   └─> UI fetches diff
       └─> IPC: review:start(projectId, mrIid)

4. Main Process Review Handler
   └─> GitLabService.getMRDiff(projectId, mrIid)
       └─> GET /projects/{id}/merge_requests/{iid}/changes
           └─> Parse changes into FileDiff[]

5. Context Enrichment
   └─> ContextEnricher.enrich(combinedDiff)
       └─> Replace /(?:token|key|password|secret)[:=]\S+/gi with [REDACTED]

6. Static Analysis (Placeholder)
   └─> StaticAnalyzer.analyze(enrichedDiff)
       └─> Currently: return [] (no-op)

7. AI Review
   └─> buildReviewer() → select AnthropicService or OpenAICompatService
       └─> Retrieve API key from keytar (macOS Keychain / Windows Credential Manager)
           └─> Call provider: review(enrichedDiff, onSuggestion callback)
               ├─> Anthropic: Stream findings in real-time
               │   └─> Parse partial JSON, emit on complete objects
               └─> OpenAI/xAI/Gemini: Fetch full response
                   └─> Parse JSON, salvage mode if truncated

8. Finding Parsing & Callback
   └─> On each complete finding: onSuggestion(suggestion)
       └─> IPC: review:progress { type: 'finding', data: suggestion }
           └─> UI receives and displays in real-time

9. Ranking & Deduplication
   └─> SuggestionRanker.rank(suggestions)
       └─> Remove duplicates by filePath:line:title
           └─> Assign severity scores (critical/error/warning/info)
               └─> Sort by score (highest first)

10. Risk Score Calculation
    └─> SuggestionRanker.riskScore(rankedSuggestions)
        └─> Average severity across all findings
            └─> Clamp to 0–100

11. Results Display
    └─> IPC: review:complete { findings, riskScore, raw }
        └─> UI renders:
            ├─> Risk score badge (green/amber/red)
            ├─> All Findings panel (grouped by file)
            └─> Inline diff annotations

12. Export (On User Action)
    └─> PDF Export: reportToHtml() → wkhtmltopdf-like renderer
        └─> PDF with full MR metadata, findings, diffs
    └─> Markdown Export: Same data as markdown with collapsible sections
```

### Data Structures

#### MRSummary
```typescript
{
  id: number
  iid: number
  title: string
  description: string
  author: string
  sourceBranch: string
  targetBranch: string
  webUrl: string
  createdAt: string  // ISO 8601
  updatedAt: string  // ISO 8601
  changedFiles: number
}
```

#### FileDiff
```typescript
{
  oldPath: string
  newPath: string
  diff: string  // Unified diff text
  isNew: boolean
  isDeleted: boolean
  isRenamed: boolean
}
```

#### Suggestion
```typescript
{
  id: string  // UUID
  filePath: string
  line: number
  endLine?: number
  severity: 'info' | 'warning' | 'error' | 'critical'
  title: string
  body: string
  source: 'ai' | 'static'
  score: number  // 10, 40, 75, 100
}
```

---

## 9. Security & Privacy

### Credential Storage
- **Storage Method**:
  - macOS: Keychain (Security framework via `keytar`)
  - Windows: Credential Manager (DPAPI via `keytar`)
  - Linux: libsecret / GNOME Keyring / KWallet
- **Never Stored**:
  - Not in SQLite database
  - Not in config files
  - Not in memory (retrieved on-demand)
- **Service Key**: `codesense`
- **Account Keys**:
  - `gitlab-token` → GitLab personal access token
  - `anthropic` → Anthropic API key
  - `openai` → OpenAI API key
  - `xai` → xAI API key
  - `gemini` → Google API key

### Diff Scrubbing
- **Pattern**: `/(?:token|key|password|secret|credential)\s*[:=]\s*\S+/gi`
- **Applied**: Before sending to any AI provider
- **Effect**: Lines like `API_KEY=xyz123` become `[REDACTED]`

### Network Security
- **All External Calls**: From main process only
  - Renderer is sandboxed, cannot make direct HTTP calls
  - All requests go through IPC-guarded handlers
- **Encryption in Transit**:
  - GitLab API: HTTPS required
  - AI Providers: HTTPS required
  - Custom self-hosted GitLab: TLS support

### Process Isolation (Electron)
- **Renderer**: 
  - `nodeIntegration: false` (no Node.js access)
  - `contextIsolation: true` (separate JS contexts)
  - `sandbox: true` (additional OS-level sandboxing)
- **Preload Script**:
  - Only specified APIs exposed via `contextBridge`
  - No direct access to file system or network

### Code Review Response Privacy
- **On Device**: All findings generated locally (streamed or fetched)
- **Not Persisted**: Review results not automatically saved (user explicitly exports)
- **Export**: User controls format (PDF, Markdown) and destination

---

## 10. Code Review Categories

The AI model is instructed to examine **6 categories** per file:

### 1. Memory & Resource Leaks
- Unreleased listeners, observers, timers, intervals, subscriptions
- Retain cycles / strong reference cycles (closures capturing self)
- Unclosed files, sockets, database handles, streams
- Unbounded caches or collections

**Severity**: error → critical  
**Impact**: Crashes, performance degradation, memory exhaustion

### 2. Crash & Failure Risks
- Null/nil/undefined dereferences
- Array index out of bounds, off-by-one errors
- Unhandled exceptions, rejected promises
- Race conditions, deadlocks, threading violations
- Integer overflow, division by zero, NaN propagation

**Severity**: error → critical  
**Impact**: Runtime crashes, undefined behavior

### 3. Security
- Injection attacks (SQL, command, XSS)
- Unsanitized input handling
- Hardcoded secrets, credentials in code
- Missing authentication/authorization checks
- Path traversal, unsafe deserialization
- Weak cryptography

**Severity**: critical  
**Impact**: Data breach, unauthorized access, system compromise

### 4. Code Design & Architecture
- Single-responsibility violations
- God functions/classes (too much responsibility)
- Code duplication (DRY violation)
- Tight coupling, missing abstractions
- Inconsistent naming conventions
- Dead code
- Magic numbers without explanation
- API misuse or deprecated API usage

**Severity**: warning  
**Impact**: Maintenance burden, harder to evolve code

### 5. Performance
- O(n²) or worse algorithms on hot paths
- Repeated work inside loops
- Blocking I/O on main/UI threads
- Missing pagination/batching for large datasets
- N+1 query patterns

**Severity**: warning → error  
**Impact**: Slow user experience, high resource usage

### 6. Correctness & Edge Cases
- Logic fails on empty input, edge values, large values
- Unicode handling bugs
- Broken invariants
- Missing input validation at trust boundaries
- Incorrect state transitions

**Severity**: warning → error  
**Impact**: Unexpected behavior, data integrity issues

### Severity Levels

| Level | Color | Meaning |
|---|---|---|
| 🟥 `critical` | Red | Crash, security breach, or data loss in production |
| 🟧 `error` | Orange | Real bug or resource leak |
| 🟨 `warning` | Yellow | Risky pattern or design flaw |
| 🟦 `info` | Blue | Style or minor improvement |

**Risk Score Formula**:
```
riskScore = min(100, round(average(severity_scores)))
where critical=100, error=75, warning=40, info=10
```

---

## 11. Installation & Deployment

### Development Setup
1. Install Node.js 20+ (required for Electron 30)
2. Install dependencies:
   ```bash
   npm install
   ```
3. Rebuild native modules for Electron:
   ```bash
   npx electron-rebuild
   ```
4. Start dev server:
   ```bash
   npm run dev
   ```
   - Renderer: http://localhost:5173
   - Dev tools auto-open
   - HMR enabled for React

### Build & Release
```bash
# Build all platforms
npm run build

# macOS only
npm run build:mac

# Windows only
npm run build:win

# Linux only
npm run build:linux
```

### Output Artifacts
- **macOS**: `dist-electron/CodeSense-0.1.0-arm64.dmg` (drag-and-drop installer)
- **Windows**: `dist-electron/CodeSense-0.1.0.exe` (NSIS installer)
- **Linux**: 
  - `CodeSense-0.1.0.deb` (Debian/Ubuntu)
  - `CodeSense-0.1.0.rpm` (Red Hat/Fedora)
  - `CodeSense-0.1.0.AppImage` (universal, no install)

### Cross-Platform Configuration (electron-builder.yml)
```yaml
appId: com.codesense.app
productName: CodeSense

# Build outputs
directories:
  output: dist-electron
  buildResources: resources

# Include built artifacts
files:
  - dist/main/**      # Vite-built main process
  - dist/preload/**   # Vite-built preload script
  - dist/renderer/**  # Vite-built React app

# Platform-specific targets
mac:
  target: dmg
  arch: arm64
windows:
  target: nsis
linux:
  target: [deb, rpm, AppImage]
```

---

## 12. Key Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@anthropic-ai/sdk` | ^0.30.0 | Official Anthropic/Claude API client with streaming |
| `better-sqlite3` | ^11.0.0 | Synchronous SQLite3 bindings (native module) |
| `keytar` | ^7.9.0 | OS credential storage (Keychain, Credential Mgr, libsecret) |
| `react-markdown` | ^10.1.0 | Markdown to React components |
| `remark-gfm` | ^4.0.1 | GitHub-flavored Markdown support |
| `swr` | ^2.2.5 | Client-side data fetching & caching |
| `zustand` | ^4.5.4 | Lightweight state management |

### Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `electron` | ^30.5.1 | Electron runtime & SDK |
| `electron-vite` | ^2.3.0 | Optimized Vite config for Electron |
| `electron-builder` | ^24.13.3 | Cross-platform app packaging |
| `@electron/rebuild` | ^4.0.4 | Rebuild native modules for Electron |
| `vite` | ^5.3.1 | Frontend build tool (HMR, bundling) |
| `@vitejs/plugin-react` | ^4.3.1 | React support in Vite |
| `react` | ^18.3.1 | React library |
| `react-dom` | ^18.3.1 | React DOM rendering |
| `typescript` | ^5.4.5 | Type checking and compilation |
| `eslint` | ^9.5.0 | Code linting |
| `sharp` | ^0.35.0 | Image processing (for assets) |
| `@types/*` | various | TypeScript type definitions |

### Notable Absence
- **HTTP Client**: Uses native Node.js `fetch` (no `axios`, `node-fetch`, etc.)
- **UI Framework**: Plain CSS (no Tailwind, Material-UI, Ant Design)
- **ORM**: Direct SQLite queries via `better-sqlite3`
- **Static Analysis**: Placeholder (ESLint/Semgrep integration planned)

---

## Summary

**CodeSense** is a cross-platform desktop application that bridges GitLab and multiple AI providers to deliver real-time code review feedback. Its architecture emphasizes security (sandboxed renderer, OS keychain storage), flexibility (4 AI providers, 10 models), and user privacy (no cloud storage, secrets scrubbing). The codebase is built with modern tools (Electron 30, React 18, Vite, TypeScript) and is optimized for developer experience (HMR, type safety, clear IPC boundaries).

---

**Last Updated**: June 2026  
**Status**: v0.1.0 (Beta)
