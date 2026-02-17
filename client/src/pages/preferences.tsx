import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { groupPreferencesSchema, type GroupPreferences, type Group, dietaryRestrictions, cuisineTypes, priceRanges } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ChevronDown, Flame, Loader2, MapPin, Ruler, UtensilsCrossed, DollarSign, Leaf, Sparkles, Navigation, Star, Target } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { isNative } from "@/lib/platform";
import { Geolocation } from "@capacitor/geolocation";

interface SessionTheme {
  id: string;
  name: string;
  emoji: string;
  description: string;
  presets: Partial<GroupPreferences>;
}

const SESSION_THEMES: SessionTheme[] = [
  {
    id: "date-night",
    name: "Date Night",
    emoji: "\u{1F319}",
    description: "Upscale & romantic vibes",
    presets: {
      priceRange: ["$$$", "$$$$"],
      minRating: 4.0,
      cuisineTypes: ["Italian", "French", "Japanese", "Mediterranean"],
    },
  },
  {
    id: "budget-bites",
    name: "Budget Bites",
    emoji: "\u{1F4B0}",
    description: "Great eats, easy on the wallet",
    presets: {
      priceRange: ["$", "$$"],
      minRating: 0,
    },
  },
  {
    id: "adventure-mode",
    name: "Adventure",
    emoji: "\u{1F30D}",
    description: "Try something totally new",
    presets: {
      trySomethingNew: true,
      priceRange: ["$", "$$", "$$$", "$$$$"],
      minRating: 0,
    },
  },
  {
    id: "casual-hangout",
    name: "Casual Hangout",
    emoji: "\u{1F354}",
    description: "Chill spots, good times",
    presets: {
      priceRange: ["$", "$$"],
      cuisineTypes: ["Pizza", "Burger", "BBQ", "American"],
    },
  },
  {
    id: "healthy-clean",
    name: "Healthy",
    emoji: "\u{1F957}",
    description: "Light & clean eating",
    presets: {
      dietaryRestrictions: ["vegetarian"],
      minRating: 4.0,
    },
  },
];

function SectionHeader({
  label, icon, isOpen, onToggle, badge
}: {
  label: string; icon: React.ReactNode; isOpen: boolean; onToggle: () => void; badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between w-full text-sm font-semibold py-1"
    >
      <div className="flex items-center gap-2">
        {icon}
        {label}
        {badge && <span className="text-muted-foreground font-normal text-xs">({badge})</span>}
      </div>
      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
    </button>
  );
}

