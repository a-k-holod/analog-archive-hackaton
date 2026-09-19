export type VolumeUnit = "mL" | "L" | "fl oz";

/**
 * Identifies what the first ratio component physically refers to.
 * This is deliberately required because products such as HC-110 are commonly
 * described using ratios based on either concentrate or a prepared stock
 * solution. The calculator never converts between those bases.
 */
export type ConcentrateBasis =
  | "manufacturer-concentrate"
  | "prepared-stock-solution"
  | "other-specified-concentrate";

export type DilutionInput = {
  concentrateParts: number;
  diluentParts: number;
  finalVolume: number;
  unit: VolumeUnit;
  concentrateBasis: ConcentrateBasis;
  convention: "concentrate-plus-diluent-parts";
};

export type DilutionResult = {
  concentrateVolume: number;
  diluentVolume: number;
  finalVolume: number;
  unit: VolumeUnit;
  ratio: {
    concentrateParts: number;
    diluentParts: number;
    label: string;
    convention: DilutionInput["convention"];
    concentrateBasis: ConcentrateBasis;
  };
};

/**
 * Conservatively parse a displayed dilution such as `1+1` or `1:1`.
 * Returns null for letters, stock names, or any ambiguous free text.
 * Does not rewrite or normalize the original string.
 */
export function parseDilutionRatioParts(
  value: string,
): { concentrateParts: number; diluentParts: number } | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = /^(\d+(?:\.\d+)?)\s*[+:]\s*(\d+(?:\.\d+)?)$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const concentrateParts = Number(match[1]);
  const diluentParts = Number(match[2]);
  if (
    !Number.isFinite(concentrateParts) ||
    !Number.isFinite(diluentParts) ||
    concentrateParts <= 0 ||
    diluentParts <= 0
  ) {
    return null;
  }

  return { concentrateParts, diluentParts };
}

/**
 * Run the deterministic calculator from a personal dilution label plus runtime
 * tank inputs. Returns null when the saved label is not an explicit parts ratio.
 * Never mutates the personal record or converts chemistry conventions.
 */
export function calculateDilutionFromPersonalLabel(
  dilutionLabel: string,
  runtime: {
    finalVolume: number;
    unit: VolumeUnit;
    concentrateBasis: ConcentrateBasis;
  },
): DilutionResult | null {
  const parts = parseDilutionRatioParts(dilutionLabel);
  if (!parts) {
    return null;
  }

  return calculateDilution({
    ...parts,
    finalVolume: runtime.finalVolume,
    unit: runtime.unit,
    concentrateBasis: runtime.concentrateBasis,
    convention: "concentrate-plus-diluent-parts",
  });
}

/**
 * Splits a requested final volume according to explicit concentrate+diluent
 * parts. No product-specific chemistry, rounding, or stock-strength conversion
 * is applied.
 */
export function calculateDilution(input: DilutionInput): DilutionResult {
  requirePositiveFinite(input.concentrateParts, "Concentrate parts");
  requirePositiveFinite(input.diluentParts, "Diluent parts");
  requirePositiveFinite(input.finalVolume, "Final volume");

  const totalParts = input.concentrateParts + input.diluentParts;
  const concentrateVolume = (input.finalVolume * input.concentrateParts) / totalParts;

  return {
    concentrateVolume,
    diluentVolume: input.finalVolume - concentrateVolume,
    finalVolume: input.finalVolume,
    unit: input.unit,
    ratio: {
      concentrateParts: input.concentrateParts,
      diluentParts: input.diluentParts,
      label: `${formatPart(input.concentrateParts)}+${formatPart(input.diluentParts)}`,
      convention: input.convention,
      concentrateBasis: input.concentrateBasis,
    },
  };
}

function requirePositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`);
  }
}

function formatPart(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}
