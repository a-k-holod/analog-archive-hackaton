import {
  findFilmStock,
  normalizeFilmStockId,
  type FilmStock,
} from "./filmCatalog.ts";
import type { UpdateRollFilmStockInput } from "./types.ts";

export function selectKnownFilmStock(filmStockId: string): UpdateRollFilmStockInput {
  const stock = findFilmStock(filmStockId);
  if (!stock) {
    throw new Error(`Unknown film stock: ${filmStockId}`);
  }

  return {
    filmStock: `${stock.manufacturer} ${stock.name}`,
    filmStockId: stock.id,
    iso: String(stock.boxSpeed),
  };
}

export function selectCustomFilmStock(
  filmStock: string,
  iso = "",
): UpdateRollFilmStockInput {
  return { filmStock, filmStockId: null, iso };
}

export function formatFilmProcess(process: FilmStock["process"]): string {
  return process === "black-and-white" ? "B&W" : process.toUpperCase();
}

export function buildFilmStockPersistence(
  input: UpdateRollFilmStockInput,
): {
  film_stock: string | null;
  film_stock_id: string | null;
  iso: string | null;
} {
  const filmStock = input.filmStock.trim();
  const iso = input.iso.trim();
  return {
    film_stock: filmStock || null,
    film_stock_id: normalizeFilmStockId(input.filmStockId),
    iso: iso || null,
  };
}

export function readFilmStockPersistence(row: {
  film_stock: string | null;
  film_stock_id?: unknown;
  iso: string | null;
}): UpdateRollFilmStockInput {
  return {
    filmStock: row.film_stock ?? "",
    filmStockId: normalizeFilmStockId(row.film_stock_id),
    iso: row.iso ?? "",
  };
}
