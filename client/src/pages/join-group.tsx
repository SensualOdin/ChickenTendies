import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ThemeToggle } from "@/components/theme-toggle";
import { joinGroupSchema, type JoinGroup } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Flame, Loader2, Ticket, User } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function JoinGroupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<JoinGroup>({
    resolver: zodResolver(joinGroupSchema),
    defaultValues: {
      code: "",
      memberName: "",
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (data: JoinGroup) => {
      const response = await apiRequest("POST", "/api/groups/join", data);
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("grubmatch-member-id", data.memberId);
      localStorage.setItem("grubmatch-group-id", data.group.id);
      setLocation(`/group/${data.group.id}`);
    },
    onError: () => {
      toast({
        title: "Hmm, that didn't work 🤔",
        description: "Double-check that code and try again!",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: JoinGroup) => {
    joinMutation.mutate({ ...data, code: data.code.toUpperCase() });
  };

  return (
    <div className="min-h-screen bg-background">
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
        <ThemeToggle />
      </header>

      <main className="px-4 md:px-6 py-8 max-w-md mx-auto">
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
                🎟️
              </motion.div>
              <CardTitle className="text-2xl">Join the Party!</CardTitle>
              <CardDescription>
                Got a secret code? Let's get you in!
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                      <>
                        🚀 Jump In!
                      </>
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
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
