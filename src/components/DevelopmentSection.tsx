"use client";

import { Button } from "@/components/Button";
import { DarkroomDevelopmentTimer } from "@/components/DarkroomDevelopmentTimer";
import { DarkroomDilutionHelper } from "@/components/DarkroomDilutionHelper";
import { Field, inputClassName, textareaClassName } from "@/components/Field";
import {
  emptyDevelopmentInput,
  formatAgitationLabel,
  formatDevelopmentTime,
  formatMethodLabel,
  formatTemperatureC,
  personalRecordFromRecipe,
} from "@/lib/developments";
import {
  findFilmStock,
  recipesForFilmStock,
  type DevelopmentRecipe,
} from "@/lib/filmCatalog";
import type { DevelopmentRecord, DevelopmentRecordInput, FilmRoll } from "@/lib/types";
import { useEffect, useState, type FormEvent } from "react";

export function DevelopmentSection({
  roll,
  onSaveDevelopment,
}: {
  roll: FilmRoll;
  onSaveDevelopment: (rollId: string, input: DevelopmentRecordInput) => Promise<DevelopmentRecord>;
}) {
  const stock = roll.filmStockId ? findFilmStock(roll.filmStockId) : null;
  const recipes = stock ? recipesForFilmStock(stock.id) : [];
  const [draft, setDraft] = useState<DevelopmentRecordInput>(() =>
    recordToInput(roll.development),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Sync draft when the persisted record changes. Do not clear savedMessage here —
  // a successful save updates roll.development and would wipe the confirmation.
  useEffect(() => {
    queueMicrotask(() => {
      setDraft(recordToInput(roll.development));
      setError(null);
    });
  }, [roll.id, roll.development]);

  useEffect(() => {
    queueMicrotask(() => {
      setSavedMessage(null);
    });
  }, [roll.id]);

  function patchDraft(patch: Partial<DevelopmentRecordInput>) {
    setDraft((current) => ({ ...current, ...patch }));
    setSavedMessage(null);
  }

  function useRecipeAsStartingPoint(recipe: DevelopmentRecipe) {
    setDraft(personalRecordFromRecipe(recipe));
    setError(null);
    setSavedMessage("Copied into your development record. Edit and save.");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSavedMessage(null);
    try {
      await onSaveDevelopment(roll.id, draft);
      setSavedMessage("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this development record.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="development" className="scroll-mt-24">
      <div className="border-t border-line pt-10">
        <p className="section-kicker">Darkroom</p>
        <h2 className="mt-2 font-serif text-2xl tracking-tight sm:text-[1.75rem]">
          Development
        </h2>
      </div>

      <div className="mt-10 max-w-2xl space-y-12">
        <ManufacturerStartingPoints
          stockName={stock ? `${stock.manufacturer} ${stock.name}` : null}
          recipes={recipes}
          onUseAsStartingPoint={useRecipeAsStartingPoint}
          disabled={busy}
        />

        <form onSubmit={onSubmit} className="space-y-6 border-t border-line pt-10">
          <div>
            <p className="meta">Your development record</p>
            {roll.development ? (
              <p className="meta mt-2 text-cobalt">Photographer&apos;s own development</p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-muted">
                No development recorded for this roll yet.
              </p>
            )}
            {draft.sourceRecipeId ? (
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Started from manufacturer recipe · edits stay on this roll only.
              </p>
            ) : null}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Developer">
              <input
                className={inputClassName}
                value={draft.developer}
                onChange={(event) => patchDraft({ developer: event.target.value })}
                placeholder="Ilford ID-11"
                aria-label="Developer"
              />
            </Field>
            <Field label="Dilution">
              <input
                className={inputClassName}
                value={draft.dilution}
                onChange={(event) => patchDraft({ dilution: event.target.value })}
                placeholder="1+1"
                aria-label="Dilution"
              />
            </Field>
            <Field label="EI">
              <input
                className={`${inputClassName} font-mono tracking-wide`}
                value={draft.exposureIndex}
                onChange={(event) => patchDraft({ exposureIndex: event.target.value })}
                placeholder="400"
                aria-label="Exposure index"
              />
            </Field>
            <Field label="Temperature">
              <input
                className={`${inputClassName} font-mono tracking-wide`}
                value={draft.temperature}
                onChange={(event) => patchDraft({ temperature: event.target.value })}
                placeholder="20°C"
                aria-label="Temperature"
              />
            </Field>
            <Field label="Time">
              <input
                className={`${inputClassName} font-mono tracking-wide`}
                value={draft.developmentTime}
                onChange={(event) => patchDraft({ developmentTime: event.target.value })}
                placeholder="13:00"
                aria-label="Development time"
              />
            </Field>
            <Field label="Agitation">
              <input
                className={inputClassName}
                value={draft.agitation}
                onChange={(event) => patchDraft({ agitation: event.target.value })}
                placeholder="Intermittent"
                aria-label="Agitation"
              />
            </Field>
            <Field label="Method">
              <input
                className={inputClassName}
                value={draft.method}
                onChange={(event) => patchDraft({ method: event.target.value })}
                placeholder="Spiral tank"
                aria-label="Method"
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              className={textareaClassName}
              value={draft.notes}
              onChange={(event) => patchDraft({ notes: event.target.value })}
              placeholder="Optional process notes"
              aria-label="Development notes"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            {savedMessage ? <p className="text-sm text-muted">{savedMessage}</p> : null}
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </form>

        {roll.development ? (
          <>
            <DarkroomDevelopmentTimer record={roll.development} />
            <DarkroomDilutionHelper
              key={`${roll.development.id}:${roll.development.dilution}:${roll.development.updatedAt}`}
              record={roll.development}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

function ManufacturerStartingPoints({
  stockName,
  recipes,
  onUseAsStartingPoint,
  disabled,
}: {
  stockName: string | null;
  recipes: readonly DevelopmentRecipe[];
  onUseAsStartingPoint: (recipe: DevelopmentRecipe) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <p className="meta">Manufacturer starting point</p>
      {!stockName ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          No catalog film stock on this roll — manufacturer times are unavailable. You can still
          record what you ran below.
        </p>
      ) : recipes.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {stockName} is recognized, but this catalog has no manufacturer development times yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-6">
          {recipes.map((recipe) => (
            <li key={recipe.id} className="border-l border-line pl-5">
              <p className="font-serif text-lg tracking-tight">
                {recipe.developer} · {recipe.dilution}
              </p>
              <dl className="meta mt-3 grid gap-1 leading-relaxed sm:grid-cols-2">
                <div>
                  <dt className="inline text-muted">EI </dt>
                  <dd className="inline">{recipe.exposureIndex}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Temperature </dt>
                  <dd className="inline">{formatTemperatureC(recipe.temperatureC)}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Time </dt>
                  <dd className="inline">{formatDevelopmentTime(recipe.timeSeconds)}</dd>
                </div>
                <div>
                  <dt className="inline text-muted">Agitation </dt>
                  <dd className="inline">{formatAgitationLabel(recipe.agitation)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline text-muted">Method </dt>
                  <dd className="inline">{formatMethodLabel(recipe.method)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline text-muted">Official source </dt>
                  <dd className="inline">
                    <a
                      href={recipe.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cobalt underline-offset-4 hover:underline"
                    >
                      Manufacturer data sheet
                    </a>
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => onUseAsStartingPoint(recipe)}
                >
                  Use as starting point
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function recordToInput(record: DevelopmentRecord | null): DevelopmentRecordInput {
  if (!record) {
    return emptyDevelopmentInput();
  }
  return {
    developer: record.developer,
    dilution: record.dilution,
    temperature: record.temperature,
    developmentTime: record.developmentTime,
    agitation: record.agitation,
    method: record.method,
    exposureIndex: record.exposureIndex,
    notes: record.notes,
    sourceRecipeId: record.sourceRecipeId,
  };
}
