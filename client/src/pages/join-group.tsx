import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { joinGroupSchema, type JoinGroup } from "@shared/schema";
import { getAuthHeaders, API_BASE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Loader2, Ticket, Smartphone, Users, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import logoImage from "@assets/460272BC-3FCC-4927-8C2E-4C236353E7AB_1768880143398.png";
import { ActivePartyCard } from "@/components/active-party-card";

interface CrewPreview {
  name: string;
  memberCount: number;
  members: { firstName: string | null; profileImageUrl: string | null }[];
}

export default function JoinGroupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const codeFromUrl = (urlParams.get("code") || "").toUpperCase().slice(0, 6);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [joiningCrew, setJoiningCrew] = useState(false);

  const isInBrowser = useMemo(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as any).standalone === true;
    return !isStandalone && !!codeFromUrl;
  }, [codeFromUrl]);

  const form = useForm<JoinGroup>({
    resolver: zodResolver(joinGroupSchema),
    defaultValues: {
      code: codeFromUrl,
      memberName: user?.firstName || "",
    },
  });

  const currentCode = form.watch("code");

  useEffect(() => {
    if (codeFromUrl) {
      form.setValue("code", codeFromUrl);
    }
  }, [codeFromUrl, form]);

  // Auto-fill name from profile when user loads
  useEffect(() => {
    if (user?.firstName && !form.getValues("memberName")) {
      form.setValue("memberName", user.firstName);
    }
  }, [user, form]);

  const { data: crewPreview, isLoading: previewLoading } = useQuery<CrewPreview | null>({
    queryKey: ["/api/crews/preview", currentCode?.length === 6 ? currentCode.toUpperCase() : ""],
    queryFn: async () => {
      const code = currentCode?.toUpperCase().trim();
      if (!code || code.length !== 6) return null;
      const res = await fetch(`${API_BASE}/api/crews/preview/${code}`);
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json();
    },
    enabled: (currentCode?.length || 0) === 6,
    retry: false,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!isAuthenticated || !codeFromUrl) return;
    const pendingJoin = sessionStorage.getItem("chickentinders-pending-crew-join");
    if (pendingJoin !== "true") return;
    sessionStorage.removeItem("chickentinders-pending-crew-join");
    
    const joinCrew = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/crews/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
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

  const handleJoinCrew = async () => {
    const code = currentCode?.toUpperCase().trim();
    if (!code) return;

    if (!isAuthenticated) {
      sessionStorage.setItem("chickentinders-join-code", code);
      sessionStorage.setItem("chickentinders-pending-crew-join", "true");
      window.location.href = "/login";
      return;
    }

    setJoiningCrew(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/crews/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ inviteCode: code }),
        credentials: "include",
      });
      if (res.ok) {
        const crew = await res.json();
        toast({
          title: "You're in!",
          description: `You joined the crew "${crew.name}"`,
        });
        setLocation("/dashboard");
      } else {
        const errorData = await res.json().catch(() => ({}));
        if (errorData.message?.includes("already")) {
          toast({ title: "Already a member", description: errorData.message });
        } else {
          toast({
            title: "Couldn't join crew",
            description: errorData.message || "The invite code may be invalid.",
            variant: "destructive",
          });
        }
      }
    } catch {
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setJoiningCrew(false);
    }
  };

  const joinMutation = useMutation({
    mutationFn: async (data: JoinGroup) => {
      const authHeaders = await getAuthHeaders();
      const partyResponse = await fetch(`${API_BASE}/api/groups/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
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

      const crewResponse = await fetch(`${API_BASE}/api/crews/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
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
    <div className="editorial-page min-h-screen safe-top safe-x flex flex-col">
      <header className="editorial-container py-6 flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <Link href="/" className="flex items-center gap-3">
          <img src={logoImage} alt="ChickenTinders" className="w-9 h-9 rounded-[10px] object-cover" />
          <div className="hidden sm:block">
            <div className="font-serif font-bold text-lg tracking-tight leading-none">ChickenTinders</div>
            <div className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-55 mt-0.5">Swipe Together, Dine Together</div>
          </div>
        </Link>
        <div className="w-10" />
      </header>

      <main className="flex-1 px-4 py-8 max-w-md w-full mx-auto safe-bottom relative z-[1]">
        <ActivePartyCard />
        <div className="text-center mb-8">
          <div className="eyebrow mb-5 inline-flex">
            <span className="dot"></span>
            {crewPreview ? "Crew invite" : "Join a party"}
          </div>
          <h1 className="editorial-display text-5xl sm:text-6xl mb-3">
            {crewPreview ? <>You're <em>invited.</em></> : <>Got a <em>code?</em></>}
          </h1>
          <p className="text-muted-foreground max-w-xs mx-auto text-sm">
            {crewPreview ? "Join the crew or enter a different code below." : "Drop the 6-character code and you're in. No signup."}
          </p>
        </div>
        {isInBrowser && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-4"
          >
            <Card className="editorial-card" style={{ borderColor: "hsl(var(--paprika) / 0.35)", background: "hsl(var(--paprika) / 0.05)" }}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "hsl(var(--paprika))" }} />
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

        {crewPreview && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="mb-4"
          >
            <Card className="editorial-card !p-0">
              <CardHeader className="text-center pb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: "hsl(var(--paprika) / 0.12)" }}>
                  <Users className="w-6 h-6" style={{ color: "hsl(var(--paprika))" }} />
                </div>
                <CardTitle className="editorial-display text-3xl" data-testid="text-crew-preview-name">{crewPreview.name}</CardTitle>
                <CardDescription className="font-mono text-[11px] tracking-[0.14em] uppercase">
                  {crewPreview.memberCount} member{crewPreview.memberCount !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap justify-center gap-3" data-testid="crew-preview-members">
                  {crewPreview.members.map((member, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={member.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {member.firstName?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        {member.firstName || "Member"}
                      </span>
                    </div>
                  ))}
                </div>

                {isAuthenticated ? (
                  <Button
                    className="w-full h-12 rounded-full"
                    size="lg"
                    onClick={handleJoinCrew}
                    disabled={joiningCrew}
                    data-testid="button-join-crew"
                  >
                    {joiningCrew ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>Join this crew <ArrowRight className="w-5 h-5 ml-2" /></>
                    )}
                  </Button>
                ) : (
                  <Button
                    className="w-full h-12 rounded-full"
                    size="lg"
                    onClick={handleSignIn}
                    data-testid="button-sign-in-to-join"
                  >
                    Sign in to join
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {previewLoading && currentCode?.length === 6 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 flex justify-center py-4"
          >
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </motion.div>
        )}

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="editorial-card !p-0">
            <CardHeader className="text-center pb-4">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground" data-testid="text-join-title">
                {crewPreview ? "Or join a different party" : "Enter the code"}
              </div>
            </CardHeader>
            <CardContent className="pb-7 px-7">
              {needsAuth ? (
                <div className="space-y-4 text-center">
                  <p className="text-muted-foreground">
                    This is a crew invite code. You need to sign in to join a crew.
                  </p>
                  <Button className="w-full h-12 rounded-full" size="lg" onClick={handleSignIn} data-testid="button-sign-in-to-join">
                    Sign in to join
                  </Button>
                  <Button variant="outline" className="w-full h-12 rounded-full" onClick={() => setNeedsAuth(false)} data-testid="button-try-different-code">
                    Try a different code
                  </Button>
                </div>
              ) : (
                <>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                      <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">Party code</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="ABC123"
                                maxLength={6}
                                className="text-center text-3xl tracking-[0.3em] font-mono uppercase h-16"
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
                            <FormLabel className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">Your name</FormLabel>
                            <FormControl>
                              <Input placeholder="What should we call you?" className="h-11" {...field} data-testid="input-member-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full h-12 rounded-full" size="lg" disabled={joinMutation.isPending} data-testid="button-submit-join">
                        {joinMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Joining the fun...
                          </>
                        ) : (
                          <>Jump in <ArrowRight className="w-5 h-5 ml-2" /></>
                        )}
                      </Button>
                    </form>
                  </Form>

                  <div className="mt-6 pt-5 text-center border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      No code yet?{" "}
                      <Link href="/create" className="font-medium underline decoration-[hsl(var(--paprika))] decoration-2 underline-offset-2 hover:text-[hsl(var(--paprika))]" data-testid="link-create-instead">
                        Start your own
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
