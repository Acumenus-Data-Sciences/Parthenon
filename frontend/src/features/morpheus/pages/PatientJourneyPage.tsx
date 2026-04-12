import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
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
import type { PatientFilters, MorpheusMedication } from '../api';
import FilterBar from '../components/FilterBar';
import LocationTrack from '../components/LocationTrack';
import AdmissionPicker from '../components/AdmissionPicker';
import EventCountBar from '../components/EventCountBar';
import MedicationTimeline from '../components/MedicationTimeline';
import LabPanelDashboard from '../components/LabPanelDashboard';
import VitalsMonitorGrid from '../components/VitalsMonitorGrid';
import AntibiogramHeatmap from '../components/AntibiogramHeatmap';
import CultureTable from '../components/CultureTable';
import ConceptDetailDrawer, { type DrawerEvent } from '../components/ConceptDetailDrawer';
import GroupedDiagnosisList from '../components/GroupedDiagnosisList';
import ExportButton from '../components/ExportButton';
import TruncationWarning from '../components/TruncationWarning';
import SearchDropdown from '../components/SearchDropdown';

type ViewMode = 'journey' | 'diagnoses' | 'medications' | 'labs' | 'vitals' | 'microbiology';

export default function PatientJourneyPage() {
  const { subjectId } = useParams<{ subjectId?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedHadmId, setSelectedHadmId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('journey');
  const [searchQuery] = useState('');
  const [drawerEvent, setDrawerEvent] = useState<DrawerEvent | null>(null);

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
  // Pre-fetch patient data (used by child components via shared query key)
  useMorpheusPatient(subjectId, dataset);
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

        {/* Search + Export */}
        <div className="flex items-center gap-3">
          <div className="max-w-md flex-1">
            <SearchDropdown
              dataset={dataset}
              onSelect={(id) => navigate(`/morpheus/journey/${id}${datasetSuffix}`)}
            />
          </div>
          <ExportButton
            data={(patientsQuery.data?.data ?? []) as unknown as Record<string, unknown>[]}
            filename="morpheus-patient-list"
          />
        </div>

        {/* Patient list */}
        <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-darkest/70">
          <table className="min-w-full divide-y divide-border-default text-left text-sm text-zinc-300">
            <thead className="bg-surface-base/70 text-xs uppercase tracking-wide text-zinc-500">
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
            <tbody className="divide-y divide-border-default">
              {filteredPatients.map((p) => (
                <tr
                  key={p.subject_id}
                  onClick={() => navigate(`/morpheus/journey/${p.subject_id}${datasetSuffix}`)}
                  className="hover:bg-surface-base/50 cursor-pointer transition-colors"
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
      {Object.keys(counts).length > 0 && (
        <EventCountBar
          counts={counts}
          onDomainClick={(domain) => {
            const tabMap: Record<string, ViewMode> = {
              diagnoses: 'diagnoses',
              prescriptions: 'medications',
              lab_results: 'labs',
              vitals: 'vitals',
              microbiology: 'microbiology',
            };
            const tab = tabMap[domain];
            if (tab) setViewMode(tab);
          }}
        />
      )}

      {/* Admission picker */}
      <AdmissionPicker
        admissions={admissions}
        selectedHadmId={selectedHadmId}
        onSelect={setSelectedHadmId}
      />

      {/* View tabs */}
      <div className="flex gap-0.5 border-b border-border-default mb-6">
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
          <div className="rounded-xl border border-border-default bg-[#151518] p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">
              Top Diagnoses ({diagnoses.length} total)
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {diagnoses.slice(0, 15).map((dx) => (
                <span
                  key={`${dx.hadm_id}-${dx.seq_num}`}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-[#0E0E11] border border-border-default text-zinc-400"
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
          <div className="rounded-xl border border-border-default bg-[#151518] p-5">
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
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-base/50 text-zinc-500">{adm.admission_type}</span>
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

      {viewMode === 'diagnoses' && (
        <GroupedDiagnosisList diagnoses={diagnoses} onConceptClick={setDrawerEvent} />
      )}

      {viewMode === 'medications' && (
        <MedicationTimeline
          medications={medications}
          onDrugClick={(med: MorpheusMedication) => setDrawerEvent({
            domain: 'medication',
            concept_id: null,
            concept_name: med.drug,
            source_code: null,
            source_vocabulary: 'MIMIC-IV prescriptions',
            standard_concept_name: null,
            start_date: med.starttime,
            end_date: med.stoptime,
            value: null,
            unit: null,
            ref_range_lower: null,
            ref_range_upper: null,
            route: med.route,
            dose: `${med.dose_val_rx} ${med.dose_unit_rx}`,
            days_supply: null,
            seq_num: null,
            hadm_id: med.hadm_id,
            occurrenceCount: medications.filter((m) => m.drug === med.drug).length,
            sparklineValues: [],
          })}
        />
      )}

      {viewMode === 'labs' && subjectId && (
        <>
          {labsQuery.data && countsQuery.data && (
            <TruncationWarning
              loaded={labsQuery.data.length}
              total={(countsQuery.data as Record<string, number>).lab_results ?? labsQuery.data.length}
              domain="lab results"
            />
          )}
          {labsQuery.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={24} className="animate-spin text-[#8A857D]" />
            </div>
          ) : labsQuery.data ? (
            <div>
              <div className="flex justify-end mb-2">
                <ExportButton
                  data={labsQuery.data as unknown as Record<string, unknown>[]}
                  filename={`morpheus-labs-${subjectId}`}
                />
              </div>
              <LabPanelDashboard labs={labsQuery.data} onConceptClick={setDrawerEvent} />
            </div>
          ) : null}
        </>
      )}

      {viewMode === 'vitals' && subjectId && (
        <>
          {vitalsQuery.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={24} className="animate-spin text-[#8A857D]" />
            </div>
          ) : vitalsQuery.data ? (
            <div>
              <div className="flex justify-end mb-2">
                <ExportButton
                  data={vitalsQuery.data as unknown as Record<string, unknown>[]}
                  filename={`morpheus-vitals-${subjectId}`}
                />
              </div>
              <VitalsMonitorGrid vitals={vitalsQuery.data} />
            </div>
          ) : null}
        </>
      )}

      {viewMode === 'microbiology' && subjectId && (
        <>
          {microQuery.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={24} className="animate-spin text-[#8A857D]" />
            </div>
          ) : microQuery.data ? (
            <div className="space-y-6">
              <div className="flex justify-end">
                <ExportButton
                  data={microQuery.data as unknown as Record<string, unknown>[]}
                  filename={`morpheus-micro-${subjectId}`}
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#F0EDE8] mb-3">Antibiogram</h3>
                <AntibiogramHeatmap data={microQuery.data} onOrganismClick={setDrawerEvent} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#F0EDE8] mb-3">Culture Results</h3>
                <CultureTable data={microQuery.data} onOrganismClick={setDrawerEvent} />
              </div>
            </div>
          ) : null}
        </>
      )}

      <ConceptDetailDrawer event={drawerEvent} onClose={() => setDrawerEvent(null)} dataset={dataset} />
    </div>
  );
}
