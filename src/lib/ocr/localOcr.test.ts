import assert from "node:assert/strict";
import test from "node:test";
import { isUsableOcrResult, normalizeOcrText } from "./localOcr.ts";

test("normalizeOcrText trims and collapses sparse handwriting lines", () => {
  assert.equal(normalizeOcrText("  Photo walk  \n\n  Sławinek  "), "Photo walk\nSławinek");
  assert.equal(normalizeOcrText("\n\n"), "");
  assert.equal(normalizeOcrText("   "), "");
});

test("normalizeOcrText preserves Polish diacritics", () => {
  assert.equal(normalizeOcrText("Gdańsk  łódź"), "Gdańsk łódź");
});

test("isUsableOcrResult rejects empty and low-quality readings", () => {
  assert.equal(isUsableOcrResult({ text: "", confidence: 90 }), false);
  assert.equal(isUsableOcrResult({ text: "ab", confidence: 90 }), false);
  assert.equal(isUsableOcrResult({ text: "HC", confidence: 20 }), false);
  assert.equal(isUsableOcrResult({ text: "Fomapan 100", confidence: 20 }), false);
  assert.equal(isUsableOcrResult({ text: "Fomapan 100", confidence: 55 }), true);
  assert.equal(isUsableOcrResult({ text: "Sławinek", confidence: 0 }), true);
  assert.equal(isUsableOcrResult({ text: "||| ;;; ::: ...", confidence: 90 }), false);
});
