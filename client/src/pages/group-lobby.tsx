import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { MemberAvatars } from "@/components/member-avatars";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Flame, Copy, Check, Users, ArrowRight, Loader2, PartyPopper, Sparkles, Clock } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import type { Group, WSMessage } from "@shared/schema";

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

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?groupId=${params.id}&memberId=${memberId}`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      const message: WSMessage = JSON.parse(event.data);
      
      if (message.type === "sync") {
        setGroup(message.group);
      } else if (message.type === "member_joined") {
        // Use functional update to avoid stale closure issues
        setGroup((prev) => {
          if (!prev) return null;
          // Check if member already exists to avoid duplicates
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
      } else if (message.type === "status_changed") {
        if (message.status === "swiping") {
          setLocation(`/group/${params.id}/swipe`);
        }
      }
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [params.id, memberId]);

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
                <CardTitle className="text-lg">The Squad ({group.members.length}) 👥</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <MemberAvatars members={group.members} showNames size="md" />
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
