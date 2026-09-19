import assert from "node:assert/strict";
import test from "node:test";
import {
  DEVELOPMENT_RECIPES,
  findFilmStock,
  recipesForFilmStock,
} from "./filmCatalog.ts";
import {
  buildDevelopmentUpsertRow,
  emptyDevelopmentInput,
  formatDevelopmentTime,
  formatTemperatureC,
  isPersistableDevelopment,
  normalizeDevelopmentRecord,
  personalRecordFromRecipe,
  pickDevelopmentForRoll,
  type DevelopmentRow,
} from "./developments.ts";
import { normalizeStoredRoll } from "./storage.ts";

test("recipesForFilmStock filters manufacturer recipes by stock identity", () => {
  const hp5 = recipesForFilmStock("ilford-hp5-plus");
  assert.equal(hp5.length, 1);
  assert.equal(hp5[0]!.id, "ilford-hp5-plus-id-11-1-plus-1-ei-400");
  assert.ok(hp5.every((recipe) => recipe.filmStockId === "ilford-hp5-plus"));

  assert.equal(recipesForFilmStock("kodak-portra-400").length, 0);
  assert.equal(recipesForFilmStock("unknown-stock").length, 0);
});

test("copying a recipe fills a personal record without mutating the catalog", () => {
  const recipe = DEVELOPMENT_RECIPES.find(
    (item) => item.id === "ilford-hp5-plus-id-11-1-plus-1-ei-400",
  );
  assert.ok(recipe);
  const before = structuredClone({
    developer: recipe.developer,
    dilution: recipe.dilution,
    temperatureC: recipe.temperatureC,
    timeSeconds: recipe.timeSeconds,
  });

  const personal = personalRecordFromRecipe(recipe);
  assert.equal(personal.developer, "Ilford ID-11");
  assert.equal(personal.dilution, "1+1");
  assert.equal(personal.temperature, formatTemperatureC(20));
  assert.equal(personal.developmentTime, formatDevelopmentTime(780));
  assert.equal(personal.agitation, "Intermittent");
  assert.equal(personal.method, "Spiral tank");
  assert.equal(personal.exposureIndex, "400");
  assert.equal(personal.sourceRecipeId, recipe.id);
  assert.equal(personal.notes, "");

  personal.developer = "Rodinal";
  personal.developmentTime = "11:00";
  personal.notes = "Pushed one stop";

  assert.equal(recipe.developer, before.developer);
  assert.equal(recipe.dilution, before.dilution);
  assert.equal(recipe.temperatureC, before.temperatureC);
  assert.equal(recipe.timeSeconds, before.timeSeconds);
  assert.equal(findFilmStock(recipe.filmStockId)?.id, "ilford-hp5-plus");
});

test("editing a personal record leaves catalog recipes unchanged", () => {
  const recipe = DEVELOPMENT_RECIPES[0]!;
  const draft = personalRecordFromRecipe(recipe);
  draft.developer = "HC-110";
  draft.dilution = "B";
  draft.temperature = "24°C";
  draft.sourceRecipeId = recipe.id;

  assert.notEqual(draft.developer, recipe.developer);
  assert.equal(
    DEVELOPMENT_RECIPES.find((item) => item.id === recipe.id)?.developer,
    recipe.developer,
  );
  assert.ok(isPersistableDevelopment(draft));
  assert.equal(isPersistableDevelopment(emptyDevelopmentInput()), false);
});

test("personal development persists through localStorage normalize/reload", () => {
  const recipe = DEVELOPMENT_RECIPES[0]!;
  const personal = personalRecordFromRecipe(recipe);
  personal.notes = "First roll in ID-11";

  const saved = normalizeStoredRoll({
    id: "roll-with-dev",
    title: "Darkroom night",
    filmStock: "Ilford HP5 Plus",
    filmStockId: "ilford-hp5-plus",
    iso: "400",
    camera: "M6",
    startedOn: "2026-09-01",
    createdAt: "2026-09-01T00:00:00.000Z",
    frames: [],
    notes: [],
    development: {
      id: "dev-1",
      ...personal,
      createdAt: "2026-09-02T10:00:00.000Z",
      updatedAt: "2026-09-02T11:00:00.000Z",
    },
    contactSheetGeneratedAt: null,
    analysis: null,
  });

  assert.equal(saved.filmStockId, "ilford-hp5-plus");
  assert.ok(saved.development);
  assert.equal(saved.development.developer, personal.developer);
  assert.equal(saved.development.sourceRecipeId, recipe.id);
  assert.equal(saved.development.notes, "First roll in ID-11");
  assert.equal(saved.development.updatedAt, "2026-09-02T11:00:00.000Z");

  const roundTrip = normalizeStoredRoll(
    JSON.parse(JSON.stringify(saved)) as Parameters<typeof normalizeStoredRoll>[0],
  );
  assert.deepEqual(roundTrip.development, saved.development);
});

