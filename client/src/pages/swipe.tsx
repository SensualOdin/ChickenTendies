import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SwipeCard, SwipeButtons, type SwipeAction } from "@/components/swipe-card";
import { MemberAvatars } from "@/components/member-avatars";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useGroupPushNotifications } from "@/hooks/use-push-notifications";
import { useAnalytics } from "@/hooks/use-analytics";
import { Flame, ChevronRight, PartyPopper, Bell, Timer, Vote, Trophy, BellRing, X, Home, RefreshCw, ArrowLeft, ArrowRight, ArrowUp, Utensils, Heart, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Group, Restaurant, WSMessage } from "@shared/schema";
import confetti from "canvas-confetti";
import { SwipeWalkthrough } from "@/components/swipe-walkthrough";

export default function SwipePage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matches, setMatches] = useState<Restaurant[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [showMatchCelebration, setShowMatchCelebration] = useState(false);
  const [latestMatch, setLatestMatch] = useState<Restaurant | null>(null);
  const [showFinalVote, setShowFinalVote] = useState(false);
  const [finalVoteTimer, setFinalVoteTimer] = useState(60);
  const [likedRestaurants, setLikedRestaurants] = useState<Restaurant[]>([]);
  const [visitedRestaurantIds, setVisitedRestaurantIds] = useState<Set<string>>(new Set());
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(true);
  const [wsConnected, setWsConnected] = useState(true);

  const memberId = localStorage.getItem("grubmatch-member-id");
  const { trackSwipe, flushNow } = useAnalytics(params.id, memberId || undefined);

  const {
    isPushSupported,
    permission,
    isSubscribed,
    isLoading: notificationLoading,
    subscribe: subscribeToNotifications
  } = useGroupPushNotifications({
    groupId: params.id || "",
    memberId: memberId || ""
  });

  const shouldShowNotificationPrompt =
    showNotificationPrompt &&
    isPushSupported &&
    permission !== "granted" &&
    permission !== "denied" &&
    !isSubscribed;

  // Fetch visited restaurants from user's crews for smart exclusions
  useEffect(() => {
    const fetchVisitedRestaurants = async () => {
      try {
        const response = await fetch("/api/sessions/visited-restaurants", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setVisitedRestaurantIds(new Set(data.restaurantIds || []));
        }
      } catch (error) {
        // Silently fail - visited restaurant feature is optional
      }
    };
    fetchVisitedRestaurants();
  }, []);

  const getSwipedIds = (): Set<string> => {
    const stored = localStorage.getItem(`swiped-${params.id}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  };

  const saveSwipedId = (restaurantId: string) => {
    const swiped = getSwipedIds();
    swiped.add(restaurantId);
    localStorage.setItem(`swiped-${params.id}`, JSON.stringify(Array.from(swiped)));
  };

  const { data: initialGroup, isLoading: groupLoading } = useQuery<Group>({
    queryKey: ["/api/groups", params.id],
    enabled: !!params.id,
  });

  const { data: initialRestaurants, isLoading: restaurantsLoading } = useQuery<Restaurant[]>({
    queryKey: ["/api/groups", params.id, "restaurants"],
    enabled: !!params.id,
  });

  useEffect(() => {
    if (initialGroup) setGroup(initialGroup);
  }, [initialGroup]);

  useEffect(() => {
    if (initialRestaurants) {
      const swipedIds = getSwipedIds();
      const unswipedRestaurants = initialRestaurants.filter(r => !swipedIds.has(r.id));
      setRestaurants(unswipedRestaurants);
      setCurrentIndex(0);
    }
  }, [initialRestaurants]);

  useEffect(() => {
    if (!params.id || !memberId) return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    let isClosedIntentionally = false;

    const connect = () => {
      const apiUrl = import.meta.env.VITE_API_URL || "";
      let wsUrl: string;
      if (apiUrl) {
        const url = new URL(apiUrl);
        const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = `${wsProtocol}//${url.host}/ws?groupId=${params.id}&memberId=${memberId}`;
      } else {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = `${protocol}//${window.location.host}/ws?groupId=${params.id}&memberId=${memberId}`;
      }
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("Swipe WebSocket connected");
        reconnectAttempts = 0;
        setWsConnected(true);
      };

      socket.onmessage = (event) => {
        const message: WSMessage = JSON.parse(event.data);

        if (message.type === "sync") {
          setGroup(message.group);
          const swipedIds = getSwipedIds();
          const unswipedRestaurants = message.restaurants.filter((r: Restaurant) => !swipedIds.has(r.id));
          setRestaurants(unswipedRestaurants);
          setMatches(message.matches);
        } else if (message.type === "match_found") {
          setMatches((prev) => [...prev, message.restaurant]);
          setLatestMatch(message.restaurant);
          setShowMatchCelebration(true);
          const duration = 3000;
          const end = Date.now() + duration;
          const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'];

          const frame = () => {
            confetti({
              particleCount: 3,
              angle: 60,
              spread: 55,
              origin: { x: 0, y: 0.7 },
              colors,
            });
            confetti({
              particleCount: 3,
              angle: 120,
              spread: 55,
              origin: { x: 1, y: 0.7 },
              colors,
            });
            if (Date.now() < end) {
              requestAnimationFrame(frame);
            }
          };
          frame();
        } else if (message.type === "nudge") {
          if (!message.targetMemberIds || message.targetMemberIds.includes(memberId)) {
            toast({
              title: `${message.fromMemberName} is hungry!`,
              description: `They're waiting for you to swipe on ${message.restaurantName}`,
            });
          }
        } else if (message.type === "member_done_swiping") {
          setGroup((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              members: prev.members.map(m =>
                m.id === message.memberId ? { ...m, doneSwiping: true } : m
              ),
            };
          });
          if (message.memberId !== memberId) {
            toast({
              title: `${message.memberName} finished swiping!`,
              description: "They're waiting for everyone else",
            });
          }
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
        if (isClosedIntentionally) return;

        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`Swipe WebSocket closed, reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
          reconnectTimeout = setTimeout(connect, delay);
        }
      };

      socket.onerror = (error) => {
        console.error("Swipe WebSocket error:", error);
      };

      setWs(socket);
    };

    connect();

    return () => {
      isClosedIntentionally = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    };
  }, [params.id, memberId]);

  const swipeMutation = useMutation({
    mutationFn: async ({ restaurantId, liked, superLiked }: { restaurantId: string; liked: boolean; superLiked: boolean }) => {
      const response = await apiRequest("POST", `/api/groups/${params.id}/swipe`, {
        restaurantId,
        liked,
        superLiked,
        memberId,
      });
      return response.json();
    },
    onError: () => {
      toast({
        title: "Oops!",
        description: "That didn't work. Try again!",
        variant: "destructive",
      });
    },
  });

  const doneMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/groups/${params.id}/done-swiping`, {
        memberId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", params.id] });
    },
  });

  const loadMoreMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/groups/${params.id}/restaurants/load-more`);
      return response.json() as Promise<{ restaurants: Restaurant[]; loadedNew: boolean }>;
    },
    onSuccess: (data) => {
      if (!data.loadedNew) {
        setExhausted(true);
        toast({ title: "No more restaurants", description: "Try expanding your preferences for more options." });
      } else {
        setExhausted(false);
        const swipedIds = getSwipedIds();
        const unswiped = data.restaurants.filter((r: Restaurant) => !swipedIds.has(r.id));
        setRestaurants(unswiped);
        setCurrentIndex(0);
        toast({ title: "More restaurants loaded!", description: `${unswiped.length} new places to check out.` });
      }
    },
  });

  const nudgeMutation = useMutation({
    mutationFn: async (restaurantId: string) => {
      const response = await apiRequest("POST", `/api/groups/${params.id}/nudge`, {
        restaurantId,
        fromMemberId: memberId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.nudgedCount > 0) {
        toast({
          title: "Nudge sent!",
          description: `${data.nudgedCount} crew member${data.nudgedCount > 1 ? 's' : ''} got the message`,
        });
      } else {
        toast({
          title: "Everyone's swiped!",
          description: "Your crew is keeping up",
        });
      }
    },
  });

  const handleSwipe = useCallback((action: SwipeAction) => {
    if (currentIndex >= restaurants.length) return;

    const restaurant = restaurants[currentIndex];
    const liked = action === "like" || action === "superlike";
    const superLiked = action === "superlike";
    swipeMutation.mutate({ restaurantId: restaurant.id, liked, superLiked });
    saveSwipedId(restaurant.id);

    // Log analytics event
    const analyticsAction = superLiked ? "super_like" : liked ? "swipe_right" : "swipe_left";
    trackSwipe(
      {
        id: restaurant.id,
        name: restaurant.name,
        cuisine: restaurant.cuisine,
        priceRange: restaurant.priceRange,
        distance: restaurant.distance,
      },
      analyticsAction
    );

    if (liked) {
      setLikedRestaurants(prev => [...prev, restaurant]);
    }

    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, restaurants, swipeMutation, params.id, trackSwipe, group]);

  useEffect(() => {
    if (!showFinalVote || finalVoteTimer <= 0) return;

    const timer = setInterval(() => {
      setFinalVoteTimer(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [showFinalVote, finalVoteTimer]);

  const startFinalVote = () => {
    setFinalVoteTimer(60);
    setShowFinalVote(true);
  };

  const selectFinalChoice = (restaurant: Restaurant) => {
    setShowFinalVote(false);
    toast({
      title: "Decision made!",
      description: `You picked ${restaurant.name}!`,
    });
    setMatches(prev => [...prev, restaurant]);
  };

  const isLoading = groupLoading || restaurantsLoading;
  const currentRestaurant = restaurants[currentIndex];
  const nextRestaurant = restaurants[currentIndex + 1];
  const isComplete = currentIndex >= restaurants.length && restaurants.length > 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isComplete || swipeMutation.isPending || showFinalVote || showMatchCelebration) return;
      if (currentIndex >= restaurants.length) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSwipe("dislike");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSwipe("like");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        handleSwipe("superlike");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSwipe, isComplete, swipeMutation.isPending, showFinalVote, showMatchCelebration, currentIndex, restaurants.length]);

  // Mark as done swiping when user finishes all restaurants
  useEffect(() => {
    if (isComplete && !doneMutation.isPending && memberId) {
      const currentMember = group?.members.find(m => m.id === memberId);
      if (currentMember && !currentMember.doneSwiping) {
        doneMutation.mutate();
      }
    }
  }, [isComplete, memberId, group?.members]);

  // Calculate who's done swiping
  const doneMembers = group?.members.filter(m => m.doneSwiping) || [];
  const waitingMembers = group?.members.filter(m => !m.doneSwiping) || [];
  const allDone = group ? group.members.every(m => m.doneSwiping) : false;

  if (isLoading || !group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Flame className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background flex flex-col relative safe-top safe-x">
      <SwipeWalkthrough />
      <AnimatePresence>
        {showMatchCelebration && latestMatch && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setShowMatchCelebration(false)}
          >
            <motion.div
              className="text-center p-8 max-w-sm"
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: 3 }}
                className="mb-4"
              >
                <PartyPopper className="w-16 h-16 text-white mx-auto" />
              </motion.div>
              <h2 className="text-3xl font-extrabold text-white mb-1">IT'S A MATCH!</h2>
              <p className="text-lg text-white/80 mb-6">Everyone wants {latestMatch.name}!</p>

              <div className="flex flex-col gap-3">
                <Link href={`/group/${params.id}/matches`}>
                  <Button
                    size="lg"
                    className="w-full bg-gradient-to-r from-primary to-orange-500"
                    onClick={() => setShowMatchCelebration(false)}
                  >
                    <PartyPopper className="w-5 h-5 mr-2" />
                    See Matches ({matches.length})
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => setShowMatchCelebration(false)}
                >
                  Keep Swiping
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {shouldShowNotificationPrompt && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="bg-gradient-to-r from-primary/10 to-orange-500/10 border-b px-4 py-3"
        >
          <div className="flex items-center justify-between max-w-lg mx-auto gap-3">
            <div className="flex items-center gap-2 text-sm">
              <BellRing className="w-4 h-4 text-primary shrink-0" />
              <span>Get notified when everyone's done swiping!</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="default"
                onClick={async () => {
                  const success = await subscribeToNotifications();
                  if (success) {
                    toast({ title: "Notifications enabled!", description: "We'll ping you when everyone finishes." });
                    setShowNotificationPrompt(false);
                  }
                }}
                disabled={notificationLoading}
                data-testid="button-enable-notifications"
              >
                {notificationLoading ? "..." : "Enable"}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowNotificationPrompt(false)}
                data-testid="button-dismiss-notifications"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {!wsConnected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2"
          >
            <div className="flex items-center justify-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              Reconnecting...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between p-4 md:p-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
            <Flame className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-bold block">{group.name}</span>
            <span className="text-xs text-muted-foreground">
              {restaurants.length - currentIndex} spots left
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {currentRestaurant && group.members.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => nudgeMutation.mutate(currentRestaurant.id)}
              disabled={nudgeMutation.isPending}
              title="Nudge crew members who haven't swiped"
              data-testid="button-nudge"
            >
              <Bell className="w-5 h-5" />
            </Button>
          )}
          <MemberAvatars members={group.members} size="sm" />
        </div>
      </header>

      {matches.length > 0 && (
        <motion.div
          className="px-4 md:px-6 shrink-0"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <Link href={`/group/${params.id}/matches`}>
            <Card className="bg-gradient-to-r from-accent/20 to-primary/10 border-2 border-accent/50 hover-elevate cursor-pointer">
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <PartyPopper className="w-5 h-5 text-accent" />
                  </motion.div>
                  <div>
                    <div className="font-bold text-sm">
                      {matches.length} Match{matches.length !== 1 ? "es" : ""}!
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Tap to see where everyone agrees!
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      )}

      <main className="flex-1 px-4 md:px-6 py-3 sm:py-6 flex flex-col safe-bottom">
        {isComplete ? (
          <motion.div
            className="flex-1 flex items-center justify-center"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Card className="w-full max-w-md text-center border-2">
              <CardContent className="py-12">
                <motion.div
                  className="text-6xl mb-6"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <PartyPopper className="w-16 h-16 text-primary mx-auto" />
                </motion.div>
                <h2 className="text-2xl font-extrabold mb-2">You're Done!</h2>
                <p className="text-muted-foreground mb-4">
                  {matches.length > 0
                    ? `Amazing! You've got ${matches.length} match${matches.length !== 1 ? "es" : ""} with your crew!`
                    : exhausted
                      ? "You've seen every option! Try expanding your preferences for more."
                      : allDone
                        ? "No matches yet — load more places or head home!"
                        : "Waiting for the rest of your crew..."
                  }
                </p>

                {!allDone && waitingMembers.length > 0 && (
                  <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Still swiping:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {waitingMembers.map(m => (
                        <span key={m.id} className="inline-flex items-center gap-1 px-2 py-1 bg-background rounded-md text-sm">
                          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                          {m.name}
                        </span>
                      ))}
                    </div>
                    {doneMembers.length > 0 && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Done: {doneMembers.map(m => m.name).join(", ")}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-3 items-center">
                  {matches.length > 0 && (
                    <Link href={`/group/${params.id}/matches`}>
                      <Button size="lg" className="bg-gradient-to-r from-primary to-orange-500" data-testid="button-view-matches">
                        See Your Matches!
                        <ChevronRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                  )}
                  {!exhausted && (
                    <Button
                      size="lg"
                      variant={matches.length > 0 ? "outline" : "default"}
                      onClick={() => loadMoreMutation.mutate()}
                      disabled={loadMoreMutation.isPending}
                      data-testid="button-load-more"
                    >
                      <RefreshCw className={`w-5 h-5 mr-2 ${loadMoreMutation.isPending ? "animate-spin" : ""}`} />
                      {loadMoreMutation.isPending ? "Loading..." : "Load 20 More Places"}
                    </Button>
                  )}
                  <Link href="/">
                    <Button size="lg" variant="outline" data-testid="button-back-home">
                      <Home className="w-5 h-5 mr-2" />
                      Back to Home
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            <div className="flex-1 relative max-w-md mx-auto w-full" style={{ minHeight: "min(400px, 55dvh)" }}>
              {nextRestaurant && (
                <SwipeCard
                  key={nextRestaurant.id}
                  restaurant={nextRestaurant}
                  onSwipe={() => { }}
                  isTop={false}
                />
              )}
              {currentRestaurant && (
                <SwipeCard
                  key={currentRestaurant.id}
                  restaurant={currentRestaurant}
                  onSwipe={handleSwipe}
                  isTop={true}
                  visitedBefore={visitedRestaurantIds.has(currentRestaurant.id)}
                />
              )}

            </div>

            <div className="shrink-0 max-w-md mx-auto w-full">
              <SwipeButtons
                onSwipe={handleSwipe}
                disabled={swipeMutation.isPending || isComplete}
              />

              <div className="hidden sm:flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground" data-testid="keyboard-hints">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">
                    <ArrowLeft className="w-3 h-3 inline" />
                  </kbd>
                  Nope
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">
                    <ArrowUp className="w-3 h-3 inline" />
                  </kbd>
                  Super
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">
                    <ArrowRight className="w-3 h-3 inline" />
                  </kbd>
                  Yum!
                </span>
              </div>

              <div className="flex justify-center gap-1 mt-3 sm:mt-6">
                {restaurants.slice(0, 10).map((_, i) => (
                  <motion.div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${i < currentIndex
                        ? "bg-primary"
                        : i === currentIndex
                          ? "bg-primary w-4"
                          : "bg-muted"
                      }`}
                    animate={i === currentIndex ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                ))}
                {restaurants.length > 10 && (
                  <span className="text-xs text-muted-foreground ml-1">
                    +{restaurants.length - 10}
                  </span>
                )}
              </div>

              {likedRestaurants.length >= 3 && (
                <motion.div
                  className="mt-3 sm:mt-6"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startFinalVote}
                    className="w-full text-muted-foreground"
                    data-testid="button-final-vote"
                  >
                    <Vote className="w-4 h-4 mr-2" />
                    Can't decide? Start Final Vote
                  </Button>
                </motion.div>
              )}
            </div>
          </>
        )}

        <AnimatePresence>
          {showFinalVote && (
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFinalVote(false)}
            >
              <motion.div
                className="bg-card rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-auto shadow-2xl border"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    <h2 className="text-2xl font-extrabold">Final Vote</h2>
                    <Trophy className="w-6 h-6 text-yellow-500" />
                  </div>
                  <p className="text-muted-foreground text-sm">Pick your favorite from your top choices!</p>

                  <div className="flex items-center justify-center gap-2 mt-4 text-lg font-bold">
                    <Timer className={`w-5 h-5 ${finalVoteTimer <= 10 ? 'text-destructive animate-pulse' : 'text-primary'}`} />
                    <span className={finalVoteTimer <= 10 ? 'text-destructive' : ''}>
                      {Math.floor(finalVoteTimer / 60)}:{(finalVoteTimer % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {likedRestaurants.slice(-5).reverse().map((restaurant, index) => (
                    <motion.div
                      key={restaurant.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card
                        className="overflow-hidden hover-elevate cursor-pointer"
                        onClick={() => selectFinalChoice(restaurant)}
                        data-testid={`card-final-vote-${restaurant.id}`}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <div
                            className="w-16 h-16 rounded-lg bg-cover bg-center shrink-0"
                            style={{ backgroundImage: `url(${restaurant.imageUrl})` }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold truncate">{restaurant.name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <span>{restaurant.cuisine}</span>
                              <span>{restaurant.priceRange}</span>
                            </div>
                            <div className="text-sm flex items-center gap-1 text-yellow-500">
                              <Flame className="w-3 h-3" />
                              <span>{(restaurant.combinedRating ?? restaurant.rating).toFixed(1)}</span>
                            </div>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                            #{index + 1}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-4 text-muted-foreground"
                  onClick={() => setShowFinalVote(false)}
                  data-testid="button-close-final-vote"
                >
                  Keep swiping
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
