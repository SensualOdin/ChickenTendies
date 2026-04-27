import {
  motion,
  useMotionValue,
  useTransform,
  PanInfo,
  AnimatePresence,
  animate,
  MotionValue,
} from "framer-motion";
import { useState, useImperativeHandle, forwardRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  MapPin,
  X,
  Leaf,
  Flame,
  Sparkles,
  Phone,
  Calendar,
  Truck,
  ShoppingBag,
  Heart,
  Coffee,
  Pizza,
  Utensils,
  History,
  ExternalLink,
} from "lucide-react";
import { openUrl } from "@/lib/open-url";
import type { Restaurant } from "@shared/schema";
import { isNative } from "@/lib/platform";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export type SwipeAction = "like" | "dislike" | "superlike";

// Expose an imperative "play the exit animation for this action" method to the
// parent so button taps, keyboard input, and even programmatic triggers all
// share the exact same physics as a hand gesture.
export interface SwipeCardHandle {
  trigger: (action: SwipeAction) => void;
}

interface SwipeCardProps {
  restaurant: Restaurant;
  onSwipe: (action: SwipeAction) => void;
  isTop: boolean;
  visitedBefore?: boolean;
}

// Distance at which a manual drag commits as a swipe.
const COMMIT_DISTANCE = 100;
// Velocity (px/s) above which a flick commits even below the distance threshold.
// This is the fix for the "slow 101px drag commits but fast 90px flick doesn't"
// bug — Tinder-style apps rely on velocity-based commit for flick-feel.
const COMMIT_VELOCITY = 550;

