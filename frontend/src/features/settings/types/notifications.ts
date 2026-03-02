export interface NotificationPreferences {
  notification_email: boolean;
  notification_sms: boolean;
  phone_number: string | null;
  notification_preferences: {
    analysis_completed: boolean;
    analysis_failed: boolean;
    cohort_generated: boolean;
    study_completed: boolean;
  };
}
