import { Activity, Bot, Shield, Database } from "lucide-react";

interface Props {
  organizationName: string;
  onOrganizationNameChange: (name: string) => void;
}

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

export function WelcomeStep({ organizationName, onOrganizationNameChange }: Props) {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#F0EDE8]">Welcome to Parthenon</h2>
        <p className="mt-2 text-sm text-[#8A857D]">
          Let's configure your research platform. This wizard will walk you through the
          essential setup steps. You can skip any step and return to the admin panel later.
        </p>
      </div>

      {/* Organization name */}
      <div className="mx-auto max-w-md">
        <label className="block text-xs font-medium uppercase tracking-wide text-[#8A857D]">
          Organization Name
        </label>
        <input
          type="text"
          value={organizationName}
          onChange={(e) => onOrganizationNameChange(e.target.value)}
          placeholder="Your organization"
          className="mt-1 w-full rounded-md border border-[#232328] bg-[#1A1A1E] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/50"
        />
        <p className="mt-1 text-xs text-[#5A5650]">
          Displayed on the completion screen. You can change this later.
        </p>
      </div>

      {/* What's ahead */}
      <div>
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-[#8A857D]">
          What we'll set up
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {WIZARD_OVERVIEW.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-start gap-3 rounded-xl border border-[#232328] bg-[#1A1A1E] p-4"
              >
                <div className="rounded-lg bg-[#C9A227]/10 p-2">
                  <Icon size={18} className="text-[#C9A227]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#F0EDE8]">{item.label}</p>
                  <p className="mt-0.5 text-xs text-[#8A857D]">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
