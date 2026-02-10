import { useEffect, useRef, createElement } from "react";
import { useAuth } from "./use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";
import { useLocation } from "wouter";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";

interface NotificationData {
  sessionId?: string;
  groupId?: string;
  groupName?: string;
  friendshipId?: string;
  requesterId?: string;
  [key: string]: unknown;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  data?: NotificationData;
  createdAt: string;
}

export function useNotifications() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
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
      
      const toastOptions: Parameters<typeof toast>[0] = {
        title: latestNotification.title || "Notification",
        description: latestNotification.message,
      };

      if (latestNotification.type === "session_started" && latestNotification.data?.groupId) {
        const groupId = latestNotification.data.groupId;
        toastOptions.action = createElement(
          ToastAction,
          {
            altText: "Join session",
            onClick: () => setLocation(`/group/${groupId}`),
          },
          "Join"
        ) as ToastActionElement;
      }

      toast(toastOptions);
      
      if (latestNotification.type === "friend_request") {
        queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      } else if (latestNotification.type === "session_started") {
        queryClient.invalidateQueries({ queryKey: ["/api/crews"] });
      }
    }
  }, [notifications, toast, queryClient, setLocation]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return { notifications, unreadCount };
}
