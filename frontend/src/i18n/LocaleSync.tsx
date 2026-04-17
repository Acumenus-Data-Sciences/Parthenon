import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { resolveInitialLocale, setActiveLocale } from "./i18n";

export function LocaleSync() {
  const userLocale = useAuthStore((state) => state.user?.locale);

  useEffect(() => {
    void setActiveLocale(resolveInitialLocale(userLocale));
  }, [userLocale]);

  return null;
}
