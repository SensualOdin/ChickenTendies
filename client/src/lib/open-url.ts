import { isNative } from "./platform";
import { Browser } from "@capacitor/browser";

/**
 * Open a URL in the appropriate way for the current platform.
 * Native: opens in-app browser. Web: opens new tab.
 */
export async function openUrl(url: string): Promise<void> {
  if (isNative()) {
    await Browser.open({ url });
  } else {
    window.open(url, "_blank");
  }
}
