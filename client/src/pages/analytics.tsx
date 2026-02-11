import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, BarChart3, TrendingUp, MousePointerClick, Star, ThumbsDown, ThumbsUp, Clock, Calendar, Search, ShieldAlert } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { useState, useEffect } from "react";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 173 58% 39%))",
  "hsl(var(--chart-3, 197 37% 24%))",
  "hsl(var(--chart-4, 43 74% 66%))",
  "hsl(var(--chart-5, 27 87% 67%))",
  "hsl(12, 76%, 61%)",
  "hsl(142, 71%, 45%)",
  "hsl(262, 83%, 58%)",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface SummaryData {
  period: { days: number; since: string };
  totals: {
    events: number;
    rightSwipes: number;
    leftSwipes: number;
    superLikes: number;
  };
  topCuisines: Array<{ cuisine: string; swipe_count: string }>;
  topRestaurants: Array<{
    restaurant_id: string;
    restaurant_name: string;
    right_swipes: string;
    left_swipes: string;
    super_likes: string;
  }>;
  hourlyActivity: Array<{ hour_of_day: number; event_count: string }>;
  dailyActivity: Array<{ day_of_week: number; event_count: string }>;
  pricePreferences: Array<{ price_range: string; liked: string; disliked: string }>;
}

interface DemandData {
  unique_users: number | string;
  total_swipes: number | string;
}

interface RestaurantData {
  restaurant_name: string;
  right_swipes: string;
  left_swipes: string;
  super_likes: string;
  total_views: string;
  approval_rate: string;
  message?: string;
}

