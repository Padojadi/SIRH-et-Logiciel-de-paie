"use server";

import { redirect } from "next/navigation";
import { changePassword, login, logout, requireUser } from "@/lib/auth";
import {
  creerImmo,
  creerRemise,
  genererDotations,
  importReleve,
  lettrer,
  pointer,
  poster,
  posterGroupees,
  rapprochementAuto,
  saveBudget,
  saveCompte,
  saveFacture,
  saveFournisseur,
  saveSheet,
  toggleCompte,
  validerFacture,
  type EcritureLine,
} from "@/lib/books-store";
import { all, run } from "@/lib/db";
import { isHHMM, isIsoDate, optionalNumber, optionalText, requiredNumber, requiredText } from "@/lib/format";
import { createOrg, saveAgent, saveFiche } from "@/lib/hr-store";
import { hashPassword } from "@/lib/passwords";
import { isRole } from "@/lib/permissions";
import {
  calculerPeriode,
  cloturerPeriode,
  comptabiliserPaie,
  defaultConvention,
  ouvrirPeriode,
  saveConvention,
} from "@/lib/payroll-store";
import { parseTranchesMontant, parseTranchesTaux, type ConventionConfig } from "@/lib/payroll-engine";
import { errorMessage, rethrowIfRedirect } from "@/lib/redirect-error";
import { ajouterLieu, finalisationRequise, retirerLieu } from "@/lib/presence-store";
import { saveSettings } from "@/lib/settings";
import { validateStandardHours } from "@/lib/time-engine";
import {
  assignShift,
  regulariser,
  removePlan,
  saveException,
  savePlan,
  saveShift,
  toggleException,
} from "@/lib/time-store";

function fail(path: string, error: unknown): never {
  rethrowIfRedirect(error);
  redirect(`${path}${path.includes("?") ? "&" : "?"}erreur=${encodeURIComponent(errorMessage(error))}`);
}

export async function connecter(formData: FormData) {
  let user;
  try {
    user = await login(requiredText(formData.get("email"), "L'identifiant"), String(formData.get("mot_de_passe") ?? ""));
  } catch (error) {
    fail("/connexion", error);
  }
  redirect(finalisationRequise(user) ? "/compte" : "/tableau-de-bord");
}

export async function deconnecter() {
  await logout();
  redirect("/connexion");
}

export async function changerMotDePasse(formData: FormData) {
  const user = await requireUser();
  try {
    changePassword(user.id, String(formData.get("actuel") ?? ""), String(formData.get("nouveau") ?? ""));
  } catch (error) {
    fail("/compte", error);
  }
  redirect("/compte?ok=Mot de passe modifié. Enregistrez votre visage pour finaliser l'accès.");
}

export async function creerUnite(formData: FormData) {
  const user = await requireUser("rh.write");
  try {
    createOrg({
      parentId: Number(formData.get("parent")) || null,
      type: requiredText(formData.get("type"), "Le type"),
      code: requiredText(formData.get("code"), "Le code"),
      name: requiredText(formData.get("nom"), "Le nom"),
    }, user.id);
  } catch (error) {
    fail("/rh/organisation", error);
  }
  redirect("/rh/organisation?ok=Unité créée");
}

export async function enregistrerAgent(formData: FormData) {
  const user = await requireUser("rh.write");
  const id = Number(formData.get("id")) || undefined;
  try {
    const agentId = saveAgent({
      id,
      prenom: requiredText(formData.get("prenom"), "Le prénom"),
      nom: requiredText(formData.get("nom"), "Le nom"),
      email: optionalText(formData.get("email")) || null,
      date_embauche: optionalText(formData.get("date_embauche")) || null,
      statut: requiredText(formData.get("statut"), "Le statut"),
      org_unit_id: Number(formData.get("org_unit_id")) || null,
      fiche_id: Number(formData.get("fiche_id")) || null,
      convention_id: Number(formData.get("convention_id")) || null,
      poste: optionalText(formData.get("poste")),
      salaire_base: Math.round(optionalNumber(formData.get("salaire_base"))),
      taux_journalier: Math.round(optionalNumber(formData.get("taux_journalier"))),
      parts_fiscales: optionalNumber(formData.get("parts_fiscales")) || 1,
      trimf_double: formData.get("trimf_double") ? 1 : 0,
      iban: optionalText(formData.get("iban")),
      actif: formData.get("actif") ? 1 : 0,
    }, user.id);
    redirect(`/rh/agents/${agentId}?ok=Agent enregistré`);
  } catch (error) {
    fail(id ? `/rh/agents/${id}` : "/rh/agents/nouveau", error);
  }
}

