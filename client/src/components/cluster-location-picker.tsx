import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Lock, Loader2, MapPin, Star, Phone } from "lucide-react";
import type { Restaurant } from "@shared/schema";

interface Props {
  restaurant: Restaurant;
  isHost: boolean;
  isTopPick: boolean;
  isPending: boolean;
  onLock: (locationId: string) => void;
}

// Inline picker that surfaces inside a matched chain card so the host can
// choose WHICH Coney Island / Chipotle the crew is actually going to.
// Non-hosts see the same list (with their location count and distances) for
// transparency, but the lock buttons are host-only.
//
// The picker only renders when the matched card is a cluster
// (restaurant.locations.length > 1). For single-location matches, callers
// should fall back to the original single Lock button.
export function ClusterLocationPicker({
  restaurant,
  isHost,
  isTopPick,
  isPending,
  onLock,
}: Props) {
  const locations = restaurant.locations ?? [];
  const [open, setOpen] = useState(isTopPick); // auto-expand the top pick so host doesn't have to dig
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(null);

  if (locations.length <= 1) return null;

  const handleLock = (locationId: string) => {
    setPendingLocationId(locationId);
    onLock(locationId);
  };

  return (
    <div className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-yellow-500/10 transition-colors"
        onClick={() => setOpen((o) => !o)}
        data-testid={`cluster-toggle-${restaurant.id}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
          <span className="text-sm font-semibold truncate">
            {locations.length} locations
          </span>
          <span className="text-xs text-muted-foreground truncate">
            · {isHost ? "pick one to lock in" : "host will pick one"}
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-yellow-500/20"
          >
            {locations.map((loc) => {
              const isThisPending = isPending && pendingLocationId === loc.id;
              return (
                <li
                  key={loc.id}
                  className="flex items-center gap-3 px-3 py-2.5 border-b border-yellow-500/10 last:border-b-0"
                  data-testid={`cluster-location-${loc.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {loc.address}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />
                        {loc.distance.toFixed(1)} mi
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                        {loc.rating.toFixed(1)}
                      </span>
                      {loc.phone && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-0.5">
                            <Phone className="w-3 h-3" />
                            {loc.phone}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {isHost && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-yellow-500/40 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/10 shrink-0"
                      onClick={() => handleLock(loc.id)}
                      disabled={isPending}
                      data-testid={`button-lock-location-${loc.id}`}
                    >
                      {isThisPending ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Lock className="w-3 h-3 mr-1" />
                      )}
                      Lock
                    </Button>
                  )}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
