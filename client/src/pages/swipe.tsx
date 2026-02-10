import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SwipeCard, SwipeButtons, type SwipeAction } from "@/components/swipe-card";
import { MemberAvatars } from "@/components/member-avatars";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useGroupPushNotifications } from "@/hooks/use-push-notifications";
import { useAnalytics } from "@/hooks/use-analytics";
import { Flame, ChevronRight, PartyPopper, Bell, Timer, Vote, Trophy, Heart, ThumbsUp, Eye, Star, Utensils, BellRing, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Group, Restaurant, WSMessage, ReactionType } from "@shared/schema";
import confetti from "canvas-confetti";

export default function SwipePage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matches, setMatches] = useState<Restaurant[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [showMatchCelebration, setShowMatchCelebration] = useState(false);
  const [latestMatch, setLatestMatch] = useState<Restaurant | null>(null);
  const [showFinalVote, setShowFinalVote] = useState(false);
  const [finalVoteTimer, setFinalVoteTimer] = useState(60);
  const [likedRestaurants, setLikedRestaurants] = useState<Restaurant[]>([]);
  const [liveReactions, setLiveReactions] = useState<Array<{id: string; memberId: string; memberName: string; reaction: ReactionType; restaurantId: string}>>([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [visitedRestaurantIds, setVisitedRestaurantIds] = useState<Set<string>>(new Set());
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(true);

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

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?groupId=${params.id}&memberId=${memberId}`;
    const socket = new WebSocket(wsUrl);

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
        // Fire confetti celebration!
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
        
        setTimeout(() => setShowMatchCelebration(false), 3000);
      } else if (message.type === "nudge") {
        // Only show nudge if current user is in the target list
        if (!message.targetMemberIds || message.targetMemberIds.includes(memberId)) {
          toast({
            title: `${message.fromMemberName} is hungry!`,
            description: `They're waiting for you to swipe on ${message.restaurantName}`,
          });
        }
      } else if (message.type === "member_done_swiping") {
        // Update group state to reflect member completion
        setGroup((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            members: prev.members.map(m => 
              m.id === message.memberId ? { ...m, doneSwiping: true } : m
            ),
          };
        });
        // Only show toast if it's not the current user
        if (message.memberId !== memberId) {
          toast({
            title: `${message.memberName} finished swiping!`,
            description: "They're waiting for everyone else",
          });
        }
      } else if (message.type === "live_reaction") {
        // Add the reaction to display
        const reactionId = `${message.memberId}-${Date.now()}`;
        setLiveReactions(prev => [...prev, { ...message, id: reactionId }]);
        // Remove reaction after animation
        setTimeout(() => {
          setLiveReactions(prev => prev.filter(r => r.id !== reactionId));
        }, 2500);
      }
    };

    setWs(socket);

    return () => {
      socket.close();
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
      // Invalidate group query to ensure UI is up to date
      queryClient.invalidateQueries({ queryKey: ["/api/groups", params.id] });
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

  const reactionMutation = useMutation({
    mutationFn: async (reaction: ReactionType) => {
      if (!currentRestaurant || !memberId) return;
      const memberName = group?.members.find(m => m.id === memberId)?.name || "Someone";
      const response = await apiRequest("POST", `/api/groups/${params.id}/reaction`, {
        memberId,
        memberName,
        reaction,
        restaurantId: currentRestaurant.id,
      });
      return response.json();
    },
  });

  const sendReaction = (reaction: ReactionType) => {
    reactionMutation.mutate(reaction);
    setShowReactionPicker(false);
  };

  const reactionIcons: Record<ReactionType, { icon: typeof Flame; color: string }> = {
    fire: { icon: Flame, color: "text-orange-500" },
    heart: { icon: Heart, color: "text-pink-500" },
    drool: { icon: Utensils, color: "text-yellow-500" },
    thumbsup: { icon: ThumbsUp, color: "text-blue-500" },
    eyes: { icon: Eye, color: "text-purple-500" },
    star: { icon: Star, color: "text-yellow-400" },
  };

  const handleSwipe = useCallback((action: SwipeAction) => {
    if (currentIndex >= restaurants.length) return;
    
    const restaurant = restaurants[currentIndex];
    const liked = action === "like" || action === "superlike";
    const superLiked = action === "superlike";
    swipeMutation.mutate({ restaurantId: restaurant.id, liked, superLiked });
    saveSwipedId(restaurant.id);

    const analyticsAction = superLiked ? "super_like" as const : liked ? "swipe_right" as const : "swipe_left" as const;
    trackSwipe(restaurant, analyticsAction, {
      lat: group?.preferences?.latitude,
      lng: group?.preferences?.longitude,
    });
    
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
      <AnimatePresence>
        {showMatchCelebration && latestMatch && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              className="text-center p-8"
              initial={{ y: 50 }}
              animate={{ y: 0 }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: 3 }}
                className="text-8xl mb-6"
              >
                🎉
              </motion.div>
              <h2 className="text-4xl font-extrabold text-white mb-2">IT'S A MATCH!</h2>
              <p className="text-xl text-white/80 mb-4">Everyone wants {latestMatch.name}!</p>
              <div className="flex justify-center gap-2 text-4xl">
                <motion.span animate={{ y: [0, -10, 0] }} transition={{ duration: 0.5, delay: 0 }}>🍗</motion.span>
                <motion.span animate={{ y: [0, -10, 0] }} transition={{ duration: 0.5, delay: 0.1 }}>🍕</motion.span>
                <motion.span animate={{ y: [0, -10, 0] }} transition={{ duration: 0.5, delay: 0.2 }}>🌮</motion.span>
                <motion.span animate={{ y: [0, -10, 0] }} transition={{ duration: 0.5, delay: 0.3 }}>🍔</motion.span>
                <motion.span animate={{ y: [0, -10, 0] }} transition={{ duration: 0.5, delay: 0.4 }}>🍣</motion.span>
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

      <header className="flex items-center justify-between p-4 md:p-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
            <Flame className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-bold block">{group.name}</span>
            <span className="text-xs text-muted-foreground">
              {restaurants.length - currentIndex} spots left 🍽️
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
          <ThemeToggle />
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
                      {matches.length} Match{matches.length !== 1 ? "es" : ""}! 🎉
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
                    : allDone 
                      ? "Everyone's finished! Check out your matches below."
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
                
                {matches.length > 0 && (
                  <Link href={`/group/${params.id}/matches`}>
                    <Button size="lg" className="bg-gradient-to-r from-primary to-orange-500" data-testid="button-view-matches">
                      See Your Matches!
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                )}
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
                  onSwipe={() => {}}
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

              <AnimatePresence>
                {liveReactions.filter(r => r.restaurantId === currentRestaurant?.id).map((reaction, index) => {
                  const ReactionIcon = reactionIcons[reaction.reaction].icon;
                  const colorClass = reactionIcons[reaction.reaction].color;
                  return (
                    <motion.div
                      key={reaction.id}
                      className="absolute pointer-events-none z-20"
                      initial={{ 
                        x: 50 + (index % 3) * 60, 
                        y: 200 + (index % 2) * 40, 
                        scale: 0, 
                        opacity: 0 
                      }}
                      animate={{ 
                        y: 50, 
                        scale: 1, 
                        opacity: 1 
                      }}
                      exit={{ 
                        y: -50, 
                        opacity: 0, 
                        scale: 0.5 
                      }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    >
                      <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg">
                        <ReactionIcon className={`w-5 h-5 ${colorClass}`} />
                        <span className="text-white text-sm font-medium">{reaction.memberName}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              <AnimatePresence>
                {showReactionPicker && (
                  <motion.div
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30"
                    initial={{ y: 20, opacity: 0, scale: 0.9 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 20, opacity: 0, scale: 0.9 }}
                  >
                    <div className="flex gap-2 bg-card/95 backdrop-blur-sm rounded-full px-3 py-2 shadow-xl border">
                      {(Object.keys(reactionIcons) as ReactionType[]).map((reactionType) => {
                        const { icon: Icon, color } = reactionIcons[reactionType];
                        return (
                          <Button
                            key={reactionType}
                            size="icon"
                            variant="ghost"
                            className="rounded-full"
                            onClick={() => sendReaction(reactionType)}
                            data-testid={`button-reaction-${reactionType}`}
                          >
                            <Icon className={`w-5 h-5 ${color}`} />
                          </Button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                size="icon"
                variant="ghost"
                className="absolute bottom-4 right-4 z-20 rounded-full bg-background/80 backdrop-blur-sm shadow-lg"
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                data-testid="button-toggle-reactions"
              >
                <Heart className={`w-5 h-5 ${showReactionPicker ? 'text-pink-500 fill-pink-500' : ''}`} />
              </Button>
            </div>

            <div className="shrink-0 max-w-md mx-auto w-full">
              <SwipeButtons 
                onSwipe={handleSwipe} 
                disabled={swipeMutation.isPending || isComplete}
              />

              <div className="flex justify-center gap-1 mt-3 sm:mt-6">
                {restaurants.slice(0, 10).map((_, i) => (
                  <motion.div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i < currentIndex
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
                              <span>{restaurant.rating}</span>
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
