import { describe, it, expect } from "vitest";
import { etlTemplatesEn } from "../etlTemplatesResources";

function getDeep(tree: unknown, path: string[]): unknown {
  return path.reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === "object" && key in (acc as Record<string, unknown>)
        ? (acc as Record<string, unknown>)[key]
        : undefined,
    tree,
  );
}

const REQUIRED_KEYS: string[][] = [
  ["aqueduct", "subtabs", "mappings"],
  ["aqueduct", "subtabs", "templates"],
  ["aqueduct", "subtabs", "runs"],
  ["aqueduct", "subtabs", "aria"],
  ["aqueduct", "templates", "empty"],
  ["aqueduct", "templates", "error"],
  ["aqueduct", "templates", "retry"],
  ["aqueduct", "runs", "empty"],
  ["aqueduct", "runs", "backToList"],
  ["aqueduct", "runs", "pageOf"],
  ["aqueduct", "runs", "prev"],
  ["aqueduct", "runs", "next"],
  ["aqueduct", "runs", "columns", "template"],
  ["aqueduct", "runs", "columns", "version"],
  ["aqueduct", "runs", "columns", "status"],
  ["aqueduct", "runs", "columns", "started"],
  ["aqueduct", "runs", "columns", "duration"],
  ["aqueduct", "runs", "columns", "submitted_by"],
  ["aqueduct", "runInspector", "dag"],
  ["aqueduct", "runInspector", "logs"],
  ["aqueduct", "runInspector", "artifacts"],
  ["aqueduct", "runInspector", "cancel"],
  ["aqueduct", "runInspector", "retry"],
  ["aqueduct", "runInspector", "noLogs"],
  ["aqueduct", "runInspector", "noArtifacts"],
  ["aqueduct", "runInspector", "versionLabel"],
  ["aqueduct", "parameterForm", "run"],
  ["aqueduct", "parameterForm", "running"],
  ["aqueduct", "parameterForm", "cancel"],
  ["aqueduct", "parameterForm", "close"],
  ["aqueduct", "status", "pending"],
  ["aqueduct", "status", "queued"],
  ["aqueduct", "status", "running"],
  ["aqueduct", "status", "completed"],
  ["aqueduct", "status", "failed"],
  ["aqueduct", "status", "cancelled"],
];

describe("etlTemplatesResources", () => {
  for (const path of REQUIRED_KEYS) {
    it(`declares ${path.join(".")}`, () => {
      const v = getDeep(etlTemplatesEn, path);
      expect(typeof v).toBe("string");
      expect((v as string).length).toBeGreaterThan(0);
    });
  }
});
