import { useState } from "react";
import { Search, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import {
  useConceptSets,
  useAddConceptSetItem,
} from "@/features/concept-sets/hooks/useConceptSets";

interface AddToConceptSetModalProps {
  open: boolean;
  onClose: () => void;
  conceptId: number;
  conceptName: string;
}

export function AddToConceptSetModal({
  open,
  onClose,
  conceptId,
  conceptName,
}: AddToConceptSetModalProps) {
  const [filter, setFilter] = useState("");
  const { data: conceptSetsData, isLoading } = useConceptSets();
  const addItem = useAddConceptSetItem();

  const conceptSets = conceptSetsData?.items ?? conceptSetsData ?? [];
  const filtered = Array.isArray(conceptSets)
    ? conceptSets.filter((cs: { name: string }) =>
        cs.name.toLowerCase().includes(filter.toLowerCase()),
      )
    : [];

  const handleAdd = (setId: number, setName: string) => {
    addItem.mutate(
      {
        setId,
        payload: {
          concept_id: conceptId,
          is_excluded: false,
          include_descendants: false,
          include_mapped: false,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Added to "${setName}"`);
          onClose();
        },
        onError: () => {
          toast.error("Failed to add concept to set");
        },
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Add to Concept Set" size="sm">
      <div className="space-y-3">
        <p className="text-xs text-[#8A857D]">
          Add <span className="text-[#F0EDE8] font-medium">{conceptName}</span>{" "}
          <span className="font-['IBM_Plex_Mono',monospace] text-[#C9A227]">
            ({conceptId})
          </span>{" "}
          to a concept set:
        </p>

        {/* Filter input */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
          />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter concept sets..."
            className={cn(
              "w-full rounded-lg pl-9 pr-3 py-2 text-sm",
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8] placeholder:text-[#5A5650]",
              "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
            )}
          />
        </div>

        {/* Concept set list */}
        <div className="rounded-lg border border-[#232328] bg-[#0E0E11] max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin text-[#8A857D]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs text-[#5A5650]">
                {filter ? "No matching concept sets" : "No concept sets found"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#232328]">
              {filtered.map((cs: { id: number; name: string; description?: string }) => (
                <button
                  key={cs.id}
                  type="button"
                  onClick={() => handleAdd(cs.id, cs.name)}
                  disabled={addItem.isPending}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors",
                    "hover:bg-[#1C1C20]",
                    addItem.isPending && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-[#F0EDE8] truncate">
                        {cs.name}
                      </p>
                      {cs.description && (
                        <p className="text-[10px] text-[#5A5650] truncate mt-0.5">
                          {cs.description}
                        </p>
                      )}
                    </div>
                    <CheckCircle2
                      size={14}
                      className="shrink-0 text-[#323238] group-hover:text-[#2DD4BF]"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
