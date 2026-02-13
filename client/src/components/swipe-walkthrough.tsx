import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, ArrowUp, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "chickentinders-walkthrough-seen";

const tips = [
  {
    icon: ArrowRight,
    label: "Swipe right",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    description: "Like a restaurant. If everyone in your group likes the same place, it's a match!",
  },
  {
    icon: ArrowLeft,
    label: "Swipe left",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    description: "Skip this one. No one will know you passed.",
  },
  {
    icon: ArrowUp,
    label: "Swipe up",
    color: "text-primary",
    bgColor: "bg-primary/10",
    description: "Super-like! Counts as two votes toward a match.",
  },
];

export function SwipeWalkthrough() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={handleDismiss}
        data-testid="overlay-walkthrough"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="max-w-sm w-full border-2">
            <CardContent className="pt-6 pb-4 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold" data-testid="text-walkthrough-title">How to swipe</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDismiss}
                  data-testid="button-dismiss-walkthrough"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {tips.map((tip) => (
                  <div key={tip.label} className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${tip.bgColor} flex items-center justify-center shrink-0`}>
                      <tip.icon className={`w-5 h-5 ${tip.color}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${tip.color}`}>{tip.label}</p>
                      <p className="text-sm text-muted-foreground">{tip.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center pt-1">
                You can also use arrow keys on desktop
              </p>

              <Button
                className="w-full bg-gradient-to-r from-primary to-orange-500"
                onClick={handleDismiss}
                data-testid="button-start-swiping"
              >
                Got it, let's go!
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