export async function enregistrerFiche(formData: FormData) {
  const user = await requireUser("rh.write");
  const id = Number(formData.get("id")) || undefined;
  const titles = formData.getAll("tache_titre").map(String);
  const minutes = formData.getAll("tache_minutes").map(String);
  const descriptions = formData.getAll("tache_description").map(String);
  try {
    const ficheId = saveFiche({
      id,
      code: requiredText(formData.get("code"), "Le code"),
      title: requiredText(formData.get("title"), "L'intitulé"),
      orgUnitId: Number(formData.get("org_unit_id")) || null,
      mission: requiredText(formData.get("mission"), "La mission"),
      profil: optionalText(formData.get("profil")),
      status: requiredText(formData.get("status"), "Le statut"),
      taches: titles.map((title, index) => ({
        title,
        description: descriptions[index] ?? "",
        minutes_par_jour: Number(minutes[index] ?? 0),
      })).filter((task) => task.title.trim()),
    }, user.id);
    redirect(`/rh/fiches/${ficheId}?ok=Fiche enregistrée`);
  } catch (error) {
    fail(id ? `/rh/fiches/${id}` : "/rh/fiches/nouvelle", error);
  }
}

export async function enregistrerException(formData: FormData) {
  const user = await requireUser("temps.manage");
  try {
    saveException({
      id: Number(formData.get("id")) || undefined,
      nom: requiredText(formData.get("nom"), "Le nom"),
      motif: requiredText(formData.get("motif"), "Le motif"),
      active: formData.get("active") ? 1 : 0,
      compter_hors_plage: formData.get("compter_hors_plage") ? 1 : 0,
      compter_malgre_inactivite: formData.get("compter_malgre_inactivite") ? 1 : 0,
      portee: requiredText(formData.get("portee"), "La portée"),
      org_unit_id: Number(formData.get("org_unit_id")) || null,
      agent_id: Number(formData.get("agent_id")) || null,
      date_debut: optionalText(formData.get("date_debut")) || null,
      date_fin: optionalText(formData.get("date_fin")) || null,
      heure_debut: optionalText(formData.get("heure_debut")) || null,
      heure_fin: optionalText(formData.get("heure_fin")) || null,
      jours: formData.getAll("jours").map(String).join(","),
      notes: optionalText(formData.get("notes")),
    }, user.id);
  } catch (error) {
    fail("/temps/exceptions", error);
  }
  redirect("/temps/exceptions?ok=Exception enregistrée");
}

export async function basculerException(formData: FormData) {
  const user = await requireUser("temps.manage");
  toggleException(Number(formData.get("id")), user.id);
  redirect("/temps/exceptions?ok=Exception mise à jour");
}

export async function enregistrerShift(formData: FormData) {
  const user = await requireUser("temps.manage");
  const start = requiredText(formData.get("start_time"), "L'heure de début");
  const end = requiredText(formData.get("end_time"), "L'heure de fin");
  if (!isHHMM(start) || !isHHMM(end)) fail("/temps/planning", new Error("Heures de shift invalides."));
  saveShift({
    id: Number(formData.get("id")) || 0,
    name: requiredText(formData.get("name"), "Le nom"),
    start_time: start,
    end_time: end,
    jours: formData.getAll("jours").map(String).join(","),
    org_unit_id: Number(formData.get("org_unit_id")) || null,
  }, user.id);
  redirect("/temps/planning?ok=Shift enregistré");
}

export async function affecterShift(formData: FormData) {
  const user = await requireUser("temps.manage");
  assignShift(Number(formData.get("agent_id")), Number(formData.get("shift_id")), requiredText(formData.get("date_debut"), "La date"), user.id);
  redirect("/temps/planning?ok=Shift affecté");
}

