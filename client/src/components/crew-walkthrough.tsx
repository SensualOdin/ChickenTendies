import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Utensils, Trophy, Flame, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "chickentinders-crew-walkthrough-seen";

const tips = [
  {
    icon: Users,
    label: "Create a Crew",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    description: "Add your friends to a permanent crew. No more sharing codes every time!",
  },
  {
    icon: Utensils,
    label: "Start Sessions",
    color: "text-primary",
    bgColor: "bg-primary/10",
    description: "Launch a swiping session anytime. Everyone in the crew gets notified.",
  },
  {
    icon: Trophy,
    label: "Track History",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    description: "See past matches, log where you went, and build your dining history.",
  },
  {
    icon: Flame,
    label: "Earn Achievements",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    description: "Unlock badges by swiping, matching, and visiting restaurants with your crew.",
  },
];

export function CrewWalkthrough() {
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
        data-testid="overlay-crew-walkthrough"
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
                <h3 className="text-lg font-bold" data-testid="text-crew-walkthrough-title">Welcome to Crews!</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDismiss}
                  data-testid="button-dismiss-crew-walkthrough"
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

              <Button
                className="w-full bg-gradient-to-r from-primary to-orange-500"
                onClick={handleDismiss}
                data-testid="button-start-crews"
              >
                Let's get started!
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
