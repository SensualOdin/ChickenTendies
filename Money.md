# ChickenTinders Monetization Plan
Date: February 13, 2026 (revised)

## 1. Revenue Target and Strategy

## Prerequisite: Prove retention before monetizing
No monetization work begins until the app has demonstrated real, repeatable usage. Specifically:
1. `50+` crews completing at least `1` session per week for `4` consecutive weeks.
2. Week-4 crew retention `>=30%` (crews active in week 4 / crews created in week 1).
3. Anonymous group-to-persistent crew conversion rate measured and `>=10%`.

If these thresholds are not met, all effort stays on product and growth until they are.

## Target by February 2027
1. Reach `$5,000–$10,000 MRR` (revised from $15K to reflect solo-dev capacity and unproven traction).
2. Keep revenue mix balanced:
3. `65–75%` subscriptions (primary focus).
4. `15–25%` affiliate/referral revenue.
5. `5–10%` sponsored placements (opportunistic, not a core driver yet).
6. Keep CAC payback under `3 months`.

## Core strategy
1. **Prove retention first** — no one pays for an app they don't use weekly.
2. **Fix critical infrastructure** — anonymous groups can't live in memory if you're building a business.
3. Monetize consumers first with a strong premium tier.
4. Add lightweight transactional monetization in existing match flows.
5. Defer local-restaurant B2B monetization until `1,000+` active crews generate meaningful data.
6. Build on current strengths:
7. Persistent crews and sessions.
8. Match actions page with clear intent.
9. Existing analytics event pipeline.
10. Push notifications and re-engagement hooks.

---

## 2. Monetization Lanes (Prioritized)

## Lane A: `Crew Pro` subscription (launch first)
## Offer
1. Free plan remains fully usable for growth — never gate core swiping or matching.
2. Pro unlocks convenience, coordination, and capacity features.

## Suggested packaging
| Plan | Price | Who pays | Core value |
|---|---:|---|---|
| Free | $0 | Everyone | Core swiping/matching, crews up to 4 members, 1 active session |
| Crew Pro Monthly | $7.99/mo | Organizer | Bigger crews, multiple sessions, less friction |
| Crew Pro Annual | $59/yr | Organizer | 38% discount, better retention |

## Pro features to gate (strengthened)

**Capacity limits (proven freemium levers):**
1. Crews larger than `4` members (free cap at 4, Pro unlimited).
2. Multiple concurrent active sessions per crew (free: 1 at a time).
3. More than `3` saved crews (free cap at 3).

**Convenience and coordination:**
4. "Exclude visited restaurants" automation.
5. Match history beyond last `5` sessions.
6. Advanced preference presets and saved crew profiles.
7. Priority reminders and "everyone done" smart nudges.
8. Export/share dining history summaries.

**Premium decision tools:**
9. Tie-break tools after matching (re-vote, weighted preferences).
10. AI-powered restaurant suggestions based on crew swipe history.
11. Scheduling integration (suggest times when crew is free).

## Why this first
1. Fastest path to recurring revenue.
2. Capacity limits create natural upgrade pressure without degrading core UX.
3. Uses features and data the app already has or can build quickly.
4. Minimal partner dependency.

---

## Lane B: Affiliate/partner actions on match outcome
## Offer
1. Track outbound conversions on:
2. "Get directions"
3. "Reserve"
4. "Order delivery"
5. "Ride there"

## Starting partner path
1. Uber affiliate (official acquisition-focused affiliate flow).
2. Test reservation/ordering partners where your audience is strongest.
3. Use partner-by-city routing (example: different links by market).

## Monetization model
1. CPA/CPL from affiliate partner.
2. Start with fixed partner links.
3. Move to deep links + postback attribution once volume exists.

---

## Lane C: Sponsored restaurant placements (deferred — revisit at 1,000+ active crews)

**Why deferred:** Selling sponsored placements to local restaurants is a B2B sales motion that requires dedicated time, account management, and enough user volume to deliver meaningful impressions. At current scale, the effort-to-revenue ratio is too high.

