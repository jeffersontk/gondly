#!/usr/bin/env bash
set -Eeuo pipefail

# Run after update-vps.sh all: the API image must contain the current starter.json.
REPO_DIR="${GONDLY_REPO_DIR:-/opt/gondly/monorepo}"
PRODUCTION_DIR="${GONDLY_PRODUCTION_DIR:-/opt/gondly/production}"
PROJECT="${GONDLY_COMPOSE_PROJECT:-gondly-prod}"
case "${1:-write}" in
  write) import_args=(--write) ;;
  check) import_args=() ;;
  *) echo "Uso: bash scripts/import-starter-recipes-vps.sh [write|check]" >&2; exit 1 ;;
esac
if (( $# > 1 )); then echo "Informe apenas write ou check." >&2; exit 1; fi
for command in git docker flock; do
  command -v "$command" >/dev/null || { echo "Comando ausente: $command" >&2; exit 1; }
done
cd "$REPO_DIR"
exec 9>"$(git rev-parse --git-path gondly-deploy.lock)"
flock -n 9 || { echo "Outro deploy ou importação está em execução." >&2; exit 1; }
compose=(docker compose --project-directory "$PRODUCTION_DIR" -p "$PROJECT"
  -f "$PRODUCTION_DIR/compose.yml" -f "$PRODUCTION_DIR/compose.apps.yml")
if [[ -f "$REPO_DIR/deploy/compose.seo.yml" ]]; then compose+=(-f "$REPO_DIR/deploy/compose.seo.yml"); fi
"${compose[@]}" config --quiet
echo "Validando catálogo inicial na imagem da API..."
"${compose[@]}" run --rm --no-deps --workdir /app/apps/api --entrypoint node api \
  scripts/import-recipes.mjs prisma/recipes/starter.json
if (( ${#import_args[@]} )); then
  echo "Cadastrando receitas do catálogo inicial em transação; receitas de usuários são preservadas..."
  "${compose[@]}" run --rm --no-deps --workdir /app/apps/api --entrypoint node api \
    scripts/import-recipes.mjs prisma/recipes/starter.json "${import_args[@]}"
  echo "Catálogo cadastrado. A reexecução atualiza os mesmos slugs, sem duplicar receitas."
fi
