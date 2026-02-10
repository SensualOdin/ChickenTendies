
# ChickenTinders: Analytics & Monetization Strategy

**Version:** 1.0  
**Status:** Draft  
**Objective:** Transition from utility app to data-driven revenue platform.

---

## 1. Executive Summary

ChickenTinders currently solves a social problem ("Where should we eat?"). By instrumenting the application to capture user *intent* (swipes) rather than just *results* (matches), we create a proprietary dataset of real-time local dining demand.

**The Value Proposition:**
* **To Users:** Smarter recommendations based on past behavior.
* **To Restaurants:** Hyper-local, high-intent advertising (e.g., "Show my card to people looking for Tacos within 5 miles right now").

---

## 2. Technical Implementation: The "Intent Engine"

We must log the decision-making process, not just the final outcome.

### 2.1 Database Schema (Drizzle ORM)
*Add this to `db/schema.ts`. This table is write-heavy and read-heavy for analytics.*

```typescript
import { pgTable, serial, text, integer, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';

export const analyticsEvents = pgTable('analytics_events', {
  id: serial('id').primaryKey(),
  userId: text('user_id'),           // Hashed ID for privacy compliance
  sessionId: text('session_id'),     // To analyze group dynamics
  restaurantId: text('restaurant_id').notNull(), // Yelp ID
  restaurantName: text('restaurant_name'),       // Denormalized for faster queries

  // The User's Decision
  action: text('action').notNull(),  // Enum: 'swipe_left', 'swipe_right', 'super_like', 'click_details'

  // Context at Moment of Swipe (The "Gold")
  cuisineTags: jsonb('cuisine_tags'), // e.g. ["Mexican", "Tacos"]
  priceRange: text('price_range'),    // e.g. "$$"
  distanceMiles: integer('distance_miles'), 
  userLat: text('user_lat'),          // Truncate to 3 decimal places for privacy
  userLng: text('user_lng'), 

  // Timing
  dayOfWeek: integer('day_of_week'),  // 0-6 (Sun-Sat)
  hourOfDay: integer('hour_of_day'),  // 0-23
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => {
  return {
    cuisineIdx: index('cuisine_idx').on(table.cuisineTags),
    geoIdx: index('geo_idx').on(table.userLat, table.userLng),
    restIdx: index('rest_idx').on(table.restaurantId),
  };
});

2.2 Frontend Event Tracking
Add to components/SwipeCard.tsx. Batch events to save battery/bandwidth.
 * Trigger: onSwipe callback from Framer Motion.
 * Payload:
   * Restaurant ID
   * Action (Left/Right)
   * Time of day
   * Current location
3. Data Aggregation: The Sales Pitch
These SQL queries generate the numbers you will put on your sales decks.
Query A: The "Missed Opportunity" Report
Used to sell a restaurant on why they need your service.
-- "How many people saw your card but swiped LEFT?"
SELECT 
  count(*) as lost_customers,
  price_range 
FROM analytics_events
WHERE 
  restaurant_id = 'target-restaurant-id'
  AND action = 'swipe_left'
  AND created_at > NOW() - INTERVAL '30 days';

Query B: The "Category Demand" Report
Used to show total market size in a specific zip code.
-- "Total demand for Chinese food in McKinney"
SELECT 
  count(DISTINCT user_id) as unique_users,
  count(*) as total_right_swipes
FROM analytics_events 
WHERE 
  cuisine_tags ? 'Chinese' 
  AND user_lat BETWEEN '33.1' AND '33.3' 
  AND action IN ('swipe_right', 'super_like');

4. Monetization Models
Model A: Sponsored Swipes (Ad Network)
Mechanism: Inject paid restaurant cards into the top of the stack.
 * Pricing: CPM (Cost Per Mille/Thousand views) or Flat Monthly Fee.
 * Logic: If UserLocation is inside SponsorRadius, insert SponsorCard at Index 1.
 * Tech: Add isSponsored: true flag to restaurant objects.
Model B: Restaurant Dashboard (SaaS)
Mechanism: B2B portal for owners to view analytics.
 * Pricing: $29 - $49 / month.
 * Features:
   * Competitor Benchmarking: "You rank #4 for Italian in this zip code."
   * Heatmaps: "Your potential customers live in these neighborhoods."
   * A/B Testing: "Photo A got 20% more right swipes than Photo B."
Model C: Affiliate Commission (Low Hanging Fruit)
Mechanism: Earn cash on the "Go Eat" action.
 * Delivery: Use DoorDash/UberEats Affiliate APIs. (~$5 per new user).
 * Reservations: Use OpenTable/Resy Affiliate links. (~$1 per cover).
5. Implementation Roadmap
Phase 1: Data Foundation (Weeks 1-2)
 * [ ] Create analytics_events table in Postgres.
 * [ ] Implement useAnalytics hook on frontend.
 * [ ] Verify data accuracy (Location lat/lng and timestamps).
 * [ ] Milestone: First 1,000 events logged.
Phase 2: Validation (Weeks 3-4)
 * [ ] Run "Category Demand" queries for top 3 cuisines in your area.
 * [ ] Create a "State of Dining in McKinney" PDF 1-pager.
 * [ ] Show 1-pager to 5 local restaurant owners to gauge interest.
Phase 3: Monetization (Month 2)
 * [ ] Build "Claim My Business" page.
 * [ ] Replace standard DoorDash links with Affiliate links.
 * [ ] Launch "Sponsored Card" injection logic.
6. Privacy & Legal Note
 * Transparency: Update Privacy Policy to state that anonymized usage data is collected for analytics.
 * Anonymity: Never sell user_id or PII (Personally Identifiable Information). Sell aggregates ("500 people") or segments ("Users who like Tacos").


