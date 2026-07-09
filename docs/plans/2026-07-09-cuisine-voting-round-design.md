# Cuisine Voting Round — Design

**Date:** 2026-07-09
**Status:** Proposed (awaiting approval)
**Author:** Claude + George

## Problem

Groups swipe through 20–40 restaurant cards spanning every cuisine. Consensus is slow because members reject restaurants for two unrelated reasons (wrong cuisine vs. wrong restaurant). A fast cuisine round first collapses the search space before any restaurant card is shown.

## Concept

A quick swipe round on **cuisine cards** (Burgers, BBQ, Pizza, Thai, Sushi, …) that runs after the host sets filters and before restaurants load. When the group matches on a cuisine, restaurants are fetched **within the host's existing filters** (location, radius, price, dietary) constrained to the winning cuisine(s).

Key insight: the existing pipeline (`start-session` → `preferences.cuisineTypes` → Yelp category param → `restaurantCache` → swipe/match) already filters restaurants by cuisine. The cuisine round just needs to **write its winners into `preferences.cuisineTypes`** before status flips to `swiping`. The whole restaurant pipeline is reused unchanged.

## Approaches considered

1. **Ballot grid** — each member taps their top 3 cuisines, tally, top wins. Fast but breaks the app's swipe identity; feels like a form.
2. **Swipe deck, unanimous-only** — same rules as restaurants. Risk: no unanimous cuisine → deadlock.
3. **Swipe deck with unanimous fast-path + top-vote fallback** *(chosen)* — swipe mechanic keeps brand consistency and muscle memory; first unanimous cuisine ends the round instantly with a celebration; otherwise, when everyone finishes, top-voted cuisines win. Guaranteed to terminate, guaranteed a result.

## Game rules

- **Deck:** built server-side at `start-session`, stored on the group row so all members see the same cards in the same order.
  - Source: all 20 `cuisineTypes` minus `preferences.excludeCuisines`, minus cuisines hidden by `trySomethingNew`.
  - Capped at **12 cards** (popularity-ordered pool, then shuffled with a per-session seed). 12 cards ≈ 30–45 seconds of swiping.
- **Voting:** right = yes, left = no. No superlike in v1 (keep the round fast).
- **End conditions (whichever first):**
  1. **Unanimous match** — every member liked the same cuisine → instant winner, confetti, round over.
  2. **Everyone done** (deck exhausted or tapped "I'm done") → winner = most-liked cuisine. Ties broken by earliest to reach the count.
- **Winners → restaurant supply:** the winner plus the next 2 most-liked cuisines (that got ≥1 like) are written to `preferences.cuisineTypes` (winner first). Yelp's `categories` param takes the comma list; if the winner alone yields <10 results the runners-up keep the deck full. UI headlines only the winner.
- **Zero likes from everyone:** skip the cuisine filter entirely (`cuisineTypes: []` = all cuisines), toast "No cuisine consensus — showing everything nearby."
- **Opt-out:** host toggle in Preferences: "🗳️ Cuisine vote first" (default **on**). When on, the manual "Cravings" cuisine multi-select is hidden (the vote replaces it); Exclusions remain. When off, current behavior is unchanged.
- **Solo sessions:** round still works — the single member's likes decide (effectively a quick personal filter).
- **Late joiners:** a member who joins during `cuisine_voting` gets the deck and votes; their votes count toward tallies but a unanimous check only counts members present at the time of evaluation (same semantics as restaurant matching, which uses current `group.members`).

## State machine

```
waiting → configuring → cuisine_voting → swiping → completed
                     ↘ (toggle off) ↗
```

New `Group.status` value: `"cuisine_voting"`.

## Data model

New Drizzle table (mirrors `anonymousGroupSwipes`):

```ts
export const anonymousGroupCuisineVotes = pgTable("anonymous_group_cuisine_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull(),
  memberId: varchar("member_id").notNull(),
  cuisine: varchar("cuisine").notNull(),
  liked: boolean("liked").notNull(),
  votedAt: timestamp("voted_at").defaultNow(),
}, (t) => [index("agcv_group_cuisine_idx").on(t.groupId, t.cuisine, t.liked)]);
```

