// DSU brand tokens, shared surface styles, and small formatting helpers.

export const DSU = {
  navy: "#004165",
  navyDark: "#002e47",
  navyHover: "#005580",
  trojan: "#00A9E0",
  trojanDark: "#0092c4",
  gray: "#F4F4F4",
  darkGray: "#4d4f53",
  midGray: "#6b6d72",
  lightBorder: "#dcdfe3",
  zebra: "#fafbfc",
  danger: "#b3261e",
  dangerHover: "#8f1d17",

  // Accent tints, used for active/selected states
  tintBg: "#e9f6fd",
  tintBorder: "#b7dff2",
  tintText: "#00648f",
};

/** Type stack, matching the public /landing marketing page: one family,
 *  IBM Plex Sans, carrying both headings and body copy so the app and the
 *  site read as the same product. `mono` stays Roboto Mono for stamps,
 *  codes and figures — a utility face, not a brand face. */
export const font = {
  display: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  sans: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'Roboto Mono', ui-monospace, monospace",
};
/** Back-compat alias — older call sites import `serif`. */
export const serif = font.display;

/**
 * One shadow ramp for the whole app. Tuned soft and low: surfaces separate by
 * tone and elevation, not by hard outlines, so the UI reads calmer than the
 * border-on-everything default.
 */
export const shadow = {
  sm: "0 1px 2px rgba(16, 40, 56, 0.04)",
  md: "0 1px 2px rgba(16, 40, 56, 0.05), 0 2px 8px -3px rgba(16, 40, 56, 0.08)",
  lg: "0 2px 4px rgba(16, 40, 56, 0.05), 0 10px 24px -8px rgba(16, 40, 56, 0.14)",
  xl: "0 8px 16px rgba(16, 40, 56, 0.08), 0 24px 56px -12px rgba(16, 40, 56, 0.26)",
  focus: `0 0 0 3px rgba(0, 169, 224, 0.25)`,
};

/** Disciplined, tight radius scale — crisp corners, no bubble-wrap rounding. */
export const radius = { sm: 2, md: 4, lg: 6, xl: 8 };

/** Card / panel chrome. No border by default — a hairline top-tone and a soft
 *  shadow do the separating, so stacked panels don't look like a grid of boxes. */
export const surface: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: radius.lg,
  boxShadow: shadow.md,
};

/** Solid navy — flat, confident, no gradient sheen. */
export const headerFill = DSU.navy;
export const headerFillActive = DSU.navyDark;

/** The app bar — a single solid navy, flat by design. */
export const appBarFill = DSU.navy;

// ── formatting ────────────────────────────────────────────────────────────────

/** yyyy-mm-dd → mm/dd/yyyy, without constructing a Date (avoids TZ shifts). */
export function formatDate(d: string | null): string | null {
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y}`;
}

export function todayIso(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Looks like a key stamp rather than a person's name. DSU stamps take many
 * shapes — 2A.9, 5D22, H24, TCA.5, 7CA.5.4, 404.16 — so rather than a fixed
 * pattern this keys off the shape of the token: short, no spaces, contains a
 * digit, and only stamp-legal characters. Names (even one-word surnames like
 * "Ahmed") have no digit and fall through to a name search.
 */
export function isStampQuery(q: string): boolean {
  const s = q.trim();
  return s.length > 0 && s.length <= 12 && !/\s/.test(s) && /\d/.test(s) && /^[A-Za-z0-9.\-]+$/.test(s);
}
