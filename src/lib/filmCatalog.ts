export type FilmProcess = "black-and-white" | "c-41" | "e-6";
export type FilmFormat = "35mm" | "120" | "sheet";
export type CatalogSourceType =
  | "manufacturer-product-page"
  | "manufacturer-data-sheet";

export type CatalogSource = {
  type: CatalogSourceType;
  url: string;
};

export type FilmStock = {
  id: string;
  manufacturer: string;
  name: string;
  boxSpeed: number;
  process: FilmProcess;
  formats: readonly FilmFormat[];
  aliases: readonly string[];
  source: CatalogSource;
};

export type DevelopmentRecipe = {
  id: string;
  filmStockId: string;
  exposureIndex: number;
  developer: string;
  dilution: string;
  temperatureC: number;
  timeSeconds: number;
  method: "spiral-tank" | "small-tank";
  agitation: "intermittent" | "every-30-seconds";
  source: CatalogSource & { type: "manufacturer-data-sheet" };
};

export type FilmCatalog = {
  filmStocks: readonly FilmStock[];
  developmentRecipes: readonly DevelopmentRecipe[];
};

export type RollFilmStockReference =
  | { kind: "catalog"; text: string; stock: FilmStock }
  | { kind: "legacy"; text: string; stock: null };

const rawCatalog: unknown = {
  filmStocks: [
    {
      id: "ilford-hp5-plus",
      manufacturer: "Ilford",
      name: "HP5 Plus",
      boxSpeed: 400,
      process: "black-and-white",
      formats: ["35mm", "120", "sheet"],
      aliases: ["Ilford HP5", "Ilford HP5 Plus", "HP5", "HP5 Plus"],
      source: {
        type: "manufacturer-product-page",
        url: "https://www.ilfordphoto.com/hp5-plus-35mm",
      },
    },
    {
      id: "ilford-fp4-plus",
      manufacturer: "Ilford",
      name: "FP4 Plus",
      boxSpeed: 125,
      process: "black-and-white",
      formats: ["35mm", "120", "sheet"],
      aliases: ["Ilford FP4", "Ilford FP4 Plus", "FP4", "FP4 Plus"],
      source: {
        type: "manufacturer-product-page",
        url: "https://www.ilfordphoto.com/fp4-plus-35mm",
      },
    },
    {
      id: "ilford-delta-100",
      manufacturer: "Ilford",
      name: "Delta 100 Professional",
      boxSpeed: 100,
      process: "black-and-white",
      formats: ["35mm", "120", "sheet"],
      aliases: ["Ilford Delta 100", "Delta 100"],
      source: {
        type: "manufacturer-product-page",
        url: "https://www.ilfordphoto.com/delta-100-professional-35mm",
      },
    },
    {
      id: "kodak-tri-x-400",
      manufacturer: "Kodak",
      name: "Professional Tri-X 400",
      boxSpeed: 400,
      process: "black-and-white",
      formats: ["35mm", "120"],
      aliases: ["Kodak Tri-X", "Kodak Tri-X 400", "Tri-X", "400TX"],
      source: {
        type: "manufacturer-product-page",
        url: "https://kodakprofessional.com/photographers/film/black-white/kodak-professional-tri-x-films/515",
      },
    },
    {
      id: "kodak-portra-400",
      manufacturer: "Kodak",
      name: "Professional Portra 400",
      boxSpeed: 400,
      process: "c-41",
      formats: ["35mm", "120", "sheet"],
      aliases: ["Kodak Portra 400", "Portra 400"],
      source: {
        type: "manufacturer-product-page",
        url: "https://kodakprofessional.com/photographers/film/color/kodak-professional-portra-400-film/516",
      },
    },
    {
      id: "fujifilm-velvia-50",
      manufacturer: "Fujifilm",
      name: "Fujichrome Velvia 50",
      boxSpeed: 50,
      process: "e-6",
      formats: ["35mm", "120"],
      aliases: ["Fujifilm Velvia 50", "Fuji Velvia 50", "Velvia 50"],
      source: {
        type: "manufacturer-product-page",
        url: "https://www.fujifilm.com/us/en/business/professional-photography/film/velvia-50/specifications",
      },
    },
  ],
  developmentRecipes: [
    {
      id: "ilford-hp5-plus-id-11-1-plus-1-ei-400",
      filmStockId: "ilford-hp5-plus",
      exposureIndex: 400,
      developer: "Ilford ID-11",
      dilution: "1+1",
      temperatureC: 20,
      timeSeconds: 780,
      method: "spiral-tank",
      agitation: "intermittent",
      source: {
        type: "manufacturer-data-sheet",
        url: "https://www.ilfordphoto.com/amfile/file/download/file/1903/product/691/",
      },
    },
    {
      id: "ilford-fp4-plus-id-11-1-plus-1-ei-125",
      filmStockId: "ilford-fp4-plus",
      exposureIndex: 125,
      developer: "Ilford ID-11",
      dilution: "1+1",
      temperatureC: 20,
      timeSeconds: 660,
      method: "spiral-tank",
      agitation: "intermittent",
      source: {
        type: "manufacturer-data-sheet",
        url: "https://www.ilfordphoto.com/amfile/file/download/file/1919/product/690/product_datasheet_fp4plus.pdf",
      },
    },
    {
      id: "ilford-delta-100-id-11-1-plus-1-ei-100",
      filmStockId: "ilford-delta-100",
      exposureIndex: 100,
      developer: "Ilford ID-11",
      dilution: "1+1",
      temperatureC: 20,
      timeSeconds: 660,
      method: "spiral-tank",
      agitation: "intermittent",
      source: {
        type: "manufacturer-data-sheet",
        url: "https://www.ilfordphoto.com/amfile/file/download/file/3/product/680/",
      },
    },
    {
      id: "kodak-tri-x-400-d-76-1-plus-1-ei-400",
      filmStockId: "kodak-tri-x-400",
      exposureIndex: 400,
      developer: "Kodak D-76",
      dilution: "1:1",
      temperatureC: 20,
      timeSeconds: 585,
      method: "small-tank",
      agitation: "every-30-seconds",
      source: {
        type: "manufacturer-data-sheet",
        url: "https://www.kodakprofessional.com/sites/default/files/wysiwyg/pro/resources/f4017_TriX.pdf",
      },
    },
  ],
};

