# CodeSense User Guide

**CodeSense** is a desktop app for AI-powered code review of GitLab merge requests. It fetches MR diffs from any GitLab instance (gitlab.com or self-hosted), sends them to the AI model of your choice, and shows categorised findings inline with the code — all from your machine, with your own API keys.

---

## 1. First-time setup

Setup has two steps. Everything you enter is verified live before it's saved.

### Step 1 — Connect GitLab

| Field | What to enter |
|---|---|
| **GitLab URL** | `https://gitlab.com` or your self-hosted instance, e.g. `https://gitlab.mycompany.com` |
| **Personal Access Token** | Create one in GitLab → *Settings → Access Tokens* with the **`read_api`** scope |

Click **Test connection** — a green *Connected* dot confirms the URL and token work together.

### Step 2 — Connect an AI model

1. **Provider** — choose one of:
   - **Anthropic (Claude)** — recommended; the only provider with live streaming of findings
   - **OpenAI (ChatGPT)**
   - **xAI (Grok)**
   - **Google (Gemini)** — *Gemini 2.5 Flash has a free tier (no card required)*
2. **Model** — pick from the provider's models; descriptions explain the speed/quality/cost trade-off
3. **API key** — paste the key from the provider's console (the hint under the field tells you where)

Click **Verify & Finish**. Keys are stored in the **macOS Keychain** (or Windows Credential Manager / libsecret on Linux) — never in files or databases.

---

## 2. Reviewing a merge request

### Load your project
In the sidebar input, enter either:
- the **full project path** exactly as in the URL — e.g. `group/subgroup/project` (case-sensitive, no leading slash), or
- the **numeric project ID** from the project's home page

Press **→**. Open merge requests appear below, 25 per page, with title, `!iid`, author, age, and branches.

### Pick an MR
Click any MR. The right panel shows:
- **Header** — title, link to the MR in GitLab, author, branches
- **Overview** — created/updated dates, files changed, total +/− lines, and the MR description rendered as markdown (collapsible with *Hide overview*)
- **Diff** — every changed file as a collapsible section with real line numbers, +/− stats, and badges for new/deleted/renamed files

### Run the review
Click **Start AI Review**. You'll see live progress (*"Analyzing with \<model\>…"*). The AI checks six categories on every file:

1. **Memory & resource leaks** — unreleased listeners/timers, retain cycles, unclosed handles
2. **Crash & failure risks** — nil dereferences, races, unhandled errors, out-of-bounds
3. **Security** — injection, hardcoded secrets, missing auth, weak crypto
4. **Code design** — god functions, duplication, dead code, tight coupling
5. **Performance** — O(n²) hotspots, blocking I/O, N+1 queries
6. **Correctness & edge cases** — empty input, broken invariants, missing validation

### Read the results
- **Risk score** (0–100) appears in the toolbar — green &lt;40, amber 40–69, red ≥70
- **All Findings panel** — every finding grouped by file, sorted by severity; click a row to expand the full explanation and suggested fix
- **Inline annotations** — findings pinned directly under the diff line they refer to; findings whose line isn't visible in the diff appear in a *"Findings outside the visible diff context"* section per file
- **Show AI response** — the verbatim, unparsed model output (useful for auditing)

Severities: 🟥 `critical` (crash/security/data-loss) · 🟧 `error` (real bug) · 🟨 `warning` (risky pattern) · 🟦 `info` (minor).

---

## 3. Exporting reports

After a review completes:

- **⬇ Export PDF** — a print-styled A4 document with the MR details table, findings summary, every file's findings + full diff, and the raw AI response
- **.md** — the same content as Markdown, with collapsible diff blocks — ideal for pasting into GitLab wikis or issues

Both include everything: MR metadata, risk score, per-file findings with fixes, diffs, and the verbatim model response.

---

## 4. Settings

Open via the **⚙ Settings** button at the bottom of the sidebar.

| Section | Options |
|---|---|
| **GitLab** | Change instance URL or token; *Test connection* before saving (a failing config is never saved) |
| **AI Model** | Switch provider and model any time; keys are stored per-provider so you can hop between them freely; *Verify key* checks validity live |
| **Appearance** | **System** (default — follows your OS light/dark setting live), Light, or Dark |
| **Danger Zone** | *Clear all credentials* — removes every key from the keychain and returns to setup |

Model changes take effect on the **next** review — no restart needed.

---

## 5. Tips & troubleshooting

| Symptom | Likely cause & fix |
|---|---|
| *404 Project Not Found* | Wrong project path (must be the full namespace path, case-sensitive), or your token's user isn't a member of that private project. GitLab returns 404 — not 403 — for projects you can't see. Use the numeric project ID to rule out typos. |
| *Review failed: 401* | Invalid/expired AI API key — re-verify it in Settings |
| *credit balance too low* | Your Anthropic account has no API credits. Either top up at console.anthropic.com → Plans & Billing, or switch to **Gemini 2.5 Flash** (free tier) in Settings |
| Risk score 0/100 with findings expected | Open **Show AI response** to see what the model returned. If the response was cut off mid-JSON, complete findings are still salvaged automatically; the most severe ones are emitted first so they're never lost |
| Findings not pinned to diff lines | The model cited a line outside the diff hunks — look in the *"Findings outside the visible diff context"* section at the bottom of that file |
| Token works in browser but not here | The API doesn't follow GitLab's renamed-project redirects — use the current path |

### Cost guide (approximate, per medium MR)
- Claude Sonnet 4.6: $0.05–0.10 · Claude Haiku: ~⅓ of that
- GPT-4o mini: ~$0.01–0.03
- Gemini 2.5 Flash: **free** within daily quota

---

## 6. Privacy & security

- API keys and tokens live **only in your OS keychain**
- All network calls (GitLab + AI providers) happen in the app's main process; the UI has no network access
- Diffs are scrubbed of `token/key/password/secret`-pattern values before being sent to the AI
- Reports are generated locally; nothing is uploaded anywhere except the diff to your chosen AI provider
