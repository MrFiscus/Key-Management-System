import { useState } from "react";
import { LogIn, UserPlus, CheckCircle2 } from "lucide-react";
import { getSupabase } from "../../lib/stores";
import { DSU, font, radius, shadow } from "../theme";
import { Button, Field, TextInput, ErrorNote } from "../components/primitives";
import { ParticleField, ScreenshotFrame } from "./LandingView";

const LOGIN_VIGNETTE = [{ x: 0.5, y: 0.5, r: 0.55, alpha: 0.72 }];

/**
 * Sign-in / registration gate shown when Supabase is configured but no user
 * session exists. Uses Supabase email/password auth; on sign-in success,
 * onAuthStateChange in App swaps this out for the app. Registration requires
 * an access code tied to an organization — see migration
 * 0005_organizations.sql for how the code resolves to an org_id server-side.
 */
export function LoginView() {
  const [mode, setMode] = useState<"signin" | "register">(
    new URLSearchParams(window.location.search).get("mode") === "register" ? "register" : "signin"
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const switchMode = (next: "signin" | "register") => {
    setMode(next);
    setError("");
    setCheckEmail(false);
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) { setError("Supabase is not configured."); return; }
    setBusy(true);
    setError("");
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
    // On success the auth listener in App re-renders; no navigation needed here.
  };

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) { setError("Supabase is not configured."); return; }
    setBusy(true);
    setError("");

    // Checked up front, while still signed out: GoTrue returns an opaque
    // HTTP 500 for any exception raised inside the on-signup trigger, and
    // the client SDK doesn't surface that response body — so validating
    // here is the only way to show a real "bad code" message instead of a
    // blank error after the fact.
    const { data: codeOk, error: codeError } = await sb.rpc("validate_access_code", { v_code: accessCode.trim() });
    if (codeError) {
      console.error("Access code check failed:", codeError);
      setError("Couldn't verify that access code right now. Try again in a moment.");
      setBusy(false);
      return;
    }
    if (!codeOk) {
      setError("That access code was not recognized.");
      setBusy(false);
      return;
    }

    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), access_code: accessCode.trim() } },
    });
    if (error) {
      // Should be rare now that the code is pre-validated above — logged so
      // any remaining failure (duplicate email, etc.) is still diagnosable.
      console.error("Sign-up error:", error);
      setError(error.message || "Something went wrong creating your account. Open the browser console for details.");
      setBusy(false);
      return;
    }
    if (!data.session) {
      // Email confirmation is on for this project — no session yet.
      setCheckEmail(true);
    }
    setBusy(false);
    // If a session came back immediately, the auth listener in App takes over.
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ fontFamily: font.sans }}>
        {/* Form panel */}
        <div
          className="relative w-full lg:w-[44%] flex flex-col items-center justify-center p-8 sm:p-10 lg:p-14 flex-shrink-0"
          style={{ background: "#fff", fontFamily: font.sans }}
        >
        <div className="w-full max-w-[400px]">
          <a href="/landing" className="flex items-center gap-3 mb-10">
            <div className="flex items-center justify-center w-10 h-10 overflow-hidden flex-shrink-0" style={{ background: DSU.tintBg, borderRadius: radius.sm }}>
              <img src="/logo.png" alt="" className="w-full h-full object-cover" />
            </div>
            <span className="text-[19px] font-semibold leading-none" style={{ fontFamily: font.display, color: DSU.navy }}>
              Fipher Keys
            </span>
          </a>

          {checkEmail ? (
          <div className="flex flex-col gap-3 items-start">
            <div className="flex items-center justify-center w-10 h-10 rounded-full" style={{ background: DSU.tintBg }}>
              <CheckCircle2 size={20} color={DSU.trojan} />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold" style={{ color: DSU.navy }}>Check your email</h1>
              <p className="text-[13px] mt-1" style={{ color: DSU.midGray }}>
                We sent a confirmation link to <strong>{email.trim()}</strong>. Follow it to finish creating your account, then sign in below.
              </p>
            </div>
            <Button variant="secondary" className="w-full justify-center !py-2 mt-1" onClick={() => switchMode("signin")}>
              Back to sign in
            </Button>
          </div>
        ) : mode === "signin" ? (
          <form onSubmit={signIn} className="flex flex-col gap-5">
            <div>
              <h1 className="text-[32px] font-semibold" style={{ color: DSU.navy }}>Sign in</h1>
              <p className="text-[14.5px] mt-1" style={{ color: DSU.darkGray }}>
                Use your authorized organization account.
              </p>
            </div>

            {error && <ErrorNote message={error} />}

            <Field label="Email" required>
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="username"
                autoFocus
                required
                style={{ fontSize: 15, padding: "10px 12px" }}
              />
            </Field>
            <Field label="Password" required>
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{ fontSize: 15, padding: "10px 12px" }}
              />
            </Field>

            <Button type="submit" variant="primary" disabled={busy} className="w-full justify-center !py-3 !text-[15px] mt-1">
              <LogIn size={16} /> {busy ? "Signing in…" : "Sign in"}
            </Button>

            <p className="text-[14px] text-center" style={{ color: DSU.darkGray }}>
              New to the system?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="font-semibold hover:underline"
                style={{ color: DSU.trojan }}
              >
                Create an account
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={register} className="flex flex-col gap-5">
            <div>
              <h1 className="text-[32px] font-semibold" style={{ color: DSU.navy }}>Create an account</h1>
              <p className="text-[14.5px] mt-1" style={{ color: DSU.darkGray }}>
                Requires an access code from your organization.
              </p>
            </div>

            {error && <ErrorNote message={error} />}

            <Field label="Full name" required>
              <TextInput
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                autoComplete="name"
                autoFocus
                required
                style={{ fontSize: 15, padding: "10px 12px" }}
              />
            </Field>
            <Field label="Email" required>
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="username"
                required
                style={{ fontSize: 15, padding: "10px 12px" }}
              />
            </Field>
            <Field label="Password" required>
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
                style={{ fontSize: 15, padding: "10px 12px" }}
              />
            </Field>
            <Field label="Access code" required>
              <TextInput
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Given to you by your organization's admin."
                autoComplete="off"
                required
                style={{ fontSize: 15, padding: "10px 12px" }}
              />
            </Field>

            <Button type="submit" variant="primary" disabled={busy} className="w-full justify-center !py-3 !text-[15px] mt-1">
              <UserPlus size={16} /> {busy ? "Creating account…" : "Create account"}
            </Button>

            <p className="text-[14px] text-center" style={{ color: DSU.darkGray }}>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="font-semibold hover:underline"
                style={{ color: DSU.trojan }}
              >
                Sign in
              </button>
            </p>
          </form>
        )}

        </div>
        </div>

        {/* Page-anchored, independent of either panel's content height. */}
        <div className="hidden lg:block fixed bottom-6 left-8 text-[12px]" style={{ color: DSU.midGray }}>
          © {new Date().getFullYear()} Fipher Keys
        </div>
        <div className="lg:hidden text-center text-[12px] py-4" style={{ color: DSU.midGray }}>
          © {new Date().getFullYear()} Fipher Keys
        </div>

        {/* Brand panel — hidden below lg, where the form panel alone fills the card. */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden flex-col justify-center px-12 xl:px-16 py-10" style={{ background: DSU.navyDark }}>
          <ParticleField vignettes={LOGIN_VIGNETTE} />
          <div className="relative w-full max-w-[760px] mx-auto">
            {mode === "signin" ? (
              <h1 className="text-[28px] xl:text-[34px] font-medium leading-[1.25] text-white max-w-[640px]" style={{ fontFamily: font.sans }}>
                Welcome back. <span style={{ color: DSU.trojan }}>Every key, right where you left it.</span>
              </h1>
            ) : (
              <h1 className="text-[28px] xl:text-[34px] font-medium leading-[1.25] text-white max-w-[640px]" style={{ fontFamily: font.sans }}>
                Join your team. <span style={{ color: DSU.trojan }}>Get set up in less than a minute.</span>
              </h1>
            )}
            <p className="text-[16px] xl:text-[17px] mt-4 leading-relaxed max-w-[640px]" style={{ color: "rgba(255,255,255,0.7)" }}>
              {mode === "signin"
                ? "Sign in to see who's holding what, close out returns, and keep the whole key inventory honest."
                : "Bring your access code and you're in, ready to issue, track, and recover keys alongside the rest of your team."}
            </p>
            <div className="relative mt-10 w-full">
              <ScreenshotFrame src="/landing/login-stats.jpg" alt="Fipher Keys dashboard stats" />

              {/* A miniature echo of the sign-in card, overlapping the
                  screenshot's corner — purely decorative, not a real form. */}
              <div
                aria-hidden="true"
                className="hidden xl:block absolute"
                style={{ bottom: -44, right: -52, width: 280 }}
              >
                <div style={{ background: "#fff", borderRadius: radius.lg, boxShadow: shadow.xl, padding: 20 }}>
                  <div className="flex items-center gap-2 mb-3.5">
                    <div className="flex items-center justify-center w-5 h-5 overflow-hidden flex-shrink-0" style={{ background: DSU.tintBg, borderRadius: 4 }}>
                      <img src="/logo.png" alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[12.5px] font-semibold" style={{ fontFamily: font.display, color: DSU.navy }}>Fipher Keys</span>
                  </div>
                  <div className="text-[14px] font-semibold mb-3" style={{ color: DSU.navy }}>Sign in</div>
                  <div
                    className="rounded mb-2 flex items-center px-2 text-[11px]"
                    style={{ height: 22, background: DSU.zebra, border: `1px solid ${DSU.lightBorder}`, color: DSU.darkGray }}
                  >
                    j.rivera@fipherkeys.com
                  </div>
                  <div
                    className="rounded mb-2.5 flex items-center px-2 text-[11px] tracking-widest"
                    style={{ height: 22, background: DSU.zebra, border: `1px solid ${DSU.lightBorder}`, color: DSU.darkGray }}
                  >
                    ••••••••
                  </div>
                  <div className="rounded" style={{ height: 24, background: DSU.trojan }} />
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
