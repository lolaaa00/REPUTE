/**
 * Integration coverage for the LIVE production routes /projects and
 * /incidents.
 *
 * The load-bearing assertion in this file is the negative one: when a live
 * contract read fails, these pages must render a visible error state and must
 * NOT substitute anything from lib/fixtures/demoProject.ts. A green SAFE badge
 * backed by fixture data would be worse than no page at all.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const readProjectIds = vi.fn();
const readProject = vi.fn();
const readHistory = vi.fn();

vi.mock("@/lib/contract/registryAdapter", () => ({
  readProjectIds: (...args: unknown[]) => readProjectIds(...args),
  readProject: (...args: unknown[]) => readProject(...args),
  readHistory: (...args: unknown[]) => readHistory(...args),
}));

import { LiveProjectList } from "@/app/projects/page";
import { LiveIncidentTimeline } from "@/app/incidents/page";
import {
  DEMO_PROJECT_ID,
  demoProjectForStage,
  demoHistoryForStage,
} from "@/lib/fixtures/demoProject";

const LIVE_PROJECT = {
  project_id: "failover-demo",
  owner: "0x778D1663f9D5b338aBaD5C62899830AD3520a32F",
  name: "Failover Demo Project",
  status: "SAFE" as const,
  frontend_url: "https://live.example.com/",
  release_url: "https://github.com/example/app/releases/v1",
  incident_url: "https://status.example.com/",
  source_domains: ["live.example.com"],
  expected_address: "0xexpected",
  check_cooldown_seconds: 300,
  stale_release_policy: "RESTRICTED" as const,
  unavailable_policy: "RESTRICTED" as const,
  created_at: 1_700_000_000,
  activated_at: 1_700_000_100,
  version: 1,
  last_finding: "CLEAN" as const,
  recovery_pending: false,
};

const LIVE_HISTORY = [
  {
    type: "CHECK",
    at: 1_700_000_200,
    previous_status: "PENDING_FIRST_CHECK",
    new_status: "SAFE",
    finding: { finding: "CLEAN" },
    version: 1,
  },
  {
    type: "RECOVERY_SUBMITTED",
    at: 1_700_010_000,
    description: "live rotated deploy keys",
    version: 2,
  },
];

beforeEach(() => {
  readProjectIds.mockReset();
  readProject.mockReset();
  readHistory.mockReset();
});

// ---------------------------------------------------------------------------
// live project rendering
// ---------------------------------------------------------------------------

describe("live project list (/projects)", () => {
  it("renders projects read from the deployed registry", async () => {
    readProjectIds.mockResolvedValue(["failover-demo"]);
    readProject.mockResolvedValue(LIVE_PROJECT);

    render(<LiveProjectList />);

    await waitFor(() => expect(screen.getByTestId("live-project-list")).toBeInTheDocument());
    expect(screen.getByText("Failover Demo Project")).toBeInTheDocument();
    expect(screen.getByText("failover-demo")).toBeInTheDocument();
    expect(screen.getByLabelText(/Project status: SAFE/i)).toBeInTheDocument();
    expect(readProjectIds).toHaveBeenCalledTimes(1);
    expect(readProject).toHaveBeenCalledWith("failover-demo");
  });

  it("shows an error state and does NOT fall back to fixture data when the live read fails", async () => {
    readProjectIds.mockRejectedValue(new Error("RPC unreachable: studio.genlayer.com/api"));

    render(<LiveProjectList />);

    await waitFor(() => expect(screen.getByTestId("live-data-error")).toBeInTheDocument());
    expect(screen.getByText(/failed to load live data/i)).toBeInTheDocument();
    expect(screen.getByText(/RPC unreachable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry live read/i })).toBeInTheDocument();

    // The decisive check: no fixture content anywhere on the page.
    const fixture = demoProjectForStage("SAFE");
    expect(screen.queryByText(fixture.name)).toBeNull();
    expect(screen.queryByText(DEMO_PROJECT_ID)).toBeNull();
    expect(screen.queryByTestId("live-project-list")).toBeNull();
    expect(screen.queryByLabelText(/Project status: SAFE/i)).toBeNull();
    expect(document.body.textContent).not.toContain(DEMO_PROJECT_ID);
  });

  it("shows an error state (not fixtures) when a per-project get_project read fails", async () => {
    readProjectIds.mockResolvedValue(["failover-demo"]);
    readProject.mockRejectedValue(new Error("project not found on registry"));

    render(<LiveProjectList />);

    await waitFor(() => expect(screen.getByTestId("live-data-error")).toBeInTheDocument());
    expect(document.body.textContent).not.toContain(DEMO_PROJECT_ID);
  });

  it("retries the live read (and recovers) instead of degrading to fixtures", async () => {
    readProjectIds
      .mockRejectedValueOnce(new Error("transient RPC error"))
      .mockResolvedValueOnce(["failover-demo"]);
    readProject.mockResolvedValue(LIVE_PROJECT);

    render(<LiveProjectList />);

    await waitFor(() => expect(screen.getByTestId("live-data-error")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /retry live read/i }));

    await waitFor(() => expect(screen.getByTestId("live-project-list")).toBeInTheDocument());
    expect(screen.getByText("Failover Demo Project")).toBeInTheDocument();
    expect(readProjectIds).toHaveBeenCalledTimes(2);
  });

  it("reports an empty live registry honestly rather than showing a demo project", async () => {
    readProjectIds.mockResolvedValue([]);

    render(<LiveProjectList />);

    await waitFor(() => expect(screen.getByTestId("live-empty")).toBeInTheDocument());
    expect(document.body.textContent).not.toContain(DEMO_PROJECT_ID);
  });
});

// ---------------------------------------------------------------------------
// live history rendering
// ---------------------------------------------------------------------------

describe("live incident history (/incidents)", () => {
  it("renders the append-only history read from get_history, in chronological order", async () => {
    readProjectIds.mockResolvedValue(["failover-demo"]);
    readHistory.mockResolvedValue(LIVE_HISTORY);

    render(<LiveIncidentTimeline />);

    await waitFor(() => expect(screen.getByTestId("live-incident-timeline")).toBeInTheDocument());
    expect(screen.getByText("Safety Check")).toBeInTheDocument();
    expect(screen.getByText("Recovery Submitted")).toBeInTheDocument();
    expect(screen.getByText(/live rotated deploy keys/)).toBeInTheDocument();
    expect(readHistory).toHaveBeenCalledWith("failover-demo");

    const labels = screen.getAllByText(/Safety Check|Recovery Submitted/).map((n) => n.textContent);
    expect(labels).toEqual(["Safety Check", "Recovery Submitted"]);
  });

  it("merges multiple projects' histories into one chronological timeline", async () => {
    readProjectIds.mockResolvedValue(["a", "b"]);
    readHistory.mockImplementation(async (id: string) =>
      id === "a"
        ? [{ type: "CHECK", at: 300, previous_status: "SAFE", new_status: "SAFE" }]
        : [{ type: "PROMOTED_SAFE", at: 100 }],
    );

    render(<LiveIncidentTimeline />);

    await waitFor(() => expect(screen.getByTestId("live-incident-timeline")).toBeInTheDocument());
    const labels = screen.getAllByText(/Safety Check|Promoted to SAFE/).map((n) => n.textContent);
    expect(labels).toEqual(["Promoted to SAFE", "Safety Check"]);
  });

  it("shows an error state and does NOT fall back to fixture history when the live read fails", async () => {
    readProjectIds.mockResolvedValue(["failover-demo"]);
    readHistory.mockRejectedValue(new Error("get_history reverted"));

    render(<LiveIncidentTimeline />);

    await waitFor(() => expect(screen.getByTestId("live-data-error")).toBeInTheDocument());
    expect(screen.getByText(/failed to load live data/i)).toBeInTheDocument();
    expect(screen.getByText(/get_history reverted/i)).toBeInTheDocument();

    // No fixture history record leaked into the DOM.
    const fixtureDescription = demoHistoryForStage("RECOVERED_TO_SAFE")
      .map((r) => (r as { description?: unknown }).description)
      .find((d): d is string => typeof d === "string");
    expect(fixtureDescription).toBeTypeOf("string");
    expect(document.body.textContent).not.toContain(fixtureDescription as string);
    expect(screen.queryByTestId("live-incident-timeline")).toBeNull();
  });
});
