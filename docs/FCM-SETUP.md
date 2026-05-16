# Firebase Cloud Messaging — Setup

End-to-end native push for Android (and later iOS via APNs-via-FCM). Web push
via VAPID keeps working independently.

## What's already wired up in code

- `firebase-admin` installed
- `native_push_subscriptions` table (`migrations/add_native_push_subscriptions.sql`)
- `server/fcm.ts` initializes the SDK from `FIREBASE_SERVICE_ACCOUNT_JSON`
- `POST /api/push/subscribe-native` upserts tokens, `DELETE /api/push/unsubscribe-native` removes them
- `sendPushToUsers` and `sendPushNotification` fan out to web AND native in parallel
- Client `usePushNotifications` already POSTs the FCM token on register; it's gated behind `VITE_NATIVE_PUSH_ENABLED` until you flip it on

What you have to do is the Firebase project setup + drop two pieces of config.

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> → **Add project**
2. Name it whatever (e.g. `chickentinders`)
3. Disable Google Analytics if asked (not needed for FCM)

## 2. Add the Android app

1. Project overview → **Add app** → Android icon
2. **Android package name**: `com.chickentinders.app` (must match exactly — it's hardcoded in `android/app/build.gradle`)
3. App nickname: `ChickenTinders Android`
4. SHA-1 cert fingerprint: optional for FCM, skip for now
5. **Download `google-services.json`**
6. Drop it into `android/app/google-services.json`
7. Skip the "Add Firebase SDK" step — Capacitor's plugin handles this
8. Skip the "Run your app" verification

## 3. Generate the server service account

1. Firebase console → ⚙ → **Project settings** → **Service accounts** tab
2. Click **Generate new private key** → confirm → downloads a JSON file
3. **Open the JSON in a text editor and copy the entire contents** (the whole thing, braces and all)

## 4. Set the server env var on Render

1. Render dashboard → your `chickentinders` service → **Environment**
2. Add a new env var:
   - Key: `FIREBASE_SERVICE_ACCOUNT_JSON`
   - Value: paste the full JSON contents from step 3
3. Save — Render redeploys automatically

The server picks it up at boot via `JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)`.
Without it, native push send is a no-op (web push still works).

## 5. Run the DB migration

Apply once against the production database:

```sql
-- contents of migrations/add_native_push_subscriptions.sql
```

Easiest path: open Supabase SQL editor, paste the file contents, run.

## 6. Build the Android app with native push enabled

After the four pieces above are in place, the next AAB build needs:

```
VITE_NATIVE_PUSH_ENABLED=true npm run build:client
npx cap sync android
cd android && ./gradlew bundleRelease
```

Bump `versionCode` first.

The `google-services.json` you dropped in step 2.6 gets picked up by the
`apply plugin: 'com.google.gms.google-services'` block in
`android/app/build.gradle` (already conditional on the file's presence —
no code change needed).

## 7. Verify end-to-end

After uploading the new AAB and the Render redeploy:

1. Sign in on the device, grant the OS notification permission when asked
2. Server logs should show no errors from `/api/push/subscribe-native`
3. The DB now has a row in `native_push_subscriptions` for that user
4. Trigger something that calls `sendPushToUsers` (a friend request, a crew
   session start, etc.) — the device should buzz and show a notification
   even if the app is fully closed

## iOS later

iOS goes through APNs but FCM acts as a relay. To add iOS:

1. Apple Developer account → set up an APNs auth key (.p8)
2. Firebase project settings → iOS app → upload the .p8
3. Drop `GoogleService-Info.plist` into `ios/App/App/`
4. Xcode: enable Push Notifications + Background Modes (Remote notifications) capability
5. Same `VITE_NATIVE_PUSH_ENABLED=true` build flag
6. Same server, same `FIREBASE_SERVICE_ACCOUNT_JSON` — `server/fcm.ts` already passes through `apns:` payload options

## Rolling back

If anything goes wrong:

- Unset `FIREBASE_SERVICE_ACCOUNT_JSON` on Render → server stops sending native
- Build without `VITE_NATIVE_PUSH_ENABLED=true` → client stops registering (existing tokens still work until next install)
- Or `DELETE FROM native_push_subscriptions` to wipe all native subscribers
