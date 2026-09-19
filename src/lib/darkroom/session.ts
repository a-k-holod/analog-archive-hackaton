import { formatDevelopmentTime } from "../developments.ts";
import type { DevelopmentRecord } from "../types.ts";
import {
  createDarkroomTimer,
  getAgitationCueTimes,
  reduceDarkroomTimer,
  type DarkroomTimerAction,
  type DarkroomTimerState,
  type DarkroomTimerStatus,
  type SupportedAgitationPreset,
} from "./timer.ts";

/** How long an agitation cue stays visible after its scheduled instant. */
export const AGITATION_CUE_WINDOW_MS = 2_000;

export type DarkroomSessionConfig = {
  durationSeconds: number;
  developmentTimeLabel: string;
  agitationPreset: SupportedAgitationPreset | null;
  cueTimesSeconds: readonly number[];
};

export type DarkroomTimerPresentation = {
  status: DarkroomTimerStatus;
  statusLabel: string;
  totalLabel: string;
  remainingLabel: string;
  primaryAction: "start" | "pause" | "resume" | null;
  primaryActionLabel: string | null;
  showReset: boolean;
  agitationCueActive: boolean;
  agitationCueLabel: string | null;
};

/**
 * Parse a personal development time string (`m:ss` / `mm:ss`) into seconds.
 * Returns null when the value is missing or not a clear clock duration.
 */
export function parseDevelopmentTimeToSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = /^(\d+):([0-5]\d)$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }

  const total = minutes * 60 + seconds;
  return total > 0 ? total : null;
}

/**
 * Map saved agitation text to a timer preset only for canonical labels.
 * Unknown / free-text values return null (no automatic cues).
 * The `intermittent` preset is recognized but produces no cue schedule.
 */
export function resolveAgitationPresetFromText(
  agitation: string,
): SupportedAgitationPreset | null {
  const normalized = agitation.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized === "every-30-seconds" || normalized === "every 30 seconds") {
    return "every-30-seconds";
  }
  if (normalized === "intermittent") {
    return "intermittent";
  }
  return null;
}

/**
 * Build a session config from the photographer's saved personal record only.
 * Manufacturer recipe times are never consulted here.
 */
export function createDarkroomSessionConfig(
  record: Pick<DevelopmentRecord, "developmentTime" | "agitation">,
): DarkroomSessionConfig | null {
  const durationSeconds = parseDevelopmentTimeToSeconds(record.developmentTime);
  if (durationSeconds === null) {
    return null;
  }

  const agitationPreset = resolveAgitationPresetFromText(record.agitation);
  return {
    durationSeconds,
    developmentTimeLabel: formatDevelopmentTime(durationSeconds),
    agitationPreset,
    cueTimesSeconds: getAgitationCueTimes(durationSeconds, agitationPreset),
  };
}

export function createSessionTimer(config: DarkroomSessionConfig): DarkroomTimerState {
  return createDarkroomTimer(config.durationSeconds);
}

export function reduceSessionTimer(
  state: DarkroomTimerState,
  action: DarkroomTimerAction,
): DarkroomTimerState {
  return reduceDarkroomTimer(state, action);
}

/**
 * True while elapsed time sits in the short window after a scheduled cue instant.
 */
export function isAgitationCueActive(
  elapsedMs: number,
  cueTimesSeconds: readonly number[],
  windowMs: number = AGITATION_CUE_WINDOW_MS,
): boolean {
  if (cueTimesSeconds.length === 0 || elapsedMs < 0 || windowMs <= 0) {
    return false;
  }

  for (const cueSeconds of cueTimesSeconds) {
    const cueMs = cueSeconds * 1_000;
    if (elapsedMs >= cueMs && elapsedMs < cueMs + windowMs) {
      return true;
    }
  }
  return false;
}

export function formatTimerClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1_000));
  return formatDevelopmentTime(totalSeconds);
}

export function timerStatusLabel(status: DarkroomTimerStatus): string {
  switch (status) {
    case "idle":
      return "Ready";
    case "running":
      return "Running";
    case "paused":
      return "Paused";
    case "finished":
      return "Finished";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function presentDarkroomTimer(
  state: DarkroomTimerState,
  config: DarkroomSessionConfig,
): DarkroomTimerPresentation {
  const agitationCueActive =
    state.status === "running" &&
    isAgitationCueActive(state.elapsedMs, config.cueTimesSeconds);

  let primaryAction: DarkroomTimerPresentation["primaryAction"] = null;
  let primaryActionLabel: string | null = null;

  switch (state.status) {
    case "idle":
      primaryAction = "start";
      primaryActionLabel = "Start timer";
      break;
    case "running":
      primaryAction = "pause";
      primaryActionLabel = "Pause";
      break;
    case "paused":
      primaryAction = "resume";
      primaryActionLabel = "Resume";
      break;
    case "finished":
      primaryAction = null;
      primaryActionLabel = null;
      break;
  }

  return {
    status: state.status,
    statusLabel: timerStatusLabel(state.status),
    totalLabel: config.developmentTimeLabel,
    remainingLabel: formatTimerClock(state.remainingMs),
    primaryAction,
    primaryActionLabel,
    showReset: state.status !== "idle",
    agitationCueActive,
    agitationCueLabel: agitationCueActive ? "Agitate" : null,
  };
}
