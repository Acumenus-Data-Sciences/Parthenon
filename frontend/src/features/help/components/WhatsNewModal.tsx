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
    <div className="rounded-lg border border-border-subtle bg-sidebar-bg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-overlay transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="rounded bg-success/15 px-2 py-0.5 text-xs font-mono font-semibold text-success">
            v{entry.version}
          </span>
          <span className="text-xs text-text-ghost">{entry.date}</span>
          {sectionKeys.map((section) => (
            <span
              key={section}
              className={`text-xs ${SECTION_COLORS[section] ?? "text-text-muted"}`}
            >
              {entry.sections[section].length} {section}
            </span>
          ))}
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-text-ghost" />
        ) : (
          <ChevronDown size={14} className="text-text-ghost" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {sectionKeys.map((section) => (
            <div key={section}>
              <div
                className={`mb-2 text-xs font-semibold uppercase tracking-wider ${SECTION_COLORS[section] ?? "text-text-muted"}`}
              >
                {section}
              </div>
              <ul className="space-y-1.5">
                {entry.sections[section].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-muted">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-surface-highlight" />
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
      open={isOpen}
      onClose={handleClose}
      size="lg"
      title="What's New in Parthenon"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg bg-success px-5 py-2 text-sm font-medium text-surface-base hover:bg-success transition-colors"
          >
            Got it
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-success" />
          <p className="text-sm text-text-muted">
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
