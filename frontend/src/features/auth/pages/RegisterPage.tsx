import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, AlertCircle, Mail, User, CheckCircle } from "lucide-react";
import apiClient from "@/lib/api-client";

export function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiClient.post("/auth/register", { name: name.trim(), email: email.trim() });
      setDone(true);
    } catch {
      setError("Registration failed. Please try again.");
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
    <div style={{ position: "fixed", inset: 0, display: "flex", overflow: "hidden" }}>
      {/* Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url(/parthenon.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center 40%",
          filter: "brightness(0.15) saturate(0.25)",
        }}
      />

      {/* Left hero (same as LoginPage) */}
      <div
        style={{
          position: "relative",
          flex: "1 1 50%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-12) var(--space-10)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/parthenon.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center 40%",
            filter: "brightness(0.28) saturate(0.4)",
            maskImage: "linear-gradient(to right, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at center, rgba(8,8,10,0.55) 0%, rgba(8,8,10,0.3) 50%, transparent 80%)",
          }}
        />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 500, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 3,
              background: "var(--gradient-crimson)",
              borderRadius: "var(--radius-full)",
              margin: "0 auto var(--space-5)",
            }}
          />
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.5rem, 4vw, 3.5rem)",
              fontWeight: 400,
              color: "var(--text-primary)",
              letterSpacing: "-0.025em",
              lineHeight: 1.08,
            }}
          >
            Parthenon
          </h1>
          <p
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-xl)",
              fontWeight: 400,
              color: "var(--text-secondary)",
              marginTop: "var(--space-3)",
            }}
          >
            Unified Outcomes Research Platform
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-base)",
              color: "var(--text-muted)",
              marginTop: "var(--space-4)",
              lineHeight: 1.6,
            }}
          >
            Request access to the platform. A temporary password will be sent to your email address.
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div
        style={{
          position: "relative",
          flex: "0 0 min(560px, 50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-10)",
          background: "linear-gradient(135deg, rgba(14,14,17,0.88) 0%, rgba(14,14,17,0.95) 100%)",
          borderLeft: "1px solid rgba(255,255,255,0.04)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 300,
            height: 300,
            background: "radial-gradient(circle at top right, var(--primary-glow), transparent 70%)",
            opacity: 0.15,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 420,
            background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-10) var(--space-8)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {done ? (
            /* Success state */
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(34, 197, 94, 0.12)",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto var(--space-5)",
                }}
              >
                <CheckCircle size={24} style={{ color: "#22c55e" }} />
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "var(--text-2xl)",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: "var(--space-3)",
                }}
              >
                Check your email
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                  marginBottom: "var(--space-6)",
                }}
              >
                If this email is new to Parthenon, a temporary password has been sent. Use it to sign in — you'll be asked to set a permanent password on first login.
              </p>
              <Link
                to="/login"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "11px 0",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-base)",
                  fontWeight: 600,
                  color: "#fff",
                  background: "var(--gradient-crimson)",
                  border: "1px solid var(--primary-light)",
                  borderRadius: "var(--radius-md)",
                  textDecoration: "none",
                  boxShadow: "0 4px 20px var(--primary-glow)",
                  letterSpacing: "0.3px",
                }}
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "var(--space-8)" }}>
                <h2
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-2xl)",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    lineHeight: 1.2,
                  }}
                >
                  Request access
                </h2>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-muted)",
                    marginTop: "var(--space-2)",
                  }}
                >
                  Enter your details and we'll email a temporary password
                </p>
              </div>

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

                <div style={{ marginBottom: "var(--space-4)" }}>
                  <label htmlFor="name" style={labelStyle}>Full name</label>
                  <div style={{ position: "relative" }}>
                    <User
                      size={14}
                      style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)", pointerEvents: "none" }}
                    />
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="Jane Smith"
                      style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "var(--focus-ring)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.boxShadow = "none"; }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "var(--space-6)" }}>
                  <label htmlFor="email" style={labelStyle}>Email</label>
                  <div style={{ position: "relative" }}>
                    <Mail
                      size={14}
                      style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-ghost)", pointerEvents: "none" }}
                    />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      style={inputStyle}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "var(--focus-ring)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.boxShadow = "none"; }}
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
                      Sending...
                    </>
                  ) : (
                    "Request access"
                  )}
                </button>
              </form>

              <div
                style={{
                  textAlign: "center",
                  marginTop: "var(--space-6)",
                  paddingTop: "var(--space-5)",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-muted)",
                  }}
                >
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    style={{ color: "var(--accent)", textDecoration: "none" }}
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
