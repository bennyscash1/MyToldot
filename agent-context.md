# AGENT-AI.md — Toldotay System Context

> Onboarding document for AI agents (and humans) working on this codebase.
> Reflects the system as of the most recent audit pass (May 2026).

---

## 1. What this product is

**Toldotay** (תולדותיי / "MyToldot") is a Hebrew-first, bilingual (HE/EN, full RTL) multi-tenant family-tree SaaS. Each "tree" is a tenant — a single family — with its own members, persons, relationships, and About page.

- **Live at:** `toldotay.vercel.app` (own domain coming: `toldotay.com`)
- **Original positioning:** "Living Family Encyclopedia" — more than names and dates; stores narratives, biographies, profile photos, gallery images, and uses Gemini (grounded with Google Search) to draft Hebrew biographies for rabbinical lineages and Jewish genealogy.
- **Current product pivot:** "family memory gift product."
  - **Target customer:** Adults 35–50 buying as a gift for elderly parents/grandparents.
  - **Use case:** Buyer sets up the tree; extended family adds photos; grandparent enjoys it on a TV/tablet in the living room.
  - **Competitive frame:** Not competing with MyHeritage (genealogy research) — competing with Frameo, Storyworth, photo albums.
  - **Pricing direction:** ₪199–699 one-time gift packages, not subscriptions.

**Legacy branding note:** `package.json` name is still `"shorted"` — a leftover from the project's earlier "ShorTree" identity. CSS classes like `shortree-edge-spouse` / `shortree-edge-divorced` / `shortree-edge-child` are also leftover. Cosmetic but worth knowing.

---

## 2. Tech stack (verified current)

| Layer        | Choice                                                                      |
| ------------ | --------------------------------------------------------------------------- |
| Framework    | Next.js 15.3 App Router, React 19, TypeScript 5, Turbopack dev              |
| DB           | PostgreSQL via Prisma 6.19 (Supabase-hosted)                                |
| Auth         | Supabase Auth (`@supabase/ssr`) — email/password + Google OAuth             |
| Storage      | Supabase Storage (profile pictures + tree about-images bucket)              |
| Graph        | `@xyflow/react` 12.10 + `elkjs` 0.11 (`elk.bundled.js`, **main-thread**)    |
| AI           | Gemini 2.5 Pro REST endpoint with `google_search` grounding tool            |
| i18n         | `next-intl` 4.9, locales `he` (default, RTL) / `en`                         |
| Hebrew dates | `@hebcal/core` 6.3                                                          |
| Validation   | Zod 4                                                                       |
| Styling      | Tailwind 3.4, cream bg `#f4f3e9`, emerald-600 primary                       |
| Image        | `sharp` + `browser-image-compression` for client-side avatar resize         |

**No Redux/Zustand/React Query.** State is RSC + a single client-state hook (`useTreeMutations`).

---

## 3. Database schema (`prisma/schema.prisma`)

5 tables, all PostgreSQL:

1. **`trees`** — tenant unit. Has `slug` (legacy 6-char) + `shortCode` (5-digit, the URL identity now). Flags: `is_public`, `strict_lineage_enforcement`, `allow_branching` (added 2026-05-10), `about_text`, `main_surnames String[]`, `about_images Json` (gallery). FK `root_person_id` (nullable, SetNull).
2. **`users`** — mirrors `auth.users.id`. Has `googleId`, `authProvider` (`"manual" | "google" | "both"`), `preferred_language` (`he`/`en`).
3. **`tree_members`** — User × Tree join. Roles: `VIEWER | EDITOR_PENDING | EDITOR | OWNER`. `linked_person_id` = per-user "this is me" focal override. Unique on `(tree_id, user_id)`.
4. **`persons`** — bilingual identity (`first_name`, `last_name`, `first_name_he`, `last_name_he`), `maiden_name`, `gender` enum, `birth_date`/`death_date`/`birth_place`, `bio`, `profile_image` (Supabase storage path, not URL).
5. **`relationships`** — `relationship_type` enum: `SPOUSE | PARENT_CHILD | SIBLING | ENGAGED | DIVORCED | ADOPTED_PARENT`. Convention: `PARENT_CHILD` `person1 = parent`, `person2 = child`. Cascade delete on both endpoints. Unique on `(tree_id, person1_id, person2_id, relationship_type)`.

