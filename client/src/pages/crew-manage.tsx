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
import { ArrowLeft, Crown, UserMinus, UserPlus, Trash2, LogOut, History, Users, Copy, Check, Share2, Send } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
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
  matchedRestaurantId?: string;
  startedAt: string;
  endedAt?: string;
}

export default function CrewManage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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
    
    const shareMessage = `Join my crew "${crew.name}" on ChickenTinders! Use code: ${crew.inviteCode}`;
    
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
  });

  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ["/api/friends"],
    enabled: isAuthenticated,
  });

  const { data: sessions = [] } = useQuery<DiningSession[]>({
    queryKey: ["/api/crews", params.id, "sessions"],
    enabled: isAuthenticated && !!params.id,
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
          <a href="/api/login">
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

  return (
    <div className="min-h-screen bg-background">
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

      <main className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
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
                <div className="space-y-2">
                  {sessions.slice(0, 5).map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      data-testid={`session-${session.id}`}
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(session.startedAt).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {session.matchedRestaurantId ? "Match found!" : "No match"}
                        </p>
                      </div>
                      <Badge variant={session.matchedRestaurantId ? "default" : "secondary"}>
                        {session.endedAt ? "Completed" : "In Progress"}
                      </Badge>
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
