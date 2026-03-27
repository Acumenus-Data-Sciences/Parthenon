// ---------------------------------------------------------------------------
// Strategus JSON Spec Preview / Editor
// Renders spec as editable JSON with validation and clipboard support
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback, useRef } from "react";
import { CheckCircle2, XCircle, Copy, RotateCcw } from "lucide-react";
import type { AnalysisSpecification } from "../types";

export interface JsonSpecEditorProps {
  spec: AnalysisSpecification;
  onSpecChange: (spec: AnalysisSpecification) => void;
}

export function JsonSpecEditor({ spec, onSpecChange }: JsonSpecEditorProps) {
  const generatedJson = JSON.stringify(spec, null, 2);
  const [text, setText] = useState(generatedJson);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync textarea when generated spec changes externally
  useEffect(() => {
    setText(generatedJson);
    setParseError(null);
    setIsValid(true);
  }, [generatedJson]);

  const lineCount = text.split("\n").length;

  const handleApply = useCallback(() => {
    try {
      const parsed = JSON.parse(text) as AnalysisSpecification;
      onSpecChange(parsed);
      setParseError(null);
      setIsValid(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid JSON";
      setParseError(msg);
      setIsValid(false);
    }
  }, [text, onSpecChange]);

  const handleReset = () => {
    setText(generatedJson);
    setParseError(null);
    setIsValid(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in insecure contexts; ignore
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#F0EDE8]">
              JSON Spec Preview
            </h2>
            <p className="mt-0.5 text-sm text-[#8A857D]">
              Review the generated analysis specification. Edit directly or
              apply changes below.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-[#232328] px-3 py-1.5 text-xs text-[#C5C0B8] transition-colors hover:border-[#5A5650] hover:text-[#F0EDE8]"
            >
              <Copy size={12} />
              {copied ? "Copied" : "Copy to Clipboard"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg border border-[#232328] px-3 py-1.5 text-xs text-[#C5C0B8] transition-colors hover:border-[#5A5650] hover:text-[#F0EDE8]"
            >
              <RotateCcw size={12} />
              Reset to Generated
            </button>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // Clear any previous error as user types
            if (parseError) {
              setParseError(null);
              setIsValid(true);
            }
          }}
          onBlur={handleApply}
          spellCheck={false}
          className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-4 py-3 font-mono text-sm text-[#C5C0B8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/40"
          style={{ minHeight: "500px", resize: "vertical" }}
        />

        {/* Footer: line count + status + apply button */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-[#5A5650]">{lineCount} lines</span>

          <div className="flex items-center gap-3">
            {parseError ? (
              <div className="flex items-center gap-1.5 text-xs text-[#9B1B30]">
                <XCircle size={13} />
                <span className="max-w-[400px] truncate">{parseError}</span>
              </div>
            ) : isValid ? (
              <div className="flex items-center gap-1.5 text-xs text-[#2DD4BF]">
                <CheckCircle2 size={13} />
                Valid JSON
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-[#C9A227] px-4 py-1.5 text-xs font-medium text-[#0E0E11] transition-colors hover:bg-[#C9A227]/80"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
