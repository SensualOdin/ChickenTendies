import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Utensils, Heart, ArrowRight, Sparkles, Flame, PartyPopper, LogIn, LogOut, LayoutDashboard, UserPlus, SlidersHorizontal, HandHeart, ChevronRight, Zap, Clock, ShieldCheck, Save, TrendingUp, History, Rocket } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import logoImage from "@assets/460272BC-3FCC-4927-8C2E-4C236353E7AB_1768880143398.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const steps = [
  {
    number: "1",
    icon: UserPlus,
    title: "Start a party",
    description: "Create a group and share the code with your friends. No accounts needed.",
    color: "text-primary",
    bgColor: "from-primary/20 to-orange-500/20",
  },
  {
    number: "2",
    icon: SlidersHorizontal,
    title: "Set your preferences",
    description: "Pick your cuisines, dietary needs, price range, and location so you only see spots that work.",
    color: "text-accent",
    bgColor: "from-accent/20 to-emerald-500/20",
  },
  {
    number: "3",
    icon: HandHeart,
    title: "Swipe on restaurants",
    description: "Everyone swipes right on places they'd like. Swipe left to skip. Super-like your favorites.",
    color: "text-orange-500",
    bgColor: "from-orange-500/20 to-yellow-500/20",
  },
  {
    number: "4",
    icon: PartyPopper,
    title: "Match & eat together",
    description: "When everyone likes the same place, it's a match! Get directions, order delivery, or reserve a table.",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "from-yellow-500/20 to-primary/20",
  },
];

const benefits = [
  {
    icon: Zap,
    title: "Instant — no signup",
    description: "Jump in immediately. Create an account later only if you want to save your crew.",
  },
  {
    icon: Clock,
    title: "Decides in minutes",
    description: "No more endless group texts. Everyone swipes, the app finds where you all agree.",
  },
  {
    icon: ShieldCheck,
    title: "Real restaurants near you",
    description: "We pull from real restaurant data based on your location and preferences.",
  },
];

const signInPerks = [
  {
    icon: Save,
    title: "Save your crew",
    description: "Keep your group together session after session — no sharing codes every time.",
  },
  {
    icon: TrendingUp,
    title: "Track your streaks",
    description: "See how many weeks in a row your crew has used the app. Keep the streak alive!",
  },
  {
    icon: History,
    title: "Restaurant history",
    description: "Remember where you've been so you always discover somewhere new.",
  },
  {
    icon: Rocket,
    title: "One-tap return",
    description: "Jump straight back into your crew's next session from your personal dashboard.",
  },
];

