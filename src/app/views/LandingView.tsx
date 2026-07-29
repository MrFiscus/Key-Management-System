import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LogIn, ArrowRight, Map, Users, KeyRound, CornerDownLeft, Building2,
  Activity, Search, FileText, ShieldCheck, CheckCircle2, Clock, Lock, LayoutGrid,
  Mail, Quote, Facebook, Twitter,
} from "lucide-react";
import { DSU, radius, shadow } from "../theme";
import { Button, HexBg, HexWatermark } from "../components/primitives";

/** IBM Plex Sans, used for both headings and body on this public marketing
 *  page only, not the authenticated app. One family, weight carries the
 *  hierarchy. */
const DISPLAY = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const BODY = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

/** Same white-card chrome used across the Dashboard/Person/Key pages — no
 *  hairline border, just a soft shadow and generous rounding. */
const CARD: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  boxShadow: shadow.sm,
};

function IconBadge({ icon, bg, fg = "#fff" }: { icon: React.ReactNode; bg: string; fg?: string }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{ width: 40, height: 40, background: bg, color: fg }}
    >
      {icon}
    </span>
  );
}

// ── Scroll reveal ────────────────────────────────────────────────────────────
// A small IntersectionObserver-driven wrapper: elements fade/rise in the first
// time they cross into view, then stay put. Respects prefers-reduced-motion
// via the .dsu-reveal CSS itself (src/styles/app.css).

