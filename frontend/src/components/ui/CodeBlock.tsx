import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  const { t } = useTranslation("common");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div className={cn("code-block", className)}>
      <div className="code-block-header">
        <span>{language ?? t("ui.codeFallback")}</span>
        <button
          className="code-block-copy"
          onClick={handleCopy}
          aria-label={t("ui.aria.copyCode")}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <pre className="code-block-body">
        <code>{code}</code>
      </pre>
    </div>
  );
}
