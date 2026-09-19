"use client";

import { Button } from "@/components/Button";
import { fileToCompressedJpeg } from "@/lib/image";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

type CapturePhase = "closed" | "live" | "preview";

type HandwrittenNoteCaptureProps = {
  disabled?: boolean;
  onSave: (imageBlob: Blob) => Promise<void>;
};

export function HandwrittenNoteCapture({ disabled = false, onSave }: HandwrittenNoteCaptureProps) {
  const statusId = useId();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<CapturePhase>("closed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackHint, setFallbackHint] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureButtonRef = useRef<HTMLButtonElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const openCameraButtonRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
    // Cleanup only on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "live") {
      return;
    }

    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) {
      return;
    }

    video.srcObject = stream;
    void video.play().catch(() => {
      setError("Camera preview could not start.");
    });
    captureButtonRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (phase === "preview" && previewUrl) {
      saveButtonRef.current?.focus();
    }
  }, [phase, previewUrl]);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      openCameraButtonRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  function stopCamera() {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }

  function clearPreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setImageBlob(null);
  }

  function resetSession() {
    stopCamera();
    clearPreview();
    setPhase("closed");
    setBusy(false);
    setError(null);
    setFallbackHint(null);
  }

  function close() {
    resetSession();
    setOpen(false);
  }

  async function startCamera() {
    setBusy(true);
    setError(null);
    setFallbackHint(null);
    stopCamera();
    clearPreview();

    if (!navigator.mediaDevices?.getUserMedia) {
      setFallbackHint("Camera is not available in this browser. Choose an image of the page instead.");
      setPhase("closed");
      setBusy(false);
      setOpen(true);
      statusRef.current?.focus();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
        },
      });
      streamRef.current = stream;
      setOpen(true);
      setPhase("live");
    } catch (err) {
      const denied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      setFallbackHint(
        denied
          ? "Camera permission was denied. Choose an image of the page instead."
          : "Camera could not be started. Choose an image of the page instead.",
      );
      setPhase("closed");
      setOpen(true);
      statusRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function captureFromVideo() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Camera preview is not ready yet.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Could not capture from the camera.");
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const rawBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Could not capture from the camera."));
              return;
            }
            resolve(blob);
          },
          "image/jpeg",
          0.92,
        );
      });

      const compressed = await fileToCompressedJpeg(rawBlob);
      stopCamera();
      clearPreview();
      setImageBlob(compressed.blob);
      setPreviewUrl(compressed.previewUrl);
      setPhase("preview");
    } catch {
      setError("That capture could not be processed.");
    } finally {
      setBusy(false);
    }
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);
    setFallbackHint(null);
    try {
      const compressed = await fileToCompressedJpeg(file);
      stopCamera();
      clearPreview();
      setOpen(true);
      setImageBlob(compressed.blob);
      setPreviewUrl(compressed.previewUrl);
      setPhase("preview");
    } catch {
      setError("That image could not be read.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCapture() {
    if (!imageBlob) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onSave(imageBlob);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not archive this handwritten note.");
    } finally {
      setBusy(false);
    }
  }

  async function retake() {
    clearPreview();
    setError(null);
    await startCamera();
  }

  const statusMessage =
    phase === "preview"
      ? "Review the photograph. Saving adds this page to the roll as an archival original."
      : phase === "live"
        ? "Frame the handwritten page, then photograph it."
        : open
          ? "Use the file picker above, or try the camera again."
          : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          ref={openCameraButtonRef}
          type="button"
          variant="secondary"
          disabled={disabled || busy}
          onClick={() => void startCamera()}
          aria-describedby={statusId}
        >
          {busy && phase === "closed" && !open ? "Opening camera…" : "Photograph the page"}
        </Button>
        <input
          ref={fileInputRef}
          id={`${statusId}-file`}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFileChange}
          className="sr-only"
          tabIndex={-1}
          disabled={disabled || busy}
          aria-label="Choose an image of the handwritten page"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || busy}
          onClick={() => fileInputRef.current?.click()}
        >
          Choose image
        </Button>
      </div>

      <div
        id={statusId}
        className="space-y-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {fallbackHint ? (
          <p ref={statusRef} tabIndex={-1} className="text-sm text-muted outline-none">
            {fallbackHint}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>

      {open ? (
        <div className="border-y border-line py-5">
          {statusMessage ? (
            <p className="text-sm leading-relaxed text-muted">{statusMessage}</p>
          ) : null}

          {phase === "live" ? (
            <div className="mt-4">
              <video
                ref={videoRef}
                className="aspect-[4/3] w-full max-w-lg bg-film object-cover"
                playsInline
                muted
                autoPlay
                aria-label="Live camera view for photographing a handwritten note"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  ref={captureButtonRef}
                  type="button"
                  disabled={busy}
                  onClick={() => void captureFromVideo()}
                  aria-label="Capture photograph of handwritten note"
                >
                  {busy ? "Capturing…" : "Capture"}
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={close}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {phase === "preview" && previewUrl ? (
            <div className="mt-4">
              <p className="meta">Preview</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Preview of handwritten note photograph ready to archive"
                className="mt-3 max-h-[min(70vh,28rem)] w-full max-w-lg bg-matte object-contain"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  ref={saveButtonRef}
                  type="button"
                  disabled={busy}
                  onClick={() => void saveCapture()}
                  aria-label="Add handwritten note photograph to this roll"
                >
                  {busy ? "Archiving…" : "Add to roll"}
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void retake()}>
                  Retake
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose another image
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={close}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {phase === "closed" ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" disabled={busy} onClick={() => void startCamera()}>
                Try camera again
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={close}>
                Cancel
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
