export type DarkroomTimerStatus = "idle" | "running" | "paused" | "finished";
export type SupportedAgitationPreset = "intermittent" | "every-30-seconds";

export type DarkroomTimerState = {
  durationMs: number;
  elapsedMs: number;
  remainingMs: number;
  status: DarkroomTimerStatus;
  lastStartedAtMs: number | null;
};

export type DarkroomTimerAction =
  | { type: "start"; nowMs: number }
  | { type: "pause"; nowMs: number }
  | { type: "tick"; nowMs: number }
  | { type: "reset" };

export function createDarkroomTimer(durationSeconds: number): DarkroomTimerState {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Timer duration must be a positive finite number of seconds.");
  }

  const durationMs = durationSeconds * 1_000;
  return {
    durationMs,
    elapsedMs: 0,
    remainingMs: durationMs,
    status: "idle",
    lastStartedAtMs: null,
  };
}

export function reduceDarkroomTimer(
  state: DarkroomTimerState,
  action: DarkroomTimerAction,
): DarkroomTimerState {
  switch (action.type) {
    case "start":
      requireTimestamp(action.nowMs);
      if (state.status === "running" || state.status === "finished") {
        return state;
      }
      return { ...state, status: "running", lastStartedAtMs: action.nowMs };

    case "pause": {
      requireTimestamp(action.nowMs);
      if (state.status !== "running") {
        return state;
      }
      const settled = settleAt(state, action.nowMs);
      return settled.status === "finished"
        ? settled
        : { ...settled, status: "paused", lastStartedAtMs: null };
    }

    case "tick":
      requireTimestamp(action.nowMs);
      return state.status === "running" ? settleAt(state, action.nowMs) : state;

    case "reset":
      return {
        ...state,
        elapsedMs: 0,
        remainingMs: state.durationMs,
        status: "idle",
        lastStartedAtMs: null,
      };
  }
}

/**
 * Returns only timings stated by the preset name itself. The catalog's
 * "intermittent" value has no bundled interval definition, so it deliberately
 * produces no schedule rather than inventing agitation instructions.
 */
export function getAgitationCueTimes(
  durationSeconds: number,
  preset: SupportedAgitationPreset | null | undefined,
): readonly number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Cue duration must be a positive finite number of seconds.");
  }
  if (preset !== "every-30-seconds") {
    return [];
  }

  const cueTimes: number[] = [];
  for (let seconds = 30; seconds < durationSeconds; seconds += 30) {
    cueTimes.push(seconds);
  }
  return cueTimes;
}

function settleAt(state: DarkroomTimerState, nowMs: number): DarkroomTimerState {
  const startedAt = state.lastStartedAtMs;
  if (startedAt === null) {
    return state;
  }

  const addedElapsed = Math.max(0, nowMs - startedAt);
  const elapsedMs = Math.min(state.durationMs, state.elapsedMs + addedElapsed);
  const remainingMs = state.durationMs - elapsedMs;

  return {
    ...state,
    elapsedMs,
    remainingMs,
    status: remainingMs === 0 ? "finished" : "running",
    lastStartedAtMs: remainingMs === 0 ? null : nowMs,
  };
}

function requireTimestamp(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Timer timestamp must be a non-negative finite number.");
  }
}
