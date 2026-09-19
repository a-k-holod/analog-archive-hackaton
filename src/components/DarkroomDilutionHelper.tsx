"use client";

import { Button } from "@/components/Button";
import { Field, inputClassName } from "@/components/Field";
import {
  calculateDilution,
  parseDilutionRatioParts,
  type ConcentrateBasis,
  type DilutionResult,
  type VolumeUnit,
} from "@/lib/darkroom/dilution";
import type { DevelopmentRecord } from "@/lib/types";
import { useState } from "react";

const BASIS_OPTIONS: { value: ConcentrateBasis; label: string }[] = [
  { value: "manufacturer-concentrate", label: "Manufacturer concentrate" },
  { value: "prepared-stock-solution", label: "Prepared stock solution" },
  { value: "other-specified-concentrate", label: "Other specified concentrate" },
];

const UNIT_OPTIONS: VolumeUnit[] = ["mL", "L", "fl oz"];

/**
 * Session-only tank-volume calculator. Reads a parseable personal dilution
 * label as a starting hint; never persists runtime inputs or rewrites the record.
 */
export function DarkroomDilutionHelper({
  record,
}: {
  record: DevelopmentRecord;
}) {
  const parsed = parseDilutionRatioParts(record.dilution);
  const [concentrateParts, setConcentrateParts] = useState(
    parsed ? String(parsed.concentrateParts) : "",
  );
  const [diluentParts, setDiluentParts] = useState(
    parsed ? String(parsed.diluentParts) : "",
  );
  const [finalVolume, setFinalVolume] = useState("");
  const [unit, setUnit] = useState<VolumeUnit>("mL");
  const [concentrateBasis, setConcentrateBasis] =
    useState<ConcentrateBasis>("manufacturer-concentrate");
  const [result, setResult] = useState<DilutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onCalculate() {
    setError(null);
    setResult(null);

    const concentrate = Number(concentrateParts);
    const diluent = Number(diluentParts);
    const volume = Number(finalVolume);

    if (
      !Number.isFinite(concentrate) ||
      !Number.isFinite(diluent) ||
      concentrate <= 0 ||
      diluent <= 0
    ) {
      setError("Enter explicit concentrate and diluent parts (for example 1 and 1).");
      return;
    }
    if (!Number.isFinite(volume) || volume <= 0) {
      setError("Enter a positive final tank volume.");
      return;
    }

    try {
      setResult(
        calculateDilution({
          concentrateParts: concentrate,
          diluentParts: diluent,
          finalVolume: volume,
          unit,
          concentrateBasis,
          convention: "concentrate-plus-diluent-parts",
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not calculate dilution.");
    }
  }

  return (
    <div className="border-t border-line pt-8">
      <p className="meta">Dilution</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Session calculator · volumes are not saved with this roll
      </p>
      {parsed ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Using ratio from your record ({record.dilution.trim()}).
        </p>
      ) : record.dilution.trim() ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Saved dilution is not an explicit parts ratio — enter parts below.
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Field label="Concentrate parts">
          <input
            className={`${inputClassName} font-mono tracking-wide`}
            inputMode="decimal"
            value={concentrateParts}
            onChange={(event) => {
              setConcentrateParts(event.target.value);
              setResult(null);
              setError(null);
            }}
            placeholder="1"
            aria-label="Concentrate parts"
          />
        </Field>
        <Field label="Diluent parts">
          <input
            className={`${inputClassName} font-mono tracking-wide`}
            inputMode="decimal"
            value={diluentParts}
            onChange={(event) => {
              setDiluentParts(event.target.value);
              setResult(null);
              setError(null);
            }}
            placeholder="1"
            aria-label="Diluent parts"
          />
        </Field>
        <Field label="Final tank volume">
          <input
            className={`${inputClassName} font-mono tracking-wide`}
            inputMode="decimal"
            value={finalVolume}
            onChange={(event) => {
              setFinalVolume(event.target.value);
              setResult(null);
              setError(null);
            }}
            placeholder="500"
            aria-label="Final tank volume"
          />
        </Field>
        <Field label="Unit">
          <select
            className={inputClassName}
            value={unit}
            onChange={(event) => {
              setUnit(event.target.value as VolumeUnit);
              setResult(null);
              setError(null);
            }}
            aria-label="Volume unit"
          >
            {UNIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Concentrate basis">
            <select
              className={inputClassName}
              value={concentrateBasis}
              onChange={(event) => {
                setConcentrateBasis(event.target.value as ConcentrateBasis);
                setResult(null);
                setError(null);
              }}
              aria-label="Concentrate basis"
            >
              {BASIS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Required when the product can mean concentrate or stock solution. No
            conversion between bases.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Button type="button" variant="secondary" onClick={onCalculate}>
          Calculate volumes
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {result ? (
        <dl className="meta mt-6 grid gap-2 leading-relaxed sm:grid-cols-2">
          <div>
            <dt className="inline text-muted">Ratio </dt>
            <dd className="inline font-mono text-ink">{result.ratio.label}</dd>
          </div>
          <div>
            <dt className="inline text-muted">Basis </dt>
            <dd className="inline text-ink">{basisLabel(result.ratio.concentrateBasis)}</dd>
          </div>
          <div>
            <dt className="inline text-muted">Concentrate </dt>
            <dd className="inline font-mono text-ink">
              {formatVolume(result.concentrateVolume)} {result.unit}
            </dd>
          </div>
          <div>
            <dt className="inline text-muted">Diluent </dt>
            <dd className="inline font-mono text-ink">
              {formatVolume(result.diluentVolume)} {result.unit}
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

function basisLabel(basis: ConcentrateBasis): string {
  return BASIS_OPTIONS.find((option) => option.value === basis)?.label ?? basis;
}

function formatVolume(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Number(value.toFixed(4)));
}