## Trigger to activate this lane
1. `1,000+` monthly active crews.
2. Lane A subscription revenue is stable and growing.
3. At least `5` inbound restaurant inquiries received organically.

## Offer (when activated)
1. Sponsored card placement in swipe feed.
2. Sponsored rank in match recommendation section.
3. Timeboxed local campaign packages.

## Initial pricing (when activated)
| Package | Price | Deliverable |
|---|---:|---|
| Starter | $99/week | 1 sponsored placement + basic report |
| Growth | $299/month | Multi-slot exposure + weekly report |
| Premium | $599/month | Priority placement + conversion dashboard |

## Rules
1. Always label as `Sponsored`.
2. Keep organic relevance controls (rating/distance caps).
3. Add simple frequency cap per user.

---

## Lane D: Restaurant insights dashboard (deferred — revisit at 2,000+ active crews)

**Why deferred:** This is effectively a separate B2B SaaS product. Building a dashboard, running outbound sales at 50 restaurants/week, managing accounts, and generating reports requires either a co-founder focused on sales or hired SDRs. Do not attempt this as a solo dev until consumer revenue covers the cost of hiring help.

## Trigger to activate this lane
1. `2,000+` monthly active crews.
2. Subscription MRR covers operating costs.
3. Budget or co-founder available for B2B sales.

## Offer (when activated)
1. Sell demand analytics to restaurants using first-party app behavior:
2. Cuisine demand by day/time.
3. Approval rate trends.
4. Neighborhood-level intent clusters.
5. Crew revisit probability.
6. Campaign impact for sponsored placements.

## Suggested pricing (when activated)
| Tier | Price | Includes |
|---|---:|---|
| Insights Basic | $149/location/mo | Weekly reports + dashboard |
| Insights Pro | $299/location/mo | Campaign analytics + benchmarks |

## Important
1. Use first-party event data for monetized analytics.
2. Do not build this from provider content in restricted ways.

---

## 3. Growth and Distribution Plan

**This section is critical.** Monetization only works if people use the app. All growth efforts run in parallel with (and often before) monetization work.

## Launch city strategy
1. Pick `1` city/metro to saturate first (ideally where you live and can hustle in person).
2. Goal: `200` active crews in launch city before expanding.
3. Expand to city 2 only after proving retention in city 1.

## Organic acquisition channels
1. **College campuses:** Friend groups deciding where to eat is a daily problem. Target campus dining committees, Greek life, and dorm RAs. Flyers + QR codes + free pizza events.
2. **Office lunch groups:** Target coworking spaces and office parks. "Where should we eat?" is a 5x/week problem for work crews.
3. **Social media content:** Short-form videos (TikTok/Reels) showing real groups using the app to decide on dinner. Focus on the "reveal" moment when a match is found.
4. **App store optimization:** Optimize listing for "group restaurant picker," "where to eat with friends," "group dinner app."

## Viral/referral loops
1. **Built-in virality:** Every crew invite is an acquisition event — the invitee must download/open the app.
2. **Share match results:** After matching, one-tap share to group chat with restaurant card + app link.
3. **Crew invite rewards:** After a crew completes their first session, give the organizer credit toward Pro.
4. **Social proof prompts:** "Your crew has matched 10 times! Share your stats."

## Retention levers (keep crews coming back)
1. **Weekly nudge:** "It's Friday — time to pick a spot with [crew name]?"
2. **Streak tracking:** "Your crew has matched 4 weeks in a row!"
3. **New restaurant alerts:** "12 new restaurants added near you this week."
4. **Re-engagement for dormant crews:** Push notification after 2 weeks of inactivity.

## Growth KPIs
| Metric | Week 4 target | Week 12 target |
|---|---:|---:|
| Crews created (cumulative) | 100 | 500 |
| Weekly active crews | 50 | 200 |
| Week-4 retention | 30% | 35% |
| Viral coefficient (invites per crew) | 1.5 | 2.0 |
| Anonymous → persistent conversion | 10% | 15% |

---