export async function planifierTravail(formData: FormData) {
  const user = await requireUser("temps.manage");
  try {
    savePlan({
      agent_id: Number(formData.get("agent_id")),
      date: requiredText(formData.get("date"), "La date"),
      start_time: requiredText(formData.get("start_time"), "Le début"),
      end_time: requiredText(formData.get("end_time"), "La fin"),
      tache_id: Number(formData.get("tache_id")) || null,
      libelle: requiredText(formData.get("libelle"), "Le libellé"),
    }, user.id);
  } catch (error) {
    fail("/temps/planning", error);
  }
  redirect("/temps/planning?ok=Travail planifié");
}

export async function supprimerPlan(formData: FormData) {
  await requireUser("temps.manage");
  removePlan(Number(formData.get("id")));
  redirect("/temps/planning?ok=Travail retiré");
}

export async function regulariserTemps(formData: FormData) {
  const user = await requireUser("temps.manage");
  try {
    const heures = requiredNumber(formData.get("heures"), "La durée");
    regulariser({
      agentId: Number(formData.get("agent_id")),
      date: requiredText(formData.get("date"), "La date"),
      tacheId: Number(formData.get("tache_id")) || null,
      secondes: Math.round(heures * 3600),
      motif: requiredText(formData.get("motif"), "Le motif"),
    }, user.id);
  } catch (error) {
    fail("/temps/journees", error);
  }
  redirect("/temps/journees?ok=Temps régularisé");
}

export async function enregistrerPiece(formData: FormData) {
  const user = await requireUser("compta.write");
  try {
    const comptes = formData.getAll("compte").map(String);
    const lines: EcritureLine[] = comptes.map((compte, index) => ({
      compte,
      libelle: String(formData.getAll("ligne_libelle")[index] ?? ""),
      debit: optionalNumber(formData.getAll("debit")[index] ?? null),
      credit: optionalNumber(formData.getAll("credit")[index] ?? null),
      analytique: String(formData.getAll("analytique")[index] ?? ""),
    }));
    const id = poster(user, {
      journal: requiredText(formData.get("journal"), "Le journal"),
      piece: requiredText(formData.get("piece"), "La pièce"),
      date: requiredText(formData.get("date"), "La date"),
      libelle: requiredText(formData.get("libelle"), "Le libellé"),
      mode: "piece",
      lines,
    });
    redirect(`/compta/journaux/${id}?ok=Écriture enregistrée`);
  } catch (error) {
    fail("/compta/saisie", error);
  }
}

export async function enregistrerKilometre(formData: FormData) {
  const user = await requireUser("compta.write");
  try {
    const payload = JSON.parse(String(formData.get("payload") ?? "[]")) as (EcritureLine & { journal: string; date: string; piece: string })[];
    const count = posterGroupees(user, payload, "kilometre");
    redirect(`/compta/journaux?ok=${count} pièce(s) enregistrée(s)`);
  } catch (error) {
    fail("/compta/saisie?mode=kilometre", error);
  }
}

export async function enregistrerCompte(formData: FormData) {
  const user = await requireUser("compta.write");
  try {
    saveCompte({
      code: requiredText(formData.get("code"), "Le numéro"),
      libelle: requiredText(formData.get("libelle"), "L'intitulé"),
      nature: requiredText(formData.get("nature"), "La nature"),
      analytique: optionalText(formData.get("analytique")),
    }, user.id);
  } catch (error) {
    fail("/compta/plan", error);
  }
  redirect("/compta/plan?ok=Compte enregistré");
}

export async function basculerCompte(formData: FormData) {
  await requireUser("compta.write");
  toggleCompte(Number(formData.get("id")));
  redirect("/compta/plan?ok=Compte mis à jour");
}

export async function faireLettrage(formData: FormData) {
  const user = await requireUser("compta.write");
  const back = `/compta/grand-livre?compte=${encodeURIComponent(String(formData.get("compte") ?? ""))}`;
  try {
    lettrer(formData.getAll("ligne").map(Number).filter(Boolean), requiredText(formData.get("code"), "Le lettrage"), user.id);
  } catch (error) {
    fail(back, error);
  }
  redirect(`${back}&ok=Lignes lettrées`);
}

export async function importerReleve(formData: FormData) {
  const user = await requireUser("compta.write");
  try {
    const file = formData.get("fichier");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choisissez un fichier OFX, CFONB ou CSV.");
    const count = importReleve(file.name, await file.text(), user.id);
    redirect(`/compta/tresorerie?ok=${count} mouvement(s) importé(s)`);
  } catch (error) {
    fail("/compta/tresorerie", error);
  }
}