export default function AnalyticsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [days, setDays] = useState("30");
  const [cuisineSearch, setCuisineSearch] = useState("");
  const [restaurantSearch, setRestaurantSearch] = useState("");

  const isAdmin = !!user?.isAdmin;

  const { data: summary, isLoading } = useQuery<SummaryData>({
    queryKey: ["/api/analytics/summary", `?days=${days}`],
    enabled: isAdmin,
  });

  const { data: demandData } = useQuery<DemandData>({
    queryKey: ["/api/analytics/demand", `?cuisine=${encodeURIComponent(cuisineSearch)}`],
    enabled: isAdmin && cuisineSearch.length > 0,
  });

  const { data: restaurantData } = useQuery<RestaurantData>({
    queryKey: ["/api/analytics/restaurant", restaurantSearch],
    enabled: isAdmin && restaurantSearch.length > 0,
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      setLocation("/dashboard");
    }
  }, [isAdmin, authLoading, setLocation]);

  if (authLoading) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <ShieldAlert className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-bold">Admin Access Required</h2>
            <p className="text-muted-foreground">This page is only available to administrators.</p>
            <Link href="/dashboard">
              <Button data-testid="button-back-dashboard">Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSwipes = summary?.totals.events || 0;
  const rightSwipes = summary?.totals.rightSwipes || 0;
  const leftSwipes = summary?.totals.leftSwipes || 0;
  const superLikes = summary?.totals.superLikes || 0;
  const approvalRate = totalSwipes > 0 ? ((rightSwipes + superLikes) / totalSwipes * 100).toFixed(1) : "0";

  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const found = summary?.hourlyActivity?.find(h => Number(h.hour_of_day) === i);
    return {
      hour: i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`,
      count: found ? Number(found.event_count) : 0,
    };
  });

  const dailyData = summary?.dailyActivity?.map(d => ({
    day: DAY_NAMES[Number(d.day_of_week)] || "?",
    count: Number(d.event_count),
  })) || [];

  const cuisineData = summary?.topCuisines?.map((c, i) => ({
    name: c.cuisine,
    value: Number(c.swipe_count),
    fill: CHART_COLORS[i % CHART_COLORS.length],
  })) || [];

  const priceData = summary?.pricePreferences?.map(p => ({
    price: p.price_range,
    liked: Number(p.liked),
    disliked: Number(p.disliked),
  })) || [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft />
              </Button>
            </Link>
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Analytics</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[130px]" data-testid="select-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-6xl">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-16 animate-pulse bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MousePointerClick className="h-4 w-4" />
                    <span className="text-xs font-medium">Total Swipes</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-total-swipes">{totalSwipes.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <ThumbsUp className="h-4 w-4" />
                    <span className="text-xs font-medium">Right Swipes</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-right-swipes">{rightSwipes.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Star className="h-4 w-4" />
                    <span className="text-xs font-medium">Super Likes</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-500" data-testid="text-super-likes">{superLikes.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs font-medium">Approval Rate</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-approval-rate">{approvalRate}%</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-base">Top Cuisines (Liked)</CardTitle>
                </CardHeader>
                <CardContent>
                  {cuisineData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={cuisineData} layout="vertical" margin={{ left: 80, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="value" name="Likes" radius={[0, 4, 4, 0]}>
                          {cuisineData.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                      No cuisine data yet
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-base">Price Preferences</CardTitle>
                </CardHeader>
                <CardContent>
                  {priceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={priceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="price" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="liked" name="Liked" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="disliked" name="Disliked" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                      No price data yet
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Activity by Hour
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {hourlyData.some(h => h.count > 0) ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" name="Swipes" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                      No hourly data yet
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Activity by Day
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dailyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" name="Swipes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                      No daily data yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base">Top Restaurants</CardTitle>
              </CardHeader>
              <CardContent>
                {summary?.topRestaurants && summary.topRestaurants.length > 0 ? (
                  <div className="space-y-3">
                    {summary.topRestaurants.slice(0, 10).map((r, i) => {
                      const total = Number(r.right_swipes) + Number(r.left_swipes) + Number(r.super_likes);
                      const rate = total > 0 ? (((Number(r.right_swipes) + Number(r.super_likes)) / total) * 100).toFixed(0) : "0";
                      return (
                        <div key={r.restaurant_id} className="flex items-center justify-between gap-4 flex-wrap" data-testid={`row-restaurant-${i}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm font-medium text-muted-foreground w-6 text-right">{i + 1}</span>
                            <span className="text-sm font-medium truncate">{r.restaurant_name || r.restaurant_id}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              {r.right_swipes}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              {r.super_likes}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <ThumbsDown className="h-3 w-3 mr-1" />
                              {r.left_swipes}
                            </Badge>
                            <Badge variant="outline" className="text-xs font-medium">{rate}%</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No restaurant data yet</p>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Cuisine Demand Lookup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Enter cuisine type (e.g. Mexican, Sushi)"
                    value={cuisineSearch}
                    onChange={(e) => setCuisineSearch(e.target.value)}
                    data-testid="input-cuisine-search"
                  />
                  {demandData && cuisineSearch && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 rounded-md bg-muted/50">
                        <p className="text-2xl font-bold" data-testid="text-demand-users">{Number(demandData.unique_users).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Unique Users</p>
                      </div>
                      <div className="text-center p-4 rounded-md bg-muted/50">
                        <p className="text-2xl font-bold" data-testid="text-demand-swipes">{Number(demandData.total_swipes).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Right Swipes</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Restaurant Lookup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Enter restaurant Yelp ID"
                    value={restaurantSearch}
                    onChange={(e) => setRestaurantSearch(e.target.value)}
                    data-testid="input-restaurant-search"
                  />
                  {restaurantData && restaurantSearch && !("message" in restaurantData && restaurantData.message) && (
                    <div className="space-y-3">
                      <p className="font-medium">{restaurantData.restaurant_name}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 rounded-md bg-muted/50">
                          <p className="text-xl font-bold">{Number(restaurantData.total_views).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Views</p>
                        </div>
                        <div className="text-center p-3 rounded-md bg-muted/50">
                          <p className="text-xl font-bold">{restaurantData.approval_rate}%</p>
                          <p className="text-xs text-muted-foreground">Approval</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        <Badge variant="secondary">
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          {restaurantData.right_swipes} likes
                        </Badge>
                        <Badge variant="secondary">
                          <Star className="h-3 w-3 mr-1" />
                          {restaurantData.super_likes} super
                        </Badge>
                        <Badge variant="secondary">
                          <ThumbsDown className="h-3 w-3 mr-1" />
                          {restaurantData.left_swipes} passes
                        </Badge>
                      </div>
                    </div>
                  )}
                  {restaurantData && "message" in restaurantData && restaurantData.message && (
                    <p className="text-sm text-muted-foreground text-center py-4">{restaurantData.message as string}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