export const FILM_CATALOG = parseFilmCatalog(rawCatalog);
export const FILM_STOCKS = FILM_CATALOG.filmStocks;
export const DEVELOPMENT_RECIPES = FILM_CATALOG.developmentRecipes;

export function parseFilmCatalog(value: unknown): FilmCatalog {
  const catalog = requireRecord(value, "Film catalog");
  const filmStocks = requireArray(catalog.filmStocks, "filmStocks").map(parseFilmStock);
  const stockIds = requireUniqueIds(filmStocks, "film stock");
  const developmentRecipes = requireArray(
    catalog.developmentRecipes,
    "developmentRecipes",
  ).map((recipe, index) => parseDevelopmentRecipe(recipe, index, stockIds));
  requireUniqueIds(developmentRecipes, "development recipe");

  return Object.freeze({
    filmStocks: Object.freeze(filmStocks),
    developmentRecipes: Object.freeze(developmentRecipes),
  });
}

export function findFilmStock(id: string): FilmStock | null {
  return FILM_STOCKS.find((stock) => stock.id === id) ?? null;
}

export function normalizeFilmStockId(value: unknown): string | null {
  return typeof value === "string" && findFilmStock(value) ? value : null;
}

export function recipesForFilmStock(filmStockId: string): readonly DevelopmentRecipe[] {
  return DEVELOPMENT_RECIPES.filter((recipe) => recipe.filmStockId === filmStockId);
}

