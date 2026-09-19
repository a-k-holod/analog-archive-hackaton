import assert from "node:assert/strict";
import test from "node:test";
import {
  DEVELOPMENT_RECIPES,
  FILM_CATALOG,
  FILM_STOCKS,
  findFilmStock,
  parseFilmCatalog,
  recipesForFilmStock,
  resolveRollFilmStock,
} from "./filmCatalog.ts";
import { normalizeStoredRoll } from "./storage.ts";

test("bundled catalog loads its small validated seed", () => {
  assert.equal(FILM_CATALOG.filmStocks, FILM_STOCKS);
  assert.equal(FILM_CATALOG.developmentRecipes, DEVELOPMENT_RECIPES);
  assert.equal(FILM_STOCKS.length, 6);
  assert.equal(DEVELOPMENT_RECIPES.length, 4);
});

test("film-stock IDs are unique, stable identities independent of display names", () => {
  assert.equal(new Set(FILM_STOCKS.map((stock) => stock.id)).size, FILM_STOCKS.length);
  assert.equal(findFilmStock("ilford-hp5-plus")?.name, "HP5 Plus");
  assert.equal(findFilmStock("Ilford HP5 Plus"), null);
});

test("every development recipe belongs to an existing film stock", () => {
  for (const recipe of DEVELOPMENT_RECIPES) {
    assert.ok(findFilmStock(recipe.filmStockId));
    assert.ok(recipesForFilmStock(recipe.filmStockId).includes(recipe));
    assert.equal(recipe.source.type, "manufacturer-data-sheet");
  }
});

test("legacy free-text film stock loads unchanged without inventing an identity", () => {
  const legacy = normalizeStoredRoll({
    id: "legacy-roll",
    title: "Old archive",
    filmStock: "Kodak Tri-X pushed",
    iso: "1600",
    camera: "Nikon F3",
    startedOn: "2024-01-01",
    createdAt: "2024-01-01T12:00:00.000Z",
    frames: [],
    notes: [],
    contactSheetGeneratedAt: null,
    analysis: null,
  });

  assert.equal(legacy.filmStock, "Kodak Tri-X pushed");
  assert.equal(legacy.filmStockId, null);
  assert.equal(legacy.development, null);
  assert.deepEqual(resolveRollFilmStock(legacy), {
    kind: "legacy",
    text: "Kodak Tri-X pushed",
    stock: null,
  });
});

test("a valid stored ID resolves while stale IDs fall back to free text", () => {
  const catalogRoll = resolveRollFilmStock({
    filmStock: "HP5 from the box",
    filmStockId: "ilford-hp5-plus",
  });
  assert.equal(catalogRoll.kind, "catalog");
  assert.equal(catalogRoll.stock?.id, "ilford-hp5-plus");
  assert.equal(catalogRoll.text, "HP5 from the box");

  assert.equal(
    resolveRollFilmStock({ filmStock: "Archived label", filmStockId: "removed-stock" }).kind,
    "legacy",
  );
});

test("catalog validation rejects malformed entries and broken recipe relationships", () => {
  assert.throws(
    () =>
      parseFilmCatalog({
        filmStocks: [
          {
            id: "Bad ID",
            manufacturer: "Example",
            name: "Broken",
            boxSpeed: -1,
            process: "unknown",
            formats: [],
            aliases: [],
            source: { type: "manufacturer-product-page", url: "http://example.com" },
          },
        ],
        developmentRecipes: [],
      }),
    /stable kebab-case id/,
  );

  assert.throws(
    () =>
      parseFilmCatalog({
        filmStocks: [
          {
            id: "example-film",
            manufacturer: "Example",
            name: "Film",
            boxSpeed: 100,
            process: "black-and-white",
            formats: ["35mm"],
            aliases: [],
            source: {
              type: "manufacturer-product-page",
              url: "https://example.com/film",
            },
          },
        ],
        developmentRecipes: [
          {
            id: "orphan-recipe",
            filmStockId: "missing-film",
            exposureIndex: 100,
            developer: "Example",
            dilution: "stock",
            temperatureC: 20,
            timeSeconds: 600,
            method: "small-tank",
            agitation: "intermittent",
            source: {
              type: "manufacturer-data-sheet",
              url: "https://example.com/data-sheet",
            },
          },
        ],
      }),
    /unknown film stock/,
  );
});
