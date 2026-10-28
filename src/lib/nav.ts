import { can } from "./permissions";

export type NavItem = { href: string; label: string; group?: string; permission?: string };

export const NAV: NavItem[] = [
  { href: "/tableau-de-bord", label: "Tableau de bord" },
  { href: "/rh/organisation", label: "Organisation", group: "Ressources humaines", permission: "rh.read" },
  { href: "/rh/agents", label: "Agents", group: "Ressources humaines", permission: "rh.read" },
  { href: "/rh/fiches", label: "Fiches de poste", group: "Ressources humaines", permission: "rh.read" },
  { href: "/rh/evaluations", label: "Évaluations", group: "Ressources humaines", permission: "eval" },
  { href: "/rh/ma-fiche", label: "Ma fiche de poste", group: "Ressources humaines", permission: "rh.self" },
  { href: "/temps/poste", label: "Poste de travail", group: "Temps de travail", permission: "temps.self" },
  { href: "/temps/journees", label: "Journées", group: "Temps de travail", permission: "temps.read" },
  { href: "/temps/exceptions", label: "Exceptions", group: "Temps de travail", permission: "temps.manage" },
  { href: "/temps/planning", label: "Shifts et travaux", group: "Temps de travail", permission: "temps.manage" },
  { href: "/compta/plan", label: "Plan comptable", group: "Comptabilité", permission: "compta.read" },
  { href: "/compta/saisie", label: "Saisie", group: "Comptabilité", permission: "compta.write" },
  { href: "/compta/journaux", label: "Journaux", group: "Comptabilité", permission: "compta.read" },
  { href: "/compta/grand-livre", label: "Grand livre", group: "Comptabilité", permission: "compta.read" },
  { href: "/compta/balance", label: "Balance", group: "Comptabilité", permission: "compta.read" },
  { href: "/compta/etats", label: "États financiers", group: "Comptabilité", permission: "compta.read" },
  { href: "/compta/tresorerie", label: "Trésorerie", group: "Comptabilité", permission: "compta.read" },
  { href: "/compta/fournisseurs", label: "Fournisseurs", group: "Comptabilité", permission: "compta.read" },
  { href: "/compta/immobilisations", label: "Immobilisations", group: "Comptabilité", permission: "compta.read" },
  { href: "/compta/budgets", label: "Budgets", group: "Comptabilité", permission: "compta.read" },
  { href: "/compta/tableur", label: "Tableur", group: "Comptabilité", permission: "compta.read" },
  { href: "/compta/exports", label: "Exports", group: "Comptabilité", permission: "compta.read" },
  { href: "/paie/conventions", label: "Conventions", group: "Paie", permission: "paie.read" },
  { href: "/paie/periodes", label: "Périodes et bulletins", group: "Paie", permission: "paie.read" },
  { href: "/paie/remontee", label: "Remontée", group: "Paie", permission: "paie.read" },
  { href: "/admin/utilisateurs", label: "Utilisateurs", group: "Administration", permission: "admin" },
  { href: "/admin/parametres", label: "Paramètres", group: "Administration", permission: "admin" },
  { href: "/admin/sauvegarde", label: "Sauvegarde", group: "Administration", permission: "admin" },
  { href: "/documentation", label: "Documentation", group: "Aide" },
  { href: "/compte", label: "Mon accès", group: "Aide" },
];

export function navFor(role: string): NavItem[] {
  return NAV.filter((item) => {
    if (item.permission === "admin") return role === "administrateur";
    if (!item.permission) return true;
    if (item.permission === "rh.self") return can(role, "rh.self") && !can(role, "rh.read");
    return can(role, item.permission);
  });
}
