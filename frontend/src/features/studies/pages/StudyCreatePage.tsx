import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Briefcase,
  FlaskConical,
  Users,
  ClipboardCheck,
  BarChart3,
  Scale,
  Brain,
  Shield,
  Pill,
  Activity,
  Wrench,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpButton } from "@/features/help";
import apiClient from "@/lib/api-client";
import { useCreateStudy } from "../hooks/useStudies";
import type { StudyCreatePayload } from "../types/study";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { key: "basics", label: "Basics", icon: Briefcase },
  { key: "science", label: "Scientific Design", icon: FlaskConical },
  { key: "team", label: "Team & Timeline", icon: Users },
  { key: "review", label: "Review & Create", icon: ClipboardCheck },
] as const;

const STUDY_TYPES = [
  { value: "characterization", label: "Characterization", icon: BarChart3, color: "var(--success)", desc: "Describe patient populations and treatment patterns" },
  { value: "population_level_estimation", label: "Population-Level Estimation", icon: Scale, color: "var(--info)", desc: "Estimate causal effects using observational data" },
  { value: "patient_level_prediction", label: "Patient-Level Prediction", icon: Brain, color: "var(--domain-observation)", desc: "Predict individual patient outcomes" },
  { value: "comparative_effectiveness", label: "Comparative Effectiveness", icon: FlaskConical, color: "var(--warning)", desc: "Compare treatments in real-world settings" },
  { value: "safety_surveillance", label: "Safety Surveillance", icon: Shield, color: "var(--critical)", desc: "Monitor drug safety signals post-market" },
  { value: "drug_utilization", label: "Drug Utilization", icon: Pill, color: "var(--success)", desc: "Analyze medication use patterns and trends" },
  { value: "quality_improvement", label: "Quality Improvement", icon: Activity, color: "var(--domain-device)", desc: "Assess care quality and guideline adherence" },
  { value: "custom", label: "Custom", icon: Wrench, color: "var(--text-muted)", desc: "Define a custom study type" },
];

const STUDY_DESIGNS = [
  { value: "", label: "Select design..." },
  { value: "retrospective_cohort", label: "Retrospective Cohort" },
  { value: "prospective_cohort", label: "Prospective Cohort" },
  { value: "case_control", label: "Case-Control" },
  { value: "cross_sectional", label: "Cross-Sectional" },
  { value: "self_controlled", label: "Self-Controlled Case Series" },
  { value: "nested_case_control", label: "Nested Case-Control" },
  { value: "meta_analysis", label: "Meta-Analysis" },
  { value: "network_study", label: "Network Study" },
  { value: "methodological", label: "Methodological" },
];

const PHASES = [
  { value: "", label: "Select phase..." },
  { value: "I", label: "Phase I" },
  { value: "II", label: "Phase II" },
  { value: "III", label: "Phase III" },
  { value: "IV", label: "Phase IV" },
  { value: "not_applicable", label: "Not Applicable" },
];