## 4. Execution Roadmap (with dates — realistic timelines)

## Phase -1: Infrastructure and stability
Dates: `Feb 17, 2026 – Mar 28, 2026` (6 weeks)

## Goals
1. Fix the infrastructure that makes everything else impossible.
2. Make the app survive deploys and scale past a single server.

## Build deliverables
1. **Migrate anonymous groups from in-memory to PostgreSQL.** This is the single most critical blocker. Active sessions cannot disappear on server restart.
2. Add rate limiting on all API endpoints.
3. Add CSRF protection.
4. Fix leader token exposure (move from localStorage to HTTP-only session).
5. Add group membership verification on data endpoints.
6. Reduce geographic precision in analytics (3 decimals → 2 decimals).
7. Add basic test coverage for critical paths: match algorithm, swipe recording, WebSocket session lifecycle.

## Exit criteria
1. Anonymous groups persist across server restarts.
2. No critical security issues open.
3. Core flows have test coverage.
4. App can handle `100` concurrent sessions without degradation.

---

## Phase 0: Growth sprint and retention proof
Dates: `Mar 29, 2026 – May 9, 2026` (6 weeks)

## Goals
1. Get real users and prove they come back.
2. Hit the retention prerequisite before building any monetization.

## Build deliverables
1. Implement viral/referral loops (share match results, crew invite flow improvements).
2. Add weekly re-engagement push notifications.
3. Add activation and retention event tracking.
4. Add monetization-ready events:
5. `paywall_viewed`
6. `upgrade_clicked`
7. `checkout_started`
8. `checkout_completed`
9. `partner_link_clicked`
10. Build onboarding flow improvements to drive anonymous → persistent crew conversion.

## Growth deliverables
1. Launch in target city — pick one campus or neighborhood.
2. Create and distribute launch content (social posts, flyers, QR codes).
3. Run `3` in-person "lunch roulette" events to seed initial crews.

## Exit criteria
1. `50+` crews active weekly for `4` consecutive weeks.
2. Week-4 crew retention `>=30%`.
3. Activation funnel (crew created → first session completed) measured.
4. Baseline metrics established for monetization funnel.

---

## Phase 1: Ship `Crew Pro`
Dates: `May 10, 2026 – Jul 4, 2026` (8 weeks, extended from 6)

## Goals
1. Turn free active users into first recurring revenue.
2. Validate willingness to pay.

## Build deliverables
1. Add billing-ready account model (`plan`, `billing_status`, `renewal_at`).
2. Implement plan gating middleware and UI checks.
3. Add billing provider (Stripe) checkout + webhook lifecycle.
4. Implement free-tier capacity limits (crew size cap at 4, 1 active session, 3 saved crews).
5. Add in-app paywall triggers:
6. Creating a crew with 5+ members.
7. Starting a second concurrent session.
8. Accessing history beyond 5 sessions.
9. Enabling "exclude visited" automation.
10. Run A/B test on pricing:
11. Variant A: `$6.99/mo`
12. Variant B: `$7.99/mo`
13. Launch annual plan after 2 weeks of stable conversions.

## Growth deliverables
1. Add in-product upgrade prompts in dashboard, matches, and history.
2. Add referral incentive for organizers (`1 free month per paid referral`).
3. Continue city-level growth efforts in parallel.

## Exit criteria
1. `>3%` free-to-paid conversion among eligible organizers.
2. Churn signal captured (cancel reasons, downgrades).
3. At least `50` paying crews (revised from 100 — be realistic about early traction).
4. Subscription MRR `>$300`.

---

## Phase 2: Transactional monetization
Dates: `Jul 5, 2026 – Sep 12, 2026` (10 weeks, extended from 6)

## Goals
1. Add non-subscription revenue without hurting UX.
2. Prove match actions can monetize.

## Build deliverables
1. Add affiliate link routing service with UTM/subid support.
2. Create partner offer slots in match cards.
3. Implement click fraud controls:
4. Session-based dedupe.
5. Basic rate limiting per user.

