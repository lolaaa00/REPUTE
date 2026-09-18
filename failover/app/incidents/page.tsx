"use client";

/**
 * /incidents — LIVE production route.
 *
 * Aggregates the append-only check history of every registered project from
 * the deployed FailoverRegistry (`list_project_ids` + `get_history`). No
 * fixture fallback: a failed live read renders a visible error with a retry,
 * never demo data.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LiveDataError } from "@/components/status/LiveDataError";
import { readHistory, readProjectIds } from "@/lib/contract/registryAdapter";
import { FAILOVER_REGISTRY_ADDRESS, isDeployed } from "@/lib/contract/addresses";
import { NETWORK_CONFIG } from "@/lib/genlayer/network";
import type { CheckHistoryRecord } from "@/lib/contract/types";

const TYPE_LABEL: Record<string, string> = {
  CHECK: "Safety Check",
  RECOVERY_SUBMITTED: "Recovery Submitted",
  RECOVERY_CHECK: "Recovery Check",
  PROMOTED_SAFE: "Promoted to SAFE",
};

export interface TimelineEntry {
  projectId: string;
  record: CheckHistoryRecord;
}

type LoadState =
  | { phase: "LOADING" }
  | { phase: "LOADED"; entries: TimelineEntry[] }
  | { phase: "ERROR"; error: string };

export function LiveIncidentTimeline() {
  const [state, setState] = useState<LoadState>({ phase: "LOADING" });

  const load = useCallback(async () => {
    setState({ phase: "LOADING" });
    try {
      const ids = await readProjectIds();
      const histories = await Promise.all(
        ids.map(async (projectId) => ({
          projectId,
          records: (await readHistory(projectId)) as CheckHistoryRecord[],
        })),
      );
      const entries: TimelineEntry[] = histories
        .flatMap(({ projectId, records }) => records.map((record) => ({ projectId, record })))
        .sort((a, b) => Number(a.record.at ?? 0) - Number(b.record.at ?? 0));
      setState({ phase: "LOADED", entries });
    } catch (err) {
      setState({
        phase: "ERROR",
        error: (err as Error)?.message ?? "Live registry read failed.",
      });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state.phase === "LOADING") {
    return (
      <p className="font-mono-label text-xs uppercase text-cockpit-white/40" data-testid="live-loading">
        Reading live history…
      </p>
    );
  }

  if (state.phase === "ERROR") {
    return <LiveDataError message={state.error} onRetry={() => void load()} />;
  }

  if (state.entries.length === 0) {
    return (
      <p className="text-cockpit-white/50 text-sm" data-testid="live-empty">
        No check history has been recorded on the live registry yet.
      </p>
    );
  }

  return (
    <ol className="space-y-4 border-l border-white/10 pl-6" data-testid="live-incident-timeline">
      {state.entries.map((entry, i) => (
        <HistoryItem key={`${entry.projectId}-${i}`} projectId={entry.projectId} record={entry.record} />
      ))}
    </ol>
  );
}

export default function IncidentsPage() {
  const configured = isDeployed(FAILOVER_REGISTRY_ADDRESS);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 space-y-8">
      <h1 className="font-condensed text-3xl font-bold uppercase">Incident History</h1>
      <p className="text-cockpit-white/60 text-sm max-w-xl">
        Check history is append-only on-chain — records are never overwritten, even across
        recovery. This view reads the live history of every project registered on the canonical
        Studionet deployment.
      </p>

      <div className="checksum-plate p-4 border-avionics-blue/50 space-y-1">
        <p className="font-mono-label text-xs uppercase text-avionics-blue">Live Studionet Data</p>
        <p className="font-mono-label text-[11px] text-cockpit-white/60 break-all">
          Chain: {NETWORK_CONFIG.chainId} | RPC: {NETWORK_CONFIG.rpcUrl} | Registry:{" "}
          {FAILOVER_REGISTRY_ADDRESS || "not configured"}
        </p>
      </div>

      {configured ? (
        <LiveIncidentTimeline />
      ) : (
        <LiveDataError
          title="Registry address not configured"
          message="Set NEXT_PUBLIC_FAILOVER_REGISTRY_ADDRESS to a valid Studionet address. See docs/DEPLOYMENT.md."
          onRetry={() => window.location.reload()}
        />
      )}
    </div>
  );
}

function HistoryItem({ projectId, record }: { projectId: string; record: CheckHistoryRecord }) {
  return (
    <li className="relative checksum-plate p-4">
      <span className="absolute -left-[29px] top-5 h-2.5 w-2.5 rounded-full bg-avionics-blue" aria-hidden />
      <p className="font-mono-label text-[11px] uppercase text-avionics-blue">
        {TYPE_LABEL[record.type] ?? record.type}
      </p>
      <Link
        href={`/p/${projectId}`}
        className="font-mono-label text-[11px] text-cockpit-white/60 underline break-all"
      >
        {projectId}
      </Link>
      <p className="font-mono-label text-[10px] text-cockpit-white/40 mb-2">
        {new Date(Number(record.at) * 1000).toISOString()}
      </p>
      {"finding" in record && record.finding !== undefined && (
        <p className="text-sm text-cockpit-white/80">
          Finding: <span className="font-semibold">{(record.finding as { finding: string }).finding}</span>
        </p>
      )}
      {"description" in record && typeof record.description === "string" && (
        <p className="text-sm text-cockpit-white/70 italic">&ldquo;{record.description}&rdquo;</p>
      )}
      {"new_status" in record && (
        <p className="text-sm text-cockpit-white/70">
          {String(record.previous_status)} → <span className="font-semibold">{String(record.new_status)}</span>
        </p>
      )}
    </li>
  );
}
