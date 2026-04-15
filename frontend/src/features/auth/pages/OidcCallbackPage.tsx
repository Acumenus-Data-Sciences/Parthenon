import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import apiClient from "@/lib/api-client";
import type { AuthResponse } from "@/types/api";

type Status = "exchanging" | "failed";

export function OidcCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [status, setStatus] = useState<Status>("exchanging");
  const [errorReason, setErrorReason] = useState<string>("");
  const exchanged = useRef(false);

  useEffect(() => {
    // Guard against React 19 strict-mode double-mount (the code is single-use).
    if (exchanged.current) return;
    exchanged.current = true;

    const code = params.get("code");
    if (!code) {
      setStatus("failed");
      setErrorReason("missing_code");
      return;
    }

    // Imperative async/await + try/catch — same pattern LoginPage uses.
    // Avoids TanStack Query's inline onSuccess callback style which was not
    // firing reliably in the React 19 + mutate-with-options path (observed
    // 200 response but onSuccess never executed during Phase 7 smoke test).
    (async () => {
      try {
        const { data } = await apiClient.post<AuthResponse>(
          "/auth/oidc/exchange",
          { code },
        );
        setAuth(data.token, data.user);
        navigate("/", { replace: true });
      } catch {
        setStatus("failed");
        setErrorReason("exchange_failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "failed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E0E11] text-white">
        <div className="max-w-md text-center space-y-4 p-8">
          <AlertCircle className="w-12 h-12 mx-auto text-[#9B1B30]" />
          <h1 className="text-xl font-semibold">Sign-in failed</h1>
          <p className="text-sm text-neutral-400">
            We could not complete the single sign-on request{" "}
            {errorReason ? `(${errorReason})` : ""}. Try again or use
            email/password login.
          </p>
          <Link
            to="/login"
            className="inline-block text-[#C9A227] underline hover:text-[#e0b633]"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0E0E11] text-white">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#2DD4BF]" />
        <p className="text-sm text-neutral-400">Completing sign-in…</p>
      </div>
    </div>
  );
}
