import { useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, AlertCircle, Lock, Mail } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { ConstellationBackground } from "../components/ConstellationBackground";
import { ForgotPasswordModal } from "../components/ForgotPasswordModal";
import axios from "axios";
import apiClient from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { fetchDashboardStats } from "@/features/dashboard/api/dashboardApi";
import type { AuthResponse } from "@/types/api";

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  // Prefetch CSRF cookie on mount — eliminates a round-trip at submit time
  const csrfReady = useRef<Promise<void> | null>(null);
  useEffect(() => {
    csrfReady.current = axios
      .get("/sanctum/csrf-cookie", { withCredentials: true })
      .then(() => undefined)
      .catch(() => undefined);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Wait for CSRF cookie (usually already resolved from prefetch)
      await csrfReady.current;

      const { data } = await apiClient.post<AuthResponse>("/auth/login", {
        email,
        password,
      });
      setAuth(data.token, data.user);

      // Prefetch dashboard data before navigating — data is ready by the time DashboardPage mounts
      queryClient.prefetchQuery({
        queryKey: ["dashboard", "stats"],
        queryFn: fetchDashboardStats,
        staleTime: 15_000,
      });

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
      {/* Dark base — no image here; the hero panel renders its own */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#08060A",
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
        {/* Hero image — bright and vivid, fading at the right edge */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/parthenon.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center 40%",
            filter: "brightness(0.78) saturate(1.05) contrast(1.08)",
          }}
        />

        {/* Atmospheric colour wash — Athenian sky & warm marble */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(120, 170, 230, 0.10) 0%, rgba(201, 162, 39, 0.06) 55%, rgba(8, 8, 10, 0.18) 100%)",
          }}
        />

        {/* Hero content — centered, inside a glassmorphic panel */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 500,
            textAlign: "center",
            background:
              "linear-gradient(135deg, rgba(10, 8, 6, 0.62) 0%, rgba(6, 5, 4, 0.52) 100%)",
            backdropFilter: "blur(28px) saturate(1.4)",
            WebkitBackdropFilter: "blur(28px) saturate(1.4)",
            border: "1px solid rgba(255, 255, 255, 0.10)",
            borderTop: "1px solid rgba(255, 255, 255, 0.20)",
            borderRadius: 20,
            padding: "48px 52px",
            boxShadow:
              "0 24px 72px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.15)",
          }}
        >
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
              href="https://github.com/sudoshi/Parthenon"
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
              "Genomics",
              "Imaging",
              "HEOR",
              "GIS",
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

          {/* Blog + Discord links */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-2)",
              marginTop: "var(--space-5)",
            }}
          >
            <a
              href="/docs/blog"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--accent)",
                textDecoration: "none",
                borderBottom: "1px solid var(--accent-muted)",
                letterSpacing: "0.3px",
                transition: "color 200ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--accent-light)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--accent)";
              }}
            >
              Read our Development Blog &rarr;
            </a>
            <a
              href="https://discord.gg/GkkT7dzmwf"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--accent)",
                textDecoration: "none",
                borderBottom: "1px solid var(--accent-muted)",
                letterSpacing: "0.3px",
                transition: "color 200ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--accent-light)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--accent)";
              }}
            >
              Join our Discord Community &rarr;
            </a>
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

      {/* ─── Crimson shimmer divider ─── */}
      <style>{`
        @keyframes crimson-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes crimson-sweep {
          0%   { top: -40%; }
          100% { top: 140%; }
        }
      `}</style>
      <div
        style={{
          position: "relative",
          width: 2,
          flexShrink: 0,
          alignSelf: "stretch",
          zIndex: 10,
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(220,30,50,0.85) 28%, rgba(240,50,70,1) 50%, rgba(220,30,50,0.85) 72%, transparent 100%)",
          boxShadow:
            "0 0 10px 4px rgba(220,38,58,0.8), 0 0 32px 8px rgba(200,20,40,0.45), 0 0 60px 12px rgba(180,10,30,0.2)",
          animation: "crimson-pulse 3s ease-in-out infinite",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
        }}
      >
        {/* Sweeping bright highlight */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              left: -6,
              right: -6,
              height: "28%",
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(255,180,190,0.95) 50%, transparent 100%)",
              animation: "crimson-sweep 2.8s ease-in-out infinite",
            }}
          />
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
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
        }}
      >
        {/* Animated constellation star map */}
        <ConstellationBackground />

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
            <div style={{ marginBottom: "var(--space-3)" }}>
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

            {/* Forgot password link */}
            <div
              style={{
                textAlign: "right",
                marginBottom: "var(--space-4)",
              }}
            >
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  transition: "color 200ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                Forgot password?
              </button>
            </div>

            {/* Demo login shortcut — only rendered when installer wrote VITE_DEMO_* vars */}
            {import.meta.env.VITE_DEMO_EMAIL && import.meta.env.VITE_DEMO_PASSWORD && (
              <button
                type="button"
                onClick={() => {
                  setEmail(import.meta.env.VITE_DEMO_EMAIL);
                  setPassword(import.meta.env.VITE_DEMO_PASSWORD);
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
            )}

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
      <ForgotPasswordModal
        isOpen={forgotOpen}
        onClose={() => setForgotOpen(false)}
        defaultEmail={email}
      />
    </div>
  );
}
