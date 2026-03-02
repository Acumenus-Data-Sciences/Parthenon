import { useState } from "react";
import { ChevronDown, Plus, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCohortExpressionStore } from "../stores/cohortExpressionStore";
import type { ConceptSetExpression } from "../types/cohortExpression";

interface ConceptSetPickerProps {
  value: number | null;
  onChange: (codesetId: number) => void;
}

export function ConceptSetPicker({ value, onChange }: ConceptSetPickerProps) {
  const { expression, addConceptSet } = useCohortExpressionStore();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  const conceptSets = expression.ConceptSets;

  const handleCreate = () => {
    if (!newName.trim()) return;
    const nextId =
      conceptSets.length > 0
        ? Math.max(...conceptSets.map((c) => c.id)) + 1
        : 0;
    const cs: ConceptSetExpression = {
      id: nextId,
      name: newName.trim(),
      expression: { items: [] },
    };
    addConceptSet(cs);
    onChange(nextId);
    setNewName("");
    setShowNew(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Layers
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A857D]"
          />
          <select
            value={value ?? ""}
            onChange={(e) => onChange(Number(e.target.value))}
            className={cn(
              "w-full appearance-none rounded-lg border border-[#232328] bg-[#0E0E11] pl-9 pr-8 py-2 text-sm",
              "text-[#F0EDE8] focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40",
              "cursor-pointer",
            )}
          >
            <option value="" disabled>
              Select concept set
            </option>
            {conceptSets.map((cs) => (
              <option key={cs.id} value={cs.id}>
                {cs.name} ({cs.expression.items.length} items)
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#8A857D]"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowNew(!showNew)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            showNew
              ? "bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30"
              : "bg-[#151518] text-[#C5C0B8] border border-[#232328] hover:bg-[#1A1A1E]",
          )}
        >
          <Plus size={14} />
          New
        </button>
      </div>

      {showNew && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setNewName("");
                setShowNew(false);
              }
            }}
            placeholder="Concept set name..."
            autoFocus
            className={cn(
              "flex-1 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm",
              "text-[#F0EDE8] placeholder:text-[#5A5650]",
              "focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40",
            )}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="rounded-lg bg-[#2DD4BF] px-3 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
          >
            Create
          </button>
        </div>
      )}
    </div>
  );
}
