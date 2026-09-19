"use client";

import { useArchive } from "@/components/ArchiveProvider";
import { Field, inputClassName } from "@/components/Field";
import { PhotographViewer } from "@/components/PhotographViewer";
import type { FrameMetadataPatch } from "@/lib/frames";
import {
  draftQueryForUrlChange,
  formatSearchHitSummary,
  groupSearchHitsByKind,
  noteResultHref,
  resolvePhotographOpenTarget,
  rollResultHref,
  searchMetadata,
  searchQueryNeedsUrlCommit,
  summarizeSearchHits,
  type SearchHit,
  type SearchHitSummary,
} from "@/lib/search";
import type { FilmRoll } from "@/lib/types";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

const resultRowClassName =
  "group flex w-full cursor-pointer gap-4 py-5 text-left outline-none transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink/[0.03] focus-visible:bg-ink/[0.03] active:bg-ink/[0.05] sm:gap-7 sm:py-7";

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageFallback() {
  return (
    <div>
      <Link href="/" className="meta transition-colors hover:text-ink">
        ← Archive
      </Link>
      <p className="loading-pulse meta mt-16">Opening search…</p>
    </div>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  // Keep a single SearchForm instance across URL `q` updates. Remounting via
  // key={urlQuery} after blur-commit destroyed the clicked result mid-gesture
  // and required a second click.
  return <SearchForm urlQuery={urlQuery} />;
}

function SearchForm({ urlQuery }: { urlQuery: string }) {
  const { ready, rolls, getRoll, updateFrame } = useArchive();
  const router = useRouter();
  const [query, setQuery] = useState(urlQuery);
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  const [viewer, setViewer] = useState<{ rollId: string; frameId: string } | null>(null);
  const viewerTriggerRef = useRef<HTMLElement | null>(null);

  // Sync draft when the URL changes externally (back/forward, inbound link) or
  // after a local commit updates the address bar — without remounting.
  let draftQuery = query;
  const syncedDraft = draftQueryForUrlChange(urlQuery, prevUrlQuery);
  if (syncedDraft !== null) {
    draftQuery = syncedDraft;
    setPrevUrlQuery(urlQuery);
    setQuery(syncedDraft);
  }

  const trimmed = draftQuery.trim();
  const hits = useMemo(() => {
    if (!ready || !trimmed) {
      return [] as SearchHit[];
    }
    return searchMetadata(rolls, { text: trimmed, limit: 48 });
  }, [ready, rolls, trimmed]);

  const summary = useMemo(() => summarizeSearchHits(hits), [hits]);
  const grouped = useMemo(() => groupSearchHitsByKind(hits), [hits]);
  const viewerRoll: FilmRoll | undefined = viewer ? getRoll(viewer.rollId) : undefined;

  const openPhotograph = useCallback(
    (rollId: string, frameId: string, trigger?: HTMLElement | null) => {
      viewerTriggerRef.current = trigger ?? null;
      setViewer({ rollId, frameId });
    },
    [],
  );

  const closeViewer = useCallback(() => {
    setViewer(null);
    const trigger = viewerTriggerRef.current;
    viewerTriggerRef.current = null;
    requestAnimationFrame(() => {
      trigger?.focus();
    });
  }, []);

  const navigateViewer = useCallback((frameId: string) => {
    setViewer((current) => (current ? { ...current, frameId } : current));
  }, []);

  const onUpdateFrame = useCallback(
    async (rollId: string, frameId: string, patch: FrameMetadataPatch) => {
      await updateFrame(rollId, frameId, patch);
    },
    [updateFrame],
  );

  function commitQuery(next: string) {
    const value = next.trim();
    const params = new URLSearchParams();
    if (value) {
      params.set("q", value);
    }
    const href = params.size > 0 ? `/search?${params.toString()}` : "/search";
    router.replace(href, { scroll: false });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commitQuery(draftQuery);
  }

  return (
    <div>
      <Link href="/" className="meta transition-colors hover:text-ink">
        ← Archive
      </Link>

      <header className="mt-4 max-w-2xl">
        <p className="section-kicker">Archive</p>
        <h1 className="mt-2 font-serif text-[2.5rem] leading-none tracking-tight sm:text-5xl">
          Search
        </h1>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">
          Photographs, rolls, and notes — by place, film, caption, or handwriting.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="mt-10 max-w-2xl border-t border-line pt-8 sm:mt-12 sm:pt-10"
        role="search"
      >
        <Field label="Search the archive">
          <input
            type="search"
            name="q"
            value={draftQuery}
            onChange={(event) => setQuery(event.target.value)}
            onBlur={() => {
              if (searchQueryNeedsUrlCommit(draftQuery, urlQuery)) {
                commitQuery(draftQuery);
              }
            }}
            placeholder="winter, Fomapan, Sławinek…"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            enterKeyHint="search"
            aria-describedby="search-hint"
            className={`${inputClassName} text-lg sm:text-xl`}
          />
        </Field>
        <p id="search-hint" className="mt-3 text-sm leading-relaxed text-muted">
          Try a place, film stock, caption, note, or date.
        </p>
      </form>

      {!ready ? (
        <p className="loading-pulse meta mt-16" role="status">
          Opening the archive…
        </p>
      ) : !trimmed ? (
        <EmptySearchState />
      ) : (
        <SearchResults
          query={trimmed}
          hits={hits}
          summary={summary}
          photographs={grouped.photographs}
          rolls={grouped.rolls}
          notes={grouped.notes}
          onOpenPhotograph={openPhotograph}
        />
      )}

      {viewer && viewerRoll ? (
        <PhotographViewer
          roll={viewerRoll}
          frameId={viewer.frameId}
          onClose={closeViewer}
          onNavigate={navigateViewer}
          onUpdateFrame={onUpdateFrame}
        />
      ) : null}
    </div>
  );
}

function EmptySearchState() {
  return (
    <div className="mt-16 max-w-lg border-t border-line pt-10">
      <p className="font-serif text-2xl leading-snug tracking-tight sm:text-[1.75rem]">
        Search the archive
      </p>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">
        Type a place, film stock, caption, note, or date. Results appear as you type.
      </p>
      <ul className="mt-8 space-y-2 text-sm text-muted">
        <li>Photographs — captions and locations</li>
        <li>Rolls — titles, film stocks, cameras</li>
        <li>Notes — typed text and handwritten notes</li>
      </ul>
    </div>
  );
}

function SearchResults({
  query,
  hits,
  summary,
  photographs,
  rolls,
  notes,
  onOpenPhotograph,
}: {
  query: string;
  hits: SearchHit[];
  summary: SearchHitSummary;
  photographs: SearchHit[];
  rolls: SearchHit[];
  notes: SearchHit[];
  onOpenPhotograph: (rollId: string, frameId: string, trigger?: HTMLElement | null) => void;
}) {
  return (
    <section className="mt-12 sm:mt-14" aria-live="polite">
      <div className="max-w-2xl border-t border-line pt-8">
        <h2 className="font-serif text-2xl tracking-tight sm:text-[1.75rem]">
          <span className="text-muted">Results for </span>
          <span className="text-ink">“{query}”</span>
        </h2>
        <p className="meta mt-3 leading-relaxed">{formatSearchHitSummary(summary)}</p>
      </div>

      {hits.length === 0 ? (
        <p className="mt-10 max-w-md text-[0.95rem] leading-relaxed text-muted" role="status">
          Nothing in the archive matched “{query}”. Try another place, film stock, or word from a
          note.
        </p>
      ) : (
        <div className="mt-10 space-y-12 sm:space-y-14">
          {photographs.length > 0 ? (
            <ResultSection title="Photographs" count={photographs.length}>
              <ul>
                {photographs.map((hit) => (
                  <PhotographResultRow
                    key={hit.hitKey}
                    hit={hit}
                    onOpenPhotograph={onOpenPhotograph}
                  />
                ))}
              </ul>
            </ResultSection>
          ) : null}

          {rolls.length > 0 ? (
            <ResultSection title="Rolls" count={rolls.length}>
              <ul>
                {rolls.map((hit) => (
                  <RollResultRow key={hit.hitKey} hit={hit} />
                ))}
              </ul>
            </ResultSection>
          ) : null}

          {notes.length > 0 ? (
            <ResultSection title="Notes" count={notes.length}>
              <ul>
                {notes.map((hit) => (
                  <NoteResultRow key={hit.hitKey} hit={hit} />
                ))}
              </ul>
            </ResultSection>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ResultSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="max-w-2xl">
      <header className="border-b border-line pb-3">
        <p className="section-kicker">{title}</p>
        <p className="sr-only">
          {count} {count === 1 ? "result" : "results"}
        </p>
      </header>
      {children}
    </section>
  );
}

function PhotographResultRow({
  hit,
  onOpenPhotograph,
}: {
  hit: SearchHit;
  onOpenPhotograph: (rollId: string, frameId: string, trigger?: HTMLElement | null) => void;
}) {
  const frameLabel = `Frame ${String(hit.frameNumber).padStart(2, "0")}`;
  const technical = [hit.aperture || null, hit.shutterSpeed || null].filter(Boolean).join(" · ");
  const openLabel = hit.caption
    ? `Open ${frameLabel}: ${hit.caption}`
    : `Open ${frameLabel} from ${hit.rollTitle}`;

  return (
    <li className="border-b border-line">
      <button
        type="button"
        data-search-result="photograph"
        aria-label={openLabel}
        onClick={(event) => {
          const target = resolvePhotographOpenTarget(hit);
          if (target) {
            onOpenPhotograph(target.rollId, target.frameId, event.currentTarget);
          }
        }}
        className={resultRowClassName}
      >
        <ResultThumb imageUrl={hit.imageUrl} size="large" interactive />
        <div className="min-w-0 flex-1 self-center">
          <p className="meta">Photograph</p>
          <h3 className="mt-1 font-serif text-xl tracking-tight text-ink transition-colors duration-150 group-hover:text-cobalt group-focus-visible:text-cobalt sm:text-[1.4rem]">
            {frameLabel}
          </h3>
          <p className="mt-1 truncate text-sm text-muted">{hit.rollTitle}</p>
          <dl className="mt-2.5 grid gap-1 sm:mt-3">
            {hit.caption ? (
              <div className="min-w-0">
                <dt className="sr-only">Caption</dt>
                <dd className="truncate text-sm text-ink/80">{hit.caption}</dd>
              </div>
            ) : null}
            <div className="min-w-0">
              <dt className="sr-only">Location</dt>
              <dd className="meta truncate">{hit.location || "Location not recorded"}</dd>
            </div>
            {technical ? (
              <div className="min-w-0">
                <dt className="sr-only">Exposure</dt>
                <dd className="meta truncate">{technical}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </button>
    </li>
  );
}

function RollResultRow({ hit }: { hit: SearchHit }) {
  const stockLine = [hit.filmStock || null, hit.camera || null].filter(Boolean).join(" · ");
  const frameCountLabel = `${hit.frameCount} ${hit.frameCount === 1 ? "photograph" : "photographs"}`;

  return (
    <li className="border-b border-line">
      <Link
        href={rollResultHref(hit.rollId)}
        data-search-result="roll"
        aria-label={`Open roll ${hit.rollTitle}`}
        className={resultRowClassName}
      >
        {hit.imageUrl ? <ResultThumb imageUrl={hit.imageUrl} size="compact" interactive /> : null}
        <div className="min-w-0 flex-1 self-center">
          <p className="meta">Roll</p>
          <h3 className="mt-1 font-serif text-xl tracking-tight text-ink transition-colors duration-150 group-hover:text-cobalt group-focus-visible:text-cobalt sm:text-[1.4rem]">
            {hit.rollTitle}
          </h3>
          <dl className="mt-2.5 grid gap-1 sm:mt-3">
            <div className="min-w-0">
              <dt className="sr-only">Film and camera</dt>
              <dd className="meta truncate">{stockLine || "Film / camera not recorded"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="sr-only">Photographs</dt>
              <dd className="meta">{frameCountLabel}</dd>
            </div>
            <div className="min-w-0">
              <dt className="sr-only">Started</dt>
              <dd className="meta">{hit.startedOn ? formatDate(hit.startedOn) : "Date not recorded"}</dd>
            </div>
          </dl>
        </div>
      </Link>
    </li>
  );
}

function NoteResultRow({ hit }: { hit: SearchHit }) {
  const fromHandwriting = Boolean(hit.noteImageUrl);
  const body = hit.noteBody.trim();
  const ocr = hit.noteOcrText.trim();
  const thumbUrl = hit.noteImageUrl ?? (fromHandwriting ? hit.imageUrl : null);
  const kindLabel = fromHandwriting ? "Handwritten note" : "Note";

  return (
    <li className="border-b border-line">
      <Link
        href={noteResultHref(hit.rollId)}
        data-search-result="note"
        aria-label={`Open ${kindLabel.toLowerCase()} on ${hit.rollTitle}`}
        className={resultRowClassName}
      >
        <ResultThumb imageUrl={thumbUrl} size="large" interactive />
        <div className="min-w-0 flex-1 self-center">
          <p className="meta">{kindLabel}</p>
          <h3 className="mt-1 font-serif text-xl tracking-tight text-ink transition-colors duration-150 group-hover:text-cobalt group-focus-visible:text-cobalt sm:text-[1.4rem]">
            {hit.rollTitle}
          </h3>
          {fromHandwriting ? (
            <p className="mt-2.5 text-sm leading-relaxed text-muted sm:mt-3">
              Original handwriting preserved
            </p>
          ) : null}
          {body ? (
            <p
              className={`line-clamp-2 text-sm leading-relaxed text-ink/80 ${fromHandwriting ? "mt-1.5" : "mt-2.5 sm:mt-3"}`}
            >
              {body}
            </p>
          ) : null}
          {ocr ? (
            <div className={body || fromHandwriting ? "mt-1.5" : "mt-2.5 sm:mt-3"}>
              <p className="meta">Derived text</p>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{ocr}</p>
            </div>
          ) : null}
          {!body && !ocr && !fromHandwriting ? (
            <p className="mt-2.5 text-sm leading-relaxed text-muted sm:mt-3">Note</p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function ResultThumb({
  imageUrl,
  size = "large",
  interactive = false,
}: {
  imageUrl: string | null;
  size?: "large" | "compact";
  interactive?: boolean;
}) {
  const sizeClass =
    size === "compact"
      ? "h-14 w-14 sm:h-16 sm:w-16"
      : "h-[4.5rem] w-[5.5rem] sm:h-28 sm:w-36";

  return (
    <div className={`${sizeClass} shrink-0 overflow-hidden bg-matte`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className={`h-full w-full object-cover transition-[opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] ${
            interactive ? "group-hover:opacity-90 group-focus-visible:opacity-90" : ""
          }`}
        />
      ) : (
        <div className="flex h-full items-center justify-center meta">—</div>
      )}
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
