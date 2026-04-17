import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import logoImage from "@assets/460272BC-3FCC-4927-8C2E-4C236353E7AB_1768880143398.png";
import casaDelSolImage from "@assets/casa-del-sol-hero.jpg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, LogOut } from "lucide-react";
import { EditorialNav } from "@/components/editorial/nav";

// Page-specific styles — hero visual, bento layout, marquee animation.
// Tokens (cream/ink/paprika/sage/butter) are HSL vars defined in index.css.
const HOME_CSS = `
  .ct-home .hero { padding: 80px 0 100px; position: relative; }
  .ct-home .hero-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 64px; align-items: center; }
  @media (max-width: 960px) { .ct-home .hero-grid { grid-template-columns: 1fr; gap: 64px; } }

  .ct-home h1.hero-head {
    font-family: 'Fraunces', serif;
    font-weight: 500;
    font-size: clamp(56px, 8.5vw, 128px);
    line-height: 0.95;
    letter-spacing: -0.035em;
    text-wrap: balance;
    font-variation-settings: "SOFT" 50, "WONK" 1;
    margin: 0;
  }
  .ct-home h1.hero-head em {
    font-style: italic;
    font-weight: 400;
    color: hsl(var(--paprika));
    font-variation-settings: "SOFT" 100, "WONK" 1;
  }
  .ct-home .hero-sub {
    font-size: 19px;
    line-height: 1.55;
    color: hsl(var(--ink-2));
    max-width: 480px;
    margin-top: 28px;
    text-wrap: pretty;
  }
  .dark .ct-home .hero-sub { color: hsl(var(--cream) / 0.72); }
  .ct-home .hero-cta { margin-top: 36px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
  .ct-home .hero-meta { margin-top: 28px; display: flex; gap: 24px; align-items: center; }
  .ct-home .avatars { display: flex; }
  .ct-home .avatars span {
    width: 30px; height: 30px; border-radius: 50%;
    background: hsl(var(--cream-2)); border: 2px solid hsl(var(--cream));
    margin-left: -8px;
    display: grid; place-items: center;
    font-family: 'Fraunces', serif; font-weight: 600; font-size: 12px; color: hsl(var(--ink-2));
  }
  .ct-home .avatars span:first-child { margin-left: 0; }
  .ct-home .avatars span:nth-child(1) { background: hsl(var(--butter)); }
  .ct-home .avatars span:nth-child(2) { background: hsl(var(--paprika)); color: hsl(36 47% 96%); }
  .ct-home .avatars span:nth-child(3) { background: hsl(var(--sage)); color: hsl(36 47% 96%); }
  .ct-home .avatars span:nth-child(4) { background: hsl(var(--ink)); color: hsl(var(--cream)); }
  .ct-home .hero-meta-text { font-size: 13px; color: hsl(var(--ink-2)); line-height: 1.3; }
  .ct-home .hero-meta-text strong { color: hsl(var(--foreground)); font-weight: 600; }
  .dark .ct-home .hero-meta-text { color: hsl(var(--cream) / 0.7); }

  /* HERO VISUAL */
  .ct-home .hero-visual { position: relative; aspect-ratio: 4/5; max-width: 460px; margin: 0 auto; width: 100%; }
  .ct-home .card-stack { position: absolute; inset: 0; perspective: 1200px; }
  .ct-home .swipe-card {
    position: absolute;
    inset: 0;
    background: hsl(var(--cream-2));
    border-radius: 24px;
    border: 1px solid hsl(var(--ink) / 0.12);
    overflow: hidden;
    box-shadow: 0 30px 80px -20px hsl(var(--ink) / 0.25), 0 10px 30px -10px hsl(var(--ink) / 0.15);
    transition: transform .5s cubic-bezier(.2,.7,.2,1);
  }
  .ct-home .swipe-card.c3 { transform: translate(-14px, 28px) rotate(-4deg) scale(.94); z-index: 1; opacity: .85; }
  .ct-home .swipe-card.c2 { transform: translate(8px, 14px) rotate(2deg) scale(.97); z-index: 2; opacity: .95; }
  .ct-home .swipe-card.c1 { transform: translate(0, 0) rotate(-1.5deg); z-index: 3; }
  .ct-home .swipe-card .photo {
    height: 62%;
    background:
      linear-gradient(135deg, hsl(var(--ink) / 0.1), transparent 50%),
      repeating-linear-gradient(45deg, hsl(var(--paprika) / 0.15) 0 10px, hsl(var(--paprika) / 0.08) 10px 20px),
      hsl(var(--butter));
    position: relative;
    display: grid; place-items: center;
  }
  .ct-home .photo-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase;
    color: hsl(var(--ink) / 0.55);
    background: hsl(var(--cream) / 0.8);
    padding: 6px 10px;
    border-radius: 4px;
  }
  .ct-home .swipe-card.c2 .photo {
    background:
      linear-gradient(135deg, hsl(var(--ink) / 0.1), transparent 50%),
      repeating-linear-gradient(45deg, hsl(var(--sage) / 0.25) 0 10px, hsl(var(--sage) / 0.12) 10px 20px),
      hsl(90 28% 78%);
  }
  .ct-home .swipe-card.c3 .photo {
    background:
      linear-gradient(135deg, hsl(var(--ink) / 0.1), transparent 50%),
      repeating-linear-gradient(45deg, hsl(var(--ink) / 0.18) 0 10px, hsl(var(--ink) / 0.08) 10px 20px),
      hsl(36 32% 77%);
  }
  .ct-home .swipe-card .body { padding: 22px 24px; }
  .ct-home .swipe-card .name { font-family: 'Fraunces', serif; font-weight: 600; font-size: 26px; letter-spacing: -0.02em; line-height: 1.05; font-variation-settings: "SOFT" 40; color: hsl(var(--ink)); }
  .ct-home .swipe-card .tags { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .ct-home .swipe-card .tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
    padding: 5px 9px; border-radius: 999px;
    border: 1px solid hsl(var(--ink) / 0.25);
    color: hsl(var(--ink-2));
  }
  .ct-home .swipe-card .meta { margin-top: 12px; font-size: 13px; color: hsl(var(--ink-2)); display: flex; gap: 14px; }

  .ct-home .swipe-actions {
    position: absolute;
    left: 50%; bottom: -30px;
    transform: translateX(-50%);
    display: flex; gap: 16px;
    z-index: 5;
  }
  .ct-home .swipe-btn {
    width: 56px; height: 56px; border-radius: 50%;
    border: 1px solid hsl(var(--ink) / 0.25);
    background: hsl(var(--cream));
    box-shadow: 0 8px 24px -8px hsl(var(--ink) / 0.3);
    display: grid; place-items: center;
    cursor: pointer;
    transition: transform .2s, background .2s;
    color: hsl(var(--ink));
  }
  .ct-home .swipe-btn:hover { transform: translateY(-2px); }
  .ct-home .swipe-btn.yes { background: hsl(var(--paprika)); color: hsl(36 47% 96%); border-color: hsl(var(--paprika)); }

  .ct-home .stamp {
    position: absolute;
    top: 24px; right: 24px;
    font-family: 'Fraunces', serif;
    font-weight: 700; font-style: italic;
    font-size: 20px;
    padding: 6px 14px;
    border: 2px solid hsl(var(--sage));
    color: hsl(var(--sage));
    border-radius: 6px;
    transform: rotate(8deg);
    letter-spacing: 0.02em;
    background: hsl(var(--cream) / 0.8);
  }

  /* MARQUEE */
  .ct-home .marquee {
    border-top: 1px solid hsl(var(--ink) / 0.12);
    border-bottom: 1px solid hsl(var(--ink) / 0.12);
    padding: 22px 0;
    overflow: hidden;
    white-space: nowrap;
    background: hsl(var(--cream-2));
  }
  .ct-home .marquee-track {
    display: inline-flex;
    animation: ct-scroll 40s linear infinite;
    gap: 48px;
    padding-right: 48px;
  }
  .ct-home .marquee span {
    font-family: 'Fraunces', serif;
    font-weight: 500;
    font-size: 22px;
    letter-spacing: -0.01em;
    font-style: italic;
    color: hsl(var(--ink-2));
  }
  .dark .ct-home .marquee span { color: hsl(var(--cream) / 0.75); }
  .ct-home .marquee span::after { content: "✦"; margin-left: 48px; color: hsl(var(--paprika)); font-style: normal; }
  @keyframes ct-scroll { to { transform: translateX(-50%); } }

  /* SECTION CHROME */
  .ct-home section.slab { padding: 120px 0; }
  @media (max-width: 640px) { .ct-home section.slab { padding: 80px 0; } }
  .ct-home .section-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 72px; gap: 40px; }
  @media (max-width: 780px) { .ct-home .section-head { flex-direction: column; align-items: flex-start; margin-bottom: 48px; } }
  .ct-home .section-head .left { max-width: 620px; }
  .ct-home .section-head h2 {
    font-family: 'Fraunces', serif;
    font-weight: 500;
    font-size: clamp(40px, 5vw, 72px);
    line-height: 1.02;
    letter-spacing: -0.03em;
    margin-top: 16px;
    text-wrap: balance;
  }
  .ct-home .section-head h2 em { font-style: italic; color: hsl(var(--paprika)); font-weight: 400; }
  .ct-home .section-head .right { max-width: 340px; font-size: 15px; color: hsl(var(--ink-2)); line-height: 1.5; }
  .dark .ct-home .section-head .right { color: hsl(var(--cream) / 0.7); }

  /* HOW IT WORKS */
  .ct-home .steps { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0; border-top: 1px solid hsl(var(--ink) / 0.22); }
  @media (max-width: 900px) { .ct-home .steps { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 520px) { .ct-home .steps { grid-template-columns: 1fr; } }
  .ct-home .step {
    padding: 36px 28px 48px;
    border-right: 1px solid hsl(var(--ink) / 0.12);
    border-bottom: 1px solid hsl(var(--ink) / 0.12);
    position: relative;
    transition: background .25s;
  }
  .ct-home .step:hover { background: hsl(var(--cream-2)); }
  .dark .ct-home .step:hover { background: hsl(var(--ink-2)); }
  .ct-home .steps > :last-child { border-right: none; }
  @media (max-width: 900px) {
    .ct-home .steps > :nth-child(2) { border-right: none; }
    .ct-home .steps > :nth-child(3) { border-right: 1px solid hsl(var(--ink) / 0.12); }
  }
  @media (max-width: 520px) { .ct-home .steps > * { border-right: none !important; } }
  .ct-home .step-num {
    font-family: 'Fraunces', serif;
    font-weight: 400;
    font-style: italic;
    font-size: 88px;
    line-height: 1;
    color: hsl(var(--paprika));
    letter-spacing: -0.03em;
    margin-bottom: 32px;
  }
  .ct-home .step h3 {
    font-family: 'Fraunces', serif;
    font-weight: 500;
    font-size: 26px;
    letter-spacing: -0.02em;
    margin-bottom: 10px;
    font-variation-settings: "SOFT" 40;
  }
  .ct-home .step p { font-size: 14.5px; line-height: 1.55; color: hsl(var(--ink-2)); }
  .dark .ct-home .step p { color: hsl(var(--cream) / 0.7); }

  /* FEATURES BENTO */
  .ct-home .bento { display: grid; grid-template-columns: 1.4fr 1fr 1fr; grid-auto-rows: minmax(220px, auto); gap: 20px; }
  @media (max-width: 900px) { .ct-home .bento { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 600px) { .ct-home .bento { grid-template-columns: 1fr; } }
  .ct-home .feat {
    padding: 32px;
    border-radius: 20px;
    border: 1px solid hsl(var(--ink) / 0.12);
    background: hsl(var(--cream-2));
    display: flex; flex-direction: column; justify-content: space-between;
    min-height: 220px;
    position: relative;
    overflow: hidden;
    transition: transform .25s, box-shadow .25s;
  }
  .dark .ct-home .feat { background: hsl(var(--ink-2)); border-color: hsl(var(--cream) / 0.1); }
  .ct-home .feat:hover { transform: translateY(-3px); box-shadow: 0 14px 40px -20px hsl(var(--ink) / 0.25); }
  .ct-home .feat-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: hsl(var(--ink-2)); }
  .dark .ct-home .feat-label { color: hsl(var(--cream) / 0.6); }
  .ct-home .feat h3 {
    font-family: 'Fraunces', serif;
    font-weight: 500;
    font-size: 30px;
    letter-spacing: -0.02em;
    line-height: 1.05;
    margin-top: 16px;
    text-wrap: balance;
    font-variation-settings: "SOFT" 40;
  }
  .ct-home .feat p { font-size: 14.5px; line-height: 1.55; color: hsl(var(--ink-2)); margin-top: 12px; }
  .dark .ct-home .feat p { color: hsl(var(--cream) / 0.7); }
  .ct-home .feat.a { grid-column: span 2; grid-row: span 2; background: hsl(var(--ink)); color: hsl(var(--cream)); border-color: hsl(var(--ink)); }
  .ct-home .feat.a .feat-label { color: hsl(var(--cream) / 0.6); }
  .ct-home .feat.a h3 { font-size: 56px; color: hsl(var(--cream)); }
  .ct-home .feat.a h3 em { font-style: italic; color: hsl(var(--paprika)); font-weight: 400; }
  .ct-home .feat.a p { color: hsl(var(--cream) / 0.7); font-size: 16px; max-width: 460px; }
  .ct-home .feat.a .viz { margin-top: 32px; display: flex; gap: 8px; flex-wrap: wrap; }
  .ct-home .feat.a .viz .pill {
    padding: 10px 16px;
    border: 1px solid hsl(var(--cream) / 0.2);
    border-radius: 999px;
    font-size: 13px;
    color: hsl(var(--cream) / 0.85);
    font-family: 'Inter Tight', sans-serif;
  }
  .ct-home .feat.a .viz .pill.on { background: hsl(var(--paprika)); border-color: hsl(var(--paprika)); color: hsl(36 47% 96%); }
  @media (max-width: 900px) { .ct-home .feat.a { grid-column: span 2; grid-row: span 1; } .ct-home .feat.a h3 { font-size: 38px; } }
  @media (max-width: 600px) { .ct-home .feat.a { grid-column: span 1; } }

  .ct-home .feat.b { background: hsl(var(--paprika)); color: hsl(36 47% 96%); border-color: hsl(var(--paprika)); }
  .ct-home .feat.b .feat-label { color: hsl(36 47% 96% / 0.75); }
  .ct-home .feat.b h3 { color: hsl(36 47% 96%); }
  .ct-home .feat.b p { color: hsl(36 47% 96% / 0.85); }
  .ct-home .feat.c { background: hsl(var(--butter)); border-color: transparent; color: hsl(var(--ink)); }
  .ct-home .feat.c p { color: hsl(var(--ink) / 0.75); }
  .ct-home .feat.d { background: hsl(var(--sage)); color: hsl(36 47% 96%); border-color: hsl(var(--sage)); }
  .ct-home .feat.d .feat-label { color: hsl(36 47% 96% / 0.8); }
  .ct-home .feat.d h3, .ct-home .feat.d p { color: hsl(36 47% 96%); }
  .ct-home .feat.d p { color: hsl(36 47% 96% / 0.85); }

  .ct-home .mini-dots { display: flex; gap: 6px; }
  .ct-home .mini-dots span { width: 8px; height: 8px; border-radius: 50%; background: currentColor; opacity: 0.25; }
  .ct-home .mini-dots span.on { opacity: 1; background: hsl(var(--paprika)); }

  /* TESTIMONIAL */
  .ct-home .thread-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
  @media (max-width: 900px) { .ct-home .thread-wrap { grid-template-columns: 1fr; gap: 48px; } }
  .ct-home .thread {
    background: hsl(var(--cream-2));
    border: 1px solid hsl(var(--ink) / 0.12);
    border-radius: 28px;
    padding: 28px;
    max-width: 440px;
    margin: 0 auto;
    box-shadow: 0 20px 60px -30px hsl(var(--ink) / 0.3);
    width: 100%;
  }
  .dark .ct-home .thread { background: hsl(var(--ink-2)); border-color: hsl(var(--cream) / 0.1); }
  .ct-home .thread-head { display: flex; justify-content: space-between; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: hsl(var(--ink-2)); padding-bottom: 16px; border-bottom: 1px solid hsl(var(--ink) / 0.12); margin-bottom: 20px; }
  .ct-home .msg { margin-bottom: 10px; display: flex; }
  .ct-home .msg .bubble { padding: 10px 14px; border-radius: 18px; font-size: 15px; line-height: 1.35; max-width: 78%; }
  .ct-home .msg.them .bubble { background: hsl(var(--cream)); border: 1px solid hsl(var(--ink) / 0.12); border-bottom-left-radius: 6px; color: hsl(var(--ink)); }
  .ct-home .msg.me { justify-content: flex-end; }
  .ct-home .msg.me .bubble { background: hsl(var(--ink)); color: hsl(var(--cream)); border-bottom-right-radius: 6px; }
  .ct-home .msg.me .bubble.paprika { background: hsl(var(--paprika)); color: hsl(36 47% 96%); }

  .ct-home .quote-block h2 {
    font-family: 'Fraunces', serif;
    font-weight: 500;
    font-size: clamp(36px, 4.5vw, 60px);
    line-height: 1.02;
    letter-spacing: -0.03em;
    text-wrap: balance;
    margin-bottom: 20px;
  }
  .ct-home .quote-block h2 em { font-style: italic; color: hsl(var(--paprika)); font-weight: 400; }
  .ct-home .quote-block p { font-size: 17px; line-height: 1.55; color: hsl(var(--ink-2)); max-width: 480px; }
  .dark .ct-home .quote-block p { color: hsl(var(--cream) / 0.7); }

  /* FINAL CTA */
  .ct-home .finale {
    position: relative;
    padding: 140px 0 120px;
    text-align: center;
    background: hsl(var(--ink));
    color: hsl(var(--cream));
    overflow: hidden;
  }
  .ct-home .finale::before {
    content: "";
    position: absolute; inset: 0;
    background:
      radial-gradient(900px 500px at 50% 100%, hsl(var(--paprika) / 0.35), transparent 60%),
      radial-gradient(600px 400px at 20% 0%, hsl(var(--butter) / 0.12), transparent 60%);
  }
  .ct-home .finale .editorial-container { position: relative; }
  .ct-home .finale .mono-label { color: hsl(var(--cream) / 0.6); }
  .ct-home .finale h2 {
    font-family: 'Fraunces', serif;
    font-weight: 400;
    font-style: italic;
    font-size: clamp(56px, 9vw, 140px);
    line-height: 0.95;
    letter-spacing: -0.035em;
    margin-top: 24px;
    text-wrap: balance;
    font-variation-settings: "SOFT" 100, "WONK" 1;
  }
  .ct-home .finale h2 .not-italic { font-style: normal; color: hsl(var(--paprika)); }
  .ct-home .finale p { font-size: 18px; max-width: 540px; margin: 28px auto 40px; color: hsl(var(--cream) / 0.75); line-height: 1.55; }
  .ct-home .finale .btn-editorial { border-color: hsl(var(--cream)); background: hsl(var(--cream)); color: hsl(var(--ink)); }
  .ct-home .finale .btn-editorial:hover { background: hsl(var(--paprika)); color: hsl(36 47% 96%); border-color: hsl(var(--paprika)); }

  .ct-home footer.ct-footer { padding: 48px 0; border-top: 1px solid hsl(var(--ink) / 0.12); background: hsl(var(--cream)); }
  .ct-home footer.ct-footer .inner { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
  .ct-home footer.ct-footer .links { display: flex; gap: 24px; font-size: 13px; color: hsl(var(--ink-2)); }
  .dark .ct-home footer.ct-footer { background: hsl(var(--ink)); border-color: hsl(var(--cream) / 0.1); }
  .dark .ct-home footer.ct-footer .links { color: hsl(var(--cream) / 0.7); }
`;

