import { useRelationships } from "../hooks/useRelationships";
import { useTranslation } from "react-i18next";

export function RelationshipsTab({
  sourceKey,
  conceptId,
  onConceptSelect,
}: {
  sourceKey: string;
  conceptId: number;
  onConceptSelect: (conceptId: number) => void;
}) {
  const { t } = useTranslation("app");
  const { data, isLoading, error } = useRelationships(sourceKey, conceptId);

  if (isLoading) return <div className="text-slate-400">{t("codeExplorer.relationships.loading")}</div>;
  if (error) return <div className="text-rose-300">{t("codeExplorer.relationships.failed")} {(error as Error).message}</div>;
  if (!data || data.relationships.length === 0) {
    return <div className="text-slate-400">{t("codeExplorer.relationships.empty")}</div>;
  }

  return (
    <div className="max-h-[600px] overflow-auto rounded border border-slate-700">
      <table className="min-w-full divide-y divide-slate-700 text-sm">
        <thead className="bg-slate-900 text-left text-xs font-medium uppercase text-slate-400">
          <tr>
            <th className="px-3 py-2">{t("codeExplorer.relationships.headers.relationship")}</th>
            <th className="px-3 py-2">{t("codeExplorer.relationships.headers.targetConcept")}</th>
            <th className="px-3 py-2">{t("codeExplorer.relationships.headers.vocabulary")}</th>
            <th className="px-3 py-2">{t("codeExplorer.relationships.headers.standard")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {data.relationships.map((r, i) => (
            <tr key={`${r.relationship_id}-${r.concept_id_2}-${i}`} className="hover:bg-slate-900/50">
              <td className="px-3 py-2 font-mono text-xs text-cyan-300">{r.relationship_id}</td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="text-slate-100 hover:underline"
                  onClick={() => onConceptSelect(r.concept_id_2)}
                >
                  {r.concept_name_2}{" "}
                  <span className="text-xs text-slate-500">({r.concept_id_2})</span>
                </button>
              </td>
              <td className="px-3 py-2 text-slate-300">{r.vocabulary_id_2}</td>
              <td className="px-3 py-2 text-slate-400">{r.standard_concept ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
