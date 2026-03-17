import { useState } from "react";
import {
  useLookupVocabularies,
  useLookupPreview,
  useGenerateLookups,
} from "../api";
import LookupPreview from "./LookupPreview";
import type { AqueductArtifact } from "../types";

export default function LookupGeneratorTab() {
  const [selected, setSelected] = useState<string[]>([]);
  const [previewVocab, setPreviewVocab] = useState<string | null>(null);
  const [includeS2S, setIncludeS2S] = useState(true);

  const { data: vocabularies, isLoading } = useLookupVocabularies();
  const { data: preview } = useLookupPreview(previewVocab);
  const generateMutation = useGenerateLookups();

  const toggleVocab = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  const handleGenerate = () => {
    if (selected.length === 0) return;
    generateMutation.mutate({
      vocabularies: selected,
      include_source_to_source: includeS2S,
      vocab_schema: "vocab",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">
          Vocabulary Lookup Generator
        </h3>
        <p className="mb-4 text-sm text-gray-400">
          Select vocabularies to generate SOURCE_TO_CONCEPT_MAP lookup SQL.
          These templates map source codes to standard OMOP concepts.
        </p>

        {isLoading ? (
          <div className="text-sm text-gray-500">Loading vocabularies...</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {vocabularies?.map((vocab) => (
              <button
                key={vocab.id}
                onClick={() => toggleVocab(vocab.id)}
                className={`rounded-lg border p-3 text-left text-sm transition ${
                  selected.includes(vocab.id)
                    ? "border-[#2DD4BF] bg-[#2DD4BF]/10 text-white"
                    : "border-white/10 bg-[#161619] text-gray-400 hover:border-white/20"
                }`}
              >
                <div className="font-medium">{vocab.display_name}</div>
                {vocab.domain && (
                  <div className="mt-1 text-xs text-gray-500">
                    {vocab.domain}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={includeS2S}
            onChange={(e) => setIncludeS2S(e.target.checked)}
            className="rounded border-gray-600 bg-[#161619]"
          />
          Include source-to-source lookups
        </label>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleGenerate}
          disabled={selected.length === 0 || generateMutation.isPending}
          className="rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-black transition hover:bg-[#2DD4BF]/80 disabled:opacity-50"
        >
          {generateMutation.isPending
            ? "Generating..."
            : `Generate ${selected.length} Lookup${selected.length !== 1 ? "s" : ""}`}
        </button>
        {selected.length === 1 && (
          <button
            onClick={() => setPreviewVocab(selected[0])}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:border-white/20"
          >
            Preview SQL
          </button>
        )}
      </div>

      {preview && previewVocab && (
        <LookupPreview sql={preview.sql} vocabulary={previewVocab} />
      )}

      {generateMutation.data && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-[#C9A227]">
            Generated Lookups ({generateMutation.data.summary.vocabularies_assembled as number} vocabularies)
          </h4>
          {generateMutation.data.artifacts.artifacts.map(
            (artifact: AqueductArtifact) => (
              <LookupPreview
                key={artifact.id}
                sql={artifact.content ?? ""}
                vocabulary={artifact.id.replace("lookup_", "").replace("_sql", "")}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
