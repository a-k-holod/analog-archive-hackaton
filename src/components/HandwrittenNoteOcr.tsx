"use client";

import { Button } from "@/components/Button";
import { Field, textareaClassName } from "@/components/Field";
import {
  extractHandwritingText,
  isUsableOcrResult,
  type OcrProgress,
} from "@/lib/ocr/localOcr";
import type { Note } from "@/lib/types";
import { useId, useState } from "react";

type HandwrittenNoteOcrProps = {
  note: Note;
  disabled?: boolean;
  onSaveOcrText: (noteId: string, ocrText: string) => Promise<void>;
};

export function HandwrittenNoteOcr({
  note,
  disabled = false,
  onSaveOcrText,
}: HandwrittenNoteOcrProps) {
  const statusId = useId();
  const fieldId = useId();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emptyResult, setEmptyResult] = useState(false);
  const [draft, setDraft] = useState(note.ocrText);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [syncedKey, setSyncedKey] = useState(`${note.id}:${note.ocrText}`);

  const noteKey = `${note.id}:${note.ocrText}`;
  if (noteKey !== syncedKey) {
    setSyncedKey(noteKey);
    setDraft(note.ocrText);
    setSavedFlash(false);
    setSaveError(null);
  }

  if (!note.imageUrl) {
    return null;
  }

  async function runOcr() {
    if (!note.imageUrl) {
      return;
    }

    setBusy(true);
    setError(null);
    setEmptyResult(false);
    setSaveError(null);
    setSavedFlash(false);
    setProgress({ status: "loading tesseract core", progress: 0, message: "Loading reader…" });

    try {
      const result = await extractHandwritingText(note.imageUrl, setProgress);
      if (!isUsableOcrResult(result)) {
        setEmptyResult(true);
        return;
      }
      setDraft(result.text);
      await onSaveOcrText(note.id, result.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read this handwriting.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function saveEdits() {
    const next = draft.trim();
    if (!next) {
      setSaveError("Enter some derived text before saving, or read handwriting again.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setEmptyResult(false);
    try {
      await onSaveOcrText(note.id, next);
      setSavedFlash(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save derived text.");
    } finally {
      setSaving(false);
    }
  }

  const hasOcr = note.ocrText.trim().length > 0;
  const dirty = draft.trim() !== note.ocrText.trim();
  const actionLabel = hasOcr ? "Read handwriting again" : "Read handwriting";
  const showEditor = hasOcr || draft.trim().length > 0;

  return (
    <div className="mt-5 space-y-3 border-t border-line pt-4">
      {showEditor ? (
        <div className="space-y-3">
          <Field label="Derived text (editable)">
            <textarea
              id={fieldId}
              className={`${textareaClassName} min-h-24`}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setSavedFlash(false);
                setSaveError(null);
              }}
              disabled={disabled || busy || saving}
              spellCheck
              aria-describedby={statusId}
            />
          </Field>
          <p className="text-xs leading-relaxed text-muted">
            Interpretation for search only — not the archival original. The handwriting photograph
            above remains the source of truth.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="primary"
              disabled={disabled || busy || saving || !dirty || !draft.trim()}
              onClick={() => void saveEdits()}
            >
              {saving ? "Saving…" : hasOcr ? "Update derived text" : "Save derived text"}
            </Button>
            {savedFlash && !dirty ? (
              <p className="meta" aria-live="polite">
                Derived text saved
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted">
          Optionally read the handwriting for search. Runs locally in this browser — the photograph
          stays the archival source. You can correct the derived text afterward.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || busy || saving}
          onClick={() => void runOcr()}
          aria-describedby={statusId}
          aria-label={
            hasOcr ? "Read handwriting again and update derived text" : "Read handwriting and extract text"
          }
        >
          {busy ? "Reading…" : actionLabel}
        </Button>
        {busy && progress ? (
          <p className="meta loading-pulse" aria-live="polite">
            {progress.message}
          </p>
        ) : null}
      </div>

      <div id={statusId} aria-live="polite" aria-atomic="true">
        {emptyResult ? (
          <p className="text-sm text-muted">
            Could not make out readable text. The photograph is still preserved — try a clearer page,
            or read handwriting again.
          </p>
        ) : null}
        {saveError ? (
          <p role="alert" className="text-sm text-danger">
            {saveError}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => void runOcr()}
              disabled={disabled || busy || saving}
            >
              Retry
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
