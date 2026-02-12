import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Shield, Users, Utensils } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import logoImage from "@assets/460272BC-3FCC-4927-8C2E-4C236353E7AB_1768880143398.png";

export default function LoginPage() {
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
                    <span className="text-muted-foreground">Your data stays secure with Replit's trusted sign-in</span>
                  </div>
                </div>

                <a href="/api/login" className="block" data-testid="link-continue-signin">
                  <Button
                    size="lg"
                    className="w-full text-base bg-gradient-to-r from-primary to-orange-500"
                    data-testid="button-continue-signin"
                  >
                    Continue with Replit
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </a>

                <p className="text-xs text-center text-muted-foreground" data-testid="text-signin-explanation">
                  ChickenTinders uses Replit for secure sign-in.
                  You'll be briefly redirected to approve access, then brought right back.
                </p>
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
