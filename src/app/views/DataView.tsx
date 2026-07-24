import { useRef, useState } from "react";
import { Download, Upload, AlertTriangle, Database, HardDrive, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import type { DataStore, Snapshot } from "../../lib/types";
import { buildWorkbook, downloadWorkbook, parseWorkbook, type ImportReport } from "../../lib/excel";
import { DSU, font, radius, shadow } from "../theme";
import { Button, ErrorNote, HexWatermark, Modal, SectionHeader } from "../components/primitives";

/**
 * Data stewardship hub: the one place records leave this browser (export) or
 * arrive from a legacy departmental spreadsheet (import). The masthead states
 * what's actually at stake — how much is on record, and where it lives — since
 * that's what should shape whether someone bothers to back up today.
 */
export function DataView({
  store, snapshot, onImported, onToast,
}: {
  store: DataStore;
  snapshot: Snapshot;
  onImported: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ snapshot: Snapshot; report: ImportReport; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [tabsHover, setTabsHover] = useState(false);

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
    await store.replaceAll(pending.snapshot);
    await onImported();
    onToast(
      `Imported ${pending.report.assignments} records, ${pending.report.people} people, ${pending.report.keys} keys.`,
    );
    setPending(null);
  };

  const isLocal = store.kind === "local";

  return (
    <div>
      {/* ── Masthead ── same treatment as the dashboard: one white surface, a
          headline figure, and the storage badge as the supporting fact —
          not a separate callout box floating underneath it. */}
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

      {error && <ErrorNote message={error} />}

      <SectionHeader title="Backup &amp; Restore" />

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
          <p className="text-[12px] leading-relaxed" style={{ color: DSU.darkGray }}>
            Downloads a workbook with three sheets, ready to hand off or archive:
          </p>

          <WorkbookTabs flat={tabsHover} />

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="primary" onClick={exportNow} disabled={busy}>
              <Download size={12} /> {busy ? "Working…" : "Export Excel"}
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
          <p className="text-[12px] leading-relaxed" style={{ color: DSU.darkGray }}>
            Reads <strong>every sheet</strong> in the workbook — Directory, Facilities, Returned, and the rest —
            matching columns by heading. Handles split First/Last name columns and a combined room column.
            You'll see a per-sheet count before anything is saved.
          </p>

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
            <AlertTriangle size={11} /> Replaces all current records. Export a backup first.
          </div>
        </div>
      </div>

      {pending && (
        <ImportPreview
          name={pending.name}
          report={pending.report}
          existing={snapshot.assignments.length}
          onConfirm={confirmImport}
          onClose={() => setPending(null)}
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
  name, report, existing, onConfirm, onClose,
}: {
  name: string;
  report: ImportReport;
  existing: number;
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
          <Button variant="primary" onClick={run} disabled={busy}>
            {busy ? "Importing…" : `Replace all data with ${report.assignments} records`}
          </Button>
        </>
      }
    >
      {error && <ErrorNote message={error} />}

      <p className="text-[13px] mb-3 flex items-center gap-1.5" style={{ color: DSU.darkGray }}>
        <CheckCircle2 size={14} style={{ color: DSU.trojan }} />
        Read <strong>{name}</strong>.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Records" value={report.assignments} />
        <Stat label="People" value={report.people} />
        <Stat label="Keys" value={report.keys} />
      </div>

      {existing > 0 && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded border mb-3 text-[12px]"
          style={{ background: "#fff8e6", borderColor: "#e8d59a", color: "#7a6318" }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            This <strong>deletes the {existing} record{existing === 1 ? "" : "s"} currently stored</strong> and
            replaces them with the {report.assignments} above. This cannot be undone — cancel and export a
            backup first if you haven't.
          </span>
        </div>
      )}

      <Detail title={`Sheets read (${report.sheetsRead.length})`}>
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

      {report.sheetsSkipped.length > 0 && (
        <Detail title={`Sheets skipped (${report.sheetsSkipped.length})`} warn>
          <ul className="list-disc pl-4">
            {report.sheetsSkipped.map((s) => (
              <li key={s.name}><strong>{s.name}</strong> — {s.reason}</li>
            ))}
          </ul>
        </Detail>
      )}

      {report.rowsSkipped.length > 0 && (
        <Detail title={`Rows skipped (${report.rowsSkipped.length})`} warn>
          <ul className="list-disc pl-4 max-h-[160px] overflow-y-auto">
            {report.rowsSkipped.slice(0, 50).map((r, i) => (
              <li key={i}>
                {r.row > 0 ? <>{r.sheet} row {r.row} — </> : null}{r.reason}
              </li>
            ))}
            {report.rowsSkipped.length > 50 && <li>…and {report.rowsSkipped.length - 50} more</li>}
          </ul>
        </Detail>
      )}

      {report.unmappedHeaders.length > 0 && (
        <Detail title={`Columns not recognized (${report.unmappedHeaders.length})`}>
          <span style={{ color: DSU.midGray }}>
            These columns were ignored: {report.unmappedHeaders.join(", ")}. If one of them holds data
            you need, tell me the heading and I'll add it.
          </span>
        </Detail>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded p-2.5" style={{ borderColor: DSU.lightBorder, borderLeftWidth: 3, borderLeftColor: DSU.trojan }}>
      <div className="text-[22px] font-bold leading-none tabular" style={{ color: DSU.navy }}>{value.toLocaleString()}</div>
      <div className="text-[11px] mt-0.5" style={{ color: DSU.midGray }}>{label}</div>
    </div>
  );
}

function Detail({ title, children, warn }: { title: string; children: React.ReactNode; warn?: boolean }) {
  return (
    <div className="mb-3">
      <div className="text-[12px] font-semibold mb-1" style={{ color: warn ? "#9a7d1f" : DSU.navy }}>
        {title}
      </div>
      <div className="text-[12px] leading-relaxed" style={{ color: DSU.darkGray }}>{children}</div>
    </div>
  );
}
