import { Activity, Bot, Shield, Database, CheckCircle2 } from "lucide-react";

const WIZARD_OVERVIEW = [
  {
    icon: Activity,
    label: "System Health",
    description: "Verify all platform services are running correctly.",
  },
  {
    icon: Bot,
    label: "AI Provider",
    description: "Configure which AI backend powers Abby.",
  },
  {
    icon: Shield,
    label: "Authentication",
    description: "Set up SSO providers like LDAP, OAuth, or OIDC.",
  },
  {
    icon: Database,
    label: "Data Sources",
    description: "Connect CDM databases or import from legacy WebAPI.",
  },
];

const BEFORE_YOU_START = [
  "Your OMOP CDM database is accessible from this server",
  "Docker and all containers are running (verified in the next step)",
  "Ollama is running locally if you want AI features (optional)",
  "You have your organization's SSO details if enabling single sign-on (optional)",
];

export function WelcomeStep() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#F0EDE8]">Welcome to Parthenon</h2>
        <p className="mt-2 text-base text-[#8A857D]">
          Let's configure your research platform. This wizard walks through the essential setup
          steps — each can be skipped and revisited any time from the Administration panel.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* What we'll set up */}
        <div>
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-[#8A857D]">
            What we'll configure
          </p>
          <div className="space-y-2">
            {WIZARD_OVERVIEW.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-start gap-3 rounded-xl border border-[#232328] bg-[#1A1A1E] p-3"
                >
                  <div className="rounded-lg bg-[#C9A227]/10 p-2 shrink-0">
                    <Icon size={15} className="text-[#C9A227]" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#F0EDE8]">{item.label}</p>
                    <p className="mt-0.5 text-sm text-[#8A857D]">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Before you start */}
        <div>
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-[#8A857D]">
            Before you start
          </p>
          <div className="rounded-xl border border-[#232328] bg-[#1A1A1E] p-4 space-y-3">
            {BEFORE_YOU_START.map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#5A5650]" />
                <p className="text-sm text-[#8A857D] leading-relaxed">{item}</p>
              </div>
            ))}
            <p className="pt-1 text-sm text-[#5A5650] border-t border-[#232328] mt-2">
              None of the optional steps are required to proceed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
