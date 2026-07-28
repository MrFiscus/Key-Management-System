import { useState } from "react";
import { LogIn, UserPlus, CheckCircle2 } from "lucide-react";
import { getSupabase } from "../../lib/stores";
import { DSU, appBarFill, font, radius, shadow } from "../theme";
import { Button, Field, TextInput, ErrorNote, HexBg } from "../components/primitives";

/**
 * Sign-in / registration gate shown when Supabase is configured but no user
 * session exists. Uses Supabase email/password auth; on sign-in success,
 * onAuthStateChange in App swaps this out for the app. Registration requires
 * an access code tied to an organization — see migration
 * 0005_organizations.sql for how the code resolves to an org_id server-side.
 */
export function LoginView() {
  const [mode, setMode] = useState<"signin" | "register">("signin");

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
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), access_code: accessCode.trim() } },
    });
    if (error) {
      // The database trigger raises "That access code was not recognized." /
      // "An access code is required to register." on a bad code; GoTrue
      // wraps it, but the original message survives inside error.message.
      setError(error.message);
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: DSU.gray, fontFamily: font.sans }}>
      <div
        className="w-full max-w-[400px] overflow-hidden"
        style={{ background: "#fff", borderRadius: radius.xl, boxShadow: shadow.xl }}
      >
        {/* header */}
        <div className="relative overflow-hidden px-6 py-6" style={{ background: appBarFill }}>
          <HexBg />
          <div className="relative flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 overflow-hidden flex-shrink-0" style={{ background: "#fff", borderRadius: radius.sm }}>
              <img src="/logo.png" alt="" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="text-white text-[18px] font-semibold leading-tight" style={{ fontFamily: font.display }}>
                Fipher Keys
              </div>
              <div className="text-white/70 text-[12px]">Key & access management</div>
            </div>
          </div>
        </div>

        {checkEmail ? (
          <div className="p-6 flex flex-col gap-3 items-start">
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
          <form onSubmit={signIn} className="p-6 flex flex-col gap-4">
            <div>
              <h1 className="text-[16px] font-semibold" style={{ color: DSU.navy }}>Sign in</h1>
              <p className="text-[13px] mt-0.5" style={{ color: DSU.midGray }}>
                Use your authorized facilities account.
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
              />
            </Field>
            <Field label="Password" required>
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>

            <Button type="submit" variant="primary" disabled={busy} className="w-full justify-center !py-2 mt-1">
              <LogIn size={15} /> {busy ? "Signing in…" : "Sign in"}
            </Button>

            <p className="text-[13px] text-center" style={{ color: DSU.midGray }}>
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
          <form onSubmit={register} className="p-6 flex flex-col gap-4">
            <div>
              <h1 className="text-[16px] font-semibold" style={{ color: DSU.navy }}>Create an account</h1>
              <p className="text-[13px] mt-0.5" style={{ color: DSU.midGray }}>
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
              />
            </Field>
            <Field label="Access code" required hint="Given to you by your organization's admin.">
              <TextInput
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="e.g. DSU-FACILITIES-2026"
                autoComplete="off"
                required
              />
            </Field>

            <Button type="submit" variant="primary" disabled={busy} className="w-full justify-center !py-2 mt-1">
              <UserPlus size={15} /> {busy ? "Creating account…" : "Create account"}
            </Button>

            <p className="text-[13px] text-center" style={{ color: DSU.midGray }}>
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
  );
}
