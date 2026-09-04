# Card Studio

A white-label **digital business card builder** with **vCard QR codes**. Anyone
can build a card in the browser, save it, and get a permanent public link whose
QR code saves the contact straight to a phone. Built with **Next.js (App Router),
TypeScript, Tailwind CSS, and Supabase**, and ready to deploy on **Vercel**.

## Features

- Card builder with live preview (name, designation, organization, profile photo, multiple phones, emails, websites, eight social platforms, and personal details).
- vCard 3.0 QR code, the format iPhone and Android cameras most reliably save.
- Save a card to Supabase and get a public page at `/c/<slug>` with its own QR.
- White-label brand system (neutral default, plus PMI Uganda and Sabtech presets).
- No login for the MVP. All Supabase access is server-side via the service-role key, so auth can be added later without restructuring.

## Tech stack

| Layer     | Choice                                  |
| --------- | --------------------------------------- |
| Framework | Next.js 14 (App Router)                 |
| Language  | TypeScript                              |
| Styling   | Tailwind CSS + CSS variables            |
| Data      | Supabase (Postgres)                     |
| QR        | `qrcode`                                |
| Hosting   | Vercel                                  |

## Getting started (local)

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project** at https://supabase.com, then run the schema.
   Open the Supabase SQL editor and paste the contents of
   `supabase/migrations/0001_init.sql`, or use the Supabase CLI:

   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```

3. **Set environment variables.** Copy the example and fill it in:

   ```bash
   cp .env.local.example .env.local
   ```

   From Supabase → Project Settings → API, copy:
   - `NEXT_PUBLIC_SUPABASE_URL` — the project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon public key (kept for future auth)
   - `SUPABASE_SERVICE_ROLE_KEY` — the service_role key (**server only, keep secret**)

   Also set `NEXT_PUBLIC_SITE_URL` (http://localhost:3000 for dev) and
   `NEXT_PUBLIC_BRAND` (`neutral`, `pmi`, or `sabtech`).

4. **Run it**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000, build a card, and click **Save & get shareable link**.

## Deploy to Vercel

1. Push this repo to GitHub (see below).
2. In Vercel, **New Project → Import** the GitHub repo. Vercel auto-detects Next.js.
3. Add the same environment variables under **Project Settings → Environment Variables**
   (set `NEXT_PUBLIC_SITE_URL` to your Vercel URL).
4. Deploy. Every push to `main` redeploys automatically.

## Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Card Studio"
git branch -M main
git remote add origin https://github.com/<you>/card-studio.git
git push -u origin main
```

`.env.local` and `node_modules` are git-ignored, so no secrets are committed.

## Project structure

```
app/
  layout.tsx            Root layout, fonts, brand CSS variables
  page.tsx              The card builder (home)
  c/[slug]/page.tsx     Public card page (server-rendered, with QR)
  api/cards/route.ts    POST: create a card, returns a slug
components/
  Studio.tsx            Builder shell (client): state, preview, save
  BuilderForm.tsx       All the input fields
  CardPreview.tsx       The card itself (shared by builder + public page)
  CardActions.tsx       Add-to-contacts / Save QR / Copy / Print
  Header.tsx            Brand header
  icons.tsx             Inline SVG icons
lib/
  brand.ts              White-label brand presets
  types.ts              CardData and CardRecord types
  vcard.ts              vCard 3.0 builder
  qr.ts                 QR data-URL generator
  slug.ts               Short unique slugs
  socials.ts            Social platform config
  cards.ts              Supabase card create/read (server)
  supabase/server.ts    Service-role client (server only)
  supabase/client.ts    Anon browser client (for future auth)
supabase/
  migrations/0001_init.sql
```

## Roadmap / next steps

See `CLAUDE.md` for the intended direction, including authentication, per-user
card management, and moving profile photos to Supabase Storage.