const steps = [
  { num: "01", title: "Start a party", desc: "Create a room, set your radius and budget, send the link. No account required for guests." },
  { num: "02", title: "Set the vibe", desc: "Pick cuisines, price, dietary needs. We pull a shortlist from nearby restaurants that match." },
  { num: "03", title: "Swipe in sync", desc: "Everyone swipes at their own pace. Live feedback shows who's still deciding and who's done." },
  { num: "04", title: "Match & eat", desc: "When the group lines up on a place, directions, hours and menu drop in. Argument over." },
];

export default function Home() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="ct-home editorial-page">
      <style dangerouslySetInnerHTML={{ __html: HOME_CSS }} />

      <EditorialNav>
        <a href="#how" className="link">How it works</a>
        <a href="#features" className="link">Features</a>
        {isLoading ? null : isAuthenticated ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Account" data-testid="button-user-menu" style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer" }}>
                <Avatar className="w-9 h-9">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback>
                    {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate("/dashboard")} className="cursor-pointer" data-testid="link-dashboard">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => logout()} className="cursor-pointer" data-testid="button-logout">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/login" className="link" data-testid="button-login">Log in</Link>
        )}
        <Link href="/create" className="btn-editorial btn-paprika" data-testid="button-create-group-nav">
          Start a party
          <svg className="w-[18px] h-[18px] stroke-current fill-none stroke-2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
        </Link>
      </EditorialNav>

      {/* HERO */}
      <section className="hero">
        <div className="editorial-container hero-grid">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
            <div className="eyebrow" style={{ marginBottom: 28 }}>
              <span className="dot"></span>
              Dinner deliberation, solved
            </div>
            <h1 className="hero-head">
              Stop arguing<br />
              about <em>where<br />to eat.</em>
            </h1>
            <p className="hero-sub">
              Every group has that one person who says "I don't care" and then vetoes every suggestion. ChickenTinders turns the indecision into a three-minute game your whole crew actually plays.
            </p>
            <div className="hero-cta">
              <Link href="/create" className="btn-editorial btn-paprika btn-large" data-testid="button-create-group">
                Start a party
                <svg className="w-[18px] h-[18px] stroke-current fill-none stroke-2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
              </Link>
              <Link href="/join" className="btn-editorial btn-ghost btn-large" data-testid="button-join-group">
                <svg className="w-[18px] h-[18px] stroke-current fill-none stroke-2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6M12 9v6" /><circle cx="12" cy="12" r="10" /></svg>
                I have a code
              </Link>
            </div>
            <div className="hero-meta">
              <div className="avatars">
                <span>M</span><span>J</span><span>R</span><span>+2</span>
              </div>
              <div className="hero-meta-text">
                <strong>No signup required.</strong><br />
                <span style={{ opacity: 0.7 }}>Share one link. Start swiping in seconds.</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="hero-visual"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="card-stack">
              <div className="swipe-card c3">
                <div className="photo"><span className="photo-label">[ ramen · close-up ]</span></div>
                <div className="body">
                  <div className="name">Kasa Izakaya</div>
                  <div className="tags"><span className="tag">Japanese</span><span className="tag">$$</span></div>
                </div>
              </div>
              <div className="swipe-card c2">
                <div className="photo"><span className="photo-label">[ pizza · overhead ]</span></div>
                <div className="body">
                  <div className="name">Lucia's Pizzeria</div>
                  <div className="tags"><span className="tag">Italian</span><span className="tag">$$</span></div>
                </div>
              </div>
              <div className="swipe-card c1">
                <div
                  className="photo"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(31,24,20,0.25) 100%), url(${casaDelSolImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="stamp">match!</div>
                </div>
                <div className="body">
                  <div className="name">Casa del Sol</div>
                  <div className="tags">
                    <span className="tag">Mexican</span>
                    <span className="tag">$$</span>
                    <span className="tag">★ 4.7</span>
                  </div>
                  <div className="meta">
                    <span>0.4 mi</span>
                    <span>12 min wait</span>
                    <span>Open till 11</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="swipe-actions">
              <button className="swipe-btn" aria-label="pass">
                <svg className="w-[18px] h-[18px] stroke-current fill-none stroke-2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
              <button className="swipe-btn yes" aria-label="yes">
                <svg className="w-[18px] h-[18px] stroke-current fill-none stroke-2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.78 0L12 5.62l-1.02-1.02a5.5 5.5 0 0 0-7.78 7.78l1.02 1.02L12 21.17l7.78-7.78 1.02-1.02a5.5 5.5 0 0 0 0-7.78z" /></svg>
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee">
        <div className="marquee-track">
          <span>"idk what do you want"</span>
          <span>"i'm fine with anything"</span>
          <span>"not that one"</span>
          <span>"you pick"</span>
          <span>"too expensive"</span>
          <span>"we had that tuesday"</span>
          <span>"idk what do you want"</span>
          <span>"i'm fine with anything"</span>
          <span>"not that one"</span>
          <span>"you pick"</span>
          <span>"too expensive"</span>
          <span>"we had that tuesday"</span>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="slab" id="how">
        <div className="editorial-container">
          <div className="section-head">
            <div className="left">
              <div className="section-num">01 — How it works</div>
              <h2>Four steps. <em>One decision.</em> No more group-chat paralysis.</h2>
            </div>
            <div className="right">
              The whole loop takes about three minutes. Long enough to feel like a real choice, short enough that nobody gets hangry.
            </div>
          </div>

          <div className="steps">
            {steps.map((s) => (
              <div key={s.num} className="step">
                <div className="step-num">{s.num}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES BENTO */}
      <section className="slab" id="features" style={{ paddingTop: 0 }}>
        <div className="editorial-container">
          <div className="section-head">
            <div className="left">
              <div className="section-num">02 — Built for real groups</div>
              <h2>Features that fight <em>indecision</em>, not each other.</h2>
            </div>
            <div className="right">
              Everything here is a feature you can use today — no vaporware. More on the roadmap.
            </div>
          </div>

          <div className="bento">
            <div className="feat a">
              <div>
                <div className="feat-label">★ The killer feature</div>
                <h3>Super-likes that <em>tip the scales.</em></h3>
                <p>Got a strong opinion? Use a super-like. It's a weighted vote — the matching engine knows this one matters more. Groups agree faster when somebody actually cares.</p>
              </div>
              <div className="viz">
                <div className="pill on">★ Casa del Sol</div>
                <div className="pill">Kasa Izakaya</div>
                <div className="pill on">★ Lucia's</div>
                <div className="pill">Blue Plate</div>
                <div className="pill">Hangry Burger</div>
                <div className="pill on">★ Ramen House</div>
              </div>
            </div>
            <div className="feat b">
              <div>
                <div className="feat-label">Zero friction</div>
                <h3>No signup. Just swipe.</h3>
                <p>Guests join with a link. Nobody downloads an app, makes an account, or verifies an email.</p>
              </div>
              <svg viewBox="0 0 120 40" style={{ width: 120, marginTop: 20 }}>
                <path d="M5 20h110" stroke="currentColor" strokeWidth="1" opacity="0.4" />
                <circle cx="20" cy="20" r="4" fill="currentColor" />
                <circle cx="60" cy="20" r="4" fill="currentColor" opacity="0.3" />
                <circle cx="100" cy="20" r="4" fill="currentColor" opacity="0.3" />
              </svg>
            </div>
            <div className="feat c">
              <div>
                <div className="feat-label">Dietary filter</div>
                <h3>Built-in diplomacy.</h3>
                <p>Gluten-free, vegan, vegetarian, allergen-aware. Filtered before anyone swipes so nobody's left out.</p>
              </div>
              <div className="mini-dots" style={{ color: "hsl(var(--ink))", marginTop: 20 }}>
                <span className="on"></span><span className="on"></span><span className="on"></span><span></span><span></span>
              </div>
            </div>
            <div className="feat d">
              <div>
                <div className="feat-label">Saved crews</div>
                <h3>Your group, remembered.</h3>
                <p>Sign in once and keep your crew together across sessions. No code-sharing every Friday.</p>
              </div>
              <svg viewBox="0 0 160 60" style={{ width: 160, marginTop: 16 }}>
                <circle cx="30" cy="30" r="6" fill="currentColor" opacity=".7" />
                <circle cx="130" cy="20" r="6" fill="currentColor" opacity=".7" />
                <circle cx="90" cy="50" r="6" fill="currentColor" opacity=".7" />
                <path d="M30 30 L80 32 L130 20 M80 32 L90 50" stroke="currentColor" strokeWidth="1" opacity="0.4" fill="none" />
                <circle cx="80" cy="32" r="10" fill="hsl(var(--paprika))" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <div className="feat" style={{ background: "hsl(var(--cream))" }}>
              <div>
                <div className="feat-label">Streaks</div>
                <h3>Weekly rituals, on the record.</h3>
                <p>Your crew's streak ticks every week you pick dinner together. Miss a week and it resets — keep it alive.</p>
              </div>
            </div>
            <div className="feat">
              <div>
                <div className="feat-label">History</div>
                <h3>Remembers last Tuesday.</h3>
                <p>Toggle "skip places we've been" and we won't show the same spot twice. No Chipotle three nights running.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="slab" style={{ paddingTop: 40 }}>
        <div className="editorial-container thread-wrap">
          <div className="quote-block">
            <div className="section-num" style={{ marginBottom: 24 }}>03 — In the wild</div>
            <h2>"We used to spend <em>45 minutes</em> arguing. Now it's a three-minute game."</h2>
            <p>The product is funnier than it sounds. Groups treat it like a party game — the swiping is fun, the reveal is fun, and by the time you get to the restaurant, nobody remembers who vetoed what.</p>
            <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "hsl(var(--sage))", display: "grid", placeItems: "center", color: "hsl(36 47% 96%)", fontFamily: "'Fraunces',serif", fontWeight: 600 }}>M</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Marcus Chen</div>
                <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>Friday-night regular · 37 matches</div>
              </div>
            </div>
          </div>
          <div className="thread">
            <div className="thread-head">
              <span>Dinner Crew</span>
              <span>Tuesday 6:42pm</span>
            </div>
            <div className="msg them"><div className="bubble">where we eating tonight</div></div>
            <div className="msg them"><div className="bubble">and don't say idk</div></div>
            <div className="msg me"><div className="bubble">idk</div></div>
            <div className="msg them"><div className="bubble">...</div></div>
            <div className="msg me"><div className="bubble paprika">jk, starting a chicken tinders → <u>ct.app/r/7k2n</u></div></div>
            <div className="msg them"><div className="bubble">finally</div></div>
            <div style={{ marginTop: 18, textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))" }}>
              ✦ matched in 2m 47s ✦
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="finale">
        <div className="editorial-container">
          <div className="mono-label">04 — Tonight's the night</div>
          <h2>
            <span className="not-italic">Swipe together,</span><br />
            dine together.
          </h2>
          <p>Free for groups. No app to install. No account needed for guests. Just one link and three minutes of your time.</p>
          <Link href="/create" className="btn-editorial btn-large" data-testid="button-get-started">
            Start a party
            <svg className="w-[18px] h-[18px] stroke-current fill-none stroke-2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </Link>
          <div className="mono-label" style={{ marginTop: 28, opacity: 0.5 }}>No credit card · Works on any phone · Open in 2 seconds</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="ct-footer">
        <div className="editorial-container inner">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src={logoImage} alt="ChickenTinders" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }} />
            <div>
              <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em" }}>ChickenTinders</div>
              <div className="mono-label" style={{ opacity: 0.55, marginTop: 2 }}>© 2026 · Made for hungry groups</div>
            </div>
          </div>
          <div className="links">
            <a href="/privacy-policy.html">Privacy</a>
            <Link href="/login">Log in</Link>
            <Link href="/create">Start a party</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
