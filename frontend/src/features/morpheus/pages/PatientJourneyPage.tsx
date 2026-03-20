import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useMorpheusPatients,
  useMorpheusPatient,
  useMorpheusAdmissions,
  useMorpheusTransfers,
  useMorpheusIcuStays,
  useMorpheusDiagnoses,
  useMorpheusMedications,
  useMorpheusLabResults,
  useMorpheusVitals,
  useMorpheusEventCounts,
  useMorpheusMicrobiology,
} from '../api';
import LocationTrack from '../components/LocationTrack';
import AdmissionPicker from '../components/AdmissionPicker';
import EventCountBar from '../components/EventCountBar';
import DiagnosisList from '../components/DiagnosisList';
import MedicationTimeline from '../components/MedicationTimeline';

type ViewMode = 'journey' | 'diagnoses' | 'medications' | 'labs' | 'vitals' | 'microbiology';

export default function PatientJourneyPage() {
  const { subjectId } = useParams<{ subjectId?: string }>();
  const navigate = useNavigate();
  const [selectedHadmId, setSelectedHadmId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('journey');
  const [searchQuery, setSearchQuery] = useState('');

  // Data queries
  const patientsQuery = useMorpheusPatients({}, 100);
  const patientQuery = useMorpheusPatient(subjectId);
  const admissionsQuery = useMorpheusAdmissions(subjectId);
  const transfersQuery = useMorpheusTransfers(subjectId, selectedHadmId ?? undefined);
  const icuStaysQuery = useMorpheusIcuStays(subjectId, selectedHadmId ?? undefined);
  const diagnosesQuery = useMorpheusDiagnoses(subjectId, selectedHadmId ?? undefined);
  const medicationsQuery = useMorpheusMedications(subjectId, selectedHadmId ?? undefined);
  const labsQuery = useMorpheusLabResults(subjectId, selectedHadmId ?? undefined);
  const vitalsQuery = useMorpheusVitals(subjectId, selectedHadmId ?? undefined);
  const countsQuery = useMorpheusEventCounts(subjectId, selectedHadmId ?? undefined);
  const microQuery = useMorpheusMicrobiology(subjectId, selectedHadmId ?? undefined);

  // Patient list filtering
  const filteredPatients = useMemo(() => {
    const patients = patientsQuery.data?.data || [];
    if (!searchQuery) return patients;
    return patients.filter(p => p.subject_id.includes(searchQuery));
  }, [patientsQuery.data, searchQuery]);

  // Browse mode — no patient selected
  if (!subjectId) {
    return (
      <div className="p-6 space-y-4">
        {/* Search */}
        <div className="max-w-md">
          <input
            type="text"
            placeholder="Search by Subject ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-[#1A1A2E] border border-gray-700 text-gray-200 text-sm placeholder-gray-600 focus:outline-none focus:border-[#2DD4BF]"
          />
        </div>

        {/* Patient list */}
        <div className="rounded-lg border border-gray-800 bg-[#1A1A2E] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs">
                <th className="text-left px-4 py-2">Subject ID</th>
                <th className="text-left px-4 py-2">Gender</th>
                <th className="text-left px-4 py-2">Age (anchor)</th>
                <th className="text-left px-4 py-2">Year Group</th>
                <th className="text-left px-4 py-2">Admissions</th>
                <th className="text-left px-4 py-2">ICU Stays</th>
                <th className="text-left px-4 py-2">Deceased</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((p) => (
                <tr
                  key={p.subject_id}
                  onClick={() => navigate(`/morpheus/journey/${p.subject_id}`)}
                  className="border-b border-gray-800/50 hover:bg-[#0E0E11] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2 font-mono text-[#2DD4BF]">{p.subject_id}</td>
                  <td className="px-4 py-2 text-gray-300">{p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : p.gender}</td>
                  <td className="px-4 py-2 text-gray-300">{p.anchor_age}</td>
                  <td className="px-4 py-2 text-gray-500">{p.anchor_year_group}</td>
                  <td className="px-4 py-2 text-gray-300">{p.admission_count}</td>
                  <td className="px-4 py-2">
                    {(p.icu_stay_count ?? 0) > 0 ? (
                      <span className="text-[#9B1B30] font-medium">{p.icu_stay_count}</span>
                    ) : (
                      <span className="text-gray-600">0</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {p.dod ? <span className="text-[#E85A6B]">Yes</span> : <span className="text-gray-600">No</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {patientsQuery.isLoading && (
            <div className="p-4 text-center text-gray-500 text-sm">Loading patients...</div>
          )}
        </div>
      </div>
    );
  }

  // Patient selected — journey view
  const patient = patientQuery.data;
  const admissions = admissionsQuery.data || [];
  const transfers = transfersQuery.data || [];
  const icuStays = icuStaysQuery.data || [];
  const diagnoses = diagnosesQuery.data || [];
  const medications = medicationsQuery.data || [];
  const counts = countsQuery.data || {};

  const VIEW_TABS: { key: ViewMode; label: string }[] = [
    { key: 'journey', label: 'Journey' },
    { key: 'diagnoses', label: 'Diagnoses' },
    { key: 'medications', label: 'Medications' },
    { key: 'labs', label: 'Labs' },
    { key: 'vitals', label: 'Vitals' },
    { key: 'microbiology', label: 'Microbiology' },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Event counts */}
      {Object.keys(counts).length > 0 && <EventCountBar counts={counts} />}

      {/* Admission picker */}
      <AdmissionPicker
        admissions={admissions}
        selectedHadmId={selectedHadmId}
        onSelect={setSelectedHadmId}
      />

      {/* View tabs */}
      <div className="flex items-center gap-1 border-b border-gray-800 pb-1">
        {VIEW_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            className={`px-3 py-1.5 rounded-t-md text-xs font-medium transition-colors ${
              viewMode === key
                ? 'bg-[#1A1A2E] text-[#2DD4BF] border border-gray-800 border-b-transparent'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {viewMode === 'journey' && (
        <div className="space-y-4">
          {/* Location track */}
          <LocationTrack transfers={transfers} icuStays={icuStays} />

          {/* Medication timeline */}
          <MedicationTimeline medications={medications} />

          {/* Diagnosis summary */}
          <div className="rounded-lg border border-gray-800 bg-[#1A1A2E] p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">
              Top Diagnoses ({diagnoses.length} total)
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {diagnoses.slice(0, 15).map((dx) => (
                <span
                  key={`${dx.hadm_id}-${dx.seq_num}`}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-[#0E0E11] border border-gray-800 text-gray-400"
                  title={dx.description}
                >
                  <span className="font-mono text-[#C9A227] mr-1">{dx.icd_code}</span>
                  <span className="truncate max-w-[200px]">{dx.description || 'Unknown'}</span>
                </span>
              ))}
              {diagnoses.length > 15 && (
                <span className="text-[10px] text-gray-600">+{diagnoses.length - 15} more</span>
              )}
            </div>
          </div>

          {/* Admissions summary */}
          <div className="rounded-lg border border-gray-800 bg-[#1A1A2E] p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Admissions</h3>
            <div className="space-y-2">
              {admissions.map((adm) => (
                <div
                  key={adm.hadm_id}
                  className="flex items-center justify-between px-3 py-2 bg-[#0E0E11] rounded-md cursor-pointer hover:bg-[#0E0E11]/80"
                  onClick={() => setSelectedHadmId(adm.hadm_id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-gray-500">{adm.hadm_id}</span>
                    <span className="text-xs text-gray-300">
                      {new Date(adm.admittime).toLocaleDateString()} &mdash; {new Date(adm.dischtime).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1A1A2E] text-gray-500">{adm.admission_type}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{Number(adm.los_days).toFixed(1)}d</span>
                    <span>{adm.discharge_location}</span>
                    {adm.hospital_expire_flag === '1' && <span className="text-[#E85A6B]">&dagger;</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'diagnoses' && <DiagnosisList diagnoses={diagnoses} />}

      {viewMode === 'medications' && <MedicationTimeline medications={medications} />}

      {viewMode === 'labs' && (
        <div className="rounded-lg border border-gray-800 bg-[#1A1A2E] p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Lab Results</h3>
          {labsQuery.isLoading && <div className="text-gray-500 text-sm">Loading labs...</div>}
          {labsQuery.data && (
            <div className="text-sm text-gray-400">
              {labsQuery.data.length.toLocaleString()} results loaded.
              <span className="text-gray-600 ml-1">(Lab panel view coming in next iteration)</span>
            </div>
          )}
        </div>
      )}

      {viewMode === 'vitals' && (
        <div className="rounded-lg border border-gray-800 bg-[#1A1A2E] p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Vital Signs</h3>
          {vitalsQuery.isLoading && <div className="text-gray-500 text-sm">Loading vitals...</div>}
          {vitalsQuery.data && (
            <div className="text-sm text-gray-400">
              {vitalsQuery.data.length.toLocaleString()} vital sign readings loaded.
              <span className="text-gray-600 ml-1">(Vitals chart view coming in next iteration)</span>
            </div>
          )}
        </div>
      )}

      {viewMode === 'microbiology' && (
        <div className="rounded-lg border border-gray-800 bg-[#1A1A2E] p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Microbiology Cultures</h3>
          {microQuery.isLoading && <div className="text-gray-500 text-sm">Loading cultures...</div>}
          {microQuery.data && microQuery.data.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Specimen</th>
                  <th className="text-left px-3 py-2">Test</th>
                  <th className="text-left px-3 py-2">Organism</th>
                  <th className="text-left px-3 py-2">Antibiotic</th>
                  <th className="text-left px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {microQuery.data.map((m) => (
                  <tr key={m.microevent_id} className="border-b border-gray-800/50 hover:bg-[#0E0E11]/50">
                    <td className="px-3 py-1.5 text-gray-400">{m.chartdate ? new Date(m.chartdate).toLocaleDateString() : '\u2014'}</td>
                    <td className="px-3 py-1.5 text-gray-300">{m.spec_type_desc || '\u2014'}</td>
                    <td className="px-3 py-1.5 text-gray-300">{m.test_name || '\u2014'}</td>
                    <td className="px-3 py-1.5 text-[#C9A227]">{m.org_name || '\u2014'}</td>
                    <td className="px-3 py-1.5 text-gray-300">{m.ab_name || '\u2014'}</td>
                    <td className="px-3 py-1.5">
                      {m.interpretation === 'S' && <span className="text-[#22C55E]">Sensitive</span>}
                      {m.interpretation === 'R' && <span className="text-[#E85A6B]">Resistant</span>}
                      {m.interpretation === 'I' && <span className="text-[#C9A227]">Intermediate</span>}
                      {!m.interpretation && <span className="text-gray-600">&mdash;</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-gray-500 text-sm">No microbiology data</div>
          )}
        </div>
      )}
    </div>
  );
}
