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
  HelpCircle,
} from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { Drawer } from "@/components/ui/Drawer";
import { useJupyterWorkspace } from "../hooks/useJupyterWorkspace";

export default function JupyterPage() {
  const { data, isLoading, isFetching, refetch } = useJupyterWorkspace();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [frameHeight, setFrameHeight] = useState(780);
  const [frameReady, setFrameReady] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const recalcHeight = useCallback(() => {
    if (!shellRef.current) return;
    const rect = shellRef.current.getBoundingClientRect();
    const available = window.innerHeight - rect.top - 12;
    setFrameHeight(Math.max(720, available));
  }, []);

  useLayoutEffect(() => {
    recalcHeight();
    window.addEventListener("resize", recalcHeight);
    return () => window.removeEventListener("resize", recalcHeight);
  }, [recalcHeight]);

  const starterNotebookHref = data?.available ? data.starter_notebook_url : undefined;
  const labHref = data?.available ? data.lab_url : undefined;

  const embedUrl = data?.available ? data.embed_url : "about:blank";

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
          {labHref && (
            <a href={labHref} target="_blank" rel="noreferrer" className="btn btn-ghost">
              Open In New Tab
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="Workspace details"
            title="Workspace details"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5A5650] hover:text-[#8A857D] hover:bg-[#1E1E24] transition-colors"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {/* ── Full-width embedded JupyterLab ── */}
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
          src={embedUrl}
          title="Parthenon Jupyter"
          style={{ width: "100%", height: frameHeight, border: "none", display: "block" }}
          onLoad={() => {
            setFrameReady(true);
            recalcHeight();
          }}
        />
      </div>

      {/* ── Help drawer with workspace details ── */}
      <Drawer
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Jupyter Workspace Details"
        size="lg"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Environment info */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <ServerCog size={14} style={{ color: "var(--color-teal)" }} />
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-ghost)" }}>
                Environment
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4">
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-ghost)", marginBottom: 2 }}>Runtime</div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                  {data?.label ?? "JupyterLab 4.4"}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 4 }}>
                  Python 3.12 with pandas, polars, sqlalchemy, and direct database access.
                </div>
              </div>
              <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4">
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-ghost)", marginBottom: 2 }}>Workspace Path</div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {data?.workspace_path ?? "output/jupyter-notebook"}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 4 }}>
                  Writable notebook directory persisted in the repository for study-specific analysis.
                </div>
              </div>
              <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4">
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-ghost)", marginBottom: 2 }}>Repository Mount</div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {data?.repository_path ?? "/workspace/parthenon"}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 4 }}>
                  Read-only project mount for docs, code, and fixtures.
                </div>
              </div>
            </div>
          </section>

          {/* Mounted paths */}
          {(data?.mounts ?? []).length > 0 && (
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                <FolderOpen size={14} style={{ color: "var(--color-gold)" }} />
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-ghost)" }}>
                  Mounted Paths
                </span>
              </div>
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
            </section>
          )}

          {/* Starter notebooks */}
          <section>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <SquareTerminal size={14} style={{ color: "var(--color-teal)" }} />
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-ghost)" }}>
                Starter Notebooks
              </span>
            </div>
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
          </section>

          {/* Research guidance */}
          {(data?.hints ?? []).length > 0 && (
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                <Lightbulb size={14} style={{ color: "var(--color-gold)" }} />
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-ghost)" }}>
                  Research Guidance
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {data!.hints.map((hint, i) => (
                  <div key={i} className="rounded-lg border border-[#232328] bg-[#0E0E11] px-4 py-3">
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}>
                      <span
                        style={{
                          marginTop: 1,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "rgba(45,212,191,0.15)",
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                          color: "var(--color-teal)",
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                        {hint}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Quick links */}
          <section style={{ borderTop: "1px solid #1E1E24", paddingTop: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <BookOpenText size={14} style={{ color: "var(--color-gold)" }} />
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-ghost)" }}>
                Quick Links
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {labHref && (
                <a
                  href={labHref}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-teal)", textDecoration: "none" }}
                >
                  <ExternalLink size={14} />
                  Open JupyterLab in new tab
                </a>
              )}
              {starterNotebookHref && (
                <a
                  href={starterNotebookHref}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-teal)", textDecoration: "none" }}
                >
                  <SquareTerminal size={14} />
                  Open starter notebook
                </a>
              )}
            </div>
          </section>
        </div>
      </Drawer>
    </div>
  );
}