/**
 * IDs are authoritative. Missing or stale IDs deliberately remain legacy text;
 * no name-based backfill silently changes an existing roll's meaning.
 */
export function resolveRollFilmStock(input: {
  filmStock: string;
  filmStockId?: string | null;
}): RollFilmStockReference {
  const text = input.filmStock.trim();
  const stock = input.filmStockId ? findFilmStock(input.filmStockId) : null;
  return stock ? { kind: "catalog", text, stock } : { kind: "legacy", text, stock: null };
}

function parseFilmStock(value: unknown, index: number): FilmStock {
  const stock = requireRecord(value, `Film stock ${index + 1}`);
  return Object.freeze({
    id: requireId(stock.id, `Film stock ${index + 1} id`),
    manufacturer: requireString(stock.manufacturer, "manufacturer"),
    name: requireString(stock.name, "name"),
    boxSpeed: requirePositiveInteger(stock.boxSpeed, "boxSpeed"),
    process: requireEnum(stock.process, ["black-and-white", "c-41", "e-6"], "process"),
    formats: Object.freeze(
      requireArray(stock.formats, "formats").map((format) =>
        requireEnum(format, ["35mm", "120", "sheet"], "format"),
      ),
    ),
    aliases: Object.freeze(
      requireArray(stock.aliases, "aliases").map((alias) => requireString(alias, "alias")),
    ),
    source: parseSource(stock.source),
  });
}

function parseDevelopmentRecipe(
  value: unknown,
  index: number,
  stockIds: ReadonlySet<string>,
): DevelopmentRecipe {
  const recipe = requireRecord(value, `Development recipe ${index + 1}`);
  const filmStockId = requireId(recipe.filmStockId, "filmStockId");
  if (!stockIds.has(filmStockId)) {
    throw new Error(`Development recipe references unknown film stock: ${filmStockId}`);
  }
  const source = parseSource(recipe.source);
  if (source.type !== "manufacturer-data-sheet") {
    throw new Error("Development recipe source must be a manufacturer data sheet.");
  }

  return Object.freeze({
    id: requireId(recipe.id, `Development recipe ${index + 1} id`),
    filmStockId,
    exposureIndex: requirePositiveInteger(recipe.exposureIndex, "exposureIndex"),
    developer: requireString(recipe.developer, "developer"),
    dilution: requireString(recipe.dilution, "dilution"),
    temperatureC: requirePositiveNumber(recipe.temperatureC, "temperatureC"),
    timeSeconds: requirePositiveInteger(recipe.timeSeconds, "timeSeconds"),
    method: requireEnum(recipe.method, ["spiral-tank", "small-tank"], "method"),
    agitation: requireEnum(
      recipe.agitation,
      ["intermittent", "every-30-seconds"],
      "agitation",
    ),
    source: Object.freeze({
      type: "manufacturer-data-sheet" as const,
      url: source.url,
    }),
  });
}

function parseSource(value: unknown): CatalogSource {
  const source = requireRecord(value, "source");
  const url = requireString(source.url, "source URL");
  if (!url.startsWith("https://")) {
    throw new Error("Catalog source URL must use HTTPS.");
  }
  return Object.freeze({
    type: requireEnum(
      source.type,
      ["manufacturer-product-page", "manufacturer-data-sheet"],
      "source type",
    ),
    url,
  });
}

function requireUniqueIds(
  entries: readonly { id: string }[],
  label: string,
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) {
      throw new Error(`Duplicate ${label} id: ${entry.id}`);
    }
    ids.add(entry.id);
  }
  return ids;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireId(value: unknown, label: string): string {
  const id = requireString(value, label);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`${label} must be a stable kebab-case id.`);
  }
  return id;
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function requirePositiveNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return value;
}

function requireEnum<const T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${label} has an unsupported value.`);
  }
  return value as T;
}
