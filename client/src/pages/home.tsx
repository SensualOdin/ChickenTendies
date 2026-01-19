import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Users, Utensils, Heart, ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Utensils className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">GrubMatch</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="px-4 md:px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <section className="text-center py-12 md:py-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>Decide where to eat, together</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Find restaurants{" "}
              <span className="text-primary">everyone</span>{" "}
              will love
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Create a group, invite your friends, and swipe through restaurants together. 
              When everyone matches, you've found your next meal!
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/create">
                <Button size="lg" className="w-full sm:w-auto text-lg px-8" data-testid="button-create-group">
                  Create a Group
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/join">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8" data-testid="button-join-group">
                  Join a Group
                </Button>
              </Link>
            </div>
          </section>

          <section className="grid md:grid-cols-3 gap-6 py-12">
            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Create Your Group</h3>
                <p className="text-muted-foreground">
                  Start a session and share the code with friends. Everyone can join from their own device.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Utensils className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Set Preferences</h3>
                <p className="text-muted-foreground">
                  Choose your location, radius, dietary needs, and cuisines. Only see restaurants that work for everyone.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-lg bg-chart-3/20 flex items-center justify-center mb-4">
                  <Heart className="w-6 h-6 text-chart-3" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Swipe & Match</h3>
                <p className="text-muted-foreground">
                  Swipe right on restaurants you'd enjoy. When the whole group matches, you've found your spot!
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="py-12">
            <Card className="overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
              <CardContent className="p-8 md:p-12 text-center">
                <h2 className="text-2xl md:text-3xl font-bold mb-4">
                  No more endless debates
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto mb-6">
                  We've all been there - "I don't know, where do you want to eat?" 
                  GrubMatch makes deciding fun and ensures everyone gets a say.
                </p>
                <Link href="/create">
                  <Button size="lg" data-testid="button-get-started">
                    Get Started Free
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
