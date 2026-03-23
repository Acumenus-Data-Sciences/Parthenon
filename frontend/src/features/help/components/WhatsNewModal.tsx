import { useState, useEffect } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useChangelog } from "../hooks/useHelp";
import type { ChangelogEntry } from "../api/helpApi";

const STORAGE_KEY = "parthenon_seen_version";

const SECTION_COLORS: Record<string, string> = {
  Added: "text-emerald-400",
  Fixed: "text-amber-400",
  Changed: "text-sky-400",
  Removed: "text-red-400",
  Deprecated: "text-orange-400",
  Security: "text-purple-400",
};

function EntryCard({ entry }: { entry: ChangelogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const sectionKeys = Object.keys(entry.sections);

  return (
    <div className="rounded-lg border border-[#1E1E24] bg-[#131316] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#1A1A20] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="rounded bg-[#2DD4BF]/15 px-2 py-0.5 text-xs font-mono font-semibold text-[#2DD4BF]">
            v{entry.version}
          </span>
          <span className="text-xs text-[#5A5650]">{entry.date}</span>
          {sectionKeys.map((section) => (
            <span
              key={section}
              className={`text-xs ${SECTION_COLORS[section] ?? "text-[#8A857D]"}`}
            >
              {entry.sections[section].length} {section}
            </span>
          ))}
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-[#5A5650]" />
        ) : (
          <ChevronDown size={14} className="text-[#5A5650]" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {sectionKeys.map((section) => (
            <div key={section}>
              <div
                className={`mb-2 text-xs font-semibold uppercase tracking-wider ${SECTION_COLORS[section] ?? "text-[#8A857D]"}`}
              >
                {section}
              </div>
              <ul className="space-y-1.5">
                {entry.sections[section].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#8A857D]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3A3A42]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface WhatsNewModalProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export function WhatsNewModal({ externalOpen, onExternalClose }: WhatsNewModalProps = {}) {
  const { data: entries, isLoading } = useChangelog();
  const [autoOpen, setAutoOpen] = useState(false);

  const isOpen = externalOpen || autoOpen;

  useEffect(() => {
    if (externalOpen !== undefined) return; // skip auto-open when externally controlled
    if (!entries || entries.length === 0) return;
    const latestVersion = entries[0].version;
    const seenVersion = localStorage.getItem(STORAGE_KEY);
    if (seenVersion !== latestVersion) {
      setAutoOpen(true);
    }
  }, [entries, externalOpen]);

  const handleClose = () => {
    if (entries && entries.length > 0) {
      localStorage.setItem(STORAGE_KEY, entries[0].version);
    }
    setAutoOpen(false);
    onExternalClose?.();
  };

  if (!isOpen || isLoading || !entries) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title="What's New in Parthenon"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg bg-[#2DD4BF] px-5 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors"
          >
            Got it
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-[#2DD4BF]" />
          <p className="text-sm text-[#8A857D]">
            Here's what changed since your last visit.
          </p>
        </div>
        {entries.map((entry) => (
          <EntryCard key={entry.version} entry={entry} />
        ))}
      </div>
    </Modal>
  );
}
