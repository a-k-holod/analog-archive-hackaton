import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFilmStockPersistence,
  readFilmStockPersistence,
  selectCustomFilmStock,
  selectKnownFilmStock,
} from "./filmStockSelection.ts";
import { normalizeStoredRoll } from "./storage.ts";

test("selecting a known stock supplies catalog identity, text, and ISO", () => {
  assert.deepEqual(selectKnownFilmStock("ilford-hp5-plus"), {
    filmStock: "Ilford HP5 Plus",
    filmStockId: "ilford-hp5-plus",
    iso: "400",
  });
});

test("custom stock text is preserved without a catalog identity", () => {
  const selection = selectCustomFilmStock("  Expired mystery roll  ", " 320 ");
  assert.equal(selection.filmStock, "  Expired mystery roll  ");
  assert.deepEqual(buildFilmStockPersistence(selection), {
    film_stock: "Expired mystery roll",
    film_stock_id: null,
    iso: "320",
  });
});

test("loading an old roll keeps legacy filmStock text and does not infer an identity", () => {
  const roll = normalizeStoredRoll({
    id: "legacy-roll",
    title: "Old archive",
    filmStock: "Kodak Tri-X pushed",
    iso: "1600",
    camera: "Nikon F3",
    startedOn: "2024-01-01",
    createdAt: "2024-01-01T12:00:00.000Z",
    frames: [],
    notes: [],
    developments: [],
    contactSheetGeneratedAt: null,
    analysis: null,
  });

  assert.equal(roll.filmStock, "Kodak Tri-X pushed");
  assert.equal(roll.filmStockId, null);
});

test("structured stock identity survives persistence save and load", () => {
  const selected = selectKnownFilmStock("kodak-portra-400");
  const row = buildFilmStockPersistence(selected);
  assert.deepEqual(readFilmStockPersistence(JSON.parse(JSON.stringify(row))), selected);
});
