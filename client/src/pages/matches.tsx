import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, Utensils, Loader2, Star, MapPin, ExternalLink, Heart, PartyPopper } from "lucide-react";
import type { Group, Restaurant } from "@shared/schema";

export default function MatchesPage() {
  const params = useParams<{ id: string }>();

  const { data: group, isLoading: groupLoading } = useQuery<Group>({
    queryKey: ["/api/groups", params.id],
    enabled: !!params.id,
  });

  const { data: matches, isLoading: matchesLoading } = useQuery<Restaurant[]>({
    queryKey: ["/api/groups", params.id, "matches"],
    enabled: !!params.id,
  });

  const isLoading = groupLoading || matchesLoading;

  if (isLoading || !group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between p-4 md:p-6">
        <Link href={`/group/${params.id}/swipe`}>
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Utensils className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold">{group.name}</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="px-4 md:px-6 py-6 max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
            <PartyPopper className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Your Matches!</h1>
          <p className="text-muted-foreground">
            {matches?.length 
              ? `Everyone in ${group.name} agreed on ${matches.length} restaurant${matches.length !== 1 ? "s" : ""}!`
              : "No matches yet. Keep swiping to find places everyone loves!"
            }
          </p>
        </div>

        {matches && matches.length > 0 ? (
          <div className="space-y-4">
            {matches.map((restaurant, index) => (
              <Card key={restaurant.id} className="overflow-hidden hover-elevate">
                <div className="flex flex-col sm:flex-row">
                  <div 
                    className="h-48 sm:h-auto sm:w-40 bg-cover bg-center shrink-0"
                    style={{ backgroundImage: `url(${restaurant.imageUrl})` }}
                  />
                  <CardContent className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {index === 0 && (
                            <Badge className="bg-accent text-accent-foreground">
                              <Heart className="w-3 h-3 mr-1 fill-current" />
                              Top Match
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold" data-testid={`text-match-name-${restaurant.id}`}>
                          {restaurant.name}
                        </h3>
                      </div>
                      <Badge variant="outline">{restaurant.priceRange}</Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-3">
                      <span className="font-medium text-foreground">{restaurant.cuisine}</span>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span>{restaurant.rating.toFixed(1)}</span>
                        <span className="text-muted-foreground">({restaurant.reviewCount})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{restaurant.distance.toFixed(1)} mi</span>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {restaurant.description}
                    </p>

                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="text-xs" data-testid={`button-directions-${restaurant.id}`}>
                        <MapPin className="w-3 h-3 mr-1" />
                        Directions
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs" data-testid={`button-website-${restaurant.id}`}>
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Website
                      </Button>
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">No matches yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Wait for everyone to finish swiping, or go back and swipe more!
              </p>
              <Link href={`/group/${params.id}/swipe`}>
                <Button data-testid="button-back-to-swiping">
                  Back to Swiping
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {matches && matches.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Want to find more options?
            </p>
            <Link href={`/group/${params.id}/swipe`}>
              <Button variant="outline" data-testid="button-continue-swiping">
                Continue Swiping
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
