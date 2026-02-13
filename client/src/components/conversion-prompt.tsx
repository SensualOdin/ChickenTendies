import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, History, Users, Bell } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ConversionPromptProps {
  groupId: string;
  groupName: string;
  matchCount: number;
  onDismiss: () => void;
}

const benefits = [
  {
    icon: History,
    title: "Keep your match history",
    description: "Save all the restaurants your group agreed on",
  },
  {
    icon: Users,
    title: "Create a permanent crew",
    description: "Invite friends and start new sessions anytime",
  },
  {
    icon: Bell,
    title: "Get re-engagement reminders",
    description: "We'll remind you when it's time to pick a new spot",
  },
  {
    icon: Shield,
    title: "Secure your data",
    description: "Your preferences and history are saved to your account",
  },
];

export function ConversionPrompt({ groupId, groupName, matchCount, onDismiss }: ConversionPromptProps) {
  useEffect(() => {
    apiRequest("POST", "/api/lifecycle-events", {
      eventName: "anonymous_conversion_prompted",
      groupId,
    }).catch(() => {});
  }, [groupId]);

  const handleCreateAccount = () => {
    sessionStorage.setItem("chickentinders-convert-group", groupId);
    sessionStorage.setItem("chickentinders-convert-group-name", groupName);
    window.location.href = "/api/login";
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onDismiss(); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-conversion-prompt">
        <DialogHeader>
          <DialogTitle data-testid="text-conversion-title">Save Your Crew</DialogTitle>
          <DialogDescription>
            Your group found {matchCount} match{matchCount !== 1 ? "es" : ""}! Create an account to keep everything.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <p className="text-sm font-medium text-muted-foreground mb-3">
            Without an account, you'll lose:
          </p>
          {benefits.map((benefit) => (
            <Card key={benefit.title} className="border">
              <CardContent className="flex items-start gap-3 p-3">
                <benefit.icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium" data-testid={`text-benefit-${benefit.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    {benefit.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{benefit.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            className="w-full bg-gradient-to-r from-primary to-orange-500"
            onClick={handleCreateAccount}
            data-testid="button-create-account-save-crew"
          >
            <Shield className="w-4 h-4 mr-2" />
            Create Account & Save Crew
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={onDismiss}
            data-testid="button-maybe-later"
          >
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
