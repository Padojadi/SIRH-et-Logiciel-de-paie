import assert from "node:assert/strict";
import test from "node:test";
import { dakarParts } from "../src/lib/dates";
import {
  IDLE_LIMIT_SEC,
  MAX_EXCEPTION_GAP_SEC,
  avisFiche,
  avisUnite,
  buildDayWindows,
  creditHeartbeat,
  statutArrivee,
} from "../src/lib/time-engine";

const settings = {
  debutComptage: "06:00",
  limiteArrivee: "08:00",
  finComptage: "17:00",
  dureeTheoriqueSec: 8 * 3600,
};

function at(iso: string): Date {
  return new Date(`${iso}Z`);
}

test("arrivée standard, shift et shift de nuit", () => {
  const standard = buildDayWindows({ settings, shift: null, planned: [], exception: null });
  assert.equal(statutArrivee(5 * 3600 + 40 * 60, standard), "avant_plage");
  assert.equal(statutArrivee(7 * 3600 + 30 * 60, standard), "a_l_heure");
  assert.equal(statutArrivee(9 * 3600, standard), "retard");

  const soir = buildDayWindows({
    settings,
    shift: { start: "14:00", end: "22:00" },
    planned: [],
    exception: null,
  });
  assert.equal(statutArrivee(13 * 3600 + 50 * 60, soir), "avant_plage");
  assert.equal(statutArrivee(14 * 3600 + 20 * 60, soir), "a_l_heure");
  assert.equal(statutArrivee(17 * 3600, soir), "retard");

  const nuit = buildDayWindows({
    settings,
    shift: { start: "22:00", end: "06:00" },
    planned: [],
    exception: null,
  });
  assert.equal(nuit.crossesMidnight, true);
  assert.equal(statutArrivee(21 * 3600 + 30 * 60, nuit), "avant_plage");
  assert.equal(statutArrivee(22 * 3600 + 15 * 60, nuit), "a_l_heure");
  assert.equal(statutArrivee(23 * 3600 + 30 * 60, nuit), "a_l_heure");
  assert.equal(statutArrivee(30 * 60, nuit), "retard");
});

test("le compteur crédite la présence, bloque après deux minutes et reprend avec une exception", () => {
  const day = buildDayWindows({ settings, shift: null, planned: [], exception: null });
  const first = creditHeartbeat({
    lastBeat: null,
    now: at("2026-10-28T07:30:00"),
    active: true,
    idleLimitSec: IDLE_LIMIT_SEC,
    windows: day.windows,
    ignoreIdle: false,
    maxIdleCreditSec: MAX_EXCEPTION_GAP_SEC,
  });
  assert.equal(first.seconds, 0);

  const active = creditHeartbeat({
    lastBeat: at("2026-10-28T07:30:00"),
    now: at("2026-10-28T07:30:15"),
    active: true,
    idleLimitSec: IDLE_LIMIT_SEC,
    windows: day.windows,
    ignoreIdle: false,
    maxIdleCreditSec: MAX_EXCEPTION_GAP_SEC,
  });
  assert.equal(active.seconds, 15);

  const idle = creditHeartbeat({
    lastBeat: at("2026-10-28T09:00:00"),
    now: at("2026-10-28T09:03:00"),
    active: false,
    idleLimitSec: IDLE_LIMIT_SEC,
    windows: day.windows,
    ignoreIdle: false,
    maxIdleCreditSec: MAX_EXCEPTION_GAP_SEC,
  });
  assert.equal(idle.motif, "inactivite");
  assert.equal(idle.seconds, 0);

  const late = creditHeartbeat({
    lastBeat: at("2026-10-28T17:00:00"),
    now: at("2026-10-28T17:00:20"),
    active: true,
    idleLimitSec: IDLE_LIMIT_SEC,
    windows: day.windows,
    ignoreIdle: false,
    maxIdleCreditSec: MAX_EXCEPTION_GAP_SEC,
  });
  assert.equal(late.motif, "hors_plage");

  const withException = buildDayWindows({
    settings,
    shift: null,
    planned: [],
    exception: { heureDebut: "17:00", heureFin: "19:00", horsPlage: true },
  });
  const mission = creditHeartbeat({
    lastBeat: at("2026-10-28T17:10:00"),
    now: at("2026-10-28T17:25:00"),
    active: false,
    idleLimitSec: IDLE_LIMIT_SEC,
    windows: withException.windows,
    ignoreIdle: true,
    maxIdleCreditSec: MAX_EXCEPTION_GAP_SEC,
  });
  assert.equal(mission.motif, "exception");
  assert.equal(mission.seconds, 15 * 60);
});

test("les recommandations de fiche et d'unité suivent la charge et la présence", () => {
  assert.equal(
    avisFiche({ minutesPrevues: 420, minutesImputees: 510, secondesPresence: 30600, secondesTheoriques: 28800 }),
    "alleger",
  );
  assert.equal(
    avisFiche({ minutesPrevues: 420, minutesImputees: 240, secondesPresence: 27000, secondesTheoriques: 28800 }),
    "alourdir",
  );
  assert.equal(
    avisFiche({ minutesPrevues: 420, minutesImputees: 120, secondesPresence: 14400, secondesTheoriques: 28800 }),
    "assiduite",
  );
  assert.equal(avisUnite(["alleger", "alleger", "equilibree", "equilibree"]), "recruter");
  assert.equal(avisUnite(["alleger", "alourdir", "equilibree", "equilibree"]), "reaffecter");
  assert.equal(avisUnite(["equilibree", "assiduite"]), "effectif_suffisant");
});

test("l'horloge de Dakar est utilisée pour le jour ouvré", () => {
  const parts = dakarParts(new Date("2026-10-28T07:30:00Z"));
  assert.equal(parts.date, "2026-10-28");
  assert.equal(parts.seconds, 7 * 3600 + 30 * 60);
});
