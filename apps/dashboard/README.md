# PkgDiet Dashboard

> **Auth mode: DEMO** — This dashboard is currently running in Demo Mode. No real GitHub OAuth credentials are required.

## Running the Dashboard

```bash
cd apps/dashboard
npm install
npm run dev        # starts on http://localhost:3001
```

## Pages

| Route | Description |
|---|---|
| `/` | List of all tracked organizations |
| `/org/[orgId]` | Org detail: repos, latest verdicts, org-level policy JSON |
| `/repo/[repoId]` | Repo detail: FinOps metrics, per-PR check runs with dependency breakdown |

## Auth Modes

### Demo Mode (default)

`AUTH_MODE=demo` in `.env.local` auto-authenticates as `demo@pkgdiet.local`. Use this to test the UI without GitHub credentials.

### GitHub OAuth (production)

1. Create a GitHub OAuth App at https://github.com/settings/apps.
2. Set callback URL to `http://localhost:3001/api/auth/callback/github`.
3. Update `.env.local`:
   ```env
   AUTH_MODE=github
   GITHUB_CLIENT_ID=<your-client-id>
   GITHUB_CLIENT_SECRET=<your-client-secret>
   NEXTAUTH_SECRET=<random-string>
   NEXTAUTH_URL=http://localhost:3001
   ```
4. Install `next-auth` and `@auth/prisma-adapter` and uncomment the real auth logic in `src/lib/auth.ts`.

## Database

The dashboard shares the same SQLite database as `apps/github-app`. It is configured via `DATABASE_URL` in `.env.local`:

```env
DATABASE_URL="file:../github-app/prisma/dev.db"
```

To migrate to Postgres later, update the `datasource` block in `apps/github-app/prisma/schema.prisma` and set the new connection string.

## FinOps Metrics

The repo page calculates FinOps metrics from `CheckRun.detailsJson` over a configurable rolling window (default: 7 days):

- **Blocked:** Dependencies blocked by policy
- **Warned:** Dependencies flagged with warnings  
- **Est. CI cost saved:** Approximated from `costEstimate.monthlyCiCost100Builds` in the evaluation payload

