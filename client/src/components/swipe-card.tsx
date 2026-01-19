import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, DollarSign, Heart, X, Leaf } from "lucide-react";
import type { Restaurant } from "@shared/schema";

interface SwipeCardProps {
  restaurant: Restaurant;
  onSwipe: (liked: boolean) => void;
  isTop: boolean;
}

export function SwipeCard({ restaurant, onSwipe, isTop }: SwipeCardProps) {
  const [exitX, setExitX] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 100) {
      setExitX(300);
      onSwipe(true);
    } else if (info.offset.x < -100) {
      setExitX(-300);
      onSwipe(false);
    }
  };

  if (!isTop) {
    return (
      <Card className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${restaurant.imageUrl})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
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
      <Card className="relative h-full overflow-hidden border-0 shadow-xl">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${restaurant.imageUrl})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        </div>

        <motion.div
          className="absolute top-8 left-8 z-10"
          style={{ opacity: nopeOpacity }}
        >
          <div className="flex items-center gap-2 px-6 py-3 border-4 border-destructive rounded-lg rotate-[-20deg]">
            <X className="w-8 h-8 text-destructive" />
            <span className="text-3xl font-bold text-destructive">NOPE</span>
          </div>
        </motion.div>

        <motion.div
          className="absolute top-8 right-8 z-10"
          style={{ opacity: likeOpacity }}
        >
          <div className="flex items-center gap-2 px-6 py-3 border-4 border-accent rounded-lg rotate-[20deg]">
            <Heart className="w-8 h-8 text-accent fill-accent" />
            <span className="text-3xl font-bold text-accent">LIKE</span>
          </div>
        </motion.div>

        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge className="bg-white/20 backdrop-blur-sm text-white border-0">
              {restaurant.cuisine}
            </Badge>
            <Badge className="bg-white/20 backdrop-blur-sm text-white border-0">
              {restaurant.priceRange}
            </Badge>
            {restaurant.dietaryOptions.length > 0 && (
              <Badge className="bg-accent/80 text-white border-0">
                <Leaf className="w-3 h-3 mr-1" />
                {restaurant.dietaryOptions[0]}
              </Badge>
            )}
          </div>

          <h2 className="text-3xl font-bold mb-2" data-testid="text-restaurant-name">
            {restaurant.name}
          </h2>

          <div className="flex flex-wrap items-center gap-4 text-sm text-white/90 mb-3">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{restaurant.rating.toFixed(1)}</span>
              <span className="text-white/70">({restaurant.reviewCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{restaurant.distance.toFixed(1)} mi</span>
            </div>
          </div>

          <p className="text-sm text-white/80 line-clamp-2">
            {restaurant.description}
          </p>
        </div>
      </Card>
    </motion.div>
  );
}

export function SwipeButtons({
  onSwipe,
  disabled = false,
}: {
  onSwipe: (liked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-6 mt-6">
      <button
        onClick={() => onSwipe(false)}
        disabled={disabled}
        className="w-16 h-16 rounded-full bg-card border-2 border-destructive/30 flex items-center justify-center transition-all hover:scale-110 hover:border-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:hover:scale-100"
        data-testid="button-swipe-left"
      >
        <X className="w-8 h-8 text-destructive" />
      </button>
      <button
        onClick={() => onSwipe(true)}
        disabled={disabled}
        className="w-20 h-20 rounded-full bg-accent flex items-center justify-center transition-all hover:scale-110 shadow-lg shadow-accent/30 disabled:opacity-50 disabled:hover:scale-100"
        data-testid="button-swipe-right"
      >
        <Heart className="w-10 h-10 text-white fill-white" />
      </button>
    </div>
  );
}
