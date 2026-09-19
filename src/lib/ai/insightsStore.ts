import type {
  EvidencedClaim,
  FrameSequence,
  FrameTag,
  RollInsight,
} from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Versioned envelope stored in roll_insights.sequences (jsonb).
 * Carries everything needed to reconstruct a RollInsight.
 */
export type RollInsightEnvelopeV1 = {
  version: 1;
  contentHash: string;
  provider: string;
  model: string | null;
  generatedAt: string;
  summary: EvidencedClaim;
  recurringSubjects: EvidencedClaim[];
  recurringThemes: EvidencedClaim[];
  sequences: FrameSequence[];
  frameTags: FrameTag[];
  technicalObservations: EvidencedClaim[];
  nonObviousObservations: EvidencedClaim[];
  uncertainties: string[];
};

export type RollInsightRecord = {
  id: string;
  rollId: string;
  createdAt: string;
  insight: RollInsight;
};

type RollInsightRow = {
  id: string;
  roll_id: string;
  summary: string | null;
  subjects: string[] | null;
  sequences: unknown;
  tags: string[] | null;
  created_at: string;
};

export function toInsightEnvelope(insight: RollInsight): RollInsightEnvelopeV1 {
  return {
    version: 1,
    contentHash: insight.contentHash,
    provider: insight.provider,
    model: insight.model,
    generatedAt: insight.generatedAt,
    summary: insight.summary,
    recurringSubjects: insight.recurringSubjects,
    recurringThemes: insight.recurringThemes,
    sequences: insight.sequences,
    frameTags: insight.frameTags,
    technicalObservations: insight.technicalObservations,
    nonObviousObservations: insight.nonObviousObservations,
    uncertainties: insight.uncertainties,
  };
}

export function insightFromEnvelope(envelope: RollInsightEnvelopeV1): RollInsight {
  return {
    version: 1,
    generatedAt: envelope.generatedAt,
    provider: envelope.provider,
    model: envelope.model,
    contentHash: envelope.contentHash,
    summary: envelope.summary,
    recurringSubjects: envelope.recurringSubjects,
    recurringThemes: envelope.recurringThemes,
    sequences: envelope.sequences,
    frameTags: envelope.frameTags,
    technicalObservations: envelope.technicalObservations,
    nonObviousObservations: envelope.nonObviousObservations,
    uncertainties: envelope.uncertainties,
  };
}

export function mapInsightToRowColumns(insight: RollInsight): {
  summary: string;
  subjects: string[];
  tags: string[];
  sequences: RollInsightEnvelopeV1;
} {
  return {
    summary: insight.summary.text,
    subjects: insight.recurringSubjects.map((claim) => claim.text),
    tags: insight.recurringThemes.map((claim) => claim.text),
    sequences: toInsightEnvelope(insight),
  };
}

/** Insert a new insight row. Never overwrites prior analyses. */
export async function insertRollInsight(
  supabase: SupabaseClient,
  rollId: string,
  insight: RollInsight,
): Promise<RollInsightRecord> {
  const columns = mapInsightToRowColumns(insight);
  const { data, error } = await supabase
    .from("roll_insights")
    .insert({
      roll_id: rollId,
      summary: columns.summary,
      subjects: columns.subjects,
      tags: columns.tags,
      sequences: columns.sequences,
    })
    .select("id, roll_id, summary, subjects, sequences, tags, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return rowToRecord(data as RollInsightRow);
}

/** Latest insight for a roll by created_at, regardless of content hash. */
export async function fetchLatestRollInsight(
  supabase: SupabaseClient,
  rollId: string,
): Promise<RollInsightRecord | null> {
  const { data, error } = await supabase
    .from("roll_insights")
    .select("id, roll_id, summary, subjects, sequences, tags, created_at")
    .eq("roll_id", rollId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  return rowToRecord(data as RollInsightRow);
}

/**
 * Latest insight whose stored contentHash matches.
 * Walks newest-first so historical rows remain intact.
 */
export async function findLatestInsightMatchingContentHash(
  supabase: SupabaseClient,
  rollId: string,
  contentHash: string,
): Promise<RollInsightRecord | null> {
  const { data, error } = await supabase
    .from("roll_insights")
    .select("id, roll_id, summary, subjects, sequences, tags, created_at")
    .eq("roll_id", rollId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as RollInsightRow[]) {
    const envelope = parseEnvelope(row.sequences);
    if (envelope && envelope.contentHash === contentHash) {
      return rowToRecord(row, envelope);
    }
  }
  return null;
}

function rowToRecord(row: RollInsightRow, knownEnvelope?: RollInsightEnvelopeV1): RollInsightRecord {
  const envelope = knownEnvelope ?? parseEnvelope(row.sequences);
  if (!envelope) {
    throw new Error(`roll_insights row ${row.id} is missing a versioned insight envelope.`);
  }
  return {
    id: row.id,
    rollId: row.roll_id,
    createdAt: row.created_at,
    insight: insightFromEnvelope(envelope),
  };
}

function parseEnvelope(value: unknown): RollInsightEnvelopeV1 | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.version !== 1) {
    return null;
  }
  if (typeof value.contentHash !== "string" || typeof value.provider !== "string") {
    return null;
  }
  if (typeof value.generatedAt !== "string") {
    return null;
  }
  if (value.model !== null && typeof value.model !== "string") {
    return null;
  }
  if (!isEvidencedClaim(value.summary)) {
    return null;
  }
  if (!Array.isArray(value.recurringSubjects) || !value.recurringSubjects.every(isEvidencedClaim)) {
    return null;
  }
  if (!Array.isArray(value.recurringThemes) || !value.recurringThemes.every(isEvidencedClaim)) {
    return null;
  }
  if (!Array.isArray(value.sequences) || !value.sequences.every(isFrameSequence)) {
    return null;
  }
  if (!Array.isArray(value.frameTags) || !value.frameTags.every(isFrameTag)) {
    return null;
  }
  if (
    !Array.isArray(value.technicalObservations) ||
    !value.technicalObservations.every(isEvidencedClaim)
  ) {
    return null;
  }
  if (
    !Array.isArray(value.nonObviousObservations) ||
    !value.nonObviousObservations.every(isEvidencedClaim)
  ) {
    return null;
  }
  if (
    !Array.isArray(value.uncertainties) ||
    !value.uncertainties.every((item) => typeof item === "string")
  ) {
    return null;
  }

  return value as RollInsightEnvelopeV1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEvidenceKind(value: unknown): value is EvidencedClaim["kind"] {
  return value === "photograph" || value === "photographer" || value === "inferred";
}

function isEvidencedClaim(value: unknown): value is EvidencedClaim {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.text !== "string" || !isEvidenceKind(value.kind)) {
    return false;
  }
  if (value.frameNumbers === undefined) {
    return true;
  }
  return (
    Array.isArray(value.frameNumbers) && value.frameNumbers.every((n) => typeof n === "number")
  );
}

function isFrameSequence(value: unknown): value is FrameSequence {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.label === "string" &&
    Array.isArray(value.frameNumbers) &&
    value.frameNumbers.every((n) => typeof n === "number") &&
    isEvidencedClaim(value.reading)
  );
}

function isFrameTag(value: unknown): value is FrameTag {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.frameNumber === "number" &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    isEvidenceKind(value.kind)
  );
}
