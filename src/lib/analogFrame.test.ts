import assert from "node:assert/strict";
import test from "node:test";
import {
  FILM_EDGE_CONFIDENCE_THRESHOLD,
  analyzeFilmEdgePixels,
  clearFilmEdgeDetectionCache,
  detectFilmEdge,
  formatFilmStockEdgeLabel,
  formatFrameNumber,
  normalizeIsoValue,
  resolveAnalogFrameLayout,
  resolveContactSheetCell,
  resolveImageOrientation,
  resolveRebateLabelPlacement,
  shouldShowAnalogFrame,
  type AnalogFrameMode,
  type FilmEdgeDetection,
  type PixelBuffer,
} from "./analogFrame.ts";

function createBuffer(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number],
): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

/** Dark rebate all around + periodic bright sprocket holes on both long (horizontal) edges. */
function makeConvincingLandscapeFilm(width = 240, height = 160): PixelBuffer {
  const rebate = 12;
  const period = 20;
  const holeW = 5;
  const holeH = 6;

  return createBuffer(width, height, (x, y) => {
    const inRebate =
      y < rebate || y >= height - rebate || x < rebate || x >= width - rebate;

    if (!inRebate) {
      const v = 110 + ((x * 17 + y * 13) % 70);
      return [v, v - 8, v - 14];
    }

    const onTop = y < rebate;
    const onBottom = y >= height - rebate;
    if (onTop || onBottom) {
      const localY = onTop ? y : y - (height - rebate);
      const phase = x % period;
      if (phase < holeW && localY >= 2 && localY < 2 + holeH) {
        return [210, 210, 205];
      }
    }

    return [18, 18, 20];
  });
}

/** Portrait scan with sprocket rails on the vertical (left/right) long edges. */
function makeConvincingPortraitFilm(width = 160, height = 240): PixelBuffer {
  const rebate = 12;
  const period = 20;
  const holeW = 6;
  const holeH = 5;

  return createBuffer(width, height, (x, y) => {
    const inRebate =
      y < rebate || y >= height - rebate || x < rebate || x >= width - rebate;

    if (!inRebate) {
      const v = 110 + ((x * 17 + y * 13) % 70);
      return [v, v - 8, v - 14];
    }

    const onLeft = x < rebate;
    const onRight = x >= width - rebate;
    if (onLeft || onRight) {
      const localX = onLeft ? x : x - (width - rebate);
      const phase = y % period;
      if (phase < holeH && localX >= 2 && localX < 2 + holeW) {
        return [210, 210, 205];
      }
    }

    return [18, 18, 20];
  });
}

/** Near-square with weak/ambiguous edges — should not invent elaborate sprockets. */
function makeSquareAmbiguous(width = 200, height = 200): PixelBuffer {
  return createBuffer(width, height, (x, y) => {
    const edge = x < 4 || y < 4 || x >= width - 4 || y >= height - 4;
    if (edge) return [35, 35, 38];
    const v = 90 + ((x * 13 + y * 11) % 80);
    return [v, v - 4, v - 10];
  });
}

function makeSprocketHeavyScan(width = 260, height = 150): PixelBuffer {
  const rebate = 14;
  const period = 18;
  return createBuffer(width, height, (x, y) => {
    const inTop = y < rebate;
    const inBottom = y >= height - rebate;
    const inSide = x < 10 || x >= width - 10;
    if (inTop || inBottom) {
      const localY = inTop ? y : y - (height - rebate);
      const phase = x % period;
      if (phase >= 2 && phase <= 7 && localY >= 3 && localY <= 10) {
        return [230, 230, 228];
      }
      return [12, 12, 14];
    }
    if (inSide) return [22, 22, 24];
    const v = 100 + ((x + y) % 80);
    return [v, v - 5, v - 10];
  });
}

function makeOrdinaryPhoto(width = 240, height = 160): PixelBuffer {
  return createBuffer(width, height, (x, y) => {
    const v = 60 + ((x * 31 + y * 17) % 140);
    return [v, (v + 20) % 220, (v + 40) % 200];
  });
}

function makeAmbiguousSoftEdge(width = 240, height = 160): PixelBuffer {
  return createBuffer(width, height, (x, y) => {
    const edgeDark = y < 6 ? 40 : 120 + ((x + y) % 50);
    return [edgeDark, edgeDark, edgeDark + 4];
  });
}

