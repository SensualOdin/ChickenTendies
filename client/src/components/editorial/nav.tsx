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
          border-bottom: 1px solid hsl(var(--ink) / 0.12);
          position: sticky; top: 0; z-index: 50;
          background: hsl(var(--cream) / 0.85);
          backdrop-filter: blur(10px);
        }
        .dark .editorial-nav { background: hsl(var(--ink) / 0.85); border-color: hsl(var(--cream) / 0.1); }
        .editorial-nav .inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .editorial-nav .logo { display: flex; align-items: center; gap: 12px; }
        .editorial-nav .logo-img { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; box-shadow: 0 4px 12px -4px hsl(var(--ink) / 0.25); }
        .editorial-nav .logo-word { font-family: 'Fraunces', serif; font-weight: 700; font-size: 20px; letter-spacing: -0.02em; line-height: 1.05; color: hsl(var(--foreground)); }
        .editorial-nav .logo-sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.55; margin-top: 2px; color: hsl(var(--foreground)); }
        .editorial-nav .nav-links { display: flex; gap: 24px; align-items: center; color: hsl(var(--foreground)); }
        .editorial-nav .nav-links a.link { font-size: 14px; opacity: 0.75; transition: opacity .2s; text-decoration: none; color: inherit; }
        .editorial-nav .nav-links a.link:hover { opacity: 1; }
        @media (max-width: 720px) {
          .editorial-nav .nav-links a.link { display: none; }
          .editorial-nav .logo-sub { display: none; }
        }
      `}</style>
      <nav className="editorial-nav">
        <div className="editorial-container inner">
          <Link href="/" className="logo">
            <img src={logoImage} alt="ChickenTinders" className="logo-img" />
            <div>
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
