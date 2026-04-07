import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WikiIngestModal } from "../WikiIngestModal";

describe("WikiIngestModal", () => {
  it("submits pasted text without a file when text mode is selected", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <WikiIngestModal
        workspace="platform"
        loading={false}
        onSubmit={onSubmit}
        onClose={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Paste text" }));
    await user.type(screen.getByPlaceholderText("Paste source text or markdown..."), "Important paper notes");
    await user.click(screen.getByRole("button", { name: "Ingest" }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: undefined,
      rawContent: "Important paper notes",
      file: null,
    });
  });

  it("submits the uploaded file in file mode", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <WikiIngestModal
        workspace="platform"
        loading={false}
        onSubmit={onSubmit}
        onClose={() => {}}
      />,
    );

    const file = new File(["%PDF-1.7"], "paper.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/Attach a file/i), file);
    await user.click(screen.getByRole("button", { name: "Ingest" }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: undefined,
      rawContent: undefined,
      file,
    });
  });
});
