import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Key, X, Users, Database, KeyRound, Archive, Plus, ArrowLeft, LayoutDashboard, Menu,
} from "lucide-react";

import type {
  Assignment, DataStore, KeyDef, KeyRecord, NewAssignment, NewKeyDef, NewPerson, Person, Snapshot,
} from "../lib/types";
import { toRecords } from "../lib/types";
import { createStore } from "../lib/stores";
import { DSU, appBarFill, font, radius, shadow, todayIso } from "./theme";
import { Button, HexBg, HexEmptyIcon, Toast, ErrorNote } from "./components/primitives";
import { AssignmentDialog, AssignmentInput, ConfirmDialog, KeyDialog, PersonDialog, ReturnDialog } from "./components/EntityForms";
import { SearchView } from "./views/SearchView";
import { RecordsView } from "./views/RecordsView";
import { DirectoryView } from "./views/DirectoryView";
import { KeysView } from "./views/KeysView";
import { DashboardView } from "./views/DashboardView";
import { DataView } from "./views/DataView";
import { PersonView } from "./views/PersonView";
import { KeyView } from "./views/KeyView";
import type { RowActions, SortCol, SortDir } from "./views/KeyTable";

type NavTab = "dashboard" | "returned" | "keys" | "directory" | "data";

/** Which dialog, if any, is open. */
type Dialog =
  | { type: "person"; person: Person | null }
  | { type: "key"; keyDef: KeyDef | null }
  | { type: "assignment"; assignment: Assignment | null; personId?: string; keyId?: string }
  | { type: "return" }
  | { type: "confirm"; title: string; message: string; confirmLabel?: string; run: () => Promise<void> };

/** A detail page pushed on top of the current tab. */
type Detail = { type: "person"; id: string } | { type: "key"; id: string };

const EMPTY: Snapshot = { people: [], keys: [], assignments: [] };

