import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
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

function LoadingPanel({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 size={20} className="animate-spin text-text-ghost" />
    </div>
  );
}

function ErrorPanel({ message = 'Failed to load' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-8 text-sm text-critical">
      {message}
    </div>
  );
}

function ChartCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border-default/60 bg-surface-base p-4 ${className}`}>
      {children}
    </div>
  );
}

export default function MorpheusDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dataset = searchParams.get('dataset') || 'mimiciv';

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

  const admissionTrendData = trends?.map(t => ({ label: t.month, barValue: t.admissions })) ?? [];
  const mortalityTrendData = trends?.map(t => ({ label: t.month, barValue: t.admissions, lineValue: t.mortality_rate })) ?? [];

  const dxBarData = dxQ.data?.map(d => ({
    label: d.description || d.icd_code,
    value: d.patient_count,
    sublabel: d.icd_code,
  })) ?? [];

  const pxBarData = pxQ.data?.map(p => ({
    label: p.description || p.icd_code,
    value: p.patient_count,
    sublabel: p.icd_code,
  })) ?? [];

  const genderData = demoQ.data ? Object.entries(demoQ.data.gender).map(([label, value]) => ({
    label: label === 'M' ? 'Male' : label === 'F' ? 'Female' : label,
    value: value as number,
    color: label === 'M' ? '#3B82F6' : label === 'F' ? '#EC4899' : '#6B7280',
  })) : [];

  const ageDistData = demoQ.data?.age_groups.map(g => ({ label: g.range, value: g.count })) ?? [];
  const losDistData = losQ.data?.map(b => ({ label: b.bucket, value: b.count })) ?? [];
  const mortalityBarData = mortTypeQ.data?.map(m => ({
    label: m.admission_type,
    value: m.total,
    sublabel: `${m.deaths} deaths (${m.rate}%)`,
  })) ?? [];
  const icuBarData = icuQ.data?.map(u => ({
    label: u.careunit,
    value: u.admission_count,
    sublabel: `${Number(u.avg_los_days).toFixed(1)}d avg`,
  })) ?? [];

  const ds = dataset !== 'mimiciv' ? `&dataset=${dataset}` : '';
  const dsQ = dataset !== 'mimiciv' ? `?dataset=${dataset}` : '';

  return (
    <div className="px-5 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{datasetLabel} Population Dashboard</h1>
          <p className="text-xs text-text-ghost mt-0.5">Aggregate metrics across the inpatient population</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/morpheus/journey?icu=true${ds}`)}
            className="rounded-lg bg-primary/80 px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary transition-colors">
            ICU Patients
          </button>
          <button onClick={() => navigate(`/morpheus/journey?deceased=true${ds}`)}
            className="rounded-lg bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-accent transition-colors">
            Deceased
          </button>
          <button onClick={() => navigate(`/morpheus/journey${dsQ}`)}
            className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-secondary hover:border-border-hover transition-colors">
            Browse All
          </button>
        </div>
      </div>

      {/* KPI Row — 6 cards in a tight grid */}
      {metricsQ.isLoading ? (
        <LoadingPanel className="h-20" />
      ) : metricsQ.isError ? (
        <ErrorPanel message="Failed to load metrics" />
      ) : metrics ? (
        <div className="grid grid-cols-6 gap-3">
          <MetricCard label="Patients" value={Number(metrics.total_patients).toLocaleString()} color="var(--success)"
            onClick={() => navigate(`/morpheus/journey${dsQ}`)} />
          <MetricCard label="Admissions" value={Number(metrics.total_admissions).toLocaleString()} color="var(--success)"
            onClick={() => navigate(`/morpheus/journey${dsQ}`)} />
          <MetricCard label="ICU Rate" value={`${Number(metrics.icu_admission_rate).toFixed(1)}%`} color="var(--accent)"
            onClick={() => navigate(`/morpheus/journey?icu=true${ds}`)} />
          <MetricCard label="Mortality" value={`${Number(metrics.mortality_rate).toFixed(1)}%`} color="var(--primary)"
            onClick={() => navigate(`/morpheus/journey?deceased=true${ds}`)} />
          <MetricCard label="Avg LOS" value={`${Number(metrics.avg_los_days).toFixed(1)}d`} color="var(--info)" />
          <MetricCard label="Avg ICU LOS" value={`${Number(metrics.avg_icu_los_days).toFixed(1)}d`} color="var(--accent)"
            onClick={() => navigate(`/morpheus/journey?icu=true${ds}`)} />
        </div>
      ) : null}

      {/* Row 1: Trends (2 cols) */}
      <div className="grid grid-cols-2 gap-3">
        <ChartCard>
          {trendsQ.isLoading ? <LoadingPanel className="h-48" /> : trendsQ.isError ? <ErrorPanel /> : (
            <TrendChart data={admissionTrendData} title="Admission Volume" barLabel="Admissions" barColor="var(--success)" />
          )}
        </ChartCard>
        <ChartCard>
          {trendsQ.isLoading ? <LoadingPanel className="h-48" /> : trendsQ.isError ? <ErrorPanel /> : (
            <TrendChart data={mortalityTrendData} title="Mortality Trend" barLabel="Admissions" lineLabel="Mortality %" barColor="var(--surface-highlight)" lineColor="var(--critical)" />
          )}
        </ChartCard>
      </div>

      {/* Row 2: Demographics (3 cols — gender, age, LOS) */}
      <div className="grid grid-cols-3 gap-3">
        <ChartCard>
          {demoQ.isLoading ? <LoadingPanel className="h-44" /> : demoQ.isError ? <ErrorPanel /> : (
            <DonutChart data={genderData} title="Gender" />
          )}
        </ChartCard>
        <ChartCard>
          {demoQ.isLoading ? <LoadingPanel className="h-44" /> : demoQ.isError ? <ErrorPanel /> : (
            <DistributionChart data={ageDistData} title="Age Distribution" barColor="var(--info)" />
          )}
        </ChartCard>
        <ChartCard>
          {losQ.isLoading ? <LoadingPanel className="h-44" /> : losQ.isError ? <ErrorPanel /> : (
            <DistributionChart data={losDistData} title="Length of Stay" barColor="var(--success)" />
          )}
        </ChartCard>
      </div>

      {/* Row 3: Top Diagnoses + Procedures (2 cols) */}
      <div className="grid grid-cols-2 gap-3">
        <ChartCard>
          {dxQ.isLoading ? <LoadingPanel className="h-56" /> : dxQ.isError ? <ErrorPanel /> : (
            <HorizontalBarChart data={dxBarData} title="Top 10 Diagnoses" barColor="var(--accent)" />
          )}
        </ChartCard>
        <ChartCard>
          {pxQ.isLoading ? <LoadingPanel className="h-56" /> : pxQ.isError ? <ErrorPanel /> : (
            <HorizontalBarChart data={pxBarData} title="Top 10 Procedures" barColor="var(--success)" />
          )}
        </ChartCard>
      </div>

      {/* Row 4: Mortality by Type + ICU Utilization (2 cols) */}
      <div className="grid grid-cols-2 gap-3">
        <ChartCard>
          {mortTypeQ.isLoading ? <LoadingPanel className="h-44" /> : mortTypeQ.isError ? <ErrorPanel /> : (
            <HorizontalBarChart data={mortalityBarData} title="Mortality by Admission Type" barColor="var(--primary)" />
          )}
        </ChartCard>
        <ChartCard>
          {icuQ.isLoading ? <LoadingPanel className="h-44" /> : icuQ.isError ? <ErrorPanel /> : (
            <HorizontalBarChart data={icuBarData} title="ICU Utilization by Unit" barColor="var(--accent)" maxItems={20} />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
