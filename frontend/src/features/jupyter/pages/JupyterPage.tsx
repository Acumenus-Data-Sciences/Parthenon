import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  BookOpenText,
  ExternalLink,
  FolderOpen,
  Loader2,
  RefreshCw,
  ServerCog,
  SquareTerminal,
} from "lucide-react";
import { useJupyterWorkspace } from "../hooks/useJupyterWorkspace";

function StatusPill({ available }: { available: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
        available
          ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-[#8EF3E2]"
          : "border-[#E85A6B]/30 bg-[#9B1B30]/10 text-[#F2B7C0]"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${available ? "bg-[#2DD4BF]" : "bg-[#E85A6B]"}`} />
      {available ? "Online" : "Unavailable"}
    </div>
  );
}

function WorkspaceCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof FolderOpen;
}) {
  return (
    <div className="rounded-2xl border border-[#1E1E23] bg-[#121217]/88 p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#19191F] text-[#2DD4BF]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A857D]">{label}</div>
          <div className="mt-1 text-sm font-medium text-[#F0EDE8]">{value}</div>
        </div>
      </div>
      <p className="text-sm leading-6 text-[#8A857D]">{description}</p>
    </div>
  );
}

export default function JupyterPage() {
  const { data, isLoading, isFetching, refetch } = useJupyterWorkspace();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [frameHeight, setFrameHeight] = useState(780);
  const [frameReady, setFrameReady] = useState(false);

  const recalcHeight = useCallback(() => {
    if (!shellRef.current) return;
    const rect = shellRef.current.getBoundingClientRect();
    const available = window.innerHeight - rect.top - 28;
    setFrameHeight(Math.max(720, available));
  }, []);

  useLayoutEffect(() => {
    recalcHeight();
    window.addEventListener("resize", recalcHeight);
    return () => window.removeEventListener("resize", recalcHeight);
  }, [recalcHeight]);

  const starterNotebookHref = data?.available ? data.starter_notebook_url : undefined;
  const labHref = data?.available ? data.lab_url : undefined;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-[#1E1E23] bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_32%),linear-gradient(180deg,_#15151B_0%,_#0E0E11_100%)]">
        <div className="flex flex-wrap items-start justify-between gap-4 p-6 md:p-7">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2DD4BF]/25 bg-[#2DD4BF]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7CE8D5]">
              <BookOpenText className="h-3.5 w-3.5" />
              Embedded Research Workbench
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-[#F0EDE8]">Jupyter</h1>
                <StatusPill available={data?.available ?? false} />
              </div>
              <p className="max-w-2xl text-sm leading-7 text-[#B7B1A8]">
                Run notebook-based research directly inside Parthenon with a persistent workspace,
                a seeded starter notebook, and the platform repository mounted for reference.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setFrameReady(false);
                void refetch();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#2B2B33] bg-[#16161C] px-4 py-2.5 text-sm font-medium text-[#D7D1C8] transition-colors hover:bg-[#1C1C24]"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {starterNotebookHref ? (
              <a
                href={starterNotebookHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#C9A227]/30 bg-[#C9A227]/10 px-4 py-2.5 text-sm font-medium text-[#F7E8A6] transition-colors hover:bg-[#C9A227]/15"
              >
                <SquareTerminal className="h-4 w-4" />
                Starter Notebook
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-xl border border-[#3A3330] bg-[#1A1716] px-4 py-2.5 text-sm font-medium text-[#8A857D]">
                <SquareTerminal className="h-4 w-4" />
                Starter Notebook
              </span>
            )}
            {labHref ? (
              <a
                href={labHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#2DD4BF]/30 bg-[#2DD4BF]/12 px-4 py-2.5 text-sm font-medium text-[#B9FFF1] transition-colors hover:bg-[#2DD4BF]/18"
              >
                Open In New Tab
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-xl border border-[#24322F] bg-[#121917] px-4 py-2.5 text-sm font-medium text-[#6B877F]">
                Open In New Tab
                <ExternalLink className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <WorkspaceCard
          label="Workspace"
          value={data?.workspace_path ?? "output/jupyter-notebook"}
          description="Writable notebook directory persisted in the repository for study-specific analysis and versioned research artifacts."
          icon={FolderOpen}
        />
        <WorkspaceCard
          label="Repository Mount"
          value={data?.repository_path ?? "/workspace/parthenon"}
          description="Read-only project mount for docs, code, and fixtures when a notebook needs platform context."
          icon={BookOpenText}
        />
        <WorkspaceCard
          label="Runtime"
          value={data?.label ?? "Jupyter Research Workbench"}
          description="JupyterLab served through the Parthenon proxy with embedded launch, refresh, and health-aware empty states."
          icon={ServerCog}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#1E1E23] bg-[#121217]/90 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#F0EDE8]">
              <SquareTerminal className="h-4 w-4 text-[#2DD4BF]" />
              Starter Notebook
            </div>
            <div className="space-y-3">
              {(data?.starter_notebooks ?? []).map((notebook) => (
                <a
                  key={notebook.filename}
                  href={notebook.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-[#23232A] bg-[#0F1014] p-4 transition-colors hover:border-[#2DD4BF]/35 hover:bg-[#12131A]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[#F0EDE8]">{notebook.name}</div>
                      <div className="mt-1 text-xs text-[#8A857D]">{notebook.filename}</div>
                    </div>
                    <ExternalLink className="mt-0.5 h-4 w-4 text-[#5ECCC0]" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#A79F94]">{notebook.description}</p>
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#1E1E23] bg-[#121217]/90 p-5">
            <div className="mb-4 text-sm font-semibold text-[#F0EDE8]">Mounted Paths</div>
            <div className="space-y-3">
              {(data?.mounts ?? []).map((mount) => (
                <div key={mount.path} className="rounded-2xl border border-[#23232A] bg-[#0F1014] p-4">
                  <div className="text-sm font-medium text-[#F0EDE8]">{mount.label}</div>
                  <div className="mt-1 font-mono text-xs text-[#5ECCC0]">{mount.path}</div>
                  <div className="mt-2 text-sm leading-6 text-[#8A857D]">{mount.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#1E1E23] bg-[#121217]/90 p-5">
            <div className="mb-4 text-sm font-semibold text-[#F0EDE8]">Research Guidance</div>
            <div className="space-y-3">
              {(data?.hints ?? []).map((hint) => (
                <div key={hint} className="rounded-2xl border border-[#23232A] bg-[#0F1014] px-4 py-3 text-sm leading-6 text-[#B7B1A8]">
                  {hint}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          ref={shellRef}
          className="relative overflow-hidden rounded-[28px] border border-[#1E1E23] bg-[#090A0D] shadow-[0_24px_90px_rgba(0,0,0,0.28)]"
        >
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0B0C10]">
              <div className="flex items-center gap-3 text-sm text-[#B7B1A8]">
                <Loader2 className="h-5 w-5 animate-spin text-[#2DD4BF]" />
                Loading Jupyter workspace...
              </div>
            </div>
          )}

          {!isLoading && !data?.available && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-[linear-gradient(180deg,_rgba(14,14,17,0.98)_0%,_rgba(18,18,23,0.98)_100%)] p-8">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#9B1B30]/20 text-[#F2B7C0]">
                  <ServerCog className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-semibold text-[#F0EDE8]">Jupyter is not reachable</h2>
                <p className="mt-3 text-sm leading-7 text-[#A79F94]">
                  The workbench route is registered, but the notebook service is currently unavailable.
                  Refresh after the container is healthy, or open the starter notebook link once the
                  service comes back.
                </p>
              </div>
            </div>
          )}

          {!isLoading && data?.available && !frameReady && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0B0C10]/88 backdrop-blur-sm">
              <div className="flex items-center gap-3 rounded-full border border-[#2DD4BF]/25 bg-[#121217]/90 px-4 py-2 text-sm text-[#D7D1C8]">
                <Loader2 className="h-4 w-4 animate-spin text-[#2DD4BF]" />
                Booting embedded JupyterLab...
              </div>
            </div>
          )}

          <iframe
            ref={frameRef}
            src={data?.available ? data.embed_url : "about:blank"}
            title="Parthenon Jupyter"
            className="w-full"
            style={{ height: frameHeight, border: "none" }}
            onLoad={() => {
              setFrameReady(true);
              recalcHeight();
            }}
          />
        </div>
      </section>
    </div>
  );
}
