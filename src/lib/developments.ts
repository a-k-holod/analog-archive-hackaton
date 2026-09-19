import type { DevelopmentRecipe } from "@/lib/filmCatalog";
import type { DevelopmentRecord, DevelopmentRecordInput } from "@/lib/types";

/** Empty personal record — valid for rolls with no darkroom log yet. */
export function emptyDevelopmentInput(): DevelopmentRecordInput {
  return {
    developer: "",
    dilution: "",
    temperature: "",
    developmentTime: "",
    agitation: "",
    method: "",
    exposureIndex: "",
    notes: "",
    sourceRecipeId: null,
  };
}

/**
 * Copy manufacturer recipe values into a personal draft.
 * Returns a plain mutable object; never mutates the frozen catalog recipe.
 */
export function personalRecordFromRecipe(recipe: DevelopmentRecipe): DevelopmentRecordInput {
  return {
    developer: recipe.developer,
    dilution: recipe.dilution,
    temperature: formatTemperatureC(recipe.temperatureC),
    developmentTime: formatDevelopmentTime(recipe.timeSeconds),
    agitation: formatAgitationLabel(recipe.agitation),
    method: formatMethodLabel(recipe.method),
    exposureIndex: String(recipe.exposureIndex),
    notes: "",
    sourceRecipeId: recipe.id,
  };
}

export function normalizeDevelopmentInput(
  input: DevelopmentRecordInput,
): DevelopmentRecordInput {
  return {
    developer: input.developer.trim(),
    dilution: input.dilution.trim(),
    temperature: input.temperature.trim(),
    developmentTime: input.developmentTime.trim(),
    agitation: input.agitation.trim(),
    method: input.method.trim(),
    exposureIndex: input.exposureIndex.trim(),
    notes: input.notes.trim(),
    sourceRecipeId:
      typeof input.sourceRecipeId === "string" && input.sourceRecipeId.trim().length > 0
        ? input.sourceRecipeId.trim()
        : null,
  };
}

/** Whether the personal record has anything worth persisting. */
export function isPersistableDevelopment(input: DevelopmentRecordInput): boolean {
  const normalized = normalizeDevelopmentInput(input);
  return (
    normalized.developer.length > 0 ||
    normalized.dilution.length > 0 ||
    normalized.temperature.length > 0 ||
    normalized.developmentTime.length > 0 ||
    normalized.agitation.length > 0 ||
    normalized.method.length > 0 ||
    normalized.exposureIndex.length > 0 ||
    normalized.notes.length > 0
  );
}

export function formatTemperatureC(temperatureC: number): string {
  return `${temperatureC}°C`;
}

export function formatDevelopmentTime(timeSeconds: number): string {
  const minutes = Math.floor(timeSeconds / 60);
  const seconds = timeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatAgitationLabel(
  agitation: DevelopmentRecipe["agitation"],
): string {
  switch (agitation) {
    case "intermittent":
      return "Intermittent";
    case "every-30-seconds":
      return "Every 30 seconds";
    default: {
      const _exhaustive: never = agitation;
      return _exhaustive;
    }
  }
}

export function formatMethodLabel(method: DevelopmentRecipe["method"]): string {
  switch (method) {
    case "spiral-tank":
      return "Spiral tank";
    case "small-tank":
      return "Small tank";
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}

export type DevelopmentRow = {
  id: string;
  roll_id: string;
  developer: string | null;
  dilution: string | null;
  temperature: string | null;
  development_time: string | null;
  agitation: string | null;
  method: string | null;
  exposure_index: string | null;
  notes: string | null;
  source_recipe_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DevelopmentUpsertRow = {
  id: string;
  roll_id: string;
  developer: string | null;
  dilution: string | null;
  temperature: string | null;
  development_time: string | null;
  agitation: string | null;
  method: string | null;
  exposure_index: string | null;
  notes: string | null;
  source_recipe_id: string | null;
  created_at: string;
  updated_at: string;
};

export function mapDevelopmentRow(row: DevelopmentRow): DevelopmentRecord {
  return {
    id: row.id,
    developer: row.developer ?? "",
    dilution: row.dilution ?? "",
    temperature: row.temperature ?? "",
    developmentTime: row.development_time ?? "",
    agitation: row.agitation ?? "",
    method: row.method ?? "",
    exposureIndex: row.exposure_index ?? "",
    notes: row.notes ?? "",
    sourceRecipeId:
      typeof row.source_recipe_id === "string" && row.source_recipe_id.trim().length > 0
        ? row.source_recipe_id.trim()
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fill missing development fields after localStorage / partial reloads.
 * Rolls without a development stay valid (`null`).
 */
export function normalizeDevelopmentRecord(
  value: unknown,
): DevelopmentRecord | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Partial<DevelopmentRecord> & {
    id?: unknown;
    createdAt?: unknown;
  };

  if (typeof record.id !== "string" || typeof record.createdAt !== "string") {
    return null;
  }

  return {
    id: record.id,
    developer: typeof record.developer === "string" ? record.developer : "",
    dilution: typeof record.dilution === "string" ? record.dilution : "",
    temperature: typeof record.temperature === "string" ? record.temperature : "",
    developmentTime:
      typeof record.developmentTime === "string" ? record.developmentTime : "",
    agitation: typeof record.agitation === "string" ? record.agitation : "",
    method: typeof record.method === "string" ? record.method : "",
    exposureIndex:
      typeof record.exposureIndex === "string" ? record.exposureIndex : "",
    notes: typeof record.notes === "string" ? record.notes : "",
    sourceRecipeId:
      typeof record.sourceRecipeId === "string" && record.sourceRecipeId.length > 0
        ? record.sourceRecipeId
        : null,
    createdAt: record.createdAt,
    updatedAt:
      typeof record.updatedAt === "string" ? record.updatedAt : record.createdAt,
  };
}

/**
 * Prefer the most recently updated personal record when multiple rows exist.
 * Catalog recipes are never selected here.
 */
export function pickDevelopmentForRoll(
  rows: readonly DevelopmentRow[],
): DevelopmentRecord | null {
  if (rows.length === 0) {
    return null;
  }

  const sorted = [...rows].sort((a, b) => {
    const aTime = Date.parse(a.updated_at || a.created_at);
    const bTime = Date.parse(b.updated_at || b.created_at);
    return bTime - aTime;
  });

  return mapDevelopmentRow(sorted[0]!);
}

export function buildDevelopmentUpsertRow(params: {
  id: string;
  rollId: string;
  input: DevelopmentRecordInput;
  createdAt: string;
  updatedAt: string;
}): DevelopmentUpsertRow {
  const normalized = normalizeDevelopmentInput(params.input);
  return {
    id: params.id,
    roll_id: params.rollId,
    developer: emptyToNull(normalized.developer),
    dilution: emptyToNull(normalized.dilution),
    temperature: emptyToNull(normalized.temperature),
    development_time: emptyToNull(normalized.developmentTime),
    agitation: emptyToNull(normalized.agitation),
    method: emptyToNull(normalized.method),
    exposure_index: emptyToNull(normalized.exposureIndex),
    notes: emptyToNull(normalized.notes),
    source_recipe_id: normalized.sourceRecipeId,
    created_at: params.createdAt,
    updated_at: params.updatedAt,
  };
}

function emptyToNull(value: string): string | null {
  return value.length > 0 ? value : null;
}
