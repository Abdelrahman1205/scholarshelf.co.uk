export type SchoolBranding = {
  schoolName?: string | null;
  primaryColour?: string | null;
  secondaryColour?: string | null;
  accentColour?: string | null;
  themeName?: string | null;
  fontPreference?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  faviconUrl?: string | null;
  emailLogoUrl?: string | null;
  pdfLogoUrl?: string | null;
  setupStatus?: "not_started" | "in_progress" | "completed" | "skipped" | null;
};

type RootDefaults = {
  primary: string;
  ring: string;
  secondary: string;
  accent: string;
};

let rootDefaults: RootDefaults | null = null;

function ensureRootDefaults() {
  if (typeof document === "undefined") return;
  if (rootDefaults) return;
  const style = getComputedStyle(document.documentElement);
  rootDefaults = {
    primary: style.getPropertyValue("--primary").trim(),
    ring: style.getPropertyValue("--ring").trim(),
    secondary: style.getPropertyValue("--secondary").trim(),
    accent: style.getPropertyValue("--accent").trim(),
  };
}

function isHexColour(value: string | null | undefined): value is string {
  return !!value && /^#([a-fA-F0-9]{6})$/.test(value.trim());
}

function hexToHslChannels(hex: string): string {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  const sPercent = Math.round(s * 100);
  const lPercent = Math.round(l * 100);
  return `${h} ${sPercent}% ${lPercent}%`;
}

function setFavicon(href: string | null) {
  if (typeof document === "undefined") return;

  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }

  if (href) {
    link.href = href;
  } else {
    link.href = "/favicon.ico";
  }
}

export function applyBrandingToDocument(branding: SchoolBranding | null | undefined) {
  if (typeof document === "undefined") return;
  ensureRootDefaults();

  const root = document.documentElement;
  if (!branding) {
    if (rootDefaults) {
      root.style.setProperty("--primary", rootDefaults.primary);
      root.style.setProperty("--ring", rootDefaults.ring);
      root.style.setProperty("--secondary", rootDefaults.secondary);
      root.style.setProperty("--accent", rootDefaults.accent);
    }
    root.style.removeProperty("--tenant-primary-hex");
    root.style.removeProperty("--tenant-secondary-hex");
    root.style.removeProperty("--tenant-accent-hex");
    setFavicon(null);
    return;
  }

  if (isHexColour(branding.primaryColour)) {
    const hsl = hexToHslChannels(branding.primaryColour);
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
    root.style.setProperty("--tenant-primary-hex", branding.primaryColour);
  }

  if (isHexColour(branding.secondaryColour)) {
    root.style.setProperty("--secondary", hexToHslChannels(branding.secondaryColour));
    root.style.setProperty("--tenant-secondary-hex", branding.secondaryColour);
  }

  if (isHexColour(branding.accentColour)) {
    root.style.setProperty("--accent", hexToHslChannels(branding.accentColour));
    root.style.setProperty("--tenant-accent-hex", branding.accentColour);
  }

  setFavicon(branding.faviconUrl || null);
}
