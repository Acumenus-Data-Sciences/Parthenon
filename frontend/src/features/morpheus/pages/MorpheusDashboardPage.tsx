import { useNavigate, useSearchParams } from 'react-router-dom';
import MetricCard from '../components/MetricCard';
import HorizontalBarChart from '../components/HorizontalBarChart';
import DistributionChart from '../components/DistributionChart';
import TrendChart from '../components/TrendChart';
import DonutChart from '../components/DonutChart';
import {
  useDashboardMetrics, useDashboardTrends,
  useDashboardTopDiagnoses, useDashboardTopProcedures,
  useDashboardDemographics, useDashboardLosDistribution,
  useDashboardIcuUnits, useDashboardMortalityByType,
  useMorpheusDatasets,
} from '../api';

function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-zinc-800/50 ${className}`} />;
}

function ErrorBox({ message = 'Failed to load' }: { message?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#151518] p-5 flex items-center justify-center text-sm text-zinc-500">
      {message}
    </div>
  );
}

export default function MorpheusDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dataset = searchParams.get('dataset') || 'mimiciv';

  // Resolve display name from datasets list
  const { data: datasets } = useMorpheusDatasets();
  const currentDataset = datasets?.find(d => d.schema_name === dataset);
  const datasetLabel = currentDataset?.name || 'Inpatient';

  const metricsQ = useDashboardMetrics(dataset);
  const trendsQ = useDashboardTrends(dataset);
  const dxQ = useDashboardTopDiagnoses(10, dataset);
  const pxQ = useDashboardTopProcedures(10, dataset);
  const demoQ = useDashboardDemographics(dataset);
  const losQ = useDashboardLosDistribution(dataset);
  const icuQ = useDashboardIcuUnits(dataset);
  const mortTypeQ = useDashboardMortalityByType(dataset);

  const metrics = metricsQ.data;
  const trends = trendsQ.data;
  const topDiagnoses = dxQ.data;
  const topProcedures = pxQ.data;
  const demographics = demoQ.data;
  const losDistribution = losQ.data;
  const icuUnits = icuQ.data;
  const mortalityByType = mortTypeQ.data;

  // Transform data for charts
  const admissionTrendData = trends?.map(t => ({
    label: t.month,
    barValue: t.admissions,
  })) ?? [];

  const mortalityTrendData = trends?.map(t => ({
    label: t.month,
    barValue: t.admissions,
    lineValue: t.mortality_rate,
  })) ?? [];

  const dxBarData = topDiagnoses?.map(d => ({
    label: d.description || d.icd_code,
    value: d.patient_count,
    sublabel: d.icd_code,
  })) ?? [];

  const pxBarData = topProcedures?.map(p => ({
    label: p.description || p.icd_code,
    value: p.patient_count,
    sublabel: p.icd_code,
  })) ?? [];

  const genderData = demographics ? Object.entries(demographics.gender).map(([label, value]) => ({
    label: label === 'M' ? 'Male' : label === 'F' ? 'Female' : label,
    value: value as number,
    color: label === 'M' ? '#3B82F6' : label === 'F' ? '#EC4899' : '#6B7280',
  })) : [];

  const ageDistData = demographics?.age_groups.map(g => ({
    label: g.range,
    value: g.count,
  })) ?? [];

  const losDistData = losDistribution?.map(b => ({
    label: b.bucket,
    value: b.count,
  })) ?? [];

  const mortalityBarData = mortalityByType?.map(m => ({
    label: `${m.admission_type} (${m.rate}%)`,
    value: m.total,
    sublabel: `${m.deaths} deaths`,
  })) ?? [];

  const icuBarData = icuUnits?.map(u => ({
    label: u.careunit,
    value: u.admission_count,
    sublabel: `${Number(u.avg_los_days).toFixed(1)}d avg`,
  })) ?? [];

  // Preserve dataset param in navigation
  const datasetSuffix = dataset !== 'mimiciv' ? `&dataset=${dataset}` : '';

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Population Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Aggregate metrics across the {datasetLabel} inpatient population</p>
      </div>

      {/* Headline Metrics Row */}
      {metricsQ.isLoading ? (
        <div className="flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} className="h-20 flex-1" />)}
        </div>
      ) : metricsQ.isError ? (
        <ErrorBox message="Failed to load metrics" />
      ) : metrics ? (
        <div className="flex gap-4 flex-wrap">
          <MetricCard label="Total Patients" value={Number(metrics.total_patients).toLocaleString()} color="#2DD4BF"
            onClick={() => navigate(`/morpheus/journey${dataset !== 'mimiciv' ? `?dataset=${dataset}` : ''}`)} />
          <MetricCard label="Total Admissions" value={Number(metrics.total_admissions).toLocaleString()} color="#2DD4BF"
            onClick={() => navigate(`/morpheus/journey${dataset !== 'mimiciv' ? `?dataset=${dataset}` : ''}`)} />
          <MetricCard label="ICU Rate" value={`${Number(metrics.icu_admission_rate).toFixed(1)}%`} color="#C9A227"
            onClick={() => navigate(`/morpheus/journey?icu=true${datasetSuffix}`)} />
          <MetricCard label="Mortality Rate" value={`${Number(metrics.mortality_rate).toFixed(1)}%`} color="#9B1B30"
            onClick={() => navigate(`/morpheus/journey?deceased=true${datasetSuffix}`)} />
          <MetricCard label="Avg LOS" value={`${Number(metrics.avg_los_days).toFixed(1)}d`} color="#3B82F6" />
          <MetricCard label="Avg ICU LOS" value={`${Number(metrics.avg_icu_los_days).toFixed(1)}d`} color="#C9A227"
            onClick={() => navigate(`/morpheus/journey?icu=true${datasetSuffix}`)} />
        </div>
      ) : null}

      {/* Trend Charts */}
      <div className="grid grid-cols-2 gap-4">
        {trendsQ.isLoading ? (
          <>
            <Shimmer className="h-56" />
            <Shimmer className="h-56" />
          </>
        ) : trendsQ.isError ? (
          <>
            <ErrorBox message="Failed to load admission trends" />
            <ErrorBox message="Failed to load mortality trends" />
          </>
        ) : (
          <>
            <TrendChart data={admissionTrendData} title="Admission Volume by Month" barLabel="Admissions" barColor="#2DD4BF" />
            <TrendChart data={mortalityTrendData} title="Mortality Rate by Month" barLabel="Admissions" lineLabel="Mortality %" barColor="#374151" lineColor="#E85A6B" />
          </>
        )}
      </div>

      {/* Top Diagnoses + Procedures */}
      <div className="grid grid-cols-2 gap-4">
        {dxQ.isLoading ? <Shimmer className="h-64" /> : dxQ.isError ? <ErrorBox message="Failed to load diagnoses" /> : (
          <HorizontalBarChart data={dxBarData} title="Top 10 Diagnoses" barColor="#C9A227" />
        )}
        {pxQ.isLoading ? <Shimmer className="h-64" /> : pxQ.isError ? <ErrorBox message="Failed to load procedures" /> : (
          <HorizontalBarChart data={pxBarData} title="Top 10 Procedures" barColor="#2DD4BF" />
        )}
      </div>

      {/* Demographics */}
      <div className="grid grid-cols-2 gap-4">
        {demoQ.isLoading ? (
          <>
            <Shimmer className="h-48" />
            <Shimmer className="h-48" />
          </>
        ) : demoQ.isError ? (
          <>
            <ErrorBox message="Failed to load gender data" />
            <ErrorBox message="Failed to load age data" />
          </>
        ) : (
          <>
            <DonutChart data={genderData} title="Gender Distribution" />
            <DistributionChart data={ageDistData} title="Age Distribution" barColor="#3B82F6" />
          </>
        )}
      </div>

      {/* LOS + Mortality by Type */}
      <div className="grid grid-cols-2 gap-4">
        {losQ.isLoading ? <Shimmer className="h-48" /> : losQ.isError ? <ErrorBox message="Failed to load LOS data" /> : (
          <DistributionChart data={losDistData} title="Length of Stay Distribution" barColor="#2DD4BF" />
        )}
        {mortTypeQ.isLoading ? <Shimmer className="h-48" /> : mortTypeQ.isError ? <ErrorBox message="Failed to load mortality data" /> : (
          <HorizontalBarChart data={mortalityBarData} title="Mortality by Admission Type" barColor="#9B1B30" />
        )}
      </div>

      {/* ICU Utilization */}
      {icuQ.isLoading ? <Shimmer className="h-48" /> : icuQ.isError ? <ErrorBox message="Failed to load ICU data" /> : (
        <HorizontalBarChart data={icuBarData} title="ICU Utilization by Unit" barColor="#C9A227" maxItems={20} />
      )}

      {/* Quick Actions */}
      <div className="rounded-xl border border-zinc-800 bg-[#151518] p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Quick Actions</h3>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/morpheus/journey?icu=true${datasetSuffix}`)}
            className="rounded-lg bg-[#9B1B30] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#9B1B30]/80 transition-colors"
          >
            View ICU Patients
          </button>
          <button
            onClick={() => navigate(`/morpheus/journey?deceased=true${datasetSuffix}`)}
            className="rounded-lg bg-[#9B1B30] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#9B1B30]/80 transition-colors"
          >
            View Deceased Patients
          </button>
          <button
            onClick={() => navigate(`/morpheus/journey${dataset !== 'mimiciv' ? `?dataset=${dataset}` : ''}`)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:border-[#60A5FA]/40 transition-colors"
          >
            Browse All Patients
          </button>
        </div>
      </div>
    </div>
  );
}