export default function Preferences() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLocating, setIsLocating] = useState(false);
  const [usingGPS, setUsingGPS] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["vibes", "location"]));

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const { data: group, isLoading } = useQuery<Group>({
    queryKey: ["/api/groups", params.id],
    enabled: !!params.id,
  });

  const form = useForm<GroupPreferences>({
    resolver: zodResolver(groupPreferencesSchema),
    defaultValues: {
      zipCode: "",
      radius: 10,
      dietaryRestrictions: [],
      cuisineTypes: [],
      priceRange: ["$", "$$", "$$$"],
      minRating: 0,
      latitude: undefined,
      longitude: undefined,
      trySomethingNew: false,
      excludeCuisines: [],
    },
  });

  // Populate form with existing preferences if available
  useEffect(() => {
    if (group?.preferences) {
      const prefs = group.preferences;
      form.reset({
        zipCode: prefs.zipCode || "",
        radius: prefs.radius || 10,
        dietaryRestrictions: prefs.dietaryRestrictions || [],
        cuisineTypes: prefs.cuisineTypes || [],
        priceRange: prefs.priceRange || ["$", "$$", "$$$"],
        minRating: prefs.minRating || 0,
        latitude: prefs.latitude,
        longitude: prefs.longitude,
        trySomethingNew: prefs.trySomethingNew || false,
        excludeCuisines: prefs.excludeCuisines || [],
      });
      // Set GPS state if coords were saved
      if (prefs.latitude !== undefined && prefs.longitude !== undefined) {
        setUsingGPS(true);
      }
    }
  }, [group?.preferences, form]);

  const handleFindMe = async () => {
    setIsLocating(true);

    try {
      let latitude: number;
      let longitude: number;

      if (isNative()) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } else {
        if (!navigator.geolocation) {
          toast({
            title: "GPS not available",
            description: "Your browser doesn't support location services.",
            variant: "destructive",
          });
          setIsLocating(false);
          return;
        }

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      form.setValue("latitude", latitude);
      form.setValue("longitude", longitude);

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
          { headers: { "Accept": "application/json" } }
        );
        if (!response.ok) throw new Error("Geocoding failed");
        const data = await response.json();
        const address = data.address;
        if (address) {
          const locationName = address.neighbourhood || address.suburb || address.city || address.town || "Current Location";
          const postcode = address.postcode ? `, ${address.postcode}` : "";
          form.setValue("zipCode", `${locationName}${postcode}`);
        } else {
          form.setValue("zipCode", "Current Location");
        }
      } catch {
        form.setValue("zipCode", "Current Location");
      }

      setUsingGPS(true);
      setIsLocating(false);
      toast({
        title: "Location found!",
        description: "We'll search for restaurants near you.",
      });
    } catch (error: any) {
      setIsLocating(false);
      const message = error?.code === 1 || error?.message?.includes("denied")
        ? "Please allow location access in your device settings."
        : "Try entering your address manually.";
      toast({
        title: "Couldn't get location",
        description: message,
        variant: "destructive",
      });
    }
  };

  const clearGPS = () => {
    form.setValue("latitude", undefined);
    form.setValue("longitude", undefined);
    form.setValue("zipCode", "");
    setUsingGPS(false);
  };

  const memberId = localStorage.getItem("grubmatch-member-id");

  const saveMutation = useMutation({
    mutationFn: async (data: GroupPreferences) => {
      const response = await apiRequest("POST", `/api/groups/${params.id}/start-session`, {
        hostMemberId: memberId,
        preferences: data,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", params.id] });
      setLocation(`/group/${params.id}/swipe`);
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Something went wrong. Let's try that again!",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: GroupPreferences) => {
    saveMutation.mutate(data);
  };

  const handleThemeSelect = useCallback((theme: SessionTheme) => {
    if (selectedTheme === theme.id) {
      // Deselect — reset to defaults
      setSelectedTheme(null);
      form.setValue("priceRange", ["$", "$$", "$$$"]);
      form.setValue("minRating", 0);
      form.setValue("cuisineTypes", []);
      form.setValue("dietaryRestrictions", []);
      form.setValue("trySomethingNew", false);
      setOpenSections(new Set(["vibes", "location"]));
    } else {
      setSelectedTheme(theme.id);
      const p = theme.presets;
      if (p.priceRange) form.setValue("priceRange", p.priceRange);
      if (p.minRating !== undefined) form.setValue("minRating", p.minRating);
      if (p.cuisineTypes) form.setValue("cuisineTypes", p.cuisineTypes);
      if (p.dietaryRestrictions) form.setValue("dietaryRestrictions", p.dietaryRestrictions);
      if (p.trySomethingNew !== undefined) form.setValue("trySomethingNew", p.trySomethingNew);
      const newOpenSections = new Set(["vibes", "location"]);
      if (p.minRating !== undefined && p.minRating > 0) newOpenSections.add("rating");
      if (p.priceRange) newOpenSections.add("price");
      if (p.cuisineTypes) newOpenSections.add("cuisines");
      if (p.dietaryRestrictions) newOpenSections.add("dietary");
      setOpenSections(newOpenSections);
    }
  }, [selectedTheme, form]);

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

  const radius = form.watch("radius");
  const minRating = form.watch("minRating");

  return (
    <div className="min-h-screen bg-background safe-top safe-x">
      <header className="flex items-center justify-between p-4 md:p-6">
        <Link href={`/group/${params.id}`}>
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
            <Flame className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold">{group.name}</span>
        </div>
      </header>

      <main className="px-4 md:px-6 py-8 max-w-lg mx-auto safe-bottom">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <Card className="border-2">
            <CardHeader className="text-center border-b bg-gradient-to-r from-primary/5 to-orange-500/5">
              <motion.div
                className="flex justify-center mb-2"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Target className="w-8 h-8 text-primary" />
              </motion.div>
              <CardTitle className="text-xl">Set the Vibes!</CardTitle>
              <CardDescription>
                What's everyone in the mood for?
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  {/* Themed Session Picker */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className="w-4 h-4 text-yellow-500" />
                      Pick a Vibe
                      <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide snap-x snap-mandatory touch-pan-x">
                      {SESSION_THEMES.map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => handleThemeSelect(theme)}
                          className={`snap-start flex-shrink-0 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all min-w-[90px] ${selectedTheme === theme.id
                            ? "border-primary bg-gradient-to-br from-primary/15 to-orange-500/15 shadow-md shadow-primary/10"
                            : "border-border hover:border-primary/40 bg-card"
                            }`}
                          data-testid={`theme-${theme.id}`}
                        >
                          <span className="text-2xl">{theme.emoji}</span>
                          <span className={`text-xs font-bold leading-tight ${selectedTheme === theme.id ? "text-primary" : ""
                            }`}>{theme.name}</span>
                          <span className="text-[10px] text-muted-foreground leading-tight text-center">
                            {theme.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <MapPin className="w-4 h-4 text-primary" />
                      Where are you?
                    </div>

                    <Button
                      type="button"
                      variant={usingGPS ? "default" : "outline"}
                      className={`w-full ${usingGPS ? "bg-gradient-to-r from-primary to-orange-500" : ""}`}
                      onClick={usingGPS ? clearGPS : handleFindMe}
                      disabled={isLocating}
                      data-testid="button-find-me"
                    >
                      {isLocating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Finding you...
                        </>
                      ) : usingGPS ? (
                        <>
                          <Navigation className="w-4 h-4 mr-2" />
                          Using GPS - Tap to clear
                        </>
                      ) : (
                        <>
                          <Navigation className="w-4 h-4 mr-2" />
                          Find Me
                        </>
                      )}
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">or enter location</span>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address, City, or Zip Code</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="123 Main St, Brooklyn NY or 10001"
                              maxLength={100}
                              className="border-2"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                // Clear GPS coords when manually typing
                                if (usingGPS) {
                                  form.setValue("latitude", undefined);
                                  form.setValue("longitude", undefined);
                                  setUsingGPS(false);
                                }
                              }}
                              data-testid="input-location"
                            />
                          </FormControl>
                          <FormDescription>
                            Be specific! Use a full address for best results.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="radius"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="flex items-center gap-2">
                              <Ruler className="w-4 h-4" />
                              How far will you go?
                            </FormLabel>
                            <span className="text-sm font-bold text-primary">{radius} miles</span>
                          </div>
                          <FormControl>
                            <Slider
                              min={1}
                              max={50}
                              step={1}
                              value={[field.value]}
                              onValueChange={([val]) => field.onChange(val)}
                              className="py-2"
                              data-testid="slider-radius"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <SectionHeader label="Minimum Rating" icon={<Star className="w-4 h-4 text-yellow-500" />} isOpen={openSections.has("rating")} onToggle={() => toggleSection("rating")} />

                    {openSections.has("rating") && (
                    <FormField
                      control={form.control}
                      name="minRating"
                      render={({ field }) => (
                        <FormItem>
                          <div className="grid grid-cols-5 gap-2">
                            {[
                              { value: 0, label: "Any" },
                              { value: 3, label: "3+" },
                              { value: 3.5, label: "3.5+" },
                              { value: 4, label: "4+" },
                              { value: 4.5, label: "4.5+" },
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => field.onChange(option.value)}
                                className={`py-3 rounded-xl border-2 font-bold transition-all text-sm ${(field.value || 0) === option.value
                                  ? "border-yellow-500 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 text-yellow-600 dark:text-yellow-400"
                                  : "border-border hover:border-yellow-500/50"
                                  }`}
                                data-testid={`button-rating-${option.value}`}
                              >
                                {option.value > 0 && <Star className="w-3 h-3 inline mr-0.5 fill-current" />}
                                {option.label}
                              </button>
                            ))}
                          </div>
                          <FormDescription>
                            {minRating && minRating > 0
                              ? `Only show restaurants rated ${minRating} stars or higher`
                              : "Show restaurants of any rating"
                            }
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    )}
                  </div>

                  <div className="space-y-4">
                    <SectionHeader label="Budget Vibes" icon={<DollarSign className="w-4 h-4 text-accent" />} isOpen={openSections.has("price")} onToggle={() => toggleSection("price")} />

                    {openSections.has("price") && (
                    <FormField
                      control={form.control}
                      name="priceRange"
                      render={() => (
                        <FormItem>
                          <div className="grid grid-cols-4 gap-2">
                            {priceRanges.map((price) => (
                              <FormField
                                key={price}
                                control={form.control}
                                name="priceRange"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const current = field.value || [];
                                          const updated = current.includes(price)
                                            ? current.filter((p) => p !== price)
                                            : [...current, price];
                                          field.onChange(updated);
                                        }}
                                        className={`w-full py-3 rounded-xl border-2 font-bold transition-all ${(field.value || []).includes(price)
                                          ? "border-primary bg-gradient-to-br from-primary/20 to-orange-500/20 text-primary"
                                          : "border-border hover:border-primary/50"
                                          }`}
                                        data-testid={`button-price-${price}`}
                                      >
                                        {price}
                                      </button>
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    )}
                  </div>

                  <div className="space-y-4">
                    <SectionHeader label="Dietary Needs" icon={<Leaf className="w-4 h-4 text-accent" />} isOpen={openSections.has("dietary")} onToggle={() => toggleSection("dietary")} />

                    {openSections.has("dietary") && (
                    <FormField
                      control={form.control}
                      name="dietaryRestrictions"
                      render={() => (
                        <FormItem>
                          <div className="grid grid-cols-2 gap-3">
                            {dietaryRestrictions.map((restriction) => (
                              <FormField
                                key={restriction}
                                control={form.control}
                                name="dietaryRestrictions"
                                render={({ field }) => (
                                  <FormItem className="flex items-center space-x-3 space-y-0 p-3 rounded-lg border-2 hover:border-accent/50 transition-all">
                                    <FormControl>
                                      <Checkbox
                                        checked={(field.value || []).includes(restriction)}
                                        onCheckedChange={(checked) => {
                                          const current = field.value || [];
                                          const updated = checked
                                            ? [...current, restriction]
                                            : current.filter((r) => r !== restriction);
                                          field.onChange(updated);
                                        }}
                                        data-testid={`checkbox-diet-${restriction}`}
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal capitalize cursor-pointer">
                                      {restriction}
                                    </FormLabel>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    )}
                  </div>

                  <div className="space-y-4">
                    <SectionHeader label="Cravings" icon={<UtensilsCrossed className="w-4 h-4 text-primary" />} isOpen={openSections.has("cuisines")} onToggle={() => toggleSection("cuisines")} badge="or leave blank for all" />

                    {openSections.has("cuisines") && (
                    <>
                    <FormField
                      control={form.control}
                      name="trySomethingNew"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed bg-gradient-to-r from-accent/10 to-primary/5">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-try-new"
                            />
                          </FormControl>
                          <div className="flex-1">
                            <FormLabel className="text-sm font-medium cursor-pointer">
                              Try something new!
                            </FormLabel>
                            <FormDescription className="text-xs">
                              Hide cuisines you've already matched on before
                            </FormDescription>
                          </div>
                          <Sparkles className="w-5 h-5 text-yellow-500" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cuisineTypes"
                      render={() => (
                        <FormItem>
                          <div className="flex flex-wrap gap-2">
                            {cuisineTypes.map((cuisine) => (
                              <FormField
                                key={cuisine}
                                control={form.control}
                                name="cuisineTypes"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const current = field.value || [];
                                          const updated = current.includes(cuisine)
                                            ? current.filter((c) => c !== cuisine)
                                            : [...current, cuisine];
                                          field.onChange(updated);
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border-2 ${(field.value || []).includes(cuisine)
                                          ? "bg-gradient-to-r from-primary to-orange-500 text-white border-transparent"
                                          : "bg-muted hover:border-primary/50 border-transparent"
                                          }`}
                                        data-testid={`button-cuisine-${cuisine}`}
                                      >
                                        {cuisine}
                                      </button>
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    </>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-primary to-orange-500 shadow-lg shadow-primary/30"
                    size="lg"
                    disabled={saveMutation.isPending}
                    data-testid="button-start-swiping"
                  >
                    {saveMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Getting ready...
                      </>
                    ) : (
                      <>
                        <Flame className="w-4 h-4 mr-2" />
                        Start Swiping!
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
