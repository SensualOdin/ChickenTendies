import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.chickentinders.app",
  appName: "ChickenTinders",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
    iosScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#1a1a2e",
      showSpinner: false,
    },
    Keyboard: {
      resize: "body",
      style: "dark",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  // Custom URL scheme for deep links (chickentinders://crew/join/ABC123)
  // Universal Links require apple-app-site-association hosted on your domain
  appUrlScheme: "chickentinders",
};

export default config;
