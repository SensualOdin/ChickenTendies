import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { X, Flame } from "lucide-react";
import type { CuisineType } from "@shared/schema";
import { isNative } from "@/lib/platform";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { CUISINE_VISUALS } from "@/lib/cuisine-visuals";

export type CuisineSwipeAction = "like" | "dislike";

interface CuisineCardProps {
  cuisine: CuisineType;
  onSwipe: (action: CuisineSwipeAction) => void;
  isTop: boolean;
}

export function CuisineCard({ cuisine, onSwipe, isTop }: CuisineCardProps) {
  const visual = CUISINE_VISUALS[cuisine];
  const [exitX, setExitX] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  const gradient = `linear-gradient(160deg, ${visual.from}, ${visual.to})`;

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 100) {
      setExitX(300);
      if (isNative()) {
        Haptics.impact({ style: ImpactStyle.Medium });
      }
      onSwipe("like");
    } else if (info.offset.x < -100) {
      setExitX(-300);
      if (isNative()) {
        Haptics.impact({ style: ImpactStyle.Light });
      }
      onSwipe("dislike");
    }
  };

  if (!isTop) {
    return (
      <Card className="absolute inset-0 overflow-hidden border-0">
        <div className="absolute inset-0" style={{ background: gradient }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        </div>
      </Card>
    );
  }

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      animate={{ x: exitX }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Card className="relative h-full overflow-hidden border-0 shadow-2xl">
        <div className="absolute inset-0" style={{ background: gradient }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>

        <motion.div
          className="absolute top-4 left-4 sm:top-8 sm:left-8 z-10"
          style={{ opacity: nopeOpacity }}
        >
          <div className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 border-4 border-destructive rounded-xl rotate-[-20deg] bg-destructive/20 backdrop-blur-sm">
            <X className="w-8 h-8 text-destructive" />
            <span className="text-2xl sm:text-3xl font-extrabold text-destructive">NOPE</span>
          </div>
        </motion.div>

        <motion.div
          className="absolute top-4 right-4 sm:top-8 sm:right-8 z-10"
          style={{ opacity: likeOpacity }}
        >
          <div className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 border-4 border-accent rounded-xl rotate-[20deg] bg-accent/20 backdrop-blur-sm">
            <Flame className="w-8 h-8 text-accent" />
            <span className="text-2xl sm:text-3xl font-extrabold text-accent">YUM!</span>
          </div>
        </motion.div>

        <div className="absolute top-[18%] left-1/2 -translate-x-1/2 z-10">
          <span
            className="block text-[88px] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]"
            role="img"
            aria-label={cuisine}
          >
            {visual.emoji}
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 text-white">
          <h2 className="text-4xl font-extrabold mb-2 drop-shadow-lg" data-testid="text-cuisine-name">
            {cuisine}
          </h2>
          <p className="text-sm text-white/90 mb-3">{visual.tagline}</p>
          <div className="flex flex-wrap gap-2">
            {visual.dishes.map((dish) => (
              <span
                key={dish}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur text-white"
              >
                {dish}
              </span>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