function triggerHaptic(action: SwipeAction) {
  if (isNative()) {
    if (action === "superlike") {
      Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    } else if (action === "like") {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    } else {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }
    return;
  }
  // Web fallback — Vibration API is supported in most mobile browsers.
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      if (action === "superlike") navigator.vibrate([40, 30, 60]);
      else if (action === "like") navigator.vibrate(40);
      else navigator.vibrate(20);
    } catch {
      // Ignore — some browsers throw on unsupported platforms.
    }
  }
}

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { restaurant, onSwipe, isTop, visitedBefore = false },
  ref,
) {
  const prefersReducedMotion = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Reduced-motion: skip the rotation transform. The card still slides on commit
  // but doesn't wobble during drag, matching the user's system preference.
  const rotate = useTransform(x, [-200, 200], prefersReducedMotion ? [0, 0] : [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const [photoIndex, setPhotoIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const allPhotos =
    restaurant.photos && restaurant.photos.length > 0 ? restaurant.photos : [restaurant.imageUrl];

  const handlePhotoTap = (e: React.PointerEvent) => {
    // Prevent the tap from bubbling into a drag commit. The zones sit above the
    // draggable card surface, so any pointer event that lands on them should
    // advance the photo carousel, never swipe the card.
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const tapX = e.clientX - rect.left;
    const halfWidth = rect.width / 2;

    if (tapX < halfWidth) {
      setPhotoIndex((prev) => Math.max(0, prev - 1));
    } else {
      setPhotoIndex((prev) => Math.min(allPhotos.length - 1, prev + 1));
    }
  };

  // Stamps fade in starting at 20px of movement (was 0–100, which felt dead
  // until you were already most of the way committed). By the time the user
  // is halfway to the threshold, the stamp is already fully visible.
  const likeOpacity = useTransform(x, [20, 70], [0, 1]);
  const nopeOpacity = useTransform(x, [-70, -20], [1, 0]);
  const superLikeOpacity = useTransform(y, [-70, -20], [1, 0]);

  // A colored tint overlay that grows with drag distance — gives an immediate
  // sense of "this direction = this outcome" before the stamps are even visible.
  const likeTintOpacity = useTransform(x, [0, 120], [0, 0.25]);
  const nopeTintOpacity = useTransform(x, [-120, 0], [0.25, 0]);
  const superTintOpacity = useTransform(y, [-120, 0], [0.25, 0]);

  const playExit = (action: SwipeAction) => {
    triggerHaptic(action);
    // The card slides offscreen along the appropriate axis with a spring. If
    // the user already dragged partway there, Framer springs from the current
    // value rather than snapping — so hand-drag + release and button-tap both
    // animate from wherever the card currently is.
    if (action === "superlike") {
      animate(y, -window.innerHeight, {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
    } else if (action === "like") {
      animate(x, window.innerWidth, {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
    } else {
      animate(x, -window.innerWidth, {
        type: "spring",
        stiffness: 300,
        damping: 30,
      });
    }
    onSwipe(action);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const absX = Math.abs(info.offset.x);
    const absY = Math.abs(info.offset.y);
    const vx = info.velocity.x;
    const vy = info.velocity.y;

    // Superlike: strong upward drag OR upward flick
    if (info.offset.y < -COMMIT_DISTANCE || vy < -COMMIT_VELOCITY) {
      playExit("superlike");
      return;
    }
    // Horizontal commit: distance OR velocity crosses threshold
    if (info.offset.x > COMMIT_DISTANCE || vx > COMMIT_VELOCITY) {
      playExit("like");
      return;
    }
    if (info.offset.x < -COMMIT_DISTANCE || vx < -COMMIT_VELOCITY) {
      playExit("dislike");
      return;
    }
    // Below threshold — spring back to origin. Don't reset x/y imperatively;
    // Framer will do it via the dragConstraints elasticity.
    animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
    animate(y, 0, { type: "spring", stiffness: 400, damping: 30 });
  };

  // Expose playExit so the parent (or keyboard / button handlers) can trigger
  // the same physics as a hand gesture. Only wire it up for the top card.
  useImperativeHandle(
    ref,
    () => ({
      trigger: (action: SwipeAction) => {
        if (!isTop) return;
        playExit(action);
      },
    }),
    // playExit closes over x, y, onSwipe — those change on every render, but
    // the handle is stable enough for its single use: parent-triggered exits.
    // Dependencies intentionally empty; the closure re-captures via identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isTop],
  );

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
    >
      <Card className="relative h-full overflow-hidden border-0 shadow-2xl">
        <div
          className="absolute inset-0 bg-cover bg-center transition-[background-image] duration-300"
          style={{ backgroundImage: `url(${allPhotos[photoIndex]})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        </div>

        {/* Drag-direction color tints. These fade in from 0 on any drag, giving
            immediate "this means X" feedback before the stamps cross their
            visibility threshold. */}
        <motion.div
          className="pointer-events-none absolute inset-0 bg-accent"
          style={{ opacity: likeTintOpacity }}
        />
        <motion.div
          className="pointer-events-none absolute inset-0 bg-destructive"
          style={{ opacity: nopeTintOpacity }}
        />
        <motion.div
          className="pointer-events-none absolute inset-0 bg-yellow-400"
          style={{ opacity: superTintOpacity }}
        />

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
                  className={`h-1 rounded-full transition-all duration-200 ${
                    i === photoIndex ? "w-6 bg-white" : "w-1.5 bg-white/50"
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
            <Badge
              className="bg-purple-600/95 backdrop-blur-sm text-white border-0 font-bold shadow-lg text-sm px-3 py-1.5"
              data-testid="badge-visited-before"
            >
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
                  className={`text-white border-0 text-xs py-0.5 ${
                    highlight === "Date Night"
                      ? "bg-pink-500/80 dark:bg-pink-600/80"
                      : highlight === "Brunch Spot"
                        ? "bg-orange-400/80 dark:bg-orange-500/80"
                        : highlight === "Casual Eats"
                          ? "bg-blue-500/80 dark:bg-blue-600/80"
                          : "bg-yellow-500/80 dark:bg-yellow-600/80"
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
              <span>
                {restaurant.distance.toFixed(1)} mi
                {restaurant.locations && restaurant.locations.length > 1 ? (
                  <>
                    {" "}<span className="text-white/70">·</span>{" "}
                    <span className="text-white/90">
                      {restaurant.locations.length} locations
                    </span>
                  </>
                ) : (
                  " away"
                )}
              </span>
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

          <p className="text-sm text-white/80 line-clamp-2">{restaurant.description}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(true);
            }}
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
                    <p className="text-sm text-muted-foreground">
                      {restaurant.cuisine} · {restaurant.priceRange}
                    </p>
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
                    <span className="font-bold">
                      {(restaurant.combinedRating ?? restaurant.rating).toFixed(1)}
                    </span>
                    <span className="text-muted-foreground">
                      ({restaurant.reviewCount} reviews)
                    </span>
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
                    <a href={`tel:${restaurant.phone}`} className="underline">
                      {restaurant.phone}
                    </a>
                  </div>
                )}

                {restaurant.yelpUrl && (
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors"
                    onClick={() => openUrl(restaurant.yelpUrl!)}
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on Yelp
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowDetails(false)}
                  className="w-full px-4 py-2.5 text-sm font-medium text-white rounded-lg"
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
});

/**
 * The action button row. Tapping a button no longer fires `onSwipe` directly —
 * instead it delegates to the SwipeCard's imperative `trigger()` via the `cardRef`
 * so the card plays the same spring exit as a hand gesture.
 *
 * Sizing: thumbs-up principle — the positive primary action (like) should be
 * larger than the destructive one; the celebratory secondary (super-like) should
 * match the primary in size so users feel invited to hit it. Previous layout had
 * super-like *smaller* than like, inverting the hierarchy.
 */
export function SwipeButtons({
  onSwipe,
  disabled = false,
}: {
  onSwipe: (action: SwipeAction) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-5 mt-4 sm:mt-6">
      <motion.button
        onClick={() => onSwipe("dislike")}
        disabled={disabled}
        className="w-14 h-14 rounded-full bg-card border-2 border-destructive/30 flex items-center justify-center shadow-lg disabled:opacity-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Skip this restaurant"
        data-testid="button-swipe-left"
      >
        <X className="w-7 h-7 text-destructive" />
      </motion.button>
      <motion.button
        onClick={() => onSwipe("superlike")}
        disabled={disabled}
        className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center shadow-lg shadow-yellow-400/30 disabled:opacity-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Super-like this restaurant"
        data-testid="button-super-like"
      >
        <Sparkles className="w-8 h-8 text-white" />
      </motion.button>
      <motion.button
        onClick={() => onSwipe("like")}
        disabled={disabled}
        className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-emerald-500 flex items-center justify-center shadow-xl shadow-accent/40 disabled:opacity-50"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Like this restaurant"
        data-testid="button-swipe-right"
      >
        <Flame className="w-8 h-8 text-white" />
      </motion.button>
    </div>
  );
}