export async function pointerLignes(formData: FormData) {
  const user = await requireUser("compta.write");
  try {
    pointer(Number(formData.get("releve")), Number(formData.get("ligne")), user.id);
  } catch (error) {
    fail("/compta/tresorerie", error);
  }
  redirect("/compta/tresorerie?ok=Mouvement pointé");
}

export async function pointerAuto() {
  const user = await requireUser("compta.write");
  const count = rapprochementAuto(user.id);
  redirect(`/compta/tresorerie?ok=${count} rapprochement(s) automatique(s)`);
}

export async function ajouterFournisseur(formData: FormData) {
  const user = await requireUser("compta.write");
  saveFournisseur({
    nom: requiredText(formData.get("nom"), "Le nom"),
    nif: optionalText(formData.get("nif")),
    iban: optionalText(formData.get("iban")),
    compte: optionalText(formData.get("compte")) || "4011",
  }, user.id);
  redirect("/compta/fournisseurs?ok=Fournisseur ajouté");
}

export async function ajouterFacture(formData: FormData) {
  const user = await requireUser("compta.write");
  try {
    saveFacture({
      fournisseurId: Number(formData.get("fournisseur_id")),
      numero: requiredText(formData.get("numero"), "Le numéro"),
      date: requiredText(formData.get("date"), "La date"),
      echeance: optionalText(formData.get("echeance")),
      ht: requiredNumber(formData.get("ht"), "Le montant HT"),
      compte: requiredText(formData.get("compte"), "Le compte de charge"),
    }, user.id);
  } catch (error) {
    fail("/compta/fournisseurs", error);
  }
  redirect("/compta/fournisseurs?ok=Facture brouillon créée");
}

export async function validerFactureAction(formData: FormData) {
  const user = await requireUser("compta.write");
  try {
    validerFacture(Number(formData.get("id")), user);
  } catch (error) {
    fail("/compta/fournisseurs", error);
  }
  redirect("/compta/fournisseurs?ok=Facture validée et comptabilisée");
}

export async function preparerRemise(formData: FormData) {
  const user = await requireUser("compta.write");
  try {
    const id = creerRemise(formData.getAll("facture").map(Number).filter(Boolean), user);
    redirect(`/compta/fournisseurs?ok=Remise ${id} émise`);
  } catch (error) {
    fail("/compta/fournisseurs", error);
  }
}

export async function creerImmobilisation(formData: FormData) {
  const user = await requireUser("compta.write");
  try {
    creerImmo({
      designation: requiredText(formData.get("designation"), "La désignation"),
      date: requiredText(formData.get("date"), "La date"),
      valeur: requiredNumber(formData.get("valeur"), "La valeur"),
      residuelle: optionalNumber(formData.get("residuelle")),
      duree: requiredNumber(formData.get("duree"), "La durée"),
      compteImmo: requiredText(formData.get("compte_immo"), "Le compte d'immobilisation"),
      compteAmort: requiredText(formData.get("compte_amort"), "Le compte d'amortissement"),
      compteDotation: requiredText(formData.get("compte_dotation"), "Le compte de dotation"),
      fournisseur: optionalText(formData.get("fournisseur")),
      reglement: formData.get("reglement") === "banque" ? "banque" : "dette",
    }, user);
  } catch (error) {
    fail("/compta/immobilisations", error);
  }
  redirect("/compta/immobilisations?ok=Immobilisation créée");
}

export async function lancerDotations(formData: FormData) {
  const user = await requireUser("compta.write");
  try {
    const n = genererDotations(requiredText(formData.get("periode"), "La période"), user);
    redirect(`/compta/immobilisations?ok=${n} dotation(s) générée(s)`);
  } catch (error) {
    fail("/compta/immobilisations", error);
  }
}

export async function enregistrerBudget(formData: FormData) {
  const user = await requireUser("compta.write");
  const periode = requiredText(formData.get("periode"), "La période");
  try {
    saveBudget(requiredText(formData.get("compte"), "Le compte"), periode, requiredNumber(formData.get("montant"), "Le montant"), user.id);
  } catch (error) {
    fail(`/compta/budgets?periode=${periode}`, error);
  }
  redirect(`/compta/budgets?periode=${periode}&ok=Budget enregistré`);
}

