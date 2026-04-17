import { useState, useEffect, useRef, type FormEvent } from "react";
import { Loader2, Mail, CheckCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import apiClient from "@/lib/api-client";
import axios from "axios";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export function ForgotPasswordModal({
  isOpen,
  onClose,
  defaultEmail = "",
}: ForgotPasswordModalProps) {
  const { t } = useTranslation("auth");
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync defaultEmail when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail(defaultEmail);
      setSuccess(false);
      setError("");
      setLoading(false);
    }
  }, [isOpen, defaultEmail]);

  // Auto-close after success
  useEffect(() => {
    if (success) {
      autoCloseTimer.current = setTimeout(() => {
        onClose();
      }, 5000);
    }
    return () => {
      if (autoCloseTimer.current) {
        clearTimeout(autoCloseTimer.current);
        autoCloseTimer.current = null;
      }
    };
  }, [success, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiClient.post("/auth/forgot-password", { email });
      setSuccess(true);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        setError(t("forgot.tooManyRequests"));
      } else {
        setError(t("forgot.genericError"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={loading ? undefined : onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          background:
            "linear-gradient(135deg, rgba(20, 20, 24, 0.98) 0%, rgba(14, 14, 17, 0.99) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-8)",
          boxShadow:
            "0 24px 64px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        }}
      >
        {/* Close button */}
        {!loading && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("forgot.close")}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "none",
              border: "none",
              color: "var(--text-ghost)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              transition: "color 200ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-ghost)";
            }}
          >
            <X size={18} />
          </button>
        )}

        {success ? (
          /* ─── Success state ─── */
          <div style={{ textAlign: "center", padding: "var(--space-4) 0" }}>
            <CheckCircle
              size={48}
              style={{
                color: "var(--success)",
                margin: "0 auto var(--space-4)",
              }}
            />
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "var(--space-2)",
              }}
            >
              {t("forgot.successTitle")}
            </h3>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              {t("forgot.successBody")}
            </p>
          </div>
        ) : (
          /* ─── Form state ─── */
          <>
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "var(--space-2)",
              }}
            >
              {t("forgot.title")}
            </h3>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                marginBottom: "var(--space-6)",
                lineHeight: 1.5,
              }}
            >
              {t("forgot.intro")}
            </p>

            <form onSubmit={handleSubmit}>
              {error && (
                <div
                  style={{
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
                  {error}
                </div>
              )}

              <div style={{ marginBottom: "var(--space-5)" }}>
                <label
                  htmlFor="forgot-email"
                  style={{
                    display: "block",
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  {t("common.email")}
                </label>
                <div style={{ position: "relative" }}>
                  <Mail
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
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    autoFocus
                    style={{
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
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.boxShadow = "var(--focus-ring)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor =
                        "var(--border-default)";
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
                  color: "var(--text-primary)",
                  background: "var(--gradient-crimson)",
                  border: "1px solid var(--primary-light)",
                  borderRadius: "var(--radius-md)",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  transition:
                    "opacity 200ms, box-shadow 200ms, transform 100ms",
                  boxShadow: "0 4px 20px var(--primary-glow)",
                  letterSpacing: "0.3px",
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.boxShadow =
                      "0 6px 28px var(--primary-glow)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 4px 20px var(--primary-glow)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {loading ? (
                  <>
                    <Loader2
                      size={16}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    {t("forgot.sending")}
                  </>
                ) : (
                  t("forgot.sendTemporaryPassword")
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
