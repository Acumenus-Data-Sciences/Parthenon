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
            className="rounded-lg border border-[#2A2A2F] px-4 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={content.trim() === "" || isImporting}
            onClick={() => onSubmit({ sourceType, content, name, abbreviation, domain })}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] disabled:opacity-50"
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
            <span className="mb-1 block text-xs uppercase tracking-wider text-[#8A857D]">Source</span>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value as "redcap" | "fhir")} className="w-full rounded-lg border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8]">
              <option value="redcap">REDCap Dictionary CSV</option>
              <option value="fhir">FHIR Questionnaire JSON</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-[#8A857D]">Name Override</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8]" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-[#8A857D]">Abbreviation</span>
            <input value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} className="w-full rounded-lg border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8]" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-[#8A857D]">Domain</span>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} className="w-full rounded-lg border border-[#2A2A2F] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8]" />
          </label>
        </div>

        <div className="rounded-lg border border-[#2A2A2F] bg-[#141418] px-4 py-3 text-[11px] text-[#8A857D]">
          {sourceType === "redcap"
            ? "Paste a REDCap data dictionary CSV. Supported columns include Field Label, Field Type, and Choices/Calculations."
            : "Paste a FHIR Questionnaire JSON resource. Nested items are flattened into a linear item list."}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={18}
          className="w-full rounded-lg border border-[#2A2A2F] bg-[#141418] px-3 py-3 font-['IBM_Plex_Mono',monospace] text-xs text-[#F0EDE8] outline-none focus:border-[#2DD4BF]"
          placeholder={sourceType === "redcap" ? "Variable / Field Name,Form Name,Section Header,Field Type,Field Label,Choices, Calculations, OR Slider Labels" : '{ "resourceType": "Questionnaire", "title": "Example", "item": [] }'}
        />
      </div>
    </Modal>
  );
}
