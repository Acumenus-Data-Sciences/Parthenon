import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunLogsView } from "../components/aqueduct/templates/RunLogsView";
import type { TemplateRunLog } from "../types/templates";

describe("RunLogsView", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("renders a monospace pre with one line per log entry", () => {
    const logs: TemplateRunLog[] = [
      {
        timestamp: "2026-05-02T12:00:00Z",
        node_id: "n1",
        level: "info",
        message: "starting",
      },
      {
        timestamp: "2026-05-02T12:00:01Z",
        node_id: "n1",
        level: "warn",
        message: "slow query",
      },
    ];
    render(<RunLogsView logs={logs} isRunning={false} />);
    const pre = screen.getByTestId("run-logs-pre");
    expect(pre.tagName).toBe("PRE");
    expect(pre.textContent).toContain("starting");
    expect(pre.textContent).toContain("slow query");
  });

  it("shows an empty state when there are no logs", () => {
    render(<RunLogsView logs={[]} isRunning={false} />);
    expect(screen.getByText(/No logs yet/i)).toBeInTheDocument();
  });

  it("calls scrollIntoView on the bottom anchor while running", () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    const logs: TemplateRunLog[] = [
      { timestamp: "t", node_id: null, level: "info", message: "hi" },
    ];
    render(<RunLogsView logs={logs} isRunning={true} />);
    expect(scrollSpy).toHaveBeenCalled();
  });

  it("does NOT auto-scroll when terminal", () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    const logs: TemplateRunLog[] = [
      { timestamp: "t", node_id: null, level: "info", message: "hi" },
    ];
    render(<RunLogsView logs={logs} isRunning={false} />);
    expect(scrollSpy).not.toHaveBeenCalled();
  });
});
