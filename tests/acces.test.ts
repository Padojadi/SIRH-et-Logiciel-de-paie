import assert from "node:assert/strict";
import test from "node:test";
import { corrigerEncodage } from "../src/lib/query.ts";
import { sessionDoitFinaliser } from "../src/lib/session-flag.ts";
import { signSessionToken } from "../src/lib/session-token.ts";

const secret = "secret-de-test";

test("la session marque la finalisation et un jeton altéré ne passe pas", async () => {
  const ouvert = signSessionToken(7, secret, false);
  const ferme = signSessionToken(7, secret, true);
  assert.equal(await sessionDoitFinaliser(ouvert, secret), false);
  assert.equal(await sessionDoitFinaliser(ferme, secret), true);
  assert.equal(await sessionDoitFinaliser(`${ferme}x`, secret), false);
  assert.equal(await sessionDoitFinaliser(ferme, "autre-secret"), false);
});

test("un message de redirection mal encodé redevient du français", () => {
  assert.equal(corrigerEncodage("Localisation retirÃ©e"), "Localisation retirée");
  assert.equal(corrigerEncodage("Localisation retirée"), "Localisation retirée");
  assert.equal(corrigerEncodage("Compte mis à jour"), "Compte mis à jour");
});
