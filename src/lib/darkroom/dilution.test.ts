import assert from "node:assert/strict";
import test from "node:test";
import { DEVELOPMENT_RECIPES } from "../filmCatalog.ts";
import { personalRecordFromRecipe } from "../developments.ts";
import {
  calculateDilution,
  calculateDilutionFromPersonalLabel,
  parseDilutionRatioParts,
} from "./dilution.ts";

test("calculateDilution deterministically splits concentrate+diluent parts", () => {
  const result = calculateDilution({
    concentrateParts: 1,
    diluentParts: 1,
    finalVolume: 500,
    unit: "mL",
    concentrateBasis: "manufacturer-concentrate",
    convention: "concentrate-plus-diluent-parts",
  });

  assert.deepEqual(result, {
    concentrateVolume: 250,
    diluentVolume: 250,
    finalVolume: 500,
    unit: "mL",
    ratio: {
      concentrateParts: 1,
      diluentParts: 1,
      label: "1+1",
      convention: "concentrate-plus-diluent-parts",
      concentrateBasis: "manufacturer-concentrate",
    },
  });
});

test("calculateDilution preserves an explicit concentrate basis for ambiguous conventions", () => {
  const fromConcentrate = calculateDilution({
    concentrateParts: 1,
    diluentParts: 31,
    finalVolume: 500,
    unit: "mL",
    concentrateBasis: "manufacturer-concentrate",
    convention: "concentrate-plus-diluent-parts",
  });
  const fromStockSolution = calculateDilution({
    concentrateParts: 1,
    diluentParts: 31,
    finalVolume: 500,
    unit: "mL",
    concentrateBasis: "prepared-stock-solution",
    convention: "concentrate-plus-diluent-parts",
  });

  assert.equal(fromConcentrate.concentrateVolume, 15.625);
  assert.equal(fromConcentrate.diluentVolume, 484.375);
  assert.equal(fromConcentrate.ratio.label, "1+31");
  assert.equal(fromConcentrate.ratio.concentrateBasis, "manufacturer-concentrate");
  assert.equal(fromStockSolution.ratio.concentrateBasis, "prepared-stock-solution");
});

test("calculateDilution rejects non-positive or non-finite inputs", () => {
  assert.throws(
    () =>
      calculateDilution({
        concentrateParts: 0,
        diluentParts: 1,
        finalVolume: 500,
        unit: "mL",
        concentrateBasis: "other-specified-concentrate",
        convention: "concentrate-plus-diluent-parts",
      }),
    /Concentrate parts/,
  );
  assert.throws(
    () =>
      calculateDilution({
        concentrateParts: 1,
        diluentParts: 1,
        finalVolume: Number.POSITIVE_INFINITY,
        unit: "L",
        concentrateBasis: "other-specified-concentrate",
        convention: "concentrate-plus-diluent-parts",
      }),
    /Final volume/,
  );
});

test("parseDilutionRatioParts accepts only explicit parts ratios", () => {
  assert.deepEqual(parseDilutionRatioParts("1+1"), {
    concentrateParts: 1,
    diluentParts: 1,
  });
  assert.deepEqual(parseDilutionRatioParts("1:1"), {
    concentrateParts: 1,
    diluentParts: 1,
  });
  assert.deepEqual(parseDilutionRatioParts(" 1 + 31 "), {
    concentrateParts: 1,
    diluentParts: 31,
  });
  assert.equal(parseDilutionRatioParts("B"), null);
  assert.equal(parseDilutionRatioParts("stock"), null);
  assert.equal(parseDilutionRatioParts("1+"), null);
  assert.equal(parseDilutionRatioParts("HC-110 Dilution B"), null);
  assert.equal(parseDilutionRatioParts(""), null);
});

test("dilution calculation integrates from personal record label without mutating catalog", () => {
  const recipe = DEVELOPMENT_RECIPES.find(
    (item) => item.id === "ilford-hp5-plus-id-11-1-plus-1-ei-400",
  );
  assert.ok(recipe);
  assert.equal(recipe.dilution, "1+1");

  const personal = personalRecordFromRecipe(recipe);
  personal.dilution = "1+3";

  const result = calculateDilutionFromPersonalLabel(personal.dilution, {
    finalVolume: 600,
    unit: "mL",
    concentrateBasis: "manufacturer-concentrate",
  });
  assert.ok(result);
  assert.equal(result.concentrateVolume, 150);
  assert.equal(result.diluentVolume, 450);
  assert.equal(result.ratio.label, "1+3");
  assert.equal(result.ratio.concentrateBasis, "manufacturer-concentrate");

  // Personal edit did not rewrite the manufacturer recipe.
  assert.equal(recipe.dilution, "1+1");

  assert.equal(
    calculateDilutionFromPersonalLabel("B", {
      finalVolume: 500,
      unit: "mL",
      concentrateBasis: "manufacturer-concentrate",
    }),
    null,
  );
});
