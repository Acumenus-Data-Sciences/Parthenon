import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrafficLightBadge, getLevel } from "../TrafficLightBadge";

const thresholds = { green: 80, amber: 50 };

describe("getLevel", () => {
  it("returns green when value >= green threshold (higher is better)", () => {
    expect(getLevel(80, thresholds)).toBe("green");
    expect(getLevel(100, thresholds)).toBe("green");
  });

  it("returns amber when value >= amber threshold but < green", () => {
    expect(getLevel(50, thresholds)).toBe("amber");
    expect(getLevel(79, thresholds)).toBe("amber");
  });

  it("returns red when value < amber threshold", () => {
    expect(getLevel(49, thresholds)).toBe("red");
    expect(getLevel(0, thresholds)).toBe("red");
  });

  it("inverts logic when higherIsBetter is false", () => {
    const t = { green: 5, amber: 10 };
    expect(getLevel(3, t, false)).toBe("green");
    expect(getLevel(7, t, false)).toBe("amber");
    expect(getLevel(15, t, false)).toBe("red");
  });
});

describe("TrafficLightBadge", () => {
  it("renders green verdict", () => {
    render(<TrafficLightBadge value={90} thresholds={thresholds} label="AUC" />);
    expect(screen.getByText("AUC: Good")).toBeInTheDocument();
  });

  it("renders amber verdict", () => {
    render(<TrafficLightBadge value={60} thresholds={thresholds} label="AUC" />);
    expect(screen.getByText("AUC: Acceptable")).toBeInTheDocument();
  });

  it("renders red verdict", () => {
    render(<TrafficLightBadge value={30} thresholds={thresholds} label="AUC" />);
    expect(screen.getByText("AUC: Poor")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(
      <TrafficLightBadge value={90} thresholds={thresholds} label="Score" className="extra" />,
    );
    const badge = screen.getByTestId("traffic-light-badge");
    expect(badge.className).toContain("extra");
  });
});