Migration timeline: `tree_short_code_and_member_role` → `perms_v2_short_code_5` → `add_user_preferred_language` → `add_google_oauth_fields` → `add_tree_about_images` → `add_tree_allow_branching`.

---

## 4. Directory layout

```
src/
├── app/
│   ├── [locale]/                      # Pages (next-intl)
│   │   ├── page.tsx                   # Hero + signup CTA + JoinFamilySection
│   │   ├── login, signup              # Auth screens
│   │   ├── setup-root/                # Onboarding flow
│   │   ├── about/                     # Public About page
│   │   ├── tree/
│   │   │   ├── page.tsx               # 0/1/2+ family hub (auto-redirect on 1)
│   │   │   ├── setup/                 # First-tree creation
│   │   │   └── [shortCode]/
│   │   │       ├── page.tsx           # Main canvas
│   │   │       ├── about/             # Per-tree About
│   │   │       ├── manage/            # OWNER member admin + branching toggle
│   │   │       ├── data/route.ts      # GET tree payload
│   │   │       ├── add/, add-parent/, add-spouse/,
│   │   │       │   add-child/, add-sibling/,
│   │   │       │   remove-person/    # Mutation route handlers
│   │   │       └── layout.tsx
│   │   └── tree/{add,add-parent,…}    # Legacy non-shortCode mutation routes
│   ├── api/
│   │   ├── auth/callback/             # Google OAuth callback
│   │   └── v1/                        # REST: auth, trees, persons, uploads
│   └── layout.tsx
├── features/
│   ├── about/                         # About content + image gallery editor
│   ├── family-tree/                   # Graph algorithms + canvas
│   │   ├── lib/                       # buildBipartiteGraph, elkLayout, constants, types
│   │   ├── hooks/                     # useElkLayout, useTreeMutations
│   │   ├── components/                # FamilyTreeViewer, TreeCanvasWithModals
│   │   │   ├── nodes/                 # PersonCardNode, UnionNode
│   │   │   └── panels/                # PersonSidePanel, AddRelativePopover,
│   │   │                              #   TreeAboutModal, AiBioSearch
│   │   └── schemas/person.schema.ts
│   └── persons/                       # PersonForm, hebrewDate util
├── components/
│   ├── auth/GoogleSignInButton.tsx
│   ├── features/                      # auth/, persons/, tree/ feature UI
│   ├── layout/Navbar, NavbarActions, LanguageSwitcher
│   └── ui/                            # Button, Input, BlockedActionDialog
├── server/
│   ├── services/tree.service.ts       # All tree mutations (single source of truth)
│   ├── actions/                       # person, tree, family-management, relationship, user
│   ├── queries/tree.queries.ts
│   └── lib/gemini.ts                  # Gemini 2.5 Pro grounded-search wrapper
├── lib/
│   ├── api/                           # auth, response, errors, branching, lineage, action-result
│   ├── supabase/                      # client/server/admin/middleware/storage/public-url
│   ├── tree/                          # slug + about-images helpers
│   └── images/                        # default-person, profile-upload-constraints, server-resize
├── hooks/                             # useAuth, usePermissions, useRouteLocale
├── i18n/                              # routing, request
├── types/                             # Re-exports + LocalePageProps
├── messages/{en,he}.json              # i18n catalogs
└── middleware.ts                      # Supabase + locale + x-pathname injection
```

---

## 5. Core flows

### 5.1 Authentication & locale

`src/middleware.ts` chains 4 phases on every request:

