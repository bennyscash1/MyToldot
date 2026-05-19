# Toldotay — Project Context

## What it is
Toldotay (תולדותיי) is a Hebrew-first, bilingual (HE/EN, RTL) multi-tenant family-tree SaaS. Each tree is one family (tenant) with persons, relationships, and an About page.

**Live at:** toldotay.vercel.app (own domain coming: toldotay.com)
**Repo package name:** still "shorted" (legacy from "ShorTree" identity — CSS classes like `shortree-edge-spouse` remain).

## Tech stack
- **Framework:** Next.js 15.3 App Router, React 19, TypeScript 5
- **DB:** PostgreSQL via Prisma 6.19 (Supabase-hosted)
- **Auth:** Supabase Auth (email/password + Google OAuth)
- **Storage:** Supabase Storage (profile pictures, about-images gallery)
- **Graph:** @xyflow/react 12.10 + elkjs 0.11 (main-thread layout)
- **AI:** Gemini 2.5 Pro with google_search grounding (Hebrew biographies)
- **i18n:** next-intl 4.9 (he default RTL / en)
- **Hebrew dates:** @hebcal/core 6.3
- **Validation:** Zod 4
- **Styling:** Tailwind 3.4, cream bg (#f4f3e9), emerald-600 primary

## Schema (5 tables)
1. **trees** — tenant. Has slug, shortCode (5-digit URL identity), is_public, strict_lineage_enforcement, allow_branching, about_text, about_images.
2. **users** — mirrors Supabase auth.users. Has authProvider, preferred_language.
3. **tree_members** — User × Tree. Roles: VIEWER | EDITOR_PENDING | EDITOR | OWNER.
4. **persons** — bilingual identity (first/last name HE+EN), gender, birth_date, death_date, bio, profile_image.
5. **relationships** — SPOUSE | PARENT_CHILD | SIBLING | ENGAGED | DIVORCED | ADOPTED_PARENT.

## Core architecture
- **Mutation pipeline:** Route handler → Server action → service → requireTreeRole → branching/lineage check → Prisma transaction → revalidatePath
- **Graph engine:** Bipartite-with-Union model — marriage is a node, not an edge. ELK partitioning + custom Y projection + frozen focal ref.
- **Optimistic UX:** `useTreeMutations` hook holds temp IDs, swaps on server success. No state management library.
- **RBAC:** Per-tree only, no global admin. EDITOR_PENDING = pending VIEWER awaiting approval.
- **Branching control** (allow_branching flag): blocks adding parents to in-laws; protects tree shape.

## Routes
- `/[locale]/tree/[shortCode]` — main canvas (edit mode)
- `/[locale]/tree/[shortCode]/manage` — OWNER member admin
- `/[locale]/tree/[shortCode]/about` — per-tree About
- `/api/v1/` — REST (auth, trees, persons, uploads) with uniform `{ data, error }` envelope

## Product direction (recent pivot)
Originally positioned as "Living Family Encyclopedia" for rabbinical lineages. **Pivoting to "family memory gift product":**
- **Target customer:** Adults 35-50 buying as a gift for elderly parents/grandparents
- **Use case:** Buyer sets up the tree, extended family adds photos, grandparent enjoys it on a TV/tablet in the living room
- **Not competing with MyHeritage** (genealogy research) — competing with Frameo, Storyworth, photo albums
- **Pricing direction:** ₪199-699 one-time gift packages, not subscriptions

## Three planned routes (architecture)
1. `/tree/[shortCode]` (exists) — Owner/Editor canvas
2. `/view/[shortCode]` (planned) — Family dashboard: today's birthdays, activity feed, tree preview, "living family" carousel, recent AI bios
3. `/display/[shortCode]` (planned) — Fullscreen slideshow for TV/tablet in the living room (Wake Lock API, auto-rotation between tree/photos/bios/events)

## Features in development pipeline (in order)
1. **Life Status toggle** (`is_deceased` boolean) — replace always-visible death_date with clean Living/Deceased toggle. Default Living.
2. **Hebrew date auto-translation** — user enters Gregorian, server translates to Hebrew via @hebcal/core, displays both.
3. **Per-person photo gallery** — main photo + additional photos that rotate in View/Display modes.
4. **/view dashboard route**
5. **/display TV mode route**
6. **Activity log table** for the feed
7. **QR code gift PDF** for sharing with grandparents

## Important invariants & gotchas
- Spouse edges enforce opposite binary gender (throws on UNKNOWN/OTHER).
- addParent caps biological parents at 2 (PARENT_CHILD); ADOPTED_PARENT uncapped.
- Symmetric relationships (SPOUSE/SIBLING/ENGAGED/DIVORCED) normalized by sorted IDs.
- ELK runs on main thread (regression from earlier worker-based — may jank on >200 nodes).
- Frozen focal: focal person captured once via ref; clicking another person opens panel but doesn't re-run BFS.
- Internal HTTP fetch from RSC `tree/[shortCode]/page.tsx` → `/data` route (preserves envelope contract but adds round-trip).
- No tests in repo currently — graph algorithm complexity warrants unit tests on `buildBipartiteGraph`.

## Style/UX conventions
- Cream background `bg-[#f4f3e9]`, emerald-600 primary, white cards with subtle shadows.
- Hebrew is default locale, full RTL. Person cards display Hebrew names primarily.
- Forms in sidebars (right side in RTL); quick-add via popovers for speed.
- Minimal data entry philosophy: ask for as little as possible upfront, allow rich editing later.