`anonymousGroups` gains two jsonb columns:
- `cuisineDeck: jsonb` — ordered `CuisineType[]` for the session
- `matchedCuisines: jsonb` — winners, written when the round completes (audit/display; `preferences.cuisineTypes` drives the fetch)

Zod additions in `shared/schema.ts`:
- `groupSchema.status` enum += `"cuisine_voting"`
- `groupSchema` += `cuisineDeck: z.array(z.enum(cuisineTypes)).optional()`, `matchedCuisines: z.array(z.enum(cuisineTypes)).optional()`
- `groupPreferencesSchema` += `cuisineRoundEnabled: z.boolean().optional().default(true)`
- New `cuisineVoteSchema`
- Member gains `doneCuisineVoting: z.boolean().default(false)`

## API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/groups/:id/start-session` | (modified) if `cuisineRoundEnabled` and >0 deck cards: build deck, status → `cuisine_voting`; else current behavior |
| POST | `/api/groups/:id/cuisine-vote` | `{memberId, cuisine, liked}` — record vote (idempotent upsert), broadcast progress, evaluate unanimous fast-path |
| POST | `/api/groups/:id/done-cuisine-voting` | mark member done; if all done → resolve winners, complete round |
| GET | `/api/groups/:id/cuisine-round` | deck, my votes, per-cuisine like tallies, member progress (rejoin/refresh recovery) |

Round completion (single server function `resolveCuisineRound`):
1. Compute winners (unanimous or top-voted + up to 2 runners-up).
2. `preferences.cuisineTypes = winners`; persist `matchedCuisines`.
3. Clear any stale `restaurantCache` row for the group (safety).
4. Status → `swiping`; broadcast `cuisine_round_complete` then `status_changed`.

All vote endpoints use the existing `verifyMemberIdentity` binding and `swipeLimiter` rate limit.

## WebSocket messages

```ts
| { type: "cuisine_vote_made"; memberId: string; cuisine: string }
| { type: "member_done_cuisine_voting"; memberId: string; memberName: string }
| { type: "cuisine_match_found"; cuisine: CuisineType }            // unanimous fast-path
| { type: "cuisine_round_complete"; winners: CuisineType[] }       // always sent at end
```

Existing `status_changed` and `sync` carry the rest. `sync` payload adds `cuisineDeck`/`matchedCuisines` via the group object.

## Client

