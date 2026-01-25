import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, X, Leaf, Flame, Sparkles, Phone, Calendar, Truck, ShoppingBag, Heart, Coffee, Pizza, Utensils, History } from "lucide-react";
import type { Restaurant } from "@shared/schema";

export type SwipeAction = "like" | "dislike" | "superlike";

interface SwipeCardProps {
  restaurant: Restaurant;
  onSwipe: (action: SwipeAction) => void;
  isTop: boolean;
  visitedBefore?: boolean;
}

export function SwipeCard({ restaurant, onSwipe, isTop, visitedBefore = false }: SwipeCardProps) {
  const [exitX, setExitX] = useState(0);
  const [exitY, setExitY] = useState(0);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);
  const superLikeOpacity = useTransform(y, [-100, 0], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y < -100) {
      setExitY(-400);
      onSwipe("superlike");
    } else if (info.offset.x > 100) {
      setExitX(300);
      onSwipe("like");
    } else if (info.offset.x < -100) {
      setExitX(-300);
      onSwipe("dislike");
    }
  };

  if (!isTop) {
    return (
      <Card className="absolute inset-0 overflow-hidden border-0">
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
      style={{ x, y, rotate, opacity }}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      animate={{ x: exitX, y: exitY }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Card className="relative h-full overflow-hidden border-0 shadow-2xl">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${restaurant.imageUrl})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        </div>

        <motion.div
          className="absolute top-8 left-8 z-10"
          style={{ opacity: nopeOpacity }}
        >
          <div className="flex items-center gap-2 px-6 py-3 border-4 border-destructive rounded-xl rotate-[-20deg] bg-destructive/20 backdrop-blur-sm">
            <X className="w-8 h-8 text-destructive" />
            <span className="text-3xl font-extrabold text-destructive">NOPE</span>
          </div>
        </motion.div>

        <motion.div
          className="absolute top-8 right-8 z-10"
          style={{ opacity: likeOpacity }}
        >
          <div className="flex items-center gap-2 px-6 py-3 border-4 border-accent rounded-xl rotate-[20deg] bg-accent/20 backdrop-blur-sm">
            <Flame className="w-8 h-8 text-accent" />
            <span className="text-3xl font-extrabold text-accent">YUM!</span>
          </div>
        </motion.div>

        <motion.div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 z-10"
          style={{ opacity: superLikeOpacity }}
        >
          <div className="flex items-center gap-2 px-6 py-3 border-4 border-yellow-400 rounded-xl bg-yellow-400/20 backdrop-blur-sm">
            <Sparkles className="w-8 h-8 text-yellow-400" />
            <span className="text-3xl font-extrabold text-yellow-400">SUPER!</span>
          </div>
        </motion.div>

        {visitedBefore && (
          <div className="absolute top-4 right-4 z-10">
            <Badge className="bg-purple-500/90 backdrop-blur-sm text-white border-0 font-semibold shadow-lg" data-testid="badge-visited-before">
              <History className="w-3 h-3 mr-1" />
              Been here before
            </Badge>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge className="bg-white/20 backdrop-blur-sm text-white border-0 font-semibold">
              {restaurant.cuisine}
            </Badge>
            <Badge className="bg-white/20 backdrop-blur-sm text-white border-0 font-semibold">
              {restaurant.priceRange}
            </Badge>
            {restaurant.dietaryOptions.length > 0 && (
              <Badge className="bg-accent/80 text-white border-0">
                <Leaf className="w-3 h-3 mr-1" />
                {restaurant.dietaryOptions[0]}
              </Badge>
            )}
          </div>

          {restaurant.highlights && restaurant.highlights.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {restaurant.highlights.slice(0, 4).map((highlight) => (
                <Badge 
                  key={highlight} 
                  className={`text-white border-0 text-xs py-0.5 ${
                    highlight === "Date Night" ? "bg-pink-500/80 dark:bg-pink-600/80" :
                    highlight === "Brunch Spot" ? "bg-orange-400/80 dark:bg-orange-500/80" :
                    highlight === "Casual Eats" ? "bg-blue-500/80 dark:bg-blue-600/80" :
                    "bg-yellow-500/80 dark:bg-yellow-600/80"
                  }`}
                >
                  {highlight === "Reservations" && <Calendar className="w-3 h-3 mr-1" />}
                  {highlight === "Delivery" && <Truck className="w-3 h-3 mr-1" />}
                  {highlight === "Pickup" && <ShoppingBag className="w-3 h-3 mr-1" />}
                  {highlight === "Highly Rated" && <Star className="w-3 h-3 mr-1 fill-white" />}
                  {highlight === "Date Night" && <Heart className="w-3 h-3 mr-1 fill-white" />}
                  {highlight === "Brunch Spot" && <Coffee className="w-3 h-3 mr-1" />}
                  {highlight === "Casual Eats" && <Pizza className="w-3 h-3 mr-1" />}
                  {highlight === "Popular Spot" && <Flame className="w-3 h-3 mr-1" />}
                  {highlight}
                </Badge>
              ))}
            </div>
          )}

          <h2 className="text-3xl font-extrabold mb-2" data-testid="text-restaurant-name">
            {restaurant.name}
          </h2>

          <div className="flex flex-wrap items-center gap-4 text-sm text-white/90 mb-2">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-bold">{restaurant.rating.toFixed(1)}</span>
              <span className="text-white/70">({restaurant.reviewCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{restaurant.distance.toFixed(1)} mi away</span>
            </div>
            {restaurant.phone && (
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                <span className="text-xs">{restaurant.phone}</span>
              </div>
            )}
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
  onSwipe: (action: SwipeAction) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-4 mt-6">
      <motion.button
        onClick={() => onSwipe("dislike")}
        disabled={disabled}
        className="w-14 h-14 rounded-full bg-card border-2 border-destructive/30 flex items-center justify-center shadow-lg disabled:opacity-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        data-testid="button-swipe-left"
      >
        <X className="w-7 h-7 text-destructive" />
      </motion.button>
      <motion.button
        onClick={() => onSwipe("superlike")}
        disabled={disabled}
        className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center shadow-lg shadow-yellow-400/30 disabled:opacity-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        data-testid="button-super-like"
      >
        <Sparkles className="w-6 h-6 text-white" />
      </motion.button>
      <motion.button
        onClick={() => onSwipe("like")}
        disabled={disabled}
        className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-emerald-500 flex items-center justify-center shadow-xl shadow-accent/40 disabled:opacity-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        data-testid="button-swipe-right"
      >
        <Flame className="w-8 h-8 text-white" />
      </motion.button>
    </div>
  );
}
