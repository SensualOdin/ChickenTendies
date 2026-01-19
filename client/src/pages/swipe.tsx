import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { SwipeCard, SwipeButtons } from "@/components/swipe-card";
import { MemberAvatars } from "@/components/member-avatars";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Flame, Loader2, Trophy, ChevronRight, Sparkles, PartyPopper } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Group, Restaurant, WSMessage } from "@shared/schema";

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

  const memberId = localStorage.getItem("grubmatch-member-id");

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
    if (initialRestaurants) setRestaurants(initialRestaurants);
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
        setRestaurants(message.restaurants);
        setMatches(message.matches);
      } else if (message.type === "match_found") {
        setMatches((prev) => [...prev, message.restaurant]);
        setLatestMatch(message.restaurant);
        setShowMatchCelebration(true);
        setTimeout(() => setShowMatchCelebration(false), 3000);
      }
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [params.id, memberId]);

  const swipeMutation = useMutation({
    mutationFn: async ({ restaurantId, liked }: { restaurantId: string; liked: boolean }) => {
      const response = await apiRequest("POST", `/api/groups/${params.id}/swipe`, {
        restaurantId,
        liked,
        memberId,
      });
      return response.json();
    },
    onError: () => {
      toast({
        title: "Oops! 😅",
        description: "That didn't work. Try again!",
        variant: "destructive",
      });
    },
  });

  const handleSwipe = useCallback((liked: boolean) => {
    if (currentIndex >= restaurants.length) return;
    
    const restaurant = restaurants[currentIndex];
    swipeMutation.mutate({ restaurantId: restaurant.id, liked });
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, restaurants, swipeMutation]);

  const isLoading = groupLoading || restaurantsLoading;
  const currentRestaurant = restaurants[currentIndex];
  const nextRestaurant = restaurants[currentIndex + 1];
  const isComplete = currentIndex >= restaurants.length;

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
    <div className="min-h-screen bg-background flex flex-col relative">
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

      <main className="flex-1 px-4 md:px-6 py-6 flex flex-col">
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
                  🏆
                </motion.div>
                <h2 className="text-2xl font-extrabold mb-2">You're Done!</h2>
                <p className="text-muted-foreground mb-6">
                  {matches.length > 0 
                    ? `Amazing! You've got ${matches.length} match${matches.length !== 1 ? "es" : ""} with your crew!`
                    : "Waiting for your squad to finish swiping..."
                  }
                </p>
                {matches.length > 0 && (
                  <Link href={`/group/${params.id}/matches`}>
                    <Button size="lg" className="bg-gradient-to-r from-primary to-orange-500" data-testid="button-view-matches">
                      See Your Matches! 🎉
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            <div className="flex-1 relative max-w-md mx-auto w-full" style={{ minHeight: "400px" }}>
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
                />
              )}
            </div>

            <div className="shrink-0 max-w-md mx-auto w-full">
              <SwipeButtons 
                onSwipe={handleSwipe} 
                disabled={swipeMutation.isPending || isComplete}
              />

              <div className="flex justify-center gap-1 mt-6">
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
            </div>
          </>
        )}
      </main>
    </div>
  );
}
