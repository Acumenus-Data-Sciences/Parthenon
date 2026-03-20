import type { MorpheusDiagnosis } from '../api';

interface DiagnosisListProps {
  diagnoses: MorpheusDiagnosis[];
}

export default function DiagnosisList({ diagnoses }: DiagnosisListProps) {
  if (!diagnoses.length) {
    return <div className="text-gray-500 text-sm p-4">No diagnoses recorded</div>;
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-[#1A1A2E] overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500">
            <th className="text-left px-3 py-2 w-8">#</th>
            <th className="text-left px-3 py-2 w-24">ICD Code</th>
            <th className="text-left px-3 py-2">Description</th>
            <th className="text-left px-3 py-2">Standard Concept</th>
          </tr>
        </thead>
        <tbody>
          {diagnoses.map((dx) => (
            <tr key={`${dx.hadm_id}-${dx.seq_num}`} className="border-b border-gray-800/50 hover:bg-[#0E0E11]/50">
              <td className="px-3 py-1.5 text-gray-600">{dx.seq_num}</td>
              <td className="px-3 py-1.5">
                <span className="font-mono text-[#C9A227]">{dx.icd_code}</span>
                <span className="text-gray-600 ml-1">v{dx.icd_version}</span>
              </td>
              <td className="px-3 py-1.5 text-gray-300">{dx.description || '\u2014'}</td>
              <td className="px-3 py-1.5">
                {dx.concept_id ? (
                  <span className="text-[#2DD4BF]">{dx.standard_concept_name}</span>
                ) : (
                  <span className="text-gray-600">unmapped</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