test("legacy rolls without filmStockId or development remain valid", () => {
  const legacy = normalizeStoredRoll({
    id: "legacy-roll",
    title: "Old archive",
    filmStock: "Mystery bulk film",
    iso: "200",
    camera: "Fed 2",
    startedOn: "1998-05-01",
    createdAt: "1998-05-01T12:00:00.000Z",
    frames: [],
    notes: [],
    contactSheetGeneratedAt: null,
    analysis: null,
  });

  assert.equal(legacy.filmStock, "Mystery bulk film");
  assert.equal(legacy.filmStockId, null);
  assert.equal(legacy.development, null);
  assert.equal(recipesForFilmStock("").length, 0);
});

test("missing development record normalizes to null and pickDevelopmentForRoll returns null", () => {
  assert.equal(normalizeDevelopmentRecord(undefined), null);
  assert.equal(normalizeDevelopmentRecord(null), null);
  assert.equal(pickDevelopmentForRoll([]), null);

  const rows: DevelopmentRow[] = [
    {
      id: "older",
      roll_id: "roll-1",
      developer: "D-76",
      dilution: "stock",
      temperature: "20°C",
      development_time: "9:00",
      agitation: "Intermittent",
      method: "Small tank",
      exposure_index: "400",
      notes: null,
      source_recipe_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "newer",
      roll_id: "roll-1",
      developer: "ID-11",
      dilution: "1+1",
      temperature: "20°C",
      development_time: "13:00",
      agitation: "Intermittent",
      method: "Spiral tank",
      exposure_index: "400",
      notes: "Actual run",
      source_recipe_id: "ilford-hp5-plus-id-11-1-plus-1-ei-400",
      created_at: "2026-02-01T00:00:00.000Z",
      updated_at: "2026-02-02T00:00:00.000Z",
    },
  ];

  const picked = pickDevelopmentForRoll(rows);
  assert.equal(picked?.id, "newer");
  assert.equal(picked?.notes, "Actual run");
  assert.equal(picked?.sourceRecipeId, "ilford-hp5-plus-id-11-1-plus-1-ei-400");
});

test("upsert row maps personal fields and never invents catalog mutation", () => {
  const recipe = DEVELOPMENT_RECIPES[0]!;
  const input = personalRecordFromRecipe(recipe);
  input.notes = "My run";

  const row = buildDevelopmentUpsertRow({
    id: "dev-row",
    rollId: "roll-1",
    input,
    createdAt: "2026-09-19T12:00:00.000Z",
    updatedAt: "2026-09-19T12:05:00.000Z",
  });

  assert.equal(row.roll_id, "roll-1");
  assert.equal(row.developer, recipe.developer);
  assert.equal(row.source_recipe_id, recipe.id);
  assert.equal(row.notes, "My run");
  assert.equal(row.development_time, formatDevelopmentTime(recipe.timeSeconds));
  assert.equal(
    DEVELOPMENT_RECIPES.find((item) => item.id === recipe.id)?.developer,
    recipe.developer,
  );
});

