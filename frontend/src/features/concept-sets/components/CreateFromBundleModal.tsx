import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, Stethoscope, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { useQuery } from "@tanstack/react-query";
import { listBundles } from "@/features/care-gaps/api/careGapApi";
import { useCreateConceptSetsFromBundle } from "../hooks/useConceptSets";

interface CreateFromBundleModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateFromBundleModal({
  open,
  onClose,
}: CreateFromBundleModalProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");

  const { data: bundlesData, isLoading } = useQuery({
    queryKey: ["care-bundles", "all"],
    queryFn: () => listBundles({ limit: 50 }),
    enabled: open,
  });

  const createMutation = useCreateConceptSetsFromBundle();

  const bundles = bundlesData?.items ?? [];
  const filtered = bundles.filter(
    (b) =>
      b.condition_name.toLowerCase().includes(filter.toLowerCase()) ||
      (b.description ?? "").toLowerCase().includes(filter.toLowerCase()) ||
      b.bundle_code.toLowerCase().includes(filter.toLowerCase()),
  );

  const selectedBundle = bundles.find((b) => b.id === selectedId);

  const handleCreate = () => {
    if (!selectedId) return;

    createMutation.mutate(
      {
        bundle_id: selectedId,
        name: name.trim() || undefined,
      },
      {
        onSuccess: (sets) => {
          toast.success(
            `${sets.length} concept set${sets.length !== 1 ? "s" : ""} created from ${selectedBundle?.condition_name}`,
          );
          onClose();
          // Navigate to concept sets list to see the new sets
          navigate("/concept-sets");
        },
        onError: () => {
          toast.error("Failed to create concept sets from bundle");
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create from Care Bundle"
      size="md"
    >
      <div className="space-y-4">
        <p className="text-xs text-[#8A857D]">
          Select a disease bundle to auto-generate concept sets grouped by
          domain (conditions, drugs, measurements).
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
            placeholder="Filter bundles..."
            className={cn(
              "w-full rounded-lg pl-9 pr-3 py-2 text-sm",
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8] placeholder:text-[#5A5650]",
              "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
            )}
          />
        </div>

        {/* Bundle list */}
        <div className="rounded-lg border border-[#232328] bg-[#0E0E11] max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin text-[#8A857D]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs text-[#5A5650]">
                {filter ? "No matching bundles" : "No care bundles found"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#232328]">
              {filtered.map((bundle) => {
                const isSelected = selectedId === bundle.id;
                return (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(bundle.id);
                      setName(bundle.condition_name);
                    }}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors",
                      isSelected
                        ? "bg-[#2DD4BF]/10 border-l-2 border-l-[#2DD4BF]"
                        : "hover:bg-[#1C1C20]",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Stethoscope
                            size={12}
                            className="text-[#8A857D] shrink-0"
                          />
                          <p className="text-sm text-[#F0EDE8] truncate">
                            {bundle.condition_name}
                          </p>
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#1A1A1F] text-[#8A857D] border border-[#2A2A30]">
                            {bundle.bundle_code}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {bundle.disease_category && (
                            <span className="text-[10px] text-[#5A5650]">
                              {bundle.disease_category}
                            </span>
                          )}
                          <span className="text-[10px] text-[#5A5650]">
                            {bundle.bundle_size} measures
                          </span>
                          <span className="text-[10px] text-[#5A5650]">
                            {bundle.omop_concept_ids.length} concepts
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2
                          size={14}
                          className="shrink-0 text-[#2DD4BF]"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Options (visible when a bundle is selected) */}
        {selectedBundle && (
          <div className="space-y-3 rounded-lg border border-[#232328] bg-[#151518] p-4">
            {/* Name prefix */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#5A5650] mb-1">
                Name Prefix
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-sm",
                  "bg-[#0E0E11] border border-[#232328]",
                  "text-[#F0EDE8] placeholder:text-[#5A5650]",
                  "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
                )}
              />
              <p className="mt-1 text-[10px] text-[#5A5650]">
                Sets will be named "{name || selectedBundle.condition_name} -
                Conditions", "- Drugs", etc.
              </p>
            </div>

            {/* Create button */}
            <button
              type="button"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Stethoscope size={16} />
              )}
              Create Concept Sets
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
