import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PiiBadgeProps {
  piiType: string;
}

function capitalizePiiType(type: string): string {
  const acronyms = new Set(["ssn", "dob", "mrn", "npi", "ein", "id", "ip", "url"]);
  if (acronyms.has(type.toLowerCase())) {
    return type.toUpperCase();
  }
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

export default function PiiBadge({ piiType }: PiiBadgeProps) {
  const { t } = useTranslation("app");

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded px-1.5 py-0.5"
      title={t("etl.profiler.pii.potentialTitle", { type: piiType })}
    >
      <ShieldAlert className="h-3 w-3" />
      {capitalizePiiType(piiType)}
    </span>
  );
}
