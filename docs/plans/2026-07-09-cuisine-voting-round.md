# Cuisine Voting Round Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a fast pre-restaurant "cuisine vote" swipe round so a group agrees on a cuisine (burgers, BBQ, pizza, thai, sushi…) before restaurants load; the winning cuisine(s) then filter the existing restaurant pipeline.

**Architecture:** A new `cuisine_voting` group status sits between `configuring` and `swiping`. At `start-session`, if enabled, the server builds a deterministic cuisine deck stored on the group. Members swipe cuisine cards; votes are recorded server-side. A unanimous like ends the round instantly; otherwise the round ends when all members finish and the most-liked cuisine(s) win. Winners are written into `preferences.cuisineTypes`, so the **existing** Yelp→cache→swipe→match pipeline is reused unchanged. Pure logic (deck building, winner resolution) lives in a new `server/cuisine-round.ts` module and is unit-tested like `server/match-logic.ts`.

**Tech Stack:** TypeScript, Express, Drizzle ORM (PostgreSQL), ws (WebSocket), Zod, React + wouter + React Query + framer-motion, Vitest.

**Key existing patterns to mirror:**
- Pure match logic + tests: [server/match-logic.ts](../../server/match-logic.ts), [server/__tests__/match-algorithm.test.ts](../../server/__tests__/match-algorithm.test.ts)
- Swipe card mechanics: [client/src/components/swipe-card.tsx](../../client/src/components/swipe-card.tsx)
- Status-based navigation: [client/src/pages/group-lobby.tsx:87-91,164-167](../../client/src/pages/group-lobby.tsx)
- Vote/broadcast pattern: `vote-match`/`pick-match` in [server/routes.ts:681-804](../../server/routes.ts)
- Member identity guard: `verifyMemberIdentity` + `swipeLimiter` in [server/routes.ts](../../server/routes.ts)

**Design doc:** [docs/plans/2026-07-09-cuisine-voting-round-design.md](2026-07-09-cuisine-voting-round-design.md)

---

## Phase 0: Baseline

### Task 0: Confirm green baseline

**Step 1:** Run the existing test suite.

Run: `npx vitest run`
Expected: PASS (all existing tests green). Note the count.

**Step 2:** Capture the tsc baseline (there are ~89 known pre-existing errors — these are NOT regressions).

Run: `npx tsc --noEmit 2>&1 | tee /tmp/tsc-before.txt | tail -1`
Expected: a number of errors; save it. After each phase, `npx tsc --noEmit` must not exceed this count for files we touch.

No commit.

---

## Phase 1: Shared types & schema

### Task 1: Add `cuisine_voting` status + member/preference/group fields to Zod schema

**Files:**
- Modify: `shared/schema.ts`

**Step 1: Update the group status enum**

In `groupSchema` (`shared/schema.ts:82`), change:
```ts
status: z.enum(["waiting", "configuring", "swiping", "completed"]).default("waiting"),
```
to:
```ts
status: z.enum(["waiting", "configuring", "cuisine_voting", "swiping", "completed"]).default("waiting"),
```

**Step 2: Add `doneCuisineVoting` to the member schema**

In `groupMemberSchema` (`shared/schema.ts:48-54`), add after `doneSwiping`:
```ts
  doneCuisineVoting: z.boolean().default(false)
```
(Add a comma after the existing `doneSwiping` line.)

**Step 3: Add `cuisineRoundEnabled` to preferences**

In `groupPreferencesSchema` (`shared/schema.ts:59-71`), add before the closing `});`:
```ts
  cuisineRoundEnabled: z.boolean().optional().default(true),
```

**Step 4: Add deck/winners to the group schema**

In `groupSchema` (`shared/schema.ts:76-85`), add before `leaderToken`:
```ts
  cuisineDeck: z.array(z.enum(cuisineTypes)).optional(),
  matchedCuisines: z.array(z.enum(cuisineTypes)).optional(),
```

**Step 5: Add the cuisine vote schema + WS message types**

After `swipeSchema` (`shared/schema.ts:127`), add:
```ts
// Cuisine vote (pre-restaurant round)
export const cuisineVoteSchema = z.object({
  memberId: z.string().min(1),
  cuisine: z.enum(cuisineTypes),
  liked: z.boolean(),
});
export type CuisineVote = z.infer<typeof cuisineVoteSchema>;
```

In the `WSMessage` union (`shared/schema.ts:158-173`), add these lines before the closing `;`:
```ts
  | { type: "cuisine_vote_made"; memberId: string; cuisine: CuisineType }
  | { type: "member_done_cuisine_voting"; memberId: string; memberName: string }
  | { type: "cuisine_match_found"; cuisine: CuisineType }
  | { type: "cuisine_round_complete"; winners: CuisineType[] }
```

**Step 6: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep "shared/schema.ts"`
Expected: no NEW errors referencing `shared/schema.ts`.

**Step 7: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(schema): add cuisine_voting status, vote schema, and WS message types"
```

---

### Task 2: Add the `anonymousGroupCuisineVotes` table + group columns

**Files:**
- Modify: `shared/models/social.ts`

**Step 1: Add jsonb columns to `anonymousGroups`**

In `anonymousGroups` (`shared/models/social.ts:205-214`), add before `createdAt`:
```ts
  cuisineDeck: jsonb("cuisine_deck"),
  matchedCuisines: jsonb("matched_cuisines"),
```

**Step 2: Add the votes table**

After `anonymousGroupSwipes` (`shared/models/social.ts:230`), add:
```ts
export const anonymousGroupCuisineVotes = pgTable("anonymous_group_cuisine_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => anonymousGroups.id, { onDelete: "cascade" }),
  memberId: varchar("member_id").notNull(),
  cuisine: varchar("cuisine").notNull(),
  liked: boolean("liked").notNull(),
  votedAt: timestamp("voted_at").defaultNow(),
}, (table) => [
  index("agcv_group_idx").on(table.groupId),
  index("agcv_group_cuisine_idx").on(table.groupId, table.cuisine, table.liked),
  // one vote per member per cuisine (enables upsert)
  index("agcv_unique_idx").on(table.groupId, table.memberId, table.cuisine),
]);

export type AnonymousGroupCuisineVote = typeof anonymousGroupCuisineVotes.$inferSelect;
```

