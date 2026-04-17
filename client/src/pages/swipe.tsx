import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  SwipeCard,
  SwipeButtons,
  type SwipeAction,
  type SwipeCardHandle,
} from "@/components/swipe-card";
import { MemberAvatars } from "@/components/member-avatars";
import { apiRequest, queryClient, API_BASE, getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useGroupPushNotifications } from "@/hooks/use-push-notifications";
import { useAnalytics } from "@/hooks/use-analytics";
import { isNative } from "@/lib/platform";
import { Flame, ChevronRight, ChevronDown, ChevronUp, PartyPopper, Bell, Timer, Vote, Trophy, BellRing, X, Home, RefreshCw, ArrowLeft, ArrowRight, ArrowUp, Utensils, Heart, Sparkles, Undo2, MapPin, SlidersHorizontal } from "lucide-react";
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
  const [lastSwipe, setLastSwipe] = useState<{ restaurant: Restaurant; index: number } | null>(null);
  const [visitedRestaurantIds, setVisitedRestaurantIds] = useState<Set<string>>(new Set());
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(true);
  const [wsConnected, setWsConnected] = useState(true);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [memberProgress, setMemberProgress] = useState<Record<string, { swipeCount: number; total: number }>>({});
  const [showPrefs, setShowPrefs] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [autoNavTimer, setAutoNavTimer] = useState<number | null>(null);
  // Imperative handle to the top SwipeCard so button taps and keyboard input
  // can play the same spring animation as a hand gesture.
  const cardRef = useRef<SwipeCardHandle>(null);

  const { isAuthenticated } = useAuth();
  const memberId = localStorage.getItem("grubmatch-member-id");
  const { trackSwipe, flushNow } = useAnalytics(params.id, memberId || undefined);

  const {
    isPushSupported,
    permission,
    isSubscribed,
    isLoading: notificationLoading,
    subscribe: subscribeToNotifications,
    vapidReady,
  } = useGroupPushNotifications({
    groupId: params.id || "",
    memberId: memberId || ""
  });

  // Only offer the push banner when push actually works end-to-end. If the
  // server hasn't been configured with VAPID keys, vapidReady is false and
  // the "Enable" button would silently fail — hide it instead.
  const shouldShowNotificationPrompt =
    showNotificationPrompt &&
    isPushSupported &&
    vapidReady &&
    permission !== "granted" &&
    permission !== "denied" &&
    !isSubscribed;

  // Fetch visited restaurants from user's crews for smart exclusions.
  // Must use API_BASE + auth headers so this works on native (where the WebView
  // lives at capacitor://localhost and relative paths don't resolve to our API).
  useEffect(() => {
    const fetchVisitedRestaurants = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE}/api/sessions/visited-restaurants`, {
          credentials: "include",
          headers,
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
      const wsBase = isNative()
        ? "wss://chickentinders.onrender.com"
        : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;

      const apiUrl = import.meta.env.VITE_API_URL || "";
      let wsUrl: string;
      if (!isNative() && apiUrl) {
        const url = new URL(apiUrl);
        const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = `${wsProtocol}//${url.host}/ws?groupId=${params.id}&memberId=${memberId}`;
      } else {
        wsUrl = `${wsBase}/ws?groupId=${params.id}&memberId=${memberId}`;
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
        } else if (message.type === "member_progress") {
          setMemberProgress(prev => ({
            ...prev,
            [message.memberId]: { swipeCount: message.swipeCount, total: message.totalRestaurants },
          }));
        } else if (message.type === "all_done_swiping") {
          // Everyone's finished. Kick off a short countdown that auto-navigates
          // the whole group to /matches together, so a table of four friends
          // arrive at the decision screen at the same moment instead of each
          // wandering there individually. The countdown (not an instant redirect)
          // gives the user a 3-second "we're about to look!" beat and a chance
          // to opt out if they were mid-reading.
          setAutoNavTimer(3);
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
      const response = await apiRequest("POST", `/api/groups/${params.id}/restaurants/load-more`, {
        memberId,
      });
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

  const undoMutation = useMutation({
    mutationFn: async (restaurantId: string) => {
      const response = await apiRequest("POST", `/api/groups/${params.id}/undo-swipe`, {
        memberId,
        restaurantId,
      });
      return response.json();
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

  // Internal handler run AFTER the card exit animation completes (either from
  // a drag release or from a programmatic trigger). Buttons and keyboard call
  // the imperative trigger(), which animates the card and then invokes this.
  const commitSwipe = useCallback((action: SwipeAction) => {
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

    setLastSwipe({ restaurant, index: currentIndex });
    setCurrentIndex((prev) => prev + 1);
    // Intentionally omit `group` — it's not read inside this callback, and its
    // high-frequency updates from WebSocket sync would otherwise recreate this
    // handler on every message, defeating memoization and risking stale refs
    // in listeners that capture it.
  }, [currentIndex, restaurants, swipeMutation, params.id, trackSwipe]);

  // Public handler used by the action buttons and keyboard shortcuts. Triggers
  // the card's exit animation (so tapping a button *feels* like swiping) and
  // the underlying commit fires from inside the SwipeCard's `onSwipe` callback.
  // For drag gestures, SwipeCard calls playExit itself, then fires onSwipe —
  // so the end behavior is identical regardless of input modality.
  const handleSwipe = useCallback(
    (action: SwipeAction) => {
      if (currentIndex >= restaurants.length) return;
      if (cardRef.current) {
        // Triggering the card's imperative exit will call the card's onSwipe
        // prop (which is commitSwipe below) after the animation kicks off.
        cardRef.current.trigger(action);
      } else {
        // Fallback: no card mounted for some reason, fire the commit directly.
        commitSwipe(action);
      }
    },
    [commitSwipe, currentIndex, restaurants.length],
  );

  const handleUndo = useCallback(() => {
    if (!lastSwipe) return;

    const swiped = getSwipedIds();
    swiped.delete(lastSwipe.restaurant.id);
    localStorage.setItem(`swiped-${params.id}`, JSON.stringify(Array.from(swiped)));

    setLikedRestaurants(prev => prev.filter(r => r.id !== lastSwipe.restaurant.id));
    setCurrentIndex(lastSwipe.index);
    undoMutation.mutate(lastSwipe.restaurant.id);
    setLastSwipe(null);

    toast({
      title: "Undo!",
      description: `Back to ${lastSwipe.restaurant.name}`,
    });
  }, [lastSwipe, params.id, undoMutation, toast]);

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

  // Countdown that auto-navigates the entire group to /matches when the server
  // broadcasts `all_done_swiping`. This is the fix for the "silent handoff"
  // problem: previously each user had to notice and tap through individually,
  // so a group of friends never arrived at the decision screen together.
  useEffect(() => {
    if (autoNavTimer === null) return;
    if (autoNavTimer <= 0) {
      setLocation(`/group/${params.id}/matches`);
      return;
    }
    const t = setTimeout(() => setAutoNavTimer((v) => (v === null ? null : v - 1)), 1000);
    return () => clearTimeout(t);
  }, [autoNavTimer, params.id, setLocation]);

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

      {/* Synchronized "everyone's done!" overlay. Fires on the server's
          `all_done_swiping` WS broadcast, counts down, and auto-navigates the
          whole group to /matches in unison. Tapping "See matches now" skips the
          countdown; "Stay here" cancels it for users who want a moment. */}
      <AnimatePresence>
        {autoNavTimer !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setAutoNavTimer(null)}
          >
            <motion.div
              className="bg-card rounded-2xl p-8 max-w-sm w-[90%] text-center shadow-2xl border"
              initial={{ y: 30, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 30, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                className="flex justify-center mb-4"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.6, repeat: 2 }}
              >
                <PartyPopper className="w-14 h-14 text-primary" />
              </motion.div>
              <h2 className="text-2xl font-extrabold mb-1">Crew's Ready!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Everyone finished swiping. Heading to your matches in{" "}
                <span className="font-bold text-primary">{autoNavTimer}</span>...
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => setLocation(`/group/${params.id}/matches`)}
                  data-testid="button-see-matches-now"
                >
                  <PartyPopper className="w-5 h-5 mr-2" />
                  See matches now
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAutoNavTimer(null)}
                  data-testid="button-stay-on-swipe"
                >
                  Stay here
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    className="w-full"
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
                  } else {
                    // Silent-fail used to be the default — surface something
                    // so the user knows the click registered. Read
                    // Notification.permission directly (not the closed-over
                    // `permission` state, which was captured pre-prompt) to
                    // tailor the message when the user just denied the OS
                    // prompt.
                    const denied =
                      typeof Notification !== "undefined" &&
                      Notification.permission === "denied";
                    toast({
                      title: "Couldn't turn on notifications",
                      description: denied
                        ? "Notifications are blocked in your browser settings."
                        : "Something went wrong. Try again or enable them later.",
                      variant: "destructive",
                    });
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowExitConfirm(true)}
          className="text-muted-foreground"
          data-testid="button-exit-swipe"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
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
          <button
            type="button"
            onClick={() => setShowMembers((prev) => !prev)}
            aria-expanded={showMembers}
            aria-label={`${group.members.length} member${group.members.length !== 1 ? "s" : ""}, tap to ${showMembers ? "hide" : "see"} names`}
            className="rounded-full -m-1 p-1 hover:bg-muted transition-colors cursor-pointer"
            data-testid="button-members-toggle"
          >
            <MemberAvatars members={group.members} size="sm" progress={memberProgress} />
          </button>
        </div>
      </header>

      {/* Inline member list — tapping the avatar cluster in the header toggles
          this open. Shows everyone's name, host badge, swipe progress, and
          done status so the whole crew can see who they're waiting on without
          relying on desktop-only `title` tooltips. */}
      <AnimatePresence initial={false}>
        {showMembers && (
          <motion.div
            key="member-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden px-4 md:px-6 shrink-0"
          >
            <div className="rounded-lg border bg-muted/30 p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Crew ({group.members.length})
                </p>
                <button
                  type="button"
                  onClick={() => setShowMembers(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  data-testid="button-members-close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ul className="space-y-1.5">
                {group.members.map((member) => {
                  const prog = memberProgress[member.id];
                  const isMe = member.id === memberId;
                  return (
                    <li
                      key={member.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                      <span className={isMe ? "font-bold" : ""}>
                        {member.name}
                        {isMe ? " (you)" : ""}
                      </span>
                      {member.isHost && (
                        <span className="text-[10px] uppercase tracking-wide text-yellow-600 dark:text-yellow-400 font-semibold">
                          Host
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-2">
                        {prog && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {prog.swipeCount}/{prog.total}
                          </span>
                        )}
                        {member.doneSwiping ? (
                          <span className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-semibold">
                            Done
                          </span>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {group?.preferences && !isComplete && (
        <div className="px-4 md:px-6 shrink-0">
          <button
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            onClick={() => setShowPrefs(!showPrefs)}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Session Filters</span>
            {showPrefs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <AnimatePresence>
            {showPrefs && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 flex-wrap py-2 text-xs text-muted-foreground">
                  {group.preferences.zipCode && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50 border">
                      <MapPin className="w-3 h-3" />
                      {(() => {
                        const loc = group.preferences.zipCode;
                        if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(loc)) return "Near you";
                        return loc.length > 20 ? loc.substring(0, 20) + "..." : loc;
                      })()}
                    </span>
                  )}
                  {group.preferences.radius && (
                    <span className="px-2 py-1 rounded-full bg-muted/50 border">{group.preferences.radius} mi</span>
                  )}
                  {group.preferences.priceRange && group.preferences.priceRange.length > 0 && (
                    <span className="px-2 py-1 rounded-full bg-muted/50 border">{group.preferences.priceRange.join(" ")}</span>
                  )}
                  {group.preferences.minRating > 0 && (
                    <span className="px-2 py-1 rounded-full bg-muted/50 border">{group.preferences.minRating}+ stars</span>
                  )}
                  {group.preferences.cuisineTypes && group.preferences.cuisineTypes.length > 0 && (
                    <span className="px-2 py-1 rounded-full bg-muted/50 border">{group.preferences.cuisineTypes.slice(0, 3).join(", ")}{group.preferences.cuisineTypes.length > 3 ? "..." : ""}</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
                      <Button size="lg" className="" data-testid="button-view-matches">
                        See Your Matches!
                        <ChevronRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                  )}
                  {!exhausted && (
                    <Button
                      size="lg"
                      variant={matches.length > 0 ? "outline" : "default"}
                      className={matches.length > 0 ? "" : ""}
                      onClick={() => loadMoreMutation.mutate()}
                      disabled={loadMoreMutation.isPending}
                      data-testid="button-load-more"
                    >
                      {loadMoreMutation.isPending ? (
                        <>
                          <Utensils className="w-5 h-5 mr-2 animate-bounce" />
                          Finding restaurants nearby...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-5 h-5 mr-2" />
                          Load 20 More Places
                        </>
                      )}
                    </Button>
                  )}
                  <Link href={isAuthenticated ? "/dashboard" : "/"}>
                    <Button size="lg" variant="outline" data-testid="button-back-home">
                      <Home className="w-5 h-5 mr-2" />
                      {isAuthenticated ? "Back to Dashboard" : "Back to Home"}
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
                  ref={cardRef}
                  restaurant={currentRestaurant}
                  onSwipe={commitSwipe}
                  isTop={true}
                  visitedBefore={visitedRestaurantIds.has(currentRestaurant.id)}
                />
              )}

            </div>

            <div className="shrink-0 max-w-md mx-auto w-full">
              <AnimatePresence>
                {lastSwipe && !isComplete && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex justify-center mb-2"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUndo}
                      disabled={undoMutation.isPending}
                      className="text-muted-foreground"
                      data-testid="button-undo"
                    >
                      <Undo2 className="w-4 h-4 mr-1" />
                      Undo
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
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

      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowExitConfirm(false)}
          >
            <motion.div
              className="bg-card rounded-xl p-6 max-w-sm w-full shadow-2xl border"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-2">Leave swiping?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your swipes so far are saved. You can come back to keep swiping.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowExitConfirm(false)}
                >
                  Keep Swiping
                </Button>
                <Button variant="default" onClick={() => setLocation("/dashboard")}>
                  Leave
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
