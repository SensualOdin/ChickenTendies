import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { joinGroupSchema, type JoinGroup } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Flame, Loader2, Ticket, User, Smartphone } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";

export default function JoinGroupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const codeFromUrl = (urlParams.get("code") || "").toUpperCase().slice(0, 6);
  const [needsAuth, setNeedsAuth] = useState(false);

  const isInBrowser = useMemo(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as any).standalone === true;
    return !isStandalone && !!codeFromUrl;
  }, [codeFromUrl]);

  const form = useForm<JoinGroup>({
    resolver: zodResolver(joinGroupSchema),
    defaultValues: {
      code: codeFromUrl,
      memberName: "",
    },
  });

  useEffect(() => {
    if (codeFromUrl) {
      form.setValue("code", codeFromUrl);
    }
  }, [codeFromUrl, form]);

  useEffect(() => {
    if (!isAuthenticated || !codeFromUrl) return;
    const pendingJoin = sessionStorage.getItem("chickentinders-pending-crew-join");
    if (pendingJoin !== "true") return;
    sessionStorage.removeItem("chickentinders-pending-crew-join");
    
    const joinCrew = async () => {
      try {
        const res = await fetch("/api/crews/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteCode: codeFromUrl }),
          credentials: "include",
        });
        if (res.ok) {
          const crew = await res.json();
          toast({
            title: "You're in!",
            description: `You joined the crew "${crew.name}"`,
          });
          setLocation(`/crew/${crew.id}`);
        } else {
          const errorData = await res.json().catch(() => ({}));
          if (errorData.message?.includes("already")) {
            toast({ title: "Already a member", description: errorData.message });
          } else {
            toast({
              title: "Couldn't join crew",
              description: "The invite code may be invalid. Try entering it manually.",
              variant: "destructive",
            });
          }
        }
      } catch {
        toast({
          title: "Something went wrong",
          description: "Please try entering the code again.",
          variant: "destructive",
        });
      }
    };
    joinCrew();
  }, [isAuthenticated, codeFromUrl, toast, setLocation]);

  const joinMutation = useMutation({
    mutationFn: async (data: JoinGroup) => {
      const partyResponse = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (partyResponse.ok) {
        const result = await partyResponse.json();
        return { type: "party" as const, data: result };
      }

      if (partyResponse.status !== 404) {
        throw new Error("INVALID_CODE");
      }

      const crewResponse = await fetch("/api/crews/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: data.code }),
        credentials: "include",
      });

      if (crewResponse.ok) {
        const result = await crewResponse.json();
        return { type: "crew" as const, data: result };
      }

      if (crewResponse.status === 401) {
        throw new Error("AUTH_REQUIRED");
      }

      const errorData = await crewResponse.json().catch(() => ({}));
      if (errorData.message?.includes("already")) {
        throw new Error(errorData.message);
      }

      throw new Error("INVALID_CODE");
    },
    onSuccess: (result) => {
      if (result.type === "party") {
        localStorage.setItem("grubmatch-member-id", result.data.memberId);
        localStorage.setItem("grubmatch-group-id", result.data.group.id);
        setLocation(`/group/${result.data.group.id}`);
      } else {
        toast({
          title: "You're in!",
          description: `You joined the crew "${result.data.name}"`,
        });
        setLocation(`/crew/${result.data.id}`);
      }
    },
    onError: (error: Error) => {
      if (error.message === "AUTH_REQUIRED") {
        setNeedsAuth(true);
        return;
      }
      if (error.message.includes("already")) {
        toast({
          title: "Already a member",
          description: error.message,
        });
        return;
      }
      toast({
        title: "Hmm, that didn't work",
        description: "Double-check that code and try again!",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: JoinGroup) => {
    setNeedsAuth(false);
    joinMutation.mutate({ ...data, code: data.code.toUpperCase() });
  };

  const handleSignIn = () => {
    const code = form.getValues("code");
    sessionStorage.setItem("chickentinders-join-code", code);
    sessionStorage.setItem("chickentinders-pending-crew-join", "true");
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-background safe-top safe-x">
      <header className="flex items-center justify-between p-4 md:p-6">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
            <Flame className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent leading-tight">ChickenTinders</span>
            <span className="text-xs text-muted-foreground hidden sm:block">Swipe Together, Dine Together</span>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-6 py-8 max-w-md mx-auto safe-bottom">
        {isInBrowser && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-4"
          >
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium" data-testid="text-pwa-hint">Already have ChickenTinders on your home screen?</p>
                    <p className="text-muted-foreground mt-1">
                      Open the app and enter code <span className="font-mono font-bold text-foreground">{codeFromUrl}</span> there to stay signed in. Or just continue here!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="border-2">
            <CardHeader className="text-center">
              <motion.div 
                className="text-4xl mb-2"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Ticket className="w-10 h-10 mx-auto text-primary" />
              </motion.div>
              <CardTitle className="text-2xl" data-testid="text-join-title">Join the Party!</CardTitle>
              <CardDescription>
                Got a secret code? Let's get you in!
              </CardDescription>
            </CardHeader>
            <CardContent>
              {needsAuth ? (
                <div className="space-y-4 text-center">
                  <p className="text-muted-foreground">
                    This is a crew invite code. You need to sign in to join a crew.
                  </p>
                  <Button 
                    className="w-full bg-gradient-to-r from-primary to-orange-500"
                    size="lg"
                    onClick={handleSignIn}
                    data-testid="button-sign-in-to-join"
                  >
                    Sign In to Join
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setNeedsAuth(false)}
                    data-testid="button-try-different-code"
                  >
                    Try a Different Code
                  </Button>
                </div>
              ) : (
                <>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Ticket className="w-4 h-4 text-primary" />
                              Secret Party Code
                            </FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="ABC123" 
                                maxLength={6}
                                className="text-center text-2xl tracking-[0.3em] font-mono uppercase border-2 bg-muted/50"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                data-testid="input-group-code"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="memberName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <User className="w-4 h-4 text-accent" />
                              Your Name
                            </FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="What should we call you?" 
                                className="border-2"
                                {...field}
                                data-testid="input-member-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90" 
                        size="lg"
                        disabled={joinMutation.isPending}
                        data-testid="button-submit-join"
                      >
                        {joinMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Joining the fun...
                          </>
                        ) : (
                          "Jump In!"
                        )}
                      </Button>
                    </form>
                  </Form>

                  <div className="mt-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      No code yet?{" "}
                      <Link href="/create" className="text-primary font-medium hover:underline" data-testid="link-create-instead">
                        Start your own party!
                      </Link>
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