## Growth deliverables
1. Expand to city 2 if retention holds in city 1.
2. Double down on highest-performing acquisition channel from Phase 0.

## Exit criteria
1. Affiliate EPC positive for at least `2` partner types.
2. Monetization does not reduce core retention by more than `5%`.
3. Combined MRR (subscriptions + affiliate) trending toward target.

---

## Phase 3: Evaluate B2B readiness (not build it yet)
Dates: `Sep 13, 2026 – Oct 31, 2026` (7 weeks)

## Goals
1. Assess whether user volume justifies B2B investment.
2. Run lightweight sponsorship test without building full infrastructure.

## Deliverables
1. If `1,000+` active crews: run a `4-week` manual sponsorship pilot with `3-5` local restaurants. Use simple sponsored card injection — no dashboard, no automation. Deliver results via email PDF.
2. If `<1,000` active crews: skip B2B entirely. Focus all effort on growth and subscription optimization.
3. Assess: is there enough inbound restaurant interest to justify building Lane C/D?

## Exit criteria
1. Go/no-go decision on building sponsorship infrastructure.
2. If go: pilot renewal rate `>=30%` and clear path to `10+` restaurants.
3. If no-go: documented learnings and revised timeline for revisiting.

---

## 5. KPI Model

## North-star
1. `Weekly Active Crews` (growth phase)
2. `Paid Crews / Active Crews` (monetization phase)

## Core KPI targets by Oct 31, 2026
| KPI | Target |
|---|---:|
| Monthly active crews | 1,000 |
| Paid crew conversion | 5% |
| Paid crew ARPU | $7.50 |
| Affiliate revenue per 1,000 matches | $40+ |
| Subscription MRR | $375+ |
| Total MRR (all sources) | $500+ |

## Weekly operating metrics
1. Activation: crew created → first completed session.
2. Engagement: sessions per active crew per week.
3. Retention: crew active in week N / crew created in week N-4.
4. Monetization funnel: paywall viewed → checkout started → paid.
5. Retention: paid organizer month-2 retention.
6. Viral coefficient: new crew invites sent per active crew.

---

## 6. Financial Scenario (Monthly — corrected math)

| Scenario | Active Crews | Paid % | Paid Crews | Sub MRR | Affiliate | Total MRR |
|---|---:|---:|---:|---:|---:|---:|
| Conservative | 500 | 4% | 20 | $150 | $50 | $200 |
| Base | 1,000 | 5% | 50 | $375 | $125 | $500 |
| Stretch | 2,500 | 6% | 150 | $1,125 | $375 | $1,500 |
| Aggressive (Year 2) | 5,000 | 8% | 400 | $3,000 | $1,000 | $4,000 |

Assumptions:
1. Subscription ARPU blended at `$7.50`.
2. Affiliate revenue estimated at `$2.50` per 1,000 matches in early stage, scaling with volume.
3. Sponsorship revenue excluded until B2B lane is activated.
4. These are solo-dev, organic-growth numbers. Fundraising or a co-founder changes the math significantly.

---

## 7. Compliance and Platform Guardrails (Must-follow)

## Yelp constraints (affects product design)
1. Yelp Places API content caching is limited to `24 hours`.
2. Yelp Business IDs can be stored indefinitely.
3. Yelp FAQ states analysis is not permitted for Places integrations.
4. Product implication: monetize analytics from your own user behavior events, not by retaining restricted provider content.

## Google Maps/Places constraints
1. March 2025 pricing model moved to free usage caps by SKU.
2. Caching restrictions apply broadly; Place ID is specifically cacheable indefinitely.
3. Product implication: store provider place IDs and your own derived metrics; avoid long-lived storage of restricted content outside allowed policy.

## Partner-program eligibility constraints
1. DoorDash merchant referral payouts require the referrer to be a current DoorDash Marketplace partner.
2. OpenTable NYC referral offer is location/time-bound and currently lists validity through `March 31, 2026`.
3. Product implication: treat these as tactical channels, not core recurring business model.

---

## 8. Go-to-Market Plan

