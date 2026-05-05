import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ParameterForm } from "../components/aqueduct/templates/ParameterForm";
import type { TemplateManifest } from "../types/templates";

function makeManifest(
  schema: TemplateManifest["parameters_schema"],
): TemplateManifest {
  return {
    id: "x",
    name: "X",
    version: "0.1.0",
    description: "",
    category: "etl",
    tags: [],
    cdm_versions: ["5.4"],
    parameters_schema: schema,
    nodes: [],
    post_conditions: [],
  };
}

describe("ParameterForm", () => {
  it("renders a string field", () => {
    const m = makeManifest({
      type: "object",
      properties: {
        target_schema: { type: "string", title: "Target schema" },
      },
      required: ["target_schema"],
    });
    render(
      <ParameterForm manifest={m} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByLabelText(/Target schema/)).toBeInTheDocument();
  });

  it("renders a number field", () => {
    const m = makeManifest({
      type: "object",
      properties: { batch_size: { type: "number", title: "Batch size" } },
    });
    render(
      <ParameterForm manifest={m} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    const el = screen.getByLabelText(/Batch size/) as HTMLInputElement;
    expect(el.type).toBe("number");
  });

  it("renders an enum as a select", () => {
    const m = makeManifest({
      type: "object",
      properties: {
        patient_count: {
          type: "string",
          title: "Patient count",
          enum: ["1k", "100k"],
        },
      },
    });
    render(
      <ParameterForm manifest={m} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByLabelText(/Patient count/)).toHaveProperty(
      "tagName",
      "SELECT",
    );
  });

  it("renders a secret string as a password input", () => {
    const m = makeManifest({
      type: "object",
      properties: {
        api_token: {
          type: "string",
          title: "API token",
          secret: true,
        },
      },
    });
    render(
      <ParameterForm manifest={m} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    const el = screen.getByLabelText(/API token/) as HTMLInputElement;
    expect(el.type).toBe("password");
  });

  it("renders a boolean as a checkbox", () => {
    const m = makeManifest({
      type: "object",
      properties: {
        dry_run: { type: "boolean", title: "Dry run" },
      },
    });
    render(
      <ParameterForm manifest={m} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    const el = screen.getByLabelText(/Dry run/) as HTMLInputElement;
    expect(el.type).toBe("checkbox");
  });

  it("blocks submit when a required field is empty (client-side ajv8)", () => {
    const m = makeManifest({
      type: "object",
      properties: { target_schema: { type: "string", title: "Target schema" } },
      required: ["target_schema"],
    });
    const onSubmit = vi.fn();
    render(
      <ParameterForm manifest={m} onSubmit={onSubmit} onCancel={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Run/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables submit while pending", () => {
    const m = makeManifest({
      type: "object",
      properties: { target_schema: { type: "string", title: "Target schema" } },
    });
    render(
      <ParameterForm
        manifest={m}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        pending
      />,
    );
    const btn = screen.getByRole("button", { name: /Running/i });
    expect(btn).toBeDisabled();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const m = makeManifest({
      type: "object",
      properties: { target_schema: { type: "string" } },
    });
    const onCancel = vi.fn();
    render(
      <ParameterForm manifest={m} onSubmit={vi.fn()} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