export async function enregistrerTableur(formData: FormData) {
  const user = await requireUser("compta.write");
  const grid = JSON.parse(String(formData.get("grid") ?? "{}")) as Record<string, string>;
  saveSheet(requiredText(formData.get("nom"), "Le nom"), grid, user.id);
  redirect("/compta/tableur?ok=Feuille enregistrée");
}

export async function enregistrerConvention(formData: FormData) {
  const user = await requireUser("paie.write");
  const id = Number(formData.get("id")) || undefined;
  try {
    const base: ConventionConfig = id
      ? JSON.parse(String(all<{ config_json: string }>("SELECT config_json FROM conventions WHERE id = ?", [id])[0]?.config_json ?? "{}"))
      : defaultConvention();
    base.modeVacataire = formData.get("modeVacataire") === "1";
    base.tauxIpresSalarie = requiredNumber(formData.get("tauxIpresSalarie"), "Taux IPRES") / 100;
    base.tauxIpresEmployeur = requiredNumber(formData.get("tauxIpresEmployeur"), "Taux IPRES employeur") / 100;
    base.plafondIpres = requiredNumber(formData.get("plafondIpres"), "Plafond IPRES");
    base.tauxIpresCadreSalarie = requiredNumber(formData.get("tauxIpresCadreSalarie"), "Taux cadre") / 100;
    base.tauxIpresCadreEmployeur = requiredNumber(formData.get("tauxIpresCadreEmployeur"), "Taux cadre employeur") / 100;
    base.plafondIpresCadre = requiredNumber(formData.get("plafondIpresCadre"), "Plafond cadre");
    base.tauxIpmSalarie = requiredNumber(formData.get("tauxIpmSalarie"), "Taux IPM") / 100;
    base.tauxIpmEmployeur = requiredNumber(formData.get("tauxIpmEmployeur"), "Taux IPM employeur") / 100;
    base.plafondIpm = requiredNumber(formData.get("plafondIpm"), "Plafond IPM");
    base.tauxCssAf = requiredNumber(formData.get("tauxCssAf"), "Taux CSS") / 100;
    base.tauxCssAt = requiredNumber(formData.get("tauxCssAt"), "Taux AT") / 100;
    base.plafondCss = requiredNumber(formData.get("plafondCss"), "Plafond CSS");
    base.tauxCfce = requiredNumber(formData.get("tauxCfce"), "Taux CFCE") / 100;
    base.abattement = requiredNumber(formData.get("abattement"), "Abattement") / 100;
    base.plafondAbattement = requiredNumber(formData.get("plafondAbattement"), "Plafond d'abattement");
    base.ir = parseTranchesTaux(requiredText(formData.get("ir"), "Le barème IR"));
    base.trimf = parseTranchesMontant(requiredText(formData.get("trimf"), "Le barème TRIMF"));
    const saved = saveConvention({
      id,
      name: requiredText(formData.get("name"), "Le nom"),
      description: optionalText(formData.get("description")),
      config: base,
    }, user.id);
    redirect(`/paie/conventions/${saved}?ok=Convention enregistrée`);
  } catch (error) {
    fail(id ? `/paie/conventions/${id}` : "/paie/conventions", error);
  }
}

export async function calculerPaie(formData: FormData) {
  const user = await requireUser("paie.write");
  const mois = requiredText(formData.get("mois"), "Le mois");
  try {
    const ids = formData.getAll("agent_id").map(Number);
    const id = calculerPeriode(mois, ids.map((agentId, index) => ({
      agentId,
      primes: optionalNumber(formData.getAll("primes")[index] ?? null),
      jours: optionalNumber(formData.getAll("jours")[index] ?? null),
      retenues: optionalNumber(formData.getAll("retenues")[index] ?? null),
    })), user.id);
    redirect(`/paie/periodes/${id}?ok=Paie calculée`);
  } catch (error) {
    fail(`/paie/periodes?mois=${mois}`, error);
  }
}

export async function ouvrirMois(formData: FormData) {
  const user = await requireUser("paie.write");
  const id = ouvrirPeriode(requiredText(formData.get("mois"), "Le mois"), user.id);
  redirect(`/paie/periodes/${id}`);
}

export async function comptabiliser(formData: FormData) {
  const user = await requireUser("paie.write");
  const id = Number(formData.get("id"));
  try {
    comptabiliserPaie(id, user);
  } catch (error) {
    fail(`/paie/periodes/${id}`, error);
  }
  redirect(`/paie/periodes/${id}?ok=Paie comptabilisée`);
}