function makeLetterbox(width = 240, height = 160): PixelBuffer {
  const bar = 28;
  return createBuffer(width, height, (x, y) => {
    if (y < bar || y >= height - bar) return [0, 0, 0];
    const v = 90 + ((x * 11 + y * 7) % 90);
    return [v, v + 10, v - 5];
  });
}

function makeOneSidedBorder(width = 240, height = 160): PixelBuffer {
  const rebate = 14;
  return createBuffer(width, height, (x, y) => {
    if (y < rebate) return [15, 15, 16];
    const v = 100 + ((x * 9 + y * 5) % 80);
    return [v, v - 6, v - 12];
  });
}

function makeGenericBlackFrame(width = 240, height = 160): PixelBuffer {
  const barY = 18;
  return createBuffer(width, height, (x, y) => {
    if (y < barY || y >= height - barY) return [0, 0, 0];
    const v = 95 + ((x + y) % 70);
    return [v, v, v - 8];
  });
}

test("Off never shows the decorative frame", () => {
  assert.equal(shouldShowAnalogFrame("off"), false);
  assert.equal(
    shouldShowAnalogFrame("off", {
      detection: {
        hasFilmBorder: true,
        confidence: 1,
        reasons: [],
        imageOrientation: "landscape",
        filmRailAxis: "horizontal",
      },
    }),
    false,
  );
  assert.equal(
    shouldShowAnalogFrame("off", {
      detection: {
        hasFilmBorder: false,
        confidence: 0,
        reasons: [],
        imageOrientation: "landscape",
        filmRailAxis: "unknown",
      },
    }),
    false,
  );
});

test("On always shows the decorative frame", () => {
  assert.equal(shouldShowAnalogFrame("on"), true);
  assert.equal(
    shouldShowAnalogFrame("on", {
      detection: {
        hasFilmBorder: false,
        confidence: 0,
        reasons: [],
        imageOrientation: "portrait",
        filmRailAxis: "unknown",
      },
    }),
    true,
  );
  assert.equal(shouldShowAnalogFrame("on", { detection: null }), true);
});

test("Auto is conservative without detection (no frame)", () => {
  assert.equal(shouldShowAnalogFrame("auto"), false);
  assert.equal(shouldShowAnalogFrame("auto", {}), false);
  assert.equal(shouldShowAnalogFrame("auto", { detection: null }), false);
  assert.equal(
    shouldShowAnalogFrame("auto", {
      detection: {
        hasFilmBorder: false,
        confidence: 0.9,
        reasons: [],
        imageOrientation: "landscape",
        filmRailAxis: "unknown",
      },
    }),
    false,
  );
});

test("Auto shows frame only when detection positively finds a film border", () => {
  assert.equal(
    shouldShowAnalogFrame("auto", {
      detection: {
        hasFilmBorder: true,
        confidence: 0.9,
        reasons: ["dual-sprocket"],
        imageOrientation: "landscape",
        filmRailAxis: "horizontal",
      },
    }),
    true,
  );
});

test("Auto remains false when confidence is insufficient even if reasons exist", () => {
  const weak: FilmEdgeDetection = {
    hasFilmBorder: false,
    confidence: FILM_EDGE_CONFIDENCE_THRESHOLD - 0.2,
    reasons: ["single-rail-sprocket", "below-confidence-threshold"],
    imageOrientation: "landscape",
    filmRailAxis: "unknown",
  };
  assert.equal(weak.confidence < FILM_EDGE_CONFIDENCE_THRESHOLD, true);
  assert.equal(shouldShowAnalogFrame("auto", { detection: weak }), false);
});

test("failed or unknown detection does not frame in Auto", async () => {
  clearFilmEdgeDetectionCache();
  const url = "https://example.com/photo.jpg";
  const result = await detectFilmEdge(url);
  assert.equal(result.hasFilmBorder, false);
  assert.equal(result.filmRailAxis, "unknown");
  assert.ok(result.confidence <= FILM_EDGE_CONFIDENCE_THRESHOLD);
  assert.ok(result.reasons.length > 0);
  assert.equal(shouldShowAnalogFrame("auto", { detection: result }), false);
  assert.equal(url, "https://example.com/photo.jpg");
});

test("formatFrameNumber pads to two digits", () => {
  assert.equal(formatFrameNumber(1), "01");
  assert.equal(formatFrameNumber(12), "12");
  assert.equal(formatFrameNumber(0), "00");
});