export default function Home() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background overflow-hidden safe-top safe-x">
      <header className="flex items-center justify-between p-4 md:p-6">
        <motion.div 
          className="flex items-center gap-2"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <img src={logoImage} alt="ChickenTinders" className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-primary/30" />
          <div className="flex flex-col">
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent leading-tight">
              ChickenTinders
            </span>
            <span className="text-xs text-muted-foreground hidden sm:block">Swipe Together, Dine Together</span>
          </div>
        </motion.div>
        <div className="flex items-center gap-2">
          {isLoading ? null : isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => navigate("/dashboard")}
                  className="cursor-pointer"
                  data-testid="link-dashboard"
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => logout()} className="cursor-pointer" data-testid="button-logout">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button variant="outline" className="flex items-center gap-2" data-testid="button-login">
                <LogIn className="w-4 h-4" />
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="px-4 md:px-6 pb-12 safe-bottom">
        <div className="max-w-4xl mx-auto">
          <section className="text-center py-10 md:py-16 relative">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Badge variant="secondary" className="mb-6 text-sm">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                100% free &middot; No signup required
              </Badge>
            </motion.div>

            <motion.h1 
              className="text-3xl sm:text-4xl md:text-6xl font-extrabold tracking-tight mb-6"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Stop arguing about{" "}
              <span className="bg-gradient-to-r from-primary via-orange-500 to-yellow-500 bg-clip-text text-transparent">
                where to eat
              </span>
            </motion.h1>

            <motion.p 
              className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-4"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Everyone swipes on restaurants. When the whole group agrees on a place, you've got dinner plans.
            </motion.p>

            <motion.p 
              className="text-sm text-muted-foreground mb-10"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              Works instantly in your browser. No app download, no account needed.
            </motion.p>

            <motion.div
              className="flex flex-col items-center justify-center gap-3"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {isAuthenticated && (
                <Link href="/dashboard">
                  <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-orange-500 shadow-lg shadow-primary/30" data-testid="button-dashboard">
                    <LayoutDashboard className="w-5 h-5 mr-2" />
                    Go to Dashboard
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              )}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/create">
                  <Button size="lg" variant={isAuthenticated ? "outline" : "default"} className={`w-full sm:w-auto ${!isAuthenticated ? "bg-gradient-to-r from-primary to-orange-500 shadow-lg shadow-primary/30" : ""}`} data-testid="button-create-group">
                    <Flame className="w-5 h-5 mr-2" />
                    {isAuthenticated ? "Start a Party" : "Start a Party — It's Free"}
                    {!isAuthenticated && <ArrowRight className="w-5 h-5 ml-2" />}
                  </Button>
                </Link>
                <Link href="/join">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="button-join-group">
                    I Have a Code
                  </Button>
                </Link>
              </div>
            </motion.div>
          </section>

          <section className="py-10 md:py-14">
            <motion.h2
              className="text-center text-xl sm:text-2xl font-bold mb-8"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              How it works
            </motion.h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {steps.map((step, i) => (
                <motion.div
                  key={step.number}
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                >
                  <Card className="h-full border-2 relative">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.bgColor} flex items-center justify-center shrink-0`}>
                          <step.icon className={`w-5 h-5 ${step.color}`} />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Step {step.number}</span>
                      </div>
                      <h3 className="text-base font-bold mb-1.5">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>

          <motion.section 
            className="py-10 md:py-14"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            <div className="grid sm:grid-cols-3 gap-6">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="flex flex-col items-center text-center gap-3 py-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <benefit.icon className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">{benefit.title}</p>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {!isAuthenticated && (
            <motion.section 
              className="py-10 md:py-14"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.95 }}
            >
              <div className="text-center mb-8">
                <h2 className="text-xl sm:text-2xl font-bold mb-2" data-testid="text-sign-in-heading">
                  Want to get more out of it?
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto" data-testid="text-sign-in-subtitle">
                  Signing in is always optional, but here's what you unlock with a free account.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {signInPerks.map((perk, i) => (
                  <motion.div
                    key={perk.title}
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.95 + i * 0.08 }}
                  >
                    <Card className="h-full" data-testid={`card-perk-${perk.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <CardContent className="pt-5 pb-5 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <perk.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold mb-1" data-testid={`text-perk-title-${perk.title.toLowerCase().replace(/\s+/g, "-")}`}>{perk.title}</h3>
                          <p className="text-sm text-muted-foreground" data-testid={`text-perk-desc-${perk.title.toLowerCase().replace(/\s+/g, "-")}`}>{perk.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
              <div className="text-center mt-6">
                <Button variant="outline" size="lg" onClick={() => navigate("/login")} data-testid="button-sign-in-perks">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In — It's Free
                </Button>
              </div>
            </motion.section>
          )}

          <motion.section 
            className="py-8"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.0 }}
          >
            <Card className="overflow-visible bg-gradient-to-br from-primary/10 via-background to-accent/10 border-2 border-primary/20">
              <CardContent className="p-8 md:p-12 text-center">
                <h2 className="text-2xl md:text-3xl font-extrabold mb-3">
                  Ready to find dinner?
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto mb-6">
                  Create a party, share the code with your group, and start swiping. Takes about 30 seconds to set up.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link href="/create">
                    <Button size="lg" className="bg-gradient-to-r from-primary to-orange-500 shadow-lg shadow-primary/30" data-testid="button-get-started">
                      Start a Party
                      <ChevronRight className="w-5 h-5 ml-1" />
                    </Button>
                  </Link>
                  {!isAuthenticated && (
                    <p className="text-xs text-muted-foreground">No signup needed</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