**Step 3: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep "social.ts"`
Expected: no NEW errors referencing `social.ts`.

**Step 4: Commit**

```bash
git add shared/models/social.ts
git commit -m "feat(schema): add anonymous_group_cuisine_votes table and group deck columns"
```

---

### Task 3: Generate + write the migration

**Files:**
- Create: `migrations/0003_cuisine_voting.sql` (hand-written; the app deploys SQL migrations)

**Step 1: Write the migration SQL**

Create `migrations/0003_cuisine_voting.sql`:
```sql
ALTER TABLE "anonymous_groups" ADD COLUMN IF NOT EXISTS "cuisine_deck" jsonb;
ALTER TABLE "anonymous_groups" ADD COLUMN IF NOT EXISTS "matched_cuisines" jsonb;

CREATE TABLE IF NOT EXISTS "anonymous_group_cuisine_votes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" varchar NOT NULL REFERENCES "anonymous_groups"("id") ON DELETE CASCADE,
  "member_id" varchar NOT NULL,
  "cuisine" varchar NOT NULL,
  "liked" boolean NOT NULL,
  "voted_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agcv_group_idx" ON "anonymous_group_cuisine_votes" ("group_id");
CREATE INDEX IF NOT EXISTS "agcv_group_cuisine_idx" ON "anonymous_group_cuisine_votes" ("group_id","cuisine","liked");
CREATE UNIQUE INDEX IF NOT EXISTS "agcv_unique_idx" ON "anonymous_group_cuisine_votes" ("group_id","member_id","cuisine");
```
Note: `agcv_unique_idx` is a UNIQUE index (upsert target), unlike the Drizzle metadata index in Task 2 — the DB constraint is what enforces one-vote-per-cuisine.

**Step 2: Apply against the dev DB (only if `DATABASE_URL` points at a dev/branch DB)**

Run: `psql "$DATABASE_URL" -f migrations/0003_cuisine_voting.sql`
Expected: `ALTER TABLE` / `CREATE TABLE` / `CREATE INDEX` success. If no local DB is available, skip and note that the migration must run on deploy.

**Step 3: Commit**

```bash
git add migrations/0003_cuisine_voting.sql
git commit -m "feat(db): migration for cuisine voting table and columns"
```

---

## Phase 2: Server pure logic (TDD)

### Task 4: Cuisine deck builder — failing test

**Files:**
- Create: `server/__tests__/cuisine-round.test.ts`

**Step 1: Write the failing test**

Create `server/__tests__/cuisine-round.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildCuisineDeck, resolveCuisineWinners } from "../cuisine-round";
import type { CuisineVoteRecord } from "../cuisine-round";

