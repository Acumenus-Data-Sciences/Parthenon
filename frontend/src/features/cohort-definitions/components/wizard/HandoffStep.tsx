import { useNavigate } from "react-router-dom";
import { Check, Wrench, BarChart3 } from "lucide-react";

export function HandoffStep() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#C9A227]">
          Step 3 of 3 &mdash; What&apos;s Next?
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => navigate("/cohort-definitions")}
          className="rounded-lg border border-[rgba(45,212,191,0.2)] bg-[rgba(45,212,191,0.05)] p-4 text-left transition-colors hover:border-[rgba(45,212,191,0.4)]"
        >
          <div className="flex items-center gap-2 text-[13px] font-medium text-[#2DD4BF]">
            <Check size={16} />
            Done &mdash; Save &amp; Close
          </div>
          <p className="mt-1 ml-[24px] text-[12px] text-[#888]">
            Cohort is saved and ready for use in analyses and studies.
          </p>
        </button>

        <button
          type="button"
          onClick={() => navigate("/cohort-definitions")}
          className="rounded-lg border border-[rgba(201,162,39,0.2)] bg-[rgba(201,162,39,0.05)] p-4 text-left transition-colors hover:border-[rgba(201,162,39,0.4)]"
        >
          <div className="flex items-center gap-2 text-[13px] font-medium text-[#C9A227]">
            <Wrench size={16} />
            Open in Advanced Editor
          </div>
          <p className="mt-1 ml-[24px] text-[12px] text-[#888]">
            Fine-tune with the full expression editor. Supports nested boolean logic, custom
            temporal windows, and all advanced features.
          </p>
          <div className="mt-2 ml-[24px] rounded bg-[#1a1a2e] p-2.5 text-[11px] text-[#666]">
            <strong className="text-[#888]">Quick orientation:</strong> Your entry events are in
            &ldquo;Primary Criteria&rdquo;. Inclusion rules are in &ldquo;Additional
            Criteria&rdquo;. Demographics, risk scores, and specialized criteria each have their
            own section. All concept sets appear in the &ldquo;Concept Sets&rdquo; reference panel
            at the top.
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate("/cohort-definitions")}
          className="rounded-lg border border-[#333] bg-[#1a1a2e] p-4 text-left transition-colors hover:border-[#555]"
        >
          <div className="flex items-center gap-2 text-[13px] font-medium text-[#ccc]">
            <BarChart3 size={16} />
            View Diagnostics
          </div>
          <p className="mt-1 ml-[24px] text-[12px] text-[#888]">
            See attrition chart, patient breakdown by age/gender, and detailed generation
            statistics.
          </p>
        </button>
      </div>
    </div>
  );
}
