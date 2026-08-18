import { Link } from "wouter";

// Footer for the public / pre-login pages (sign in, register, invite acceptance,
// password reset, privacy, contact). Keeps the legal links reachable from every
// entry point into ScholarShelf.
export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full border-t border-border/60 mt-8">
      <div className="max-w-5xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground order-2 sm:order-1">
          © {year} BYTE HUB TECHNOLOGY CORPORATE LTD · Company No. 16884170
        </p>
        <nav className="flex items-center gap-4 order-1 sm:order-2">
          <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link href="/contact" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Contact Us
          </Link>
        </nav>
      </div>
    </footer>
  );
}
