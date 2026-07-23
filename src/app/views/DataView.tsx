import { useRef, useState } from "react";
import { Download, Upload, AlertTriangle, Database, HardDrive, FileSpreadsheet } from "lucide-react";
import type { DataStore, Snapshot } from "../../lib/types";
import { buildWorkbook, downloadWorkbook, parseWorkbook, type ImportReport } from "../../lib/excel";
import { DSU, radius, shadow } from "../theme";
import { Button, ErrorNote, Modal, SectionHeader } from "../components/primitives";

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

  const pickFile = async (file: File | undefined) => {
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

  return (
    <div>
      <SectionHeader title="Import & Export" />

      {error && <ErrorNote message={error} />}

      <div
        className="flex items-start gap-3 px-4 py-3 rounded border mb-4 text-[12px]"
        style={{
          background: store.kind === "local" ? "#fff8e6" : "#f0f8fe",
          borderColor: store.kind === "local" ? "#e8d59a" : "#b8dff4",
          color: DSU.darkGray,
        }}
      >
        {store.kind === "local" ? <HardDrive size={16} style={{ color: "#9a7d1f", flexShrink: 0 }} />
          : <Database size={16} style={{ color: DSU.trojan, flexShrink: 0 }} />}
        <div className="leading-relaxed">
          <strong>Storing to: {store.label}.</strong>{" "}
          {store.kind === "local" ? (
            <>
              Records live in this browser on this computer only. Nobody else can see them, and
              clearing your browsing data erases them. <strong>Export to Excel regularly</strong> —
              that file is your only backup until the Supabase database is approved and connected.
            </>
          ) : (
            <>Records are saved to the shared database and visible to everyone with access.</>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          icon={<Download size={16} style={{ color: DSU.trojan }} />}
          title="Export to Excel"
          body={
            <>
              Downloads a workbook with three sheets: <em>Key Records</em> (the flat list, and the
              one that can be re-imported), plus <em>People</em> and <em>Keys</em> reference sheets.
            </>
          }
          action={
            <Button variant="primary" onClick={exportNow} disabled={busy}>
              <Download size={12} /> {busy ? "Working…" : "Export Excel"}
            </Button>
          }
          footnote={`${snapshot.assignments.length} records · ${snapshot.people.length} people · ${snapshot.keys.length} keys`}
        />

        <Card
          icon={<Upload size={16} style={{ color: DSU.trojan }} />}
          title="Import from Excel"
          body={
            <>
              Reads <strong>every sheet</strong> in the workbook — Directory, Facilities, Returned,
              and the rest — matching columns by heading. Handles split First/Last name columns and
              the combined room column. You'll see a per-sheet count before anything is saved.
            </>
          }
          action={
            <>
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
            </>
          }
          footnote="Replaces all current records. Export a backup first."
          warn
        />
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

function Card({
  icon, title, body, action, footnote, warn,
}: {
  icon: React.ReactNode; title: string; body: React.ReactNode;
  action: React.ReactNode; footnote: string; warn?: boolean;
}) {
  return (
    <div
      className="bg-white border rounded p-4 flex flex-col gap-3"
      style={{ borderColor: DSU.lightBorder, boxShadow: shadow.sm, borderRadius: radius.lg }}
    >
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-[13px] font-semibold" style={{ color: DSU.navy }}>{title}</h3>
      </div>
      <p className="text-[12px] leading-relaxed flex-1" style={{ color: DSU.darkGray }}>{body}</p>
      <div className="flex items-center gap-2 flex-wrap">{action}</div>
      <div
        className="text-[11px] flex items-center gap-1"
        style={{ color: warn ? "#9a7d1f" : DSU.midGray }}
      >
        {warn && <AlertTriangle size={11} />}
        {footnote}
      </div>
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

      <p className="text-[13px] mb-3" style={{ color: DSU.darkGray }}>
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
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]"
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
      <div className="text-[22px] font-bold leading-none" style={{ color: DSU.navy }}>{value}</div>
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
