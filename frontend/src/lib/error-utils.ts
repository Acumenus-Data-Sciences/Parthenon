/**
 * Extract a user-friendly error message from an unknown error object.
 * Works with Axios errors, standard Error objects, and arbitrary objects.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const e = error as {
    response?: { data?: { detail?: string; message?: string; error?: string } };
    message?: string;
  };
  return (
    e.response?.data?.detail ??
    e.response?.data?.message ??
    e.response?.data?.error ??
    e.message ??
    fallback
  );
}
