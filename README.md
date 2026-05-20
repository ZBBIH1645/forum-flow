# ForumFlow

A Next.js 15 placement workbench for assigning members to forums. Built as a
local demo for iterating on the placement workflow before wiring up a real
backend.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript, Tailwind CSS
- localStorage-only persistence (no database, no API)

## Status: demo only — not production-ready

This repository is a **UX prototype**. Read this section before deploying it
anywhere reachable from the public internet.

- **No authentication.** Every route — including the admin pages under
  `app/(admin)/` — renders for any visitor. The repo is public, so the URLs
  are discoverable.
- **No authorization.** There are no roles, sessions, or audit logs.
- **No backend.** All member data lives in `localStorage` in the browser. The
  `lib/supabase-ready.ts` file is scaffolding for a future migration, not a
  working integration.
- **No PII in seed data.** Mock members in `lib/mock-data.ts` are synthetic.
  Do not import real member data into the demo and then host it publicly.

If you want to deploy this for real use, you must at minimum:

1. Add authentication (e.g. Next.js middleware that verifies a session and
   redirects unauthenticated requests away from `app/(admin)/`).
2. Move persistence off `localStorage` to a real database with row-level
   access control.
3. Replace the JSON backup import path in `components/admin-tools-page.tsx`
   with a properly validated, authenticated endpoint.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx tsc --noEmit` — TypeScript

## License

No license has been added. All rights reserved by the author.
