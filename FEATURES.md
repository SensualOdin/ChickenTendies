# ChickenTinders - Complete Feature Guide

## What Is ChickenTinders?

ChickenTinders is a collaborative restaurant discovery app that takes the stress out of the classic "where should we eat?" dilemma. Inspired by the swipe-based format of dating apps, ChickenTinders lets groups of friends swipe through real restaurant options together. When everyone in the group likes the same restaurant, it's a match — and dinner is decided.

The app is built as a Progressive Web App (PWA), meaning it works on any device with a browser and can be installed directly to your phone's home screen for a native app-like experience.

---

## How It Works

### Quick Play (No Account Needed)

1. **Create or Join a Party** — Start a new dining session or join one using a 6-character invite code. No sign-in required for ad-hoc sessions.
2. **Set Preferences** — The host picks the location, cuisine types, price range, dietary restrictions, and search radius.
3. **Swipe Together** — Everyone in the group swipes through restaurant cards (right to like, left to pass). The app shows real restaurants pulled from Yelp.
4. **Get Matched** — When all members like the same restaurant, it lights up as a match with celebration effects.
5. **Go Eat** — From the match screen, get directions, order delivery via DoorDash, make a reservation, add it to your calendar, or log that you visited.

### Full Experience (Signed In)

Sign in with your Replit account to unlock persistent crews, friends, dining history, achievements, push notifications, and your personal profile. All the social and long-term features require an account.

---

## Core Features

### Swipe-Based Restaurant Discovery
- Swipe right to like, left to pass on restaurant cards
- Each card shows the restaurant's photo, name, cuisine type, star rating, review count, price range, distance, and a short description
- Smooth, physics-based card animations powered by Framer Motion
- Swipe buttons also available for tap-based interaction (like, dislike, super-like)

### Super Likes
- Give a restaurant an extra boost by using a super-like (star button)
- Super-likes can trigger a match even if not every single member has swiped yet — if at least one person super-liked and 60% or more of the group liked it, it counts as a match

### Real-Time Group Swiping
- All group members swipe simultaneously — no waiting for turns
- WebSocket-powered live sync keeps everyone's progress updated in real time
- See how many members have swiped on the current restaurant via a progress indicator
- "Nudge" feature lets you ping members who haven't swiped yet

### Live Reactions
- While swiping, send live emoji-style reactions visible to the whole group in real time
- Reactions float up on screen with animations so the group can share their excitement or reactions as they browse restaurants together

### Match Celebrations
- When a restaurant is matched, a celebration overlay appears with confetti-style animations
- The matched restaurant card shows up with full details and action buttons

---

## Match Actions

When a restaurant is matched, the match card provides several quick actions:

### Directions ("Let's Go!")
- Opens Google Maps with turn-by-turn directions to the restaurant
- Uses GPS coordinates when available for precise routing, falls back to the restaurant address

### DoorDash Delivery
- Opens DoorDash's search page pre-filled with the restaurant name
- Quick way to order delivery instead of going out — no API key required, just a deep link

### Reserve
- Links directly to the restaurant's Yelp page for reservation info and contact details
- Only shown when the restaurant has a Yelp listing

### Add to Calendar
- Generates a Google Calendar event for a dinner the next evening (7-9 PM)
- Pre-fills the event with the restaurant name, cuisine, rating, price range, and address
- Includes the group name in the event title

### Visit Tracking ("We Went Here")
- Log which matched restaurant you actually visited
- Helps the group keep a history of where they've been

---

## Group Management

### Creating a Party
- Name your dining session and set your display name
- A unique 6-character invite code is generated automatically
- The creator becomes the host with special privileges (setting preferences, starting the session)

### Joining a Party
- Enter the 6-character invite code to join
- Shareable join links auto-fill the code when opened — just share the URL via text or social media
- The join page reads the `?code=` parameter from the URL and pre-fills it automatically

### Group Lobby
- See all members who have joined in real time
- Share the invite code or copy a join link
- Host can start the session when everyone is ready
- Leadership recovery system — if the host disconnects, they can reclaim their role using a stored token

### Host Controls
- Set dining preferences (location, cuisine, price, dietary needs)
- Start the swiping session
- Remove members from the group
- Update preferences mid-session

---

## Persistent Crews

Beyond one-off parties, ChickenTinders supports persistent friend groups called "Crews":

### Create a Crew
- Name your crew and optionally invite friends right away
- A unique invite code is generated for each crew

### Crew Management
- View all crew members with their profiles
- Invite new members by sharing the crew's invite code
- Remove members (owner only)
- Leave a crew if you're a member
- Delete a crew (owner only)

### Dining Sessions Within Crews
- Start a dining session directly from a crew — no need to recreate groups each time
- View session history for the crew, including past matches and visited restaurants
- Track previously visited restaurants so you can try new places

### Smart Exclusions
- Restaurants your crew has already visited show a "Been here before" badge on swipe cards
- Helps the group discover new spots instead of revisiting the same ones

---

## Dining Preferences

The host configures these before starting a swiping session:

### Location
- **ZIP Code / Address** — Type in a location to search around
- **GPS ("Find Me")** — Use your phone's location for precise nearby results, with reverse geocoding to show a readable address
- **Search Radius** — Set how far to look (in miles), adjustable via slider

### Cuisine Types
- Filter by specific cuisine types: American, Mexican, Italian, Chinese, Japanese, Thai, Indian, Mediterranean, Korean, Vietnamese, and more
- Select multiple cuisines or leave blank for all types

