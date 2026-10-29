import assert from "node:assert/strict";
import test from "node:test";
import { deciderPresence, descripteurValide, distanceDescripteurs, distanceMetres, type Lieu } from "../src/lib/presence.ts";

function descripteur(valeur: number): number[] {
  return Array.from({ length: 128 }, (_, index) => (index === 0 ? valeur : 0));
}

const siege: Lieu = { nom: "Siège SIGRHCP", latitude: 14.6937, longitude: -17.4441, rayon_metres: 500 };

test("deux descripteurs identiques correspondent, un visage différent non", () => {
  const enregistre = descripteur(0.2);
  assert.equal(distanceDescripteurs(enregistre, descripteur(0.2)), 0);
  const meme = deciderPresence({
    descripteurEnregistre: enregistre,
    descripteurRecu: descripteur(0.2),
    lieux: [siege],
    latitude: 14.6937,
    longitude: -17.4441,
    precision: 20,
  });
  assert.equal(meme.ok, true);
  if (meme.ok) assert.equal(meme.lieu, "Siège SIGRHCP");
  const autre = deciderPresence({
    descripteurEnregistre: enregistre,
    descripteurRecu: descripteur(0.9),
    lieux: [siege],
    latitude: 14.6937,
    longitude: -17.4441,
    precision: 20,
  });
  assert.equal(autre.ok, false);
  if (!autre.ok) assert.match(autre.message, /ne correspond pas/);
});

test("le compteur refuse un poste hors du rayon autorisé", () => {
  const loin = deciderPresence({
    descripteurEnregistre: descripteur(0.1),
    descripteurRecu: descripteur(0.1),
    lieux: [siege],
    latitude: 14.8,
    longitude: -17.2,
    precision: 15,
  });
  assert.equal(loin.ok, false);
  if (!loin.ok) assert.match(loin.message, /en dehors/);
  assert.ok(distanceMetres(14.6937, -17.4441, 14.6937, -17.4441) < 1);
});

test("sans visage enregistré ou sans lieu, le contrôle échoue", () => {
  const sansVisage = deciderPresence({
    descripteurEnregistre: null,
    descripteurRecu: descripteur(0.1),
    lieux: [siege],
    latitude: 14.6937,
    longitude: -17.4441,
    precision: 10,
  });
  assert.equal(sansVisage.ok, false);
  const sansLieu = deciderPresence({
    descripteurEnregistre: descripteur(0.1),
    descripteurRecu: descripteur(0.1),
    lieux: [],
    latitude: 14.6937,
    longitude: -17.4441,
    precision: 10,
  });
  assert.equal(sansLieu.ok, false);
  assert.equal(descripteurValide(descripteur(0.1)), true);
  assert.equal(descripteurValide(descripteur(3)), false);
});