function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({
  children, className = "", direction = "up", delay = 0, as: As = "div",
}: {
  children: ReactNode; className?: string; direction?: "up" | "left" | "right"; delay?: number;
  as?: "div" | "li";
}) {
  const { ref, visible } = useInView<HTMLDivElement>();
  const dirClass = direction === "left" ? "dsu-reveal-left" : direction === "right" ? "dsu-reveal-right" : "";
  const Tag = As as any;
  return (
    <Tag
      ref={ref}
      className={`dsu-reveal ${dirClass} ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}

/** The hero's own backdrop: flat solid navy, the same confident single-tone
 *  the app's own header bar already uses — deliberately not a gradient, not
 *  a blurred glow, not a dot grid. The weight comes from the type and the
 *  real screenshot, not from ambient lighting effects. */
function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: DSU.navyDark }} />
  );
}

/** A quiet particles.js-style network, live behind the hero copy: drifting
 *  dots, thin lines between nearby ones, and a brighter web that forms
 *  around the cursor as it moves — the classic "particle network" hover
 *  effect, built as a plain canvas loop instead of pulling in a library for
 *  one effect. Listens on `window`, not the canvas itself, and stays
 *  `pointer-events-none`, so it never steals clicks from the buttons and
 *  screenshots sitting on top of it. */
/** Fractional (0–1) position + radius for a solid-colour radial falloff that
 *  settles the particle network back into the navy behind a piece of UI, so
 *  drifting keys thread through the background without crossing in front of
 *  anything a visitor needs to read. */
type Vignette = { x: number; y: number; r: number; alpha: number };

const HERO_VIGNETTES: Vignette[] = [
  { x: 0.24, y: 0.52, r: 0.46, alpha: 0.82 },
  { x: 0.74, y: 0.46, r: 0.4, alpha: 0.58 },
];

export function ParticleField({ vignettes = HERO_VIGNETTES }: { vignettes?: Vignette[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const COUNT = 70;
    const LINK_DIST = 130;
    const MOUSE_DIST = 170;

    let width = 0, height = 0, raf = 0;
    let particles: { x: number; y: number; vx: number; vy: number }[] = [];
    let mouse: { x: number; y: number } | null = null;

    function resize() {
      const rect = canvas!.parentElement!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function init() {
      particles = Array.from({ length: COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
      }));
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      mouse = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height ? { x, y } : null;
    }
    function onMouseLeave() { mouse = null; }

    // A tiny key silhouette (bow + shaft + two teeth), drawn at the
    // particle's own drift angle — so the network reads as keys drifting
    // and linking up, not generic dots, which is the one thing this whole
    // page is actually about.
    function drawKey(x: number, y: number, angle: number, alpha: number) {
      ctx!.save();
      ctx!.translate(x, y);
      ctx!.rotate(angle);
      ctx!.strokeStyle = `rgba(0,169,224,${alpha})`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.arc(-4.4, 0, 1.7, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.moveTo(-2.7, 0);
      ctx!.lineTo(3.4, 0);
      ctx!.moveTo(1.6, 0);
      ctx!.lineTo(1.6, 1.6);
      ctx!.moveTo(3.4, 0);
      ctx!.lineTo(3.4, 1.9);
      ctx!.stroke();
      ctx!.restore();
    }

    function step() {
      ctx!.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      }

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < LINK_DIST) {
            ctx!.strokeStyle = `rgba(0,169,224,${0.16 * (1 - dist / LINK_DIST)})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
        if (mouse) {
          const dist = Math.hypot(a.x - mouse.x, a.y - mouse.y);
          if (dist < MOUSE_DIST) {
            ctx!.strokeStyle = `rgba(255,255,255,${0.4 * (1 - dist / MOUSE_DIST)})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(mouse.x, mouse.y);
            ctx!.stroke();
          }
        }
      }

      for (const p of particles) {
        drawKey(p.x, p.y, Math.atan2(p.vy, p.vx), 0.65);
      }

      // Solid-colour radial falloff only, no visible colour gradient — matches
      // DSU.navyDark exactly so it composites into the flat background rather
      // than reading as a separate tinted patch.
      for (const v of vignettes) {
        const grad = ctx!.createRadialGradient(
          width * v.x, height * v.y, 0,
          width * v.x, height * v.y, Math.max(width, height) * v.r
        );
        grad.addColorStop(0, `rgba(0,46,71,${v.alpha})`);
        grad.addColorStop(1, "rgba(0,46,71,0)");
        ctx!.fillStyle = grad;
        ctx!.fillRect(0, 0, width, height);
      }

      if (mouse) {
        ctx!.fillStyle = "rgba(255,255,255,0.85)";
        ctx!.beginPath();
        ctx!.arc(mouse.x, mouse.y, 2.4, 0, Math.PI * 2);
        ctx!.fill();
      }

      if (!reduceMotion) raf = requestAnimationFrame(step);
    }

    resize();
    init();
    step();

    const ro = new ResizeObserver(() => { resize(); init(); });
    ro.observe(canvas.parentElement!);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseleave", onMouseLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 pointer-events-none" />;
}

/** A real screenshot of the app, framed the same way across every showcase
 *  panel — rounded, elevated, a hairline ring instead of a hard border. */
export function ScreenshotFrame({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        borderRadius: 16,
        boxShadow: shadow.xl,
        border: "1px solid rgba(255,255,255,0.14)",
      }}
    >
      <img src={src} alt={alt} className="block w-full h-auto" loading="lazy" />
    </div>
  );
}

const FEATURES: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <Map size={18} />,
    title: "Interactive Campus Map",
    body: "See every building on a live map with live counts of keys checked out. Click a building to see what's issued there.",
  },
  {
    icon: <Users size={18} />,
    title: "Key Holder Directory",
    body: "One directory of everyone who holds a key. Current keys and full history are a click away.",
  },
  {
    icon: <KeyRound size={18} />,
    title: "Full Key Catalog",
    body: "Every stamp, room, and copy on record in one searchable catalog.",
  },
  {
    icon: <CornerDownLeft size={18} />,
    title: "Issue & Return Workflows",
    body: "Check a key out or back in within seconds. Copy counts, notes, and dates are captured automatically.",
  },
  {
    icon: <Building2 size={18} />,
    title: "Building & Department Pages",
    body: "Drill into any building or department to see what's out, who has it, and what's already back.",
  },
  {
    icon: <Activity size={18} />,
    title: "Complete Audit Trail",
    body: "Every key created, issued, or returned is logged to the account that touched it.",
  },
  {
    icon: <Search size={18} />,
    title: "Instant Universal Search",
    body: "Search a name, key stamp, room, building, or department from one box and land on the record you need.",
  },
  {
    icon: <FileText size={18} />,
    title: "Paperwork Automation",
    body: "Upload a scanned or handwritten request form and the system reads the person, key, and room details for you.",
  },
  {
    icon: <ShieldCheck size={18} />,
    title: "Secure Backups & Exports",
    body: "Export or restore your key database on demand, protected by a password recheck.",
  },
];

const HIGHLIGHTS: { icon: React.ReactNode; label: string }[] = [
  { icon: <LayoutGrid size={15} />, label: "9 core workflows" },
  { icon: <Activity size={15} />, label: "Full activity audit trail" },
  { icon: <FileText size={15} />, label: "OCR powered form intake" },
  { icon: <Lock size={15} />, label: "Password gated exports" },
];

const TRUST: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <CheckCircle2 size={20} />,
    title: "Real accountability",
    body: "Every key is tied to a name and a date. If something goes missing, you know where to start looking.",
  },
  {
    icon: <Lock size={20} />,
    title: "Access, controlled",
    body: "Signing in is required to touch a record, and exports demand a password recheck first.",
  },
  {
    icon: <KeyRound size={20} />,
    title: "Fewer keys lost for good",
    body: "A live view of what's checked out means keys come back instead of turning up years later.",
  },
  {
    icon: <Clock size={20} />,
    title: "Hours back every week",
    body: "Stop keeping a parallel spreadsheet by hand. Issue, return, and report from one system.",
  },
];

/** Illustrative sample quotes — generic role titles, no real names, photos,
 *  or specific institutions attached, since this product doesn't have live
 *  customers yet to quote honestly. */
const TESTIMONIALS: { quote: string; name: string; role: string }[] = [
  { quote: "We stopped keeping a shadow spreadsheet the week we turned this on. It's just the record now.", name: "M. Alvarez", role: "Operations Coordinator" },
  { quote: "Handing off building keys used to mean calling three people. Now it's one search.", name: "J. Whitfield", role: "Campus Operations Manager" },
  { quote: "The audit trail is the part I lean on most. It tells me who last touched a key without asking around.", name: "R. Chen", role: "Director of Housing" },
  { quote: "Uploading old paper request forms and having it read the details back sold my whole team.", name: "T. Okafor", role: "Office Administrator" },
  { quote: "I can finally answer who has the master key to that building in under a minute.", name: "S. Novak", role: "Physical Plant Supervisor" },
  { quote: "A password recheck before an export sounds small until you realize what a full key roster is worth.", name: "D. Park", role: "Security & Access Lead" },
];

const WORKS: { eyebrow: string; title: string; body: string; points: string[]; img: string; alt: string }[] = [
  {
    eyebrow: "Dashboard & Reporting",
    title: "Numbers you can act on, not just admire",
    body: "Keys out by building, active checkouts versus returns, and how many physical copies are in circulation, live.",
    points: [
      "Bar and donut charts driven by your real data",
      "One click export for backups or a board report",
      "Search any person, key, room, building, or department",
    ],
    img: "/landing/dashboard.jpg",
    alt: "Dashboard with a bar chart of keys out by building and a donut chart of out versus returned",
  },
  {
    eyebrow: "Key Holder Directory",
    title: "One record per person, always current",
    body: "Every key holder gets a single expandable row showing their department, building, and every key in their hands.",
    points: [
      "Expand any name to see their full key list",
      "Filter by building, department, or holding keys",
      "Every field links to that key, building, or department",
    ],
    img: "/landing/directory.jpg",
    alt: "Key holder directory with an expanded row showing keys held",
  },
  {
    eyebrow: "Campus Map",
    title: "See your whole campus at a glance",
    body: "Every building sits at its real footprint on a live campus map, with a running count of keys checked out.",
    points: [
      "Pan and zoom a real campus image",
      "Live counts update the moment a key moves",
      "Click through to a building's full history",
    ],
    img: "/landing/map.jpg",
    alt: "Interactive campus map with building markers and key counts",
  },
  {
    eyebrow: "Person, Key, Room & Building Pages",
    title: "Click a name, a key, or a room and land on its own page",
    body: "Every person and every key gets a full profile: what they hold now, what they held before, and every date in between. Buildings, departments, and rooms work the same way.",
    points: [
      "Currently held keys and returned keys, split cleanly",
      "Full history for every key holder, not just a snapshot",
      "Click through from any table, search result, or map pin",
    ],
    img: "/landing/person.jpg",
    alt: "Person detail page showing currently held keys and key history",
  },
];

/** One "how it works" showcase panel: a real screenshot on one side, a
 *  heading + description + checklist on the other. Alternates side-to-side.
 *  The step number lives outside, in the rail — see WorksRail below. */
function ShowcasePanel({
  eyebrow, title, body, points, img, alt, flip = false,
}: {
  eyebrow: string; title: string; body: string; points: string[];
  img: string; alt: string; flip?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const blockOffset = flip ? "translate(14px, 14px)" : "translate(-14px, 14px)";
  const shotTilt = flip ? "rotate(1.5deg)" : "rotate(-1.5deg)";

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Reveal direction={flip ? "right" : "left"} className={`relative ${flip ? "lg:order-2" : ""}`}>
        {/* A solid color block behind the screenshot, offset to the side it
            flipped away from, plus a slight tilt on the shot itself, so this
            reads as a photo propped up rather than a flat product mockup.
            Both nudge slightly further apart on hover — a subtle "lift the
            top photo" gesture instead of a flat scale. */}
        <div
          aria-hidden="true"
          className="hidden sm:block absolute rounded-2xl transition-transform duration-300"
          style={{
            inset: 0,
            background: flip ? DSU.trojan : DSU.navy,
            transform: hovered ? `${blockOffset} scale(1.03)` : blockOffset,
            opacity: 0.9,
          }}
        />
        <div
          className="relative transition-transform duration-300"
          style={{ transform: hovered ? `${shotTilt} scale(1.02)` : shotTilt }}
        >
          <ScreenshotFrame src={img} alt={alt} />
        </div>
      </Reveal>
      <Reveal direction={flip ? "left" : "right"} delay={80} className={flip ? "lg:order-1" : ""}>
        <h3 className="text-[26px] sm:text-[30px] font-semibold leading-tight" style={{ fontFamily: DISPLAY, color: "#ffffff" }}>
          {title}
        </h3>
        <p className="text-[13px] mt-1.5 font-medium" style={{ color: DSU.trojan }}>
          {eyebrow}
        </p>
        <p className="text-[14px] mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
          {body}
        </p>
        <ul className="flex flex-col gap-2 mt-5">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>
              <CheckCircle2 size={15} style={{ color: DSU.trojan, marginTop: 1, flexShrink: 0 }} />
              {p}
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}

const contactFieldClasses =
  "w-full text-[14px] rounded-lg border px-4 py-3 outline-none transition-all duration-150 " +
  "focus:border-[#00A9E0] focus:shadow-[0_0_0_3px_rgba(0,169,224,0.15)]";
const contactFieldStyle: React.CSSProperties = { borderColor: DSU.lightBorder, color: DSU.darkGray, background: "#fff" };

/** A real contact form, styled the way most software companies do it: a
 *  short pitch and an email on one side, a card with Name/Email/Message and
 *  a submit button on the other. There's no backend behind this page, so
 *  submitting composes a real email instead of faking a success state. */
function ContactSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [message, setMessage] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Access code request — ${organization || name || "website visitor"}`);
    const body = encodeURIComponent(
      `${message}\n\nName: ${name}\nEmail: ${email}\nOrganization: ${organization}`
    );
    window.location.href = `mailto:support@fipherkeys.com?subject=${subject}&body=${body}`;
  };

  return (
    <section id="contact" className="max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-16 py-16 sm:py-20 scroll-mt-16">
      <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1fr] gap-10 lg:gap-16">
        <Reveal direction="left">
          <span className="text-[11px] font-semibold uppercase" style={{ color: DSU.trojan, letterSpacing: "0.14em" }}>
            Get Access
          </span>
          <h2 className="text-[28px] sm:text-[34px] font-semibold leading-tight mt-2" style={{ fontFamily: DISPLAY, color: DSU.navy }}>
            Get an access code for your organization
          </h2>
          <p className="text-[14px] mt-4 max-w-[450px] leading-relaxed" style={{ color: DSU.midGray }}>
            Tell us a bit about your team and we'll set you up as per requirements so you can start issuing, tracking, and recovering keys.
          </p>
          <div className="flex flex-col gap-3 mt-6">
            {[
              { icon: <Mail size={15} />, label: "support@fipherkeys.com", href: "mailto:support@fipherkeys.com" },
              { icon: <Facebook size={15} />, label: "facebook.com/fipherkeys", href: "#" },
              { icon: <Twitter size={15} />, label: "twitter.com/fipherkeys", href: "#" },
            ].map((s) => (
              <a
                key={s.label}
                href={s.href}
                className="group inline-flex items-center gap-2 text-[14px] font-medium w-fit transition-transform duration-200 hover:translate-x-1"
                style={{ color: DSU.navy }}
              >
                <span
                  className="inline-flex items-center justify-center rounded-full shrink-0 transition-colors duration-200 group-hover:text-white"
                  style={{ width: 36, height: 36, background: DSU.tintBg, color: DSU.navy }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = DSU.navy; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = DSU.tintBg; }}
                >
                  {s.icon}
                </span>
                <span className="border-b border-transparent group-hover:border-current transition-colors duration-200">
                  {s.label}
                </span>
              </a>
            ))}
          </div>
        </Reveal>

        <Reveal direction="right" delay={100}>
          <form onSubmit={submit} className="p-6 sm:p-8" style={CARD}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium" style={{ color: DSU.darkGray }}>Name</span>
                <input
                  required value={name} onChange={(e) => setName(e.target.value)}
                  className={contactFieldClasses} style={contactFieldStyle} placeholder="Jordan Reyes"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium" style={{ color: DSU.darkGray }}>Email</span>
                <input
                  required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className={contactFieldClasses} style={contactFieldStyle} placeholder="you@company.com"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 mt-4">
              <span className="text-[12px] font-medium" style={{ color: DSU.darkGray }}>Organization</span>
              <input
                required value={organization} onChange={(e) => setOrganization(e.target.value)}
                className={contactFieldClasses} style={contactFieldStyle} placeholder="Your school, department, or company"
              />
            </label>
            <label className="flex flex-col gap-1.5 mt-4">
              <span className="text-[12px] font-medium" style={{ color: DSU.darkGray }}>Message</span>
              <textarea
                required value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
                className={contactFieldClasses} style={contactFieldStyle} placeholder="We'd like to start tracking keys for our organization."
              />
            </label>
            <Button type="submit" variant="primary" className="!mt-5 !px-6 !py-3 !text-[14px] !rounded-full w-full sm:w-auto justify-center">
              Contact us <ArrowRight size={15} />
            </Button>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

/** The hero's three-screenshot stack. The two overlay shots scale up in
 *  place on hover, like a photo lifting off the pile, rather than sliding
 *  further out. */
function HeroImageStack() {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative"
      style={{ transform: "scale(1.08)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <ScreenshotFrame src="/landing/dashboard.jpg" alt="Dashboard showing keys out, holders, and activity charts" />
      {/* A second real screen, stacked underneath and peeking out at the
          corner — two products of the same system, not one mockup floating
          alone. Pulled further out past the main shot's edge so the whole
          stack reads bigger. */}
      <div
        className="hidden sm:block absolute transition-transform duration-300"
        style={{
          width: "58%", bottom: 0, left: "-10%",
          transform: `rotate(-4deg) scale(${hovered ? 1.06 : 1})`,
          transformOrigin: "bottom left",
        }}
      >
        <ScreenshotFrame
          src="/landing/directory-card.jpg"
          alt="Key holder directory with an expanded row of keys"
        />
      </div>
      {/* A third, smaller screen peeking out the opposite corner, so the
          stack reads as "one system, several screens" rather than a single
          hero mockup with one decorative echo. */}
      <div
        className="hidden sm:block absolute transition-transform duration-300"
        style={{
          width: "46%", top: 0, right: "-10%",
          transform: `rotate(5deg) scale(${hovered ? 1.06 : 1})`,
          transformOrigin: "top right",
        }}
      >
        <ScreenshotFrame
          src="/landing/key-card.jpg"
          alt="Key detail page showing current and previous holders"
        />
      </div>
    </div>
  );
}

/**
 * Public marketing page, shown before sign-in — reachable at /landing without
 * touching the authenticated app or its routing. "Log In" / "Get Started"
 * both send visitors to "/", where the existing session check takes over
 * (LoginView if signed out, the app itself if already signed in).
 */
export function LandingView() {
  // Transparent over the hero; picks up a solid navy fill (and its own hex
  // texture) once the page has actually scrolled, so it reads against the
  // lighter sections beneath instead of floating illegibly over them.
  const [scrolled, setScrolled] = useState(false);
  const [wordmarkHover, setWordmarkHover] = useState(false);
  // Section nav links stay out of the header entirely until the hero has
  // scrolled past — the hero already carries its own CTAs, so the links only
  // earn their place once the visitor is scrolling through the page.
  const [showNavLinks, setShowNavLinks] = useState(false);
  const featuresRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      if (featuresRef.current) {
        setShowNavLinks(featuresRef.current.getBoundingClientRect().top <= 60);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Header swaps between a dark and a light theme to match whichever section
  // is currently passing behind it, so it never sits as a same-navy-on-navy
  // slab over how-it-works/testimonials/footer or an illegible white-on-white
  // block over the light sections. A thin IntersectionObserver "line" just
  // under the header reports whichever section is crossing it right now.
  const [headerTheme, setHeaderTheme] = useState<"dark" | "light">("dark");
  const heroRef = useRef<HTMLElement | null>(null);
  const howItWorksRef = useRef<HTMLElement | null>(null);
  const whyRef = useRef<HTMLElement | null>(null);
  const testimonialsRef = useRef<HTMLElement | null>(null);
  const ctaRef = useRef<HTMLElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // Each entry is the header theme to show while that section is behind
    // it — the opposite of the section's own background, for contrast,
    // except the hero: that one keeps the header's original dark-on-dark
    // look rather than flipping it.
    const sections: { ref: React.RefObject<HTMLElement | null>; theme: "dark" | "light" }[] = [
      { ref: heroRef, theme: "dark" },
      { ref: featuresRef, theme: "dark" },
      { ref: howItWorksRef, theme: "light" },
      { ref: whyRef, theme: "dark" },
      { ref: testimonialsRef, theme: "light" },
      { ref: ctaRef, theme: "dark" },
      { ref: footerRef, theme: "light" },
    ];
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const match = sections.find((s) => s.ref.current === entry.target);
          if (match) setHeaderTheme(match.theme);
        }
      },
      { rootMargin: "-60px 0px -100% 0px", threshold: 0 },
    );
    sections.forEach((s) => { if (s.ref.current) io.observe(s.ref.current); });
    return () => io.disconnect();
  }, []);
  const dark = headerTheme === "dark";

  return (
    <div className="min-h-screen" style={{ background: DSU.gray, fontFamily: BODY }}>
      {/* Only ever one of App/LandingView is mounted (see main.tsx), so a
          page-level smooth-scroll rule here can't leak into the app. */}
      <style>{"html { scroll-behavior: smooth; }"}</style>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40"
        style={{
          // Flips between the page's two surface tones to match whichever
          // section is currently behind it (see the headerTheme observer
          // above), so it never reads as a same-color slab over a dark
          // section or an illegible block over a light one.
          background: dark ? DSU.navyDark : "#e7e9eb",
          boxShadow: !dark ? shadow.md : scrolled ? shadow.lg : "none",
          transition: "background-color 300ms ease, box-shadow 220ms ease",
        }}
      >
        <div className="relative">
          <div className="relative w-full px-6 sm:px-10 lg:px-16 min-h-[52px] flex items-center gap-3 py-2 max-w-[1680px] mx-auto">
            <a
              href="/landing"
              onMouseEnter={() => setWordmarkHover(true)}
              onMouseLeave={() => setWordmarkHover(false)}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <div
                className="flex items-center justify-center w-7 h-7 overflow-hidden flex-shrink-0"
                style={{
                  background: dark ? "#fff" : DSU.tintBg,
                  borderRadius: radius.sm,
                  boxShadow: dark ? "0 1px 3px rgba(0,0,0,0.25)" : "none",
                  transform: wordmarkHover ? "scale(1.1)" : "scale(1)",
                  transition: "transform 200ms ease, background-color 300ms ease",
                }}
              >
                <img src="/logo.png" alt="" className="w-full h-full object-cover" />
              </div>
              <span
                className="text-[18px] leading-none font-semibold tracking-tight"
                style={{
                  fontFamily: DISPLAY,
                  color: wordmarkHover ? DSU.trojan : dark ? "#fff" : DSU.navy,
                  transition: "color 200ms ease",
                }}
              >
                Fipher Keys
              </span>
            </a>

            <div className="flex-1" />

            <nav
              className={`hidden lg:flex items-center gap-7 mr-7 transition-all duration-300 ${
                showNavLinks ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
              }`}
            >
              {[
                { label: "Features", href: "#features" },
                { label: "How it works", href: "#how-it-works" },
                { label: "Why it matters", href: "#why-it-matters" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-[13px] font-medium transition-colors"
                  style={{ color: dark ? "rgba(255,255,255,0.7)" : DSU.midGray }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = dark ? "#fff" : DSU.navy; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = dark ? "rgba(255,255,255,0.7)" : DSU.midGray; }}
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <a href="/" className="group">
              <Button
                variant="secondary"
                className={
                  dark
                    ? "!bg-transparent !border-white/25 !text-white transition-all duration-200 hover:!bg-white hover:!text-[#004165] hover:!border-white group-hover:scale-[1.04]"
                    : "!bg-transparent !border-[#004165]/25 !text-[#004165] transition-all duration-200 hover:!bg-[#004165] hover:!text-white hover:!border-[#004165] group-hover:scale-[1.04]"
                }
              >
                <LogIn size={13} className="transition-transform duration-200 group-hover:-translate-x-0.5" /> Log In
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── headline + CTAs on the left, a real dashboard screenshot
          on the right so the very first thing a visitor sees is the actual
          product, not a stock photo. Full-bleed gradient/glow backdrop, sized
          to fill most of the first viewport — this is the one section that
          has to sell the product in under five seconds. */}
      <section ref={heroRef} className="relative overflow-hidden flex items-center min-h-[75vh]">
        <HeroBackdrop />
        <ParticleField />
        <div className="relative z-10 w-full max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-16 py-14 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.3fr] gap-12 lg:gap-20 items-center">
            <Reveal>
              <h1
                className="text-[44px] sm:text-[60px] lg:text-[68px] font-semibold leading-[1.05] max-w-[640px]"
                style={{ color: "#ffffff", fontFamily: DISPLAY }}
              >
                Every key.{" "}
                <span style={{ color: DSU.trojan, fontStyle: "italic" }}>Always accounted for.</span>
              </h1>
              <p className="text-[16px] sm:text-[18px] mt-6 max-w-[440px] leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
                Issue, track, and recover every physical key across your organization in one system.
                No spreadsheet, no card box, no guessing.
              </p>
              <div className="flex items-center gap-3 mt-9 flex-wrap">
                <a href="/?mode=register">
                  <Button variant="primary" className="!px-6 !py-3 !text-[15px] !rounded-full">
                    Get Started <ArrowRight size={16} />
                  </Button>
                </a>
                <a href="#contact" className="group">
                  <Button
                    variant="secondary"
                    className="!px-6 !py-3 !text-[15px] !rounded-full !bg-transparent !border-white/25 !text-white transition-all duration-200 hover:!bg-white hover:!text-[#004165] hover:!border-white group-hover:scale-[1.04]"
                  >
                    <Mail size={15} /> Contact Us
                  </Button>
                </a>
              </div>
            </Reveal>

            <Reveal direction="right" delay={120} className="pt-10 pr-14 pb-12 pl-16 sm:pt-14 sm:pr-20 sm:pb-16 sm:pl-24">
              <HeroImageStack />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Highlight strip ── a plain-flow sibling between the hero and
          Features, pulled up over the hero's bottom edge with a negative
          margin so it overlaps both without any absolute-positioning
          trickery (the earlier version of this used position:absolute inside
          a collapsed parent, which left a large gap on some viewports).
          Wider than the rest of the page's content column on purpose, and
          each tile gets its own color + a hover lift, so it reads as a row
          of four small moments instead of one flat information bar. */}
      <div className="relative z-10 max-w-[1620px] mx-auto px-4 sm:px-6 lg:px-8 -mt-8 sm:-mt-10">
        <Reveal delay={150}>
          <div
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-6"
            style={{ ...CARD, boxShadow: shadow.xl }}
          >
            {HIGHLIGHTS.map((h, i) => (
              <div
                key={h.label}
                className="group relative overflow-hidden flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200 cursor-default"
                style={{ background: i % 2 === 0 ? "#f3f9fc" : "#fef4ec" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = shadow.md; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <HexWatermark />
                </div>
                <span
                  className="relative inline-flex items-center justify-center rounded-xl shrink-0 transition-transform duration-200 group-hover:rotate-6"
                  style={{ width: 44, height: 44, background: i % 2 === 0 ? DSU.navy : DSU.trojan, color: "#fff" }}
                >
                  {h.icon}
                </span>
                <span className="relative text-[13px] font-semibold leading-snug" style={{ color: DSU.darkGray }}>{h.label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* ── Features ── */}
      <section ref={featuresRef} id="features" className="max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-16 pt-14 sm:pt-16 pb-16 sm:pb-20 scroll-mt-16">
        <Reveal className="mb-12 pb-6 border-b text-center" style={{ borderColor: DSU.lightBorder }}>
          <h2
            className="text-[28px] sm:text-[34px] font-semibold leading-tight"
            style={{ fontFamily: DISPLAY, color: DSU.navy }}
          >
            Built for the way keys{" "}
            <span style={{ color: DSU.trojan, fontStyle: "italic" }}>actually move</span>
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80} className="h-full">
              <div
                className="group relative overflow-hidden h-full p-5 transition-all duration-300 hover:-translate-y-1"
                style={{ ...CARD, boxShadow: shadow.sm }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = shadow.lg; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = shadow.sm; }}
              >
                {/* The DSU hex motif, invisible until hovered — the same
                    watermark the app's own light-surface panels use. */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <HexWatermark />
                </div>
                <div className="relative">
                  <IconBadge icon={f.icon} bg={i % 2 === 0 ? DSU.navy : DSU.trojan} />
                  <h3 className="text-[15px] font-semibold mt-3.5" style={{ color: DSU.navy, fontFamily: BODY }}>
                    {f.title}
                  </h3>
                  <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: DSU.midGray }}>
                    {f.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ── real screenshots, alternating sides, walked down
          a numbered rail so the sequence itself reads as a sequence — not
          just three identical cards in a row. Flat navy, no hex tiling here;
          the texture is reserved for the header/hero/CTA so it doesn't turn
          into wallpaper. */}
      <section ref={howItWorksRef} id="how-it-works" className="relative scroll-mt-16" style={{ background: DSU.navyDark }}>
        <div className="relative max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-16 py-16 sm:py-24">
          <Reveal className="max-w-[560px] mb-16 sm:mb-20">
            <h2 className="text-[30px] sm:text-[38px] font-semibold leading-tight" style={{ fontFamily: DISPLAY, color: "#ffffff" }}>
              How it{" "}
              <span style={{ fontStyle: "italic", color: DSU.trojan }}>actually</span> works?
            </h2>
          </Reveal>

          <div className="relative">
            {/* Rail: a hairline that runs the height of the steps, with a
                numbered marker centered on each panel — only on wide screens,
                where there's a real gutter for it to live in. */}
            <div
              aria-hidden="true"
              className="hidden lg:block absolute top-3 bottom-3 w-px"
              style={{ left: 23, background: "rgba(255,255,255,0.14)" }}
            />
            <div className="flex flex-col gap-20 sm:gap-28">
              {WORKS.map((w, i) => (
                <div key={w.title} className="group relative lg:pl-20">
                  <div
                    className="hidden lg:flex absolute left-0 top-0 items-center justify-center rounded-full flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_0_6px_rgba(0,169,224,0.18)]"
                    style={{ width: 48, height: 48, background: DSU.navyDark, border: `2px solid ${DSU.trojan}` }}
                  >
                    <span className="tabular" style={{ fontFamily: DISPLAY, color: "#ffffff", fontSize: 18, fontWeight: 600 }}>
                      0{i + 1}
                    </span>
                  </div>
                  <ShowcasePanel {...w} flip={i % 2 === 1} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Why it matters / trust ── light and editorial, on purpose: three
          navy sections back to back (how-it-works → this → CTA) would read
          as one undifferentiated slab, so this one flips to the page's base
          tone and swaps the icon-card grid for a plain divided list. */}
      <section ref={whyRef} id="why-it-matters" className="max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-16 py-16 sm:py-24 scroll-mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16">
          <Reveal direction="left" className="lg:sticky lg:top-24 self-start">
            <h2 className="text-[30px] sm:text-[38px] font-semibold leading-tight" style={{ fontFamily: DISPLAY, color: DSU.navy }}>
              A lost key is a security problem,{" "}
              <span style={{ fontStyle: "italic", color: DSU.trojan }}>not an inconvenience.</span>
            </h2>
            <p className="text-[14px] mt-4 max-w-[420px] leading-relaxed" style={{ color: DSU.midGray }}>
              Each point below follows straight from the workflows above, not a separate promise.
            </p>
            <div className="mt-8 pl-4 max-w-[380px]" style={{ borderLeft: `3px solid ${DSU.trojan}` }}>
              <p className="text-[17px] leading-snug" style={{ fontFamily: DISPLAY, fontStyle: "italic", color: DSU.navy }}>
                “If a key doesn't come back, the record already shows who had it last.”
              </p>
              <p className="text-[12px] mt-2 uppercase tracking-wide" style={{ color: DSU.midGray, letterSpacing: "0.08em" }}>
                What every audit trail entry answers
              </p>
            </div>
          </Reveal>

          <div>
            {TRUST.map((t, i) => (
              <Reveal key={t.title} delay={i * 80}>
                <div
                  className={`group relative overflow-hidden py-5 px-3 -mx-3 rounded-xl transition-colors duration-300 hover:bg-[#f3f9fc] ${i > 0 ? "border-t" : ""}`}
                  style={{ borderColor: DSU.lightBorder }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <HexWatermark />
                  </div>
                  <div className="relative flex items-start gap-4">
                    <IconBadge icon={t.icon} bg={i % 2 === 0 ? DSU.navy : DSU.trojan} />
                    <div>
                      <h3 className="text-[15px] font-semibold" style={{ color: DSU.navy }}>{t.title}</h3>
                      <p className="text-[13px] mt-1 leading-relaxed" style={{ color: DSU.midGray }}>
                        {t.body}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── a slow, hover-pausable marquee of sample quotes.
          Two back-to-back copies of the same list in one flex row, animated
          -50% so the loop is seamless; edges fade to the section's own
          background instead of a hard clip. */}
      <section ref={testimonialsRef} className="py-16 sm:py-20 overflow-hidden" style={{ background: DSU.navyDark }}>
        <div className="max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-16">
          <Reveal className="mb-10 text-center">
            <h2 className="text-[26px] sm:text-[32px] font-semibold leading-tight" style={{ fontFamily: DISPLAY, color: "#ffffff" }}>
              What our customers say
            </h2>
          </Reveal>
        </div>

        <div
          className="relative"
          style={{
            maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
          }}
        >
          <div className="dsu-marquee-track flex items-stretch gap-4 w-max">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
              <div
                key={`${t.name}-${i}`}
                className="group relative overflow-hidden flex flex-col justify-between shrink-0 p-5 transition-all duration-300 hover:-translate-y-1"
                style={{ width: 340, background: "rgba(255,255,255,0.06)", borderRadius: 16 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              >
                {/* Same hex motif as the app's dark surfaces (header, hero),
                    faded in only on hover. */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <HexBg />
                </div>
                <div className="relative">
                  <Quote size={18} style={{ color: DSU.trojan }} />
                  <p className="text-[14px] mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                    {t.quote}
                  </p>
                </div>
                <div className="relative mt-5 text-[12px]">
                  <span className="font-semibold text-white">{t.name}</span>
                  <span style={{ color: "rgba(255,255,255,0.5)" }}> · {t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── bigger and bolder than a typical inline banner,
          since this is the page's actual close before it hands off to a
          plain contact form. Both actions from the hero repeat here so
          anyone who scrolled this far doesn't have to scroll back up. */}
      <section ref={ctaRef} className="max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-16 pt-16 sm:pt-20">
        <Reveal>
          <div
            className="group relative overflow-hidden text-center px-6 sm:px-10 py-10 sm:py-12 transition-transform duration-300 hover:-translate-y-1"
            style={{ ...CARD, background: DSU.navy }}
          >
            <HexWatermark />
            <div
              aria-hidden="true"
              className="hidden sm:block absolute rounded-xl pointer-events-none rotate-[12deg] transition-transform duration-500 group-hover:rotate-[28deg]"
              style={{ width: 30, height: 30, top: 22, left: 36, background: DSU.trojan, opacity: 0.85 }}
            />
            <div
              aria-hidden="true"
              className="hidden sm:block absolute rounded-full pointer-events-none transition-transform duration-500 group-hover:scale-125"
              style={{ width: 20, height: 20, bottom: 26, right: 48, border: `3px solid ${DSU.trojan}`, opacity: 0.85 }}
            />
            <h2
              className="relative text-[26px] sm:text-[32px] font-semibold leading-tight text-white max-w-[520px] mx-auto"
              style={{ fontFamily: DISPLAY }}
            >
              Ready to stop guessing{" "}
              <span style={{ fontStyle: "italic", color: DSU.trojan }}>who has what?</span>
            </h2>
            <p className="relative text-[14px] mt-3 max-w-[500px] mx-auto" style={{ color: "rgba(255,255,255,0.72)" }}>
              Contact us to get the access code, and start managing keys for your organization.
            </p>
            <div className="relative flex items-center justify-center gap-3 mt-6 flex-wrap">
              <a href="#contact">
                <Button variant="primary" className="!px-6 !py-3 !text-[15px] !rounded-full">
                  Get Started <ArrowRight size={16} />
                </Button>
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      <ContactSection />

      {/* ── Footer ── multi-column, on the same dark field as the CTA above
          it, so the two read as one closing unit instead of the page
          bouncing back to white right before it ends. */}
      <footer ref={footerRef} className="mt-16 sm:mt-20" style={{ background: DSU.navyDark }}>
        <div className="max-w-[1680px] mx-auto px-6 sm:px-10 lg:px-16 pt-14 pb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-6 pb-10">
            <div className="col-span-2 sm:col-span-1 pr-4">
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center justify-center w-7 h-7 flex-shrink-0 overflow-hidden"
                  style={{ background: "#fff", borderRadius: radius.sm }}
                >
                  <img src="/logo.png" alt="" className="w-full h-full object-cover" />
                </div>
                <span className="text-[15px] font-semibold text-white" style={{ fontFamily: DISPLAY }}>Fipher Keys</span>
              </div>
              <p className="text-[13px] mt-3 leading-relaxed max-w-[240px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                One record for every key your organization holds. Who has it, where it opens, when it came back.
              </p>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase mb-3" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>
                Product
              </div>
              <ul className="flex flex-col gap-2.5 text-[13px]" style={{ color: "rgba(255,255,255,0.72)" }}>
                <li><a href="#features" className="hover:text-white hover:underline underline-offset-4 decoration-[#00A9E0] transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white hover:underline underline-offset-4 decoration-[#00A9E0] transition-colors">How it works</a></li>
                <li><a href="#why-it-matters" className="hover:text-white hover:underline underline-offset-4 decoration-[#00A9E0] transition-colors">Why it matters</a></li>
              </ul>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase mb-3" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>
                Account
              </div>
              <ul className="flex flex-col gap-2.5 text-[13px]" style={{ color: "rgba(255,255,255,0.72)" }}>
                <li><a href="/" className="hover:text-white hover:underline underline-offset-4 decoration-[#00A9E0] transition-colors">Log In</a></li>
                <li><a href="/?mode=register" className="hover:text-white hover:underline underline-offset-4 decoration-[#00A9E0] transition-colors">Get Started</a></li>
              </ul>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase mb-3" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>
                Support
              </div>
              <ul className="flex flex-col gap-2.5 text-[13px]" style={{ color: "rgba(255,255,255,0.72)" }}>
                <li><a href="#contact" className="hover:text-white hover:underline underline-offset-4 decoration-[#00A9E0] transition-colors">Contact Support</a></li>
              </ul>
            </div>
          </div>

          <div
            className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t text-[12px]"
            style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }}
          >
            <span>© {new Date().getFullYear()} Fipher Keys. All rights reserved.</span>
            <span>Built for teams managing physical access.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
