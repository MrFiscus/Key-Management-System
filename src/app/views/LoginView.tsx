import { useState } from "react";
import { Key, LogIn } from "lucide-react";
import { getSupabase } from "../../lib/stores";
import { DSU, appBarFill, font, radius, shadow } from "../theme";
import { Button, Field, TextInput, ErrorNote, HexBg } from "../components/primitives";

/**
 * Sign-in gate shown when Supabase is configured but no user session exists.
 * Uses Supabase email/password auth; on success, onAuthStateChange in App swaps
 * this out for the app.
 */
export function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
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
            <div className="flex items-center justify-center w-9 h-9" style={{ background: DSU.trojan, borderRadius: radius.sm }}>
              <Key size={18} color="#fff" />
            </div>
            <div>
              <div className="text-white text-[18px] font-semibold leading-tight" style={{ fontFamily: font.display }}>
                Facilities Key Management
              </div>
              <div className="text-white/70 text-[12px]">Dakota State University</div>
            </div>
          </div>
        </div>

        {/* form */}
        <form onSubmit={submit} className="p-6 flex flex-col gap-4">
          <div>
            <h1 className="text-[16px] font-semibold" style={{ color: DSU.navy }}>Sign in</h1>
            <p className="text-[13px] mt-0.5" style={{ color: DSU.midGray }}>
              Use your authorized DSU facilities account.
            </p>
          </div>

          {error && <ErrorNote message={error} />}

          <Field label="Email" required>
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@dsu.edu"
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
        </form>
      </div>
    </div>
  );
}
