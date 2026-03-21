import type { MorpheusDiagnosis } from '../api';

interface DiagnosisListProps {
  diagnoses: MorpheusDiagnosis[];
}

export default function DiagnosisList({ diagnoses }: DiagnosisListProps) {
  if (!diagnoses.length) {
    return <div className="text-zinc-500 text-sm p-5">No diagnoses recorded</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/70">
      <table className="min-w-full divide-y divide-zinc-800 text-left text-sm text-zinc-300">
        <thead className="bg-zinc-900/70 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-semibold w-8">#</th>
            <th className="px-3 py-2 font-semibold w-24">ICD Code</th>
            <th className="px-3 py-2 font-semibold">Description</th>
            <th className="px-3 py-2 font-semibold">Standard Concept</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {diagnoses.map((dx) => (
            <tr key={`${dx.hadm_id}-${dx.seq_num}`} className="hover:bg-zinc-900/50">
              <td className="px-3 py-2 align-top text-zinc-600">{dx.seq_num}</td>
              <td className="px-3 py-2 align-top">
                <span className="font-mono text-[#C9A227]">{dx.icd_code}</span>
                <span className="text-zinc-600 ml-1">v{dx.icd_version}</span>
              </td>
              <td className="px-3 py-2 align-top text-zinc-300">{dx.description || '\u2014'}</td>
              <td className="px-3 py-2 align-top">
                {dx.concept_id ? (
                  <span className="text-[#2DD4BF]">{dx.standard_concept_name}</span>
                ) : (
                  <span className="text-zinc-600">unmapped</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
