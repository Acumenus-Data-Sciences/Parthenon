import { ExternalLink, ShieldCheck, BarChart2, Boxes, Workflow, Database, LockKeyhole, Shield, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/components/ui";

type AcropolisServiceDefinition = {
  key: string;
  displayName: string;
  descriptionKey: string;
  subdomain: string;
  icon: LucideIcon;
};

const ACROPOLIS_SERVICES: AcropolisServiceDefinition[] = [
  {
    key: "authentik",
    displayName: "Authentik",
    descriptionKey: "authentik",
    subdomain: "auth",
    icon: LockKeyhole,
  },
  {
    key: "wazuh",
    displayName: "Wazuh",
    descriptionKey: "wazuh",
    subdomain: "wazuh",
    icon: Shield,
  },
  {
    key: "grafana",
    displayName: "Grafana",
    descriptionKey: "grafana",
    subdomain: "grafana",
    icon: BarChart2,
  },
  {
    key: "portainer",
    displayName: "Portainer",
    descriptionKey: "portainer",
    subdomain: "portainer",
    icon: Boxes,
  },
  {
    key: "pgadmin",
    displayName: "pgAdmin",
    descriptionKey: "pgadmin",
    subdomain: "pgadmin",
    icon: Database,
  },
  {
    key: "n8n",
    displayName: "n8n",
    descriptionKey: "n8n",
    subdomain: "n8n",
    icon: Workflow,
  },
  {
    key: "superset",
    displayName: "Superset",
    descriptionKey: "superset",
    subdomain: "superset",
    icon: BarChart2,
  },
  {
    key: "datahub",
    displayName: "DataHub",
    descriptionKey: "datahub",
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
  const { t } = useTranslation("app");
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
                  <p className="font-semibold text-foreground">{service.displayName}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t(`administration.acropolisServices.descriptions.${service.descriptionKey}`)}
                  </p>
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
                {t("administration.acropolisServices.openService")}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
