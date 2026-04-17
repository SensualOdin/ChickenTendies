import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Shield, Users, Utensils, Mail, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { isNative } from "@/lib/platform";
import { Browser } from "@capacitor/browser";
import logoImage from "@assets/460272BC-3FCC-4927-8C2E-4C236353E7AB_1768880143398.png";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMagicLinkSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setLocation("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError("Enter your email first");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setMagicLinkSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isNative()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: "https://chickentinders.app/auth/callback",
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (data.url) await Browser.open({ url: data.url });
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || "Google sign-in failed");
      setLoading(false);
    }
  };

  const BrandHeader = () => (
    <header className="editorial-container py-6 flex items-center justify-between safe-top">
      <Link href="/" className="flex items-center gap-3" data-testid="link-home-from-login">
        <img src={logoImage} alt="ChickenTinders" className="w-10 h-10 rounded-[10px] object-cover" data-testid="img-login-header-logo" />
        <div>
          <div className="font-serif font-bold text-xl tracking-tight leading-none">ChickenTinders</div>
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-55 mt-1">Swipe Together, Dine Together</div>
        </div>
      </Link>
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1" data-testid="link-back-home">
        <ChevronLeft className="w-4 h-4" />
        Back
      </Link>
    </header>
  );

  if (magicLinkSent) {
    return (
      <div className="editorial-page min-h-screen flex flex-col safe-x">
        <BrandHeader />
        <main className="flex-1 flex items-center justify-center px-4 pb-12">
          <Card className="w-full max-w-md editorial-card">
            <CardContent className="p-8 text-center space-y-5">
              <div className="w-14 h-14 mx-auto rounded-full grid place-items-center" style={{ background: "hsl(var(--paprika) / 0.12)" }}>
                <Mail className="w-6 h-6" style={{ color: "hsl(var(--paprika))" }} />
              </div>
              <div className="section-num">Check your email</div>
              <h2 className="editorial-display text-3xl">We sent you a link.</h2>
              <p className="text-muted-foreground">
                {isSignUp ? "Confirmation" : "Login"} link is in your inbox at <strong className="text-foreground">{email}</strong>.
              </p>
              <Button variant="ghost" onClick={() => { setMagicLinkSent(false); setIsSignUp(false); }}>
                Back to sign in
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="editorial-page min-h-screen flex flex-col safe-x">
      <BrandHeader />

      <main className="flex-1 flex items-center justify-center px-4 pb-16 pt-4 relative z-[1]">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-8"
          >
            <div className="eyebrow mb-5 inline-flex">
              <span className="dot"></span>
              {isSignUp ? "Create your account" : "Welcome back"}
            </div>
            <h1 className="editorial-display text-5xl sm:text-6xl mb-4" data-testid="text-login-title">
              {isSignUp ? (<>Let's <em>begin.</em></>) : (<>Sign <em>in.</em></>)}
            </h1>
            <p className="text-muted-foreground max-w-xs mx-auto" data-testid="text-login-subtitle">
              Save your crews, track your taste, and never argue about dinner again.
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <Card className="editorial-card !p-0">
              <CardContent className="p-7 space-y-6">
                {/* Google OAuth */}
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full h-12 text-base rounded-full border-[1.5px]"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  data-testid="button-google-signin"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-3 font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground">Or with email</span>
                  </div>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="h-11"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full h-12 text-base rounded-full"
                    disabled={loading}
                    data-testid="button-continue-signin"
                  >
                    {loading ? "Loading..." : isSignUp ? "Create account" : "Sign in"}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </form>

                <div className="flex flex-col gap-2 items-center pt-2 border-t border-border">
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline pt-3"
                    onClick={handleMagicLink}
                    disabled={loading}
                  >
                    Email me a magic link instead
                  </button>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                  >
                    {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                  </button>
                </div>

                {/* Benefits strip */}
                <div className="pt-5 border-t border-border">
                  <div className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground mb-3">What you unlock</div>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3 text-sm" data-testid="text-benefit-crews">
                      <Users className="w-4 h-4" style={{ color: "hsl(var(--paprika))" }} />
                      <span className="text-muted-foreground">Saved crews that stick around</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm" data-testid="text-benefit-tracking">
                      <Utensils className="w-4 h-4" style={{ color: "hsl(var(--sage))" }} />
                      <span className="text-muted-foreground">History of where you've been</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm" data-testid="text-benefit-security">
                      <Shield className="w-4 h-4" style={{ color: "hsl(var(--ink))" }} />
                      <span className="text-muted-foreground">Secure, industry-standard auth</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
