/**
 * Search result activation helpers.
 *
 * Historical bug: SearchForm remounted via `key={urlQuery}` whenever blur
 * committed the draft to the URL. The remount destroyed the clicked control
 * mid-gesture, so the first click appeared to do nothing.
 *
 * Policy: keep one stable SearchForm instance; sync draft from URL changes
 * without remounting; open photographs from local state in a single click.
 */

export type PhotographOpenTarget = {
  rollId: string;
  frameId: string;
};

/** True when the draft differs from the committed URL query (after trim). */
export function searchQueryNeedsUrlCommit(draftQuery: string, urlQuery: string): boolean {
  return draftQuery.trim() !== urlQuery.trim();
}

/**
 * When the URL `q` param changes (back/forward, inbound deep link, or a local
 * commit that updated the address bar), return the draft that should display.
 * Returns `null` when the draft should be left alone.
 */
export function draftQueryForUrlChange(
  urlQuery: string,
  previousUrlQuery: string,
): string | null {
  if (urlQuery === previousUrlQuery) {
    return null;
  }
  return urlQuery;
}

/**
 * Resolve a photograph search hit into a viewer open target.
 * Hits without a frame id are not openable as photographs.
 */
export function resolvePhotographOpenTarget(hit: {
  rollId: string;
  frameId: string | null | undefined;
}): PhotographOpenTarget | null {
  if (!hit.frameId) {
    return null;
  }
  return { rollId: hit.rollId, frameId: hit.frameId };
}

/**
 * Simulate the critical path that used to fail: draft differs from URL, blur
 * would commit, and a result is activated in the same gesture.
 *
 * Returns whether the form instance must stay mounted for the activation to
 * succeed on the first click.
 */
export function resultActivationRequiresStableForm(args: {
  draftQuery: string;
  urlQuery: string;
}): boolean {
  return searchQueryNeedsUrlCommit(args.draftQuery, args.urlQuery);
}

/** Href for a roll search result — one primary navigation target. */
export function rollResultHref(rollId: string): string {
  return `/rolls/${rollId}`;
}

/** Href for a note search result — opens the roll notes section. */
export function noteResultHref(rollId: string): string {
  return `/rolls/${rollId}#notes`;
}
