import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { SwipeCard, SwipeButtons } from "@/components/swipe-card";
import { MemberAvatars } from "@/components/member-avatars";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Utensils, Loader2, Trophy, ChevronRight, Sparkles } from "lucide-react";
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
        toast({
          title: "It's a Match!",
          description: `Everyone likes ${message.restaurant.name}!`,
        });
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
        title: "Error",
        description: "Failed to record swipe. Please try again.",
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between p-4 md:p-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Utensils className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-bold block">{group.name}</span>
            <span className="text-xs text-muted-foreground">
              {restaurants.length - currentIndex} restaurants left
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <MemberAvatars members={group.members} size="sm" />
          <ThemeToggle />
        </div>
      </header>

      {matches.length > 0 && (
        <div className="px-4 md:px-6 shrink-0">
          <Link href={`/group/${params.id}/matches`}>
            <Card className="bg-gradient-to-r from-accent/10 to-primary/10 border-accent/30 hover-elevate cursor-pointer">
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">
                      {matches.length} Match{matches.length !== 1 ? "es" : ""}!
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Tap to see restaurants everyone loves
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      <main className="flex-1 px-4 md:px-6 py-6 flex flex-col">
        {isComplete ? (
          <div className="flex-1 flex items-center justify-center">
            <Card className="w-full max-w-md text-center">
              <CardContent className="py-12">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Trophy className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">You're all done!</h2>
                <p className="text-muted-foreground mb-6">
                  You've swiped through all the restaurants. 
                  {matches.length > 0 
                    ? ` You have ${matches.length} match${matches.length !== 1 ? "es" : ""} with your group!`
                    : " Wait for your group to finish swiping to see matches."
                  }
                </p>
                {matches.length > 0 && (
                  <Link href={`/group/${params.id}/matches`}>
                    <Button size="lg" data-testid="button-view-matches">
                      View Matches
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
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
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i < currentIndex
                        ? "bg-primary"
                        : i === currentIndex
                        ? "bg-primary w-4"
                        : "bg-muted"
                    }`}
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
