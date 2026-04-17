import { useLocation } from "wouter";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertGroupSchema, type InsertGroup } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { storeLeaderToken } from "@/lib/leader-token";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Loader2, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import logoImage from "@assets/460272BC-3FCC-4927-8C2E-4C236353E7AB_1768880143398.png";

export default function CreateGroup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<InsertGroup>({
    resolver: zodResolver(insertGroupSchema),
    defaultValues: { name: "", hostName: user?.firstName || "" },
  });

  useEffect(() => {
    if (user?.firstName && !form.getValues("hostName")) {
      form.setValue("hostName", user.firstName);
    }
  }, [user, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertGroup) => {
      const response = await apiRequest("POST", "/api/groups", data);
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("grubmatch-member-id", data.memberId);
      localStorage.setItem("grubmatch-group-id", data.group.id);
      if (data.leaderToken) storeLeaderToken(data.group.id, data.leaderToken);
      setLocation(`/group/${data.group.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Oops!",
        description: error.message || "Something went wrong. Let's try that again!",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertGroup) => createMutation.mutate(data);

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

      <main className="flex-1 flex items-center justify-center px-4 pb-16 pt-4 relative z-[1]">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="eyebrow mb-5 inline-flex">
              <span className="dot"></span>
              Step 01 — Start a party
            </div>
            <h1 className="editorial-display text-5xl sm:text-6xl mb-4">
              Name the <em>party.</em>
            </h1>
            <p className="text-muted-foreground max-w-xs mx-auto">
              Create your crew and share one link. No account needed for guests.
            </p>
          </div>

          <Card className="editorial-card !p-0">
            <CardContent className="p-7">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">Party name</FormLabel>
                        <FormControl>
                          <Input placeholder="Friday Feast Squad" className="h-11" {...field} data-testid="input-group-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hostName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">Your name</FormLabel>
                        <FormControl>
                          <Input placeholder="What should we call you?" className="h-11" {...field} data-testid="input-host-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" size="lg" className="w-full h-12 rounded-full" disabled={createMutation.isPending} data-testid="button-submit-create">
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Getting the party ready...
                      </>
                    ) : (
                      <>
                        Let's go
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-6 pt-5 text-center border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Already have a code?{" "}
                  <Link href="/join" className="font-medium underline decoration-[hsl(var(--paprika))] decoration-2 underline-offset-2 hover:text-[hsl(var(--paprika))]" data-testid="link-join-instead">
                    Join instead
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
