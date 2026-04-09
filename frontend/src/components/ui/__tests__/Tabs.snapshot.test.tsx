import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TabBar, TabPanel } from "../Tabs";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "details", label: "Details" },
  { id: "history", label: "History" },
];

describe("Tabs snapshots (dark clinical theme)", () => {
  it("renders the TabBar with the middle tab active", () => {
    const { container } = render(
      <TabBar tabs={tabs} activeTab="details" onTabChange={() => {}} />,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="tab-bar"
        role="tablist"
      >
        <button
          aria-controls="tabpanel-overview"
          aria-selected="false"
          class="tab-item"
          role="tab"
        >
          Overview
        </button>
        <button
          aria-controls="tabpanel-details"
          aria-selected="true"
          class="tab-item active"
          role="tab"
        >
          Details
        </button>
        <button
          aria-controls="tabpanel-history"
          aria-selected="false"
          class="tab-item"
          role="tab"
        >
          History
        </button>
      </div>
    `);
    expect(container.innerHTML).toMatch(/tab-item active/);
    expect(container.innerHTML).toMatch(/aria-selected="true"/);
  });

  it("renders a visible TabPanel when active=true", () => {
    const { container } = render(
      <TabPanel id="details" active>
        Panel content
      </TabPanel>,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        aria-labelledby="details"
        id="tabpanel-details"
        role="tabpanel"
      >
        Panel content
      </div>
    `);
    expect(container.innerHTML).toMatch(/role="tabpanel"/);
  });
});
