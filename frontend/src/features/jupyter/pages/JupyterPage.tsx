import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  ExternalLink,
  FolderOpen,
  Loader2,
  RefreshCw,
  ServerCog,
  SquareTerminal,
  BookOpenText,
  Lightbulb,
} from "lucide-react";
import { Panel, Badge, EmptyState } from "@/components/ui";
import { HelpButton } from "@/features/help";
import { useJupyterWorkspace } from "../hooks/useJupyterWorkspace";

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
    <div>
      {/* ── Page header ── */}
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <h1 className="page-title">Jupyter Workbench</h1>
            <Badge variant={data?.available ? "success" : "critical"}>
              {data?.available ? "Online" : "Unavailable"}
            </Badge>
          </div>
          <p className="page-subtitle">
            Embedded notebook environment for interactive research, custom analyses, and data exploration
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <button
            type="button"
            onClick={() => {
              setFrameReady(false);
              void refetch();
            }}
            className="btn btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {starterNotebookHref ? (
            <a href={starterNotebookHref} target="_blank" rel="noreferrer" className="btn btn-primary">
              <SquareTerminal className="h-4 w-4" />
              Starter Notebook
            </a>
          ) : (
            <span className="btn btn-secondary" style={{ opacity: 0.5, pointerEvents: "none" }}>
              <SquareTerminal className="h-4 w-4" />
              Starter Notebook
            </span>
          )}
          {labHref && (
            <a href={labHref} target="_blank" rel="noreferrer" className="btn btn-ghost">
              Open In New Tab
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <HelpButton helpKey="jupyter" />
        </div>
      </div>

      {/* ── Workspace info cards ── */}
      <div className="grid-metrics" style={{ marginBottom: "var(--space-4)" }}>
        <Panel
          header={
            <span className="panel-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <FolderOpen size={14} style={{ color: "var(--color-teal)" }} />
              Workspace
            </span>
          }
        >
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)", fontWeight: 500, marginBottom: "var(--space-1)" }}>
            {data?.workspace_path ?? "output/jupyter-notebook"}
          </p>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
            Writable notebook directory persisted in the repository for study-specific analysis.
          </p>
        </Panel>

        <Panel
          header={
            <span className="panel-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <BookOpenText size={14} style={{ color: "var(--color-gold)" }} />
              Repository Mount
            </span>
          }
        >
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)", fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace", marginBottom: "var(--space-1)" }}>
            {data?.repository_path ?? "/workspace/parthenon"}
          </p>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
            Read-only project mount for docs, code, and fixtures.
          </p>
        </Panel>

        <Panel
          header={
            <span className="panel-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <ServerCog size={14} style={{ color: "var(--color-teal)" }} />
              Runtime
            </span>
          }
        >
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)", fontWeight: 500, marginBottom: "var(--space-1)" }}>
            {data?.label ?? "JupyterLab 4.4"}
          </p>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
            Python 3.12 with pandas, polars, sqlalchemy, and direct database access.
          </p>
        </Panel>
      </div>

      {/* ── Main content: sidebar + iframe ── */}
      <div className="grid-two">
        {/* Left sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* Starter notebooks */}
          <Panel
            header={
              <span className="panel-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <SquareTerminal size={14} style={{ color: "var(--color-teal)" }} />
                Starter Notebooks
              </span>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {(data?.starter_notebooks ?? []).map((notebook) => (
                <a
                  key={notebook.filename}
                  href={notebook.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4 transition-colors hover:border-[#2DD4BF]/35 hover:bg-[#12131A]"
                  style={{ display: "block", textDecoration: "none" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
                    <div>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                        {notebook.name}
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                        {notebook.filename}
                      </div>
                    </div>
                    <ExternalLink size={14} style={{ color: "var(--color-teal)", flexShrink: 0, marginTop: 2 }} />
                  </div>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", lineHeight: 1.6, marginTop: "var(--space-2)" }}>
                    {notebook.description}
                  </p>
                </a>
              ))}
              {(data?.starter_notebooks ?? []).length === 0 && (
                <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-ghost)" }}>
                  No starter notebooks available.
                </p>
              )}
            </div>
          </Panel>

          {/* Mounted paths */}
          <Panel
            header={
              <span className="panel-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <FolderOpen size={14} style={{ color: "var(--color-gold)" }} />
                Mounted Paths
              </span>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {(data?.mounts ?? []).map((mount) => (
                <div key={mount.path} className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4">
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                    {mount.label}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-teal)", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                    {mount.path}
                  </div>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", lineHeight: 1.6, marginTop: "var(--space-2)" }}>
                    {mount.description}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          {/* Research guidance */}
          {(data?.hints ?? []).length > 0 && (
            <Panel
              header={
                <span className="panel-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <Lightbulb size={14} style={{ color: "var(--color-gold)" }} />
                  Research Guidance
                </span>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {data!.hints.map((hint, i) => (
                  <div key={i} className="rounded-lg border border-[#232328] bg-[#0E0E11] px-4 py-3" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                    {hint}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* Right: embedded JupyterLab */}
        <div
          ref={shellRef}
          className="panel"
          style={{ position: "relative", overflow: "hidden", padding: 0 }}
        >
          {isLoading && (
            <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg-base)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--color-teal)" }} />
                Loading Jupyter workspace...
              </div>
            </div>
          )}

          {!isLoading && !data?.available && (
            <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg-base)" }}>
              <EmptyState
                icon={<ServerCog size={28} />}
                title="Jupyter is not reachable"
                message="The notebook service is currently unavailable. Refresh after the container is healthy."
              />
            </div>
          )}

          {!isLoading && data?.available && !frameReady && (
            <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(14,14,17,0.88)", backdropFilter: "blur(4px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-teal)" }} />
                Booting embedded JupyterLab...
              </div>
            </div>
          )}

          <iframe
            ref={frameRef}
            src={data?.available ? data.embed_url : "about:blank"}
            title="Parthenon Jupyter"
            style={{ width: "100%", height: frameHeight, border: "none", display: "block" }}
            onLoad={() => {
              setFrameReady(true);
              recalcHeight();
            }}
          />
        </div>
      </div>
    </div>
  );
}
