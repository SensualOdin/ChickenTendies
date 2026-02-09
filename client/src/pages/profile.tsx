import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion } from "framer-motion";
import { 
  Trophy, Sparkles, Users, Flame, Award, 
  MapPin, Utensils, Heart, ArrowLeft, Star,
  Lock
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
  const { user } = useAuth();

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: achievements = [] } = useQuery<Achievement[]>({
    queryKey: ["/api/achievements"],
  });

  const { data: availableAchievements = [] } = useQuery<AchievementDefinition[]>({
    queryKey: ["/api/achievements/available"],
  });

  const unlockedTypes = new Set(achievements.map(a => a.achievementType));

  if (!user) return null;

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
        <ThemeToggle />
      </header>

      <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 safe-bottom">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback className="text-2xl">
                    {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-2xl font-bold">
                    {user.firstName} {user.lastName}
                  </h2>
                  <p className="text-muted-foreground">{user.email}</p>
                </div>
              </div>
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
      </main>
    </div>
  );
}
