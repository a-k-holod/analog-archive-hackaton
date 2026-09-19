const MAX_EDGE = 1200;
const JPEG_QUALITY = 0.82;

export type CompressedPhotograph = {
  blob: Blob;
  previewUrl: string;
};

export async function fileToCompressedJpeg(file: Blob): Promise<CompressedPhotograph> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const { width, height } = fitWithin(image.naturalWidth, image.naturalHeight, MAX_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not read this photograph.");
    }

    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToJpegBlob(canvas);
    return {
      blob,
      previewUrl: URL.createObjectURL(blob),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not encode this photograph."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load this photograph."));
    image.src = src;
  });
}

function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height };
  }

  const scale = maxEdge / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
