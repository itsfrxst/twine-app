# Twine

Twin threads of time, intertwined. A checklist, calendar, and timeline built
around two opposing forces:

- **Kronos** — the enemy clock. Scheduled tasks that strike back with a
  score penalty when their deadline lapses.
- **Kairos** — the reward current. Tasks completed on your own initiative,
  earning points (with bonus "marks" for extra-meaningful ones).

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploying to GitHub Pages

A workflow at `.github/workflows/deploy.yml` builds and deploys automatically
on every push to `main`. To turn it on (one-time setup):

1. On GitHub, go to the repo's **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the **Actions** tab).

Once deployed, the app is available at `https://<owner>.github.io/twine-app/`.
Open that URL on your phone to use Twine there — add it to your home
screen for an app-like feel.

## Installing as an app (PWA)

Twine is an installable Progressive Web App. Once it's deployed:

- **Desktop (Chrome/Edge)**: open the URL, click the install icon in the
  address bar (or menu → "Install Twine…"). It opens as its own resizable
  window, no browser chrome, pinnable to your taskbar/dock — a lightweight
  "widget" you can keep open alongside everything else.
- **iPhone (Safari)**: Share → "Add to Home Screen".
- **Android (Chrome)**: menu → "Install app".

## Cross-device sync (optional)

By default every device keeps its own local data (no sync) — the app works
fully offline with zero setup. To make tasks, categories, and theme sync
automatically across every device you sign into:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase SQL editor, run `supabase/schema.sql` from this repo.
   That creates a `twine_backups` table (one row per user) with row-level
   security so each user can only read/write their own data, plus
   Realtime enabled so changes push to other open devices instantly.
3. In your Supabase project, go to **Settings → API** and copy the
   **Project URL** and **anon public key**.
4. For local development, copy `.env.example` to `.env.local` and fill
   in those two values.
5. For the deployed site, add them as GitHub repo secrets: **Settings →
   Secrets and variables → Actions → New repository secret**, named
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Re-run the deploy
   workflow (or push a commit) to pick them up.

Once those two values are set, the app shows a sign-in screen (email
magic link — no password to manage) before loading, and a small cloud
icon in the header shows sync status. Leaving them unset skips all of
this entirely and the app behaves exactly as it does today.
