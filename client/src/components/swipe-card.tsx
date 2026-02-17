import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, X, Leaf, Flame, Sparkles, Phone, Calendar, Truck, ShoppingBag, Heart, Coffee, Pizza, Utensils, History, ExternalLink } from "lucide-react";
import type { Restaurant } from "@shared/schema";
import { isNative } from "@/lib/platform";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

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

  const [photoIndex, setPhotoIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const allPhotos = restaurant.photos && restaurant.photos.length > 0
    ? restaurant.photos
    : [restaurant.imageUrl];

  const handlePhotoTap = (e: React.PointerEvent) => {
    // Only handle taps, not drags
    const rect = e.currentTarget.getBoundingClientRect();
    const tapX = e.clientX - rect.left;
    const halfWidth = rect.width / 2;

    if (tapX < halfWidth) {
      setPhotoIndex((prev) => Math.max(0, prev - 1));
    } else {
      setPhotoIndex((prev) => Math.min(allPhotos.length - 1, prev + 1));
    }
  };

  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);
  const superLikeOpacity = useTransform(y, [-100, 0], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y < -100) {
      setExitY(-400);
      if (isNative()) {
        Haptics.notification({ type: NotificationType.Success });
      }
      onSwipe("superlike");
    } else if (info.offset.x > 100) {
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
          className="absolute inset-0 bg-cover bg-center transition-[background-image] duration-300"
          style={{ backgroundImage: `url(${allPhotos[photoIndex]})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        </div>

        {/* Photo carousel tap zones */}
        {allPhotos.length > 1 && (
          <>
            <div
              className="absolute top-0 left-0 w-1/2 h-1/2 z-20 cursor-pointer"
              onPointerUp={handlePhotoTap}
            />
            <div
              className="absolute top-0 right-0 w-1/2 h-1/2 z-20 cursor-pointer"
              onPointerUp={handlePhotoTap}
            />
            {/* Dot indicators */}
            <div className="absolute top-3 left-0 right-0 z-20 flex justify-center gap-1.5">
              {allPhotos.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-200 ${i === photoIndex
                      ? "w-6 bg-white"
                      : "w-1.5 bg-white/50"
                    }`}
                />
              ))}
            </div>
          </>
        )}

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

        <motion.div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 z-10"
          style={{ opacity: superLikeOpacity }}
        >
          <div className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 border-4 border-yellow-400 rounded-xl bg-yellow-400/20 backdrop-blur-sm">
            <Sparkles className="w-8 h-8 text-yellow-400" />
            <span className="text-2xl sm:text-3xl font-extrabold text-yellow-400">SUPER!</span>
          </div>
        </motion.div>

        {visitedBefore && (
          <motion.div
            className="absolute top-14 left-4 z-10"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Badge className="bg-purple-600/95 backdrop-blur-sm text-white border-0 font-bold shadow-lg text-sm px-3 py-1.5" data-testid="badge-visited-before">
              <History className="w-4 h-4 mr-1.5" />
              You've been here!
            </Badge>
          </motion.div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white">
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
                  className={`text-white border-0 text-xs py-0.5 ${highlight === "Date Night" ? "bg-pink-500/80 dark:bg-pink-600/80" :
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

          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2" data-testid="text-restaurant-name">
            {restaurant.name}
          </h2>

          <div className="flex flex-wrap items-center gap-4 text-sm text-white/90 mb-2">
            <div className="flex items-center gap-1" data-testid="rating-display">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-bold">
                {(restaurant.combinedRating ?? restaurant.rating).toFixed(1)}
              </span>
              {restaurant.googleRating != null ? (
                <span className="text-white/70 text-xs">
                  {restaurant.reviewCount + (restaurant.googleReviewCount ?? 0)} reviews
                </span>
              ) : (
                <span className="text-white/70 text-xs">{restaurant.reviewCount} reviews</span>
              )}
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

          {restaurant.googleRating != null && (
            <div className="flex items-center gap-3 text-xs text-white/60 mb-1">
              <span>Yelp {restaurant.rating.toFixed(1)}</span>
              <span>Google {restaurant.googleRating.toFixed(1)}</span>
            </div>
          )}

          <p className="text-sm text-white/80 line-clamp-2">
            {restaurant.description}
          </p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowDetails(true); }}
            className="text-xs text-white/60 underline underline-offset-2 mt-1"
            data-testid="button-details"
          >
            Tap for details
          </button>
        </div>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="absolute inset-0 z-30 bg-card overflow-y-auto rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{restaurant.name}</h3>
                    <p className="text-sm text-muted-foreground">{restaurant.cuisine} · {restaurant.priceRange}</p>
                  </div>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="p-1 rounded-full hover:bg-muted"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {allPhotos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {allPhotos.map((photo, i) => (
                      <div
                        key={i}
                        className="w-24 h-24 rounded-lg bg-cover bg-center shrink-0"
                        style={{ backgroundImage: `url(${photo})` }}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold">{(restaurant.combinedRating ?? restaurant.rating).toFixed(1)}</span>
                    <span className="text-muted-foreground">({restaurant.reviewCount} reviews)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{restaurant.distance.toFixed(1)} mi</span>
                  </div>
                </div>

                {restaurant.googleRating != null && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Yelp: {restaurant.rating.toFixed(1)}</span>
                    <span>Google: {restaurant.googleRating.toFixed(1)}</span>
                  </div>
                )}

                <p className="text-sm text-muted-foreground">{restaurant.description}</p>

                {restaurant.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                    <span>{restaurant.address}</span>
                  </div>
                )}

                {restaurant.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a href={`tel:${restaurant.phone}`} className="underline">{restaurant.phone}</a>
                  </div>
                )}

                {restaurant.yelpUrl && (
                  <a href={restaurant.yelpUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on Yelp
                    </button>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setShowDetails(false)}
                  className="w-full px-4 py-2.5 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-primary to-orange-500"
                >
                  Back to Swiping
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
    <div className="flex items-center justify-center gap-3 sm:gap-4 mt-4 sm:mt-6">
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
