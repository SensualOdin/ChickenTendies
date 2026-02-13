# ChickenTinders — Immediate Next Steps
Last updated: February 13, 2026

## Current phase: Phase 0 — Growth Sprint & Retention Proof
Phase -1 (Infrastructure & Stability) completed Feb 13, 2026.

## Gate to pass before any monetization work
- [ ] `50+` crews active weekly for `4` consecutive weeks
- [ ] Week-4 crew retention `>=30%`
- [ ] Anonymous → persistent crew conversion measured and `>=10%`

Until these are met, **all effort stays on product and growth**. No billing, no paywalls, no Stripe.

---

## Week 1: Growth plumbing (Feb 17 – Feb 21)

### 1. Anonymous → persistent crew conversion flow
**Priority: Highest** — this is the biggest leaky bucket.
- [ ] After first match in an anonymous group, prompt users to create an account and save their crew.
- [ ] Show what they'd lose by not converting: match history, crew name, re-engagement nudges.
- [ ] Track conversion rate: `anonymous_conversion_prompted` → `anonymous_conversion_completed`.

### 2. Share match results
**Priority: Highest** — every share is a potential new user.
- [ ] One-tap share button on the match result screen.
- [ ] Generates a shareable card (restaurant name, photo, rating) with app link.
- [ ] Targets: iMessage, WhatsApp, Instagram Stories, generic share sheet.
- [ ] Track: `match_result_shared` event with destination.

### 3. Activation & retention event tracking
**Priority: High** — you can't improve what you don't measure.
- [ ] Track key lifecycle events:
  - `crew_created`
  - `first_session_completed`
  - `return_session_day_7`
  - `return_session_day_28`
  - `anonymous_conversion_prompted`
  - `anonymous_conversion_completed`
  - `invite_sent`
  - `invite_accepted`
- [ ] Build a simple dashboard or DB query to check these weekly.

---

## Week 2: Retention hooks (Feb 24 – Feb 28)

### 4. Weekly re-engagement push notifications
**Priority: High** — push infra already exists, just need scheduled triggers.
- [ ] Friday evening nudge: "It's Friday — time to pick a spot with [crew name]?"
- [ ] Dormant crew nudge (after 2 weeks inactive): "Your crew hasn't matched in a while — start a session?"
- [ ] New restaurants alert: "12 new spots added near you this week."
- [ ] Respect opt-out. Don't spam.

### 5. Improve crew invite flow
**Priority: High** — friction here kills virality.
- [ ] Deep links that drop the invitee straight into the crew join screen.
- [ ] Pre-fill crew name and show who's already in the crew.
- [ ] Works for both logged-in users and new signups.
- [ ] Track: `invite_link_opened` → `invite_accepted` funnel.

### 6. Streak tracking
**Priority: Medium** — lightweight retention lever.
- [ ] Track consecutive weeks a crew has completed a session.
- [ ] Display streak on crew card: "4-week streak!"
- [ ] Optional: push notification when streak is about to break.

---

## Week 3–4: Launch in one city (Mar 2 – Mar 14)

### 7. Pick launch city/campus
**Priority: Critical** — go where you can show up in person.
- [ ] Choose one campus or neighborhood where you can physically hustle.
- [ ] Goal: `100` crews created, `50` active weekly by end of week 4.

### 8. Create launch content
**Priority: High**
- [ ] 30-second video of real friends using the app (focus on the match reveal moment).
- [ ] Flyers with QR code linking to the app.
- [ ] Social media posts (TikTok, Instagram Reels, Twitter).
- [ ] Simple landing page or app store listing optimized for "group restaurant picker."

### 9. Run seeding events
**Priority: High** — get the first crews in the door.
- [ ] Plan `3` in-person "lunch roulette" events at campus or coworking spaces.
- [ ] Free pizza / coffee as incentive to try the app with friends.
- [ ] Collect feedback in person — what's confusing, what's missing, what's broken.

---

## Ongoing: Weekly review

Every week, check:
- [ ] How many crews created this week?
- [ ] How many crews completed a session?
- [ ] Week-over-week retention (are last week's crews coming back)?
- [ ] Anonymous → persistent conversion rate.
- [ ] Top feedback themes from users.

Update this file as items are completed and new priorities emerge.

---

## Parking lot (do NOT start these yet)
These are Phase 1+ items. Listed here so they don't get forgotten, but resist the urge to work on them before hitting the Phase 0 gate.

- Stripe integration / billing provider
- Plan gating middleware and UI
- Free-tier capacity limits (crew size, session limits)
- Paywall triggers and A/B pricing test
- Affiliate link routing
- Sponsored placements
- Restaurant insights dashboard