- **Route:** `/group/:id/cuisine-vote` → new `CuisineVotePage` (`client/src/pages/cuisine-vote.tsx`).
- **Navigation:** lobby + swipe pages route on status: `cuisine_voting` → cuisine-vote page; `swiping` → swipe page. (Same pattern as today's `status_changed` handler.)
- **Components:**
  - `CuisineCard` (`client/src/components/cuisine-card.tsx`) — same framer-motion drag/rotate/exit mechanics as `SwipeCard`, but no photos: full-bleed two-stop gradient per cuisine, oversized emoji (~96px with soft drop shadow), name, tagline, three example-dish chips. NOPE/YUM stamps reused.
  - Vote screen chrome: "Round 1 · Cuisine" eyebrow, progress dots (card x of 12), member avatars with live progress (reuse `MemberAvatars` + `member_progress`-style updates), buttons row (X / flame only).
- **Winner moment:** full-screen takeover — winning card scales up center, confetti (reuse existing canvas-confetti pattern), "It's a match!" headline, "Finding {cuisine} spots near you…" loading line, auto-advance to `/swipe` when `status_changed` arrives.
- **Preferences page:** add toggle in a new "Round 1" section; hide "Cravings" multi-select when enabled.
- **Analytics:** log `cuisine_vote` events through the existing analytics batch endpoint — feeds the existing `getCuisineDemand` admin analytics.

## Card visual spec

Anatomy (top → bottom): gradient ground → emoji (centered upper third, 96px, `drop-shadow`) → cuisine name (extrabold, 34px, white) → tagline (15px, white/85) → 3 dish chips (`bg-white/20 backdrop-blur`) → progress dots above card. Grain/noise overlay at 4% opacity keeps flat gradients from banding.

| Cuisine | Emoji | Gradient (from → to) | Tagline |
|---|---|---|---|
| Burger | 🍔 | #F9A825 → #BF5F1F | Stacked patties & crispy fries |
| BBQ | 🍖 | #4E342E → #FF6F00 | Low & slow smoked everything |
| Pizza | 🍕 | #EF6C00 → #FDD835 | Slices, pies & melty cheese |
| Italian | 🍝 | #C62828 → #F9A825 | Pasta, wood-fired & la dolce vita |
| Mexican | 🌮 | #E65100 → #43A047 | Tacos, al pastor & fresh lime |
| Chinese | 🥡 | #D32F2F → #FF8F00 | Dumplings, noodles & wok-fire |
| Japanese | 🍱 | #37474F → #EC407A | Ramen, tempura & izakaya vibes |
| Sushi | 🍣 | #263238 → #26C6DA | Nigiri, rolls & omakase |
| Thai | 🍤 | #00897B → #7CB342 | Pad thai, curry & thai basil |
| Indian | 🍛 | #F57C00 → #C2185B | Curry, naan & tandoori heat |
| Korean | 🍲 | #B71C1C → #FF7043 | KBBQ, bibimbap & banchan |
| Vietnamese | 🍜 | #2E7D32 → #FDD835 | Pho, banh mi & fresh herbs |
| Greek | 🥙 | #1976D2 → #64B5F6 | Gyros, souvlaki & feta |
| Mediterranean | 🫒 | #0277BD → #9CCC65 | Mezze, grilled fish & olive oil |
| Middle Eastern | 🧆 | #6D4C41 → #FFB300 | Falafel, shawarma & hummus |
| French | 🥐 | #283593 → #EF9A9A | Bistro classics & buttery everything |
| Spanish | 🥘 | #C62828 → #FBC02D | Paella, tapas & sangria |
| American | 🍗 | #1565C0 → #E53935 | Comfort classics & diner faves |
| Seafood | 🦞 | #01579B → #4DD0E1 | Fresh catch, oysters & raw bar |
| Steakhouse | 🥩 | #3E2723 → #D84315 | Prime cuts & classic sides |

Default popularity order for the 12-card cap: Burger, Pizza, Mexican, BBQ, Italian, Chinese, Sushi, American, Thai, Japanese, Indian, Mediterranean (remaining 8 enter only when exclusions free up slots).

## Implementation plan (phases)

1. **Schema & shared types** — Drizzle table + jsonb columns + migration; Zod schema additions; WS message types. (~0.5 day)
2. **Server** — deck builder, vote endpoints, `resolveCuisineRound`, `start-session` branch, storage methods, sync payload. (~1 day)
3. **Client: vote flow** — `CuisineCard`, `CuisineVotePage`, route, status navigation in lobby/swipe. (~1 day)
4. **Client: polish** — winner celebration, preferences toggle + Cravings hide, progress avatars, analytics events. (~0.5–1 day)
5. **Tests & verify** — server unit tests for deck building + winner resolution (mirror `match-logic` test style); manual multi-member run-through; tsc against baseline. (~0.5 day)

Rollout: ships default-on behind the preferences toggle; no data migration risk (new columns nullable, old sessions unaffected). Native apps need a client rebuild (`build:client` + `cap sync`).

## Edge cases

- **Refresh/rejoin mid-round:** GET `/cuisine-round` restores deck position from recorded votes (server is source of truth; no localStorage dependency needed since deck ≤12).
- **Member leaves mid-round:** all-done check uses current members (leaver can't block completion). Host-remove already broadcasts `member_removed`.
- **Deck of 1–2 cards** (heavy exclusions): round still runs; if deck is 0, skip round entirely.
- **Crew sessions** (`/join-session`): deck is built when the in-memory group's session starts — same code path (`start-session`), no special-casing.
- **Double-vote:** upsert per (groupId, memberId, cuisine); last vote wins (allows undo-style correction later, YAGNI for v1 UI).

## Explicitly out of scope (v1)

- Superlike weighting in the cuisine round
- Host-curated custom decks
- Cuisine images from Yelp (emoji + gradient is deliberate: instant load, zero API cost)
- Weighted/ranked-choice voting