### Cuisine Exclusions
- Explicitly exclude cuisine types you don't want to see
- Useful for filtering out options the group has ruled out

### Price Range
- Filter by price level: $, $$, $$$, $$$$
- Select one or more price tiers

### Dietary Restrictions
- Filter for specific dietary needs: Vegetarian, Vegan, Gluten-Free, Halal, Kosher
- Restaurants are filtered to match the group's needs

### Try Something New
- Toggle to deprioritize restaurants the crew has visited before
- Encourages exploring new dining spots

---

## Final Vote Mode

When the group can't seem to agree and swiping isn't producing matches:

- Any member can trigger "Final Vote" mode
- Each member's liked restaurants are compiled into a ballot
- A countdown timer (60 seconds) creates urgency
- The group votes on their top picks from the compiled list
- Helps break deadlocks and reach a decision faster

---

## Social Features

### Friends System
- Send friend requests by email
- Accept or decline incoming requests
- View your friends list on the dashboard
- Remove friends when needed
- Real-time notifications for friend requests

### Notifications
- In-app notification system for friend requests, crew invites, session starts, and more
- Notification bell on the dashboard with unread count badge
- Mark individual notifications as read or mark all as read
- Each notification links to the relevant action

### Push Notifications
- Web push notifications for important events even when the app isn't open
- Notifies you when a friend request arrives, a dining session starts in your crew, everyone finishes swiping, or a match is found
- VAPID-based push with service worker support
- Permission prompt on the dashboard with one-click enable

---

## Profile & Achievements

### User Profile
- View your avatar, name, and email from your Replit account
- Stats dashboard showing:
  - Total swipes made
  - Super-likes given
  - Total matches found
  - Places visited
  - Number of crews you're in
  - Achievements unlocked

### Achievement System
- Unlock achievements based on your activity:
  - **First Bite** — Complete your first swipe session
  - **Matchmaker** — Get your first restaurant match
  - **Super Fan** — Use a super-like
  - **Explorer** — Visit a matched restaurant
  - **Social Butterfly** — Join multiple crews
  - **Foodie** — Reach a milestone number of swipes
  - **Team Player** — Complete sessions with friends
  - **Trailblazer** — Discover new restaurants
- Achievements display with icons, descriptions, and unlock dates
- Locked achievements show what you need to do to earn them

---

## Progressive Web App (PWA)

ChickenTinders is a full Progressive Web App, meaning it can be installed and used like a native app:

### Installation
- Install prompt appears automatically on supported devices
- Platform-specific instructions for iOS (Add to Home Screen via Share menu)
- Once installed, launches in standalone mode without browser chrome

### Offline Support
- Service worker caches key assets, icons, and static pages
- Offline fallback page when no network is available
- Images are cached on first load for faster subsequent viewing

### Push Notifications
- Background push notifications via service worker
- Clicking a notification opens the relevant page in the app

### Home Screen Icon
- Custom app icons (192px and 512px) for home screen and app launcher
- Themed splash screen on launch

---

## Mobile-First Design

The entire app is optimized for mobile devices:

### Safe Area Support
- Full support for notched phones (iPhone Dynamic Island, Android punch-hole cameras)
- `viewport-fit=cover` with CSS safe area insets applied to all pages
- Custom utility classes (`safe-top`, `safe-x`, `safe-bottom`) ensure content never hides behind device hardware

### Responsive Layout
- Responsive text sizing (`text-2xl` on mobile, `text-3xl` on larger screens)
- 2-column mobile grid on the dashboard, expanding to 4 columns on desktop
- Decorative/non-essential elements hidden on small screens to maximize content space
- Full dynamic viewport height (`100dvh`) for the swipe page so cards fill the screen
- Dynamic card heights (`min(400px, 55dvh)`) adapt to any phone size

### Touch Optimized
- Large, easy-to-tap buttons for swipe actions
- Touch-friendly swipe gestures on restaurant cards
- Bottom-anchored action buttons within thumb reach

---

## Theme Support

- Light and dark mode with smooth transitions
- System theme detection — automatically matches your device's preference
- Manual toggle available on every page
- All colors, borders, and backgrounds adapt correctly in both themes
- Persistent theme preference saved in local storage

---

## Restaurant Data

- Real restaurant data sourced from the **Yelp Fusion API**
- Each restaurant includes: name, photo, cuisine type, star rating, review count, price range, address, GPS coordinates, distance from search location, description, and Yelp page link
- Built-in sample restaurant data as a fallback when Yelp API is unavailable or no results are returned
- "Load More" feature fetches additional batches of 20 restaurants without leaving the session

---

## Sharing & Invites

### Share Join Links
- Generate shareable links with the invite code embedded as a URL parameter
- Uses the Web Share API on supported devices (native share sheet on mobile)
- Falls back to clipboard copy on unsupported devices
- Share message format: "Join my [party/crew] on ChickenTinders: [url]"

### Auto-Fill Invite Codes
- When someone clicks a shared link, the join page automatically fills in the invite code
- Reduces friction — one tap to share, one tap to join

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite |
| Routing | Wouter |
| State | TanStack React Query |
| UI Components | shadcn/ui (Radix UI) |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Backend | Express.js (v5), Node.js |
| Real-time | WebSocket (ws library) |
| Database | PostgreSQL (Drizzle ORM) |
| Authentication | Replit Auth (OpenID Connect) |
| Restaurant Data | Yelp Fusion API |
| Push Notifications | Web Push (VAPID) |
| PWA | Service Worker, Web App Manifest |
