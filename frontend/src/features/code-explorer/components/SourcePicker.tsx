import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useTranslation } from "react-i18next";

type Source = { source_key: string; source_name: string };

export function SourcePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (sourceKey: string) => void;
}) {
  const { t } = useTranslation("app");
  const { data, isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Source[] }>("/sources");
      return data.data;
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="text-sm text-slate-500">{t("codeExplorer.sourcePicker.loading")}</div>;
  if (!data?.length) return <div className="text-sm text-rose-400">{t("codeExplorer.sourcePicker.empty")}</div>;

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-300">{t("codeExplorer.sourcePicker.label")}</span>
      <select
        className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          {t("codeExplorer.sourcePicker.choose")}
        </option>
        {data.map((s) => (
          <option key={s.source_key} value={s.source_key}>
            {s.source_name} ({s.source_key})
          </option>
        ))}
      </select>
    </label>
  );
}
