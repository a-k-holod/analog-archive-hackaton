import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPreprocessVariants,
  cropDocumentMargins,
  detectGridLines,
  pickPeriodicDarkLines,
  rgbaToGray,
  stretchContrast,
  suppressGridLines,
  type RgbaImage,
} from "./preprocess.ts";

function solidGray(width: number, height: number, value: number) {
  return {
    width,
    height,
    pixels: new Uint8ClampedArray(width * height).fill(value),
  };
}

function rgbaFromGray(gray: { width: number; height: number; pixels: Uint8ClampedArray }): RgbaImage {
  const data = new Uint8ClampedArray(gray.width * gray.height * 4);
  for (let i = 0; i < gray.pixels.length; i += 1) {
    const v = gray.pixels[i]!;
    const o = i * 4;
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
    data[o + 3] = 255;
  }
  return { width: gray.width, height: gray.height, data };
}

/** Light paper with a regular dark grid every `period` px. */
function makeGridPaper(width: number, height: number, period: number, lineValue = 170, paper = 245) {
  const pixels = new Uint8ClampedArray(width * height).fill(paper);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (y % period === 0 || x % period === 0) {
        pixels[y * width + x] = lineValue;
      }
    }
  }
  return { width, height, pixels };
}

test("pickPeriodicDarkLines finds regular dark spacing", () => {
  const period = 20;
  const means = new Float64Array(200).fill(240);
  for (let i = 10; i < 200; i += period) {
    means[i] = 160;
  }
  const found = pickPeriodicDarkLines(means, 8, 40);
  assert.ok(found);
  assert.equal(found!.period, period);
  assert.ok(found!.confidence >= 0.5);
  assert.ok(found!.indices.length >= 4);
});

test("pickPeriodicDarkLines returns null for irregular noise", () => {
  const means = new Float64Array(120).fill(230);
  // One dark band plus a couple of stray dips — not a repeating grid.
  for (let i = 40; i < 55; i += 1) {
    means[i] = 150;
  }
  means[10] = 160;
  means[97] = 155;
  assert.equal(pickPeriodicDarkLines(means, 8, 40), null);
});

test("detectGridLines and suppressGridLines soften grid without erasing dark strokes", () => {
  const grid = makeGridPaper(160, 160, 16, 175, 248);
  // Dark handwriting stroke across several cells.
  for (let x = 20; x < 140; x += 1) {
    for (let t = -1; t <= 1; t += 1) {
      grid.pixels[(80 + t) * 160 + x] = 20;
    }
  }

  const detected = detectGridLines(grid);
  assert.ok(detected);
  assert.ok(detected!.confidence >= 0.55);

  const { image, gridRemoved } = suppressGridLines(grid);
  assert.equal(gridRemoved, true);

  // Grid intersection (no ink) should lighten toward paper.
  assert.ok(image.pixels[16 * 160 + 16]! > grid.pixels[16 * 160 + 16]!);
  // Handwriting stroke stays dark.
  assert.ok(image.pixels[80 * 160 + 90]! < 40);
});

test("suppressGridLines is conservative when no grid is present", () => {
  const plain = solidGray(100, 100, 230);
  for (let x = 10; x < 90; x += 1) {
    plain.pixels[50 * 100 + x] = 30;
  }
  const result = suppressGridLines(plain);
  assert.equal(result.gridRemoved, false);
  assert.deepEqual([...result.image.pixels], [...plain.pixels]);
});

test("stretchContrast expands a narrow midtone range", () => {
  const gray = solidGray(32, 32, 140);
  // Enough samples at the ends so percentile stretch engages.
  for (let i = 0; i < 40; i += 1) {
    gray.pixels[i] = 120;
  }
  for (let i = 40; i < 80; i += 1) {
    gray.pixels[i] = 160;
  }
  const stretched = stretchContrast(gray, 2, 98);
  const min = Math.min(...stretched.pixels);
  const max = Math.max(...stretched.pixels);
  assert.ok(min <= 5);
  assert.ok(max >= 250);
  assert.ok(max - min > 160 - 120);
});

test("cropDocumentMargins removes empty borders around content", () => {
  const gray = solidGray(80, 80, 250);
  for (let y = 30; y < 50; y += 1) {
    for (let x = 30; x < 50; x += 1) {
      gray.pixels[y * 80 + x] = 40;
    }
  }
  const cropped = cropDocumentMargins(gray, 2);
  assert.ok(cropped.width < 80);
  assert.ok(cropped.height < 80);
  assert.ok(cropped.width >= 20);
  assert.ok(cropped.height >= 20);
});

test("buildPreprocessVariants always includes contrast path and never mutates input buffer", () => {
  const paper = makeGridPaper(120, 120, 15);
  const rgba = rgbaFromGray(paper);
  const before = rgba.data[0];
  const variants = buildPreprocessVariants(rgba);
  assert.ok(variants.some((v) => v.id === "contrast"));
  assert.ok(variants.some((v) => v.id === "adaptive"));
  assert.ok(variants.some((v) => v.gridRemoved));
  assert.equal(rgba.data[0], before);
  // Round-trip gray helper stays consistent.
  const roundTrip = rgbaToGray(rgba);
  assert.equal(roundTrip.width, 120);
  assert.equal(roundTrip.pixels[0], paper.pixels[0]);
});
