import { expect, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  BASE,
  authHeaders,
  collectErrors,
  dismissModals,
} from "../helpers";

const SCREENSHOT_DIR = "/tmp/patient-similarity-sweep";

interface SourceItem {
  id: number;
  source_name: string;
}

interface CohortItem {
  id: number;
  name: string;
  generation_sources?: Array<{
    source_id: number;
    source_name?: string;
    person_count?: number;
  }>;
}

interface CohortMember {
  subject_id: number;
}

async function apiJson(page: Parameters<typeof test>[0]["page"], endpoint: string) {
  const resp = await page.request.get(`${BASE}${endpoint}`, {
    headers: authHeaders(),
  });
  const data = await resp.json();
  if (!resp.ok()) {
    throw new Error(`GET ${endpoint} failed with ${resp.status()}: ${JSON.stringify(data)}`);
  }
  return data;
}

function unwrapItems(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function discoverSweepData(page: Parameters<typeof test>[0]["page"]) {
  const sourcesResp = await apiJson(page, "/api/v1/sources");
  const sources: SourceItem[] = unwrapItems(sourcesResp);
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error("No sources available for Patient Similarity visual sweep.");
  }

  const cohortsResp = await apiJson(page, "/api/v1/cohort-definitions?limit=100");
  const cohortItems: CohortItem[] = unwrapItems(cohortsResp);
  if (cohortItems.length === 0) {
    throw new Error("No cohort definitions available for Patient Similarity visual sweep.");
  }

  for (const source of sources) {
    const generatedCohorts = cohortItems.filter((cohort) =>
      Array.isArray(cohort.generation_sources) &&
      cohort.generation_sources.some((gen) => gen.source_id === source.id),
    );
    if (generatedCohorts.length < 2) {
      continue;
    }

    const cohortsWithMembers: Array<{
      cohort: CohortItem;
      members: CohortMember[];
    }> = [];

    for (const cohort of generatedCohorts) {
      const membersResp = await apiJson(
        page,
        `/api/v1/sources/${source.id}/cohorts/${cohort.id}/members?page=1&per_page=5`,
      );
      const members: CohortMember[] = membersResp.data ?? [];
      if (Array.isArray(members) && members.length > 0) {
        cohortsWithMembers.push({ cohort, members });
      }

      if (cohortsWithMembers.length >= 2) {
        return {
          source,
          singlePatientId: cohortsWithMembers[0].members[0].subject_id,
          searchCohort: cohortsWithMembers[0].cohort,
          compareSourceCohort: cohortsWithMembers[0].cohort,
          compareTargetCohort: cohortsWithMembers[1].cohort,
        };
      }
    }
  }

  throw new Error("Could not find a source with one searchable generated cohort and a second generated cohort for comparison.");
}

async function selectOptionByText(
  select: ReturnType<Parameters<typeof test>[0]["page"]["locator"]>,
  text: string,
) {
  const options = await select.locator("option").allTextContents();
  const match = options.find((option) => option.trim() === text.trim());
  if (!match) {
    throw new Error(`Option "${text}" not found. Available options: ${options.join(", ")}`);
  }
  await select.selectOption({ label: match });
}

function selectForLabel(
  page: Parameters<typeof test>[0]["page"],
  labelText: string,
) {
  return page.locator(
    `xpath=//label[contains(normalize-space(.), "${labelText}")]/following-sibling::select[1]`,
  );
}

test.describe("Patient Similarity visual sweep", () => {
  test("single, cohort, and compare tabs render and interact cleanly", async ({ page }) => {
    test.setTimeout(120_000);
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const sweepData = await discoverSweepData(page);
    const errors = collectErrors(page);

    await page.goto(`${BASE}/patient-similarity`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await dismissModals(page);

    await expect(page.getByRole("heading", { name: "Patient Similarity" })).toBeVisible();

    const sourceSelect = selectForLabel(page, "Data Source");
    await selectOptionByText(sourceSelect, sweepData.source.source_name);

    const patientInput = page.getByPlaceholder(/type person id or mrn/i);
    await patientInput.fill(String(sweepData.singlePatientId));
    await page.getByRole("button", { name: "Find Similar Patients" }).click();
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "single-tab.png"),
      fullPage: true,
    });

    const rowToggle = page.locator("tbody tr").first();
    if (await rowToggle.count()) {
      await rowToggle.click();
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "single-tab-expanded.png"),
        fullPage: true,
      });
    }

    await page.getByRole("button", { name: "From Cohort" }).click();
    await page.waitForTimeout(1200);

    await selectOptionByText(selectForLabel(page, "Data Source"), sweepData.source.source_name);
    await selectOptionByText(selectForLabel(page, "Seed Cohort"), sweepData.searchCohort.name);
    await page.waitForTimeout(2500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "cohort-tab-before-search.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Find Similar Patients" }).click();
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "cohort-tab-results.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Compare Cohorts" }).click();
    await page.waitForTimeout(1200);

    await selectOptionByText(selectForLabel(page, "Data Source"), sweepData.source.source_name);
    await selectOptionByText(selectForLabel(page, "Source Cohort"), sweepData.compareSourceCohort.name);
    await selectOptionByText(selectForLabel(page, "Target Cohort"), sweepData.compareTargetCohort.name);
    await page.waitForTimeout(2500);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "compare-tab-before-compare.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Compare Profiles" }).click();
    await page.waitForTimeout(3000);

    await expect(
      page.getByRole("heading", { name: "Profile Comparison" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Divergence Scores" }),
    ).toBeVisible();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "compare-tab-compared.png"),
      fullPage: true,
    });

    const crossSearchButton = page.getByRole("button", {
      name: "Find Matching Patients",
    });
    await expect(crossSearchButton).toBeVisible();
    await crossSearchButton.click();
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "compare-tab-cross-search.png"),
      fullPage: true,
    });

    const hardCrashes = errors.pageErrors.filter(
      (message) =>
        message.includes("Cannot read properties") ||
        message.includes("is not a function") ||
        message.includes("undefined"),
    );
    expect(hardCrashes, `Page crashes detected: ${hardCrashes.join(" | ")}`).toEqual([]);
  });
});
