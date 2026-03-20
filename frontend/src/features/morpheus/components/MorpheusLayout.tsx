import { Outlet, useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { BedDouble, ArrowLeft } from 'lucide-react';

const TABS = [
  { path: '/morpheus', label: 'Dashboard', exact: true },
  { path: '/morpheus/journey', label: 'Patient Journey', exact: false },
];

export default function MorpheusLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { subjectId } = useParams();

  const crumbs: Array<{ label: string; path?: string }> = [{ label: 'Dashboard', path: '/morpheus' }];
  if (location.pathname.startsWith('/morpheus/journey')) {
    crumbs.push({ label: 'Patient Journey', path: '/morpheus/journey' });
    if (subjectId) {
      crumbs.push({ label: `Patient ${subjectId}` });
    }
  }

  const activeTab = location.pathname === '/morpheus' ? '/morpheus'
    : location.pathname.startsWith('/morpheus/journey') ? '/morpheus/journey'
    : '/morpheus';

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b border-gray-800 bg-[#0E0E11] px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#9B1B30]/15">
              <BedDouble className="h-4 w-4 text-[#9B1B30]" />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-gray-100">Morpheus</span>
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className="text-gray-600">/</span>
                  {c.path ? (
                    <Link to={c.path} className="text-gray-400 hover:text-gray-200 transition-colors">{c.label}</Link>
                  ) : (
                    <span className="text-gray-300">{c.label}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {TABS.map(({ path, label }) => (
              <button key={path} onClick={() => navigate(path)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === path ? 'bg-[#1A1A2E] text-[#2DD4BF]' : 'text-gray-500 hover:text-gray-300'
                }`}>{label}</button>
            ))}
          </div>
          <Link to="/workbench" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            <ArrowLeft className="h-3 w-3" /> Workbench
          </Link>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
