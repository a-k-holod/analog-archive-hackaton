"use client";

import { Button } from "@/components/Button";
import {
  createDarkroomSessionConfig,
  createSessionTimer,
  presentDarkroomTimer,
  reduceSessionTimer,
  type DarkroomSessionConfig,
} from "@/lib/darkroom/session";
import type { DarkroomTimerState } from "@/lib/darkroom/timer";
import type { DevelopmentRecord } from "@/lib/types";
import { useEffect, useState } from "react";

/**
 * Session-only countdown attached to a saved personal development record.
 * Does not read or write manufacturer recipes, and never mutates the record.
 */
export function DarkroomDevelopmentTimer({
  record,
}: {
  record: DevelopmentRecord;
}) {
  const config = createDarkroomSessionConfig(record);

  if (!config) {
    return (
      <div className="border-t border-line pt-8">
        <p className="meta">Timer session</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Save a development time (for example 13:00) to run a session timer from this
          record.
        </p>
      </div>
    );
  }

  return <DarkroomTimerControls key={timerIdentity(record, config)} config={config} />;
}

function DarkroomTimerControls({ config }: { config: DarkroomSessionConfig }) {
  const [state, setState] = useState<DarkroomTimerState>(() => createSessionTimer(config));

  useEffect(() => {
    if (state.status !== "running") {
      return;
    }

    let frameId = 0;
    const tick = () => {
      setState((current) => reduceSessionTimer(current, { type: "tick", nowMs: performance.now() }));
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [state.status]);

  const view = presentDarkroomTimer(state, config);

  function onPrimary() {
    const nowMs = performance.now();
    if (view.primaryAction === "start" || view.primaryAction === "resume") {
      setState((current) => reduceSessionTimer(current, { type: "start", nowMs }));
      return;
    }
    if (view.primaryAction === "pause") {
      setState((current) => reduceSessionTimer(current, { type: "pause", nowMs }));
    }
  }

  function onReset() {
    setState((current) => reduceSessionTimer(current, { type: "reset" }));
  }

  return (
    <div className="border-t border-line pt-8">
      <p className="meta">Timer session</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        From your saved development · does not change the record
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <p className="meta">Remaining</p>
          <p
            className="mt-1 font-mono text-4xl tracking-tight tabular-nums text-ink sm:text-5xl"
            aria-live="polite"
            aria-atomic="true"
          >
            {view.remainingLabel}
          </p>
        </div>
        <div className="space-y-1 pb-1">
          <p className="meta">
            Total <span className="text-ink">{view.totalLabel}</span>
          </p>
          <p className="meta">
            <span className="text-ink">{view.statusLabel}</span>
          </p>
        </div>
        {view.agitationCueLabel ? (
          <p
            className="pb-1 font-serif text-xl tracking-tight text-cobalt"
            aria-live="assertive"
          >
            {view.agitationCueLabel}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {view.primaryActionLabel ? (
          <Button type="button" onClick={onPrimary}>
            {view.primaryActionLabel}
          </Button>
        ) : null}
        {view.showReset ? (
          <Button type="button" variant="secondary" onClick={onReset}>
            Reset
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function timerIdentity(record: DevelopmentRecord, config: DarkroomSessionConfig): string {
  // Key on values that drive the session clock/cues — not updatedAt.
  // Saving unrelated fields (notes, developer, etc.) must not remount/reset a live timer.
  return `${record.id}:${config.durationSeconds}:${record.agitation}`;
}
