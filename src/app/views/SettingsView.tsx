import { ArrowLeft, HardDrive, MapPin, Pencil } from "lucide-react";
import type { DataStore, Snapshot } from "../../lib/types";
import { DSU, font, radius, shadow } from "../theme";
import { Button } from "../components/primitives";
import { DataView } from "./DataView";

/** Same bordered white-card chrome as the Data & Backups cards below (and
 *  the panel this replaced) — border + radius.lg, not the borderless
 *  rounded-20 card used elsewhere in the redesign. */
function SettingsRow({
  icon, title, description, children,
}: {
  icon: React.ReactNode; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div
      className="bg-white border rounded p-4 flex items-center gap-4 flex-wrap"
      style={{ borderColor: DSU.lightBorder, boxShadow: shadow.sm, borderRadius: radius.lg }}
    >
      <span
        className="inline-flex items-center justify-center rounded-full shrink-0"
        style={{ width: 34, height: 34, background: DSU.tintBg, color: DSU.trojan }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-[220px]">
        <h3 className="text-[13px] font-semibold" style={{ color: DSU.navy }}>{title}</h3>
        <p className="text-[12px] leading-relaxed mt-0.5" style={{ color: DSU.darkGray }}>{description}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * App-level preferences, reached from the profile menu. Holds the one admin
 * toggle, a read-only storage-mode summary, and the full Data & Backups page
 * (import/export) folded in below — Data no longer has a nav tab of its own.
 */
export function SettingsView({
  storeKind, mapEditing, onToggleMapEditing, onBack, backLabel, store, snapshot, onImported, onToast,
  requireReauth, onReauthorize,
}: {
  storeKind: "local" | "supabase";
  mapEditing: boolean;
  onToggleMapEditing: () => void;
  onBack: () => void;
  backLabel: string;
  store: DataStore;
  snapshot: Snapshot;
  onImported: () => Promise<void>;
  onToast: (msg: string) => void;
  requireReauth?: boolean;
  onReauthorize?: (password: string) => Promise<string | null>;
}) {
  return (
    <div className="dsu-fade-in">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] mb-4 transition-colors hover:underline"
        style={{ color: DSU.trojan }}
      >
        <ArrowLeft size={13} /> Back to {backLabel}
      </button>

      <h1 className="text-[26px] font-semibold mb-5" style={{ fontFamily: font.display, color: DSU.navy }}>
        Settings
      </h1>

      <div className="flex flex-col gap-3">
        <SettingsRow
          icon={<MapPin size={16} />}
          title="Campus Map Positions"
          description="Unlocks drag-and-resize editing for every building marker on the Map page. Turn this on, fix any building's position there, then come back and switch it off."
        >
          <Button variant={mapEditing ? "primary" : "secondary"} onClick={onToggleMapEditing}>
            <Pencil size={12} /> {mapEditing ? "Editing On — Turn Off" : "Enable Map Editing"}
          </Button>
        </SettingsRow>

        <SettingsRow
          icon={<HardDrive size={16} />}
          title="Data Storage"
          description={
            storeKind === "supabase"
              ? "Records are synced to Supabase — shared and backed up automatically."
              : "Records are stored in this browser only. Export a backup below regularly."
          }
        >
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold"
            style={
              storeKind === "local"
                ? { background: "#fff3d4", color: "#7a6318", border: "1px solid #ecd699" }
                : { background: DSU.tintBg, color: DSU.tintText, border: `1px solid ${DSU.tintBorder}` }
            }
          >
            {storeKind === "local" ? <HardDrive size={13} /> : <HardDrive size={13} />}
            {storeKind === "supabase" ? "Synced" : "Local only"}
          </div>
        </SettingsRow>
      </div>

      <div className="mt-8">
        <DataView
          store={store}
          snapshot={snapshot}
          onImported={onImported}
          onToast={onToast}
          hideMasthead
          requireReauth={requireReauth}
          onReauthorize={onReauthorize}
        />
      </div>
    </div>
  );
}
