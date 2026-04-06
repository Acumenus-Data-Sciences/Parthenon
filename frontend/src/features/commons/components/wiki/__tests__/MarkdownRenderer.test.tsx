import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "../MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("turns wikilinks into navigation buttons", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(<MarkdownRenderer markdown={"See [[related-page]] for more."} onNavigate={onNavigate} />);

    await user.click(screen.getByRole("button", { name: "related-page" }));
    expect(onNavigate).toHaveBeenCalledWith("related-page");
  });
});
