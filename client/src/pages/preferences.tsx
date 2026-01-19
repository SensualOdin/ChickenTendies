import { useState } from "react";
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
import { ThemeToggle } from "@/components/theme-toggle";
import { groupPreferencesSchema, type GroupPreferences, type Group, dietaryRestrictions, cuisineTypes, priceRanges } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Utensils, Loader2, MapPin, Ruler, UtensilsCrossed, DollarSign, Leaf } from "lucide-react";
import { Link } from "wouter";

export default function Preferences() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: GroupPreferences) => {
      const response = await apiRequest("PATCH", `/api/groups/${params.id}/preferences`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups", params.id] });
      setLocation(`/group/${params.id}/swipe`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: GroupPreferences) => {
    saveMutation.mutate(data);
  };

  if (isLoading || !group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const radius = form.watch("radius");

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between p-4 md:p-6">
        <Link href={`/group/${params.id}`}>
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

      <main className="px-4 md:px-6 py-8 max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Group Preferences</CardTitle>
            <CardDescription>
              Set the criteria for restaurants your group will see
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="w-4 h-4 text-primary" />
                    Location
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zip Code</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="10001" 
                            maxLength={10}
                            {...field}
                            data-testid="input-zipcode"
                          />
                        </FormControl>
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
                            Search Radius
                          </FormLabel>
                          <span className="text-sm font-medium text-primary">{radius} miles</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={1}
                            max={50}
                            step={1}
                            value={[field.value]}
                            onValueChange={([val]) => field.onChange(val)}
                            data-testid="slider-radius"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <DollarSign className="w-4 h-4 text-primary" />
                    Price Range
                  </div>
                  
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
                                      className={`w-full py-3 rounded-lg border-2 font-medium transition-all ${
                                        (field.value || []).includes(price)
                                          ? "border-primary bg-primary/10 text-primary"
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
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Leaf className="w-4 h-4 text-accent" />
                    Dietary Restrictions
                  </div>
                  
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
                                <FormItem className="flex items-center space-x-3 space-y-0">
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
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <UtensilsCrossed className="w-4 h-4 text-primary" />
                    Cuisine Types
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="cuisineTypes"
                    render={() => (
                      <FormItem>
                        <FormDescription className="text-xs mb-3">
                          Leave empty to see all cuisines
                        </FormDescription>
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
                                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                        (field.value || []).includes(cuisine)
                                          ? "bg-primary text-primary-foreground"
                                          : "bg-muted hover:bg-muted/80"
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
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={saveMutation.isPending}
                  data-testid="button-start-swiping"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    "Start Swiping!"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
