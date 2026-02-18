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
import { isNative, isIOS } from "@/lib/platform";
import { StatusBar, Style } from "@capacitor/status-bar";
import { App as CapApp, URLOpenListenerEvent } from "@capacitor/app";
import { Keyboard } from "@capacitor/keyboard";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/lib/supabase";

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

// OAuth callback: on the web, this page receives the tokens from Supabase
// and redirects native users back into the app via deep link.
function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      // If running inside the native app, Supabase will pick up the tokens automatically
      if (isNative()) {
        setLocation("/dashboard");
        return;
      }
      // On web (reached after OAuth redirect from native flow), redirect to the native app
      const deepLink = `chickentinders://auth/callback${hash}`;
      window.location.href = deepLink;
    } else {
      // No tokens, just go to dashboard (Supabase may have already set the session)
      setLocation("/dashboard");
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Signing you in...</p>
    </div>
  );
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
      <Route path="/auth/callback" component={AuthCallback} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    if (!isNative()) return;

    // Status bar: transparent overlay so our gradient header shows through
    StatusBar.setStyle({ style: Style.Light });
    if (!isIOS()) {
      StatusBar.setBackgroundColor({ color: "#00000000" });
      StatusBar.setOverlaysWebView({ overlay: true });
    }

    // Deep links: handle crew invite URLs and OAuth callbacks
    const deepLinkListener = CapApp.addListener("appUrlOpen", async (event: URLOpenListenerEvent) => {
      const url = new URL(event.url);

      // Handle OAuth callback
      // Note: with custom URL schemes, new URL("chickentinders://auth/callback")
      // parses "auth" as hostname and "/callback" as pathname, so check href too
      const isAuthCallback = url.href.includes("/auth/callback") || url.href.includes("access_token") || url.href.includes("code=");
      if (isAuthCallback) {
        // Close the in-app browser
        Browser.close().catch(() => {});

        const navigateToDashboard = () => {
          // Clear any cached null auth state so dashboard shows loading
          // instead of briefly flashing "Please sign in"
          queryClient.resetQueries({ queryKey: ["/api/auth/user"] });
          window.history.pushState(null, "", "/dashboard");
          window.dispatchEvent(new PopStateEvent("popstate"));
        };

        // Try PKCE flow first (code in query params)
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            navigateToDashboard();
            return;
          }
        }

        // Try implicit flow (tokens in hash)
        const hashParams = url.hash
          ? new URLSearchParams(url.hash.substring(1))
          : new URLSearchParams(url.search);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (!error) {
            navigateToDashboard();
            return;
          }
        }

        // Fallback: navigate to dashboard, auth state listener may pick it up
        navigateToDashboard();
        return;
      }

      const path = url.pathname || url.href.replace(/^[^/]*:\/\//, "/");
      if (path && path !== "/") {
        window.history.pushState(null, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    });

    // Keyboard: track height so components can adjust
    Keyboard.addListener("keyboardWillShow", (info) => {
      document.body.style.setProperty("--keyboard-height", `${info.keyboardHeight}px`);
    });
    Keyboard.addListener("keyboardWillHide", () => {
      document.body.style.setProperty("--keyboard-height", "0px");
    });

    return () => {
      deepLinkListener.then(l => l.remove());
      Keyboard.removeAllListeners();
    };
  }, []);

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
