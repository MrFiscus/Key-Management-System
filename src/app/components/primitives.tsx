import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { DSU, headerFill, radius, serif, shadow, surface } from "../theme";

// ── Hexagon motifs ────────────────────────────────────────────────────────────

export function HexBg() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='64'%3E%3Cpath d='M28 4L52 18v28L28 60 4 46V18Z' stroke='rgba(255,255,255,0.06)' stroke-width='1' fill='none'/%3E%3C/svg%3E")`,
        backgroundSize: "56px 64px",
      }}
    />
  );
}

export function HexEmptyIcon() {
  return (
    <svg width="52" height="60" viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M24 3L45 15v26L24 53 3 41V15Z" stroke={DSU.navy} strokeWidth="1.5" fill="none" opacity="0.16" />
      <path d="M24 12L38 20v16l-14 8-14-8V20Z" stroke={DSU.trojan} strokeWidth="1.5" fill="none" opacity="0.28" />
      <path d="M24 21l8 4.5v9L24 39l-8-4.5v-9Z" fill={DSU.trojan} opacity="0.16" />
    </svg>
  );
}

// ── Status / labels ───────────────────────────────────────────────────────────

export function Pill({ active }: { active: boolean }) {
  const style: React.CSSProperties = active
    ? { background: DSU.tintBg, color: DSU.tintText, border: `1px solid ${DSU.tintBorder}` }
    : { background: "#f0f1f2", color: "#63666b", border: "1px solid #d8dade" };
  return (
    <span
      className="inline-flex items-center px-2 py-[1px] text-[11px] font-semibold rounded-full tracking-wide"
      style={style}
    >
      {active ? "Active" : "Returned"}
    </span>
  );
}

/** Count chip used for "N keys" style badges. */
export function CountBadge({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-[1px] text-[11px] font-semibold rounded-full"
      style={
        muted
          ? { background: "#f0f1f2", color: "#63666b", border: "1px solid #d8dade" }
          : { background: DSU.tintBg, color: DSU.tintText, border: `1px solid ${DSU.tintBorder}` }
      }
    >
      {children}
    </span>
  );
}

export function SectionHeader({
  title, count, noun = "record", children,
}: {
  title: string; count?: number; noun?: string; children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b flex-wrap" style={{ borderColor: DSU.lightBorder }}>
      {/* Small accent bar gives each section a visual anchor. */}
      <span
        aria-hidden="true"
        className="inline-block rounded-full"
        style={{ width: 3, height: 15, background: DSU.trojan }}
      />
      <h2 className="text-[14px] font-semibold tracking-tight" style={{ color: DSU.navy }}>{title}</h2>
      {count !== undefined && (
        <span className="text-[12px] tabular" style={{ color: DSU.midGray }}>
          {count} {noun}{count !== 1 ? "s" : ""}
        </span>
      )}
      <div className="flex-1" />
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-14 gap-3"
      style={{ ...surface, borderStyle: "dashed", boxShadow: "none", background: "#fcfdfe" }}
    >
      <HexEmptyIcon />
      <p className="text-[13px] max-w-[420px] text-center px-4" style={{ color: DSU.midGray }}>{message}</p>
    </div>
  );
}

