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
