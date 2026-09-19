"use client";

import { FILM_STOCKS } from "@/lib/filmCatalog";
import {
  formatFilmProcess,
  selectCustomFilmStock,
  selectKnownFilmStock,
} from "@/lib/filmStockSelection";
import type { UpdateRollFilmStockInput } from "@/lib/types";
import { useId } from "react";

export function FilmStockPicker({
  filmStock,
  filmStockId,
  iso,
  onChange,
}: UpdateRollFilmStockInput & {
  onChange: (selection: UpdateRollFilmStockInput) => void;
}) {
  const fieldName = useId();
  const customInputId = `${fieldName}-custom`;

  return (
    <fieldset>
      <legend className="meta">Film stock</legend>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Choose from the archive index, or write in an unlisted stock.
      </p>

      <div className="mt-4 border-y border-line">
        {FILM_STOCKS.map((stock) => {
          const selected = filmStockId === stock.id;
          return (
            <label
              key={stock.id}
              className={`grid cursor-pointer grid-cols-[1rem_1fr_auto] items-center gap-x-3 border-b border-line/70 px-1 py-3 last:border-b-0 transition-colors hover:bg-surface/55 ${
                selected ? "bg-surface/75" : ""
              }`}
            >
              <input
                type="radio"
                name={fieldName}
                value={stock.id}
                checked={selected}
                onChange={() => onChange(selectKnownFilmStock(stock.id))}
                className="size-3 accent-cobalt"
              />
              <span className="min-w-0">
                <span className="block font-serif text-[1.05rem] leading-tight tracking-tight">
                  {stock.name}
                </span>
                <span className="meta mt-1 block">{stock.manufacturer}</span>
              </span>
              <span className="meta text-right">
                ISO {stock.boxSpeed}
                <span className="mt-0.5 block">{formatFilmProcess(stock.process)}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-5">
        <label className="flex cursor-pointer items-center gap-2" htmlFor={customInputId}>
          <input
            type="radio"
            name={fieldName}
            value="custom"
            checked={filmStockId === null}
            onChange={() => onChange(selectCustomFilmStock("", iso))}
            aria-label="Custom / unlisted film stock"
            className="size-3 accent-cobalt"
          />
          <span className="meta">Custom / unlisted</span>
        </label>
        <input
          id={customInputId}
          className="mt-2 w-full border-0 border-b border-line bg-transparent px-0 py-2 text-[0.95rem] text-ink outline-none transition-[border-color] duration-150 placeholder:text-muted/60 focus:border-cobalt"
          value={filmStockId === null ? filmStock : ""}
          onChange={(event) => onChange(selectCustomFilmStock(event.target.value, iso))}
          placeholder="Write the box label as you know it"
          aria-label="Custom film stock"
        />
      </div>
    </fieldset>
  );
}
