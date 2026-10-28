import assert from "node:assert/strict";
import test from "node:test";
import { SENEGAL_2026, computeBulletin, reductionPourParts } from "../src/lib/payroll-engine";

test("bulletin mensuel de 300 000 FCFA, une part", () => {
  const b = computeBulletin(SENEGAL_2026, { brutMensuel: 300_000, parts: 1 });
  assert.equal(b.lignes.find((l) => l.code === "IPRES")?.retenue, 16_800);
  assert.equal(b.lignes.find((l) => l.code === "IPRES")?.partEmployeur, 25_200);
  assert.equal(b.lignes.find((l) => l.code === "IPM")?.retenue, 5_000);
  assert.equal(b.lignes.find((l) => l.code === "TRIMF")?.retenue, 1_000);
  assert.equal(b.lignes.find((l) => l.code === "IR")?.retenue, 37_950);
  assert.equal(b.baseIr, 2_438_000);
  assert.equal(b.net, 239_250);
  assert.equal(b.chargesPatronales, 45_500);
});

test("la réduction pour deux parts est bornée par le minimum annuel", () => {
  const ir = 455_400;
  const reduction = reductionPourParts(ir, 2, SENEGAL_2026.reductionsParts);
  assert.equal(reduction, 200_000);
  const b = computeBulletin(SENEGAL_2026, { brutMensuel: 300_000, parts: 2 });
  assert.equal(b.lignes.find((l) => l.code === "IR")?.retenue, Math.round((455_400 - 200_000) / 12));
});

test("le régime cadre s'applique au-dessus du plafond général", () => {
  const b = computeBulletin(SENEGAL_2026, { brutMensuel: 500_000, parts: 1 });
  const cadre = b.lignes.find((l) => l.code === "IPRES_CADRE");
  assert.ok(cadre);
  assert.equal(cadre?.base, 68_000);
  assert.equal(cadre?.retenue, Math.round(68_000 * 0.024));
});
