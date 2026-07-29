import { useEffect, useState } from "react";
import {
  ArrowLeft, Building2, Users, ShieldCheck, RefreshCw, Copy, Trash2, Plus,
  ScrollText, Check, AlertTriangle,
} from "lucide-react";
import { getSupabase } from "../../lib/stores";
import { DSU, font, radius, shadow } from "../theme";
import { Button, Field, TextInput, ErrorNote, Toast, Modal } from "../components/primitives";
import { ConfirmDialog } from "../components/EntityForms";

type OrgRow = { id: string; name: string; member_count: number; created_at: string };
type UserRow = {
  id: string; email: string | null; full_name: string | null; org_id: string; org_name: string;
  is_platform_admin: boolean; created_at: string;
};
type AuditRow = { id: string; actor_email: string | null; action: string; target: string | null; detail: string | null; created_at: string };

type Tab = "organizations" | "users" | "audit";

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: radius.lg,
  boxShadow: shadow.sm,
  border: `1px solid ${DSU.lightBorder}`,
};

const ACTION_LABEL: Record<string, string> = {
  org_created: "Organization created",
  access_code_rotated: "Access code rotated",
  user_revoked: "User revoked",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Platform-admin-only console for managing organizations and accounts.
 * Every mutation here goes through a SECURITY DEFINER Postgres function
 * that re-checks is_platform_admin() server-side (see
 * supabase/migrations/0006_platform_admin.sql) — this component has no
 * privilege of its own, it's just a thin client over those RPCs. A user who
 * isn't actually an admin gets "Not authorized." from Postgres regardless
 * of what this page renders.
 */
export function AdminView({ onBack, backLabel, currentUserId }: {
  onBack: () => void;
  backLabel: string;
  currentUserId: string | null;
}) {
  const sb = getSupabase();
  const [tab, setTab] = useState<Tab>("organizations");
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [revealCode, setRevealCode] = useState<{ orgName: string; code: string } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<UserRow | null>(null);

  const load = async () => {
    if (!sb) { setError("Supabase is not configured."); setLoading(false); return; }
    setError("");
    try {
      const [o, u, a] = await Promise.all([
        sb.rpc("admin_list_organizations"),
        sb.rpc("admin_list_users"),
        sb.rpc("admin_list_audit_log", { v_limit: 100 }),
      ]);
      if (o.error) throw o.error;
      if (u.error) throw u.error;
      if (a.error) throw a.error;
      setOrgs(o.data ?? []);
      setUsers(u.data ?? []);
      setAudit(a.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sb || !newOrgName.trim()) return;
    setCreating(true);
    setError("");
    const { data, error } = await sb.rpc("admin_create_organization", { v_name: newOrgName.trim() });
    setCreating(false);
    if (error) { setError(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setNewOrgName("");
    setRevealCode({ orgName: row.name, code: row.access_code });
    load();
  };

  const rotateCode = async (org: OrgRow) => {
    if (!sb) return;
    setRotatingId(org.id);
    setError("");
    const { data, error } = await sb.rpc("admin_rotate_access_code", { v_org_id: org.id });
    setRotatingId(null);
    if (error) { setError(error.message); return; }
    setRevealCode({ orgName: org.name, code: data as string });
  };

  const revokeUser = async () => {
    if (!sb || !revokeTarget) return;
    const { error } = await sb.rpc("admin_revoke_user", { v_user_id: revokeTarget.id });
    if (error) throw new Error(error.message);
    setToast(`${revokeTarget.full_name || revokeTarget.email || "User"} revoked.`);
    await load();
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setToast("Copied to clipboard.");
    } catch {
      // Clipboard API unavailable — the code is still selectable text in the modal.
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "organizations", label: "Organizations", icon: <Building2 size={14} /> },
    { id: "users", label: "Accounts", icon: <Users size={14} /> },
    { id: "audit", label: "Audit Log", icon: <ScrollText size={14} /> },
  ];

  return (
    <div className="dsu-fade-in">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] mb-4 transition-colors hover:underline"
        style={{ color: DSU.trojan }}
      >
        <ArrowLeft size={13} /> Back to {backLabel}
      </button>

      <div className="flex items-center gap-2.5 mb-1">
        <ShieldCheck size={20} style={{ color: DSU.trojan }} />
        <h1 className="text-[26px] font-semibold" style={{ fontFamily: font.display, color: DSU.navy }}>
          Admin
        </h1>
      </div>
      <p className="text-[13px] mb-5" style={{ color: DSU.midGray }}>
        Manage organizations, access codes, and accounts across every organization.
      </p>

      <div className="flex items-center gap-1 mb-4 border-b" style={{ borderColor: DSU.lightBorder }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors"
            style={{
              color: tab === t.id ? DSU.trojan : DSU.midGray,
              borderColor: tab === t.id ? DSU.trojan : "transparent",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {error && <ErrorNote message={error} />}

      {loading ? (
        <div className="text-[13px]" style={{ color: DSU.midGray }}>Loading…</div>
      ) : tab === "organizations" ? (
        <div className="flex flex-col gap-4">
          <form onSubmit={createOrg} className="p-4 flex items-end gap-3 flex-wrap" style={card}>
            <div className="flex-1 min-w-[220px]">
              <Field label="New organization name">
                <TextInput
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Acme Corporation"
                  required
                />
              </Field>
            </div>
            <Button type="submit" variant="primary" disabled={creating || !newOrgName.trim()}>
              <Plus size={13} /> {creating ? "Creating…" : "Create organization"}
            </Button>
          </form>

          <div className="overflow-hidden" style={card}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left" style={{ background: "#f7f9fb", color: DSU.midGray }}>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase" style={{ letterSpacing: "0.05em" }}>Organization</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase" style={{ letterSpacing: "0.05em" }}>Members</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase" style={{ letterSpacing: "0.05em" }}>Created</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right" style={{ letterSpacing: "0.05em" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} className="border-t" style={{ borderColor: DSU.lightBorder }}>
                    <td className="px-4 py-3 font-medium" style={{ color: DSU.navy }}>{o.name}</td>
                    <td className="px-4 py-3" style={{ color: DSU.darkGray }}>{o.member_count}</td>
                    <td className="px-4 py-3" style={{ color: DSU.midGray }}>{fmtDate(o.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        disabled={rotatingId === o.id}
                        onClick={() => rotateCode(o)}
                      >
                        <RefreshCw size={12} /> {rotatingId === o.id ? "Rotating…" : "Rotate code"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center" style={{ color: DSU.midGray }}>No organizations yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "users" ? (
        <div className="overflow-hidden" style={card}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left" style={{ background: "#f7f9fb", color: DSU.midGray }}>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase" style={{ letterSpacing: "0.05em" }}>Name</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase" style={{ letterSpacing: "0.05em" }}>Email</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase" style={{ letterSpacing: "0.05em" }}>Organization</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase" style={{ letterSpacing: "0.05em" }}>Joined</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right" style={{ letterSpacing: "0.05em" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t" style={{ borderColor: DSU.lightBorder }}>
                  <td className="px-4 py-3 font-medium" style={{ color: DSU.navy }}>
                    {u.full_name || "—"}
                    {u.is_platform_admin && (
                      <span
                        className="inline-flex items-center gap-1 ml-2 px-1.5 py-px rounded-sm text-[10.5px] font-semibold"
                        style={{ background: DSU.tintBg, color: DSU.trojan }}
                      >
                        <ShieldCheck size={10} /> Admin
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: DSU.darkGray }}>{u.email || "—"}</td>
                  <td className="px-4 py-3" style={{ color: DSU.darkGray }}>{u.org_name}</td>
                  <td className="px-4 py-3" style={{ color: DSU.midGray }}>{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="danger"
                      disabled={u.id === currentUserId}
                      title={u.id === currentUserId ? "You can't revoke your own account here." : undefined}
                      onClick={() => setRevokeTarget(u)}
                    >
                      <Trash2 size={12} /> Revoke
                    </Button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center" style={{ color: DSU.midGray }}>No accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden" style={card}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left" style={{ background: "#f7f9fb", color: DSU.midGray }}>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase" style={{ letterSpacing: "0.05em" }}>When</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase" style={{ letterSpacing: "0.05em" }}>Admin</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase" style={{ letterSpacing: "0.05em" }}>Action</th>
                <th className="px-4 py-2.5 font-semibold text-[11px] uppercase" style={{ letterSpacing: "0.05em" }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id} className="border-t" style={{ borderColor: DSU.lightBorder }}>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: DSU.midGray }}>
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3" style={{ color: DSU.darkGray }}>{a.actor_email || "—"}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: DSU.navy }}>{ACTION_LABEL[a.action] ?? a.action}</td>
                  <td className="px-4 py-3" style={{ color: DSU.darkGray }}>{a.detail || "—"}</td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center" style={{ color: DSU.midGray }}>No admin activity recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {revealCode && (
        <Modal title="Access code" onClose={() => setRevealCode(null)}>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 text-[12.5px] p-3 rounded-md" style={{ background: "#fff8e8", color: "#7a6318" }}>
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
              <span>
                This is the only time <strong>{revealCode.orgName}</strong>'s access code is shown. Copy it now — it's stored as a hash from here on and can't be retrieved again, only rotated.
              </span>
            </div>
            <div
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-md font-mono text-[16px] tracking-wide"
              style={{ background: DSU.navyDark, color: "#fff" }}
            >
              <span className="select-all">{revealCode.code}</span>
              <button
                onClick={() => copyCode(revealCode.code)}
                className="flex items-center gap-1 text-[12px] font-sans font-medium px-2 py-1 rounded transition-colors hover:bg-white/10"
                style={{ color: DSU.trojan }}
              >
                <Copy size={13} /> Copy
              </button>
            </div>
            <Button variant="primary" className="justify-center" onClick={() => setRevealCode(null)}>
              <Check size={13} /> Done
            </Button>
          </div>
        </Modal>
      )}

      {revokeTarget && (
        <ConfirmDialog
          title="Revoke account"
          message={`This permanently deletes ${revokeTarget.full_name || revokeTarget.email || "this user"}'s account. They'll be signed out everywhere and will need a new access code to rejoin. This can't be undone.`}
          confirmLabel="Revoke account"
          onConfirm={revokeUser}
          onClose={() => setRevokeTarget(null)}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}
