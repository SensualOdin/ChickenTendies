import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Plus, Star, MapPin } from "lucide-react";
import type { Restaurant } from "@shared/schema";

interface Props {
  groupId: string;
  memberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Member-driven restaurant suggestion. Test users with a tight radius were
// missing specific staples ("I narrowed to 5mi to escape the Coney Island
// flood, then lost my favorites") — this lets any member type a name and
// drop the place into the deck for everyone to swipe on.
export function SuggestRestaurantModal({ groupId, memberId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Restaurant[]>([]);
  const [searched, setSearched] = useState(false);

  const searchMutation = useMutation({
    mutationFn: async (q: string) => {
      const response = await apiRequest("POST", `/api/groups/${groupId}/restaurants/suggest`, {
        memberId,
        query: q,
      });
      return response.json() as Promise<{ results: Restaurant[] }>;
    },
    onSuccess: (data) => {
      setResults(data.results);
      setSearched(true);
    },
    onError: (err: Error) => {
      toast({
        title: "Couldn't search right now",
        description: err.message || "Try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (restaurant: Restaurant) => {
      const response = await apiRequest("POST", `/api/groups/${groupId}/restaurants/add`, {
        memberId,
        restaurant,
      });
      return response.json() as Promise<{ added: boolean; suggestedBy?: string }>;
    },
    onSuccess: (data, restaurant) => {
      if (data.added) {
        toast({
          title: "Added to the deck!",
          description: `Everyone can now swipe on ${restaurant.name}.`,
        });
        reset();
        onOpenChange(false);
      } else {
        toast({
          title: "Already in the deck",
          description: `${restaurant.name} was already there.`,
        });
      }
    },
    onError: (err: Error) => {
      toast({
        title: "Couldn't add that one",
        description: err.message || "Try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const reset = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    searchMutation.mutate(trimmed);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col" data-testid="suggest-restaurant-modal">
        <DialogHeader>
          <DialogTitle>Suggest a place</DialogTitle>
          <DialogDescription>
            Search by name to add a restaurant we missed. It'll pop into the deck for everyone.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex gap-2 mt-2">
          <Input
            autoFocus
            placeholder="e.g. Olive Garden, Joe's Diner"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={80}
            data-testid="input-suggest-query"
          />
          <Button
            type="submit"
            disabled={searchMutation.isPending || query.trim().length < 2}
            data-testid="button-suggest-search"
          >
            {searchMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto mt-3 -mx-1 px-1">
          {!searched && !searchMutation.isPending && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Type a name and tap search.
            </p>
          )}

          {searched && results.length === 0 && !searchMutation.isPending && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No matches near you for "<span className="font-medium">{query}</span>".
              Try a different spelling or shorter name.
            </p>
          )}

          <ul className="space-y-2">
            {results.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-muted/40 transition-colors"
                data-testid={`suggest-result-${r.id}`}
              >
                <div
                  className="w-14 h-14 rounded-md bg-cover bg-center bg-muted shrink-0"
                  style={{ backgroundImage: `url(${r.imageUrl})` }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                      {r.rating.toFixed(1)}
                    </span>
                    <span>·</span>
                    <span>{r.priceRange}</span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5 truncate">
                      <MapPin className="w-3 h-3" />
                      {r.distance ? `${r.distance.toFixed(1)} mi` : r.address.split(",")[1]?.trim() || r.address}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => addMutation.mutate(r)}
                  disabled={addMutation.isPending}
                  data-testid={`button-add-suggested-${r.id}`}
                >
                  {addMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
