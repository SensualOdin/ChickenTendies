import { Capacitor } from "@capacitor/core";

export type Platform = "web" | "ios" | "android";

export function getPlatform(): Platform {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() as "ios" | "android";
  }
  return "web";
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isIOS(): boolean {
  return Capacitor.getPlatform() === "ios";
}

export function isAndroid(): boolean {
  return Capacitor.getPlatform() === "android";
}

export function isWeb(): boolean {
  return !Capacitor.isNativePlatform();
}
