export const ROLES = [
  "administrateur",
  "drh",
  "responsable",
  "agent",
  "comptable",
  "aide_comptable",
  "gestionnaire_paie",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  administrateur: "Administrateur",
  drh: "Direction des ressources humaines",
  responsable: "Responsable d'unité",
  agent: "Agent",
  comptable: "Comptable",
  aide_comptable: "Aide-comptable",
  gestionnaire_paie: "Gestionnaire de paie",
};

const GRANTS: Record<Role, string[]> = {
  administrateur: ["*"],
  drh: ["rh.read", "rh.write", "temps.read", "temps.manage", "temps.self", "eval", "paie.read", "docs"],
  responsable: ["rh.read", "temps.read", "temps.manage", "temps.self", "eval", "docs"],
  agent: ["rh.self", "temps.self", "docs"],
  comptable: ["compta.read", "compta.write", "compta.export", "docs"],
  aide_comptable: ["compta.read", "compta.write", "docs"],
  gestionnaire_paie: ["paie.read", "paie.write", "rh.read", "docs"],
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function can(role: string, permission: string): boolean {
  if (!isRole(role)) return false;
  const grants = GRANTS[role];
  return grants.includes("*") || grants.includes(permission);
}
