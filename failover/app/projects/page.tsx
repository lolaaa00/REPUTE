"use client";

/**
 * /projects — LIVE production route.
 *
 * Reads the registered project set straight off the deployed
 * FailoverRegistry on Studionet (`list_project_ids` + `get_project`). There is
 * deliberately no fixture fallback: if the live read fails, the page shows a
 * visible error state with a retry. Fixture data lives only under /demo.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusAnnunciator } from "@/components/status/StatusAnnunciator";
import { LiveDataError } from "@/components/status/LiveDataError";
import { readProject, readProjectIds } from "@/lib/contract/registryAdapter";
import { FAILOVER_REGISTRY_ADDRESS, isDeployed } from "@/lib/contract/addresses";
import { NETWORK_CONFIG } from "@/lib/genlayer/network";
import type { ProjectRecord } from "@/lib/contract/types";

type LoadState =
  | { phase: "LOADING" }
  | { phase: "LOADED"; projects: ProjectRecord[] }
  | { phase: "ERROR"; error: string };

export function LiveProjectList() {
  const [state, setState] = useState<LoadState>({ phase: "LOADING" });

  const load = useCallback(async () => {
    setState({ phase: "LOADING" });
    try {
      const ids = await readProjectIds();
      const projects = await Promise.all(ids.map((id) => readProject(id)));
      setState({ phase: "LOADED", projects });
    } catch (err) {
      setState({
        phase: "ERROR",
        error: (err as Error)?.message ?? "Live registry read failed.",
      });
    }
  }, []);

  useEffect(() => {
    // Authoritative on-chain read on mount — an external-system fetch, not
    // state derived from props/state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state.phase === "LOADING") {
    return (
      <p className="font-mono-label text-xs uppercase text-cockpit-white/40" data-testid="live-loading">
        Reading live registry…
      </p>
    );
  }

  if (state.phase === "ERROR") {
    return <LiveDataError message={state.error} onRetry={() => void load()} />;
  }

  if (state.projects.length === 0) {
    return (
      <p className="text-cockpit-white/50 text-sm" data-testid="live-empty">
        The live registry returned no registered projects yet.{" "}
        <Link href="/new" className="text-avionics-blue underline">
          Register the first one
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="space-y-3" data-testid="live-project-list">
      {state.projects.map((project) => (
        <li key={project.project_id}>
          <Link
            href={`/p/${project.project_id}`}
            className="checksum-plate p-5 flex items-center justify-between hover:border-avionics-blue/60 transition-colors"
          >
            <div>
              <p className="font-condensed text-xl font-semibold">{project.name}</p>
              <p className="font-mono-label text-[11px] text-cockpit-white/40">{project.project_id}</p>
            </div>
            <StatusAnnunciator status={project.status} size="sm" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ProjectsPage() {
  const configured = isDeployed(FAILOVER_REGISTRY_ADDRESS);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-condensed text-3xl font-bold uppercase">Registered Projects</h1>
        <Link href="/new" className="font-mono-label text-xs uppercase underline text-avionics-blue">
          + Register
        </Link>
      </div>

      <div className="checksum-plate p-4 border-avionics-blue/50 space-y-1">
        <p className="font-mono-label text-xs uppercase text-avionics-blue">Live Studionet Data</p>
        <p className="font-mono-label text-[11px] text-cockpit-white/60 break-all">
          Chain: {NETWORK_CONFIG.chainId} | RPC: {NETWORK_CONFIG.rpcUrl} | Registry:{" "}
          {FAILOVER_REGISTRY_ADDRESS || "not configured"}
        </p>
      </div>

      {configured ? (
        <LiveProjectList />
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
