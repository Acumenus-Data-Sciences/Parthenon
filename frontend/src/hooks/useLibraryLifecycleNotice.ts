import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { toast } from "@/components/ui";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";

/**
 * One-time, non-blocking notice that library items (concept sets, cohort
 * definitions, analyses) now carry a Draft / Active / Archived lifecycle.
 *
 * Fires an info toast once per user — only after the blocking onboarding and
 * password-change flows are done — then immediately persists the
 * acknowledgement server-side so it never shows again. A ref guards against a
 * double fire within a session; a failed PUT clears the guard so the next
 * mount can retry.
 */
export function useLibraryLifecycleNotice(): void {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { t } = useTranslation("common");
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || !user) return;
    // Stay out of the way of the blocking onboarding / password-change flows.
    if (user.must_change_password || !user.onboarding_completed) return;
    if (user.seen_library_lifecycle_notice) return;

    firedRef.current = true;
    toast.info(t("libraryLifecycleNotice"));

    apiClient
      .put("/user/library-notice")
      .then(() => updateUser({ ...user, seen_library_lifecycle_notice: true }))
      .catch(() => {
        // Non-critical — allow another attempt on the next mount.
        firedRef.current = false;
      });
  }, [user, updateUser, t]);
}
