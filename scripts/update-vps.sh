#!/usr/bin/env bash
set -Eeuo pipefail

# Run as the deploy user. Defaults match the Gondly production VPS.
REPO_DIR="${GONDLY_REPO_DIR:-/opt/gondly/monorepo}"
PRODUCTION_DIR="${GONDLY_PRODUCTION_DIR:-/opt/gondly/production}"
PROJECT="${GONDLY_COMPOSE_PROJECT:-gondly-prod}"

case "${1:-api}" in
  api) services=(api) ;;
  web) services=(web) ;;
  all) services=(api web) ;;
  *) echo "Uso: bash scripts/update-vps.sh [api|web|all]" >&2; exit 1 ;;
esac
if (( $# > 1 )); then
  echo "Informe apenas api, web ou all." >&2
  exit 1
fi

for command in git docker flock; do
  command -v "$command" >/dev/null || { echo "Comando ausente: $command" >&2; exit 1; }
done
cd "$REPO_DIR"
# Prevent two deployments from building/replacing the same images concurrently.
exec 9>"$(git rev-parse --git-path gondly-deploy.lock)"
flock -n 9 || { echo "Outra atualização está em execução." >&2; exit 1; }

compose=(docker compose --project-directory "$PRODUCTION_DIR" -p "$PROJECT"
  -f "$PRODUCTION_DIR/compose.yml" -f "$PRODUCTION_DIR/compose.apps.yml")

on_error() {
  local status=$?
  echo "Atualização interrompida. Confira os erros acima e os logs abaixo." >&2
  "${compose[@]}" logs --tail=60 "${services[@]}" || true
  exit "$status"
}
trap on_error ERR

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Há alterações locais no repositório. Resolva-as antes de atualizar:" >&2
  git status --short
  exit 1
fi
branch="$(git symbolic-ref --quiet --short HEAD)"
echo "Atualizando a branch $branch..."
git fetch origin
git merge --ff-only "origin/$branch"
echo "Commit: $(git rev-parse --short HEAD)"

# The versioned overlay keeps the public Nginx rules in sync with the web build.
if [[ -f "$REPO_DIR/deploy/compose.seo.yml" ]]; then
  compose+=(-f "$REPO_DIR/deploy/compose.seo.yml")
fi
"${compose[@]}" config --quiet
echo "Construindo: ${services[*]}..."
"${compose[@]}" build "${services[@]}"
echo "Atualizando os containers e aguardando a verificação de saúde..."
"${compose[@]}" up -d --no-deps --wait --wait-timeout 180 "${services[@]}"
"${compose[@]}" ps "${services[@]}"
echo "Atualização concluída: ${services[*]}."
