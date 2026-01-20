import { Switch, Route } from "wouter";
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
import NotFound from "@/pages/not-found";

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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
