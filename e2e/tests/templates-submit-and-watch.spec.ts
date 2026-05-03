import { test, expect, type Route } from "@playwright/test";

const TEMPLATES = [
  {
    id: "hello_cdm",
    name: "Hello CDM",
    version: "0.1.0",
    description: "Bootstrap an empty OMOP CDM v5.4 schema",
    category: "bootstrap",
    tags: ["smoke"],
    cdm_versions: ["5.4"],
    parameters_schema: {
      type: "object",
      properties: {
        target_schema: {
          type: "string",
          title: "Target schema",
          default: "demo",
        },
      },
      required: ["target_schema"],
    },
  },
];

const MANIFEST = {
  ...TEMPLATES[0],
  nodes: [
    { id: "create_schema", kind: "sql_node", inputs: [], outputs: ["schema"] },
    { id: "load_seeds", kind: "csv_reader", inputs: ["schema"], outputs: [] },
  ],
  post_conditions: [
    { kind: "row_count", target: "person", op: ">=", value: 0 },
  ],
};

const RUN_BASE = {
  id: 99,
  template_id: "hello_cdm",
  template_version: "0.1.0",
  parameters: { target_schema: "demo" },
  progress: 0,
  current_node: null,
  prefect_run_id: "00000000-0000-0000-0000-000000000099",
  error_message: null,
  post_conditions: [],
  artifacts_path: null,
  submitted_by: 1,
  submitted_at: new Date().toISOString(),
  started_at: null,
  finished_at: null,
};

test.describe("Templates: submit and watch", () => {
  test("happy path through queued -> running -> completed", async ({
    page,
    baseURL,
  }) => {
    await page.route("**/api/v1/app-settings", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { ingestion: { templates_enabled: true } },
        }),
      }),
    );

    await page.route("**/api/v1/ingestion/templates", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: TEMPLATES }),
      }),
    );

    await page.route(
      "**/api/v1/ingestion/templates/hello_cdm",
      (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: MANIFEST }),
        }),
    );

    await page.route(
      "**/api/v1/ingestion/templates/hello_cdm/runs",
      (route: Route) =>
        route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ data: { id: 99 } }),
        }),
    );

    let pollCount = 0;
    await page.route(
      "**/api/v1/ingestion/templates/runs/99",
      (route: Route) => {
        pollCount += 1;
        const status =
          pollCount === 1
            ? "queued"
            : pollCount === 2
              ? "running"
              : "completed";
        const run = {
          ...RUN_BASE,
          status,
          progress: status === "completed" ? 1.0 : 0.5,
          current_node:
            status === "running"
              ? "load_seeds"
              : status === "completed"
                ? null
                : "create_schema",
          started_at: status !== "queued" ? new Date().toISOString() : null,
          finished_at:
            status === "completed" ? new Date().toISOString() : null,
          post_conditions:
            status === "completed"
              ? [
                  {
                    kind: "row_count",
                    target: "person",
                    op: ">=",
                    value: 0,
                    status: "passed",
                    detail: "0 >= 0",
                  },
                ]
              : [],
        };
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: run }),
        });
      },
    );

    await page.route(
      "**/api/v1/ingestion/templates/runs/99/logs",
      (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                timestamp: new Date().toISOString(),
                node_id: "create_schema",
                level: "info",
                message: "creating schema",
              },
            ],
          }),
        }),
    );

    await page.route(
      "**/api/v1/ingestion/templates/runs/99/artifacts",
      (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        }),
    );

    await page.route(
      "**/api/v1/ingestion/templates/runs?**",
      (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                ...RUN_BASE,
                status: "completed",
                finished_at: new Date().toISOString(),
              },
            ],
            meta: { total: 1, page: 1, per_page: 20 },
          }),
        }),
    );

    // Auth is provided by global-setup.ts (token reused across specs).
    await page.goto(
      `${baseURL ?? ""}/data-ingestion?tab=aqueduct&subtab=templates`,
    );

    await expect(page.getByText("Hello CDM")).toBeVisible();

    await page.getByRole("button", { name: "Hello CDM" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: /^Run$/ }).click();

    await expect(page).toHaveURL(/subtab=runs.*run=99|run=99.*subtab=runs/);

    await expect(page.getByTestId("run-status-completed")).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByText(/creating schema/)).toBeVisible();
  });
});
