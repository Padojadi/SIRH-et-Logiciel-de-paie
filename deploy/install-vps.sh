#!/usr/bin/env bash
# Installation Docker + Caddy, pour un serveur dont les ports 80 et 443 sont libres.
# Ne pas l'exécuter sur le VPS 195.110.35.45 : nginx, certbot et PM2 y servent
# déjà SIGRHPC.2ticglobal.com (voir le README, section Déploiement).
set -euo pipefail

DOMAIN="SIGRHPC.2ticglobal.com"
INSTALL_DIR="/opt/sigrhpc"
REPO="https://github.com/Padojadi/SIRH-et-Logiciel-de-paie.git"
BRANCH="cursor/logiciel-grh-compta-paie-bc90"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Exécutez ce script en root sur le VPS."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git openssl

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

if ss -ltn | awk '{print $4}' | grep -Eq ':(80|443)$'; then
  echo "Les ports 80 ou 443 sont déjà pris. Le certificat de ${DOMAIN} a besoin de ces deux ports."
  exit 1
fi

if [[ ! -d "${INSTALL_DIR}/.git" ]]; then
  git clone --branch "${BRANCH}" "${REPO}" "${INSTALL_DIR}"
else
  git -C "${INSTALL_DIR}" fetch origin "${BRANCH}"
  git -C "${INSTALL_DIR}" checkout "${BRANCH}"
  git -C "${INSTALL_DIR}" pull --ff-only origin "${BRANCH}"
fi

if [[ ! -f "${INSTALL_DIR}/.env" ]]; then
  umask 077
  printf 'SESSION_SECRET=%s\n' "$(openssl rand -hex 32)" > "${INSTALL_DIR}/.env"
fi
chmod 600 "${INSTALL_DIR}/.env"

cd "${INSTALL_DIR}"
docker compose up -d --build
docker compose ps
echo "Cauris répondra sur https://${DOMAIN} dès que le certificat est émis."
