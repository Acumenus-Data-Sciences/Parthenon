import { PackageOpen } from "lucide-react";

export default function FhirExportPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F0EDE8]">FHIR Bulk Export</h1>
        <p className="mt-1 text-sm text-[#8A857D]">
          Export OMOP CDM data as FHIR R4 NDJSON files for interoperability.
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="rounded-lg border border-[#232328] bg-[#1a1a1f] p-8">
        <div className="flex flex-col items-center text-center max-w-md mx-auto py-6">
          <PackageOpen size={40} className="text-[#2DD4BF] mb-4" />
          <h2 className="text-lg font-semibold text-[#F0EDE8] mb-2">
            Coming Soon
          </h2>
          <p className="text-sm text-[#C5C0B8] mb-4">
            FHIR Bulk Export ($export) is under development. This feature will
            allow exporting OMOP CDM data as FHIR R4 NDJSON files for
            interoperability.
          </p>
          <p className="text-xs text-[#5A5650]">
            The backend endpoints for this feature have not been implemented
            yet.
          </p>
        </div>
      </div>
    </div>
  );
}
