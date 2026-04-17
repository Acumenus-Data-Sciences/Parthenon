import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NotificationSettings } from "../components/NotificationSettings";

export default function NotificationSettingsPage() {
  const { t } = useTranslation("settings");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-success/10">
            <Bell size={20} className="text-success" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {t("notifications.pageTitle")}
            </h1>
            <p className="text-sm text-text-muted">
              {t("notifications.pageSubtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <NotificationSettings />
    </div>
  );
}
