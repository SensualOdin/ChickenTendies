import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ThemeToggle } from "@/components/theme-toggle";
import { insertGroupSchema, type InsertGroup } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Flame, Loader2, PartyPopper, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function CreateGroup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<InsertGroup>({
    resolver: zodResolver(insertGroupSchema),
    defaultValues: {
      name: "",
      hostName: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertGroup) => {
      const response = await apiRequest("POST", "/api/groups", data);
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("grubmatch-member-id", data.memberId);
      localStorage.setItem("grubmatch-group-id", data.group.id);
      setLocation(`/group/${data.group.id}`);
    },
    onError: () => {
      toast({
        title: "Oops! 😅",
        description: "Something went wrong. Let's try that again!",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertGroup) => {
    createMutation.mutate(data);
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
          <span className="font-bold bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">ChickenTinders</span>
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
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                🎉
              </motion.div>
              <CardTitle className="text-2xl">Start a Food Party!</CardTitle>
              <CardDescription>
                Create your crew and get ready to find the perfect spot
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <PartyPopper className="w-4 h-4 text-primary" />
                          Party Name
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Friday Feast Squad 🍕" 
                            className="border-2"
                            {...field}
                            data-testid="input-group-name"
                          />
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
                        <FormLabel className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-accent" />
                          Your Name
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="What should we call you?" 
                            className="border-2"
                            {...field}
                            data-testid="input-host-name"
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
                    disabled={createMutation.isPending}
                    data-testid="button-submit-create"
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Getting the party ready...
                      </>
                    ) : (
                      <>
                        <Flame className="w-4 h-4 mr-2" />
                        Let's Go!
                      </>
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Already have a party code?{" "}
                  <Link href="/join" className="text-primary font-medium hover:underline" data-testid="link-join-instead">
                    Join the fun!
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
