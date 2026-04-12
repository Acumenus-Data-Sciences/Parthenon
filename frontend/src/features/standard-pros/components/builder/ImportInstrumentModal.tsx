import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface ImportInstrumentModalProps {
  open: boolean;
  onClose: () => void;
  isImporting: boolean;
  onSubmit: (input: {
    sourceType: "redcap" | "fhir";
    content: string;
    name: string;
    abbreviation: string;
    domain: string;
  }) => void;
}

export function ImportInstrumentModal({
  open,
  onClose,
  isImporting,
  onSubmit,
}: ImportInstrumentModalProps) {
  const [sourceType, setSourceType] = useState<"redcap" | "fhir">("redcap");
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [domain, setDomain] = useState("other");

  const handleClose = () => {
    setSourceType("redcap");
    setContent("");
    setName("");
    setAbbreviation("");
    setDomain("other");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import Instrument"
      size="xl"
      footer={(
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-border-default px-4 py-2 text-sm text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={content.trim() === "" || isImporting}
            onClick={() => onSubmit({ sourceType, content, name, abbreviation, domain })}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base disabled:opacity-50"
          >
            {isImporting && <Loader2 size={14} className="animate-spin" />}
            Import
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-text-muted">Source</span>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value as "redcap" | "fhir")} className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary">
              <option value="redcap">REDCap Dictionary CSV</option>
              <option value="fhir">FHIR Questionnaire JSON</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-text-muted">Name Override</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-text-muted">Abbreviation</span>
            <input value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-text-muted">Domain</span>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary" />
          </label>
        </div>

        <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3 text-[11px] text-text-muted">
          {sourceType === "redcap"
            ? "Paste a REDCap data dictionary CSV. Supported columns include Field Label, Field Type, and Choices/Calculations."
            : "Paste a FHIR Questionnaire JSON resource. Nested items are flattened into a linear item list."}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={18}
          className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-3 font-['IBM_Plex_Mono',monospace] text-xs text-text-primary outline-none focus:border-success"
          placeholder={sourceType === "redcap" ? "Variable / Field Name,Form Name,Section Header,Field Type,Field Label,Choices, Calculations, OR Slider Labels" : '{ "resourceType": "Questionnaire", "title": "Example", "item": [] }'}
        />
      </div>
    </Modal>
  );
}
