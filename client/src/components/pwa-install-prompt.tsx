import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { isNative } from "@/lib/platform";
import { Download, X, Share, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function PWAInstallPrompt() {
  if (isNative()) return null;

  const { isInstallable, isInstalled, isIOS, showIOSPrompt, install, dismiss } = usePWAInstall();

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto"
        >
          <Card className="border-primary/20 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm" data-testid="text-install-title">Install ChickenTinders</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add to your home screen for the full app experience with notifications and quick access.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={install}
                      data-testid="button-install-pwa"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Install App
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={dismiss}
                      data-testid="button-dismiss-install"
                    >
                      Not now
                    </Button>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={dismiss}
                  className="shrink-0"
                  data-testid="button-close-install"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (showIOSPrompt) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto"
        >
          <Card className="border-primary/20 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm" data-testid="text-ios-install-title">Install ChickenTinders</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    To install this app on your iPhone:
                  </p>
                  <ol className="text-xs text-muted-foreground mt-2 space-y-1.5">
                    <li className="flex items-center gap-1.5">
                      <span className="font-medium">1.</span> Tap the <Share className="w-3.5 h-3.5 inline" /> Share button
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="font-medium">2.</span> Scroll down and tap <Plus className="w-3.5 h-3.5 inline" /> "Add to Home Screen"
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="font-medium">3.</span> Tap "Add" to confirm
                    </li>
                  </ol>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={dismiss}
                    className="mt-2"
                    data-testid="button-dismiss-ios-install"
                  >
                    Got it
                  </Button>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={dismiss}
                  className="shrink-0"
                  data-testid="button-close-ios-install"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
