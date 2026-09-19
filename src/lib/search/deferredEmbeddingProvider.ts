import { INTENDED_CLIP_MODEL, type EmbeddingProvider } from "./embeddingProvider.ts";
import type { EmbeddingModelInfo, EmbeddingProviderStatus } from "./types.ts";

/**
 * Deferred embedding provider — semantic visual search is designed but not
 * activated in this build.
 *
 * Why: shipping `@huggingface/transformers` + CLIP into this Next.js /
 * Vercel demo would pull ONNX Runtime, require webpack aliases to strip
 * `onnxruntime-node` / `sharp`, and force judges to download ~90–150 MB of
 * model weights on first visit. That is a reliability risk for a short
 * hackathon demo window. Metadata search remains fully functional; this
 * provider keeps the interface stable for a later opt-in local CLIP worker.
 */
export class DeferredEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = INTENDED_CLIP_MODEL.id;

  private readonly reason: string;

  constructor(reason?: string) {
    this.reason =
      reason ??
      "Local CLIP inference is deferred: model download and ONNX bundling are not reliable enough for this demo build. Metadata search is available.";
  }

  getStatus(): EmbeddingProviderStatus {
    return { state: "unavailable", reason: this.reason };
  }

  getModelInfo(): EmbeddingModelInfo | null {
    return INTENDED_CLIP_MODEL;
  }

  async ensureReady(): Promise<void> {
    throw new Error(this.reason);
  }

  async embedText(): Promise<Float32Array> {
    throw new Error(this.reason);
  }

  async embedImageBitmap(): Promise<Float32Array> {
    throw new Error(this.reason);
  }
}

export function createDefaultEmbeddingProvider(): EmbeddingProvider {
  return new DeferredEmbeddingProvider();
}
