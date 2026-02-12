import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/lib/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { 
  Trophy, Sparkles, Users, Flame, Award, 
  MapPin, Utensils, Heart, ArrowLeft, Star,
  Lock, Pencil, Check, X, Sun, Moon, LogOut, Settings
} from "lucide-react";

interface Stats {
  totalSwipes: number;
  superLikes: number;
  totalMatches: number;
  placesVisited: number;
  crewCount: number;
  achievementCount: number;
}

interface Achievement {
  id: string;
  achievementType: string;
  unlockedAt: string;
  data?: Record<string, unknown>;
}

interface AchievementDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
}

const iconMap: Record<string, typeof Trophy> = {
  trophy: Trophy,
  sparkles: Sparkles,
  utensils: Utensils,
  users: Users,
  heart: Heart,
  award: Award,
  flame: Flame,
  map: MapPin,
};

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: achievements = [] } = useQuery<Achievement[]>({
    queryKey: ["/api/achievements"],
  });

  const { data: availableAchievements = [] } = useQuery<AchievementDefinition[]>({
    queryKey: ["/api/achievements/available"],
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setIsEditing(false);
      toast({ title: "Profile updated" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to update profile", variant: "destructive" });
    },
  });

  const unlockedTypes = new Set(achievements.map(a => a.achievementType));

  const startEditing = () => {
    setEditFirstName(user?.firstName || "");
    setEditLastName(user?.lastName || "");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const saveProfile = () => {
    if (!editFirstName.trim()) {
      toast({ title: "First name is required", variant: "destructive" });
      return;
    }
    updateProfileMutation.mutate({
      firstName: editFirstName.trim(),
      lastName: editLastName.trim(),
    });
  };

  if (!user) return null;

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const hasName = !!user.firstName;

  return (
    <div className="min-h-screen bg-background safe-top safe-x">
      <header className="flex items-center justify-between p-4 md:p-6 border-b">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Profile</h1>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 safe-bottom">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <Card>
            <CardContent className="p-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-2">
                    <Avatar className="w-20 h-20">
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback className="text-2xl">
                        {editFirstName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold mb-1">Edit Display Name</h2>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        data-testid="input-first-name"
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        placeholder="Your first name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        data-testid="input-last-name"
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        placeholder="Your last name (optional)"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      onClick={saveProfile}
                      disabled={updateProfileMutation.isPending || !editFirstName.trim()}
                      data-testid="button-save-profile"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      {updateProfileMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button variant="ghost" onClick={cancelEditing} data-testid="button-cancel-edit">
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={user.profileImageUrl || undefined} />
                    <AvatarFallback className="text-2xl">
                      {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold truncate" data-testid="text-display-name">
                        {hasName ? displayName : (user.email || "User")}
                      </h2>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={startEditing}
                        data-testid="button-edit-profile"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-muted-foreground truncate">{user.email}</p>
                    {!hasName && (
                      <button
                        onClick={startEditing}
                        className="text-sm text-primary mt-1 underline underline-offset-2"
                        data-testid="button-set-name-prompt"
                      >
                        Set your display name
                      </button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Your Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-primary">{stats?.totalSwipes || 0}</div>
                  <div className="text-sm text-muted-foreground">Total Swipes</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-yellow-500">{stats?.superLikes || 0}</div>
                  <div className="text-sm text-muted-foreground">Super Likes</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-accent">{stats?.totalMatches || 0}</div>
                  <div className="text-sm text-muted-foreground">Matches</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-emerald-500">{stats?.placesVisited || 0}</div>
                  <div className="text-sm text-muted-foreground">Places Visited</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-500">{stats?.crewCount || 0}</div>
                  <div className="text-sm text-muted-foreground">Crews</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-500">{stats?.achievementCount || 0}</div>
                  <div className="text-sm text-muted-foreground">Achievements</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {availableAchievements.map((def) => {
                  const isUnlocked = unlockedTypes.has(def.type);
                  const IconComponent = iconMap[def.icon] || Trophy;
                  
                  return (
                    <motion.div
                      key={def.type}
                      className={`flex items-center gap-4 p-4 rounded-lg border ${
                        isUnlocked 
                          ? "bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30" 
                          : "bg-muted/30 opacity-60"
                      }`}
                      whileHover={{ scale: isUnlocked ? 1.02 : 1 }}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isUnlocked 
                          ? "bg-gradient-to-br from-yellow-400 to-orange-500" 
                          : "bg-muted"
                      }`}>
                        {isUnlocked ? (
                          <IconComponent className="w-6 h-6 text-white" />
                        ) : (
                          <Lock className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{def.name}</span>
                          {isUnlocked && (
                            <Badge className="bg-yellow-500/20 text-yellow-600 border-0">
                              Unlocked
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{def.description}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  {theme === "dark" ? (
                    <Moon className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <Sun className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Appearance</p>
                    <p className="text-xs text-muted-foreground">
                      {theme === "dark" ? "Dark mode" : "Light mode"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                  data-testid="button-theme-toggle"
                >
                  {theme === "dark" ? (
                    <Sun className="w-4 h-4 mr-2" />
                  ) : (
                    <Moon className="w-4 h-4 mr-2" />
                  )}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </Button>
              </div>
              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  className="w-full text-destructive"
                  onClick={() => logout()}
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