test("normalizeIsoValue strips ISO prefix and empty values", () => {
  assert.equal(normalizeIsoValue("400"), "400");
  assert.equal(normalizeIsoValue("ISO 400"), "400");
  assert.equal(normalizeIsoValue("iso400"), "400");
  assert.equal(normalizeIsoValue("  ISO 200  "), "200");
  assert.equal(normalizeIsoValue(""), null);
  assert.equal(normalizeIsoValue("   "), null);
  assert.equal(normalizeIsoValue(null), null);
  assert.equal(normalizeIsoValue(undefined), null);
});

test("formatFilmStockEdgeLabel formats stock + ISO for rebate marking", () => {
  assert.equal(formatFilmStockEdgeLabel("Kodak Tri-X 400"), "KODAK TRI-X 400");
  assert.equal(formatFilmStockEdgeLabel("Kodak Tri-X", "400"), "KODAK TRI-X 400");
  assert.equal(formatFilmStockEdgeLabel("Fomapan 400"), "FOMAPAN 400");
  assert.equal(
    formatFilmStockEdgeLabel("Ilford HP5 Plus ISO 400"),
    "ILFORD HP5 PLUS 400",
  );
  assert.equal(
    formatFilmStockEdgeLabel("Ilford HP5 Plus ISO 400", "400"),
    "ILFORD HP5 PLUS 400",
  );
  assert.equal(formatFilmStockEdgeLabel("Ilford HP5 Plus", "ISO 400"), "ILFORD HP5 PLUS 400");
});

test("formatFilmStockEdgeLabel avoids redundant ISO when stock already includes it", () => {
  assert.equal(formatFilmStockEdgeLabel("Fomapan 400", "400"), "FOMAPAN 400");
  assert.equal(formatFilmStockEdgeLabel("Fomapan 400", "ISO 400"), "FOMAPAN 400");
  assert.equal(formatFilmStockEdgeLabel("Kodak Tri-X 400", "400"), "KODAK TRI-X 400");
  assert.equal(formatFilmStockEdgeLabel("Portra 160", "160"), "PORTRA 160");
});

test("formatFilmStockEdgeLabel returns null when film stock is unknown", () => {
  assert.equal(formatFilmStockEdgeLabel(""), null);
  assert.equal(formatFilmStockEdgeLabel("   "), null);
  assert.equal(formatFilmStockEdgeLabel(null), null);
  assert.equal(formatFilmStockEdgeLabel(undefined), null);
  // Do not invent a manufacturer marking from ISO alone.
  assert.equal(formatFilmStockEdgeLabel("", "400"), null);
  assert.equal(formatFilmStockEdgeLabel(null, "400"), null);
});

test("formatFilmStockEdgeLabel keeps stock when ISO is missing", () => {
  assert.equal(formatFilmStockEdgeLabel("HP5"), "HP5");
  assert.equal(formatFilmStockEdgeLabel("Kodak Tri-X", ""), "KODAK TRI-X");
  assert.equal(formatFilmStockEdgeLabel("Kodak Tri-X", null), "KODAK TRI-X");
  assert.equal(formatFilmStockEdgeLabel("Kodak Tri-X", undefined), "KODAK TRI-X");
});

test("resolveContactSheetCell exposes film stock label and respects Off/Auto/On", () => {
  const url = "https://example.com/frame.jpg";

  const off = resolveContactSheetCell({
    mode: "off",
    imageUrl: url,
    frameNumber: 3,
    filmStock: "Kodak Tri-X",
    iso: "400",
  });
  assert.equal(off.showFrame, false);
  assert.equal(off.filmStockLabel, "KODAK TRI-X 400");
  assert.equal(off.frameNumberLabel, "03");
  assert.equal(off.imageUrl, url);

  const on = resolveContactSheetCell({
    mode: "on",
    imageUrl: url,
    frameNumber: 3,
    width: 240,
    height: 160,
    filmStock: "Fomapan 400",
    iso: "400",
  });
  assert.equal(on.showFrame, true);
  assert.equal(on.layout, "horizontal");
  assert.equal(on.filmStockLabel, "FOMAPAN 400");

  const onPortrait = resolveContactSheetCell({
    mode: "on",
    imageUrl: url,
    frameNumber: 8,
    width: 160,
    height: 240,
    filmStock: "Ilford HP5 Plus",
    iso: "400",
  });
  assert.equal(onPortrait.layout, "vertical");
  assert.equal(onPortrait.filmStockLabel, "ILFORD HP5 PLUS 400");
  assert.equal(onPortrait.frameNumberLabel, "08");

  const missingStock = resolveContactSheetCell({
    mode: "on",
    imageUrl: url,
    frameNumber: 1,
    width: 240,
    height: 160,
    filmStock: "",
    iso: "400",
  });
  assert.equal(missingStock.filmStockLabel, null);
  assert.equal(missingStock.frameNumberLabel, "01");

  const autoNoDetection = resolveContactSheetCell({
    mode: "auto",
    imageUrl: url,
    frameNumber: 2,
    filmStock: "HP5",
    iso: "400",
  });
  assert.equal(autoNoDetection.showFrame, false);
  assert.equal(autoNoDetection.filmStockLabel, "HP5 400");
});

