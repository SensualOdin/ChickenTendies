import { Link } from "wouter";
import logoImage from "@assets/460272BC-3FCC-4927-8C2E-4C236353E7AB_1768880143398.png";
import { ReactNode } from "react";

// Shared editorial top nav. Children are rendered on the right side.
// Styling lives in index.css (eyebrow, mono-label) plus the small scoped
// block below so every page can drop this in without its own nav.
export function EditorialNav({ children }: { children?: ReactNode }) {
  return (
    <>
      <style>{`
        .editorial-nav {
          padding: 20px 0;
          padding-top: calc(20px + env(safe-area-inset-top, 0px));
          border-bottom: 1px solid hsl(var(--ink) / 0.12);
          position: sticky; top: 0; z-index: 50;
          background: hsl(var(--cream) / 0.85);
          backdrop-filter: blur(10px);
        }
        .dark .editorial-nav { background: hsl(var(--ink) / 0.85); border-color: hsl(var(--cream) / 0.1); }
        .editorial-nav .inner { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .editorial-nav .logo { display: flex; align-items: center; gap: 12px; min-width: 0; flex-shrink: 1; text-decoration: none; }
        .editorial-nav .logo-img { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; box-shadow: 0 4px 12px -4px hsl(var(--ink) / 0.25); flex-shrink: 0; }
        .editorial-nav .logo-text { min-width: 0; }
        .editorial-nav .logo-word { font-family: 'Fraunces', serif; font-weight: 700; font-size: 20px; letter-spacing: -0.02em; line-height: 1.05; color: hsl(var(--foreground)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .editorial-nav .logo-sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.55; margin-top: 2px; color: hsl(var(--foreground)); white-space: nowrap; }
        .editorial-nav .nav-links { display: flex; gap: 24px; align-items: center; color: hsl(var(--foreground)); flex-shrink: 0; }
        .editorial-nav .nav-links a.link { font-size: 14px; opacity: 0.75; transition: opacity .2s; text-decoration: none; color: inherit; white-space: nowrap; }
        .editorial-nav .nav-links a.link:hover { opacity: 1; }
        /* Keep every button in the nav from wrapping or shrinking — that's
           what was rendering "Log in" as a vertical circle in v1.0.7. */
        .editorial-nav .nav-links > * { flex-shrink: 0; }
        .editorial-nav .nav-links .btn-editorial { white-space: nowrap; }
        @media (max-width: 720px) {
          .editorial-nav .nav-links a.link { display: none; }
          .editorial-nav .logo-sub { display: none; }
          .editorial-nav .nav-links { gap: 10px; }
          .editorial-nav .nav-links .btn-editorial { padding: 9px 14px; font-size: 13px; gap: 6px; }
          /* Hide the trailing arrow icon on mobile to give the label more room. */
          .editorial-nav .nav-links .btn-editorial svg { display: none; }
          .editorial-nav .logo-word { font-size: 17px; }
          .editorial-nav .logo-img { width: 34px; height: 34px; }
        }
        @media (max-width: 380px) {
          /* Tiny phones: trim the logo word to fit alongside two buttons. */
          .editorial-nav .logo-word { font-size: 15px; max-width: 110px; }
        }
      `}</style>
      <nav className="editorial-nav">
        <div className="editorial-container inner">
          <Link href="/" className="logo">
            <img src={logoImage} alt="ChickenTinders" className="logo-img" />
            <div className="logo-text">
              <div className="logo-word">ChickenTinders</div>
              <div className="logo-sub">Swipe Together, Dine Together</div>
            </div>
          </Link>
          <div className="nav-links">
            {children}
          </div>
        </div>
      </nav>
    </>
  );
}
