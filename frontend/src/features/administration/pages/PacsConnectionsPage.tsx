import { useState } from "react";
import { Plus, HardDrive, AlertCircle } from "lucide-react";
import {
  usePacsConnections,
  useTestPacsConnection,
  useRefreshPacsStats,
  useDeletePacsConnection,
  useSetDefaultPacs,
} from "../hooks/usePacsConnections";
import PacsConnectionCard from "../components/PacsConnectionCard";
import PacsConnectionFormModal from "../components/PacsConnectionFormModal";
import PacsStudyBrowser from "../components/PacsStudyBrowser";
import type { PacsConnection, PacsTestResult } from "../api/pacsApi";

export default function PacsConnectionsPage() {
  const { data: connections, isLoading, isError, refetch } = usePacsConnections();
  const testMut = useTestPacsConnection();
  const refreshMut = useRefreshPacsStats();
  const deleteMut = useDeletePacsConnection();
  const setDefaultMut = useSetDefaultPacs();

  // editConn: null = modal closed, undefined = create mode, PacsConnection = edit mode
  const [editConn, setEditConn] = useState<PacsConnection | null | undefined>(null);
  const [browseConn, setBrowseConn] = useState<PacsConnection | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [_testResults, setTestResults] = useState<Record<number, PacsTestResult>>({});

  async function handleTest(id: number) {
    setTestingId(id);
    try {
      const result = await testMut.mutateAsync(id);
      setTestResults((prev) => ({ ...prev, [id]: result }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleRefresh(id: number) {
    setRefreshingId(id);
    try {
      await refreshMut.mutateAsync(id);
    } finally {
      setRefreshingId(null);
    }
  }

  function handleDelete(id: number) {
    deleteMut.mutate(id);
  }

  function handleSetDefault(id: number) {
    setDefaultMut.mutate(id);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">PACS Connections</h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Configure and monitor DICOM imaging servers. Browse studies, check health, and manage multi-PACS environments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditConn(undefined)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors"
        >
          <Plus size={16} />
          Add Connection
        </button>
      </div>

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-3 rounded-xl border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-4 py-3">
          <AlertCircle size={16} className="text-[#E85A6B] flex-shrink-0" />
          <span className="text-sm text-[#E85A6B]">
            Failed to load PACS connections.
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className="ml-auto text-xs font-medium text-[#E85A6B] underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="animate-pulse rounded-xl border border-[#232328] bg-[#151518] p-4"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-2.5 w-2.5 rounded-full bg-[#232328]" />
                <div className="h-4 w-36 rounded bg-[#232328]" />
                <div className="h-4 w-16 rounded bg-[#232328]" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((c) => (
                  <div
                    key={c}
                    className="rounded-lg bg-[#0E0E11] px-2.5 py-4"
                  >
                    <div className="h-3 w-8 mx-auto rounded bg-[#232328] mb-1" />
                    <div className="h-2.5 w-12 mx-auto rounded bg-[#232328]" />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-3">
                <div className="h-3 w-32 rounded bg-[#232328]" />
                <div className="h-6 w-24 rounded bg-[#232328]" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && connections && connections.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#232328] bg-[#151518] py-14 text-[#5A5650]">
          <HardDrive size={36} className="mb-3 opacity-40" />
          <p className="text-sm font-medium text-[#8A857D]">
            No PACS connections configured
          </p>
          <p className="text-xs mt-1">
            Add a connection to begin browsing DICOM imaging studies.
          </p>
          <button
            type="button"
            onClick={() => setEditConn(undefined)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors"
          >
            <Plus size={14} />
            Add Connection
          </button>
        </div>
      )}

      {/* Card grid */}
      {!isLoading && connections && connections.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {connections.map((conn) => (
            <PacsConnectionCard
              key={conn.id}
              connection={conn}
              onTest={handleTest}
              onRefresh={handleRefresh}
              onEdit={(c) => setEditConn(c)}
              onDelete={handleDelete}
              onBrowse={(c) => setBrowseConn(c)}
              onSetDefault={handleSetDefault}
              isTesting={testingId === conn.id}
              isRefreshing={refreshingId === conn.id}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      <PacsConnectionFormModal
        isOpen={editConn !== null}
        onClose={() => setEditConn(null)}
        editConnection={editConn === undefined ? null : (editConn ?? null)}
      />

      {/* Study browser drawer */}
      <PacsStudyBrowser
        connection={browseConn}
        onClose={() => setBrowseConn(null)}
      />
    </div>
  );
}
