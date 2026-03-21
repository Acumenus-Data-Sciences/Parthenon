import { cn } from "@/lib/utils";
import type { FhirHealthStatus } from "../../api/fhirApi";

export function HealthBadge({ status }: { status: FhirHealthStatus | undefined }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#232328] text-[#8A857D]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#8A857D]" />
        Checking...
      </span>
    );
  }

  const isHealthy = status.status === "ok" || status.status === "healthy";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        isHealthy
          ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
          : "bg-[#E85A6B]/15 text-[#E85A6B]",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isHealthy ? "bg-[#2DD4BF] animate-pulse" : "bg-[#E85A6B]",
        )}
      />
      {isHealthy ? "Service Online" : "Service Offline"}
    </span>
  );
}
