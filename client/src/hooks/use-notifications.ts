import { useEffect, useRef } from "react";
import { useAuth } from "./use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const lastNotificationIdRef = useRef<string | null>(null);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (notifications.length === 0) return;

    const latestNotification = notifications[0];
    if (!latestNotification || latestNotification.isRead) return;

    if (lastNotificationIdRef.current !== latestNotification.id) {
      lastNotificationIdRef.current = latestNotification.id;
      
      toast({
        title: latestNotification.title || "Notification",
        description: latestNotification.message,
      });
      
      if (latestNotification.type === "friend_request") {
        queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      } else if (latestNotification.type === "session_started") {
        queryClient.invalidateQueries({ queryKey: ["/api/crews"] });
      }
    }
  }, [notifications, toast, queryClient]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return { notifications, unreadCount };
}
