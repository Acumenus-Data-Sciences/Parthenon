import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, AlertCircle, Lock, Mail } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import axios from "axios";
import apiClient from "@/lib/api-client";
import type { AuthResponse } from "@/types/api";

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Fetch CSRF cookie for Sanctum stateful auth
      await axios.get("/sanctum/csrf-cookie", { withCredentials: true });

      const { data } = await apiClient.post<AuthResponse>("/auth/login", {
        email,
        password,
      });
      setAuth(data.token, data.user);
      navigate("/");
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        overflow: "hidden",
      }}
    >
      {/* Full-screen background image — darkly faded */}
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

      {/* ─── Left: Hero section ─── */}
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
        {/* Hero image — brighter on the left side */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/parthenon.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center 40%",
            filter: "brightness(0.28) saturate(0.4)",
            maskImage:
              "linear-gradient(to right, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
          }}
        />

        {/* Centered radial overlay for text legibility */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at center, rgba(8, 8, 10, 0.55) 0%, rgba(8, 8, 10, 0.3) 50%, transparent 80%)",
          }}
        />

        {/* Hero content — centered */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 500, textAlign: "center" }}>
          {/* Crimson accent line */}
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
              lineHeight: 1.4,
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
            A next-generation outcomes research platform built on the{" "}
            <a
              href="https://ohdsi.org"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "none", borderBottom: "1px solid var(--accent-muted)" }}
            >
              OHDSI
            </a>{" "}
            ecosystem and the OMOP Common Data Model. Cohort building,
            characterization, population-level estimation, patient-level
            prediction, and pathway analysis — unified in a single platform.
          </p>

          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-sm)",
              color: "var(--text-ghost)",
              marginTop: "var(--space-3)",
              lineHeight: 1.5,
            }}
          >
            Open source on{" "}
            <a
              href="https://github.com/acumenus/parthenon"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--text-muted)", textDecoration: "none", borderBottom: "1px solid var(--text-ghost)" }}
            >
              GitHub
            </a>
          </p>

          {/* Capability pills */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "var(--space-2)",
              marginTop: "var(--space-6)",
            }}
          >
            {[
              "Cohort Definitions",
              "Characterization",
              "Incidence Rates",
              "Estimation",
              "Prediction",
              "Pathways",
            ].map((label) => (
              <span
                key={label}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--text-ghost)",
                  letterSpacing: "0.8px",
                  textTransform: "uppercase",
                  padding: "5px 10px",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "var(--radius-full)",
                  background: "rgba(255, 255, 255, 0.03)",
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Version + Acumenus */}
          <div
            style={{
              marginTop: "var(--space-8)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--text-ghost)",
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                opacity: 0.6,
              }}
            >
              OMOP CDM v5.4
            </p>
            <a
              href="https://www.acumenus.io"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-xs)",
                color: "var(--text-ghost)",
                textDecoration: "none",
                letterSpacing: "0.3px",
                transition: "color 200ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-ghost)";
              }}
            >
              Acumenus Data Sciences
            </a>
          </div>
        </div>
      </div>

      {/* ─── Right: Login panel ─── */}
      <div
        style={{
          position: "relative",
          flex: "0 0 min(560px, 50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-10)",
          background:
            "linear-gradient(135deg, rgba(14, 14, 17, 0.88) 0%, rgba(14, 14, 17, 0.95) 100%)",
          borderLeft: "1px solid rgba(255, 255, 255, 0.04)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
        }}
      >
        {/* Subtle top-right glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 300,
            height: 300,
            background:
              "radial-gradient(circle at top right, var(--primary-glow), transparent 70%)",
            opacity: 0.15,
            pointerEvents: "none",
          }}
        />

        {/* Glassmorphic card */}
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 420,
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-10) var(--space-8)",
            boxShadow:
              "0 24px 64px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
          }}
        >
          {/* Panel heading */}
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
              Sign in
            </h2>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
                marginTop: "var(--space-2)",
              }}
            >
              Enter your credentials to continue
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Error message */}
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

            {/* Email field */}
            <div style={{ marginBottom: "var(--space-4)" }}>
              <label
                htmlFor="email"
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
                Email
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
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
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
                    e.currentTarget.style.borderColor = "var(--border-default)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Password field */}
            <div style={{ marginBottom: "var(--space-6)" }}>
              <label
                htmlFor="password"
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
                Password
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
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
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
                    e.currentTarget.style.borderColor = "var(--border-default)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Demo login shortcut */}
            <button
              type="button"
              onClick={() => {
                setEmail("admin@parthenon.local");
                setPassword("superuser");
              }}
              style={{
                width: "100%",
                marginBottom: "var(--space-3)",
                padding: "8px 0",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px dashed rgba(255, 255, 255, 0.08)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                transition: "color 200ms, border-color 200ms, background 200ms",
                letterSpacing: "0.3px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--accent)";
                e.currentTarget.style.borderColor = "var(--accent-muted)";
                e.currentTarget.style.background = "var(--accent-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
              }}
            >
              Fill demo credentials
            </button>

            {/* Sign in button */}
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
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Footer */}
          <div
            style={{
              textAlign: "center",
              marginTop: "var(--space-8)",
              paddingTop: "var(--space-5)",
              borderTop: "1px solid rgba(255, 255, 255, 0.05)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                color: "var(--text-muted)",
              }}
            >
              Don't have an account?{" "}
              <Link
                to="/register"
                style={{ color: "var(--accent)", textDecoration: "none" }}
              >
                Request access
              </Link>
            </p>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--text-ghost)",
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                opacity: 0.6,
              }}
            >
              <a
                href="https://www.acumenus.io"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                Acumenus Data Sciences
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
