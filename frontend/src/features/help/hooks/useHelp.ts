import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getHelp, getChangelog } from "../api/helpApi";

export function useHelp(key: string | null) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return useQuery({
    queryKey: ["help", key, locale],
    queryFn: () => getHelp(key!),
    enabled: !!key,
    staleTime: Infinity,
  });
}

export function useChangelog() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return useQuery({
    queryKey: ["changelog", locale],
    queryFn: getChangelog,
    staleTime: Infinity,
  });
}
