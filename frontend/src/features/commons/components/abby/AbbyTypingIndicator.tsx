import AbbyAvatar from "./AbbyAvatar";
import type { AbbyTypingIndicatorProps, RagStage } from "../../types/abby";

interface StageConfig {
  key: RagStage;
  label: (state: AbbyTypingIndicatorProps["pipelineState"]) => string;
}

const STAGES: StageConfig[] = [
  {
    key: "analyzing",
    label: () => "Analyzing your question",
  },
  {
    key: "retrieving",
    label: (state) =>
      state.collections_count
        ? `Searching ${state.collections_count} knowledge collections`
        : "Searching knowledge collections",
  },
  {
    key: "reading",
    label: (state) =>
      state.sources_found
        ? `Reading ${state.sources_found} relevant sources`
        : "Reading relevant sources",
  },
  {
    key: "composing",
    label: () => "Composing response",
  },
];

const STAGE_ORDER: RagStage[] = [
  "analyzing",
  "retrieving",
  "reading",
  "composing",
  "complete",
];

function getStageStatus(
  stageKey: RagStage,
  currentStage: RagStage
): "done" | "active" | "pending" {
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  const stageIdx = STAGE_ORDER.indexOf(stageKey);
  if (stageIdx < currentIdx) return "done";
  if (stageIdx === currentIdx) return "active";
  return "pending";
}

function Spinner() {
  return (
    <span className="inline-block w-3 h-3 rounded-full border-[1.5px] border-border border-t-primary animate-spin" />
  );
}

function StageRow({
  config,
  status,
  pipelineState,
}: {
  config: StageConfig;
  status: "done" | "active" | "pending";
  pipelineState: AbbyTypingIndicatorProps["pipelineState"];
}) {
  return (
    <div
      className={`flex items-center gap-2 text-[11px] transition-colors duration-200 ${
        status === "done"
          ? "text-emerald-400"
          : status === "active"
            ? "text-foreground font-medium"
            : "text-muted-foreground/50"
      }`}
    >
      <span className="w-3.5 flex items-center justify-center">
        {status === "done" && <span className="text-[10px]">✓</span>}
        {status === "active" && <Spinner />}
        {status === "pending" && (
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
        )}
      </span>
      <span>{config.label(pipelineState)}</span>
    </div>
  );
}

export default function AbbyTypingIndicator({
  pipelineState,
}: AbbyTypingIndicatorProps) {
  if (
    pipelineState.stage === "complete" ||
    !STAGE_ORDER.includes(pipelineState.stage)
  ) {
    return null;
  }

  if (pipelineState.stage === "error") {
    return (
      <div className="flex gap-2.5 px-4 py-3">
        <AbbyAvatar size="md" />
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-red-500/10 rounded-lg">
          <span className="text-[11px] text-red-400">
            Something went wrong: {pipelineState.error_message ?? "Unknown error"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 px-4 py-3">
      <AbbyAvatar size="md" />
      <div className="flex flex-col gap-1 py-1">
        {STAGES.map((config) => (
          <StageRow
            key={config.key}
            config={config}
            status={getStageStatus(config.key, pipelineState.stage)}
            pipelineState={pipelineState}
          />
        ))}
      </div>
    </div>
  );
}
