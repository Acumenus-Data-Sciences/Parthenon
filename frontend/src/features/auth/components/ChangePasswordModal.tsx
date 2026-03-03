import { useState, type FormEvent } from "react";
import { Lock, AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/models";

interface ChangePasswordResponse {
  message: string;
  user: User;
}

/**
 * Blocking modal shown when `user.must_change_password === true`.
 * No backdrop click, no close button — intentionally non-dismissable.
 */
export function ChangePasswordModal() {
  const updateUser = useAuthStore((s) => s.updateUser);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (newPw !== confirmPw) {
      setError("New passwords do not match.");
      return;
    }
    if (newPw.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPw === currentPw) {
      setError("New password must differ from the current password.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiClient.post<ChangePasswordResponse>(
        "/auth/change-password",
        { current_password: currentPw, new_password: newPw },
      );
      updateUser(data.user);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Password change failed. Please try again.";
      setError(msg);
      setCurrentPw("");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px 10px 36px",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-base)",
    color: "var(--text-primary)",
    background: "rgba(0, 0, 0, 0.35)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-md)",
    outline: "none",
    transition: "border-color 200ms, box-shadow 200ms",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: "var(--space-2)",
  };

  return (
    // Backdrop — no onClick handler (intentionally non-dismissable)
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-pw-title"
        style={{
          width: "100%",
          maxWidth: 440,
          margin: "var(--space-4)",
          background:
            "linear-gradient(135deg, rgba(22, 22, 28, 0.98) 0%, rgba(14, 14, 17, 0.99) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-10) var(--space-8)",
          boxShadow:
            "0 32px 80px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-3)",
            marginBottom: "var(--space-6)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-md)",
              background: "rgba(232, 93, 93, 0.12)",
              border: "1px solid rgba(232, 93, 93, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={18} style={{ color: "var(--critical)" }} />
          </div>
          <div>
            <h2
              id="change-pw-title"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-xl)",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Change your password
            </h2>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                margin: "var(--space-1) 0 0",
              }}
            >
              You must set a new password before continuing.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "var(--space-3)",
                marginBottom: "var(--space-4)",
                background: "var(--critical-bg)",
                border: "1px solid var(--critical-border)",
                borderRadius: "var(--radius-md)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                color: "var(--critical)",
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Current password */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <label htmlFor="current-password" style={labelStyle}>
              Temporary password
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                size={14}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-ghost)",
                  pointerEvents: "none",
                }}
              />
              <input
                id="current-password"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
                autoFocus
                placeholder="Enter your temporary password"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.boxShadow = "var(--focus-ring)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {/* New password */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <label htmlFor="new-password" style={labelStyle}>
              New password
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                size={14}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-ghost)",
                  pointerEvents: "none",
                }}
              />
              <input
                id="new-password"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
                placeholder="Min 8 characters"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.boxShadow = "var(--focus-ring)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {/* Confirm new password */}
          <div style={{ marginBottom: "var(--space-6)" }}>
            <label htmlFor="confirm-password" style={labelStyle}>
              Confirm new password
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                size={14}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-ghost)",
                  pointerEvents: "none",
                }}
              />
              <input
                id="confirm-password"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
                placeholder="Repeat new password"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.boxShadow = "var(--focus-ring)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-2)",
              padding: "11px 0",
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-base)",
              fontWeight: 600,
              color: "#fff",
              background: "var(--gradient-crimson)",
              border: "1px solid var(--primary-light)",
              borderRadius: "var(--radius-md)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              transition: "opacity 200ms, box-shadow 200ms",
              boxShadow: "0 4px 20px var(--primary-glow)",
              letterSpacing: "0.3px",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                Changing password...
              </>
            ) : (
              "Set new password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
