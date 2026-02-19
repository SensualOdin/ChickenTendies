import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient, API_BASE } from "@/lib/queryClient";
import { openUrl } from "@/lib/open-url";
import { isNative } from "@/lib/platform";
import { Share } from "@capacitor/share";
import { MemberAvatars } from "@/components/member-avatars";
import {
  Flame, Loader2, Star, MapPin, ExternalLink, Heart, PartyPopper, Trophy, Sparkles,
  RefreshCw, CalendarPlus, Phone, Check, Truck, Share2, Pizza, Zap, Settings2,
  MoreHorizontal, Lock, X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ConversionPrompt } from "@/components/conversion-prompt";
import { getLeaderToken } from "@/lib/leader-token";
import confetti from "canvas-confetti";
import type { Group, Restaurant, WSMessage } from "@shared/schema";

type SessionAction = "directions" | "doordash" | "visited" | "reserve";

type VoteMap = Record<string, { memberId: string; memberName: string }[]>;

function generateCalendarUrl(restaurant: Restaurant, groupName: string) {
  const today = new Date();
  const dinnerDate = new Date(today);
  dinnerDate.setDate(today.getDate() + 1);
  dinnerDate.setHours(19, 0, 0, 0);

  const endDate = new Date(dinnerDate);
  endDate.setHours(21, 0, 0, 0);

  const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const title = encodeURIComponent(`Dinner at ${restaurant.name} - ${groupName}`);
  const details = encodeURIComponent(
    `Restaurant: ${restaurant.name}\n` +
    `Cuisine: ${restaurant.cuisine}\n` +
    `Rating: ${(restaurant.combinedRating ?? restaurant.rating).toFixed(1)} stars\n` +
    `Price: ${restaurant.priceRange}\n\n` +
    `Matched on ChickenTinders!`
  );
  const location = encodeURIComponent(restaurant.address);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDate(dinnerDate)}/${formatDate(endDate)}&details=${details}&location=${location}`;
}

function fireConfetti() {
  const duration = 3000;
  const end = Date.now() + duration;
  const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'];

  const frame = () => {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

export default function MatchesPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [visitedRestaurantId, setVisitedRestaurantId] = useState<string | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [showConversion, setShowConversion] = useState(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [votes, setVotes] = useState<VoteMap>({});
  const [pickedRestaurant, setPickedRestaurant] = useState<Restaurant | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const memberId = localStorage.getItem("grubmatch-member-id");

  const { data: group, isLoading: groupLoading } = useQuery<Group>({
    queryKey: ["/api/groups", params.id],
    enabled: !!params.id,
  });

  const { data: matches, isLoading: matchesLoading } = useQuery<Restaurant[]>({
    queryKey: ["/api/groups", params.id, "matches"],
    enabled: !!params.id,
    staleTime: 0,
  });

  // Fetch initial votes
  const { data: initialVotes } = useQuery<{ votes: VoteMap }>({
    queryKey: ["/api/groups", params.id, "match-votes"],
    enabled: !!params.id,
    staleTime: 0,
  });

  useEffect(() => {
    if (initialVotes?.votes) {
      setVotes(initialVotes.votes);
    }
  }, [initialVotes]);

  // WebSocket connection for real-time vote updates
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
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        const message: WSMessage = JSON.parse(event.data);

        if (message.type === "match_vote") {
          setVotes(prev => {
            const next = { ...prev };
            // Remove member's old vote from any restaurant
            for (const rId of Object.keys(next)) {
              next[rId] = next[rId].filter(v => v.memberId !== message.memberId);
              if (next[rId].length === 0) delete next[rId];
            }
            // Add new vote
            if (!next[message.restaurantId]) next[message.restaurantId] = [];
            next[message.restaurantId].push({ memberId: message.memberId, memberName: message.memberName });
            return next;
          });
        } else if (message.type === "match_picked") {
          setPickedRestaurant(message.restaurant);
          fireConfetti();
        } else if (message.type === "match_found") {
          // New match while on this page — refetch
          queryClient.invalidateQueries({ queryKey: ["/api/groups", params.id, "matches"] });
        }
      };

      socket.onclose = () => {
        if (isClosedIntentionally) return;
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectTimeout = setTimeout(connect, delay);
        }
      };

      socket.onerror = () => {};

      wsRef.current = socket;
    };

    connect();

    return () => {
      isClosedIntentionally = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    };
  }, [params.id, memberId]);

  // Sort matches by vote count descending
  const sortedMatches = useMemo(() => {
    if (!matches) return [];
    return [...matches].sort((a, b) => {
      const aVotes = votes[a.id]?.length || 0;
      const bVotes = votes[b.id]?.length || 0;
      return bVotes - aVotes;
    });
  }, [matches, votes]);

  const isHost = group?.members.find(m => m.id === memberId)?.isHost ?? false;

  // Determine top-voted restaurant
  const topVotedId = useMemo(() => {
    if (sortedMatches.length === 0) return null;
    const topCount = votes[sortedMatches[0]?.id]?.length || 0;
    if (topCount === 0) return null;
    return sortedMatches[0].id;
  }, [sortedMatches, votes]);

  // Which restaurant did I vote for?
  const myVoteRestaurantId = useMemo(() => {
    for (const [rId, voters] of Object.entries(votes)) {
      if (voters.some(v => v.memberId === memberId)) return rId;
    }
    return null;
  }, [votes, memberId]);

  const memberName = group?.members.find(m => m.id === memberId)?.name ?? "You";

  const voteMutation = useMutation({
    mutationFn: async (restaurantId: string) => {
      const response = await apiRequest("POST", `/api/groups/${params.id}/vote-match`, {
        memberId,
        restaurantId,
      });
      return response.json();
    },
    onMutate: (restaurantId: string) => {
      // Optimistic update — apply immediately
      setVotes(prev => {
        const next = { ...prev };
        for (const rId of Object.keys(next)) {
          next[rId] = next[rId].filter(v => v.memberId !== memberId);
          if (next[rId].length === 0) delete next[rId];
        }
        if (!next[restaurantId]) next[restaurantId] = [];
        next[restaurantId].push({ memberId: memberId!, memberName });
        return next;
      });
    },
    onError: () => {
      toast({
        title: "Vote failed",
        description: "Something went wrong. Try again!",
        variant: "destructive",
      });
      // Refetch votes to reset state
      queryClient.invalidateQueries({ queryKey: ["/api/groups", params.id, "match-votes"] });
    },
  });

  const pickMutation = useMutation({
    mutationFn: async (restaurantId: string) => {
      const response = await apiRequest("POST", `/api/groups/${params.id}/pick-match`, {
        memberId,
        restaurantId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.restaurant) {
        setPickedRestaurant(data.restaurant);
        fireConfetti();
      }
    },
    onError: () => {
      toast({
        title: "Couldn't lock in",
        description: "Something went wrong. Try again!",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (authLoading || isAuthenticated || !matches?.length) return;
    const dismissed = sessionStorage.getItem(`chickentinders-conversion-dismissed-${params.id}`);
    if (dismissed) return;

    const handleInteraction = () => {
      setShowConversion(true);
      cleanup();
    };
    const cleanup = () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("scroll", handleInteraction, true);
    };
    const timer = setTimeout(() => {
      document.addEventListener("click", handleInteraction, { once: true });
      document.addEventListener("scroll", handleInteraction, { once: true, capture: true });
    }, 2000);
    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [authLoading, isAuthenticated, matches, params.id]);

  const loadMoreMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/groups/${params.id}/restaurants/load-more`);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/groups", params.id, "restaurants"] });
      setLocation(`/group/${params.id}/swipe`);
    },
  });

  const rematchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/groups/${params.id}/start-session`, {
        hostMemberId: memberId,
        preferences: group?.preferences,
      });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/groups", params.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/groups", params.id, "restaurants"] });
      setLocation(`/group/${params.id}/swipe`);
    },
    onError: () => {
      toast({
        title: "Couldn't start rematch",
        description: "Something went wrong. Try again!",
        variant: "destructive",
      });
    },
  });

  const completeSession = useCallback(async (restaurantId?: string, action?: SessionAction) => {
    if (sessionCompleted || !params.id) return;
    try {
      await apiRequest("POST", `/api/crews/${params.id}/complete-session`, {
        restaurantId,
        action,
      });
      setSessionCompleted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/crews"] });
    } catch {
    }
  }, [sessionCompleted, params.id]);

  const handleShare = useCallback(async (restaurant: Restaurant) => {
    const rating = (restaurant.combinedRating ?? restaurant.rating).toFixed(1);
    const inviteCode = (group as any)?.inviteCode;
    const shareUrl = inviteCode
      ? `${window.location.origin}/crew/join/${inviteCode}`
      : window.location.origin;
    const shareText = `We matched on ${restaurant.name} (${rating} stars, ${restaurant.cuisine}, ${restaurant.priceRange}) on ChickenTinders!${inviteCode ? " Join our crew:" : ""}`;

    if (isNative()) {
      try {
        await Share.share({
          title: `${restaurant.name} - ChickenTinders Match!`,
          text: shareText,
          url: shareUrl,
          dialogTitle: "Share your match",
        });
      } catch { }
    } else if (navigator.share) {
      try {
        await navigator.share({
          title: `${restaurant.name} - ChickenTinders Match!`,
          text: shareText,
          url: shareUrl,
        });
      } catch { }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        toast({
          title: "Copied to clipboard!",
          description: "Share the link with your friends.",
        });
      } catch {
        toast({
          title: "Couldn't copy",
          description: "Try manually copying the URL.",
          variant: "destructive",
        });
      }
    }
  }, [params.id, toast, group]);

  const isLoading = groupLoading || matchesLoading;

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
    <div className="min-h-screen bg-background safe-top safe-x">
      {/* Pick celebration overlay */}
      <AnimatePresence>
        {pickedRestaurant && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setPickedRestaurant(null)}
          >
            <motion.div
              className="text-center p-8 max-w-sm"
              initial={{ y: 50, scale: 0.9 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 50, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: 3 }}
                className="mb-4"
              >
                <PartyPopper className="w-16 h-16 text-white mx-auto" />
              </motion.div>
              <h2 className="text-3xl font-extrabold text-white mb-1">IT'S DECIDED!</h2>
              <p className="text-xl text-white/90 font-bold mb-2">{pickedRestaurant.name}</p>
              <p className="text-white/60 mb-6">{pickedRestaurant.cuisine} &middot; {pickedRestaurant.priceRange}</p>

              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-primary to-orange-500"
                  onClick={() => {
                    const destination = pickedRestaurant.latitude && pickedRestaurant.longitude
                      ? `${pickedRestaurant.latitude},${pickedRestaurant.longitude}`
                      : encodeURIComponent(pickedRestaurant.address);
                    openUrl(`https://www.google.com/maps/dir/?api=1&destination=${destination}`);
                    completeSession(pickedRestaurant.id, "directions");
                  }}
                >
                  <MapPin className="w-5 h-5 mr-2" />
                  Let's Go!
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => handleShare(pickedRestaurant)}
                >
                  <Share2 className="w-5 h-5 mr-2" />
                  Share with the Squad
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full text-white/50 hover:text-white hover:bg-white/10"
                  onClick={() => setPickedRestaurant(null)}
                >
                  Dismiss
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between p-4 md:p-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation(`/group/${params.id}/swipe`)}
          data-testid="button-back-to-swiping"
        >
          <Flame className="w-4 h-4 mr-1" />
          Keep Swiping
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
            <Flame className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold">{group.name}</span>
        </div>
      </header>

      <main className="px-4 md:px-6 py-6 max-w-2xl mx-auto safe-bottom">
        <motion.div
          className="text-center mb-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <motion.div
            className="flex justify-center mb-4"
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <PartyPopper className="w-12 h-12 text-primary" />
          </motion.div>
          <h1 className="text-3xl font-extrabold mb-2">
            {sortedMatches.length
              ? `${sortedMatches.length} Match${sortedMatches.length !== 1 ? "es" : ""}!`
              : "No Matches Yet"
            }
          </h1>
          <p className="text-muted-foreground">
            {sortedMatches.length
              ? "Vote for your top pick"
              : "Keep swiping to find spots everyone loves!"
            }
          </p>
          {sortedMatches.length > 0 && group.members.length > 0 && (
            <div className="flex justify-center mt-3">
              <MemberAvatars members={group.members} size="sm" />
            </div>
          )}
        </motion.div>

        {sortedMatches.length > 0 ? (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {sortedMatches.map((restaurant, index) => {
                const restaurantVotes = votes[restaurant.id] || [];
                const voteCount = restaurantVotes.length;
                const iVoted = myVoteRestaurantId === restaurant.id;
                const isTopPick = restaurant.id === topVotedId;
                const showLockIn = isHost && (isTopPick || sortedMatches.length === 1);

                return (
                  <motion.div
                    key={restaurant.id}
                    layout
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05, layout: { duration: 0.3 } }}
                  >
                    <Card className={`overflow-hidden border-2 hover-elevate ${isTopPick ? "border-yellow-500/50 shadow-lg shadow-yellow-500/10" : ""}`}>
                      <div className="flex flex-col sm:flex-row">
                        <div
                          className="h-48 sm:h-auto sm:w-40 bg-cover bg-center shrink-0 relative"
                          style={{ backgroundImage: `url(${restaurant.imageUrl})` }}
                        >
                          {isTopPick && (
                            <div className="absolute top-2 left-2">
                              <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 shadow-lg">
                                <Trophy className="w-3 h-3 mr-1" />
                                Top Pick
                              </Badge>
                            </div>
                          )}
                        </div>
                        <CardContent className="flex-1 p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <h3 className="text-lg font-bold" data-testid={`text-match-name-${restaurant.id}`}>
                                {restaurant.name}
                              </h3>
                              <span className="text-sm text-muted-foreground">{restaurant.cuisine}</span>
                            </div>
                            <Badge variant="outline" className="font-bold">{restaurant.priceRange}</Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-3">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="font-medium text-foreground">{(restaurant.combinedRating ?? restaurant.rating).toFixed(1)}</span>
                              {restaurant.googleRating != null ? (
                                <span className="text-xs text-muted-foreground">
                                  {restaurant.reviewCount + (restaurant.googleReviewCount ?? 0)} reviews
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">{restaurant.reviewCount} reviews</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              <span>{restaurant.distance.toFixed(1)} mi</span>
                            </div>
                          </div>

                          {/* Vote section */}
                          <div className="flex items-center gap-3 mb-3">
                            <Button
                              size="sm"
                              variant={iVoted ? "default" : "outline"}
                              className={iVoted
                                ? "bg-gradient-to-r from-primary to-orange-500 text-white"
                                : "border-primary/30 text-primary hover:bg-primary/10"
                              }
                              onClick={() => voteMutation.mutate(restaurant.id)}
                              disabled={voteMutation.isPending}
                            >
                              <Flame className="w-4 h-4 mr-1" />
                              {iVoted ? "Voted!" : "Vote"}
                            </Button>
                            {voteCount > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-foreground">{voteCount}</span>
                                <span className="text-xs text-muted-foreground">vote{voteCount !== 1 ? "s" : ""}</span>
                                <div className="flex -space-x-1 ml-1">
                                  {restaurantVotes.slice(0, 4).map((v, i) => (
                                    <div
                                      key={v.memberId}
                                      className="w-5 h-5 rounded-full bg-primary/20 border border-background flex items-center justify-center text-[8px] font-bold text-primary"
                                      title={v.memberName}
                                    >
                                      {v.memberName.charAt(0).toUpperCase()}
                                    </div>
                                  ))}
                                  {restaurantVotes.length > 4 && (
                                    <div className="w-5 h-5 rounded-full bg-muted border border-background flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                                      +{restaurantVotes.length - 4}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Lock It In button for host */}
                          {showLockIn && (
                            <Button
                              size="sm"
                              className="w-full mb-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold shadow-lg"
                              onClick={() => pickMutation.mutate(restaurant.id)}
                              disabled={pickMutation.isPending}
                            >
                              {pickMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <Lock className="w-4 h-4 mr-1" />
                              )}
                              Lock It In!
                            </Button>
                          )}

                          {/* Action buttons in collapsible details */}
                          <details className="group">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none flex items-center gap-1">
                              <MoreHorizontal className="w-3 h-3" />
                              Actions
                            </summary>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Button
                                size="sm"
                                className="bg-gradient-to-r from-primary to-orange-500 text-xs"
                                data-testid={`button-directions-${restaurant.id}`}
                                onClick={() => {
                                  const destination = restaurant.latitude && restaurant.longitude
                                    ? `${restaurant.latitude},${restaurant.longitude}`
                                    : encodeURIComponent(restaurant.address);
                                  openUrl(`https://www.google.com/maps/dir/?api=1&destination=${destination}`);
                                  completeSession(restaurant.id, "directions");
                                }}
                              >
                                <MapPin className="w-3 h-3 mr-1" />
                                Directions
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                data-testid={`button-share-${restaurant.id}`}
                                onClick={() => handleShare(restaurant)}
                              >
                                <Share2 className="w-3 h-3 mr-1" />
                                Share
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="outline" className="text-xs px-2">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      const query = encodeURIComponent(restaurant.name);
                                      openUrl(`https://www.doordash.com/search/store/${query}/`);
                                      completeSession(restaurant.id, "doordash");
                                    }}
                                  >
                                    <Truck className="w-4 h-4 mr-2" />
                                    DoorDash
                                  </DropdownMenuItem>
                                  {restaurant.yelpUrl && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        openUrl(restaurant.yelpUrl!);
                                        completeSession(restaurant.id, "reserve");
                                      }}
                                    >
                                      <Phone className="w-4 h-4 mr-2" />
                                      Reserve
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      openUrl(generateCalendarUrl(restaurant, group.name));
                                    }}
                                  >
                                    <CalendarPlus className="w-4 h-4 mr-2" />
                                    Add to Calendar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setVisitedRestaurantId(restaurant.id);
                                      completeSession(restaurant.id, "visited");
                                      toast({
                                        title: "Session wrapped up!",
                                        description: `Marked "${restaurant.name}" as visited. Start a new session anytime!`
                                      });
                                    }}
                                  >
                                    <Check className="w-4 h-4 mr-2" />
                                    {visitedRestaurantId === restaurant.id ? "Going here!" : "We went here"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </details>
                        </CardContent>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <Card className="text-center py-12 border-2 border-dashed">
              <CardContent>
                <motion.div
                  className="flex justify-center mb-4"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Pizza className="w-12 h-12 text-primary" />
                </motion.div>
                <h3 className="font-bold text-lg mb-2">No matches yet!</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Keep swiping — your perfect spot is waiting!
                </p>
                <Button
                  className="bg-gradient-to-r from-primary to-orange-500"
                  data-testid="button-back-to-swiping"
                  onClick={() => loadMoreMutation.mutate()}
                  disabled={loadMoreMutation.isPending}
                >
                  {loadMoreMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Load More Restaurants
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {sortedMatches.length > 0 && (
          <motion.div
            className="mt-8 text-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-sm text-muted-foreground mb-4">
              Want more options?
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                className="bg-gradient-to-r from-primary to-orange-500"
                data-testid="button-continue-swiping"
                onClick={() => setLocation(`/group/${params.id}/swipe`)}
              >
                <Flame className="w-4 h-4 mr-2" />
                Back to Swiping
              </Button>
              <Button
                variant="outline"
                className="border-2"
                onClick={() => loadMoreMutation.mutate()}
                disabled={loadMoreMutation.isPending}
              >
                {loadMoreMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading More...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Load 20 More
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {showConversion && group && matches && matches.length > 0 && (
          <ConversionPrompt
            groupId={params.id!}
            groupName={group.name}
            matchCount={matches.length}
            onDismiss={() => {
              setShowConversion(false);
              sessionStorage.setItem(`chickentinders-conversion-dismissed-${params.id}`, "true");
            }}
          />
        )}
      </main>
    </div>
  );
}
