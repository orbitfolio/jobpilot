# Career Ops by Vish

A browser job-search desk. Paste a posting, see a scored and explained fit against your CV, draft an ATS-friendly CV and cover letter whose claims trace back to your own lines, and track what you decided to do. You still submit the application. You still send the note.

This project was inspired by the MIT-licensed tool [career-ops](https://github.com/career-ops-hq/career-ops). It is an independent implementation. It is not affiliated with, endorsed by, or maintained by the career-ops project or its authors, and it does not use that project's name as a claim of endorsement.

The demo opens with a fictional candidate, Avery Chen, a senior product engineer in Toronto who is a permanent resident of Canada and would need sponsorship in the United States. No API key is required to walk the whole loop.

## What it will not do

- It does not submit applications.
- It does not send email. The optional digest posts JSON to a webhook you configure, and that switch is off.
- It does not invent a metric and then export it quietly. Unsupported CV and cover-letter claims are highlighted and blocked until you edit or explicitly approve them.

## Run it locally

```bash
npm install
npm test
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

`npm test` runs the scoring rubric and the claim-provenance checks. `npm run build` produces the production bundle.

## Use it

1. Open **Profile** and replace Avery's CV, salary floor, currency, and work-authorisation entries. Or leave the demo in place.
2. Open **Evaluate**, paste a URL or description, or load the strong and weak samples. **Check and score** reads a URL on the server when it can, scores the text, and saves a tracker row in the Saved column.
3. Open the report. Each dimension shows its 1–5 score, the share of the rubric you set, and the evidence. Each requirement shows its importance and whether that importance came from the posting's wording, its structure, or an estimate. Estimates are never top band.
4. Open **Review tailored CV**. Bullets cite master-CV lines. Change a bullet so it adds a number or a tool that is not in the source and the PDF and DOCX buttons stay disabled until you fix it or choose **Approve anyway**.
5. Move the card on **Tracker**. The board and the table share the same rows. Follow-up dates are reminders and drafts, not messages.
6. **Inbox** keeps saved searches. **Scan now** pulls public Greenhouse, Lever, Ashby, SmartRecruiters, and Workday JSON, and Job Bank Canada search results. Indeed Canada is saved as a search and asks you to paste the posting, because there is no public JSON API in this app.
7. **Settings** exports or imports one JSON snapshot. The file does not contain your model key. The key, if you add one, stays in `localStorage`.

The app is a progressive web app: `src/app/manifest.ts` plus `public/sw.js`. Add it to a phone home screen from a production build.

## Bring your own model

Settings supports three providers. With none selected, scoring, drafting, and tracking still work.

| Provider | Where the request goes | Key |
| --- | --- | --- |
| OpenAI-compatible | This server forwards one request to the base URL you enter, then forgets the key | Stored only in this browser |
| Gemini | This server calls `generativelanguage.googleapis.com` | Same |
| Ollama | The browser calls the URL directly, usually `http://127.0.0.1:11434` | None. Set `OLLAMA_ORIGINS` so the browser is allowed |

Salary comparisons across currencies use the static rates in `src/lib/currency.ts`. They are a fit check, not a live exchange rate and not a negotiation conversion.

## Sign in and sync

IndexedDB is still the working copy. With no Supabase env vars, the app never contacts an account server. With them set, Settings can send a magic link or start Google sign-in. After you open the link, this browser pushes changed records and pulls newer ones. Each record keeps a timestamp. The newer write wins. A delete is a tombstone, so it is not resurrected by an older copy. Untouched demo data is stamped at the epoch, so a real edit on your other device replaces it. AI keys stay in `localStorage` and are not in the synced records or the JSON export.

### Hosted Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/migrations/20261112120000_user_records.sql`. It creates `user_records`, turns on row-level security so a user can only read and write their own rows, and adds `upsert_records` for last-write-wins.
3. Authentication → URL configuration: set Site URL to the Vercel URL, and add `https://<your-app>.vercel.app/auth/callback` to the redirect allow list. For local dev, also allow `http://127.0.0.1:43123/auth/callback`.
4. Authentication → Providers: Email is on by default (magic link). For Google, create an OAuth client and set the Supabase callback `https://<project-ref>.supabase.co/auth/v1/callback`. The Google button in Settings uses that provider. It does nothing useful until the provider is enabled.
5. Add the env vars below on Vercel and in `.env.local`.

### Local emulator

Docker is not required for a smoke test. The emulator speaks the slice of the Supabase Auth and REST API this app uses, including row checks on the signed-in user. It does not send real email. Google returns a clear error until you point the app at a hosted project.

```bash
node scripts/sync-emulator.mjs --print-keys
node scripts/sync-emulator.mjs
```

Put the printed URL and keys in `.env.local`, then start `npm run dev`. Ask for a magic link, then read it from `http://127.0.0.1:54321/mailbox?email=you@example.com`.

## Deploy on Vercel

```bash
npm run build
```

Import the repo as a Next.js project. The included `vercel.json` schedules `GET /api/cron/scan` daily at 13:00 UTC.

The cron route reads each signed-in user's saved sources and searches from `user_records` and writes new matches into that user's inbox. It uses the service role key, which bypasses row-level security. `SCAN_SOURCES_JSON` is still scanned when it is set, and it is the only scan when Supabase is not configured. The optional digest remains a JSON webhook and stays off unless you set both digest variables.

The in-app daily scan is separate: if **Scan when I open the app** is on and the last scan is older than 20 hours, opening the app runs the saved searches on this device.

### Env vars

| Name | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server. Project URL, or `http://127.0.0.1:54321` for the emulator |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser. The anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Daily scan. Never expose it as `NEXT_PUBLIC_` |
| `CRON_SECRET` | Vercel sends `Authorization: Bearer <CRON_SECRET>`. Without it the route refuses |
| `SCAN_SOURCES_JSON` | Optional fallback boards when you also want a scan that is not tied to a user |
| `DIGEST_ENABLED` and `DIGEST_WEBHOOK_URL` | Optional. JSON webhook only. This app does not send email |

## Original compared with this version

| Limit in the CLI project | What this version does |
| --- | --- |
| Needs a terminal, Node, and an AI coding CLI | A Next.js app in the browser, installable as a PWA, with a layout that works on a phone |
| Needs a paid model subscription wired into that CLI | Optional key for any OpenAI-compatible endpoint, Gemini, or a local Ollama URL. The key stays in the browser. The desk still scores and tracks with no key |
| Portal list skewed to US and EU tech companies | You add companies and keyword searches. Canadian starters include Job Bank Canada, Cohere, and Wealthsimple, plus Greenhouse, Lever, Ashby, SmartRecruiters, and Workday by company. Indeed is paste-only |
| Scans are manual unless you set up cron | Saved searches, a scan when the app has been idle for 20 hours, a Scan now button, a new-matches inbox, and a Vercel cron route for server-configured boards. Digest webhook is off |
| Fixed 4.0 apply line and opaque weights | Seven weights you can see and edit: skills, seniority, location, salary, work authorisation, company preferences, dealbreakers. The report prints the formula, each requirement's score, and where that requirement's importance came from |
| Rewording is not fact-checked beyond numbers | Every tailored bullet and cover-letter claim cites source lines. Numbers and ungrounded words fail the check. Export of PDF and DOCX is blocked until you edit or approve |
| Tracker is markdown plus a terminal UI | Kanban and table, filters, notes, dates, follow-up reminders, a funnel, and rejection-pattern notes from the rows you closed |
| Data is local files and manual backup | IndexedDB, JSON export and import, and optional Supabase sign-in that syncs records between devices |
| Little support for CAD ranges and work authorisation | Salary floor in CAD or ten other currencies, ranges parsed from the posting, and a per-country authorisation profile (citizen, permanent resident, open permit, needs sponsorship) used in the score. A no-sponsorship posting is a hard gate when your profile needs sponsorship |

## Layout

- `src/lib/scoring.ts` and `src/lib/extract.ts` — the rubric
- `src/lib/sync-merge.ts` — last-write-wins merge and the daily-scan inbox rows
- `src/lib/provenance.ts` — claim checks
- `src/lib/tailor.ts` — rule-based drafts that have to pass those checks
- `src/lib/boards.ts` and `src/server/boards.ts` — public board fetchers
- `src/app/api/liveness` — server-side posting check
- `src/components/views` — the screens

## What is incomplete

- Google sign-in needs a hosted Supabase project and a Google OAuth client. The local emulator does not complete Google sign-in and does not send real email.
- The digest is a webhook, not email, and it never runs unless you turn it on.
- The digest is a webhook, not email, and it never runs unless you turn it on.
- Indeed is not scraped. Workday results depend on a public CXS host you supply, and many of those descriptions are short until you open the posting.
- Job Bank results from a scan are titles, locations, and salaries. Scoring the full description means opening the posting or pasting it.
- Contact notes are drafts from a name you type. The app does not look people up on LinkedIn.
- Model rewrites are best-effort JSON. The provenance check still runs on whatever comes back, and a bad reply leaves the previous draft in place.
- Static currency rates are approximate and labelled as such.
