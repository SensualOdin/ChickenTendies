import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Shield, Users, Utensils, Mail } from "lucide-react";
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
        // On native, we generate the OAuth URL and open it in the system browser.
        // The redirect comes back via deep link (chickentinders://...) which the
        // App.tsx deep link handler picks up and sets the Supabase session.
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: "https://chickentinders.app/auth/callback",
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (data.url) {
          await Browser.open({ url: data.url });
        }
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || "Google sign-in failed");
      setLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-screen bg-background flex flex-col safe-top safe-x safe-bottom">
        <header className="flex items-center gap-2 p-4 md:p-6">
          <Link href="/">
            <Button variant="ghost" className="flex items-center gap-2">
              <img src={logoImage} alt="ChickenTinders" className="w-8 h-8 rounded-lg object-cover shadow-md shadow-primary/20" />
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">
                ChickenTinders
              </span>
            </Button>
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 pb-12">
          <Card className="w-full max-w-md border-2">
            <CardContent className="p-6 text-center space-y-4">
              <Mail className="w-12 h-12 text-primary mx-auto" />
              <h2 className="text-xl font-bold">Check your email</h2>
              <p className="text-muted-foreground">
                We sent a {isSignUp ? "confirmation" : "login"} link to <strong>{email}</strong>.
                Click the link to continue.
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
    <div className="min-h-screen bg-background flex flex-col safe-top safe-x safe-bottom">
      <header className="flex items-center gap-2 p-4 md:p-6">
        <Link href="/">
          <Button variant="ghost" className="flex items-center gap-2" data-testid="link-home-from-login">
            <img src={logoImage} alt="ChickenTinders" className="w-8 h-8 rounded-lg object-cover shadow-md shadow-primary/20" data-testid="img-login-header-logo" />
            <span className="text-lg font-bold bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">
              ChickenTinders
            </span>
          </Button>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-8"
          >
            <motion.img
              src={logoImage}
              alt="ChickenTinders logo"
              className="w-20 h-20 rounded-2xl object-cover shadow-xl shadow-primary/30 mx-auto mb-4"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              data-testid="img-login-logo"
            />
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-2" data-testid="text-login-title">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">
                ChickenTinders
              </span>
            </h1>
            <p className="text-muted-foreground" data-testid="text-login-subtitle">
              Sign in to save your crews, track your taste, and never argue about dinner again.
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <Card className="border-2">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm" data-testid="text-benefit-crews">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-muted-foreground">Create and manage your dining crews</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm" data-testid="text-benefit-tracking">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Utensils className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-muted-foreground">Track restaurants you've visited together</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm" data-testid="text-benefit-security">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-muted-foreground">Your data stays secure with industry-standard auth</span>
                  </div>
                </div>

                {/* Google OAuth */}
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full text-base"
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
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">or</span>
                  </div>
                </div>

                {/* Email/Password form */}
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full text-base bg-gradient-to-r from-primary to-orange-500"
                    disabled={loading}
                    data-testid="button-continue-signin"
                  >
                    {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </form>

                <div className="flex flex-col gap-2 items-center">
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={handleMagicLink}
                    disabled={loading}
                  >
                    Send me a magic link instead
                  </button>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                  >
                    {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-6"
          >
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="link-back-home">
                Back to Home
              </Button>
            </Link>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
