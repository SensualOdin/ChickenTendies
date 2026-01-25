import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Flame, Copy, Check, Users, ArrowRight, Loader2, PartyPopper, Sparkles, Clock, X, Crown, Settings } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import type { Group, WSMessage, GroupMember } from "@shared/schema";

export default function GroupLobby() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [group, setGroup] = useState<Group | null>(null);

  const memberId = localStorage.getItem("grubmatch-member-id");
  const isHost = group?.members.find((m) => m.id === memberId)?.isHost ?? false;

  const { data: initialGroup, isLoading } = useQuery<Group>({
    queryKey: ["/api/groups", params.id],
    enabled: !!params.id,
  });

  useEffect(() => {
    if (initialGroup) {
      setGroup(initialGroup);
    }
  }, [initialGroup]);

  useEffect(() => {
    if (!params.id || !memberId) return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    let isClosedIntentionally = false;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws?groupId=${params.id}&memberId=${memberId}`;
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("WebSocket connected");
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        const message: WSMessage = JSON.parse(event.data);
        
        if (message.type === "sync") {
          setGroup(message.group);
        } else if (message.type === "member_joined") {
          setGroup((prev) => {
            if (!prev) return null;
            if (prev.members.some(m => m.id === message.member.id)) {
              return prev;
            }
            return {
              ...prev,
              members: [...prev.members, message.member],
            };
          });
          toast({
            title: "New party member!",
            description: `${message.member.name} just joined the fun!`,
          });
        } else if (message.type === "member_removed") {
          if (message.memberId === memberId) {
            toast({
              title: "Removed from group",
              description: "You have been removed from this group.",
              variant: "destructive",
            });
            setLocation("/");
          } else {
            setGroup((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                members: prev.members.filter(m => m.id !== message.memberId),
              };
            });
            toast({
              title: "Member left",
              description: `${message.memberName} has left the group.`,
            });
          }
        } else if (message.type === "status_changed") {
          if (message.status === "swiping") {
            setLocation(`/group/${params.id}/swipe`);
          }
        } else if (message.type === "preferences_updated") {
          setGroup((prev) => {
            if (!prev) return null;
            return { ...prev, preferences: message.preferences };
          });
        }
      };

      socket.onclose = () => {
        if (isClosedIntentionally) return;
        
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`WebSocket closed, reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
          reconnectTimeout = setTimeout(connect, delay);
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      setWs(socket);
    };

    connect();

    return () => {
      isClosedIntentionally = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    };
  }, [params.id, memberId, toast, setLocation]);

  const copyCode = useCallback(async () => {
    if (!group) return;
    await navigator.clipboard.writeText(group.code);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Now share it with your hungry friends!",
    });
    setTimeout(() => setCopied(false), 2000);
  }, [group, toast]);

  const handleContinue = () => {
    if (isHost) {
      setLocation(`/group/${params.id}/preferences`);
    }
  };

  const kickMutation = useMutation({
    mutationFn: async (targetMemberId: string) => {
      const response = await apiRequest("DELETE", `/api/groups/${params.id}/members/${targetMemberId}`, {
        hostMemberId: memberId,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Member removed",
        description: "The member has been removed from the group.",
      });
    },
    onError: () => {
      toast({
        title: "Couldn't remove member",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (isLoading || !group) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Flame className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

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

      <main className="px-4 md:px-6 py-8 max-w-lg mx-auto space-y-6">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <Card className="border-2 overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-orange-500/10 p-6 text-center border-b">
              <motion.div 
                className="mb-2"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <PartyPopper className="w-10 h-10 text-primary mx-auto" />
              </motion.div>
              <h2 className="text-xl font-bold">{group.name}</h2>
              <p className="text-sm text-muted-foreground">Your food adventure awaits!</p>
            </div>
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground text-center mb-3">
                  Share this super secret code with your crew:
                </p>
                <button
                  onClick={copyCode}
                  className="w-full p-4 bg-gradient-to-r from-muted to-muted/80 rounded-xl flex items-center justify-center gap-3 hover-elevate border-2 border-dashed border-primary/30 transition-all hover:border-primary"
                  data-testid="button-copy-code"
                >
                  <span className="text-3xl font-mono font-bold tracking-[0.2em] bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent" data-testid="text-group-code">
                    {group.code}
                  </span>
                  {copied ? (
                    <Check className="w-5 h-5 text-accent" />
                  ) : (
                    <Copy className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">The Squad ({group.members.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.members.map((member) => (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  data-testid={`member-row-${member.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-orange-500 text-primary-foreground text-sm">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.name}</span>
                        {member.isHost && (
                          <Crown className="w-4 h-4 text-yellow-500" />
                        )}
                        {member.id === memberId && (
                          <span className="text-xs text-muted-foreground">(you)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isHost && !member.isHost && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => kickMutation.mutate(member.id)}
                      disabled={kickMutation.isPending}
                      data-testid={`button-kick-${member.id}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              {group.members.length === 1 && (
                <motion.p 
                  className="text-sm text-muted-foreground mt-4 text-center"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Waiting for your friends to join...
                </motion.p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {isHost ? (
            <Button 
              size="lg" 
              className="w-full bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 shadow-lg shadow-primary/30"
              onClick={handleContinue}
              disabled={group.members.length < 1}
              data-testid="button-continue"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Set the Vibes
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          ) : (
            <Card className="bg-gradient-to-r from-muted/50 to-muted/30 border-2 border-dashed">
              <CardContent className="py-6 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="inline-block mb-3"
                >
                  <Loader2 className="w-6 h-6 text-primary" />
                </motion.div>
                <p className="text-sm text-muted-foreground">
                  Hang tight! The host is getting things ready...
                </p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </main>
    </div>
  );
}