const PRIORITIES = [
  { value: "low", label: "Low", color: "var(--text-muted)" },
  { value: "medium", label: "Medium", color: "var(--info)" },
  { value: "high", label: "High", color: "var(--warning)" },
  { value: "critical", label: "Critical", color: "var(--critical)" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StudyCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateStudy();
  const [step, setStep] = useState(0);

  // Step 1: Basics
  const [title, setTitle] = useState("");
  const [shortTitle, setShortTitle] = useState("");
  const [studyType, setStudyType] = useState("");
  const [studyDesign, setStudyDesign] = useState("");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Step 2: Science
  const [rationale, setRationale] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [primaryObjective, setPrimaryObjective] = useState("");
  const [secondaryObjectives, setSecondaryObjectives] = useState<string[]>([]);
  const [secObjInput, setSecObjInput] = useState("");
  const [fundingSource, setFundingSource] = useState("");

  // AI suggestion
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Step 3: Team & Timeline
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetSites, setTargetSites] = useState("");
  const [phase, setPhase] = useState("");
  const [nctId, setNctId] = useState("");

  // ---------------------------------------------------------------------------
  const dateError = startDate && endDate && endDate < startDate
    ? "End date must be after start date"
    : "";

  const canNext = () => {
    if (step === 0) return title.trim().length > 0 && studyType.length > 0;
    if (step === 2) return !dateError;
    return true;
  };

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const handleAddSecObj = () => {
    const s = secObjInput.trim();
    if (s) {
      setSecondaryObjectives([...secondaryObjectives, s]);
    }
    setSecObjInput("");
  };

  const handleAiSuggest = async () => {
    if (!title.trim() || !studyType) return;
    setAiLoading(true);
    setAiError("");
    try {
      const { data } = await apiClient.post("/abby/suggest-protocol", {
        title: title.trim(),
        description: description.trim(),
        study_type: studyType,
      });
      const s = data.suggestions;
      if (s) {
        if (s.scientific_rationale && !rationale) setRationale(s.scientific_rationale);
        if (s.hypothesis && !hypothesis) setHypothesis(s.hypothesis);
        if (s.primary_objective && !primaryObjective) setPrimaryObjective(s.primary_objective);
        if (s.secondary_objectives?.length && secondaryObjectives.length === 0) {
          setSecondaryObjectives(s.secondary_objectives);
        }
      }
      if (data.error) setAiError(data.error);
    } catch {
      setAiError("AI service unavailable. Please fill in fields manually.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreate = (_startProtocol: boolean) => {
    const payload: StudyCreatePayload = {
      title: title.trim(),
      short_title: shortTitle.trim() || undefined,
      study_type: studyType,
      study_design: studyDesign || undefined,
      priority,
      description: description.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      scientific_rationale: rationale.trim() || undefined,
      hypothesis: hypothesis.trim() || undefined,
      primary_objective: primaryObjective.trim() || undefined,
      secondary_objectives: secondaryObjectives.length > 0 ? secondaryObjectives : undefined,
      funding_source: fundingSource.trim() || undefined,
      study_start_date: startDate || undefined,
      study_end_date: endDate || undefined,
      target_enrollment_sites: targetSites ? parseInt(targetSites) : undefined,
      phase: phase || undefined,
      clinicaltrials_gov_id: nctId.trim() || undefined,
    };

    createMutation.mutate(payload, {
      onSuccess: (study) => {
        navigate(`/studies/${study.slug || study.id}`);
      },
    });
  };

  // ---------------------------------------------------------------------------
  // Step Renderers
  // ---------------------------------------------------------------------------

  const renderBasics = () => (
    <div className="space-y-5">
      {/* Study Type Selection */}
      <div>
        <label className="form-label">Study Type *</label>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mt-1">
          {STUDY_TYPES.map((st) => {
            const Icon = st.icon;
            const selected = studyType === st.value;
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => setStudyType(st.value)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                  selected
                    ? "border-success bg-success/5"
                    : "border-border-default bg-surface-raised hover:border-surface-highlight",
                )}
              >
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-md shrink-0 mt-0.5"
                  style={{ backgroundColor: `${st.color}15` }}
                >
                  <Icon size={16} style={{ color: st.color }} />
                </div>
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", selected ? "text-success" : "text-text-primary")}>{st.label}</p>
                  <p className="text-[11px] text-text-ghost mt-0.5 line-clamp-2">{st.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="form-label">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Effect of Statins on Cardiovascular Outcomes in T2DM"
          className="form-input"
        />
      </div>

      {/* Short Title + Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Short Title</label>
          <input
            type="text"
            value={shortTitle}
            onChange={(e) => setShortTitle(e.target.value)}
            placeholder="e.g., LEGEND-T2DM"
            className="form-input"
          />
        </div>
        <div>
          <label className="form-label">Priority</label>
          <div className="flex gap-2 mt-1">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                  priority === p.value
                    ? "border-success"
                    : "border-border-default hover:border-surface-highlight",
                )}
                style={{
                  color: priority === p.value ? p.color : "var(--text-muted)",
                  backgroundColor: priority === p.value ? `${p.color}10` : "transparent",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Study Design */}
      <div>
        <label className="form-label">Study Design</label>
        <select
          value={studyDesign}
          onChange={(e) => setStudyDesign(e.target.value)}
          className="form-input form-select"
        >
          {STUDY_DESIGNS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="form-label">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the study..."
          rows={3}
          className="form-input form-textarea"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="form-label">Tags</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
            placeholder="Add tag and press Enter..."
            className="form-input flex-1"
          />
          <button type="button" onClick={handleAddTag} className="btn btn-ghost btn-sm"><Plus size={14} /></button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-elevated text-xs text-text-secondary">
                {t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="text-text-ghost hover:text-text-primary">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderScience = () => (
    <div className="space-y-5">
      {/* AI Suggest Banner */}
      <div className="flex items-center justify-between rounded-lg border border-domain-observation/20 bg-domain-observation/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-domain-observation" />
          <span className="text-sm text-text-secondary">
            Let AI suggest scientific design fields based on your study title
          </span>
        </div>
        <button
          type="button"
          onClick={handleAiSuggest}
          disabled={aiLoading || !title.trim() || !studyType}
          className="btn btn-sm"
          style={{ backgroundColor: "color-mix(in srgb, var(--domain-observation) 12%, transparent)", color: "var(--domain-observation)", borderColor: "color-mix(in srgb, var(--domain-observation) 25%, transparent)" }}
        >
          {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {aiLoading ? "Generating..." : "Generate with AI"}
        </button>
      </div>
      {aiError && (
        <p className="text-xs text-critical">{aiError}</p>
      )}

      <div>
        <label className="form-label">Scientific Rationale</label>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Why is this study needed? What gap in knowledge does it address?"
          rows={3}
          className="form-input form-textarea"
        />
      </div>

      <div>
        <label className="form-label">Hypothesis</label>
        <textarea
          value={hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          placeholder="State the primary hypothesis being tested..."
          rows={2}
          className="form-input form-textarea"
        />
      </div>

      <div>
        <label className="form-label">Primary Objective</label>
        <textarea
          value={primaryObjective}
          onChange={(e) => setPrimaryObjective(e.target.value)}
          placeholder="What is the main objective of this study?"
          rows={2}
          className="form-input form-textarea"
        />
      </div>

      <div>
        <label className="form-label">Secondary Objectives</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={secObjInput}
            onChange={(e) => setSecObjInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSecObj(); } }}
            placeholder="Add objective and press Enter..."
            className="form-input flex-1"
          />
          <button type="button" onClick={handleAddSecObj} className="btn btn-ghost btn-sm"><Plus size={14} /></button>
        </div>
        {secondaryObjectives.length > 0 && (
          <ul className="mt-2 space-y-1">
            {secondaryObjectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <span className="text-text-ghost shrink-0">{i + 1}.</span>
                <span className="flex-1">{obj}</span>
                <button
                  type="button"
                  onClick={() => setSecondaryObjectives(secondaryObjectives.filter((_, j) => j !== i))}
                  className="text-text-ghost hover:text-critical shrink-0"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="form-label">Funding Source</label>
        <input
          type="text"
          value={fundingSource}
          onChange={(e) => setFundingSource(e.target.value)}
          placeholder="e.g., NIH R01, PCORI, Industry-sponsored"
          className="form-input"
        />
      </div>
    </div>
  );

  const renderTeam = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Study Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input" />
        </div>
        <div>
          <label className="form-label">Study End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={cn("form-input", dateError && "border-critical")} />
          {dateError && <p className="text-xs text-critical mt-1">{dateError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Target Enrollment Sites</label>
          <input
            type="number"
            value={targetSites}
            onChange={(e) => setTargetSites(e.target.value)}
            placeholder="e.g., 10"
            min={0}
            className="form-input"
          />
        </div>
        <div>
          <label className="form-label">Study Phase</label>
          <select value={phase} onChange={(e) => setPhase(e.target.value)} className="form-input form-select">
            {PHASES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="form-label">ClinicalTrials.gov ID</label>
        <input
          type="text"
          value={nctId}
          onChange={(e) => setNctId(e.target.value)}
          placeholder="e.g., NCT12345678"
          className="form-input"
        />
      </div>

      <div className="rounded-lg border border-border-default bg-surface-raised p-4">
        <p className="text-sm text-text-muted">
          Team members, sites, and cohorts can be configured after the study is created from the study dashboard.
        </p>
      </div>
    </div>
  );

  const renderReview = () => {
    const selectedType = STUDY_TYPES.find((t) => t.value === studyType);
    const TypeIcon = selectedType?.icon ?? Briefcase;

    return (
      <div className="space-y-4">
        {/* Basics */}
        <div className="panel">
          <h4 className="text-sm font-semibold text-text-secondary mb-3">Basics</h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-text-ghost">Title:</span>
              <p className="text-text-primary font-medium">{title}</p>
            </div>
            {shortTitle && (
              <div>
                <span className="text-text-ghost">Short Title:</span>
                <p className="text-text-primary">{shortTitle}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-text-ghost">Type:</span>
              <div className="flex items-center gap-1.5">
                <TypeIcon size={14} style={{ color: selectedType?.color }} />
                <span className="text-text-primary">{selectedType?.label}</span>
              </div>
            </div>
            <div>
              <span className="text-text-ghost">Priority:</span>
              <span className="ml-1 text-text-primary capitalize">{priority}</span>
            </div>
            {studyDesign && (
              <div>
                <span className="text-text-ghost">Design:</span>
                <span className="ml-1 text-text-primary">{STUDY_DESIGNS.find((d) => d.value === studyDesign)?.label}</span>
              </div>
            )}
          </div>
          {description && <p className="mt-2 text-sm text-text-muted">{description}</p>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-md bg-surface-elevated text-xs text-text-secondary">{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Science */}
        {(rationale || hypothesis || primaryObjective || secondaryObjectives.length > 0) && (
          <div className="panel">
            <h4 className="text-sm font-semibold text-text-secondary mb-3">Scientific Design</h4>
            <div className="space-y-2 text-sm">
              {rationale && <div><span className="text-text-ghost">Rationale:</span><p className="text-text-secondary mt-0.5">{rationale}</p></div>}
              {hypothesis && <div><span className="text-text-ghost">Hypothesis:</span><p className="text-text-secondary mt-0.5">{hypothesis}</p></div>}
              {primaryObjective && <div><span className="text-text-ghost">Primary Objective:</span><p className="text-text-secondary mt-0.5">{primaryObjective}</p></div>}
              {secondaryObjectives.length > 0 && (
                <div>
                  <span className="text-text-ghost">Secondary Objectives:</span>
                  <ul className="mt-1 space-y-0.5">
                    {secondaryObjectives.map((o, i) => <li key={i} className="text-text-secondary">{i + 1}. {o}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline */}
        {(startDate || endDate || targetSites || phase || nctId) && (
          <div className="panel">
            <h4 className="text-sm font-semibold text-text-secondary mb-3">Timeline & Registration</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {startDate && <div><span className="text-text-ghost">Start:</span><span className="ml-1 text-text-primary">{startDate}</span></div>}
              {endDate && <div><span className="text-text-ghost">End:</span><span className="ml-1 text-text-primary">{endDate}</span></div>}
              {targetSites && <div><span className="text-text-ghost">Target Sites:</span><span className="ml-1 text-text-primary">{targetSites}</span></div>}
              {phase && <div><span className="text-text-ghost">Phase:</span><span className="ml-1 text-text-primary">{PHASES.find((p) => p.value === phase)?.label}</span></div>}
              {nctId && <div><span className="text-text-ghost">NCT ID:</span><span className="ml-1 text-text-primary">{nctId}</span></div>}
              {fundingSource && <div><span className="text-text-ghost">Funding:</span><span className="ml-1 text-text-primary">{fundingSource}</span></div>}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <button type="button" onClick={() => navigate("/studies")} className="btn btn-ghost btn-sm mb-3">
          <ArrowLeft size={14} /> Studies
        </button>
        <div className="flex items-center gap-2">
          <h1 className="page-title">Create Study</h1>
          <HelpButton helpKey="studies" />
        </div>
        <p className="page-subtitle">Configure your research study step by step</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s.key} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => { if (i < step) setStep(i); }}
                disabled={i > step}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all w-full",
                  isActive && "bg-success/10 text-success border border-success/30",
                  isDone && "text-success/70 cursor-pointer hover:bg-success/5",
                  !isActive && !isDone && "text-text-ghost cursor-not-allowed",
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0",
                  isActive && "bg-success text-surface-base",
                  isDone && "bg-success/20 text-success",
                  !isActive && !isDone && "bg-surface-elevated text-text-ghost",
                )}>
                  {isDone ? <Check size={12} /> : i + 1}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px w-4 shrink-0 mx-1", i < step ? "bg-success/30" : "bg-surface-elevated")} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="panel">
        <h3 className="text-base font-semibold text-text-primary mb-4">
          {STEPS[step].label}
        </h3>
        {step === 0 && renderBasics()}
        {step === 1 && renderScience()}
        {step === 2 && renderTeam()}
        {step === 3 && renderReview()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="btn btn-ghost"
        >
          <ArrowLeft size={14} /> Previous
        </button>

        <div className="flex gap-2">
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              className="btn btn-primary"
            >
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleCreate(false)}
                disabled={createMutation.isPending}
                className="btn btn-primary"
              >
                {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Create as Draft
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