test("loading an existing development row maps personal fields only", () => {
  const row: DevelopmentRow = {
    id: "dev-loaded",
    roll_id: "roll-legacy-ok",
    developer: "HC-110",
    dilution: "B",
    temperature: "20°C",
    development_time: "6:00",
    agitation: "Intermittent",
    method: "Spiral tank",
    exposure_index: "320",
    notes: "Pulled half stop",
    source_recipe_id: "ilford-hp5-plus-id-11-1-plus-1-ei-400",
    created_at: "2026-03-01T00:00:00.000Z",
    updated_at: "2026-03-02T00:00:00.000Z",
  };

  const loaded = pickDevelopmentForRoll([row]);
  assert.ok(loaded);
  assert.equal(loaded.id, "dev-loaded");
  assert.equal(loaded.developer, "HC-110");
  assert.equal(loaded.dilution, "B");
  assert.equal(loaded.exposureIndex, "320");
  assert.equal(loaded.developmentTime, "6:00");
  assert.equal(loaded.sourceRecipeId, "ilford-hp5-plus-id-11-1-plus-1-ei-400");
  assert.equal(loaded.notes, "Pulled half stop");
});

test("empty source_recipe_id maps to null attribution", () => {
  const row: DevelopmentRow = {
    id: "dev-blank-source",
    roll_id: "roll-1",
    developer: "D-76",
    dilution: "stock",
    temperature: "20°C",
    development_time: "9:00",
    agitation: "Intermittent",
    method: "Small tank",
    exposure_index: "400",
    notes: null,
    source_recipe_id: "  ",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  const loaded = pickDevelopmentForRoll([row]);
  assert.ok(loaded);
  assert.equal(loaded.sourceRecipeId, null);
  assert.equal(loaded.developer, "D-76");
});

test("updating a personal record reuses id and leaves the catalog recipe alone", () => {
  const recipe = DEVELOPMENT_RECIPES[0]!;
  const created = buildDevelopmentUpsertRow({
    id: "dev-stable",
    rollId: "roll-1",
    input: personalRecordFromRecipe(recipe),
    createdAt: "2026-09-19T12:00:00.000Z",
    updatedAt: "2026-09-19T12:00:00.000Z",
  });

  const edited = {
    ...personalRecordFromRecipe(recipe),
    developer: "Rodinal",
    dilution: "1+50",
    developmentTime: "11:00",
    notes: "Actual run",
    sourceRecipeId: recipe.id,
  };

  const updated = buildDevelopmentUpsertRow({
    id: created.id,
    rollId: created.roll_id,
    input: edited,
    createdAt: created.created_at,
    updatedAt: "2026-09-19T13:00:00.000Z",
  });

  assert.equal(updated.id, "dev-stable");
  assert.equal(updated.created_at, created.created_at);
  assert.equal(updated.updated_at, "2026-09-19T13:00:00.000Z");
  assert.equal(updated.developer, "Rodinal");
  assert.equal(updated.dilution, "1+50");
  assert.equal(updated.development_time, "11:00");
  assert.equal(updated.source_recipe_id, recipe.id);
  assert.equal(
    DEVELOPMENT_RECIPES.find((item) => item.id === recipe.id)?.developer,
    recipe.developer,
  );
  assert.equal(
    DEVELOPMENT_RECIPES.find((item) => item.id === recipe.id)?.dilution,
    recipe.dilution,
  );
});

test("rolls with free-text film stock still accept a personal development snapshot", () => {
  const legacy = normalizeStoredRoll({
    id: "legacy-with-dev",
    title: "Bulk load",
    filmStock: "Unknown house stock",
    iso: "200",
    camera: "F3",
    startedOn: "2001-01-01",
    createdAt: "2001-01-01T00:00:00.000Z",
    frames: [],
    notes: [],
    development: {
      id: "dev-freehand",
      developer: "D-76",
      dilution: "stock",
      temperature: "20°C",
      developmentTime: "9:00",
      agitation: "Intermittent",
      method: "Spiral tank",
      exposureIndex: "200",
      notes: "",
      sourceRecipeId: null,
      createdAt: "2001-01-02T00:00:00.000Z",
      updatedAt: "2001-01-02T00:00:00.000Z",
    },
    contactSheetGeneratedAt: null,
    analysis: null,
  });

  assert.equal(legacy.filmStockId, null);
  assert.equal(recipesForFilmStock("").length, 0);
  assert.ok(legacy.development);
  assert.equal(legacy.development.developer, "D-76");
  assert.equal(legacy.development.sourceRecipeId, null);
});
