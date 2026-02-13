import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Crown, UserMinus, UserPlus, Trash2, LogOut, History, Users, Copy, Check, Share2, Send, ChevronDown, ChevronUp, MapPin, Utensils, Play, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface CrewMember {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

interface Crew {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  inviteCode: string;
  members: CrewMember[];
  createdAt: string;
  updatedAt: string;
}

interface Friend {
  id: string;
  friendId: string;
  friendName: string;
  friendEmail: string;
  friendImage?: string;
  status: "pending" | "accepted";
  isRequester: boolean;
}

interface DiningSession {
  id: string;
  groupId: string;
  status?: string;
  createdById?: string;
  matchCount: number;
  startedAt: string;
  endedAt?: string;
  visitedRestaurantId?: string;
  visitedRestaurantData?: {
    name: string;
    cuisine: string;
    imageUrl?: string;
  };
  visitedAt?: string;
}

interface SessionMatch {
  id: string;
  sessionId: string;
  restaurantId: string;
  restaurantData: {
    name: string;
    cuisine: string;
    priceRange: string;
    rating: number;
    imageUrl?: string;
  };
  matchedAt: string;
}

export default function CrewManage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [isJoiningSession, setIsJoiningSession] = useState(false);

  const joinSession = useCallback(async (groupId: string) => {
    setIsJoiningSession(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/join-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("grubmatch-member-id", data.memberId);
        localStorage.setItem("grubmatch-group-id", groupId);
        navigate(`/group/${groupId}`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast({
          title: "Couldn't join session",
          description: errorData.error || "The session may have ended.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Couldn't join session",
        description: "Something went wrong. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsJoiningSession(false);
    }
  }, [navigate, toast]);

  const copyInviteCode = () => {
    if (crew?.inviteCode) {
      navigator.clipboard.writeText(crew.inviteCode);
      setCopied(true);
      toast({ title: "Copied!", description: "Invite code copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareInviteCode = async () => {
    if (!crew) return;
    
    const joinUrl = `${window.location.origin}/join?code=${crew.inviteCode}`;
    const shareMessage = `Join my crew "${crew.name}" on ChickenTinders: ${joinUrl}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my ChickenTinders crew!",
          text: shareMessage,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          navigator.clipboard.writeText(shareMessage);
          toast({ title: "Copied!", description: "Share message copied to clipboard" });
        }
      }
    } else {
      navigator.clipboard.writeText(shareMessage);
      toast({ title: "Copied!", description: "Share message copied to clipboard" });
    }
  };

  const { data: crew, isLoading: crewLoading } = useQuery<Crew>({
    queryKey: ["/api/crews", params.id],
    enabled: isAuthenticated && !!params.id,
    refetchInterval: 10000,
  });

  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ["/api/friends"],
    enabled: isAuthenticated,
  });

  const { data: sessions = [] } = useQuery<DiningSession[]>({
    queryKey: ["/api/crews", params.id, "sessions"],
    enabled: isAuthenticated && !!params.id,
    refetchInterval: 10000,
  });

  const { data: sessionMatches = [] } = useQuery<SessionMatch[]>({
    queryKey: ["/api/sessions", expandedSessionId, "matches"],
    enabled: isAuthenticated && !!expandedSessionId,
  });

  const markVisitedMutation = useMutation({
    mutationFn: async ({ sessionId, restaurantId, restaurantData }: { 
      sessionId: string; 
      restaurantId: string; 
      restaurantData: SessionMatch["restaurantData"];
    }) => {
      return apiRequest("POST", `/api/sessions/${sessionId}/visited`, { 
        restaurantId, 
        restaurantData 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crews", params.id, "sessions"] });
      toast({ title: "Logged!", description: "Your visit has been recorded" });
      setExpandedSessionId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log visit", variant: "destructive" });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest("POST", `/api/crews/${params.id}/members`, { memberId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crews", params.id] });
      toast({ title: "Member added!", description: "They'll be notified about joining the crew." });
      setIsAddMemberOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add member", variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest("DELETE", `/api/crews/${params.id}/members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crews", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crews"] });
      toast({ title: "Member removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove member", variant: "destructive" });
    },
  });

  const deleteCrewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/crews/${params.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crews"] });
      toast({ title: "Crew deleted" });
      navigate("/dashboard");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete crew", variant: "destructive" });
    },
  });

  const leaveCrewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/crews/${params.id}/members/${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crews"] });
      toast({ title: "Left crew" });
      navigate("/dashboard");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to leave crew", variant: "destructive" });
    },
  });

  if (authLoading || crewLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center">
          <p className="mb-4">Please sign in to manage crews.</p>
          <a href="/login">
            <Button data-testid="button-signin">Sign In</Button>
          </a>
        </Card>
      </div>
    );
  }

  if (!crew) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center">
          <p className="mb-4">Crew not found.</p>
          <Link href="/dashboard">
            <Button data-testid="button-back-dashboard">Back to Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isOwner = crew.ownerId === user.id;
  const acceptedFriends = friends.filter(f => f.status === "accepted");
  const allMemberIds = [crew.ownerId, ...crew.memberIds];
  const availableFriends = acceptedFriends.filter(f => !allMemberIds.includes(f.friendId));
  const activeSessions = sessions.filter(s => s.status === "active" || (!s.endedAt && !s.status));

  return (
    <div className="min-h-screen bg-background safe-top safe-x">
      <header className="flex items-center gap-4 p-4 md:p-6 border-b">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{crew.name}</h1>
          <p className="text-sm text-muted-foreground">
            {crew.members.length} member{crew.members.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isOwner && (
          <Badge variant="secondary">
            <Crown className="w-3 h-3 mr-1" />
            Owner
          </Badge>
        )}
      </header>

      <main className="p-4 md:p-6 max-w-2xl mx-auto space-y-6 safe-bottom">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Invite Code
              </CardTitle>
              <CardDescription>Share this code to invite friends to your crew</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-muted rounded-lg p-4 text-center">
                  <span className="text-2xl font-mono font-bold tracking-widest" data-testid="text-invite-code">
                    {crew.inviteCode}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant={copied ? "default" : "outline"}
                    size="icon"
                    onClick={copyInviteCode}
                    data-testid="button-copy-code"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="default"
                    size="icon"
                    onClick={shareInviteCode}
                    data-testid="button-share-code"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3 text-center">
                Share the code with friends or tap send to message them directly
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {activeSessions.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
          >
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">Active Session</p>
                    <p className="text-sm text-muted-foreground">
                      Started {new Date(activeSessions[0].startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  <Button
                    data-testid="button-join-active-session"
                    disabled={isJoiningSession}
                    onClick={() => joinSession(activeSessions[0].groupId)}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {isJoiningSession ? "Joining..." : "Join"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Members
                </CardTitle>
                <CardDescription>People in this crew</CardDescription>
              </div>
              {isOwner && availableFriends.length > 0 && (
                <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-member">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add a Friend to Crew</DialogTitle>
                      <DialogDescription>
                        Select a friend to add to {crew.name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {availableFriends.map((friend) => (
                        <div
                          key={friend.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                          onClick={() => addMemberMutation.mutate(friend.friendId)}
                          data-testid={`button-invite-${friend.friendId}`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={friend.friendImage} />
                              <AvatarFallback>
                                {friend.friendName?.[0] || friend.friendEmail?.[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{friend.friendName || "Friend"}</p>
                              <p className="text-xs text-muted-foreground">{friend.friendEmail}</p>
                            </div>
                          </div>
                          <UserPlus className="w-4 h-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                    {availableFriends.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        All your friends are already in this crew!
                      </p>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddMemberOpen(false)}>
                        Cancel
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {crew.members.map((member) => {
                const isMemberOwner = member.id === crew.ownerId;
                const canRemove = isOwner && !isMemberOwner;
                
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`member-${member.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={member.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {member.firstName?.[0] || member.email?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {member.firstName 
                              ? `${member.firstName}${member.lastName ? ` ${member.lastName}` : ""}`
                              : member.email}
                          </p>
                          {isMemberOwner && (
                            <Crown className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    {canRemove && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMemberMutation.mutate(member.id)}
                        disabled={removeMemberMutation.isPending}
                        data-testid={`button-remove-${member.id}`}
                      >
                        <UserMinus className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Dining History
              </CardTitle>
              <CardDescription>Past sessions with this crew</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No dining sessions yet. Start one from the dashboard!
                </p>
              ) : (
                <div className="space-y-3">
                  {sessions.slice(0, 5).map((session) => (
                    <div key={session.id} className="rounded-lg bg-muted/50 overflow-hidden">
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer hover-elevate"
                        onClick={() => setExpandedSessionId(expandedSessionId === session.id ? null : session.id)}
                        data-testid={`session-${session.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Utensils className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {new Date(session.startedAt).toLocaleDateString()}
                            </p>
                            {session.visitedRestaurantData ? (
                              <p className="text-sm text-primary flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                Went to {session.visitedRestaurantData.name}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {session.matchCount > 0 ? `${session.matchCount} match${session.matchCount !== 1 ? "es" : ""} - tap to log visit` : "No matches"}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {session.status === "active" || (!session.endedAt && !session.status) ? (
                            <Button
                              size="sm"
                              data-testid={`button-join-session-${session.id}`}
                              disabled={isJoiningSession}
                              onClick={(e) => {
                                e.stopPropagation();
                                joinSession(session.groupId);
                              }}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Join
                            </Button>
                          ) : (
                            <Badge variant={session.visitedRestaurantId ? "default" : "secondary"}>
                              {session.visitedRestaurantId ? "Visited" : "Completed"}
                            </Badge>
                          )}
                          {session.matchCount > 0 && !session.visitedRestaurantId && (
                            expandedSessionId === session.id ? 
                              <ChevronUp className="w-4 h-4 text-muted-foreground" /> : 
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      
                      {expandedSessionId === session.id && !session.visitedRestaurantId && sessionMatches.length > 0 && (
                        <div className="px-3 pb-3 border-t border-border/50">
                          <p className="text-sm text-muted-foreground py-2">Where did you end up going?</p>
                          <div className="space-y-2">
                            {sessionMatches.map((match) => (
                              <div
                                key={match.id}
                                className="flex items-center justify-between p-2 rounded-md bg-background hover-elevate cursor-pointer"
                                onClick={() => markVisitedMutation.mutate({
                                  sessionId: session.id,
                                  restaurantId: match.restaurantId,
                                  restaurantData: match.restaurantData,
                                })}
                                data-testid={`button-visited-${match.restaurantId}`}
                              >
                                <div className="flex items-center gap-2">
                                  {match.restaurantData?.imageUrl && (
                                    <div 
                                      className="w-8 h-8 rounded bg-cover bg-center" 
                                      style={{ backgroundImage: `url(${match.restaurantData.imageUrl})` }}
                                    />
                                  )}
                                  <div>
                                    <p className="text-sm font-medium">{match.restaurantData?.name}</p>
                                    <p className="text-xs text-muted-foreground">{match.restaurantData?.cuisine}</p>
                                  </div>
                                </div>
                                <Button size="sm" variant="ghost" disabled={markVisitedMutation.isPending}>
                                  We went here!
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                {isOwner ? "Delete this crew permanently" : "Leave this crew"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isOwner ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" data-testid="button-delete-crew">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Crew
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {crew.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the crew and remove all members. 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteCrewMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-delete"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" data-testid="button-leave-crew">
                      <LogOut className="w-4 h-4 mr-2" />
                      Leave Crew
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Leave {crew.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You'll need to be re-invited by the owner to rejoin this crew.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => leaveCrewMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-leave"
                      >
                        Leave
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