export default function App() {
  const storeRef = useRef<DataStore | null>(null);
  if (!storeRef.current) storeRef.current = createStore();
  const store = storeRef.current;

  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [nav, setNav] = useState<NavTab>("dashboard");
  const [inputVal, setInputVal] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const searchWrapRef = useRef<HTMLFormElement | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>("dateIssued");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState("");
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

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await store.load());
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, [store]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Close the search dropdown when clicking outside the search field.
  useEffect(() => {
    if (!searchFocused) return;
    const onDown = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchFocused]);

  const records = useMemo(() => toRecords(snapshot), [snapshot]);

  // Returned keys are kept out of the day-to-day views entirely; they only
  // appear on the Returned tab (and in Search, which still spans all history).
  const activeRecords = useMemo(() => records.filter((r) => r.isActive), [records]);
  const returnedRecords = useMemo(() => records.filter((r) => !r.isActive), [records]);

  // Resolved fresh each render so edits show immediately, and a deleted entity
  // resolves to null and falls through to the tab view rather than breaking.
  const currentPerson =
    current?.type === "person" ? snapshot.people.find((p) => p.id === current.id) ?? null : null;
  const currentKey =
    current?.type === "key" ? snapshot.keys.find((k) => k.id === current.id) ?? null : null;

  const detailRecords = useMemo(() => {
    if (currentPerson) return records.filter((r) => r.personId === currentPerson.id);
    if (currentKey) return records.filter((r) => r.keyId === currentKey.id);
    return [];
  }, [records, currentPerson, currentKey]);

  const TAB_LABEL: Record<NavTab, string> = {
    dashboard: "Dashboard", returned: "Returned",
    keys: "Catalog", directory: "Directory", data: "Data",
  };

  /** What Back returns to: the page beneath this one, or the tab if none. */
  const backLabel = (() => {
    const beneath = stack[stack.length - 2];
    if (!beneath) return searchQuery ? "search results" : TAB_LABEL[nav];
    if (beneath.type === "person") {
      return snapshot.people.find((p) => p.id === beneath.id)?.fullName ?? "previous";
    }
    return snapshot.keys.find((k) => k.id === beneath.id)?.keyStamp ?? "previous";
  })();

  const goToTab = (tab: NavTab) => {
    setStack([]);
    setSearchQuery("");
    setInputVal("");
    setNav(tab);
  };

  const handleSort = (col: SortCol) => {
    setSortDir((d) => (col === sortCol ? (d === "asc" ? "desc" : "asc") : "asc"));
    setSortCol(col);
  };

  const getSearchMatches = () => {
    const q = inputVal.trim().toLowerCase();
    if (!q) return { people: [], keys: [] };
    const people = snapshot.people
      .filter((p) => p.fullName.toLowerCase().includes(q))
      .slice(0, 5);
    const keys = snapshot.keys
      .filter((k) => (k.keyStamp + (k.roomDescription ?? "")).toLowerCase().includes(q))
      .slice(0, 5);
    return { people, keys };
  };

  /** Run a full-text search and switch the main area to the results view. */
  const runSearch = (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    setInputVal(q);
    setSearchQuery(q);
    setStack([]);
    setSearchFocused(false);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(inputVal);
  };

  const clearSearch = () => { setInputVal(""); setSearchQuery(""); };

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
    { id: "returned",  label: "Returned",  icon: <Archive size={13} /> },
    { id: "data",      label: "Data",      icon: <Database size={13} /> },
  ];

  // On the dashboard landing the search lives in the page body (a large,
  // centred field), so the compact header search is hidden there to avoid two.
  const onDashboardHome = nav === "dashboard" && !current && !searchQuery;

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
              <div className="flex items-center justify-center w-7 h-7" style={{ background: DSU.trojan, borderRadius: radius.sm, boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
                <Key size={14} color="white" />
              </div>
              <span
                className="hidden sm:inline text-white text-[20px] leading-none font-semibold tracking-tight"
                style={{ fontFamily: font.display }}
              >
                Facilities Key Management
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

            {/* Search — fills the middle on mobile, right-aligned on desktop
                (the desktop nav's flex-1 pushes it over). Hidden on the
                dashboard home, which carries its own large search field. */}
            {!onDashboardHome && (
            <form
              ref={searchWrapRef}
              onSubmit={submitSearch}
              className="relative flex-1 md:flex-none md:w-[190px] lg:w-[260px] md:ml-auto"
            >
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "#8a8d92" }}
              />
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                placeholder="Search name or key stamp…"
                aria-label="Search records"
                className="w-full pl-8 pr-8 py-1.5 text-[13px] rounded-md border outline-none transition-all duration-150 focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,169,224,0.28)]"
                style={{
                  background: "rgba(255,255,255,0.94)",
                  borderColor: "rgba(255,255,255,0.25)",
                  color: DSU.darkGray,
                }}
              />
              {inputVal && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: "#9a9c9f" }}
                >
                  <X size={13} />
                </button>
              )}
              {/* Search dropdown — anchored to the field so it never drifts. */}
              {searchFocused && inputVal.trim() && (() => {
                const matches = getSearchMatches();
                const hasResults = matches.people.length > 0 || matches.keys.length > 0;
                return (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 rounded-md border bg-white shadow-lg overflow-y-auto"
                    style={{ borderColor: DSU.lightBorder, zIndex: 60, maxHeight: "320px" }}
                  >
                    {matches.people.length > 0 && (
                      <div>
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: DSU.midGray, background: "#f5f6f7" }}>People</div>
                        {matches.people.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setInputVal(""); setSearchFocused(false); setStack([{ type: "person", id: p.id }]); }}
                            className="w-full text-left px-3 py-2 text-[12px] hover:bg-blue-50 border-b"
                            style={{ borderColor: DSU.lightBorder }}
                          >
                            <div className="font-medium">{p.fullName}</div>
                            {p.department && <div style={{ fontSize: "11px", color: DSU.midGray }}>{p.department}</div>}
                          </button>
                        ))}
                      </div>
                    )}
                    {matches.keys.length > 0 && (
                      <div>
                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: DSU.midGray, background: "#f5f6f7" }}>Keys</div>
                        {matches.keys.map((k) => (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => { setInputVal(""); setSearchFocused(false); setStack([{ type: "key", id: k.id }]); }}
                            className="w-full text-left px-3 py-2 text-[12px] hover:bg-blue-50 border-b last:border-0"
                            style={{ borderColor: DSU.lightBorder }}
                          >
                            <div className="font-medium">{k.keyStamp}</div>
                            {k.roomDescription && <div style={{ fontSize: "11px", color: DSU.midGray }}>{k.roomDescription}</div>}
                          </button>
                        ))}
                      </div>
                    )}
                    {!hasResults && (
                      <div className="px-3 py-3 text-[12px]" style={{ color: DSU.midGray }}>
                        No matches for “{inputVal.trim()}”.
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* Submitting is Enter; a visible button would crowd the bar. */}
              <button type="submit" className="sr-only">Search</button>
            </form>
            )}

            {/* Hamburger — mobile only, far right, toggles the tab menu. */}
            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={mobileNavOpen}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-md transition-colors flex-shrink-0 ml-auto"
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
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <HexEmptyIcon />
            <p className="text-[13px]" style={{ color: DSU.midGray }}>Loading records…</p>
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
              />
            )}

            {nav === "dashboard" && (
              <DashboardView
                snapshot={snapshot}
                records={records}
                onSelectPerson={openPerson}
                onSelectKey={openKey}
                onGoToTab={goToTab}
                onSearch={runSearch}
                onIssue={() => setDialog({ type: "assignment", assignment: null })}
                onReturnKeys={() => setDialog({ type: "return" })}
              />
            )}

            {nav === "data" && (
              <DataView
                store={store}
                snapshot={snapshot}
                onImported={refresh}
                onToast={setToast}
              />
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${DSU.lightBorder}`, background: "rgba(255,255,255,0.75)" }}>
        <div
          className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between text-[11px] gap-3 flex-wrap"
          style={{ color: "#9a9c9f" }}
        >
          <span>Facilities Key Management System — Dakota State University</span>
          <span className="flex items-center gap-1.5">
            {store.kind === "local" && (
              <span
                className="px-1.5 py-px rounded-sm font-medium"
                style={{ background: "#fff3d4", color: "#7a6318" }}
                title="Data is stored in this browser only and is not shared or backed up."
              >
                Local storage
              </span>
            )}
            Dakota State University · Madison, SD
          </span>
        </div>
      </footer>

      {/* ── Dialogs ── */}
      {dialog?.type === "person" && (
        <PersonDialog
          person={dialog.person}
          onSave={(input) => savePerson(input, dialog.person)}
          onClose={() => setDialog(null)}
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
