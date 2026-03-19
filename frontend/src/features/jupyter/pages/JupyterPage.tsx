import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  AlertCircle,
} from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { Drawer } from "@/components/ui/Drawer";
import { useJupyterWorkspace } from "../hooks/useJupyterWorkspace";
import { useJupyterSession } from "../hooks/useJupyterSession";

type ServerState = "idle" | "authenticating" | "spawning" | "running" | "failed";

export default function JupyterPage() {
  const { data, isLoading, isFetching, refetch } = useJupyterWorkspace();
  const session = useJupyterSession();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [frameHeight, setFrameHeight] = useState(780);
  const [serverState, setServerState] = useState<ServerState>("idle");
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Auto-authenticate when Hub is available and we're idle
  useEffect(() => {
    if (data?.available && serverState === "idle") {
      launchSession();
    }
  }, [data?.available]); // eslint-disable-line react-hooks/exhaustive-deps

  const launchSession = useCallback(() => {
    setServerState("authenticating");
    setErrorMsg(null);

    session.mutate(undefined, {
      onSuccess: (result) => {
        // Set iframe src to the JWT login URL — Hub validates and redirects to user server
        setEmbedUrl(result.login_url);
        setServerState("spawning");
      },
      onError: (error) => {
        setServerState("failed");
        setErrorMsg(error instanceof Error ? error.message : "Failed to create session");
      },
    });
  }, [session]);

  // Poll workspace to detect when server becomes ready
  useEffect(() => {
    if (serverState !== "spawning") return;
    const interval = setInterval(() => {
      void refetch();
    }, 2000);
    return () => clearInterval(interval);
  }, [serverState, refetch]);

  // Transition from spawning → running when server is ready
  useEffect(() => {
    if (serverState === "spawning" && data?.server_status === "running") {
      setServerState("running");
    }
  }, [data?.server_status, serverState]);

  const serverBadge = () => {
    switch (serverState) {
      case "idle":
        return <Badge variant={data?.available ? "success" : "critical"}>{data?.available ? "Hub Online" : "Unavailable"}</Badge>;
      case "authenticating":
        return <Badge variant="warning">Authenticating...</Badge>;
      case "spawning":
        return <Badge variant="warning">Starting Server...</Badge>;
      case "running":
        return <Badge variant="success">Running</Badge>;
      case "failed":
        return <Badge variant="critical">Failed</Badge>;
    }
  };

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <h1 className="page-title">Jupyter Workbench</h1>
            {serverBadge()}
          </div>
          <p className="page-subtitle">
            Your personal notebook environment for interactive research, custom analyses, and data exploration
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <button
            type="button"
            onClick={() => {
              setServerState("idle");
              void refetch();
            }}
            className="btn btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {serverState === "running" && (
            <a
              href="/jupyter/hub/home"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
            >
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
        {/* Loading Hub */}
        {isLoading && (
          <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg-base)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--color-teal)" }} />
              Checking JupyterHub...
            </div>
          </div>
        )}

        {/* Hub unavailable */}
        {!isLoading && !data?.available && (
          <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg-base)" }}>
            <EmptyState
              icon={<ServerCog size={28} />}
              title="JupyterHub is not reachable"
              message="The notebook service is currently unavailable. Refresh after the container is healthy."
            />
          </div>
        )}

        {/* Authenticating / Spawning overlay */}
        {(serverState === "authenticating" || serverState === "spawning") && (
          <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(14,14,17,0.88)", backdropFilter: "blur(4px)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-teal)" }} />
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                {serverState === "authenticating" ? "Authenticating..." : "Starting your notebook server..."}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-ghost)" }}>
                This may take up to 30 seconds on first launch
              </div>
            </div>
          </div>
        )}

        {/* Failed overlay */}
        {serverState === "failed" && (
          <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(14,14,17,0.88)", backdropFilter: "blur(4px)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)", maxWidth: 400, textAlign: "center" }}>
              <AlertCircle className="h-6 w-6" style={{ color: "var(--color-crimson)" }} />
              <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-primary)" }}>
                Failed to start notebook server
              </div>
              {errorMsg && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                  {errorMsg}
                </div>
              )}
              <button type="button" onClick={launchSession} className="btn btn-primary" style={{ marginTop: "var(--space-2)" }}>
                Retry
              </button>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={embedUrl ?? "about:blank"}
          title="Parthenon Jupyter"
          style={{ width: "100%", height: frameHeight, border: "none", display: "block" }}
          onLoad={() => {
            if (serverState === "spawning" || serverState === "authenticating") {
              setServerState("running");
            }
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
                  Python 3.12 with pandas, polars, sqlalchemy, and role-based database access.
                </div>
              </div>
              <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4">
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-ghost)", marginBottom: 2 }}>Private Workspace</div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {data?.workspace_path ?? "/home/jovyan/notebooks"}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 4 }}>
                  Your personal notebook directory. Persists across sessions — your work is always saved.
                </div>
              </div>
              <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4">
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-ghost)", marginBottom: 2 }}>Shared Folder</div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {data?.shared_path ?? "/home/jovyan/shared"}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 4 }}>
                  Copy notebooks here to share with colleagues. All Jupyter users can read this folder.
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
                <div key={notebook.filename} className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4">
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                    {notebook.name}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                    {notebook.filename}
                  </div>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", lineHeight: 1.6, marginTop: "var(--space-2)" }}>
                    {notebook.description}
                  </p>
                </div>
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
                  Tips
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
              <a
                href="/jupyter/hub/home"
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-teal)", textDecoration: "none" }}
              >
                <ExternalLink size={14} />
                Open JupyterHub in new tab
              </a>
            </div>
          </section>
        </div>
      </Drawer>
    </div>
  );
}