test("rebate label placement follows orientation-aware frame layout", () => {
  assert.equal(resolveRebateLabelPlacement("horizontal"), "horizontal");
  assert.equal(resolveRebateLabelPlacement("vertical"), "vertical");
  assert.equal(resolveRebateLabelPlacement("restrained"), "stacked");

  // Landscape aspect → horizontal rails → horizontal rebate text.
  assert.equal(
    resolveRebateLabelPlacement(
      resolveAnalogFrameLayout({
        imageOrientation: "landscape",
        filmRailAxis: "unknown",
      }),
    ),
    "horizontal",
  );

  // Portrait aspect → vertical rails → rotated rebate text.
  assert.equal(
    resolveRebateLabelPlacement(
      resolveAnalogFrameLayout({
        imageOrientation: "portrait",
        filmRailAxis: "unknown",
      }),
    ),
    "vertical",
  );

  // Square → restrained → stacked caption under the gate.
  assert.equal(
    resolveRebateLabelPlacement(
      resolveAnalogFrameLayout({
        imageOrientation: "square",
        filmRailAxis: "unknown",
      }),
    ),
    "stacked",
  );

  // Detector rail axis still wins over aspect for label placement.
  assert.equal(
    resolveRebateLabelPlacement(
      resolveAnalogFrameLayout({
        imageOrientation: "landscape",
        filmRailAxis: "vertical",
        hasFilmBorder: true,
      }),
    ),
    "vertical",
  );
  assert.equal(
    resolveRebateLabelPlacement(
      resolveAnalogFrameLayout({
        imageOrientation: "portrait",
        filmRailAxis: "horizontal",
        hasFilmBorder: true,
      }),
    ),
    "horizontal",
  );
});

test("mode union accepts only off | auto | on", () => {
  const modes: AnalogFrameMode[] = ["off", "auto", "on"];
  for (const mode of modes) {
    assert.equal(typeof shouldShowAnalogFrame(mode), "boolean");
  }
});

test("resolveImageOrientation classifies landscape, portrait, and square", () => {
  assert.equal(resolveImageOrientation(240, 160), "landscape");
  assert.equal(resolveImageOrientation(160, 240), "portrait");
  assert.equal(resolveImageOrientation(200, 200), "square");
  assert.equal(resolveImageOrientation(100, 104), "square");
  assert.equal(resolveImageOrientation(0, 100), "square");
});

test("resolveAnalogFrameLayout prefers detector rail axis over aspect", () => {
  assert.equal(
    resolveAnalogFrameLayout({
      imageOrientation: "portrait",
      filmRailAxis: "horizontal",
      hasFilmBorder: true,
    }),
    "horizontal",
  );
  assert.equal(
    resolveAnalogFrameLayout({
      imageOrientation: "landscape",
      filmRailAxis: "vertical",
      hasFilmBorder: true,
    }),
    "vertical",
  );
});

test("resolveAnalogFrameLayout uses aspect when rail axis is unknown", () => {
  assert.equal(
    resolveAnalogFrameLayout({ imageOrientation: "landscape", filmRailAxis: "unknown" }),
    "horizontal",
  );
  assert.equal(
    resolveAnalogFrameLayout({ imageOrientation: "portrait", filmRailAxis: "unknown" }),
    "vertical",
  );
  assert.equal(
    resolveAnalogFrameLayout({ imageOrientation: "square", filmRailAxis: "unknown" }),
    "restrained",
  );
});

