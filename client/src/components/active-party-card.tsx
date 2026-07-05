import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, ChevronDown, Users, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE, getAuthHeaders } from "@/lib/queryClient";
import { setMemberId } from "@/lib/member-id";
import type { Group } from "@shared/schema";

const GROUP_KEY = "grubmatch-group-id";
const DISMISS_KEY = "ct-rejoin-dismissed-session";

type Entry = { group: Group; memberId: string };

type Status =
  | { kind: "loading" }
  | { kind: "absent" }
  | { kind: "dismissed" }
  | { kind: "ready"; entries: Entry[] };

// Persistent "you have a party in progress" affordance. The home, create, and
// join screens render this so a user who's already inside one (or several)
// anonymous parties can hop back without re-entering a code.
//
// Source of truth is the signed `member-bindings` cookie/header — the same
// thing `verifyMemberIdentity` checks on every mutating endpoint. We fetch
// `GET /api/me/groups` which expands that map into live group records, so the
// UI reflects ground truth even if localStorage was cleared or the user
// joined a second party (which would otherwise overwrite the first).
export function ActivePartyCard() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [expanded, setExpanded] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    let cancelled = false;

    if (typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY)) {
      setStatus({ kind: "dismissed" });
      return;
    }

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE}/api/me/groups`, {
          credentials: "include",
          headers,
        });
        if (cancelled) return;

        if (!res.ok) {
          setStatus({ kind: "absent" });
          return;
        }

        const body = (await res.json()) as { groups: Entry[] };
        const entries = body.groups ?? [];
        if (entries.length === 0) {
          // Server says we're not bound to any group anymore — clean up the
          // single-slot pointer so other code paths don't act on stale state.
          localStorage.removeItem(GROUP_KEY);
          setStatus({ kind: "absent" });
          return;
        }

        // Persist every binding under its per-group key so each party keeps
        // its own member identity (joining a second party no longer clobbers
        // the first). The group pointer still tracks the active (top) entry.
        for (const entry of entries) {
          setMemberId(entry.group.id, entry.memberId);
        }
        localStorage.setItem(GROUP_KEY, entries[0].group.id);

        setStatus({ kind: "ready", entries });
      } catch {
        // Network errors shouldn't clear local pointers (offline, etc.).
        if (!cancelled) setStatus({ kind: "absent" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status.kind !== "ready") return null;

  const { entries } = status;
  const primary = entries[0];
  const others = entries.slice(1);
  const hasMore = others.length > 0;

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    sessionStorage.setItem(DISMISS_KEY, "1");
    setStatus({ kind: "dismissed" });
  };

  const goTo = (entry: Entry) => {
    // Make sure the chosen party's member identity is stored under its
    // per-group key, then mark it as the active group.
    setMemberId(entry.group.id, entry.memberId);
    localStorage.setItem(GROUP_KEY, entry.group.id);
    navigate(targetFor(entry.group));
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

          .ct-rejoin-toggle {
            display: inline-flex; align-items: center; gap: 6px;
            margin-top: 8px;
            padding: 6px 12px;
            border-radius: 999px;
            border: 1px solid hsl(var(--ink) / 0.2);
            background: hsl(var(--ink) / 0.04);
            color: hsl(var(--ink) / 0.75);
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
            cursor: pointer;
            transition: background .2s ease, border-color .2s ease, color .2s ease;
          }
          .ct-rejoin-toggle:hover { background: hsl(var(--ink) / 0.08); color: hsl(var(--ink)); border-color: hsl(var(--ink) / 0.4); }
          .ct-rejoin-toggle .chev { transition: transform .2s ease; }
          .ct-rejoin-toggle.open .chev { transform: rotate(180deg); }

          .ct-rejoin-list {
            margin-top: 8px;
            display: flex; flex-direction: column; gap: 6px;
          }
          .ct-rejoin-row {
            display: flex; align-items: center; gap: 12px;
            padding: 10px 12px;
            border-radius: 12px;
            background: hsl(var(--ink));
            border: 1px solid hsl(var(--cream) / 0.12);
            color: hsl(var(--cream));
            cursor: pointer;
            transition: border-color .2s ease, transform .2s ease;
          }
          .ct-rejoin-row:hover { border-color: hsl(var(--cream) / 0.32); transform: translateY(-1px); }
          .ct-rejoin-row .row-body { flex: 1; min-width: 0; }
          .ct-rejoin-row .row-title {
            font-family: 'Fraunces', serif;
            font-weight: 600;
            font-size: 14.5px;
            line-height: 1.2;
            color: hsl(var(--cream));
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .ct-rejoin-row .row-sub {
            font-size: 11.5px;
            color: hsl(var(--cream) / 0.65);
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .ct-rejoin-row .row-go {
            display: grid; place-items: center;
            width: 28px; height: 28px;
            border-radius: 999px;
            background: hsl(var(--cream) / 0.1);
            color: hsl(var(--cream));
            flex-shrink: 0;
          }
        `}</style>

        <CardRow
          entry={primary}
          onClick={() => goTo(primary)}
          onDismiss={dismiss}
        />

        {hasMore && (
          <button
            type="button"
            className={`ct-rejoin-toggle${expanded ? " open" : ""}`}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            data-testid="active-party-card-toggle"
          >
            {expanded
              ? "Hide other parties"
              : `${others.length} other ${others.length === 1 ? "party" : "parties"}`}
            <ChevronDown className="chev w-3.5 h-3.5" />
          </button>
        )}

        <AnimatePresence initial={false}>
          {hasMore && expanded && (
            <motion.div
              key="list"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="ct-rejoin-list"
              data-testid="active-party-card-list"
            >
              {others.map((entry) => (
                <PartyRow
                  key={entry.group.id}
                  entry={entry}
                  onClick={() => goTo(entry)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

function CardRow({
  entry,
  onClick,
  onDismiss,
}: {
  entry: Entry;
  onClick: () => void;
  onDismiss: (e: React.MouseEvent) => void;
}) {
  const { group, memberId } = entry;
  const me = group.members.find((m) => m.id === memberId);
  const subtitle = subtitleFor(group);

  return (
    <div
      className="ct-rejoin-card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
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
        onClick={onDismiss}
        aria-label="Hide for this session"
        data-testid="active-party-card-dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function PartyRow({ entry, onClick }: { entry: Entry; onClick: () => void }) {
  const { group } = entry;
  return (
    <div
      className="ct-rejoin-row"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid={`active-party-card-row-${group.id}`}
    >
      <div className="row-body">
        <div className="row-title">{group.name}</div>
        <div className="row-sub">{subtitleFor(group)}</div>
      </div>
      <div className="row-go" aria-hidden="true">
        <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}

function subtitleFor(group: Group): string {
  const memberCount = group.members.length;
  const otherCount = Math.max(0, memberCount - 1);
  if (group.status === "swiping") return `Swiping · ${memberCount} member${memberCount === 1 ? "" : "s"}`;
  if (group.status === "completed") return "Match locked in";
  return otherCount === 0 ? "Waiting for friends to join" : `${otherCount} other${otherCount === 1 ? "" : "s"} in the party`;
}

function targetFor(group: Group): string {
  if (group.status === "swiping") return `/group/${group.id}/swipe`;
  if (group.status === "completed") return `/group/${group.id}/matches`;
  return `/group/${group.id}`;
}