export async function cloturer(formData: FormData) {
  const user = await requireUser("paie.write");
  const id = Number(formData.get("id"));
  cloturerPeriode(id, user.id);
  redirect(`/paie/periodes/${id}?ok=Période clôturée`);
}

export async function creerUtilisateur(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "administrateur") redirect("/tableau-de-bord?erreur=Accès réservé à l'administrateur");
  try {
    const role = requiredText(formData.get("role"), "Le rôle");
    if (!isRole(role)) throw new Error("Rôle inconnu.");
    const password = requiredText(formData.get("mot_de_passe"), "Le mot de passe");
    if (password.length < 10) throw new Error("10 caractères minimum.");
    run("INSERT INTO users (email, password_hash, name, role, agent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
      requiredText(formData.get("email"), "L'identifiant").toLowerCase(),
      hashPassword(password),
      requiredText(formData.get("name"), "Le nom"),
      role,
      Number(formData.get("agent_id")) || null,
      new Date().toISOString(),
    ]);
  } catch (error) {
    fail("/admin/utilisateurs", error);
  }
  redirect("/admin/utilisateurs?ok=Utilisateur créé");
}

export async function enregistrerParametres(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "administrateur") redirect("/tableau-de-bord");
  const debut = requiredText(formData.get("debut_comptage"), "Le début");
  const limite = requiredText(formData.get("limite_arrivee"), "La limite d'arrivée");
  const fin = requiredText(formData.get("fin_comptage"), "La fin");
  try {
    if (!isHHMM(debut) || !isHHMM(limite) || !isHHMM(fin)) throw new Error("Heures invalides.");
    validateStandardHours(debut, limite, fin);
    const debutExercice = requiredText(formData.get("exercice_debut"), "Le début d'exercice");
    const finExercice = requiredText(formData.get("exercice_fin"), "La fin d'exercice");
    if (!isIsoDate(debutExercice) || !isIsoDate(finExercice)) throw new Error("Dates d'exercice invalides.");
    saveSettings({
      organisation: requiredText(formData.get("organisation"), "L'organisation"),
      adresse: optionalText(formData.get("adresse")),
      ville: optionalText(formData.get("ville")),
      nif: optionalText(formData.get("nif")),
      referentiel: requiredText(formData.get("referentiel"), "Le référentiel"),
      debut_comptage: debut,
      limite_arrivee: limite,
      fin_comptage: fin,
      duree_theorique_heures: String(requiredNumber(formData.get("duree_theorique_heures"), "La durée")),
      tva_taux: String(requiredNumber(formData.get("tva_taux"), "La TVA") / 100),
      exercice_debut: debutExercice,
      exercice_fin: finExercice,
      compte_banque: requiredText(formData.get("compte_banque"), "Le compte banque"),
      afficher_comptes_demo: formData.get("afficher_comptes_demo") ? "1" : "0",
    });
  } catch (error) {
    fail("/admin/parametres", error);
  }
  redirect("/admin/parametres?ok=Paramètres enregistrés");
}

export async function ajouterLocalisation(formData: FormData) {
  const user = await requireUser("rh.write");
  const agentId = Number(formData.get("agent_id"));
  const retour = `/rh/agents/${agentId || ""}`;
  try {
    if (!agentId) throw new Error("Agent introuvable.");
    ajouterLieu({
      agentId,
      nom: requiredText(formData.get("nom"), "Le nom du lieu"),
      latitude: requiredNumber(formData.get("latitude"), "La latitude"),
      longitude: requiredNumber(formData.get("longitude"), "La longitude"),
      rayonMetres: requiredNumber(formData.get("rayon"), "Le rayon"),
    }, user.id);
  } catch (error) {
    fail(retour, error);
  }
  redirect(`${retour}?ok=Localisation enregistrée`);
}

export async function retirerLocalisation(formData: FormData) {
  const user = await requireUser("rh.write");
  const agentId = Number(formData.get("agent_id"));
  const retour = `/rh/agents/${agentId || ""}`;
  try {
    retirerLieu(Number(formData.get("id")), agentId, user.id);
  } catch (error) {
    fail(retour, error);
  }
  redirect(`${retour}?ok=Localisation retirée`);
}
