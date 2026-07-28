import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, Users, KeyRound, Archive, Plus, ArrowLeft, LayoutDashboard, Menu, Map as MapIcon, LogOut,
  HardDrive, User as UserIcon, Settings2,
} from "lucide-react";

import type {
  Assignment, DataStore, KeyActivity, KeyDef, KeyRecord, NewAssignment, NewKeyDef, NewPerson, Person, Snapshot,
} from "../lib/types";
import { toRecords } from "../lib/types";
import { createStore, supabaseConfigured, getSupabase } from "../lib/stores";
import type { Session } from "@supabase/supabase-js";
import { DSU, appBarFill, font, radius, shadow, todayIso } from "./theme";
import { Avatar, Button, HexBg, SkeletonBar, Toast, ErrorNote } from "./components/primitives";
import { AssignmentDialog, AssignmentInput, ConfirmDialog, KeyDialog, PersonDialog, ReturnDialog } from "./components/EntityForms";
import { SearchView } from "./views/SearchView";
import { RecordsView } from "./views/RecordsView";
import { DirectoryView } from "./views/DirectoryView";
import { KeysView } from "./views/KeysView";
import { DashboardView } from "./views/DashboardView";
import { KeyMapView } from "./views/KeyMapView";
import { LoginView } from "./views/LoginView";
import { PersonView } from "./views/PersonView";
import { KeyView } from "./views/KeyView";
import { ProfileView } from "./views/ProfileView";
import { SettingsView } from "./views/SettingsView";
import { GroupView } from "./views/GroupView";
import type { RowActions, SortCol, SortDir } from "./views/KeyTable";

type NavTab = "dashboard" | "directory" | "keys" | "map" | "returned";

/** Which dialog, if any, is open. */
type Dialog =
  | { type: "person"; person: Person | null }
  | { type: "key"; keyDef: KeyDef | null }
  | { type: "assignment"; assignment: Assignment | null; personId?: string; keyId?: string; defaultReturned?: boolean }
  | { type: "return" }
  | { type: "confirm"; title: string; message: string; confirmLabel?: string; run: () => Promise<void> };

/** A detail page pushed on top of the current tab. */
type Detail =
  | { type: "person"; id: string }
  | { type: "key"; id: string }
  | { type: "profile" }
  | { type: "settings" }
  | { type: "building"; name: string }
  | { type: "department"; name: string };

const EMPTY: Snapshot = { people: [], keys: [], assignments: [] };