test("film border without rail axis stays restrained", () => {
  assert.equal(
    resolveAnalogFrameLayout({
      imageOrientation: "landscape",
      filmRailAxis: "unknown",
      hasFilmBorder: true,
    }),
    "restrained",
  );
});

test("resolveContactSheetCell keeps image URL unchanged and frame number correct", () => {
  const url = "https://xyz.supabase.co/storage/v1/object/public/photographs/roll/frame.jpg";

  const off = resolveContactSheetCell({ mode: "off", imageUrl: url, frameNumber: 7 });
  assert.equal(off.showFrame, false);
  assert.equal(off.imageUrl, url);
  assert.equal(off.frameNumberLabel, "07");
  assert.equal(off.filmStockLabel, null);

  const on = resolveContactSheetCell({
    mode: "on",
    imageUrl: url,
    frameNumber: 7,
    width: 240,
    height: 160,
  });
  assert.equal(on.showFrame, true);
  assert.equal(on.layout, "horizontal");
  assert.equal(on.imageUrl, url);
  assert.equal(on.frameNumberLabel, "07");

  const onPortrait = resolveContactSheetCell({
    mode: "on",
    imageUrl: url,
    frameNumber: 7,
    width: 160,
    height: 240,
  });
  assert.equal(onPortrait.showFrame, true);
  assert.equal(onPortrait.layout, "vertical");
  assert.equal(onPortrait.imageUrl, url);

  const onSquare = resolveContactSheetCell({
    mode: "on",
    imageUrl: url,
    frameNumber: 7,
    width: 200,
    height: 200,
  });
  assert.equal(onSquare.showFrame, true);
  assert.equal(onSquare.layout, "restrained");

  const auto = resolveContactSheetCell({ mode: "auto", imageUrl: url, frameNumber: 7 });
  assert.equal(auto.showFrame, false);
  assert.equal(auto.imageUrl, url);
  assert.equal(auto.frameNumberLabel, "07");

  const autoPositive = resolveContactSheetCell({
    mode: "auto",
    imageUrl: url,
    frameNumber: 7,
    detection: {
      hasFilmBorder: true,
      confidence: 0.9,
      reasons: ["dual-sprocket-periodicity"],
      imageOrientation: "landscape",
      filmRailAxis: "horizontal",
    },
  });
  assert.equal(autoPositive.showFrame, true);
  assert.equal(autoPositive.layout, "horizontal");
  assert.equal(autoPositive.imageUrl, url);
  assert.equal(autoPositive.frameNumberLabel, "07");

  const autoNegative = resolveContactSheetCell({
    mode: "auto",
    imageUrl: url,
    frameNumber: 7,
    detection: {
      hasFilmBorder: false,
      confidence: 0.2,
      reasons: ["insufficient-evidence"],
      imageOrientation: "landscape",
      filmRailAxis: "unknown",
    },
  });
  assert.equal(autoNegative.showFrame, false);
  assert.equal(autoNegative.imageUrl, url);
  assert.equal(autoNegative.frameNumberLabel, "07");
});

test("landscape film scan is a positive with horizontal rails", () => {
  const result = analyzeFilmEdgePixels(makeConvincingLandscapeFilm());
  assert.equal(result.hasFilmBorder, true);
  assert.equal(result.imageOrientation, "landscape");
  assert.equal(result.filmRailAxis, "horizontal");
  assert.ok(result.confidence >= FILM_EDGE_CONFIDENCE_THRESHOLD);
  assert.ok(result.reasons.some((r) => r.includes("sprocket") || r.includes("rebate")));
});

test("portrait film scan is a positive with vertical rails", () => {
  const result = analyzeFilmEdgePixels(makeConvincingPortraitFilm());
  assert.equal(result.hasFilmBorder, true);
  assert.equal(result.imageOrientation, "portrait");
  assert.equal(result.filmRailAxis, "vertical");
  assert.ok(result.confidence >= FILM_EDGE_CONFIDENCE_THRESHOLD);
  assert.ok(result.reasons.some((r) => r.includes("sprocket") || r.includes("rebate")));
});

test("square/ambiguous scan stays negative or restrained", () => {
  const result = analyzeFilmEdgePixels(makeSquareAmbiguous());
  assert.equal(result.imageOrientation, "square");
  assert.equal(result.hasFilmBorder, false);
  assert.equal(result.filmRailAxis, "unknown");
  assert.equal(
    resolveAnalogFrameLayout({
      imageOrientation: result.imageOrientation,
      filmRailAxis: result.filmRailAxis,
      hasFilmBorder: result.hasFilmBorder,
    }),
    "restrained",
  );
});

