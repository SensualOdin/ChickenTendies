import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Home, Flame, Loader2, Star, MapPin, ExternalLink, Heart, PartyPopper, Trophy, Sparkles, RefreshCw, CalendarPlus, Phone, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Group, Restaurant } from "@shared/schema";

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
    `Rating: ${restaurant.rating.toFixed(1)} stars\n` +
    `Price: ${restaurant.priceRange}\n\n` +
    `Matched on ChickenTinders!`
  );
  const location = encodeURIComponent(restaurant.address);
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDate(dinnerDate)}/${formatDate(endDate)}&details=${details}&location=${location}`;
}

export default function MatchesPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [visitedRestaurantId, setVisitedRestaurantId] = useState<string | null>(null);

  const { data: group, isLoading: groupLoading } = useQuery<Group>({
    queryKey: ["/api/groups", params.id],
    enabled: !!params.id,
  });

  const { data: matches, isLoading: matchesLoading } = useQuery<Restaurant[]>({
    queryKey: ["/api/groups", params.id, "matches"],
    enabled: !!params.id,
  });

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
      <header className="flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" data-testid="button-home">
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
            <Flame className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold">{group.name}</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="px-4 md:px-6 py-6 max-w-2xl mx-auto safe-bottom">
        <motion.div 
          className="text-center mb-8"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <motion.div 
            className="text-6xl mb-4"
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🎊
          </motion.div>
          <h1 className="text-3xl font-extrabold mb-2">
            {matches?.length ? "Your Matches!" : "No Matches Yet"}
          </h1>
          <p className="text-muted-foreground">
            {matches?.length 
              ? `The squad agreed on ${matches.length} spot${matches.length !== 1 ? "s" : ""}! Time to eat! 🍽️`
              : "Keep swiping to find spots everyone loves!"
            }
          </p>
        </motion.div>

        {matches && matches.length > 0 ? (
          <div className="space-y-4">
            {matches.map((restaurant, index) => (
              <motion.div
                key={restaurant.id}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="overflow-hidden border-2 hover-elevate">
                  <div className="flex flex-col sm:flex-row">
                    <div 
                      className="h-48 sm:h-auto sm:w-40 bg-cover bg-center shrink-0 relative"
                      style={{ backgroundImage: `url(${restaurant.imageUrl})` }}
                    >
                      {index === 0 && (
                        <div className="absolute top-2 left-2">
                          <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 shadow-lg">
                            <Trophy className="w-3 h-3 mr-1" />
                            #1 Pick!
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
                          <span className="font-medium text-foreground">{restaurant.rating.toFixed(1)}</span>
                          <span>({restaurant.reviewCount})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{restaurant.distance.toFixed(1)} mi</span>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {restaurant.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <Button 
                          size="sm" 
                          className="bg-gradient-to-r from-primary to-orange-500 text-xs" 
                          data-testid={`button-directions-${restaurant.id}`}
                          onClick={() => {
                            const destination = restaurant.latitude && restaurant.longitude
                              ? `${restaurant.latitude},${restaurant.longitude}`
                              : encodeURIComponent(restaurant.address);
                            window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
                          }}
                        >
                          <MapPin className="w-3 h-3 mr-1" />
                          Let's Go!
                        </Button>
                        {restaurant.yelpUrl && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-xs" 
                            data-testid={`button-reserve-${restaurant.id}`}
                            onClick={() => {
                              window.open(restaurant.yelpUrl, '_blank');
                            }}
                          >
                            <Phone className="w-3 h-3 mr-1" />
                            Reserve
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs" 
                          data-testid={`button-calendar-${restaurant.id}`}
                          onClick={() => {
                            window.open(generateCalendarUrl(restaurant, group.name), '_blank');
                          }}
                        >
                          <CalendarPlus className="w-3 h-3 mr-1" />
                          Calendar
                        </Button>
                        <Button 
                          size="sm" 
                          variant={visitedRestaurantId === restaurant.id ? "default" : "outline"}
                          className="text-xs" 
                          data-testid={`button-visited-${restaurant.id}`}
                          onClick={() => {
                            setVisitedRestaurantId(restaurant.id);
                            toast({ 
                              title: "Logged!", 
                              description: `Marked "${restaurant.name}" as your destination!` 
                            });
                          }}
                        >
                          {visitedRestaurantId === restaurant.id ? (
                            <>
                              <Check className="w-3 h-3 mr-1" />
                              Going here!
                            </>
                          ) : (
                            "We went here"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <Card className="text-center py-12 border-2 border-dashed">
              <CardContent>
                <motion.div 
                  className="text-5xl mb-4"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  🍕
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

        {matches && matches.length > 0 && (
          <motion.div 
            className="mt-8 text-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-sm text-muted-foreground mb-4">
              Want more options? 👀
            </p>
            <Button 
              variant="outline" 
              className="border-2" 
              data-testid="button-continue-swiping"
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
                  Load 20 More Restaurants
                </>
              )}
            </Button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
