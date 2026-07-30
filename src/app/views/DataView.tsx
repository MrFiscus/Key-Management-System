import { useRef, useState } from "react";
import {
  Download, Upload, AlertTriangle, Database, HardDrive, FileSpreadsheet, CheckCircle2, Lock, GitMerge, RefreshCw,
  ChevronDown, Users, KeyRound,
} from "lucide-react";
import type { DataStore, Snapshot } from "../../lib/types";
import { buildWorkbook, downloadWorkbook, mergeSnapshots, parseWorkbook, type ImportReport } from "../../lib/excel";
import { DSU, font, radius, shadow } from "../theme";
import { Button, ErrorNote, Field, HexWatermark, Modal, TextInput } from "../components/primitives";

/**
 * Data stewardship hub: the one place records leave this browser (export) or
 * arrive from a legacy departmental spreadsheet (import). The masthead states
 * what's actually at stake — how much is on record, and where it lives — since
 * that's what should shape whether someone bothers to back up today.
 */
export function DataView({
  store, snapshot, onImported, onToast, hideMasthead = false, requireReauth = false, onReauthorize,
}: {
  store: DataStore;
  snapshot: Snapshot;
  onImported: () => Promise<void>;
  onToast: (msg: string) => void;
  /** Skip the "Data & Backups" hero banner — used when this is folded into
   *  Settings, which already states storage mode in its own summary row. */
  hideMasthead?: boolean;
  /** Export holds every record in the system — gate it behind a password
   *  re-check so a walked-away, still-logged-in session can't be used to
   *  walk off with the whole roster. */
  requireReauth?: boolean;
  onReauthorize?: (password: string) => Promise<string | null>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ snapshot: Snapshot; report: ImportReport; name: string } | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [tabsHover, setTabsHover] = useState(false);
  const [showReauth, setShowReauth] = useState(false);

  const exportNow = async () => {
    setBusy(true);
    setError("");
    try {
      const blob = await buildWorkbook(snapshot);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadWorkbook(blob, `DSU-Key-Records-${stamp}.xlsx`);
      onToast("Exported to your Downloads folder.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleExportClick = () => {
    if (requireReauth && onReauthorize) setShowReauth(true);
    else exportNow();
  };

  const pickFile = async (file: File | undefined | null) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const { snapshot: parsed, report } = await parseWorkbook(file);
      // Nothing is written yet — the user confirms after seeing the report.
      setPending({ snapshot: parsed, report, name: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    const finalSnapshot = importMode === "merge" ? mergeSnapshots(snapshot, pending.snapshot) : pending.snapshot;
    await store.replaceAll(finalSnapshot);
    await onImported();
    onToast(
      importMode === "merge"
        ? `Merged in ${pending.report.assignments} records, ${pending.report.people} people, ${pending.report.keys} keys.`
        : `Imported ${pending.report.assignments} records, ${pending.report.people} people, ${pending.report.keys} keys.`,
    );
    setPending(null);
  };

  const isLocal = store.kind === "local";

  return (
    <div>
      {/* ── Masthead ── same treatment as the dashboard: one white surface, a
          headline figure, and the storage badge as the supporting fact —
          not a separate callout box floating underneath it. */}
      {!hideMasthead && (
        <div
          className="relative mb-8 -mx-4 sm:-mx-6 -mt-5"
          style={{ background: "#ffffff", boxShadow: shadow.md, borderTop: `2px solid ${DSU.trojan}` }}
        >
          <HexWatermark />
          <div className="relative px-4 sm:px-8 lg:px-12 pt-8 pb-9">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <div
                  className="text-[11px] font-semibold uppercase mb-1.5"
                  style={{ color: DSU.trojan, letterSpacing: "0.14em" }}
                >
                  Data &amp; Backups
                </div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span
                    className="leading-none tabular"
                    style={{ fontFamily: font.display, fontSize: "clamp(40px, 6vw, 60px)", fontWeight: 600, color: DSU.navy }}
                  >
                    {snapshot.assignments.length.toLocaleString()}
                  </span>
                  <span className="text-[15px]" style={{ color: DSU.darkGray }}>
                    key record{snapshot.assignments.length === 1 ? "" : "s"} on file, across{" "}
                    {snapshot.people.length.toLocaleString()} people and {snapshot.keys.length.toLocaleString()} keys
                  </span>
                </div>
                <p className="text-[13px] mt-2.5 max-w-[540px] leading-relaxed" style={{ color: DSU.midGray }}>
                  {isLocal ? (
                    <>
                      Everything above lives in this browser, on this computer, only — nobody else can see it, and
                      clearing your browsing data erases it. <strong style={{ color: "#7a6318" }}>Export to Excel
                      regularly</strong>; that file is your only backup until Supabase is connected.
                    </>
                  ) : (
                    <>Everything above is saved to the shared database and visible to everyone with access.</>
                  )}
                </p>
              </div>

              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold self-start lg:self-auto"
                style={
                  isLocal
                    ? { background: "#fff3d4", color: "#7a6318", border: "1px solid #ecd699" }
                    : { background: DSU.tintBg, color: DSU.tintText, border: `1px solid ${DSU.tintBorder}` }
                }
              >
                {isLocal ? <HardDrive size={13} /> : <Database size={13} />}
                {store.label}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <ErrorNote message={error} />}

      <h2 className="text-[26px] font-semibold mb-5" style={{ fontFamily: font.display, color: DSU.navy }}>
        Backup &amp; Restore
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── Export ── */}
        <div
          className="bg-white border rounded p-4 flex flex-col gap-3"
          style={{ borderColor: DSU.lightBorder, boxShadow: shadow.sm, borderRadius: radius.lg }}
          onMouseEnter={() => setTabsHover(true)}
          onMouseLeave={() => setTabsHover(false)}
        >
          <div className="flex items-center gap-2">
            <Download size={16} style={{ color: DSU.trojan }} />
            <h3 className="text-[13px] font-semibold" style={{ color: DSU.navy }}>Export to Excel</h3>
          </div>

          <WorkbookTabs flat={tabsHover} />

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="primary" onClick={handleExportClick} disabled={busy}>
              {requireReauth && <Lock size={12} />} <Download size={12} /> {busy ? "Working…" : "Export Excel"}
            </Button>
          </div>
          <div className="text-[11px] flex items-center gap-1" style={{ color: DSU.midGray }}>
            {snapshot.assignments.length.toLocaleString()} records · {snapshot.people.length.toLocaleString()} people ·{" "}
            {snapshot.keys.length.toLocaleString()} keys
          </div>
        </div>

        {/* ── Import ── */}
        <div
          className="bg-white border rounded p-4 flex flex-col gap-3"
          style={{ borderColor: DSU.lightBorder, boxShadow: shadow.sm, borderRadius: radius.lg }}
        >
          <div className="flex items-center gap-2">
            <Upload size={16} style={{ color: DSU.trojan }} />
            <h3 className="text-[13px] font-semibold" style={{ color: DSU.navy }}>Import from Excel</h3>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            className="flex-1 flex flex-col items-center justify-center gap-2 py-5 px-3 text-center rounded-md border border-dashed transition-colors"
            style={{
              borderColor: dragOver ? DSU.trojan : "#d3d8dc",
              background: dragOver ? "#eef8fd" : "#fafbfc",
            }}
          >
            <FileSpreadsheet size={20} style={{ color: dragOver ? DSU.trojan : "#aeb3b8" }} />
            <span className="text-[11px]" style={{ color: DSU.midGray }}>Drag a workbook here, or</span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={busy}>
              <FileSpreadsheet size={12} /> {busy ? "Reading…" : "Choose .xlsx file"}
            </Button>
          </div>

          <div className="text-[11px] flex items-center gap-1" style={{ color: "#9a7d1f" }}>
            <AlertTriangle size={11} /> Can replace or merge with current records.
          </div>
        </div>
      </div>

      {pending && (
        <ImportPreview
          name={pending.name}
          report={pending.report}
          existing={snapshot.assignments.length}
          mode={importMode}
          onModeChange={setImportMode}
          onConfirm={confirmImport}
          onClose={() => setPending(null)}
        />
      )}

      {showReauth && onReauthorize && (
        <ReauthModal
          onReauthorize={onReauthorize}
          onConfirmed={() => { setShowReauth(false); exportNow(); }}
          onClose={() => setShowReauth(false)}
        />
      )}
    </div>
  );
}

/**
 * Signature visual for the export card: three fanned "sheet tabs," one per
 * sheet the workbook actually contains (src/lib/excel.ts's buildWorkbook),
 * in the same order they appear along the bottom of the real file. Riffles
 * flat while the card is hovered — the one animated flourish on this page.
 */
function WorkbookTabs({ flat }: { flat: boolean }) {
  const sheets: { label: string; bg: string; border: string; rot: number }[] = [
    { label: "Keys", bg: "#eef2f5", border: "#dde3e8", rot: -7 },
    { label: "People", bg: "#dcecf6", border: "#b9dcef", rot: -2.5 },
    { label: "Key Records", bg: "#ffffff", border: DSU.trojan, rot: 3 },
  ];
  return (
    <div className="relative h-[58px] my-1" aria-hidden="true">
      {sheets.map((s, i) => (
        <div
          key={s.label}
          className="absolute left-1/2 top-1/2 flex items-end justify-center pb-1.5 rounded-md border text-[10px] font-semibold whitespace-nowrap"
          style={{
            width: 128,
            height: 50,
            marginLeft: -64,
            marginTop: -25,
            background: s.bg,
            borderColor: s.border,
            color: DSU.navy,
            zIndex: i,
            boxShadow: shadow.sm,
            transform: flat ? "rotate(0deg) translateX(0px)" : `rotate(${s.rot}deg) translateX(${i * 2}px)`,
            transition: "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {s.label}
        </div>
      ))}
    </div>
  );
}

/** Shows what the parser found and requires explicit confirmation to overwrite. */
function ImportPreview({
  name, report, existing, mode, onModeChange, onConfirm, onClose,
}: {
  name: string;
  report: ImportReport;
  existing: number;
  mode: "merge" | "replace";
  onModeChange: (mode: "merge" | "replace") => void;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Review Import"
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={mode === "replace" ? "danger" : "primary"} onClick={run} disabled={busy}>
            {busy
              ? "Importing…"
              : mode === "replace"
                ? `Delete existing data & replace with ${report.assignments} records`
                : `Merge ${report.assignments} records into current data`}
          </Button>
        </>
      }
    >
      {error && <ErrorNote message={error} />}

      <p className="text-[13px] mb-3 flex items-center gap-1.5" style={{ color: DSU.darkGray }}>
        <CheckCircle2 size={14} style={{ color: DSU.trojan }} />
        Read <strong>{name}</strong>.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-4 p-3 rounded-xl" style={{ background: DSU.gray }}>
        <Stat label="Records" value={report.assignments} icon={<FileSpreadsheet size={14} />} badgeBg={DSU.navy} />
        <Stat label="People" value={report.people} icon={<Users size={14} />} badgeBg={DSU.trojan} />
        <Stat label="Keys" value={report.keys} icon={<KeyRound size={14} />} badgeBg={DSU.navy} />
      </div>

      {/* ── Mode picker ── the two ways this import can land, chosen before
          the warning below so the warning can react to what's selected. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <button
          type="button"
          onClick={() => onModeChange("merge")}
          className="text-left p-3 rounded-lg border-2 transition-colors"
          style={{
            borderColor: mode === "merge" ? DSU.trojan : DSU.lightBorder,
            background: mode === "merge" ? "#eaf6fc" : "#fff",
          }}
        >
          <div className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: DSU.navy }}>
            <GitMerge size={14} style={{ color: DSU.trojan }} /> Merge with current data
          </div>
          <p className="text-[11.5px] mt-1 leading-relaxed" style={{ color: DSU.darkGray }}>
            Nothing existing is deleted. Matching people/keys (by name or stamp) are reused; everything else is added.
          </p>
        </button>
        <button
          type="button"
          onClick={() => onModeChange("replace")}
          className="text-left p-3 rounded-lg border-2 transition-colors"
          style={{
            borderColor: mode === "replace" ? DSU.danger : DSU.lightBorder,
            background: mode === "replace" ? "#fdeceb" : "#fff",
          }}
        >
          <div className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: DSU.navy }}>
            <RefreshCw size={14} style={{ color: DSU.danger }} /> Replace all data
          </div>
          <p className="text-[11.5px] mt-1 leading-relaxed" style={{ color: DSU.darkGray }}>
            Deletes every record currently stored and starts fresh with only what's in this file.
          </p>
        </button>
      </div>

      {mode === "replace" && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-lg mb-4"
          style={{ background: "#fdeceb", border: `1.5px solid ${DSU.danger}` }}
        >
          <AlertTriangle size={20} style={{ flexShrink: 0, color: DSU.danger }} />
          <div>
            <div className="text-[13.5px] font-bold" style={{ color: DSU.danger }}>
              Deletes all {existing} existing record{existing === 1 ? "" : "s"} — cannot be undone
            </div>
            <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "#7a2620" }}>
              Export a backup first if you're not sure, or choose Merge instead.
            </p>
          </div>
        </div>
      )}

      <Detail title={`${report.sheetsRead.length} sheets read`} defaultOpen>
        {report.perSheet.length === 0 ? (
          "none"
        ) : (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {report.perSheet.map((s) => (
              <span
                key={s.name}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] transition-colors"
                style={{ background: "#eef2f5", border: "1px solid #dde3e8", color: DSU.darkGray }}
              >
                {s.name}
                <span className="font-semibold" style={{ color: DSU.navy }}>{s.rows}</span>
              </span>
            ))}
          </div>
        )}
      </Detail>

      {(report.sheetsSkipped.length > 0
        || report.placeholderReturnDates > 0
        || report.placeholderPersonNames > 0
        || report.droppedBadReturnDates > 0
        || report.rowsSkipped.length > 0) && (
        <Detail title="A few things were cleaned up along the way" warn>
          <ul className="list-disc pl-4 space-y-1">
            {report.sheetsSkipped.map((s) => (
              <li key={s.name}><strong>{s.name}</strong> sheet skipped — {s.reason}</li>
            ))}
            {report.placeholderReturnDates > 0 && (
              <li>{report.placeholderReturnDates} returned key{report.placeholderReturnDates === 1 ? "" : "s"} had no return date on file — dated to today.</li>
            )}
            {report.placeholderPersonNames > 0 && (
              <li>{report.placeholderPersonNames} row{report.placeholderPersonNames === 1 ? "" : "s"} had no person name — given a placeholder name to keep the record.</li>
            )}
            {report.droppedBadReturnDates > 0 && (
              <li>{report.droppedBadReturnDates} return date{report.droppedBadReturnDates === 1 ? "" : "s"} came before the issue date — cleared, left as still out.</li>
            )}
            {report.rowsSkipped.map((r, i) => (
              <li key={i}>{r.reason}</li>
            ))}
          </ul>
        </Detail>
      )}

      {report.unmappedHeaders.length > 0 && (
        <Detail title={`${report.unmappedHeaders.length} columns not recognized`}>
          <span style={{ color: DSU.midGray }}>
            Ignored: {report.unmappedHeaders.join(", ")}. Tell me the heading if one of these holds data you need.
          </span>
        </Detail>
      )}
    </Modal>
  );
}

/**
 * Password re-check gating export. Exporting hands over every person's name,
 * building, and every key's location in one file — a real risk if a signed-in
 * device is left unattended — so it asks for the password again right before
 * the download, rather than trusting whoever is currently at the keyboard.
 */
function ReauthModal({
  onReauthorize, onConfirmed, onClose,
}: {
  onReauthorize: (password: string) => Promise<string | null>;
  onConfirmed: () => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const result = await onReauthorize(password);
    if (result) {
      setError(result);
      setBusy(false);
    } else {
      onConfirmed();
    }
  };

  return (
    <Modal
      title="Confirm It's You"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={busy || !password}>
            <Lock size={12} /> {busy ? "Checking…" : "Confirm & Export"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit}>
        <p className="text-[13px] mb-4 leading-relaxed" style={{ color: DSU.darkGray }}>
          Re-enter your password to confirm.
        </p>
        {error && <ErrorNote message={error} />}
        <Field label="Password" required>
          <TextInput
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
      </form>
    </Modal>
  );
}

/** Same card recipe as the Dashboard's stat tiles — white, generously
 *  rounded, soft shadow, circular icon badge + label on top, big number
 *  below — so this reads as the same product instead of a different UI. */
function Stat({ label, value, icon, badgeBg }: { label: string; value: number; icon: React.ReactNode; badgeBg: string }) {
  return (
    <div className="p-3.5" style={{ background: "#fff", borderRadius: 16, boxShadow: shadow.sm }}>
      <div className="flex items-start justify-between mb-2.5">
        <span className="text-[12.5px] font-medium" style={{ color: DSU.midGray }}>{label}</span>
        <span
          className="inline-flex items-center justify-center rounded-full shrink-0"
          style={{ width: 26, height: 26, background: badgeBg, color: "#fff" }}
        >
          {icon}
        </span>
      </div>
      <div className="text-[26px] font-bold leading-none tabular" style={{ color: DSU.navy }}>{value.toLocaleString()}</div>
    </div>
  );
}

/** Collapsed by default — a scannable one-line summary, with the full
 *  explanation only a click away. Keeps an import report from reading like a
 *  wall of text when most of these are "good to know," not "needs action". */
function Detail({
  title, children, warn, defaultOpen = false,
}: {
  title: string; children: React.ReactNode; warn?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="mb-2 rounded-md overflow-hidden"
      style={{ border: `1px solid ${warn ? "#f0dfa8" : DSU.lightBorder}`, background: warn ? "#fffcf5" : "#fafbfc" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[12.5px] font-medium transition-colors"
        style={{ color: warn ? "#9a7d1f" : DSU.navy }}
      >
        {title}
        <ChevronDown size={14} className="shrink-0 transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div className="px-3 pb-2.5 text-[12px] leading-relaxed" style={{ color: DSU.darkGray }}>
          {children}
        </div>
      )}
    </div>
  );
}
