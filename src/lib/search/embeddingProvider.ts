import type {
  EmbeddingModelInfo,
  EmbeddingProviderStatus,
} from "./types.ts";

/**
 * Pluggable local embedding provider.
 * Implementations must run on-device (browser worker / WASM / WebGPU).
 * Never call a hosted AI inference API from an EmbeddingProvider.
 */
export interface EmbeddingProvider {
  readonly modelId: string;
  getStatus(): EmbeddingProviderStatus;
  getModelInfo(): EmbeddingModelInfo | null;
  /**
   * Load model weights if needed. Should report progress for first download UX.
   * progress is 0–1; message is human-readable status.
   */
  ensureReady(onProgress?: (progress: number, message: string) => void): Promise<void>;
  embedText(text: string): Promise<Float32Array>;
  embedImageBitmap(image: ImageBitmap): Promise<Float32Array>;
}

/** Target CLIP-family model once a browser runtime is wired (not shipped yet). */
export const INTENDED_CLIP_MODEL: EmbeddingModelInfo = {
  id: "Xenova/clip-vit-base-patch32",
  dims: 512,
  label: "CLIP ViT-B/32 (local)",
  downloadHint: "~90–150 MB first download",
};
