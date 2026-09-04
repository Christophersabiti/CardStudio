# CLAUDE.md — Card Studio

Context for Claude Code working in this repository. Read this first.

## What this is

A white-label digital business card builder. Users fill in a card, see a live
preview, and save it to Supabase to get a public page at `/c/<slug>` whose QR
code is a vCard 3.0 that saves the contact to a phone. Next.js App Router +
TypeScript + Tailwind + Supabase, deployed on Vercel.

## First run

```bash
npm install
cp .env.local.example .env.local   # then fill in Supabase values
npm run dev
```

Then run `supabase/migrations/0001_init.sql` in the Supabase SQL editor.

Before committing changes, run:

```bash
npm run typecheck   # tsc --noEmit
npm run build       # next build — the real check
```

Note: this project was scaffolded and handed off before a full local
`npm install`/build was run in the authoring environment, so the first build is
the definitive validation. If the build surfaces a minor type or import issue,
fix it in place — the architecture below is the intended design.

## Architecture and conventions

- **No auth in the MVP (by design).** All Supabase access is server-side using
  the **service-role key** (`lib/supabase/server.ts`), through `lib/cards.ts`,
  the API route, and server components. The service-role client must never be
  imported into a client component — `lib/supabase/server.ts` and `lib/cards.ts`
  start with `import "server-only"` to enforce this at build time.
- **Row Level Security is ON with no anon policies.** The browser cannot read or
  write the `cards` table directly; the server (service role) bypasses RLS. This
  is intentional and is the clean base for adding auth.
- **`CardData`** (`lib/types.ts`) is the single source of truth for a card's
  shape and is stored as JSONB in `cards.data`. Keep the type, the builder form,
  the vCard builder, and the migration in sync when you change fields.
- **`CardPreview.tsx` is presentational and shared** by the builder (client,
  QR computed in the browser) and the public page (server, QR computed in Node).
  It takes a ready `qrUrl` string so it works in both environments — do not add
  hooks or data fetching to it.
- **Brand is white-label** (`lib/brand.ts`). Colors flow into Tailwind through
  CSS variables set on `<body>` in `app/layout.tsx`. Switch brand via
  `NEXT_PUBLIC_BRAND` (`neutral` | `pmi` | `sabtech`). Add presets there.
- **vCard is 3.0** (`lib/vcard.ts`) for best iOS/Android save compatibility;
  lines are CRLF-joined. Socials are emitted as `URL:` lines.
- **Profile photos are stored inline** as compressed data URLs inside the card
  JSON for the MVP (resized to ~420px client-side). The API route caps the whole
  card at ~400 KB. See the storage step below to move photos out.

## Roadmap (intended next steps, in order)

1. **Authentication (Supabase Auth).** Add email magic link and/or Google. Use
   `@supabase/ssr` (already a dependency) with middleware for session cookies.
   `lib/supabase/client.ts` already has the anon browser client stub.
2. **Per-user cards.** Add `owner_id uuid references auth.users` to `cards`, plus
   RLS policies: owners can select/insert/update/delete their own rows, and a
   public read policy for published cards (e.g. a `published boolean`). Once RLS
   allows scoped access, move reads to the anon client and retire the service-role
   path for user actions. Add a `/dashboard` to list and manage a user's cards.
3. **Profile photos in Supabase Storage.** Create a public `avatars` bucket,
   upload on the client, store the public URL in `CardData.photo`, and raise the
   API size cap. This shrinks rows and lets the QR/card load images by URL.
4. **Editing.** Add `PATCH /api/cards/[slug]` (owner-gated) and an edit route
   that reuses `Studio`/`BuilderForm`.
5. **Abuse controls for public save.** Add rate limiting and simple validation
   to `POST /api/cards` (e.g. IP-based limit, link/spam checks) since it is
   currently open.
6. **Analytics.** `cards.view_count` is already incremented on each public view
   via the `increment_card_views` RPC; surface it in the dashboard.

## Gotchas

- Params are synchronous (Next 14). If you upgrade to Next 15, `params` becomes a
  Promise and these pages/handlers must `await` it.
- `qrcode` runs in both Node and the browser; keep `lib/qr.ts` environment-neutral.
- Downloads in `CardActions.tsx` use blob + anchor, which works in a normal
  browser (this is a real Next app, not a sandboxed artifact).
