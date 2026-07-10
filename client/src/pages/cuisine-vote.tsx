import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Flame, X } from "lucide-react";
import { CuisineCard, type CuisineSwipeAction } from "@/components/cuisine-card";
import { MemberAvatars } from "@/components/member-avatars";
import { CUISINE_VISUALS } from "@/lib/cuisine-visuals";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isNative } from "@/lib/platform";
import { getMemberId } from "@/lib/member-id";
import type { CuisineType, Group, GroupMember, WSMessage } from "@shared/schema";

interface CuisineMember {
  id: string;
  name: string;
  doneCuisineVoting: boolean;
}

interface CuisineRoundResponse {
  deck: CuisineType[];
  votes: { memberId: string; cuisine: CuisineType; liked: boolean }[];
  tallies: Record<string, number>;
  members: CuisineMember[];
  status: Group["status"];
}

function toGroupMembers(members: CuisineMember[]): GroupMember[] {
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    isHost: false,
    joinedAt: 0,
    doneSwiping: false,
    doneCuisineVoting: m.doneCuisineVoting,
  }));
}

function fireConfetti() {
  const duration = 3000;
  const end = Date.now() + duration;
  const colors = ["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#54a0ff"];

  const frame = () => {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };
  frame();
}

export default function CuisineVotePage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const memberId = getMemberId(params.id);

  const [deck, setDeck] = useState<CuisineType[]>([]);
  const [index, setIndex] = useState(0);
  const [winner, setWinner] = useState<CuisineType | null>(null);
  const [doneVoting, setDoneVoting] = useState(false);
  const [members, setMembers] = useState<CuisineMember[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [initialized, setInitialized] = useState(false);
  const winnerShownAtRef = useRef<number | null>(null);

  const { data } = useQuery<CuisineRoundResponse>({
    queryKey: ["/api/groups", params.id, "cuisine-round"],
    enabled: !!params.id,
  });

  const markDone = async () => {
    if (!params.id || !memberId) return;
    try {
      await apiRequest("POST", `/api/groups/${params.id}/done-cuisine-voting`, { memberId });
    } catch {
      // best-effort; the round can still complete server-side
    }
    setDoneVoting(true);
  };

  // Hydrate deck + members from the round response (once).
  useEffect(() => {
    if (!data || initialized) return;

    if (data.status && data.status !== "cuisine_voting") {
      setInitialized(true);
      setLocation(`/group/${params.id}/${data.status === "completed" ? "matches" : "swipe"}`);
      return;
    }

    setInitialized(true);

    const votedByMe = new Set(
      data.votes.filter((v) => v.memberId === memberId).map((v) => v.cuisine)
    );
    const remaining = data.deck.filter((c) => !votedByMe.has(c));
    setDeck(remaining);
    setMembers(data.members);
    setIndex(0);

    if (remaining.length === 0) {
      const meDone = data.members.find((m) => m.id === memberId)?.doneCuisineVoting;
      if (meDone) {
        setDoneVoting(true);        // already recorded server-side; don't re-POST
      } else {
        markDone();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, initialized, setLocation, params.id]);

  // WebSocket — same connect/reconnect logic as swipe.tsx.
  useEffect(() => {
    if (!params.id || !memberId) return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let navTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    let isClosedIntentionally = false;

    const connect = () => {
      const wsBase = isNative()
        ? "wss://chickentinders.onrender.com"
        : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;

      const apiUrl = import.meta.env.VITE_API_URL || "";
      let wsUrl: string;
      if (!isNative() && apiUrl) {
        const url = new URL(apiUrl);
        const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = `${wsProtocol}//${url.host}/ws?groupId=${params.id}&memberId=${memberId}`;
      } else {
        wsUrl = `${wsBase}/ws?groupId=${params.id}&memberId=${memberId}`;
      }
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("Cuisine vote WebSocket connected");
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        const message: WSMessage = JSON.parse(event.data);

        if (message.type === "sync") {
          if (message.group?.members) {
            setMembers((prev) =>
              message.group.members.map((m) => ({
                id: m.id,
                name: m.name,
                doneCuisineVoting:
                  m.doneCuisineVoting ??
                  prev.find((p) => p.id === m.id)?.doneCuisineVoting ??
                  false,
              }))
            );
          }
        } else if (message.type === "cuisine_vote_made") {
          setProgress((prev) => ({
            ...prev,
            [message.memberId]: (prev[message.memberId] || 0) + 1,
          }));
        } else if (message.type === "member_done_cuisine_voting") {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === message.memberId ? { ...m, doneCuisineVoting: true } : m
            )
          );
          if (message.memberId !== memberId) {
            toast({
              title: `${message.memberName} finished picking!`,
              description: "Waiting on the rest of the crew.",
            });
          }
        } else if (message.type === "cuisine_match_found") {
          setWinner(message.cuisine);
          if (winnerShownAtRef.current === null) winnerShownAtRef.current = Date.now();
          fireConfetti();
        } else if (message.type === "cuisine_round_complete") {
          setWinner((prev) => {
            const next = prev ?? message.winners[0] ?? null;
            if (next && winnerShownAtRef.current === null) winnerShownAtRef.current = Date.now();
            return next;
          });
        } else if (message.type === "status_changed") {
          if (message.status === "swiping") {
            const shownAt = winnerShownAtRef.current;
            const elapsed = shownAt ? Date.now() - shownAt : 0;
            const remaining = shownAt ? Math.max(0, 2300 - elapsed) : 0;
            navTimeout = setTimeout(() => setLocation(`/group/${params.id}/swipe`), remaining);
          }
        }
      };

      socket.onclose = () => {
        if (isClosedIntentionally) return;
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`Cuisine vote WebSocket closed, reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
          reconnectTimeout = setTimeout(connect, delay);
        }
      };

      socket.onerror = (error) => {
        console.error("Cuisine vote WebSocket error:", error);
      };
    };

    connect();

    return () => {
      isClosedIntentionally = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (navTimeout) clearTimeout(navTimeout);
      if (socket) socket.close();
    };
  }, [params.id, memberId, toast, setLocation]);

  const handleSwipe = async (cuisine: CuisineType, action: CuisineSwipeAction) => {
    // TODO: cuisine vote analytics (useAnalytics.trackSwipe is restaurant-shaped)
    try {
      await apiRequest("POST", `/api/groups/${params.id}/cuisine-vote`, {
        memberId,
        cuisine,
        liked: action === "like",
      });
    } catch {
      toast({
        title: "Oops!",
        description: "That vote didn't go through. Try again!",
        variant: "destructive",
      });
      return;
    }

    const nextIndex = index + 1;
    setIndex(nextIndex);
    if (nextIndex >= deck.length) {
      await markDone();
    }
  };

  const currentCuisine = deck[index];
  const nextCuisine = deck[index + 1];
  const doneMembers = members.filter((m) => m.doneCuisineVoting);

  // Winner celebration takeover.
  if (winner) {
    const visual = CUISINE_VISUALS[winner];
    return (
      <div className="h-[100dvh] bg-background flex flex-col items-center justify-center p-6 safe-top safe-x safe-bottom text-center">
        <motion.p
          className="text-sm font-semibold uppercase tracking-wide text-primary mb-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          It's a match!
        </motion.p>
        <motion.h1
          className="text-3xl font-extrabold mb-6"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
          {winner} wins 🏆
        </motion.h1>
        <motion.div
          className="relative w-64 h-80 rounded-3xl overflow-hidden shadow-2xl mb-6"
          initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          style={{ background: `linear-gradient(160deg, ${visual.from}, ${visual.to})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2">
            <span className="block text-[104px] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]" role="img" aria-label={winner}>
              {visual.emoji}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white text-left">
            <h2 className="text-3xl font-extrabold drop-shadow-lg">{winner}</h2>
            <p className="text-sm text-white/90">{visual.tagline}</p>
          </div>
        </motion.div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Flame className="w-5 h-5 text-primary" />
          </motion.div>
          <span className="text-sm">Finding {winner} spots near you…</span>
        </div>
      </div>
    );
  }

  // Waiting for the rest of the crew.
  if (doneVoting) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col items-center justify-center p-6 safe-top safe-x safe-bottom text-center">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mb-4"
        >
          <Flame className="w-12 h-12 text-primary mx-auto" />
        </motion.div>
        <h1 className="text-2xl font-extrabold mb-2">Waiting for the rest of the crew…</h1>
        <p className="text-muted-foreground mb-6">
          Your picks are in! We'll reveal the winning cuisine once everyone's voted.
        </p>
        {doneMembers.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground mb-3">Done voting:</p>
            <MemberAvatars members={toGroupMembers(doneMembers)} showNames size="sm" />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background flex flex-col safe-top safe-x safe-bottom">
      <header className="px-5 pt-5 pb-2 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Round 1 · Cuisine</p>
        <h1 className="text-2xl font-extrabold">What are you craving?</h1>
        <div className="flex justify-center gap-1.5 mt-3">
          {deck.slice(0, 12).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i < index ? "bg-primary w-2" : i === index ? "bg-primary w-5" : "bg-muted w-2"
              }`}
            />
          ))}
          {deck.length > 12 && (
            <span className="text-[10px] text-muted-foreground ml-1">+{deck.length - 12}</span>
          )}
        </div>
      </header>

      <main className="flex-1 px-5 py-3 flex flex-col">
        <div className="relative w-full max-w-md mx-auto h-[60vh]">
          {nextCuisine && (
            <CuisineCard key={nextCuisine} cuisine={nextCuisine} onSwipe={() => {}} isTop={false} />
          )}
          {currentCuisine && (
            <CuisineCard
              key={currentCuisine}
              cuisine={currentCuisine}
              onSwipe={(action) => handleSwipe(currentCuisine, action)}
              isTop
            />
          )}
        </div>

        {members.length > 0 && (
          <div className="flex justify-center mt-4">
            <MemberAvatars members={toGroupMembers(members)} size="sm" />
          </div>
        )}

        <div className="flex items-center justify-center gap-6 mt-4 shrink-0">
          <motion.button
            onClick={() => currentCuisine && handleSwipe(currentCuisine, "dislike")}
            disabled={!currentCuisine}
            className="w-16 h-16 rounded-full bg-card border-2 border-destructive/30 flex items-center justify-center shadow-lg disabled:opacity-50"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            data-testid="button-cuisine-dislike"
          >
            <X className="w-8 h-8 text-destructive" />
          </motion.button>
          <motion.button
            onClick={() => currentCuisine && handleSwipe(currentCuisine, "like")}
            disabled={!currentCuisine}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-emerald-500 flex items-center justify-center shadow-xl shadow-accent/40 disabled:opacity-50"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            data-testid="button-cuisine-like"
          >
            <Flame className="w-9 h-9 text-white" />
          </motion.button>
        </div>
      </main>
    </div>
  );
}