export function Avatar({ initials, size = 40 }: { initials: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white select-none flex-shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.37),
        letterSpacing: 0.2,
        background: DSU.navy,
        // Ring instead of a border so the fill keeps its full diameter.
        boxShadow: `0 0 0 1.5px ${DSU.trojan}, ${shadow.sm}`,
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

/**
 * A key stamp. Becomes a link to the key's page when onClick is supplied, so
 * every table renders stamps identically whether or not they navigate.
 */
export function Stamp({
  stamp, onClick, size = 12,
}: {
  stamp: string; onClick?: () => void; size?: number;
}) {
  const chip = (
    <span
      className="font-mono font-semibold rounded px-1.5 py-[1px] transition-colors"
      style={{
        fontSize: size,
        color: DSU.navy,
        background: "#eef2f5",
        border: "1px solid #dde3e8",
      }}
    >
      {stamp}
    </span>
  );
  if (!onClick) return chip;
  return (
    <button
      onClick={onClick}
      title={`View key ${stamp}`}
      className="group/stamp inline-flex align-middle"
    >
      <span
        className="font-mono font-semibold rounded px-1.5 py-[1px] transition-colors group-hover/stamp:bg-[#dcecf6] group-hover/stamp:border-[#a8d5ec]"
        style={{
          fontSize: size,
          color: DSU.navy,
          background: "#eef2f5",
          border: "1px solid #dde3e8",
        }}
      >
        {stamp}
      </span>
    </button>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerSolid";

const VARIANTS: Record<Variant, React.CSSProperties & { "--hover"?: string }> = {
  primary: {
    background: DSU.trojan,
    color: "#fff",
    borderColor: DSU.trojanDark,
    boxShadow: shadow.sm,
  },
  secondary: {
    background: "#ffffff",
    color: DSU.navy,
    borderColor: DSU.lightBorder,
    boxShadow: shadow.sm,
  },
  ghost: { background: "transparent", color: DSU.midGray, borderColor: "transparent" },
  danger: { background: "#fff", color: DSU.danger, borderColor: "#e8c9c6", boxShadow: shadow.sm },
  dangerSolid: { background: DSU.danger, color: "#fff", borderColor: DSU.dangerHover, boxShadow: shadow.sm },
};

const HOVER: Record<Variant, string> = {
  primary: DSU.navyHover,
  secondary: "#f2f7fa",
  ghost: "#eceef0",
  danger: "#fdf3f2",
  dangerSolid: DSU.dangerHover,
};

export function Button({
  variant = "secondary", children, className = "", style, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base = VARIANTS[variant];
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md border transition-all duration-150 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 ${className}`}
      style={{ ...base, borderWidth: 1, borderStyle: "solid", ...style }}
      onMouseEnter={(e) => {
        if (rest.disabled) return;
        e.currentTarget.style.background = HOVER[variant];
        if (variant !== "ghost") e.currentTarget.style.boxShadow = shadow.md;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = (style?.background as string) ?? (base.background as string);
        e.currentTarget.style.boxShadow = (base.boxShadow as string) ?? "none";
      }}
    >
      {children}
    </button>
  );
}

/** Small square icon button used inside table rows. */
export function IconButton({
  label, tone = "neutral", children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: "neutral" | "primary" | "danger";
}) {
  const color = tone === "danger" ? DSU.danger : tone === "primary" ? DSU.navy : DSU.midGray;
  const hover = tone === "danger" ? "#fdeceb" : tone === "primary" ? DSU.tintBg : "#eef0f2";
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      className="p-1.5 rounded-md transition-colors"
      style={{ color }}
      onMouseEnter={(e) => (e.currentTarget.style.background = hover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

// ── Form fields ───────────────────────────────────────────────────────────────

export function Field({
  label, required, hint, children,
}: {
  label: string; required?: boolean; hint?: string; children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[11px] font-semibold uppercase"
        style={{ color: DSU.midGray, letterSpacing: "0.045em" }}
      >
        {label}
        {required && <span style={{ color: DSU.danger }}> *</span>}
      </span>
      {children}
      {hint && <span className="text-[11px]" style={{ color: DSU.midGray }}>{hint}</span>}
    </label>
  );
}

const fieldClasses =
  "text-[13px] rounded-md border px-2.5 py-1.5 outline-none transition-all duration-150 " +
  "focus:border-[#00A9E0] focus:shadow-[0_0_0_3px_rgba(0,169,224,0.20)] hover:border-[#b9c0c7]";

const fieldStyle: React.CSSProperties = {
  borderColor: DSU.lightBorder,
  color: DSU.darkGray,
  background: "#fff",
};

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${fieldClasses} ${props.className ?? ""}`}
      style={{ ...fieldStyle, ...props.style }}
    />
  );
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${fieldClasses} cursor-pointer ${props.className ?? ""}`}
      style={{ ...fieldStyle, ...props.style }}
    />
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function Modal({
  title, onClose, children, footer, wide,
}: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-8 dsu-fade-in"
      style={{ background: "rgba(0, 24, 40, 0.5)", backdropFilter: "blur(3px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white w-full outline-none my-auto dsu-pop-in ${wide ? "max-w-[880px]" : "max-w-[520px]"}`}
        style={{ borderRadius: radius.xl, boxShadow: shadow.xl, overflow: "hidden" }}
      >
        <div className="relative flex items-center gap-3 px-4 py-3 overflow-hidden" style={{ background: headerFill }}>
          <HexBg />
          <h3 className="relative text-[16px] font-semibold text-white flex-1" style={{ fontFamily: serif }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="relative text-white/70 hover:text-white transition-colors rounded p-0.5"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">{children}</div>

        {footer && (
          <div
            className="flex items-center justify-end gap-2 px-4 py-3 border-t"
            style={{ borderColor: DSU.lightBorder, background: "#f8fafb" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline error / notice ─────────────────────────────────────────────────────

export function ErrorNote({ message }: { message: string }) {
  return (
    <div
      className="text-[12px] px-3 py-2 rounded-md border mb-3"
      style={{ background: "#fdf2f1", borderColor: "#eccbc8", color: DSU.danger, boxShadow: shadow.sm }}
      role="alert"
    >
      {message}
    </div>
  );
}

/** Transient confirmation, bottom-right. */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] px-4 py-2.5 text-[13px] text-white max-w-[380px] dsu-slide-up flex items-center gap-2"
      style={{
        background: DSU.navy,
        borderRadius: radius.lg,
        boxShadow: shadow.xl,
        borderLeft: `3px solid ${DSU.trojan}`,
      }}
      role="status"
    >
      {message}
    </div>
  );
}