export default function App() {
  const storeRef = useRef<DataStore | null>(null);
  if (!storeRef.current) storeRef.current = createStore();
  const store = storeRef.current;

  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ── auth (only relevant when Supabase is configured) ──
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseConfigured);
  const gated = supabaseConfigured && !session;

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setAuthReady(true); return; }
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => { await getSupabase()?.auth.signOut(); };

  /** Re-checks the current password before letting a full export proceed —
   *  returns an error message on failure, null on success. */
  const reauthorize = async (password: string): Promise<string | null> => {
    const sb = getSupabase();
    if (!sb || !session?.user?.email) return "Not signed in.";
    const { error } = await sb.auth.signInWithPassword({ email: session.user.email, password });
    return error ? error.message : null;
  };

  const [nav, setNav] = useState<NavTab>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const [keyActivity, setKeyActivity] = useState<KeyActivity[]>([]);
  const [sortCol, setSortCol] = useState<SortCol>("dateIssued");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState("");
  // Admin-only toggle, set from the Data page, that unlocks the Map page's
  // drag/resize position editor — not something the Map page decides alone.
  const [mapEditing, setMapEditing] = useState(false);
  /**
   * Detail-page navigation stack. Person and key pages link to each other, so a
   * stack lets Back retrace the actual path (person → key → person) instead of
   * always dumping you at the tab.
   */
  const [stack, setStack] = useState<Detail[]>([]);
  const current = stack[stack.length - 1] ?? null;

  const openDetail = (d: Detail) => setStack((s) => [...s, d]);
  const goBack = () => setStack((s) => s.slice(0, -1));
  const openPerson = (id: string) => openDetail({ type: "person", id });
  const openKey = (id: string) => openDetail({ type: "key", id });
  const openBuilding = (name: string) => openDetail({ type: "building", name });
  const openDepartment = (name: string) => openDetail({ type: "department", name });
  const openProfile = () => {
    setStack([{ type: "profile" }]);
    setProfileOpen(false);
    store.getRecentKeyActivity(session?.user?.email ?? "", 5)
      .then(setKeyActivity)
      .catch(() => setKeyActivity([]));
  };
  const openSettings = () => { setStack([{ type: "settings" }]); setProfileOpen(false); };

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await store.load());
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [store]);

  useEffect(() => {
    // Don't hit the store until the user is signed in (RLS would reject it).
    if (gated) { setLoading(false); return; }
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh, gated]);

  // Close the profile dropdown when clicking outside it.
  useEffect(() => {
    if (!profileOpen) return;
    const onDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [profileOpen]);

  // Two letters for the profile avatar: from the signed-in email's local
  // part, or "LS" (Local Storage) when there's no account at all.
  const profileInitials = session?.user?.email
    ? session.user.email.split("@")[0].slice(0, 2).toUpperCase()
    : "LS";

  const records = useMemo(() => toRecords(snapshot), [snapshot]);

  // Returned keys are kept out of the day-to-day views entirely; they only
  // appear on the Returned tab (and in Search, which still spans all history).
  const activeRecords = useMemo(() => records.filter((r) => r.isActive), [records]);
  const returnedRecords = useMemo(() => records.filter((r) => !r.isActive), [records]);

  // Existing building / department values, for the type-ahead fields.
  const distinct = (vals: (string | null)[]) =>
    [...new Set(vals.map((v) => (v ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const buildingOptions = useMemo(
    () => distinct([...snapshot.people.map((p) => p.building), ...snapshot.keys.map((k) => k.building)]),
    [snapshot],
  );
  const departmentOptions = useMemo(
    () => distinct([...snapshot.people.map((p) => p.department), ...snapshot.keys.map((k) => k.department)]),
    [snapshot],
  );

  // Resolved fresh each render so edits show immediately, and a deleted entity
  // resolves to null and falls through to the tab view rather than breaking.
  const currentPerson =
    current?.type === "person" ? snapshot.people.find((p) => p.id === current.id) ?? null : null;
  const currentKey =
    current?.type === "key" ? snapshot.keys.find((k) => k.id === current.id) ?? null : null;
  const currentBuilding = current?.type === "building" ? current.name : null;
  const currentDepartment = current?.type === "department" ? current.name : null;

  const detailRecords = useMemo(() => {
    if (currentPerson) return records.filter((r) => r.personId === currentPerson.id);
    if (currentKey) return records.filter((r) => r.keyId === currentKey.id);
    if (currentBuilding) return records.filter((r) => r.building === currentBuilding);
    if (currentDepartment) return records.filter((r) => r.department === currentDepartment);
    return [];
  }, [records, currentPerson, currentKey, currentBuilding, currentDepartment]);

  const TAB_LABEL: Record<NavTab, string> = {
    dashboard: "Dashboard", returned: "Returned",
    keys: "Catalog", directory: "Directory", map: "Map",
  };

  /** What Back returns to: the page beneath this one, or the tab if none. */
  const backLabel = (() => {
    const beneath = stack[stack.length - 2];
    if (!beneath) return searchQuery ? "search results" : TAB_LABEL[nav];
    if (beneath.type === "person") {
      return snapshot.people.find((p) => p.id === beneath.id)?.fullName ?? "previous";
    }
    if (beneath.type === "key") {
      return snapshot.keys.find((k) => k.id === beneath.id)?.keyStamp ?? "previous";
    }
    if (beneath.type === "building" || beneath.type === "department") return beneath.name;
    return "previous";
  })();

  const goToTab = (tab: NavTab) => {
    setStack([]);
    setSearchQuery("");
    setNav(tab);
  };

  const handleSort = (col: SortCol) => {
    setSortDir((d) => (col === sortCol ? (d === "asc" ? "desc" : "asc") : "asc"));
    setSortCol(col);
  };

  /** Run a full-text search and switch the main area to the results view. */
  const runSearch = (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    setSearchQuery(q);
    setStack([]);
  };

  const clearSearch = () => setSearchQuery("");

  // ── mutations ───────────────────────────────────────────────────────────────
  // Each wraps a store call and refreshes. Errors propagate to the dialog, which
  // shows them inline rather than closing and losing the user's input.

  const savePerson = async (input: NewPerson, existing: Person | null) => {
    if (existing) await store.updatePerson(existing.id, input);
    else await store.createPerson(input);
    await refresh();
    setToast(existing ? "Person updated." : `Added ${input.fullName}.`);
  };

  const saveKey = async (input: NewKeyDef, existing: KeyDef | null) => {
    if (existing) await store.updateKey(existing.id, input);
    else await store.createKey(input);
    await refresh();
    setToast(existing ? "Key updated." : `Added key ${input.keyStamp}.`);
  };

  const saveAssignment = async (input: AssignmentInput, existing: Assignment | null) => {
    // If creating a new person inline, create it first
    let personId = input.personId;
    if (input.personId === "new-person" && input.newPersonFirstName && input.newPersonLastName) {
      const fullName = `${input.newPersonFirstName} ${input.newPersonLastName}`;
      const newPerson = await store.createPerson({
        fullName,
        email: null,
        employeeId: null,
        department: input.newPersonDept || null,
        building: input.newPersonBldg || null,
      });
      personId = newPerson.id;
    }

    // If creating a new key inline, create it first
    let keyId = input.keyId;
    if (input.keyId === "new-key" && input.newKeyStamp) {
      const newKey = await store.createKey({
        keyStamp: input.newKeyStamp,
        roomNumber: null,
        roomDescription: input.newKeyRoom || null,
        building: null,
        department: null,
        notes: null,
      });
      keyId = newKey.id;
    }

    const assignmentInput: NewAssignment = {
      personId,
      keyId,
      dateIssued: input.dateIssued,
      dateReturned: input.dateReturned,
      numKeys: input.numKeys,
      notes: input.notes,
    };

    if (existing) await store.updateAssignment(existing.id, assignmentInput);
    else await store.createAssignment(assignmentInput);
    await refresh();
    setToast(existing ? "Assignment updated." : "Key issued.");

    // Returned so multi-entry callers (bulk PDF import) can reuse the
    // resolved ids instead of re-deriving "new-person"/"new-key" from a
    // snapshot that hasn't refreshed mid-loop yet.
    return { personId, keyId };
  };

  const returnKey = async (assignmentId: string, dateReturned: string) => {
    await store.updateAssignment(assignmentId, { dateReturned });
    await refresh();
    setToast("Key marked returned.");
  };

  const rowActions: RowActions = {
    onEdit: (r: KeyRecord) => {
      const assignment = snapshot.assignments.find((a) => a.id === r.assignmentId);
      if (assignment) setDialog({ type: "assignment", assignment });
    },
    onReturn: (r: KeyRecord) => {
      setDialog({
        type: "confirm",
        title: "Mark Key Returned",
        confirmLabel: "Mark Returned",
        message: `Record ${r.keyStamp}${r.roomNumber ? ` (Rm ${r.roomNumber})` : ""} as returned by ${r.personName} today, ${todayIso()}? You can adjust the date afterwards by editing the record.`,
        run: async () => {
          await store.updateAssignment(r.assignmentId, { dateReturned: todayIso() });
          await refresh();
          setToast(`${r.keyStamp} marked returned.`);
        },
      });
    },
    onDelete: (r: KeyRecord) => {
      setDialog({
        type: "confirm",
        title: "Delete Record",
        message: `Permanently delete the record of ${r.personName} holding ${r.keyStamp}? This removes the history of this checkout entirely. If the key was simply returned, mark it returned instead so the record is kept.`,
        run: async () => {
          await store.deleteAssignment(r.assignmentId);
          await refresh();
          setToast("Record deleted.");
        },
      });
    },
  };

  const confirmDeletePerson = (p: Person) => {
    const count = snapshot.assignments.filter((a) => a.personId === p.id).length;
    setDialog({
      type: "confirm",
      title: "Delete Person",
      message:
        count > 0
          ? `Delete ${p.fullName} and all ${count} key record${count === 1 ? "" : "s"} attached to them? The key history for this person will be gone. Consider exporting a backup first.`
          : `Delete ${p.fullName} from the directory?`,
      run: async () => {
        await store.deletePerson(p.id);
        await refresh();
        setToast(`${p.fullName} deleted.`);
      },
    });
  };

  const confirmDeleteKey = (k: KeyDef) => {
    const count = snapshot.assignments.filter((a) => a.keyId === k.id).length;
    setDialog({
      type: "confirm",
      title: "Delete Key",
      message:
        count > 0
          ? `Delete key ${k.keyStamp} and all ${count} assignment${count === 1 ? "" : "s"} of it? Everyone's history with this key will be gone.`
          : `Delete key ${k.keyStamp} from the catalog?`,
      run: async () => {
        await store.deleteKey(k.id);
        await refresh();
        setToast(`Key ${k.keyStamp} deleted.`);
      },
    });
  };

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={13} /> },
    { id: "directory", label: "Directory", icon: <Users size={13} /> },
    { id: "keys",      label: "Catalog",   icon: <KeyRound size={13} /> },
    { id: "map",       label: "Map",       icon: <MapIcon size={13} /> },
    { id: "returned",  label: "Returned",  icon: <Archive size={13} /> },
  ];

  // ── auth gate (Supabase mode only) ──
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: DSU.gray }}>
        <p className="text-[13px]" style={{ color: DSU.midGray }}>Loading…</p>
      </div>
    );
  }
  if (gated) return <LoginView />;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: DSU.gray, fontFamily: font.sans }}>

      {/* ── Top nav ── */}
      <header className="sticky top-0 z-40" style={{ background: appBarFill, boxShadow: shadow.lg }}>
        <div className="relative">
          <HexBg />
          <div className="relative w-full px-4 sm:px-6 min-h-[52px] flex items-center gap-3 flex-nowrap py-2">
            {/* Wordmark shrinks to just the mark on narrow screens so the
                search field keeps its space. Doubles as a home link. */}
            <button
              type="button"
              onClick={() => goToTab("dashboard")}
              aria-label="Go to dashboard"
              className="flex items-center gap-2 flex-shrink-0 rounded-md transition-opacity hover:opacity-90"
            >
              <div className="flex items-center justify-center w-7 h-7 overflow-hidden flex-shrink-0" style={{ background: "#fff", borderRadius: radius.sm, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
                <img src="/logo.png" alt="" className="w-full h-full object-cover" />
              </div>
              <span
                className="hidden sm:inline text-white text-[20px] leading-none font-semibold tracking-tight"
                style={{ fontFamily: font.display }}
              >
                Fipher Keys
              </span>
            </button>

            {/* Desktop tabs: centered in the space between wordmark and the
                search/action group. Hidden on small screens (hamburger instead). */}
            <nav className="hidden md:flex items-center flex-wrap justify-center flex-1">
              {navItems.map((item) => {
                const active = nav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => goToTab(item.id)}
                    aria-current={active && !current ? "page" : undefined}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md transition-all duration-150"
                    style={{
                      background: active ? "rgba(255,255,255,0.15)" : "transparent",
                      color: active ? "#ffffff" : "rgba(255,255,255,0.70)",
                      boxShadow: active ? `inset 0 -2px 0 ${DSU.trojan}` : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (active) return;
                      e.currentTarget.style.color = "#fff";
                      e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = active ? "#fff" : "rgba(255,255,255,0.70)";
                      e.currentTarget.style.background = active ? "rgba(255,255,255,0.15)" : "transparent";
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Profile — rightmost of the bar on every screen size. Replaces
                the old footer's sign-in/sign-out strip; the dropdown reuses
                the PersonView masthead language (eyebrow label, avatar,
                serif name row) so an account feels like "a person" too. */}
            <div ref={profileRef} className="relative flex-shrink-0 ml-auto md:ml-0">
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                aria-label="Account"
                aria-expanded={profileOpen}
                className="flex items-center justify-center rounded-full transition-opacity hover:opacity-90"
              >
                <Avatar initials={profileInitials} size={32} />
              </button>

              {profileOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-[300px] overflow-hidden z-50"
                  style={{ background: "#fff", borderRadius: radius.lg, boxShadow: shadow.xl }}
                >
                  <div className="p-4 flex items-start gap-3">
                    <Avatar initials={profileInitials} size={44} />
                    <div className="min-w-0">
                      <div
                        className="text-[10.5px] font-semibold uppercase mb-1"
                        style={{ color: DSU.trojan, letterSpacing: "0.14em" }}
                      >
                        {session?.user?.email ? "Signed In" : "Local Session"}
                      </div>
                      <div
                        className="text-[16px] font-semibold leading-tight truncate"
                        style={{ fontFamily: font.display, color: DSU.navy }}
                        title={session?.user?.email ?? undefined}
                      >
                        {session?.user?.email ?? "Local storage mode"}
                      </div>
                      {store.kind === "local" && (
                        <span
                          className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-px rounded-sm text-[11px] font-medium"
                          style={{ background: "#fff3d4", color: "#7a6318" }}
                          title="Data is stored in this browser only and is not shared or backed up."
                        >
                          <HardDrive size={10} /> Local storage
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t py-1.5" style={{ borderColor: DSU.lightBorder }}>
                    <button
                      onClick={openProfile}
                      className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-[13px] transition-colors hover:bg-[#f4f8fb]"
                      style={{ color: DSU.darkGray }}
                    >
                      <UserIcon size={14} style={{ color: DSU.midGray }} /> View Profile
                    </button>
                    <button
                      onClick={openSettings}
                      className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-[13px] transition-colors hover:bg-[#f4f8fb]"
                      style={{ color: DSU.darkGray }}
                    >
                      <Settings2 size={14} style={{ color: DSU.midGray }} /> Settings
                    </button>
                  </div>

                  {session?.user?.email && (
                    <div className="px-4 pt-2 pb-4 border-t" style={{ borderColor: DSU.lightBorder }}>
                      <Button
                        onClick={() => { signOut(); setProfileOpen(false); }}
                        className="w-full justify-center"
                      >
                        <LogOut size={12} /> Sign out
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hamburger — mobile only, toggles the tab menu. Each page now
                carries its own prominent search (Directory/Catalog/Returned/
                Dashboard/Map), so the header no longer needs one. */}
            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={mobileNavOpen}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-md transition-colors flex-shrink-0 ml-2"
              style={{ color: "#fff", background: mobileNavOpen ? "rgba(255,255,255,0.18)" : "transparent" }}
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          {/* Mobile tab menu — drops down below the bar on small screens. */}
          {mobileNavOpen && (
            <nav className="md:hidden relative border-t" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
              {navItems.map((item) => {
                const active = nav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { goToTab(item.id); setMobileNavOpen(false); }}
                    aria-current={active && !current ? "page" : undefined}
                    className="flex items-center gap-2 w-full px-5 py-3 text-[14px] font-medium transition-colors"
                    style={{
                      background: active ? "rgba(255,255,255,0.15)" : "transparent",
                      color: active ? "#ffffff" : "rgba(255,255,255,0.75)",
                      borderLeft: active ? `3px solid ${DSU.trojan}` : "3px solid transparent",
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
              {/* Key actions live at the bottom of the mobile menu. */}
              <div className="px-4 py-3 border-t flex gap-2" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
                <Button
                  variant="primary"
                  onClick={() => { setDialog({ type: "assignment", assignment: null }); setMobileNavOpen(false); }}
                  className="flex-1 justify-center !py-2"
                >
                  <Plus size={14} /> Issue Key
                </Button>
                <Button
                  variant="dangerSolid"
                  onClick={() => { setDialog({ type: "return" }); setMobileNavOpen(false); }}
                  className="flex-1 justify-center !py-2"
                >
                  <ArrowLeft size={14} /> Return Key
                </Button>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="w-full px-4 sm:px-6 py-5 flex-1">
        {loadError && <ErrorNote message={`Could not load data: ${loadError}`} />}

        {loading ? (
          <div className="dsu-fade-in" aria-busy="true" aria-label="Loading records">
            {/* Mirrors the dashboard masthead's shape so the load doesn't jump. */}
            <div
              className="relative mb-12 -mx-4 sm:-mx-6 -mt-5 px-4 sm:px-8 lg:px-12 pt-8 pb-14"
              style={{ background: "#ffffff", boxShadow: shadow.md, borderTop: `2px solid ${DSU.trojan}` }}
            >
              <SkeletonBar width={140} height={11} radius={3} />
              <div className="mt-3"><SkeletonBar width={220} height={56} radius={8} /></div>
              <div className="mt-3"><SkeletonBar width={300} height={13} /></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 dsu-stagger">
              {[0, 1].map((i) => (
                <div key={i} className="bg-white overflow-hidden p-4" style={{ boxShadow: shadow.md, borderRadius: radius.lg }}>
                  <SkeletonBar width={130} height={12} radius={3} />
                  <div className="mt-4 flex flex-col gap-2.5">
                    {[0, 1, 2, 3].map((j) => <SkeletonBar key={j} height={30} radius={4} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : currentPerson ? (
          <PersonView
            person={currentPerson}
            records={detailRecords}
            actions={rowActions}
            onBack={goBack}
            backLabel={backLabel}
            onEdit={() => setDialog({ type: "person", person: currentPerson })}
            onDelete={() => confirmDeletePerson(currentPerson)}
            onIssue={() => setDialog({ type: "assignment", assignment: null, personId: currentPerson.id })}
            onSelectKey={openKey}
            onSelectBuilding={openBuilding}
          />
        ) : currentKey ? (
          <KeyView
            keyDef={currentKey}
            records={detailRecords}
            actions={rowActions}
            onBack={goBack}
            backLabel={backLabel}
            onEdit={() => setDialog({ type: "key", keyDef: currentKey })}
            onDelete={() => confirmDeleteKey(currentKey)}
            onIssue={() => setDialog({ type: "assignment", assignment: null, keyId: currentKey.id })}
            onSelectPerson={openPerson}
            onSelectBuilding={openBuilding}
            onSelectDepartment={openDepartment}
          />
        ) : currentBuilding ? (
          <GroupView
            kind="building"
            name={currentBuilding}
            records={detailRecords}
            actions={rowActions}
            onBack={goBack}
            backLabel={backLabel}
            onSelectPerson={openPerson}
            onSelectKey={openKey}
          />
        ) : currentDepartment ? (
          <GroupView
            kind="department"
            name={currentDepartment}
            records={detailRecords}
            actions={rowActions}
            onBack={goBack}
            backLabel={backLabel}
            onSelectPerson={openPerson}
            onSelectKey={openKey}
          />
        ) : current?.type === "profile" ? (
          <ProfileView
            email={session?.user?.email ?? null}
            storeKind={store.kind}
            createdAt={session?.user?.created_at ?? null}
            snapshot={snapshot}
            onBack={goBack}
            backLabel={backLabel}
            onSignOut={signOut}
            onOpenSettings={openSettings}
            keyActivity={keyActivity}
            onSelectKey={openKey}
          />
        ) : current?.type === "settings" ? (
          <SettingsView
            storeKind={store.kind}
            mapEditing={mapEditing}
            onToggleMapEditing={() => setMapEditing((v) => !v)}
            onBack={goBack}
            backLabel={backLabel}
            store={store}
            snapshot={snapshot}
            onImported={refresh}
            onToast={setToast}
            requireReauth={store.kind === "supabase"}
            onReauthorize={reauthorize}
          />
        ) : searchQuery ? (
          /* Results overlay whichever tab you were on; clearing returns to it. */
          <>
            <button
              onClick={clearSearch}
              className="inline-flex items-center gap-1.5 text-[12px] mb-3 transition-colors hover:underline"
              style={{ color: DSU.trojan }}
            >
              <ArrowLeft size={13} /> Back to {TAB_LABEL[nav]}
            </button>
            <SearchView
              query={searchQuery}
              records={records}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={handleSort}
              actions={rowActions}
              onSelectPerson={openPerson}
              onSelectKey={openKey}
              onSelectBuilding={openBuilding}
              onSelectDepartment={openDepartment}
            />
          </>
        ) : (
          /* key={nav} restarts the fade whenever the tab changes */
          <div key={nav} className="dsu-view">
            {nav === "returned" && (
              <RecordsView
                title="Returned Keys"
                records={returnedRecords}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={handleSort}
                actions={rowActions}
                onSelectPerson={openPerson}
                onSelectKey={openKey}
                onSelectBuilding={openBuilding}
                onSelectDepartment={openDepartment}
                onAddReturned={() => setDialog({ type: "assignment", assignment: null, defaultReturned: true })}
                emptyMessage="No keys have been returned yet."
              />
            )}

            {nav === "keys" && (
              <KeysView
                keys={snapshot.keys}
                records={records}
                onAdd={() => setDialog({ type: "key", keyDef: null })}
                onEdit={(k) => setDialog({ type: "key", keyDef: k })}
                onDelete={confirmDeleteKey}
                onSelectKey={openKey}
                onSelectBuilding={openBuilding}
                onSelectDepartment={openDepartment}
              />
            )}

            {nav === "directory" && (
              <DirectoryView
                people={snapshot.people}
                records={activeRecords}
                actions={rowActions}
                onAddPerson={() => setDialog({ type: "person", person: null })}
                onEditPerson={(p) => setDialog({ type: "person", person: p })}
                onDeletePerson={confirmDeletePerson}
                onSelectPerson={openPerson}
                onSelectKey={openKey}
                onSelectBuilding={openBuilding}
                onSelectDepartment={openDepartment}
              />
            )}

            {nav === "dashboard" && (
              <DashboardView
                snapshot={snapshot}
                records={records}
                onSelectPerson={openPerson}
                onSelectKey={openKey}
                onGoToTab={goToTab}
                onOpenData={openSettings}
                onSearch={runSearch}
                onIssue={() => setDialog({ type: "assignment", assignment: null })}
                onReturnKeys={() => setDialog({ type: "return" })}
              />
            )}

            {nav === "map" && (
              <KeyMapView
                records={activeRecords}
                onSelectKey={openKey}
                onSelectPerson={openPerson}
                onSelectBuilding={openBuilding}
                store={store}
                editing={mapEditing}
              />
            )}
          </div>
        )}
      </main>

      {/* ── Dialogs ── */}
      {dialog?.type === "person" && (
        <PersonDialog
          person={dialog.person}
          onSave={(input) => savePerson(input, dialog.person)}
          onClose={() => setDialog(null)}
          buildings={buildingOptions}
          departments={departmentOptions}
        />
      )}

      {dialog?.type === "key" && (
        <KeyDialog
          keyDef={dialog.keyDef}
          onSave={(input) => saveKey(input, dialog.keyDef)}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === "assignment" && (
        <AssignmentDialog
          assignment={dialog.assignment}
          snapshot={snapshot}
          defaultPersonId={dialog.personId}
          defaultKeyId={dialog.keyId}
          defaultReturned={dialog.defaultReturned}
          onSave={(input) => saveAssignment(input, dialog.assignment)}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === "return" && (
        <ReturnDialog
          records={activeRecords}
          onReturn={returnKey}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.type === "confirm" && (
        <ConfirmDialog
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          onConfirm={dialog.run}
          onClose={() => setDialog(null)}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}