1. **Supabase session refresh** via `updateSessionAndGetUser`.
2. **API route guard** — explicit allow-list `PUBLIC_API_ROUTES` (auth endpoints + GET-only public reads). Anything else without a session → 401 envelope. Writes are not in the allow-list, so they require auth + per-tree role check at the handler.
3. **Locale redirect** for signed-in users, sourced from `users.preferred_language` (with cookie mirror to avoid a DB call every request — Edge runtime can't run Prisma). Falls back to `GET /api/v1/auth/me` when the cookie is absent.
4. **`next-intl` rewrite** + injects `x-pathname` request header so server components like Navbar can show the current tree's name pill without any client JS.

### 5.2 RBAC (`src/lib/api/auth.ts`)

Per-tree roles only — **no global admin gate**. Ranking:

```
VIEWER = EDITOR_PENDING  <  EDITOR  <  OWNER
```

`EDITOR_PENDING` is intentionally same rank as `VIEWER`: a VIEWER who clicked "request edit access" but hasn't been approved.

- `getAuthUser` / `requireAuthUser` (uses `getUser()` not `getSession()` to validate JWT).
- `requireTreeRole(treeId, minRole)` — throws `Errors.forbidden` if not member or rank too low.
- `getCurrentUserTreeRole(treeId)` — returns role or `null` for UI gating.

### 5.3 Tree resolution

- URL segment is 5-digit `shortCode` (preferred) or legacy `slug`.
- `findTreeByRouteParam` (in `tree.service.ts`) tests `^\d{5}$` first, falls back to slug.
- `resolveTreePageData` returns the full canvas payload (persons, relationships, role, root, focal). The page hits this via an **internal HTTP fetch** to `/[locale]/tree/[shortCode]/data` so the same response envelope contract is honored.
- **Public-by-link:** any visitor with a valid tree URL can READ. Editing is gated at the mutation path.

### 5.4 Mutation pipeline (the layered guard)

Every write travels:

```
Route handler  →  Server action / service  →  requireTreeRole  →
  branching check  →  lineage check  →  Prisma transaction  →  revalidatePath
```

Key invariants in `tree.service.ts`:

- `assertPersonsInTree` defends against cross-tenant person IDs.
- `normalizeSymmetric` sorts ids for `SPOUSE`/`SIBLING`/`ENGAGED`/`DIVORCED` so `(A,B)` and `(B,A)` collapse to one row (DB unique constraint).
- `oppositeBinaryGender` enforces opposite-gender spouses (throws on `UNKNOWN`/`OTHER`).
- `addParent` blocks a 3rd biological parent (≤2 `PARENT_CHILD`; `ADOPTED_PARENT` not capped).
- `removePersonFromTree` requires OWNER, deletes the Supabase Storage avatar before cascading the row.
- `addSibling` reuses the existing sibling's parent edges; falls back to a loose `SIBLING` edge when no parents exist.

### 5.5 Branching control (`src/lib/api/branching.ts`)

Added 2026-05-10. When `tree.allow_branching = false`:

- **spouse/child** → always allowed.
- **parent** → allowed only on the root or on someone with at least one blood/adoptive edge. In-laws (only marriage edges) cannot have parents added — that would expand the tree sideways through a non-blood relative.
- **sibling** → only on the root.
- **standalone** → only when tree is empty.

Blocked path returns `BRANCHING_NOT_ALLOWED` with the owner's email so UI can show "ask the owner". Surface: `BlockedActionDialog`.

### 5.6 Strict lineage (`src/lib/api/lineage.ts`)

A separate, older feature. When `tree.strict_lineage_enforcement = true`:

- Marriage edges always allowed.
- Blood/adoptive edges blocked when target is "in-law-only" (marriage edges only, no blood links).
- Comment says "Phase 5" full enforcement at the relationship level; current usage is in `PersonForm` warnings.

### 5.7 Approval workflow

- VIEWER clicks "Request editor access" → `requestEditorAccess` flips role to `EDITOR_PENDING`.
- OWNER sees `PendingMembersPanel` → `manageAccessRequest(memberId, approve)` → role becomes `EDITOR` or back to `VIEWER`.
- Family Manage page (`manage/page.tsx`) — OWNER-only — also exposes member promote/demote/remove + password-reset email + the branching toggle.

### 5.8 Joining a family

- 5-digit `shortCode` entered in `JoinFamilySection` → `joinFamilyByCode(rawCode)` → upserts a VIEWER membership, idempotent.
- `ensureMirroredAuthUser(user)` defensively mirrors Supabase auth user into `users` table.

---

## 6. Graph engine — the most complex layer

### 6.1 Build pipeline (`buildBipartiteGraph.ts`)

Pure transform `(persons, relationships, focalId) → BipartiteGraph`. Four passes:

1. **Couple unions.** Every `SPOUSE`/`ENGAGED`/`DIVORCED` edge becomes a synthetic `Union` node (a tiny pill at the marriage midpoint). Couples are deduped by sorted parent pair; if the same couple has multiple status rows, the strongest wins (priority `SPOUSE 3 > ENGAGED 2 > DIVORCED 1`).
2. **Child resolution.** For each child:
   - 2+ parents → look for an existing couple union among them; if none, synthesize a coparent union for unmarried co-parents (deterministic id `u:coparent:<sortedParents>`).
   - 1 parent → synthesize a solo union (`u:solo:<parentId>`).
   - Children's edges always hang off a union node, **never the parent directly**. This is what makes the "line comes from between the parents" rendering trivial.
3. **Generation BFS** from focal: focal=0, ancestors negative, descendants positive. Spouses & siblings inherit the same gen. Unreachable people get gen 0 (disconnected cluster).
4. **Emit nodes/edges.** Returns `{ nodes, edges, person_unions, parent_unions_of_person }`.

### 6.2 Layout (`elkLayout.ts`)

⚠️ **ELK runs on the main thread** via `elk.bundled.js`. The function is async but no Web Worker is used. This is a regression risk on large trees.

The layout philosophy is unusual and worth knowing:

- **Y is entirely the app's, X is ELK's.**
- Each node gets `elk.partitioning.partition = gen + 1000` (`BASE_PARTITION` offset so ancestors with negative gen still get positive partitions). This locks every node to its generation row — spouses share a partition and cannot drift across layers.
- After ELK runs, the app discards ELK's Y and recomputes from gen.
- **Nuclear pin pass:** for every spouse edge, force `person.y = union.y - UNION_Y_OFFSET` (`UNION_Y_OFFSET = (212-12)/2 = 100` to align the tiny union pill's midpoint with the tall person card's midpoint).
- Couple unions are re-centered between their two parents — ELK can place the union pill anywhere within a row; this prevents the spouse line from spanning unrelated siblings.
- `orderNodesForElk` walks each generation and emits spouse partners adjacently to nudge ELK's crossing-minimization toward keeping couples next to each other.

### 6.3 Hook & React Flow (`useElkLayout.ts`)

- `topoHash` excludes `focalId` and ignores cosmetic person fields (only id + relationship structure). Cosmetic edits do not trigger re-layout.
- `focalId` is tracked separately via ref, so the one-time `null → first-id` transition still triggers a layout, but later focal changes (which there shouldn't be — see below) don't.
- While async ELK is in-flight, the previous layout is kept (no canvas flash).
- Spouse edges use facing handles (`right`/`spouse-left` or vice versa) based on relative X. Divorced couples get the `shortree-edge-divorced` class. Child edges are orthogonal step paths.

### 6.4 Frozen focal (`FamilyTreeViewer.tsx`)

The focal person is **frozen via `focalRef`** after first non-null capture. Clicking a person opens the side panel but never changes the focal — that would re-run BFS, reassign generations, and visibly shift spouses to wrong rows.

### 6.5 Placeholder synthesis — REMOVED

`placeholders.ts` no longer exists. Add affordances now live in the side panel via `handleOpenAddFromPanel` in `TreeCanvasWithModals.tsx`, which opens an `AddRelativePopover` centered on screen instead of inline canvas placeholders.

### 6.6 Optimistic updates (`useTreeMutations.ts`)

Single client-side source of truth from initial RSC payload onwards.

- `runOptimistic` inserts temp rows (`tmp:person:<uuid>`, `tmp:rel:<uuid>`) → calls server → on success swaps temp ids and remaps endpoint ids in relationships → on failure (or `BRANCHING_NOT_ALLOWED`) rolls back and shows `BlockedActionDialog` or toast.
- Uses `useTransition` so the canvas stays interactive during saves.
- **No `router.refresh()` after writes:** the server action calls `revalidatePath`, which takes effect on next nav. Refreshing inline would race optimistic edits.
- `addSpouse` enforces opposite gender client-side too (mirror of server).

---

## 7. AI biography (newest feature)

`AiBioSearch.tsx` inside the side panel calls server action `fetchAiBiographyAction` (in `person.actions.ts`).

- Requires `EDITOR` role on the tree.
- Builds a Hebrew prompt: `"תביא כל מה שאתה מוצא על <name>, הבן/הבת של <parent>"` plus search hints (Wikipedia HE/EN, MyHeritage, Geni, JewishGen, rabbinical books).
- Calls `generateGroundedHebrewBio` (`gemini.ts`) → POSTs to `gemini-2.5-pro:generateContent` with `tools: [{ google_search: {} }]` and a system instruction casting the model as a "senior genealogy researcher specializing in rabbinical lineages."
- Returns the text, which the UI applies to the bio textarea.
- Requires `GEMINI_API_KEY` env var.

---

## 8. API surface (`/api/v1/`)

| Endpoint                          | Method               | Auth          | Purpose                              |
| --------------------------------- | -------------------- | ------------- | ------------------------------------ |
| `/auth/login`                     | POST                 | –             | Supabase signIn                      |
| `/auth/signup`                    | POST                 | –             | Create user + mirror                 |
| `/auth/logout`                    | POST                 | yes           | Clear session                        |
| `/auth/me`                        | GET                  | –             | `{ user: null }` for guests          |
| `/auth/callback`                  | GET                  | –             | Google OAuth callback                |
| `/trees`                          | GET / POST           | – / yes       | List user trees / create             |
| `/trees/:treeId`                  | GET / PATCH          | – / OWNER     | Read / update settings               |
| `/trees/:treeId/about`            | GET / PATCH          | – / EDITOR+   | About text + surnames                |
| `/persons`                        | GET / POST           | – / EDITOR    | List / create                        |
| `/persons/:personId`              | GET / PATCH / DELETE | – / EDITOR / OWNER | CRUD                            |
| `/uploads/profile-image`          | POST                 | EDITOR+       | Supabase Storage via service role    |
| `/uploads/tree-about-image`       | POST                 | EDITOR+       | Gallery upload                       |

Plus per-`shortCode` mutation routes under `/[locale]/tree/[shortCode]/{add, add-parent, add-spouse, add-child, add-sibling, remove-person, data}` that the `apiClient` calls.

**Response envelope (uniform):**
```ts
{ data: T, error: null } | { data: null, error: { code, message, details? } }
```
See `response.ts` and `errors.ts`. `withErrorHandler` wraps handlers with try/catch + recognizes Prisma `P2021`/`P2022` schema-drift and `P1000`/`P1001` connection errors with friendly messages.

---

## 9. Planned architecture: three viewing modes

Aligned with the "family memory gift" pivot:

1. **`/tree/[shortCode]`** *(exists)* — Owner/Editor canvas (current editing experience).
2. **`/view/[shortCode]`** *(planned)* — Family dashboard: today's birthdays, activity feed, tree preview, "living family" carousel, recent AI bios.
3. **`/display/[shortCode]`** *(planned)* — Fullscreen slideshow for TV/tablet in the living room (Wake Lock API, auto-rotation between tree/photos/bios/events).

---

## 10. Features in development pipeline (priority order)

1. **Life Status toggle** (`is_deceased` boolean) — replace always-visible `death_date` with clean Living/Deceased toggle. Default Living.
2. **Hebrew date auto-translation** — user enters Gregorian, server translates to Hebrew via `@hebcal/core`, displays both.
3. **Per-person photo gallery** — main photo + additional photos that rotate in View/Display modes.
4. **`/view` dashboard route**
5. **`/display` TV mode route**
6. **Activity log table** for the feed
7. **QR code gift PDF** for sharing with grandparents

---

## 11. Strengths

1. **Tenancy discipline.** Every mutation calls `requireTreeRole(treeId, …)`. Schema cascades on `tree_id` and FK uniqueness prevents cross-tenant id reuse. `assertPersonsInTree` is the belt-and-suspenders inside transactions.
2. **Bipartite-with-Union model is the right abstraction.** Treating marriage as a node, not an edge, is what makes the spouse-line geometry fall out for free and is the single best architectural decision in the graph layer.
3. **Layered defenses for graph correctness:** ELK partitioning + custom Y projection + nuclear spouse-Y pin + topology hash that excludes focal. Each layer compensates for ways the previous one can fail.
4. **Optimistic UX without state-management library.** `useTreeMutations` keeps temp ids local, swaps on server success, and never refreshes mid-edit. Clean and small.
5. **Locale handling is genuinely careful** — middleware uses a cookie mirror to avoid Prisma in Edge, the navbar reads pathname from a request header instead of a client context, and per-user locale persists across devices.
6. **Branching control is a thoughtful "permission you can't grant yourself."** The blocked-path response carries the owner's email so the UI can name the person to ask.

---

## 12. Risks / smells

1. **Shorted/ShorTree branding leakage.** `package.json` name is `"shorted"`, CSS classes are `shortree-edge-spouse`/`-divorced`/`-child`. Cosmetic but confusing for new contributors.
2. **ELK on main thread.** `elk.bundled.js` runs synchronously on layout requests; large trees (>~200 nodes) will jank the UI. Earlier "worker-based" docs suggest this regressed; could be reintroduced.
3. **Internal HTTP fetch from RSC.** `tree/[shortCode]/page.tsx` does `fetch(<self>/data)` to load tree data, forwarding cookies. Extra round trip + parse vs calling `resolveTreePageDataBySlug` directly. Done so the same envelope is reused, but it's slower.
4. **Public read of tree data.** `resolveTreePageDataBySlug` lets any visitor with a slug see all persons + relationships, regardless of `is_public`. Public-by-link policy is documented — but the `GUEST` role with "sensitive metadata hidden" mentioned in earlier docs does not appear to be enforced anywhere visible.
5. **Gender-strict spouse logic throws on `UNKNOWN`/`OTHER`.** Schema allows `OTHER` + `UNKNOWN`, code rejects them on add-spouse. Known product choice ("Mandatory Gender") but is awkward UX if a record is missing gender.
6. **Cousin-marriage / multi-parent edge cases.** `addParent` caps biological parents at 2 (good), but `buildBipartiteGraph` deals with ">2 recorded parents" by deterministically picking the lex-smallest pair for the union — children of complex blended families may not render to the user's expectation.
7. **`tmp:` id leak** if a mutation succeeds on the server but the response is dropped — the client retains a temp id and the next reload refetches the real one. Acceptable tradeoff but worth knowing.
8. **No tests in the worktree** (`tests/` folder absent). Graph algorithm complexity here cries out for unit tests on `buildBipartiteGraph` for blended-family cases.
9. **`NEXT_PUBLIC_SUPABASE_ANON_KEY` used inside `sendMemberPasswordResetEmail`** server action with `createClient` — works, but using the admin client (already imported elsewhere) would be more idiomatic for a server-only path.

---

## 13. Important invariants & gotchas (cheat sheet)

- Spouse edges enforce opposite binary gender (throws on `UNKNOWN`/`OTHER`).
- `addParent` caps biological parents at 2 (`PARENT_CHILD`); `ADOPTED_PARENT` uncapped.
- Symmetric relationships (`SPOUSE`/`SIBLING`/`ENGAGED`/`DIVORCED`) normalized by sorted IDs.
- ELK runs on main thread (regression from earlier worker-based — may jank on >200 nodes).
- Frozen focal: focal person captured once via ref; clicking another person opens panel but doesn't re-run BFS.
- Internal HTTP fetch from RSC `tree/[shortCode]/page.tsx` → `/data` route.
- No tests in repo currently — graph algorithm complexity warrants unit tests on `buildBipartiteGraph`.

---

## 14. Style/UX conventions

- Cream background `bg-[#f4f3e9]`, emerald-600 primary, white cards with subtle shadows.
- Hebrew is default locale, full RTL. Person cards display Hebrew names primarily.
- Forms in sidebars (right side in RTL); quick-add via popovers for speed.
- **Minimal data entry philosophy:** ask for as little as possible upfront, allow rich editing later.

---

## TL;DR

A well-architected, multi-tenant family-tree SaaS where the most interesting code is the graph layer (bipartite-with-Union, ELK partitioning + custom Y projection, frozen focal ref) and the most interesting business invariant is per-tree RBAC layered with branching control and strict lineage. Mutation correctness is enforced by a consistent stack: route handler → service → `requireTreeRole` → branching/lineage → Prisma transaction → `revalidatePath`. The optimistic client hook keeps the canvas snappy without any state-management library. Recent additions (Gemini bio, branching control, member admin, Google OAuth) and the product pivot toward "family memory gift" set the direction for the next features (Life Status toggle, Hebrew date auto-translation, per-person galleries, `/view` and `/display` routes). Main areas to watch: ELK main-thread cost on large trees, `shorted`/`ShorTree` branding leakage, and lack of tests on graph-building.