describe("buildCuisineDeck", () => {
  it("caps the deck at 12 cards", () => {
    const deck = buildCuisineDeck({ excludeCuisines: [], trySomethingNew: false, matchedBefore: [], seed: 1 });
    expect(deck.length).toBe(12);
  });

  it("excludes cuisines in excludeCuisines", () => {
    const deck = buildCuisineDeck({ excludeCuisines: ["Burger", "Pizza"], trySomethingNew: false, matchedBefore: [], seed: 1 });
    expect(deck).not.toContain("Burger");
    expect(deck).not.toContain("Pizza");
  });

  it("hides previously-matched cuisines when trySomethingNew is on", () => {
    const deck = buildCuisineDeck({ excludeCuisines: [], trySomethingNew: true, matchedBefore: ["Thai"], seed: 1 });
    expect(deck).not.toContain("Thai");
  });

  it("is deterministic for the same seed", () => {
    const a = buildCuisineDeck({ excludeCuisines: [], trySomethingNew: false, matchedBefore: [], seed: 42 });
    const b = buildCuisineDeck({ excludeCuisines: [], trySomethingNew: false, matchedBefore: [], seed: 42 });
    expect(a).toEqual(b);
  });

  it("returns fewer than 12 when exclusions shrink the pool", () => {
    // exclude all but 3
    const keep = ["Burger", "Pizza", "Thai"];
    const { cuisineTypes } = require("@shared/schema");
    const exclude = cuisineTypes.filter((c: string) => !keep.includes(c));
    const deck = buildCuisineDeck({ excludeCuisines: exclude, trySomethingNew: false, matchedBefore: [], seed: 1 });
    expect(deck.length).toBe(3);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx vitest run server/__tests__/cuisine-round.test.ts`
Expected: FAIL — `Cannot find module '../cuisine-round'`.

---

### Task 5: Cuisine deck builder — implement

**Files:**
- Create: `server/cuisine-round.ts`

**Step 1: Implement the deck builder**

Create `server/cuisine-round.ts`:
```ts
import { cuisineTypes, type CuisineType } from "@shared/schema";

// Default popularity ordering — the first 12 form the default deck.
const POPULARITY_ORDER: CuisineType[] = [
  "Burger", "Pizza", "Mexican", "BBQ", "Italian", "Chinese",
  "Sushi", "American", "Thai", "Japanese", "Indian", "Mediterranean",
  "Korean", "Vietnamese", "Greek", "Middle Eastern", "French",
  "Spanish", "Seafood", "Steakhouse",
];

const DECK_CAP = 12;

// Deterministic PRNG (mulberry32) so a seed yields a stable shuffle.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface BuildDeckOpts {
  excludeCuisines: string[];
  trySomethingNew: boolean;
  matchedBefore: string[];
  seed: number;
}

export function buildCuisineDeck(opts: BuildDeckOpts): CuisineType[] {
  const excluded = new Set<string>(opts.excludeCuisines);
  if (opts.trySomethingNew) {
    for (const c of opts.matchedBefore) excluded.add(c);
  }
  // Order by popularity, drop excluded, ensure every valid cuisine is considered.
  const ordered = POPULARITY_ORDER.filter(c => cuisineTypes.includes(c));
  const pool = ordered.filter(c => !excluded.has(c));
  const capped = pool.slice(0, DECK_CAP);
  return shuffle(capped, mulberry32(opts.seed));
}
```

**Step 2: Run the deck tests**

Run: `npx vitest run server/__tests__/cuisine-round.test.ts -t buildCuisineDeck`
Expected: PASS (5 tests). `resolveCuisineWinners` import will still error at load — proceed to Task 6 which implements it in the same file, then run the full file.

**Step 3: Commit**

```bash
git add server/cuisine-round.ts server/__tests__/cuisine-round.test.ts
git commit -m "feat(server): cuisine deck builder with deterministic shuffle + tests"
```

---

### Task 6: Winner resolution — failing test

**Files:**
- Modify: `server/__tests__/cuisine-round.test.ts`

**Step 1: Add the winner-resolution tests**

Append to `server/__tests__/cuisine-round.test.ts`:
```ts
describe("resolveCuisineWinners", () => {
  const deck = ["Burger", "Pizza", "Thai", "Sushi"] as const;

  it("returns a unanimous cuisine as the sole winner path", () => {
    const votes: CuisineVoteRecord[] = [
      { memberId: "m1", cuisine: "Thai", liked: true },
      { memberId: "m2", cuisine: "Thai", liked: true },
    ];
    const winners = resolveCuisineWinners(["m1", "m2"], votes, [...deck]);
    expect(winners[0]).toBe("Thai");
  });

  it("picks the most-liked cuisine when no unanimous pick", () => {
    const votes: CuisineVoteRecord[] = [
      { memberId: "m1", cuisine: "Burger", liked: true },
      { memberId: "m2", cuisine: "Burger", liked: true },
      { memberId: "m1", cuisine: "Pizza", liked: false },
      { memberId: "m2", cuisine: "Pizza", liked: true },
    ];
    const winners = resolveCuisineWinners(["m1", "m2"], votes, [...deck]);
    expect(winners[0]).toBe("Burger");
  });

  it("includes up to two runners-up (with >=1 like) after the winner", () => {
    const votes: CuisineVoteRecord[] = [
      { memberId: "m1", cuisine: "Burger", liked: true },
      { memberId: "m2", cuisine: "Burger", liked: true },
      { memberId: "m1", cuisine: "Pizza", liked: true },
      { memberId: "m1", cuisine: "Thai", liked: true },
      { memberId: "m2", cuisine: "Sushi", liked: false },
    ];
    const winners = resolveCuisineWinners(["m1", "m2"], votes, [...deck]);
    expect(winners[0]).toBe("Burger");
    expect(winners.length).toBeLessThanOrEqual(3);
    expect(winners).not.toContain("Sushi"); // zero likes
  });

  it("returns empty array when nobody liked anything", () => {
    const votes: CuisineVoteRecord[] = [
      { memberId: "m1", cuisine: "Burger", liked: false },
      { memberId: "m2", cuisine: "Pizza", liked: false },
    ];
    const winners = resolveCuisineWinners(["m1", "m2"], votes, [...deck]);
    expect(winners).toEqual([]);
  });

  it("breaks ties by deck order", () => {
    const votes: CuisineVoteRecord[] = [
      { memberId: "m1", cuisine: "Pizza", liked: true },
      { memberId: "m1", cuisine: "Thai", liked: true },
    ];
    // Pizza and Thai each have 1 like; Pizza comes first in the deck.
    const winners = resolveCuisineWinners(["m1"], votes, [...deck]);
    expect(winners[0]).toBe("Pizza");
  });
});
```

**Step 2: Add the `findUnanimousCuisine` export test (fast-path helper)**

Also append:
```ts
import { findUnanimousCuisine } from "../cuisine-round";

describe("findUnanimousCuisine", () => {
  it("returns the cuisine every present member liked", () => {
    const votes: CuisineVoteRecord[] = [
      { memberId: "m1", cuisine: "Thai", liked: true },
      { memberId: "m2", cuisine: "Thai", liked: true },
    ];
    expect(findUnanimousCuisine(["m1", "m2"], votes)).toBe("Thai");
  });
  it("returns null when not everyone liked the same one", () => {
    const votes: CuisineVoteRecord[] = [
      { memberId: "m1", cuisine: "Thai", liked: true },
      { memberId: "m2", cuisine: "Thai", liked: false },
    ];
    expect(findUnanimousCuisine(["m1", "m2"], votes)).toBeNull();
  });
});
```

**Step 3: Run to verify failure**

Run: `npx vitest run server/__tests__/cuisine-round.test.ts`
Expected: FAIL — `resolveCuisineWinners`/`findUnanimousCuisine`/`CuisineVoteRecord` not exported.

---

### Task 7: Winner resolution — implement

**Files:**
- Modify: `server/cuisine-round.ts`

**Step 1: Implement the resolvers**

Append to `server/cuisine-round.ts`:
```ts
export interface CuisineVoteRecord {
  memberId: string;
  cuisine: string;
  liked: boolean;
}

// The cuisine (if any) that every currently-present member has liked.
// Ties (multiple unanimous) resolve by deck order via the caller.
export function findUnanimousCuisine(
  memberIds: string[],
  votes: CuisineVoteRecord[],
): string | null {
  if (memberIds.length === 0) return null;
  const byCuisine = new Map<string, Set<string>>();
  for (const v of votes) {
    if (!v.liked) continue;
    if (!byCuisine.has(v.cuisine)) byCuisine.set(v.cuisine, new Set());
    byCuisine.get(v.cuisine)!.add(v.memberId);
  }
  for (const [cuisine, likers] of byCuisine) {
    if (memberIds.every(id => likers.has(id))) return cuisine;
  }
  return null;
}

// Winner + up to two runners-up (each with >=1 like), ordered by like count
// then deck position. Empty when nobody liked anything.
export function resolveCuisineWinners(
  memberIds: string[],
  votes: CuisineVoteRecord[],
  deck: string[],
): string[] {
  const likeCount = new Map<string, number>();
  for (const c of deck) likeCount.set(c, 0);
  for (const v of votes) {
    if (v.liked && likeCount.has(v.cuisine)) {
      likeCount.set(v.cuisine, likeCount.get(v.cuisine)! + 1);
    }
  }
  const ranked = deck
    .filter(c => (likeCount.get(c) || 0) > 0)
    .sort((a, b) => {
      const diff = (likeCount.get(b)! - likeCount.get(a)!);
      if (diff !== 0) return diff;
      return deck.indexOf(a) - deck.indexOf(b); // tie → deck order
    });
  return ranked.slice(0, 3);
}
```

**Step 2: Run the full test file**

Run: `npx vitest run server/__tests__/cuisine-round.test.ts`
Expected: PASS (all deck + winner + unanimous tests).

**Step 3: Run the whole suite (no regressions)**

Run: `npx vitest run`
Expected: PASS (baseline count + new tests).

**Step 4: Commit**

```bash
git add server/cuisine-round.ts server/__tests__/cuisine-round.test.ts
git commit -m "feat(server): cuisine winner resolution + unanimous fast-path with tests"
```

---

## Phase 3: Server wiring (storage + routes)

### Task 8: Storage methods for cuisine votes

**Files:**
- Modify: `server/storage.ts`

**Step 1: Import the votes table**

In the import at `server/storage.ts:11`, add `anonymousGroupCuisineVotes`:
```ts
import { anonymousGroups, anonymousGroupSwipes, anonymousGroupCuisineVotes, restaurantCache } from "@shared/schema";
```

**Step 2: Extend `dbRowToGroup` to hydrate deck/winners**

In `dbRowToGroup` (`server/storage.ts:231-242`), add before `leaderToken`:
```ts
    cuisineDeck: (row.cuisineDeck as any) || undefined,
    matchedCuisines: (row.matchedCuisines as any) || undefined,
```

**Step 3: Add methods to the `IStorage` interface**

In `IStorage` (`server/storage.ts:26-46`), add:
```ts
  setCuisineDeck(groupId: string, deck: string[]): Promise<void>;
  recordCuisineVote(groupId: string, memberId: string, cuisine: string, liked: boolean): Promise<void>;
  getCuisineVotes(groupId: string): Promise<{ memberId: string; cuisine: string; liked: boolean }[]>;
  markMemberDoneCuisineVoting(groupId: string, memberId: string): Promise<{ group: Group; member: GroupMember } | undefined>;
  setMatchedCuisines(groupId: string, winners: string[]): Promise<void>;
  clearRestaurantCache(groupId: string): Promise<void>;
```

**Step 4: Implement the methods**

Add these methods inside `class DbStorage` (before the closing brace, after `getRestaurantCountForGroup`):
```ts
  async setCuisineDeck(groupId: string, deck: string[]): Promise<void> {
    await db.update(anonymousGroups).set({ cuisineDeck: deck }).where(eq(anonymousGroups.id, groupId));
  }

  async recordCuisineVote(groupId: string, memberId: string, cuisine: string, liked: boolean): Promise<void> {
    await db.insert(anonymousGroupCuisineVotes)
      .values({ groupId, memberId, cuisine, liked })
      .onConflictDoUpdate({
        target: [anonymousGroupCuisineVotes.groupId, anonymousGroupCuisineVotes.memberId, anonymousGroupCuisineVotes.cuisine],
        set: { liked, votedAt: new Date() },
      });
  }

  async getCuisineVotes(groupId: string): Promise<{ memberId: string; cuisine: string; liked: boolean }[]> {
    const rows = await db.select().from(anonymousGroupCuisineVotes).where(eq(anonymousGroupCuisineVotes.groupId, groupId));
    return rows.map(r => ({ memberId: r.memberId, cuisine: r.cuisine, liked: r.liked }));
  }

  async markMemberDoneCuisineVoting(groupId: string, memberId: string): Promise<{ group: Group; member: GroupMember } | undefined> {
    const group = await this.getGroup(groupId);
    if (!group) return undefined;
    const member = group.members.find(m => m.id === memberId);
    if (!member) return undefined;
    member.doneCuisineVoting = true;
    await this.updateGroup(groupId, group);
    return { group, member };
  }

  async setMatchedCuisines(groupId: string, winners: string[]): Promise<void> {
    await db.update(anonymousGroups).set({ matchedCuisines: winners }).where(eq(anonymousGroups.id, groupId));
  }

  async clearRestaurantCache(groupId: string): Promise<void> {
    await db.delete(restaurantCache).where(eq(restaurantCache.groupId, groupId));
  }
```

**Step 5: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep "server/storage.ts"`
Expected: no NEW errors in `server/storage.ts`.

**Step 6: Commit**

```bash
git add server/storage.ts
git commit -m "feat(server): storage methods for cuisine votes, deck, and winners"
```

---

### Task 9: `resolveCuisineRound` orchestration + `start-session` branch

**Files:**
- Modify: `server/routes.ts`

**Step 1: Add imports**

At `server/routes.ts:7`, extend the schema import to include `cuisineVoteSchema`, `cuisineTypes`, `CuisineType`:
```ts
import { insertGroupSchema, joinGroupSchema, groupPreferencesSchema, cuisineVoteSchema, cuisineTypes, persistentGroups, diningSessions, users, anonymousGroups } from "@shared/schema";
import type { WSMessage, Group, Restaurant, GroupMember, CuisineType } from "@shared/schema";
```
Add after the other imports:
```ts
import { buildCuisineDeck, resolveCuisineWinners, findUnanimousCuisine } from "./cuisine-round";
```

**Step 2: Add a seed helper + `resolveCuisineRound` near the top of `registerRoutes`** (after `sendSync`, before `app.post("/api/groups"...)` — module scope is fine too; place it as a module-level `async function` above `registerRoutes`):

```ts
// Deterministic-ish seed from groupId so the deck is stable per session.
function seedFromGroupId(groupId: string): number {
  let h = 0;
  for (let i = 0; i < groupId.length; i++) h = (Math.imul(31, h) + groupId.charCodeAt(i)) | 0;
  return h >>> 0;
}

// Compute winners, write them into preferences.cuisineTypes, flip to swiping, broadcast.
async function resolveCuisineRound(groupId: string, broadcastFn: (id: string, m: WSMessage) => void) {
  const group = await storage.getGroup(groupId);
  if (!group || !group.preferences) return;
  const memberIds = group.members.map(m => m.id);
  const votes = await storage.getCuisineVotes(groupId);
  const deck = (group.cuisineDeck as string[]) || [];
  const winners = resolveCuisineWinners(memberIds, votes, deck) as CuisineType[];

  const updatedPreferences = { ...group.preferences, cuisineTypes: winners };
  await storage.updateGroupPreferences(groupId, updatedPreferences);
  await storage.setMatchedCuisines(groupId, winners);
  await storage.clearRestaurantCache(groupId); // force a fresh fetch with new cuisines
  await storage.updateGroupStatus(groupId, "swiping");

  broadcastFn(groupId, { type: "cuisine_round_complete", winners });
  broadcastFn(groupId, { type: "status_changed", status: "swiping" });
}
```
Note: `broadcast` is defined inside `registerRoutes` scope. Simplest: define `resolveCuisineRound` *inside* `registerRoutes` so it closes over `broadcast` directly and drop the `broadcastFn` param. Prefer that; the signature above is only for clarity if you keep it module-level.

**Step 3: Branch `start-session` to enter the cuisine round**

In `app.post("/api/groups/:id/start-session"...)` (`server/routes.ts:515-557`), replace the block that sets status to swiping (`server/routes.ts:544-553`) with:
```ts
      // Clear any previous match votes
      matchVotes.delete(req.params.id);

      const cuisineEnabled = (validatedPreferences as any).cuisineRoundEnabled !== false;
      let deck: CuisineType[] = [];
      if (cuisineEnabled) {
        deck = buildCuisineDeck({
          excludeCuisines: validatedPreferences.excludeCuisines || [],
          trySomethingNew: validatedPreferences.trySomethingNew || false,
          matchedBefore: [], // v1: no prior-match hiding for cuisine deck
          seed: seedFromGroupId(req.params.id),
        });
      }

      if (cuisineEnabled && deck.length > 0) {
        await storage.setCuisineDeck(req.params.id, deck);
        // Reset any stale done-voting flags from a prior round.
        for (const m of updatedGroup.members) m.doneCuisineVoting = false;
        await storage.updateGroup(req.params.id, { ...updatedGroup, cuisineDeck: deck });
        await storage.updateGroupStatus(req.params.id, "cuisine_voting");
        broadcast(req.params.id, { type: "preferences_updated", preferences: validatedPreferences });
        broadcast(req.params.id, { type: "status_changed", status: "cuisine_voting" });
        res.json(stripLeaderToken({ ...updatedGroup, status: "cuisine_voting", cuisineDeck: deck }));
        return;
      }

      // Cuisine round disabled or empty deck → go straight to swiping (legacy behavior).
      await storage.updateGroupStatus(req.params.id, "swiping");
      broadcast(req.params.id, { type: "preferences_updated", preferences: validatedPreferences });
      broadcast(req.params.id, { type: "status_changed", status: "swiping" });
      res.json(stripLeaderToken(updatedGroup));
```

**Step 4: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep "server/routes.ts"`
Expected: no NEW errors in `server/routes.ts`.

**Step 5: Commit**

```bash
git add server/routes.ts
git commit -m "feat(server): build deck and enter cuisine_voting at start-session; resolveCuisineRound"
```

---

### Task 10: Vote + done + get-round endpoints

**Files:**
- Modify: `server/routes.ts`

**Step 1: Add the three endpoints** after the `done-swiping` route (`server/routes.ts:894`):

```ts
  // Record a cuisine vote (pre-restaurant round)
  app.post("/api/groups/:id/cuisine-vote", swipeLimiter, async (req, res) => {
    try {
      const { memberId, cuisine, liked } = cuisineVoteSchema.parse(req.body);

      if (!verifyMemberIdentity(req, req.params.id, memberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }
      const group = await storage.getGroup(req.params.id);
      if (!group) { res.status(404).json({ error: "Group not found" }); return; }
      if (!group.members.some(m => m.id === memberId)) {
        res.status(403).json({ error: "Member not in group" }); return;
      }

      await storage.recordCuisineVote(req.params.id, memberId, cuisine, liked);
      broadcast(req.params.id, { type: "cuisine_vote_made", memberId, cuisine });

      // Unanimous fast-path: if every present member liked the same cuisine, end now.
      const votes = await storage.getCuisineVotes(req.params.id);
      const memberIds = group.members.map(m => m.id);
      const unanimous = findUnanimousCuisine(memberIds, votes);
      if (unanimous) {
        broadcast(req.params.id, { type: "cuisine_match_found", cuisine: unanimous as CuisineType });
        await resolveCuisineRound(req.params.id); // closes over broadcast (see Task 9 note)
      }

      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Mark a member done with the cuisine round
  app.post("/api/groups/:id/done-cuisine-voting", async (req, res) => {
    try {
      const { memberId } = z.object({ memberId: z.string().min(1) }).parse(req.body);
      if (!verifyMemberIdentity(req, req.params.id, memberId)) {
        res.status(403).json({ error: "Session identity mismatch" });
        return;
      }
      const result = await storage.markMemberDoneCuisineVoting(req.params.id, memberId);
      if (!result) { res.status(404).json({ error: "Group or member not found" }); return; }

      broadcast(req.params.id, {
        type: "member_done_cuisine_voting",
        memberId: result.member.id,
        memberName: result.member.name,
      });

      const allDone = result.group.members.every(m => m.doneCuisineVoting);
      if (allDone && result.group.members.length > 0 && result.group.status === "cuisine_voting") {
        await resolveCuisineRound(req.params.id);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Get cuisine round state (deck, my votes, tallies) — for refresh/rejoin recovery
  app.get("/api/groups/:id/cuisine-round", async (req, res) => {
    const group = await storage.getGroup(req.params.id);
    if (!group) { res.status(404).json({ error: "Group not found" }); return; }
    const votes = await storage.getCuisineVotes(req.params.id);
    const tallies: Record<string, number> = {};
    for (const v of votes) if (v.liked) tallies[v.cuisine] = (tallies[v.cuisine] || 0) + 1;
    res.json({
      deck: group.cuisineDeck || [],
      votes,
      tallies,
      members: group.members.map(m => ({ id: m.id, name: m.name, doneCuisineVoting: m.doneCuisineVoting })),
      status: group.status,
    });
  });
```
If you kept `resolveCuisineRound` module-level with a `broadcastFn` param (Task 9), change both calls to `resolveCuisineRound(req.params.id, broadcast)`.

**Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep "server/routes.ts"`
Expected: no NEW errors.

**Step 3: Manual smoke test (server boots)**

Run: `npx tsc --noEmit >/dev/null 2>&1; echo "tsc exit: $?"` then start the dev server if a dev DB is available: `npm run dev` — confirm it boots without throwing. Stop it.

**Step 4: Commit**

```bash
git add server/routes.ts
git commit -m "feat(server): cuisine-vote, done-cuisine-voting, and cuisine-round endpoints"
```

---

### Task 11: Include deck/winners in the sync payload

**Files:**
- Modify: `server/routes.ts` (`sendSync`, `server/routes.ts:182-199`)

**Step 1:** `sendSync` already sends the full `group` object via `stripLeaderToken(group)`. Since `dbRowToGroup` now hydrates `cuisineDeck`/`matchedCuisines` (Task 8), the sync payload carries them automatically. Confirm no change needed by checking `stripLeaderToken` only removes `leaderToken`.

Run: `grep -n "stripLeaderToken" server/routes.ts | head -1`
Expected: confirms it only strips the token. No code change; note in commit if adjustments were required.

**Step 2:** No commit unless a change was needed.

---

## Phase 4: Client

### Task 12: `CuisineCard` component

**Files:**
- Create: `client/src/components/cuisine-card.tsx`

**Step 1: Create the component** (drag mechanics mirror `swipe-card.tsx`; gradient + emoji body instead of photos):

```tsx
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { X, Flame } from "lucide-react";
import type { CuisineType } from "@shared/schema";
import { isNative } from "@/lib/platform";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { CUISINE_VISUALS } from "@/lib/cuisine-visuals";

export type CuisineSwipeAction = "like" | "dislike";

interface CuisineCardProps {
  cuisine: CuisineType;
  onSwipe: (action: CuisineSwipeAction) => void;
  isTop: boolean;
}

export function CuisineCard({ cuisine, onSwipe, isTop }: CuisineCardProps) {
  const [exitX, setExitX] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-22, 22]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  const v = CUISINE_VISUALS[cuisine];

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 100) {
      setExitX(300);
      if (isNative()) Haptics.impact({ style: ImpactStyle.Medium });
      onSwipe("like");
    } else if (info.offset.x < -100) {
      setExitX(-300);
      if (isNative()) Haptics.impact({ style: ImpactStyle.Light });
      onSwipe("dislike");
    }
  };

  if (!isTop) {
    return (
      <Card className="absolute inset-0 overflow-hidden border-0"
        style={{ background: `linear-gradient(160deg, ${v.from}, ${v.to})` }} />
    );
  }

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      animate={{ x: exitX }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Card className="relative h-full overflow-hidden border-0 shadow-2xl flex flex-col justify-end p-6 text-white"
        style={{ background: `linear-gradient(160deg, ${v.from}, ${v.to})` }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

        <motion.div className="absolute top-8 left-8 z-10" style={{ opacity: nopeOpacity }}>
          <div className="flex items-center gap-2 px-5 py-2 border-4 border-white/90 rounded-xl rotate-[-18deg] bg-black/20 backdrop-blur-sm">
            <X className="w-7 h-7" />
            <span className="text-3xl font-extrabold">NOPE</span>
          </div>
        </motion.div>
        <motion.div className="absolute top-8 right-8 z-10" style={{ opacity: likeOpacity }}>
          <div className="flex items-center gap-2 px-5 py-2 border-4 border-white/90 rounded-xl rotate-[18deg] bg-black/20 backdrop-blur-sm">
            <Flame className="w-7 h-7" />
            <span className="text-3xl font-extrabold">YUM!</span>
          </div>
        </motion.div>

        <div className="absolute top-[16%] left-0 right-0 text-center text-[88px] drop-shadow-[0_8px_12px_rgba(0,0,0,0.35)] select-none">
          {v.emoji}
        </div>

        <div className="relative z-10">
          <h2 className="text-4xl font-extrabold mb-1" data-testid="text-cuisine-name">{cuisine}</h2>
          <p className="text-sm text-white/90 mb-3">{v.tagline}</p>
          <div className="flex flex-wrap gap-2">
            {v.dishes.map(d => (
              <span key={d} className="text-xs font-medium bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">{d}</span>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
```

**Step 2: Create the visuals lookup**

Create `client/src/lib/cuisine-visuals.ts` with all 20 entries from the design doc's card table:
```ts
import type { CuisineType } from "@shared/schema";

export interface CuisineVisual { emoji: string; from: string; to: string; tagline: string; dishes: string[]; }

export const CUISINE_VISUALS: Record<CuisineType, CuisineVisual> = {
  "Burger":         { emoji: "🍔", from: "#F9A825", to: "#BF5F1F", tagline: "Stacked patties & crispy fries", dishes: ["Cheeseburger", "Fries", "Shakes"] },
  "Pizza":          { emoji: "🍕", from: "#EF6C00", to: "#FDD835", tagline: "Slices, pies & melty cheese", dishes: ["Pepperoni", "Margherita", "Calzone"] },
  "Mexican":        { emoji: "🌮", from: "#E65100", to: "#43A047", tagline: "Tacos, al pastor & fresh lime", dishes: ["Tacos", "Burritos", "Guac"] },
  "BBQ":            { emoji: "🍖", from: "#4E342E", to: "#FF6F00", tagline: "Low & slow smoked everything", dishes: ["Brisket", "Ribs", "Pulled Pork"] },
  "Italian":        { emoji: "🍝", from: "#C62828", to: "#F9A825", tagline: "Pasta, wood-fired & la dolce vita", dishes: ["Pasta", "Lasagna", "Risotto"] },
  "Chinese":        { emoji: "🥡", from: "#D32F2F", to: "#FF8F00", tagline: "Dumplings, noodles & wok-fire", dishes: ["Dumplings", "Lo Mein", "Fried Rice"] },
  "Sushi":          { emoji: "🍣", from: "#263238", to: "#26C6DA", tagline: "Nigiri, rolls & omakase", dishes: ["Nigiri", "Rolls", "Sashimi"] },
  "American":       { emoji: "🍗", from: "#1565C0", to: "#E53935", tagline: "Comfort classics & diner faves", dishes: ["Wings", "Mac & Cheese", "Meatloaf"] },
  "Thai":           { emoji: "🍤", from: "#00897B", to: "#7CB342", tagline: "Pad thai, curry & thai basil", dishes: ["Pad Thai", "Green Curry", "Tom Yum"] },
  "Japanese":       { emoji: "🍱", from: "#37474F", to: "#EC407A", tagline: "Ramen, tempura & izakaya vibes", dishes: ["Ramen", "Tempura", "Katsu"] },
  "Indian":         { emoji: "🍛", from: "#F57C00", to: "#C2185B", tagline: "Curry, naan & tandoori heat", dishes: ["Tikka Masala", "Naan", "Biryani"] },
  "Mediterranean":  { emoji: "🫒", from: "#0277BD", to: "#9CCC65", tagline: "Mezze, grilled fish & olive oil", dishes: ["Falafel", "Hummus", "Kebabs"] },
  "Korean":         { emoji: "🍲", from: "#B71C1C", to: "#FF7043", tagline: "KBBQ, bibimbap & banchan", dishes: ["KBBQ", "Bibimbap", "Kimchi"] },
  "Vietnamese":     { emoji: "🍜", from: "#2E7D32", to: "#FDD835", tagline: "Pho, banh mi & fresh herbs", dishes: ["Pho", "Banh Mi", "Spring Rolls"] },
  "Greek":          { emoji: "🥙", from: "#1976D2", to: "#64B5F6", tagline: "Gyros, souvlaki & feta", dishes: ["Gyros", "Souvlaki", "Spanakopita"] },
  "Middle Eastern": { emoji: "🧆", from: "#6D4C41", to: "#FFB300", tagline: "Falafel, shawarma & hummus", dishes: ["Shawarma", "Falafel", "Kebab"] },
  "French":         { emoji: "🥐", from: "#283593", to: "#EF9A9A", tagline: "Bistro classics & buttery everything", dishes: ["Croissant", "Coq au Vin", "Crêpes"] },
  "Spanish":        { emoji: "🥘", from: "#C62828", to: "#FBC02D", tagline: "Paella, tapas & sangria", dishes: ["Paella", "Tapas", "Churros"] },
  "Seafood":        { emoji: "🦞", from: "#01579B", to: "#4DD0E1", tagline: "Fresh catch, oysters & raw bar", dishes: ["Lobster", "Oysters", "Ceviche"] },
  "Steakhouse":     { emoji: "🥩", from: "#3E2723", to: "#D84315", tagline: "Prime cuts & classic sides", dishes: ["Ribeye", "Filet", "Creamed Spinach"] },
};
```

**Step 3: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "cuisine-card|cuisine-visuals"`
Expected: no errors.

**Step 4: Commit**

```bash
git add client/src/components/cuisine-card.tsx client/src/lib/cuisine-visuals.ts
git commit -m "feat(client): CuisineCard component and cuisine visuals lookup"
```

---

### Task 13: `CuisineVotePage` + route

**Files:**
- Create: `client/src/pages/cuisine-vote.tsx`
- Modify: `client/src/App.tsx`

**Step 1: Create the page.** It must:
- Read `memberId` from `localStorage.getItem("grubmatch-member-id")` (same as swipe page).
- `useQuery(["/api/groups", id, "cuisine-round"])` to load `{ deck, votes, tallies, members, status }`.
- Filter the deck to cards this member hasn't voted on yet (from `votes`), render top card with `CuisineCard`.
- On swipe: `POST /api/groups/:id/cuisine-vote` `{ memberId, cuisine, liked }`; advance index.
- When the local deck is exhausted: `POST /api/groups/:id/done-cuisine-voting` `{ memberId }` and show a "waiting for others" state.
- Open a WebSocket (copy the connect/reconnect block from `swipe.tsx:117-242`), handling:
  - `cuisine_vote_made` → bump a local tally for progress display.
  - `member_done_cuisine_voting` → toast + mark member done.
  - `cuisine_match_found` → show the winner takeover with `cuisine`.
  - `cuisine_round_complete` → set winners, then when `status_changed` → `swiping` arrives, `setLocation("/group/:id/swipe")`.
  - `status_changed` with `swiping` → navigate to swipe page.
- Reuse `MemberAvatars` for the member row and the canvas-confetti pattern from `swipe.tsx:161-184` for the winner moment.

Skeleton (fill in following swipe.tsx conventions):
```tsx
import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CuisineCard, type CuisineSwipeAction } from "@/components/cuisine-card";
import { MemberAvatars } from "@/components/member-avatars";
import { CUISINE_VISUALS } from "@/lib/cuisine-visuals";
import { isNative } from "@/lib/platform";
import confetti from "canvas-confetti";
import type { CuisineType, Group } from "@shared/schema";

export default function CuisineVotePage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const memberId = localStorage.getItem("grubmatch-member-id");
  const [deck, setDeck] = useState<CuisineType[]>([]);
  const [index, setIndex] = useState(0);
  const [winner, setWinner] = useState<CuisineType | null>(null);
  const [doneVoting, setDoneVoting] = useState(false);

  const { data: round } = useQuery<{ deck: CuisineType[]; votes: { memberId: string; cuisine: string }[] }>({
    queryKey: ["/api/groups", params.id, "cuisine-round"],
    enabled: !!params.id,
  });

  useEffect(() => {
    if (!round) return;
    const mine = new Set(round.votes.filter(v => v.memberId === memberId).map(v => v.cuisine));
    setDeck(round.deck.filter(c => !mine.has(c)));
    setIndex(0);
  }, [round, memberId]);

  // ... WebSocket effect copied/adapted from swipe.tsx, handling the 4 cuisine messages + status_changed ...

  const handleSwipe = async (cuisine: CuisineType, action: CuisineSwipeAction) => {
    await apiRequest("POST", `/api/groups/${params.id}/cuisine-vote`, {
      memberId, cuisine, liked: action === "like",
    });
    const next = index + 1;
    setIndex(next);
    if (next >= deck.length) {
      await apiRequest("POST", `/api/groups/${params.id}/done-cuisine-voting`, { memberId });
      setDoneVoting(true);
    }
  };

  // ... render: winner takeover if winner; else the card stack + progress dots + MemberAvatars + buttons;
  //     else "waiting for others" if doneVoting ...
}
```

**Step 2: Register the route**

In `client/src/App.tsx`, add the import near other page imports and a route before `/group/:id/swipe` (`client/src/App.tsx:137`):
```tsx
      <Route path="/group/:id/cuisine-vote" component={CuisineVotePage} />
```
Add the lazy/normal import matching how `SwipePage` is imported.

**Step 3: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "cuisine-vote|App.tsx"`
Expected: no NEW errors.

**Step 4: Commit**

```bash
git add client/src/pages/cuisine-vote.tsx client/src/App.tsx
git commit -m "feat(client): cuisine vote page and route"
```

---

### Task 14: Route into the round from preferences & lobby

**Files:**
- Modify: `client/src/pages/preferences.tsx:262-265`
- Modify: `client/src/pages/group-lobby.tsx:87-91,164-167`

**Step 1: Preferences — route on returned status**

In `saveMutation.onSuccess` (`preferences.tsx:262-265`), use the response to decide:
```ts
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", params.id] });
      if (data?.status === "cuisine_voting") {
        setLocation(`/group/${params.id}/cuisine-vote`);
      } else {
        setLocation(`/group/${params.id}/swipe`);
      }
    },
```
(`mutationFn` already `return response.json()`, so `data` is the stripped group.)

**Step 2: Lobby — navigate non-hosts into the round**

In the status effect (`group-lobby.tsx:87-91`), extend:
```ts
  useEffect(() => {
    if (!params.id) return;
    if (group?.status === "cuisine_voting") setLocation(`/group/${params.id}/cuisine-vote`);
    else if (group?.status === "swiping") setLocation(`/group/${params.id}/swipe`);
  }, [group?.status, params.id, setLocation]);
```
And in the `status_changed` WS handler (`group-lobby.tsx:164-167`):
```ts
        } else if (message.type === "status_changed") {
          if (message.status === "cuisine_voting") setLocation(`/group/${params.id}/cuisine-vote`);
          else if (message.status === "swiping") setLocation(`/group/${params.id}/swipe`);
```

**Step 3: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -E "preferences.tsx|group-lobby.tsx"`
Expected: no NEW errors.

**Step 4: Commit**

```bash
git add client/src/pages/preferences.tsx client/src/pages/group-lobby.tsx
git commit -m "feat(client): route into cuisine_voting from preferences and lobby"
```

---

### Task 15: Preferences toggle + hide Cravings when enabled

**Files:**
- Modify: `client/src/pages/preferences.tsx`

**Step 1: Default the form field.** Ensure `cuisineRoundEnabled` is in `defaultValues` (default `true`) and in the reset-from-prefs effect (`preferences.tsx:150-158` area). Add `cuisineRoundEnabled: prefs.cuisineRoundEnabled ?? true` where other prefs are hydrated.

**Step 2: Add the toggle UI.** Add a "Round 1" section near the top of the form (above the Cravings section at `preferences.tsx:631`), using the existing `Switch`/section components already imported on the page. Bind it to `form` field `cuisineRoundEnabled` with label "🗳️ Cuisine vote first" and helper text "Everyone swipes on cuisines before restaurants load."

**Step 3: Hide the Cravings multi-select when enabled.** Wrap the Cravings `SectionHeader` + body (`preferences.tsx:631-` block) in `{!form.watch("cuisineRoundEnabled") && ( ... )}`. Keep Exclusions always visible.

**Step 4: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep "preferences.tsx"`
Expected: no NEW errors.

**Step 5: Commit**

```bash
git add client/src/pages/preferences.tsx
git commit -m "feat(client): cuisine-round toggle hides manual Cravings picker"
```

---

### Task 16: Analytics for cuisine votes (optional-but-cheap)

**Files:**
- Modify: `client/src/pages/cuisine-vote.tsx`

**Step 1:** In `handleSwipe`, after a successful like, fire an analytics event through the existing batch mechanism used in `swipe.tsx` (`useAnalytics` / `trackSwipe`). If wiring `useAnalytics` for cuisines is non-trivial, skip and leave a `// TODO` — server-side `getCuisineDemand` already reads `analytics_events`, which restaurant swipes populate.

**Step 2: Commit** (only if changed)
```bash
git add client/src/pages/cuisine-vote.tsx
git commit -m "feat(client): log cuisine vote analytics events"
```

---

## Phase 5: Verify

### Task 17: Full test + type check

**Step 1:** Run the full suite.
Run: `npx vitest run`
Expected: PASS — baseline count + new `cuisine-round.test.ts` tests.

**Step 2:** Type check vs. baseline.
Run: `npx tsc --noEmit 2>&1 | tail -1`
Expected: error count ≤ the Task 0 baseline (no new errors in files we touched).

### Task 18: Manual multi-member walkthrough

**Step 1:** With a dev DB configured, run `npm run dev`. In two browser windows (or one + incognito):
- Create a group, join as a second member.
- Host sets preferences with "Cuisine vote first" ON → both windows land on `/cuisine-vote`.
- Both like the same cuisine → confetti + auto-advance to `/swipe`; restaurants reflect that cuisine.
- Repeat with the toggle OFF → both go straight to `/swipe` (legacy behavior).
- Repeat with mismatched votes → round ends when both finish; most-liked cuisine wins.

**Step 2:** Verify refresh mid-round restores position (reload the vote page; already-voted cards don't reappear).

### Task 19: Native build (only if shipping to devices this cycle)

**Step 1:** `npm run build:client` (note: ~20 min on this machine per project memory).
**Step 2:** `npx cap sync ios`.
**Step 3:** Smoke-test in the simulator. Not required for a web-only deploy.

### Task 20: Finish the branch

Use superpowers:finishing-a-development-branch to open a PR against `main` (or merge per the repo's flow). Ensure the migration `0003_cuisine_voting.sql` is called out in the PR description so it runs on deploy. Per project memory, the Render deploy branch is `claude/migration-test-vtpVZ` — coordinate before merging there.

---

## Notes & risks

- **`resolveCuisineRound` scope:** define it inside `registerRoutes` so it closes over `broadcast`; if module-level, thread `broadcast` in. Pick one and keep both call sites consistent (Tasks 9 & 10).
- **Upsert requires the unique index** `agcv_unique_idx` (Task 3) — without it `onConflictDoUpdate` throws. Verify the migration ran.
- **Deck stored twice** (dedicated column via `setCuisineDeck` and inside the group update) — harmless; the column is the source of truth read by `getCuisineVotes`/round endpoints.
- **Solo sessions:** unanimous fast-path fires on the single member's first like — that's intended (fast personal filter).
- **Backwards compatible:** all new DB columns are nullable; existing sessions and the toggle-off path are unchanged.
