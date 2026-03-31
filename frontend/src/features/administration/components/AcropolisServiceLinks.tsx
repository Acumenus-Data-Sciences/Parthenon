import { ExternalLink, ShieldCheck, BarChart2, Boxes, Workflow, Database, LockKeyhole, Shield, type LucideIcon } from "lucide-react";
import { Panel } from "@/components/ui";

type AcropolisServiceDefinition = {
  key: string;
  name: string;
  description: string;
  subdomain: string;
  icon: LucideIcon;
};

const ACROPOLIS_SERVICES: AcropolisServiceDefinition[] = [
  {
    key: "authentik",
    name: "Authentik",
    description: "Identity provider and access portal",
    subdomain: "auth",
    icon: LockKeyhole,
  },
  {
    key: "wazuh",
    name: "Wazuh",
    description: "Security monitoring and SIEM dashboard",
    subdomain: "wazuh",
    icon: Shield,
  },
  {
    key: "grafana",
    name: "Grafana",
    description: "Metrics and observability dashboards",
    subdomain: "grafana",
    icon: BarChart2,
  },
  {
    key: "portainer",
    name: "Portainer",
    description: "Container and stack operations",
    subdomain: "portainer",
    icon: Boxes,
  },
  {
    key: "pgadmin",
    name: "pgAdmin",
    description: "PostgreSQL administration console",
    subdomain: "pgadmin",
    icon: Database,
  },
  {
    key: "n8n",
    name: "n8n",
    description: "Workflow orchestration and automation",
    subdomain: "n8n",
    icon: Workflow,
  },
  {
    key: "superset",
    name: "Superset",
    description: "BI and ad hoc analytics workspace",
    subdomain: "superset",
    icon: BarChart2,
  },
  {
    key: "datahub",
    name: "DataHub",
    description: "Metadata catalog and lineage explorer",
    subdomain: "datahub",
    icon: ShieldCheck,
  },
];

export function getAcropolisBaseHost(hostname: string): string {
  return hostname.startsWith("parthenon.") ? hostname.slice("parthenon.".length) : hostname;
}

export function buildAcropolisServiceUrl(
  locationLike: Pick<Location, "protocol" | "hostname" | "port">,
  subdomain: string,
): string {
  const baseHost = getAcropolisBaseHost(locationLike.hostname);
  const port = locationLike.port ? `:${locationLike.port}` : "";

  return `${locationLike.protocol}//${subdomain}.${baseHost}${port}/`;
}

export function AcropolisServiceLinks() {
  const locationLike = window.location;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {ACROPOLIS_SERVICES.map((service) => {
        const Icon = service.icon;
        const href = buildAcropolisServiceUrl(locationLike, service.subdomain);

        return (
          <Panel key={service.key} className="h-full">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-md border border-border/60 bg-muted/40 p-2">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{service.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{service.description}</p>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Open Service
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
