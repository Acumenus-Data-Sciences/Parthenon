import { Outlet, useLocation, useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { BedDouble, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import DatasetSelector from './DatasetSelector';

export default function MorpheusLayout() {
  const { t } = useTranslation('app');
  const location = useLocation();
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const TABS = [
    { path: '/morpheus', label: t('morpheus.common.navigation.dashboard'), exact: true },
    {
      path: '/morpheus/journey',
      label: t('morpheus.common.navigation.patientJourney'),
      exact: false,
    },
  ];

  const dataset = searchParams.get('dataset') || 'mimiciv';

  const handleDatasetChange = (schema: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('dataset', schema);
    setSearchParams(params, { replace: true });
  };

  const dsParam = dataset !== 'mimiciv' ? `?dataset=${dataset}` : '';
  const crumbs: Array<{ label: string; path?: string }> = [
    { label: t('morpheus.common.navigation.dashboard'), path: `/morpheus${dsParam}` },
  ];
  if (location.pathname.startsWith('/morpheus/journey')) {
    crumbs.push({
      label: t('morpheus.common.navigation.patientJourney'),
      path: `/morpheus/journey${dsParam}`,
    });
    if (subjectId) {
      crumbs.push({ label: t('morpheus.journey.patientCrumb', { subjectId }) });
    }
  }

  const activeTab = location.pathname === '/morpheus' ? '/morpheus'
    : location.pathname.startsWith('/morpheus/journey') ? '/morpheus/journey'
    : '/morpheus';

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b border-border-default bg-surface-raised px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary/[0.18]">
              <BedDouble className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-text-primary">{t('morpheus.common.brand')}</span>
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className="text-text-ghost">/</span>
                  {c.path ? (
                    <Link to={c.path} className="text-text-ghost hover:text-text-secondary transition-colors">{c.label}</Link>
                  ) : (
                    <span className="text-text-secondary">{c.label}</span>
                  )}
                </span>
              ))}
            </div>
            <DatasetSelector selectedSchema={dataset} onSelect={handleDatasetChange} />
          </div>
          <div className="flex items-center gap-0.5 border-b border-border-default">
            {TABS.map(({ path, label }) => (
              <button key={path} onClick={() => navigate(dataset !== 'mimiciv' ? `${path}?dataset=${dataset}` : path)}
                className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === path
                    ? 'font-semibold text-text-primary border-b-2 border-primary'
                    : 'text-text-ghost border-b-2 border-transparent hover:text-text-secondary'
                }`}>{label}</button>
            ))}
          </div>
          <Link to="/workbench" className="flex items-center gap-1.5 text-xs text-text-ghost hover:text-text-secondary transition-colors">
            <ArrowLeft className="h-3 w-3" /> {t('morpheus.common.navigation.workbench')}
          </Link>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Outlet context={{ dataset }} />
      </div>
    </div>
  );
}
