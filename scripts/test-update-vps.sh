#!/usr/bin/env bash
set -euo pipefail
script="$(cd "$(dirname "$0")" && pwd)/update-vps.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/repo" "$tmp/production"
export GONDLY_REPO_DIR="$tmp/repo" GONDLY_PRODUCTION_DIR="$tmp/production"
export DEPLOY_TEST_LOG="$tmp/commands"
cat > "$tmp/bin/git" <<'SH'
#!/usr/bin/env bash
echo "git $*" >> "$DEPLOY_TEST_LOG"
case "$1" in
  rev-parse) [[ "$2" == --git-path ]] && echo .deploy.lock || echo abc123 ;;
  symbolic-ref) echo fix/shared-purchase ;;
  status) [[ "${TEST_DIRTY:-0}" == 1 ]] && echo ' M file' ;;
  merge) [[ "${TEST_MERGE_FAIL:-0}" == 1 ]] && exit 1 ;;
esac
exit 0
SH
cat > "$tmp/bin/docker" <<'SH'
#!/usr/bin/env bash
echo "docker $*" >> "$DEPLOY_TEST_LOG"
if [[ " $* " == *' build '* && "${TEST_BUILD_FAIL:-0}" == 1 ]]; then exit 1; fi
if [[ " $* " == *' up '* && "${TEST_HEALTH_FAIL:-0}" == 1 ]]; then exit 1; fi
SH
printf '#!/usr/bin/env bash\nexit 0\n' > "$tmp/bin/flock"
chmod +x "$tmp/bin/"*
export PATH="$tmp/bin:$PATH"

bash "$script" > "$tmp/output" 2>&1
grep -q 'build api$' "$DEPLOY_TEST_LOG"
grep -q 'up -d --no-deps --wait --wait-timeout 180 api$' "$DEPLOY_TEST_LOG"
bash "$script" all > "$tmp/output" 2>&1
grep -q 'build api web$' "$DEPLOY_TEST_LOG"
bash "$script" web > "$tmp/output" 2>&1
grep -q 'build web$' "$DEPLOY_TEST_LOG"
mkdir -p "$tmp/repo/deploy"
touch "$tmp/repo/deploy/compose.seo.yml"
bash "$script" web > "$tmp/output" 2>&1
grep -q 'deploy/compose.seo.yml build web$' "$DEPLOY_TEST_LOG"

for failure in TEST_DIRTY TEST_MERGE_FAIL TEST_BUILD_FAIL TEST_HEALTH_FAIL; do
  : > "$DEPLOY_TEST_LOG"
  if env "$failure=1" bash "$script" > "$tmp/output" 2>&1; then
    echo "FAIL: $failure should stop deployment" >&2; exit 1
  fi
  if [[ "$failure" != TEST_HEALTH_FAIL ]]; then
    if grep -q ' up ' "$DEPLOY_TEST_LOG"; then
      echo "FAIL: $failure restarted a container" >&2; exit 1
    fi
  fi
done
if bash "$script" invalid > "$tmp/output" 2>&1; then exit 1; fi
echo 'PASS: api, web, all, local changes, merge failure, build failure, health failure, invalid argument.'
