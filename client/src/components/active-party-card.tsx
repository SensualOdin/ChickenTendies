import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Users, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE, getAuthHeaders } from "@/lib/queryClient";
import type { Group } from "@shared/schema";

const GROUP_KEY = "grubmatch-group-id";
const MEMBER_KEY = "grubmatch-member-id";
const DISMISS_KEY_PREFIX = "ct-rejoin-dismissed:";

type Status =
  | { kind: "loading" }
  | { kind: "absent" }
  | { kind: "dismissed" }
  | { kind: "ready"; group: Group; memberId: string };

// A persistent "you have a party in progress" affordance. The host or any
// member who navigates back to /, /create, or /join after creating/joining
// would otherwise see no path back to their party — their localStorage and
// signed-cookie binding are intact, but no UI surfaces them. This card reads
// the active party from localStorage, validates it server-side (which also
// proves the cookie/header binding still matches a real member), and offers
// a one-tap return.
//
// On a 403/404 response we treat the local pointer as stale and clear it —
// the party may have been deleted, the user may have been kicked, or the
// 24h cookie may have expired.
export function ActivePartyCard() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [, navigate] = useLocation();

  useEffect(() => {
    let cancelled = false;

    const groupId = typeof window !== "undefined" ? localStorage.getItem(GROUP_KEY) : null;
    const memberId = typeof window !== "undefined" ? localStorage.getItem(MEMBER_KEY) : null;

    if (!groupId || !memberId) {
      setStatus({ kind: "absent" });
      return;
    }

    // Per-group dismissal so a user who explicitly hides the card on one
    // party doesn't keep getting nagged by it. A new party (different id)
    // shows the card again because the dismissal key includes the id.
    if (sessionStorage.getItem(DISMISS_KEY_PREFIX + groupId)) {
      setStatus({ kind: "dismissed" });
      return;
    }

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${API_BASE}/api/groups/${encodeURIComponent(groupId)}?memberId=${encodeURIComponent(memberId)}`,
          { credentials: "include", headers }
        );
        if (cancelled) return;

        if (res.status === 200) {
          const group = (await res.json()) as Group;
          setStatus({ kind: "ready", group, memberId });
          return;
        }

        // 403 (not a member) or 404 (group gone) — pointer is stale, clean up
        // so we don't keep retrying on every navigation.
        if (res.status === 403 || res.status === 404) {
          localStorage.removeItem(GROUP_KEY);
          localStorage.removeItem(MEMBER_KEY);
        }
        setStatus({ kind: "absent" });
      } catch {
        // Network errors shouldn't clear the pointer (might just be offline).
        // Just hide the card for this render.
        if (!cancelled) setStatus({ kind: "absent" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status.kind !== "ready") return null;

  const { group, memberId } = status;
  const me = group.members.find((m) => m.id === memberId);
  const memberCount = group.members.length;
  const otherCount = Math.max(0, memberCount - 1);
  const subtitle =
    group.status === "swiping"
      ? "Swiping in progress"
      : group.status === "completed"
        ? "Match locked in"
        : otherCount === 0
          ? "Waiting for friends to join"
          : `${otherCount} other${otherCount === 1 ? "" : "s"} in the party`;
  const target =
    group.status === "swiping"
      ? `/group/${group.id}/swipe`
      : group.status === "completed"
        ? `/group/${group.id}/matches`
        : `/group/${group.id}`;

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    sessionStorage.setItem(DISMISS_KEY_PREFIX + group.id, "1");
    setStatus({ kind: "dismissed" });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -8, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="ct-rejoin-card-wrap"
      >
        <style>{`
          .ct-rejoin-card-wrap { padding: 12px 0; }
          .ct-rejoin-card {
            position: relative;
            display: flex; align-items: center; gap: 14px;
            padding: 14px 16px;
            border-radius: 16px;
            background: hsl(var(--ink));
            color: hsl(var(--cream));
            border: 1px solid hsl(var(--ink));
            box-shadow: 0 18px 40px -24px hsl(var(--ink) / 0.55);
            cursor: pointer;
            transition: transform .2s ease, box-shadow .2s ease;
          }
          .ct-rejoin-card:hover { transform: translateY(-1px); box-shadow: 0 22px 50px -24px hsl(var(--ink) / 0.6); }
          .ct-rejoin-card .badge {
            display: grid; place-items: center;
            width: 38px; height: 38px;
            border-radius: 12px;
            background: hsl(var(--paprika));
            color: hsl(36 47% 96%);
            flex-shrink: 0;
          }
          .ct-rejoin-card .body { flex: 1; min-width: 0; padding-right: 8px; }
          .ct-rejoin-card .label {
            font-family: 'JetBrains Mono', monospace;
            font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase;
            color: hsl(var(--cream) / 0.6);
            margin-bottom: 3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .ct-rejoin-card .title {
            font-family: 'Fraunces', serif;
            font-weight: 600;
            font-size: 17px;
            letter-spacing: -0.01em;
            line-height: 1.2;
            color: hsl(var(--cream));
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .ct-rejoin-card .sub {
            font-size: 12.5px;
            color: hsl(var(--cream) / 0.7);
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .ct-rejoin-card .go {
            display: grid; place-items: center;
            width: 38px; height: 38px;
            border-radius: 999px;
            background: hsl(var(--cream) / 0.12);
            color: hsl(var(--cream));
            flex-shrink: 0;
            transition: background .2s ease;
          }
          .ct-rejoin-card:hover .go { background: hsl(var(--cream) / 0.2); }
          .ct-rejoin-card .dismiss {
            position: absolute;
            top: 6px; right: 6px;
            border: 0;
            background: transparent;
            color: hsl(var(--cream) / 0.55);
            padding: 4px;
            border-radius: 999px;
            cursor: pointer;
            transition: color .2s ease, background .2s ease;
          }
          .ct-rejoin-card .dismiss:hover { color: hsl(var(--cream)); background: hsl(var(--cream) / 0.12); }
        `}</style>
        <div
          className="ct-rejoin-card"
          role="button"
          tabIndex={0}
          onClick={() => navigate(target)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate(target);
            }
          }}
          data-testid="active-party-card"
        >
          <div className="badge">
            <Users className="w-5 h-5" />
          </div>
          <div className="body">
            <div className="label">
              You're in a party{me?.isHost ? " · Host" : ""}
            </div>
            <div className="title">{group.name}</div>
            <div className="sub">{subtitle}</div>
          </div>
          <div className="go" aria-hidden="true">
            <ArrowRight className="w-4 h-4" />
          </div>
          <button
            type="button"
            className="dismiss"
            onClick={dismiss}
            aria-label="Hide for this session"
            data-testid="active-party-card-dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
