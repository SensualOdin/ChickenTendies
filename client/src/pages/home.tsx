import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Users, Utensils, Heart, ArrowRight, Sparkles, Flame, Pizza, PartyPopper, LogIn, LogOut, User, LayoutDashboard } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Home() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <header className="flex items-center justify-between p-4 md:p-6">
        <motion.div 
          className="flex items-center gap-2"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shadow-lg shadow-primary/30">
            <Flame className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">
            ChickenTinders
          </span>
        </motion.div>
        <div className="flex items-center gap-3">
          {isLoading ? null : isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2" data-testid="button-user-menu">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline">{user?.firstName || "User"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onSelect={() => navigate("/dashboard")} 
                  className="cursor-pointer flex items-center gap-2" 
                  data-testid="link-dashboard"
                >
                  <LayoutDashboard className="w-4 h-4" />
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
            <a href="/api/login">
              <Button variant="outline" className="flex items-center gap-2" data-testid="button-login">
                <LogIn className="w-4 h-4" />
                Sign In
              </Button>
            </a>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="px-4 md:px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <section className="text-center py-12 md:py-20 relative">
            <motion.div 
              className="absolute -top-10 left-1/4 text-4xl"
              animate={{ y: [0, -10, 0], rotate: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🍗
            </motion.div>
            <motion.div 
              className="absolute top-20 right-1/4 text-3xl"
              animate={{ y: [0, 10, 0], rotate: [0, -10, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
            >
              🍕
            </motion.div>
            <motion.div 
              className="absolute bottom-0 left-1/3 text-2xl"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
            >
              🌮
            </motion.div>

            <motion.div 
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/20 to-orange-500/20 rounded-full text-primary text-sm font-semibold mb-6 border border-primary/30"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="w-4 h-4" />
              <span>Swipe right on dinner tonight!</span>
              <Sparkles className="w-4 h-4" />
            </motion.div>

            <motion.h1 
              className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Find food{" "}
              <span className="bg-gradient-to-r from-primary via-orange-500 to-yellow-500 bg-clip-text text-transparent">
                everyone
              </span>{" "}
              is hungry for
            </motion.h1>

            <motion.p 
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Gather your crew, swipe through restaurants together, and boom — 
              when everyone matches, you've got dinner plans! 🎉
            </motion.p>

            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Link href="/create">
                <Button size="lg" className="w-full sm:w-auto text-lg px-8 bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 shadow-lg shadow-primary/30" data-testid="button-create-group">
                  <PartyPopper className="w-5 h-5 mr-2" />
                  Start a Party
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/join">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 border-2" data-testid="button-join-group">
                  Join the Fun
                </Button>
              </Link>
            </motion.div>
          </section>

          <section className="grid md:grid-cols-3 gap-6 py-12">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="hover-elevate h-full border-2 hover:border-primary/50 transition-all">
                <CardContent className="pt-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-orange-500/20 flex items-center justify-center mb-4">
                    <Users className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Squad Up! 👯</h3>
                  <p className="text-muted-foreground">
                    Create a group and share the secret code with your hungry friends. The more the merrier!
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <Card className="hover-elevate h-full border-2 hover:border-accent/50 transition-all">
                <CardContent className="pt-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/20 to-emerald-500/20 flex items-center justify-center mb-4">
                    <Pizza className="w-7 h-7 text-accent" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Set Your Vibes 🎯</h3>
                  <p className="text-muted-foreground">
                    Craving tacos? Allergic to nuts? Set your preferences and only see spots that work for everyone.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <Card className="hover-elevate h-full border-2 hover:border-yellow-500/50 transition-all">
                <CardContent className="pt-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center mb-4">
                    <Heart className="w-7 h-7 text-yellow-500 fill-yellow-500" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Swipe & Feast! 🔥</h3>
                  <p className="text-muted-foreground">
                    Swipe right on yummy spots. When everyone matches — it's decision time, baby!
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </section>

          <motion.section 
            className="py-12"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            <Card className="overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 border-2 border-primary/20">
              <CardContent className="p-8 md:p-12 text-center relative">
                <motion.div 
                  className="absolute top-4 left-8 text-2xl"
                  animate={{ rotate: [0, 20, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  🎊
                </motion.div>
                <motion.div 
                  className="absolute top-4 right-8 text-2xl"
                  animate={{ rotate: [0, -20, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                >
                  🎉
                </motion.div>
                
                <h2 className="text-2xl md:text-3xl font-extrabold mb-4">
                  No more hangry debates! 😤➡️😋
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto mb-6">
                  We've all been there — "I don't know, you pick!" 
                  ChickenTinders makes choosing fun and gives everyone a vote!
                </p>
                <Link href="/create">
                  <Button size="lg" className="bg-gradient-to-r from-primary to-orange-500 shadow-lg shadow-primary/30" data-testid="button-get-started">
                    Let's Get Cooking!
                    <Flame className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
