import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Users, Plus, LogOut, ArrowRight, UserPlus, Check, X, UserMinus, Bell, BellRing, Play, User } from "lucide-react";
import { motion } from "framer-motion";
import logoImage from "@assets/460272BC-3FCC-4927-8C2E-4C236353E7AB_1768880143398.png";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Friend {
  id: string;
  friendId: string;
  friendName: string;
  friendEmail: string;
  friendImage?: string;
  status: "pending" | "accepted";
  isRequester: boolean;
}

interface Crew {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  isOwner: boolean;
}

interface Notification {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function Dashboard() {
  const { user, logout, isAuthenticated, isLoading: authLoading } = useAuth();
  useNotifications();
  const { isPushSupported, permission, isSubscribed, isLoading: pushLoading, subscribe } = usePushNotifications();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newCrewName, setNewCrewName] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const [isCreateCrewOpen, setIsCreateCrewOpen] = useState(false);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);

  const { data: friends = [], isLoading: friendsLoading } = useQuery<Friend[]>({
    queryKey: ["/api/friends"],
    enabled: isAuthenticated,
  });

  const { data: crews = [], isLoading: crewsLoading } = useQuery<Crew[]>({
    queryKey: ["/api/crews"],
    enabled: isAuthenticated,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: isAuthenticated,
  });

  const createCrewMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/crews", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crews"] });
      setNewCrewName("");
      setIsCreateCrewOpen(false);
      toast({ title: "Crew created!", description: "Your new crew is ready to roll." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create crew", variant: "destructive" });
    },
  });

  const sendFriendRequestMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest("POST", "/api/friends/request", { email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      setFriendEmail("");
      setIsAddFriendOpen(false);
      toast({ title: "Friend request sent!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to send friend request", variant: "destructive" });
    },
  });

  const acceptFriendMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      return apiRequest("POST", `/api/friends/${friendshipId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      toast({ title: "Friend request accepted!" });
    },
  });

  const rejectFriendMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      return apiRequest("POST", `/api/friends/${friendshipId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      toast({ title: "Friend request declined" });
    },
  });

  const startSessionMutation = useMutation({
    mutationFn: async (crew: Crew) => {
      // First create a dining session (this sends notifications to crew members)
      await apiRequest("POST", `/api/crews/${crew.id}/sessions`, {});
      
      // Then create the swiping group
      const response = await apiRequest("POST", "/api/groups", {
        name: `${crew.name} Session`,
        hostName: user?.firstName || user?.email?.split("@")[0] || "Host",
      });
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("grubmatch-member-id", data.memberId);
      localStorage.setItem("grubmatch-group-id", data.group.id);
      navigate(`/group/${data.group.id}/preferences`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start session", variant: "destructive" });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      return apiRequest("DELETE", `/api/friends/${friendshipId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      toast({ title: "Friend removed" });
    },
  });

  const pendingRequests = friends.filter(f => f.status === "pending" && !f.isRequester);
  const sentRequests = friends.filter(f => f.status === "pending" && f.isRequester);
  const acceptedFriends = friends.filter(f => f.status === "accepted");
  const unreadNotifications = notifications.filter(n => !n.isRead);

  if (authLoading) {
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
          <p className="mb-4">Please sign in to access your dashboard.</p>
          <a href="/api/login">
            <Button data-testid="button-signin">Sign In</Button>
          </a>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between p-4 md:p-6 border-b">
        <Link href="/" className="flex items-center gap-2">
          <img src={logoImage} alt="ChickenTinders" className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-primary/30" />
          <div className="flex flex-col">
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent leading-tight">
              ChickenTinders
            </span>
            <span className="text-xs text-muted-foreground hidden sm:block">Swipe Together, Dine Together</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Button variant="ghost" size="icon" data-testid="button-notifications">
              <Bell className="w-5 h-5" />
              {unreadNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                  {unreadNotifications.length}
                </span>
              )}
            </Button>
          </div>
          <Link href="/profile">
            <Avatar className="w-8 h-8 cursor-pointer hover:ring-2 ring-primary transition-all">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback>
                {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
          <span className="hidden sm:inline font-medium">{user.firstName || user.email}</span>
          <Link href="/profile">
            <Button variant="ghost" size="icon" data-testid="button-profile">
              <User className="w-5 h-5" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => logout()} data-testid="button-logout">
            <LogOut className="w-5 h-5" />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Welcome back, {user.firstName || "Chef"}!</h1>
          <p className="text-muted-foreground">Ready to find where to eat tonight?</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card className="hover-elevate cursor-pointer" onClick={() => navigate("/create")} data-testid="card-quick-start">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
                <Play className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold">Quick Start</h3>
                <p className="text-sm text-muted-foreground">Start a new dining session</p>
              </div>
              <ArrowRight className="w-5 h-5 ml-auto text-muted-foreground" />
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => navigate("/join")} data-testid="card-join-party">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-emerald-500 flex items-center justify-center">
                <Users className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-bold">Join a Party</h3>
                <p className="text-sm text-muted-foreground">Enter a group code</p>
              </div>
              <ArrowRight className="w-5 h-5 ml-auto text-muted-foreground" />
            </CardContent>
          </Card>

          <Dialog open={isCreateCrewOpen} onOpenChange={setIsCreateCrewOpen}>
            <DialogTrigger asChild>
              <Card className="hover-elevate cursor-pointer" data-testid="card-create-crew">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold">Create a Crew</h3>
                    <p className="text-sm text-muted-foreground">Start a persistent group</p>
                  </div>
                  <ArrowRight className="w-5 h-5 ml-auto text-muted-foreground" />
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a New Crew</DialogTitle>
                <DialogDescription>
                  Crews are persistent groups you can start dining sessions with anytime.
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="Crew name (e.g., The Lunch Bunch)"
                value={newCrewName}
                onChange={(e) => setNewCrewName(e.target.value)}
                data-testid="input-crew-name"
              />
              <DialogFooter>
                <Button
                  onClick={() => createCrewMutation.mutate(newCrewName)}
                  disabled={!newCrewName.trim() || createCrewMutation.isPending}
                  data-testid="button-create-crew-confirm"
                >
                  Create Crew
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isPushSupported && !isSubscribed && permission !== "denied" && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-6"
          >
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <BellRing className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">Enable Notifications</h3>
                  <p className="text-sm text-muted-foreground">Get notified when your crew starts a dining session</p>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    const success = await subscribe();
                    if (success) {
                      toast({ title: "Notifications enabled!", description: "You'll be notified when sessions start." });
                    } else if (permission === "denied") {
                      toast({ title: "Notifications blocked", description: "Please enable notifications in your browser settings.", variant: "destructive" });
                    }
                  }}
                  disabled={pushLoading}
                  data-testid="button-enable-notifications"
                >
                  {pushLoading ? "Enabling..." : "Enable"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <Tabs defaultValue="crews" className="space-y-4">
          <TabsList>
            <TabsTrigger value="crews" data-testid="tab-crews">My Crews</TabsTrigger>
            <TabsTrigger value="friends" data-testid="tab-friends">
              Friends
              {pendingRequests.length > 0 && (
                <Badge variant="secondary" className="ml-2">{pendingRequests.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crews" className="space-y-4">
            {crewsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading crews...</div>
            ) : crews.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-bold mb-2">No crews yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first crew to start dining with friends!</p>
                  <Button onClick={() => setIsCreateCrewOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create a Crew
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {crews.map((crew) => (
                  <Card key={crew.id} className="hover-elevate">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                      <div>
                        <CardTitle className="text-lg">{crew.name}</CardTitle>
                        <CardDescription>{crew.memberCount} member{crew.memberCount !== 1 ? "s" : ""}</CardDescription>
                      </div>
                      {crew.isOwner && <Badge variant="secondary">Owner</Badge>}
                    </CardHeader>
                    <CardContent className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="flex-1" 
                        data-testid={`button-start-session-${crew.id}`}
                        onClick={() => startSessionMutation.mutate(crew)}
                        disabled={startSessionMutation.isPending}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        {startSessionMutation.isPending ? "Starting..." : "Start Session"}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        data-testid={`button-manage-crew-${crew.id}`}
                        onClick={() => toast({ title: crew.name, description: `${crew.memberCount || 1} member${(crew.memberCount || 1) !== 1 ? 's' : ''}. Crew management coming soon!` })}
                      >
                        Manage
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="friends" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">Your Friends</h3>
              <Dialog open={isAddFriendOpen} onOpenChange={setIsAddFriendOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-friend">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Friend
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add a Friend</DialogTitle>
                    <DialogDescription>
                      Enter your friend's email to send them a friend request.
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    type="email"
                    placeholder="friend@email.com"
                    value={friendEmail}
                    onChange={(e) => setFriendEmail(e.target.value)}
                    data-testid="input-friend-email"
                  />
                  <DialogFooter>
                    <Button
                      onClick={() => sendFriendRequestMutation.mutate(friendEmail)}
                      disabled={!friendEmail.trim() || sendFriendRequestMutation.isPending}
                      data-testid="button-send-friend-request"
                    >
                      Send Request
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {pendingRequests.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={request.friendImage} />
                          <AvatarFallback>{request.friendName?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{request.friendName || request.friendEmail}</p>
                          <p className="text-xs text-muted-foreground">{request.friendEmail}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => acceptFriendMutation.mutate(request.id)}
                          data-testid={`button-accept-${request.id}`}
                        >
                          <Check className="w-4 h-4 text-green-500" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => rejectFriendMutation.mutate(request.id)}
                          data-testid={`button-reject-${request.id}`}
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {sentRequests.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Sent Requests</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {sentRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>{request.friendEmail?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{request.friendEmail}</p>
                          <p className="text-xs text-muted-foreground">Pending...</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {friendsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading friends...</div>
            ) : acceptedFriends.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <UserPlus className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-bold mb-2">No friends yet</h3>
                  <p className="text-muted-foreground mb-4">Add friends to invite them to your crews!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {acceptedFriends.map((friend) => (
                  <Card key={friend.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={friend.friendImage} />
                          <AvatarFallback>{friend.friendName?.[0] || friend.friendEmail?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{friend.friendName || "Friend"}</p>
                          <p className="text-sm text-muted-foreground">{friend.friendEmail}</p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeFriendMutation.mutate(friend.id)}
                        data-testid={`button-remove-friend-${friend.id}`}
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
