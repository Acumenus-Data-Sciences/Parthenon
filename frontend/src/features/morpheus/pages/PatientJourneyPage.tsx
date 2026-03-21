import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
import type { PatientFilters } from '../api';
import FilterBar from '../components/FilterBar';
import LocationTrack from '../components/LocationTrack';
import AdmissionPicker from '../components/AdmissionPicker';
import EventCountBar from '../components/EventCountBar';
import DiagnosisList from '../components/DiagnosisList';
import MedicationTimeline from '../components/MedicationTimeline';

type ViewMode = 'journey' | 'diagnoses' | 'medications' | 'labs' | 'vitals' | 'microbiology';

export default function PatientJourneyPage() {
  const { subjectId } = useParams<{ subjectId?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedHadmId, setSelectedHadmId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('journey');
  const [searchQuery, setSearchQuery] = useState('');

  // Dataset from URL search params
  const dataset = searchParams.get('dataset') || 'mimiciv';

  // Filter state initialized from URL params
  const [filters, setFilters] = useState<PatientFilters>(() => {
    const initial: PatientFilters = {};
    if (searchParams.get('icu') === 'true') initial.icu = true;
    if (searchParams.get('icu') === 'false') initial.icu = false;
    if (searchParams.get('deceased') === 'true') initial.deceased = true;
    if (searchParams.get('deceased') === 'false') initial.deceased = false;
    if (searchParams.get('admission_type')) initial.admission_type = searchParams.get('admission_type')!;
    if (searchParams.get('diagnosis')) initial.diagnosis = searchParams.get('diagnosis')!;
    return initial;
  });
  const [sortCol, setSortCol] = useState<string>('subject_id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Data queries — all receive dataset
  const patientsQuery = useMorpheusPatients({ ...filters, sort: sortCol, order: sortDir }, 100, 0, dataset);
  const patientQuery = useMorpheusPatient(subjectId, dataset);
  const admissionsQuery = useMorpheusAdmissions(subjectId, dataset);
  const transfersQuery = useMorpheusTransfers(subjectId, selectedHadmId ?? undefined, dataset);
  const icuStaysQuery = useMorpheusIcuStays(subjectId, selectedHadmId ?? undefined, dataset);
  const diagnosesQuery = useMorpheusDiagnoses(subjectId, selectedHadmId ?? undefined, dataset);
  const medicationsQuery = useMorpheusMedications(subjectId, selectedHadmId ?? undefined, dataset);
  const labsQuery = useMorpheusLabResults(subjectId, selectedHadmId ?? undefined, dataset);
  const vitalsQuery = useMorpheusVitals(subjectId, selectedHadmId ?? undefined, undefined, dataset);
  const countsQuery = useMorpheusEventCounts(subjectId, selectedHadmId ?? undefined, dataset);
  const microQuery = useMorpheusMicrobiology(subjectId, selectedHadmId ?? undefined, dataset);

  // Patient list filtering (local search on subject_id only)
  const filteredPatients = useMemo(() => {
    const patients = patientsQuery.data?.data || [];
    if (!searchQuery) return patients;
    return patients.filter(p => p.subject_id.includes(searchQuery));
  }, [patientsQuery.data, searchQuery]);

  const handleFilterChange = (newFilters: PatientFilters) => {
    setFilters(newFilters);
    const params = new URLSearchParams();
    if (dataset !== 'mimiciv') params.set('dataset', dataset);
    if (newFilters.icu !== undefined) params.set('icu', String(newFilters.icu));
    if (newFilters.deceased !== undefined) params.set('deceased', String(newFilters.deceased));
    if (newFilters.admission_type) params.set('admission_type', newFilters.admission_type);
    if (newFilters.diagnosis) params.set('diagnosis', newFilters.diagnosis);
    if (newFilters.min_los !== undefined) params.set('min_los', String(newFilters.min_los));
    if (newFilters.max_los !== undefined) params.set('max_los', String(newFilters.max_los));
    setSearchParams(params, { replace: true });
  };

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortIndicator = (col: string) => sortCol === col ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : '';

  // Preserve dataset param when navigating to patient detail
  const datasetSuffix = dataset !== 'mimiciv' ? `?dataset=${dataset}` : '';

  // Browse mode — no patient selected
  if (!subjectId) {
    return (
      <div className="px-6 py-6 space-y-4">
        {/* Filter bar */}
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          totalShown={filteredPatients.length}
          totalAll={patientsQuery.data?.total ?? 0}
        />

        {/* Search */}
        <div className="max-w-md">
          <input
            type="text"
            placeholder="Search by Subject ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0E0E11] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#9B1B30] focus:outline-none transition-colors"
          />
        </div>

        {/* Patient list */}
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/70">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm text-zinc-300">
            <thead className="bg-zinc-900/70 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-semibold cursor-pointer hover:text-zinc-300" onClick={() => handleSort('subject_id')}>
                  Subject ID{sortIndicator('subject_id')}
                </th>
                <th className="px-3 py-2 font-semibold cursor-pointer hover:text-zinc-300" onClick={() => handleSort('gender')}>
                  Gender{sortIndicator('gender')}
                </th>
                <th className="px-3 py-2 font-semibold cursor-pointer hover:text-zinc-300" onClick={() => handleSort('anchor_age')}>
                  Age (anchor){sortIndicator('anchor_age')}
                </th>
                <th className="px-3 py-2 font-semibold">Year Group</th>
                <th className="px-3 py-2 font-semibold cursor-pointer hover:text-zinc-300" onClick={() => handleSort('admission_count')}>
                  Admissions{sortIndicator('admission_count')}
                </th>
                <th className="px-3 py-2 font-semibold cursor-pointer hover:text-zinc-300" onClick={() => handleSort('icu_stay_count')}>
                  ICU Stays{sortIndicator('icu_stay_count')}
                </th>
                <th className="px-3 py-2 font-semibold cursor-pointer hover:text-zinc-300" onClick={() => handleSort('total_los_days')}>
                  Total LOS{sortIndicator('total_los_days')}
                </th>
                <th className="px-3 py-2 font-semibold cursor-pointer hover:text-zinc-300" onClick={() => handleSort('longest_icu_los')}>
                  Longest ICU{sortIndicator('longest_icu_los')}
                </th>
                <th className="px-3 py-2 font-semibold">Primary Dx</th>
                <th className="px-3 py-2 font-semibold">Deceased</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredPatients.map((p) => (
                <tr
                  key={p.subject_id}
                  onClick={() => navigate(`/morpheus/journey/${p.subject_id}${datasetSuffix}`)}
                  className="hover:bg-zinc-900/50 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 align-top font-mono text-[#2DD4BF]">{p.subject_id}</td>
                  <td className="px-3 py-2 align-top text-zinc-300">{p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : p.gender}</td>
                  <td className="px-3 py-2 align-top text-zinc-300">{p.anchor_age}</td>
                  <td className="px-3 py-2 align-top text-zinc-500">{p.anchor_year_group}</td>
                  <td className="px-3 py-2 align-top text-zinc-300">{p.admission_count}</td>
                  <td className="px-3 py-2 align-top">
                    {(p.icu_stay_count ?? 0) > 0 ? (
                      <span className="text-[#9B1B30] font-medium">{p.icu_stay_count}</span>
                    ) : (
                      <span className="text-zinc-600">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-zinc-300">
                    {p.total_los_days != null ? `${Number(p.total_los_days).toFixed(1)}d` : '\u2014'}
                  </td>
                  <td className="px-3 py-2 align-top text-zinc-300">
                    {p.longest_icu_los != null ? `${Number(p.longest_icu_los).toFixed(1)}d` : '\u2014'}
                  </td>
                  <td className="px-3 py-2 align-top text-zinc-400">
                    {p.primary_diagnosis ? (
                      <span className="truncate max-w-[200px] inline-block align-bottom" title={p.primary_diagnosis}>{p.primary_diagnosis}</span>
                    ) : '\u2014'}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {p.dod ? <span className="text-[#E85A6B]">Yes</span> : <span className="text-zinc-600">No</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {patientsQuery.isLoading && (
            <div className="p-5 text-center text-zinc-500 text-sm">Loading patients...</div>
          )}
          {!patientsQuery.isLoading && filteredPatients.length === 0 && (
            <div className="p-5 text-center text-zinc-500 text-sm">No patients match the current filters</div>
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
    <div className="px-6 py-6 space-y-4">
      {/* Event counts */}
      {Object.keys(counts).length > 0 && <EventCountBar counts={counts} />}

      {/* Admission picker */}
      <AdmissionPicker
        admissions={admissions}
        selectedHadmId={selectedHadmId}
        onSelect={setSelectedHadmId}
      />

      {/* View tabs */}
      <div className="flex gap-0.5 border-b border-zinc-800 mb-6">
        {VIEW_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              viewMode === key
                ? 'font-semibold text-zinc-100 border-b-2 border-[#9B1B30]'
                : 'text-zinc-500 border-b-2 border-transparent hover:text-zinc-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {viewMode === 'journey' && (
        <div className="space-y-6">
          {/* Location track */}
          <LocationTrack transfers={transfers} icuStays={icuStays} />

          {/* Medication timeline */}
          <MedicationTimeline medications={medications} />

          {/* Diagnosis summary */}
          <div className="rounded-xl border border-zinc-800 bg-[#151518] p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">
              Top Diagnoses ({diagnoses.length} total)
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {diagnoses.slice(0, 15).map((dx) => (
                <span
                  key={`${dx.hadm_id}-${dx.seq_num}`}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-[#0E0E11] border border-zinc-800 text-zinc-400"
                  title={dx.description}
                >
                  <span className="font-mono text-[#C9A227] mr-1">{dx.icd_code}</span>
                  <span className="truncate max-w-[200px]">{dx.description || 'Unknown'}</span>
                </span>
              ))}
              {diagnoses.length > 15 && (
                <span className="text-[10px] text-zinc-600">+{diagnoses.length - 15} more</span>
              )}
            </div>
          </div>

          {/* Admissions summary */}
          <div className="rounded-xl border border-zinc-800 bg-[#151518] p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Admissions</h3>
            <div className="space-y-2">
              {admissions.map((adm) => (
                <div
                  key={adm.hadm_id}
                  className="flex items-center justify-between px-3 py-2 bg-[#0E0E11] rounded-md cursor-pointer hover:bg-[#0E0E11]/80"
                  onClick={() => setSelectedHadmId(adm.hadm_id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-zinc-500">{adm.hadm_id}</span>
                    <span className="text-xs text-zinc-300">
                      {new Date(adm.admittime).toLocaleDateString()} &mdash; {new Date(adm.dischtime).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900/50 text-zinc-500">{adm.admission_type}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
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
        <div className="rounded-xl border border-zinc-800 bg-[#151518] p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">Lab Results</h3>
          {labsQuery.isLoading && <div className="text-zinc-500 text-sm">Loading labs...</div>}
          {labsQuery.data && (
            <div className="text-sm text-zinc-400">
              {labsQuery.data.length.toLocaleString()} results loaded.
              <span className="text-zinc-600 ml-1">(Lab panel view coming in next iteration)</span>
            </div>
          )}
        </div>
      )}

      {viewMode === 'vitals' && (
        <div className="rounded-xl border border-zinc-800 bg-[#151518] p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">Vital Signs</h3>
          {vitalsQuery.isLoading && <div className="text-zinc-500 text-sm">Loading vitals...</div>}
          {vitalsQuery.data && (
            <div className="text-sm text-zinc-400">
              {vitalsQuery.data.length.toLocaleString()} vital sign readings loaded.
              <span className="text-zinc-600 ml-1">(Vitals chart view coming in next iteration)</span>
            </div>
          )}
        </div>
      )}

      {viewMode === 'microbiology' && (
        <div className="rounded-xl border border-zinc-800 bg-[#151518] p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">Microbiology Cultures</h3>
          {microQuery.isLoading && <div className="text-zinc-500 text-sm">Loading cultures...</div>}
          {microQuery.data && microQuery.data.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/70">
              <table className="min-w-full divide-y divide-zinc-800 text-left text-sm text-zinc-300">
                <thead className="bg-zinc-900/70 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Specimen</th>
                    <th className="px-3 py-2 font-semibold">Test</th>
                    <th className="px-3 py-2 font-semibold">Organism</th>
                    <th className="px-3 py-2 font-semibold">Antibiotic</th>
                    <th className="px-3 py-2 font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {microQuery.data.map((m) => (
                    <tr key={m.microevent_id} className="hover:bg-zinc-900/50">
                      <td className="px-3 py-2 align-top text-zinc-400">{m.chartdate ? new Date(m.chartdate).toLocaleDateString() : '\u2014'}</td>
                      <td className="px-3 py-2 align-top text-zinc-300">{m.spec_type_desc || '\u2014'}</td>
                      <td className="px-3 py-2 align-top text-zinc-300">{m.test_name || '\u2014'}</td>
                      <td className="px-3 py-2 align-top text-[#C9A227]">{m.org_name || '\u2014'}</td>
                      <td className="px-3 py-2 align-top text-zinc-300">{m.ab_name || '\u2014'}</td>
                      <td className="px-3 py-2 align-top">
                        {m.interpretation === 'S' && <span className="text-[#22C55E]">Sensitive</span>}
                        {m.interpretation === 'R' && <span className="text-[#E85A6B]">Resistant</span>}
                        {m.interpretation === 'I' && <span className="text-[#C9A227]">Intermediate</span>}
                        {!m.interpretation && <span className="text-zinc-600">&mdash;</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-zinc-500 text-sm">No microbiology data</div>
          )}
        </div>
      )}
    </div>
  );
}
