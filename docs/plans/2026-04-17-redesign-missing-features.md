# Redesign — Features on the Landing Page That Don't Exist Yet

Created: 2026-04-17
Context: Editorial redesign based on `ChickenTinders Redesign.html`. The design's Features bento calls out ideas that aren't implemented. Captured here so the marketing page only ships truthful claims and these can be scoped into future sprints.

## Missing features (remove from landing copy OR build)

### 1. Evolving group preferences ("killer feature" in mockup)
> "We learn what your group actually agrees on — not what you claim you like. By the fifth dinner, we know Marcus hates anything 'too saucy' and Priya will always veto Thai."

Status: **does not exist.** No ML/preference-learning logic in codebase. Group preferences are set once per session via `groupPreferencesSchema` and not persisted across sessions with learned weights.

What it would require:
- Persistent per-user taste profile (likes/dislikes per cuisine, attribute tags).
- Cross-session aggregation at the crew level.
- Scoring layer that re-ranks the shortlist before it's served.
- UI to show "your crew usually likes X."

### 2. Veto power (permanent single-user block)
> "One card, one nope. Got a place that gave you food poisoning in 2019? Veto it. It's never showing up again."

Status: **does not exist.** Left-swipe only removes the restaurant from the current session. No permanent per-user blocklist.

What it would require:
- `user_blocked_restaurants` table keyed by userId + restaurantId.
- Filter step during shortlist generation that excludes blocked places for any active member.
- Veto UI (long-press left swipe? explicit button?).

### 3. Smart radius / midpoint location
> "Everyone's location, averaged. Meeting downtown from three suburbs? We find the mid-point and search from there."

Status: **does not exist.** Current flow uses a single zip/address from the host.

What it would require:
- Collect each member's location at join (with permission prompt).
- Compute centroid / travel-time midpoint.
- Feed that lat/lng into the restaurant search instead of the host's zip.

### 4. Tiebreaker mode (weighted coin)
> "Two matches? Roll the dice. When the group lands on a tie, we flip a weighted coin. Somebody has to lose gracefully."

Status: **does not exist.** Match-voting exists in `routes.ts:734-801`, but no randomizer for multi-match resolution.

What it would require:
- Detection: >1 restaurant hit the match threshold.
- Weighting rule (by swipe score? super-likes? raw random?).
- Celebratory reveal animation.

## Features that DO exist and belong on the landing page
Keeping landing-page copy tied to these:
- **Super-like boost** — ranking-weighted (`match-logic.ts`).
- **Dietary filters** — pre-swipe (`shared/schema.ts`).
- **Restaurant history / no-repeats** — `excludeVisited` flag.
- **Saved crews** — `persistentGroups` table.
- **Streaks** — weekly streak tracking (`server/streaks.ts`).
- **Analytics** — `analytics.tsx`.
- **Anonymous-first** — no signup required for guests.

## Decision for this landing-page redesign
Replace the four missing-feature bento tiles with real, existing ones. Missing features stay on this doc as a backlog for a future sprint.
