import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { EnterpriseGate } from "@/components/EnterpriseGate";
import { useFeatureFlagsStore } from "@/stores/featureFlagsStore";

describe("EnterpriseGate", () => {
  beforeEach(() => {
    useFeatureFlagsStore.getState().reset();
  });

  it("hides children when the flag is off (CE default)", () => {
    render(
      <EnterpriseGate flag="auth.saml">
        <div>SAML config</div>
      </EnterpriseGate>,
    );
    expect(screen.queryByText("SAML config")).toBeNull();
  });

  it("renders children when the flag is on (EE)", () => {
    useFeatureFlagsStore.getState().setFlags([
      { name: "auth.saml", enabled: true, source: "ee", description: null },
    ]);

    render(
      <EnterpriseGate flag="auth.saml">
        <div>SAML config</div>
      </EnterpriseGate>,
    );
    expect(screen.getByText("SAML config")).toBeInTheDocument();
  });

  it("renders fallback when the flag is off and a fallback is provided", () => {
    render(
      <EnterpriseGate flag="auth.saml" fallback={<div>Upgrade to EE</div>}>
        <div>SAML config</div>
      </EnterpriseGate>,
    );
    expect(screen.queryByText("SAML config")).toBeNull();
    expect(screen.getByText("Upgrade to EE")).toBeInTheDocument();
  });

  it("renders locked-mode (children dimmed + Enterprise badge) when showAsLocked=true", () => {
    render(
      <EnterpriseGate flag="auth.saml" showAsLocked>
        <div data-testid="kid">SAML config</div>
      </EnterpriseGate>,
    );

    expect(screen.getByTestId("gate-locked-auth.saml")).toBeInTheDocument();
    expect(screen.getByTestId("kid")).toBeInTheDocument();
    expect(screen.getByTestId("enterprise-badge")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
  });

  it("does NOT render locked-mode wrapper when the flag is on", () => {
    useFeatureFlagsStore.getState().setFlags([
      { name: "auth.saml", enabled: true, source: "ee", description: null },
    ]);

    render(
      <EnterpriseGate flag="auth.saml" showAsLocked>
        <div>SAML config</div>
      </EnterpriseGate>,
    );

    expect(screen.queryByTestId("gate-locked-auth.saml")).toBeNull();
    expect(screen.queryByTestId("enterprise-badge")).toBeNull();
    expect(screen.getByText("SAML config")).toBeInTheDocument();
  });

  it("flips visibility live when the underlying store mutates", () => {
    const { rerender } = render(
      <EnterpriseGate flag="audit.signed">
        <div>signed audit</div>
      </EnterpriseGate>,
    );
    expect(screen.queryByText("signed audit")).toBeNull();

    useFeatureFlagsStore.getState().setFlags([
      { name: "audit.signed", enabled: true, source: "ee", description: null },
    ]);
    rerender(
      <EnterpriseGate flag="audit.signed">
        <div>signed audit</div>
      </EnterpriseGate>,
    );
    expect(screen.getByText("signed audit")).toBeInTheDocument();
  });
});
