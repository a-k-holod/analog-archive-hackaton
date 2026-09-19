import assert from "node:assert/strict";
import test from "node:test";
import { locationsMatch, normalizeLocation } from "./location.ts";

test("Lublin, Poland stays Lublin, Poland", () => {
  assert.equal(normalizeLocation("Lublin, Poland"), "Lublin, Poland");
});

test("Lublin, PL expands to Lublin, Poland", () => {
  assert.equal(normalizeLocation("Lublin, PL"), "Lublin, Poland");
});

test("Sławinek, Lublin, PL expands country only", () => {
  assert.equal(normalizeLocation("Sławinek, Lublin, PL"), "Sławinek, Lublin, Poland");
});

test("Sławinek, Lublin, Poland is already normalized", () => {
  assert.equal(normalizeLocation("Sławinek, Lublin, Poland"), "Sławinek, Lublin, Poland");
});

test("empty and undefined become empty string", () => {
  assert.equal(normalizeLocation(""), "");
  assert.equal(normalizeLocation("   "), "");
  assert.equal(normalizeLocation(undefined), "");
  assert.equal(normalizeLocation(null), "");
});

test("whitespace and comma spacing are normalized", () => {
  assert.equal(normalizeLocation("  Lublin ,   PL  "), "Lublin, Poland");
  assert.equal(normalizeLocation("Sławinek,Lublin,pl"), "Sławinek, Lublin, Poland");
});

test("locality names with diacritics are preserved", () => {
  assert.equal(normalizeLocation("Sławinek, Lublin"), "Sławinek, Lublin");
});

test("distinct localities in the same city stay distinct", () => {
  assert.equal(locationsMatch("Sławinek, Lublin", "Wrotków, Lublin"), false);
  assert.equal(locationsMatch("Sławinek, Lublin, PL", "Sławinek, Lublin, Poland"), true);
  assert.equal(locationsMatch("Lublin, Poland", "Sławinek, Lublin, Poland"), false);
});

test("lowercase country code still expands", () => {
  assert.equal(normalizeLocation("Lublin, pl"), "Lublin, Poland");
});
