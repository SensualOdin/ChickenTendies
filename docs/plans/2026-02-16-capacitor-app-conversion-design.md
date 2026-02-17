# ChickenTinders: Capacitor Native App Conversion

## Decision

Convert the existing React PWA into native iOS and Android apps using Capacitor. This wraps the existing web app in a native shell, keeping ~95% of the codebase unchanged while adding native capabilities.

## Architecture

```
+-----------------------------+
|  iOS / Android Native Shell |  <- Capacitor
|  +------------------------+ |
|  | React App (unchanged)  | |  <- Vite builds to dist/
|  | + Capacitor plugins    | |  <- Native bridge APIs
|  +------------------------+ |
|  Native: splash, status bar |
|  icons, deep links, haptics |
+-----------------------------+
         | HTTPS / WSS
+-----------------------------+
|  Express Backend (unchanged)|  <- Render.com
|  PostgreSQL + Yelp + Google |
+-----------------------------+
```

**Why Capacitor over alternatives:**
- Keeps 95% of existing React code unchanged
- Already a PWA with responsive mobile-first design
- Fastest path to App Store / Play Store
- Same codebase serves web, iOS, and Android
- Well-supported by Ionic team, large ecosystem

## Platforms

- iOS 14+ (App Store) - Apple Developer account exists
- Android 6.0+ / API 23 (Google Play) - Need to create Play Console ($25)

## Native Plugins

| Feature | Current (Web) | Native (Capacitor) |
|---|---|---|
| Push notifications | Web Push API + VAPID | @capacitor/push-notifications (APNs/FCM) |
| Geolocation | navigator.geolocation | @capacitor/geolocation |
| Haptics | None | @capacitor/haptics (swipe feedback) |
| Share | Copy-to-clipboard | @capacitor/share (native share sheet) |
| External links | window.open / <a> | @capacitor/browser (in-app browser) |
| Splash screen | None | @capacitor/splash-screen |
| Status bar | CSS safe-area-inset | @capacitor/status-bar |
| Deep links | Query params (?code=) | @capacitor/app (Universal Links + App Links) |
| App lifecycle | visibilitychange | @capacitor/app (foreground/background) |
| Keyboard | None | @capacitor/keyboard (push content up) |

## Platform Detection

Utility to detect web vs native so features gracefully adapt:
- Web push only on web, native push on device
- Haptics only on native
- Share sheet on native, fallback on web
- In-app browser on native, new tab on web

## Build & Deploy Flow

```
npm run build        -> Vite builds to dist/public
npx cap sync         -> Copies web assets into native projects
npx cap open ios     -> Opens Xcode
npx cap open android -> Opens Android Studio
```

- iOS: Archive in Xcode -> Upload to App Store Connect
- Android: Build AAB in Android Studio -> Upload to Play Console
- Web: Continues deploying to Render (unchanged)

Backend stays on Render. Native apps hit same API over HTTPS.

## App Store Requirements

Both:
- Bundle/package ID: com.chickentinders.app
- App category: Food & Drink
- Privacy policy URL (required)
- App icons in all required sizes
- Store listing screenshots

iOS: App Store Connect, ~1-3 day review
Android: Google Play Console ($25), hours-to-days review

## Scope

In scope:
1. Capacitor project init (iOS + Android)
2. All plugin integrations
3. Platform detection utility
4. Native splash screen and app icon generation
5. Deep link configuration
6. Capacitor config pointing to Render backend
7. Status bar and safe area native adjustments
8. Replace web push with native push registration
9. Build instructions for both platforms

Out of scope (manual):
- Google Play Console account creation
- Uploading builds to stores
- Store listing copy and screenshots
- Privacy policy page
