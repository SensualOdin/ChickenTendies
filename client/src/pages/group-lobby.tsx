import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { MemberAvatars } from "@/components/member-avatars";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Utensils, Copy, Check, Users, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
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
      } else if (message.type === "member_joined" && group) {
        setGroup((prev) => prev ? {
          ...prev,
          members: [...prev.members, message.member],
        } : null);
        toast({
          title: "New member joined!",
          description: `${message.member.name} has joined the group`,
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
      description: "Share this code with your friends",
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Utensils className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold">GrubMatch</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="px-4 md:px-6 py-8 max-w-lg mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{group.name}</CardTitle>
            <CardDescription>
              Share this code with friends to invite them
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <button
              onClick={copyCode}
              className="w-full p-4 bg-muted rounded-lg flex items-center justify-center gap-3 hover-elevate"
              data-testid="button-copy-code"
            >
              <span className="text-3xl font-mono font-bold tracking-widest" data-testid="text-group-code">
                {group.code}
              </span>
              {copied ? (
                <Check className="w-5 h-5 text-accent" />
              ) : (
                <Copy className="w-5 h-5 text-muted-foreground" />
              )}
            </button>

            <div className="text-center text-sm text-muted-foreground">
              Share this code or copy the link below
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-lg">Members ({group.members.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <MemberAvatars members={group.members} showNames size="md" />
          </CardContent>
        </Card>

        {isHost ? (
          <Button 
            size="lg" 
            className="w-full"
            onClick={handleContinue}
            disabled={group.members.length < 1}
            data-testid="button-continue"
          >
            Set Preferences
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        ) : (
          <Card className="bg-muted/50">
            <CardContent className="py-6 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Waiting for the host to set preferences and start swiping...
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
