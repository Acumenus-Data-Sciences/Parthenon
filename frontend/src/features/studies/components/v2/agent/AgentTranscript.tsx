import type { TranscriptTurn } from "../../../stores/studyDesignerAgentStore";

interface Props {
  transcript: TranscriptTurn[];
  isStreaming: boolean;
}

export function AgentTranscript({ transcript, isStreaming }: Props) {
  return (
    <div data-testid="agent-transcript" className="flex flex-col gap-3">
      {transcript.map((turn, i) => (
        <div key={i} className={turn.role === "user" ? "text-[#C9A227]" : "text-slate-100"}>
          <div className="text-xs uppercase tracking-wide opacity-60">{turn.role}</div>
          <div className="whitespace-pre-wrap">{turn.text}</div>
          {turn.tools && turn.tools.length > 0 && (
            <ul className="mt-1 text-xs text-[#2DD4BF]">
              {turn.tools.map((t, j) => (
                <li key={j}>⚙ {t.name}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {isStreaming && <div className="text-xs text-slate-400">…thinking</div>}
    </div>
  );
}