## Consumer GTM (primary focus)

### Acquisition
1. **City-by-city launch:** Saturate one market before expanding.
2. **Campus seeding:** Partner with student orgs, Greek life, dorm RAs. Run "lunch roulette" events.
3. **Office outreach:** Target coworking spaces and office parks with flyers and QR codes.
4. **Content marketing:** Weekly short-form video showing real groups using the app. Focus on the match reveal moment.
5. **App store optimization:** Target "group restaurant picker," "where to eat with friends," "dinner with friends app."

### Conversion (free → paid)
1. Upgrade prompts at moments of highest intent:
2. Right after first successful match.
3. When trying to create a 5th crew member.
4. When starting a second concurrent session.
5. When opening history beyond 5 sessions.
6. When turning on "exclude visited."

### Referral loop
1. Organizer gets `1 free month` for first successful paid referral.
2. Crew members get onboarding discount.
3. Match result sharing includes app download link for non-users.

## B2B GTM (deferred until trigger criteria met)
1. Local vertical launch city-by-city — only in cities with `500+` active crews.
2. Start with inbound interest, not outbound cold outreach.
3. "No setup fee, 30-day pilot" offer.
4. Publish `2` case studies with hard numbers before scaling outbound.

---

## 9. First 30 Days Action Checklist (starting now)

**Week 1-2: Infrastructure**
1. Migrate anonymous groups from in-memory (MemStorage) to PostgreSQL.
2. Add rate limiting on all API endpoints.
3. Fix leader token exposure.

**Week 3-4: Security and stability**
4. Add CSRF protection.
5. Add group membership verification on data endpoints.
6. Add basic test coverage for match algorithm and swipe recording.
7. Reduce geographic precision in analytics data.

**Week 5-6: Growth prep**
8. Improve anonymous → persistent crew conversion flow.
9. Add crew invite sharing improvements (deep links, social sharing).
10. Add activation and retention event tracking.
11. Pick launch city and plan first seeding event.

---

## 10. Decision Rules (to avoid drifting)

### Growth phase
1. If week-4 crew retention `<20%` after 8 weeks of effort, pause everything and fix the core product loop before continuing.
2. If anonymous → persistent conversion `<5%`, redesign the conversion prompt before adding more features.
3. If viral coefficient `<1.0`, invest in share/invite flow improvements before paid acquisition.

### Monetization phase
4. If paid conversion `<2.5%` after 6 weeks, rework the value proposition and Pro feature set before scaling.
5. If monetization hurts session completion by `>5%`, roll back intrusive placements immediately.
6. If churn `>15%` monthly on paid plans, the Pro features aren't sticky enough — add more value before acquiring more subscribers.

### B2B phase (when activated)
7. If sponsorship CTR `<1%`, reduce inventory and improve relevance.
8. If B2B close rate `<10%` from demos, simplify package and pricing.

---

## Sources
1. Yelp Places FAQ: https://docs.developer.yelp.com/docs/places-faq
2. Yelp Places rate limiting: https://docs.developer.yelp.com/docs/places-rate-limiting
3. Google Maps Platform March 2025 changes: https://developers.google.com/maps/billing-and-pricing/march-2025
4. Google Maps pricing overview: https://developers.google.com/maps/billing-and-pricing/overview
5. Google Maps JS API policies (caching/Place ID): https://developers.google.com/maps/documentation/javascript/policies
6. Google Maps Platform Service Specific Terms: https://cloud.google.com/maps-platform/terms/maps-service-terms
7. DoorDash merchant referral program: https://merchants.doordash.com/en-us./about/merchant-referral-program
8. Uber affiliate program: https://www.uber.com/jm/en/affiliate-program/
9. OpenTable referral (NYC, validity through 03/31/2026): https://www.opentable.com/restaurant-solutions/referral/new-restaurants/
10. OpenTable Bonus Points: https://www.opentable.com/restaurant-solutions/products/extras/restaurant-promotions/
11. OpenTable plans/pricing: https://www.opentable.com/restaurant-solutions/plans/
