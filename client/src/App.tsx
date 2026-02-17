import { Switch, Route, useLocation, useParams } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import CreateGroup from "@/pages/create-group";
import JoinGroup from "@/pages/join-group";
import GroupLobby from "@/pages/group-lobby";
import Preferences from "@/pages/preferences";
import SwipePage from "@/pages/swipe";
import MatchesPage from "@/pages/matches";
import ProfilePage from "@/pages/profile";
import CrewManage from "@/pages/crew-manage";
import AnalyticsPage from "@/pages/analytics";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function PendingCrewJoinRedirect() {
  const [location, setLocation] = useLocation();
  
  useEffect(() => {
    if (location !== "/" && location !== "/dashboard") return;
    const savedCode = sessionStorage.getItem("chickentinders-join-code");
    if (savedCode) {
      sessionStorage.removeItem("chickentinders-join-code");
      setLocation(`/join?code=${encodeURIComponent(savedCode)}`);
    }
  }, [location, setLocation]);
  
  return null;
}

function CrewJoinRedirect() {
  const { code } = useParams<{ code: string }>();
  const [, setLoc] = useLocation();

  useEffect(() => {
    if (code) {
      setLoc(`/join?code=${code}`);
    }
  }, [code, setLoc]);

  return null;
}

function PendingConversionRedirect() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (isLoading || !user || attempted) return;

    const groupId = sessionStorage.getItem("chickentinders-convert-group");
    const groupName = sessionStorage.getItem("chickentinders-convert-group-name");
    if (!groupId) return;

    setAttempted(true);
    sessionStorage.removeItem("chickentinders-convert-group");
    sessionStorage.removeItem("chickentinders-convert-group-name");

    apiRequest("POST", `/api/groups/${groupId}/convert-to-crew`, {
      crewName: groupName || undefined,
    })
      .then(() => {
        toast({
          title: "Your crew has been saved!",
          description: "You can find it on your dashboard.",
        });
        setLocation("/dashboard");
      })
      .catch(() => {
        toast({
          title: "Couldn't save crew",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      });
  }, [isLoading, user, attempted, toast, setLocation]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/create" component={CreateGroup} />
      <Route path="/join" component={JoinGroup} />
      <Route path="/group/:id" component={GroupLobby} />
      <Route path="/group/:id/preferences" component={Preferences} />
      <Route path="/group/:id/swipe" component={SwipePage} />
      <Route path="/group/:id/matches" component={MatchesPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/crew/join/:code" component={CrewJoinRedirect} />
      <Route path="/crew/:id" component={CrewManage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/login" component={LoginPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <PendingCrewJoinRedirect />
          <PendingConversionRedirect />
          <Router />
          <PWAInstallPrompt />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