test("strong repeated sprocket-like evidence is a positive", () => {
  const result = analyzeFilmEdgePixels(makeSprocketHeavyScan());
  assert.equal(result.hasFilmBorder, true);
  assert.ok(result.confidence >= FILM_EDGE_CONFIDENCE_THRESHOLD);
  assert.ok(result.reasons.some((r) => r.includes("sprocket")));
});

test("ordinary photographic image is a negative", () => {
  const result = analyzeFilmEdgePixels(makeOrdinaryPhoto());
  assert.equal(result.hasFilmBorder, false);
  assert.ok(result.confidence < FILM_EDGE_CONFIDENCE_THRESHOLD);
});

test("ambiguous soft edge is a negative", () => {
  const result = analyzeFilmEdgePixels(makeAmbiguousSoftEdge());
  assert.equal(result.hasFilmBorder, false);
});

test("letterbox-like border is a negative", () => {
  const result = analyzeFilmEdgePixels(makeLetterbox());
  assert.equal(result.hasFilmBorder, false);
  assert.ok(
    result.reasons.includes("letterbox-like-borders") ||
      result.confidence < FILM_EDGE_CONFIDENCE_THRESHOLD,
  );
});

test("one-sided weak border is a negative", () => {
  const result = analyzeFilmEdgePixels(makeOneSidedBorder());
  assert.equal(result.hasFilmBorder, false);
  assert.ok(
    result.reasons.includes("one-sided-weak-border") ||
      result.confidence < FILM_EDGE_CONFIDENCE_THRESHOLD,
  );
});

test("generic black bars without sprockets stay below threshold", () => {
  const result = analyzeFilmEdgePixels(makeGenericBlackFrame());
  assert.equal(result.hasFilmBorder, false);
  assert.ok(result.confidence < FILM_EDGE_CONFIDENCE_THRESHOLD);
});

test("confidence threshold gates hasFilmBorder", () => {
  const positive = analyzeFilmEdgePixels(makeConvincingLandscapeFilm());
  assert.equal(positive.hasFilmBorder, positive.confidence >= FILM_EDGE_CONFIDENCE_THRESHOLD);

  const negative = analyzeFilmEdgePixels(makeOrdinaryPhoto());
  assert.equal(negative.hasFilmBorder, false);
  assert.ok(negative.confidence < FILM_EDGE_CONFIDENCE_THRESHOLD);
});

test("Auto + positive landscape detection frames with horizontal layout", () => {
  const detection = analyzeFilmEdgePixels(makeConvincingLandscapeFilm());
  const cell = resolveContactSheetCell({
    mode: "auto",
    imageUrl: "https://example.com/land.jpg",
    frameNumber: 3,
    detection,
  });
  assert.equal(detection.hasFilmBorder, true);
  assert.equal(cell.showFrame, true);
  assert.equal(cell.layout, "horizontal");
  assert.equal(cell.imageUrl, "https://example.com/land.jpg");
  assert.equal(cell.frameNumberLabel, "03");
});

test("Auto + positive portrait detection frames with vertical layout", () => {
  const detection = analyzeFilmEdgePixels(makeConvincingPortraitFilm());
  const cell = resolveContactSheetCell({
    mode: "auto",
    imageUrl: "https://example.com/port.jpg",
    frameNumber: 11,
    detection,
  });
  assert.equal(detection.hasFilmBorder, true);
  assert.equal(cell.showFrame, true);
  assert.equal(cell.layout, "vertical");
  assert.equal(cell.imageUrl, "https://example.com/port.jpg");
  assert.equal(cell.frameNumberLabel, "11");
});

test("Auto + negative detection does not frame", () => {
  const detection = analyzeFilmEdgePixels(makeOrdinaryPhoto());
  const cell = resolveContactSheetCell({
    mode: "auto",
    imageUrl: "https://example.com/plain.jpg",
    frameNumber: 4,
    detection,
  });
  assert.equal(detection.hasFilmBorder, false);
  assert.equal(cell.showFrame, false);
  assert.equal(cell.imageUrl, "https://example.com/plain.jpg");
  assert.equal(cell.frameNumberLabel, "04");
});
