#!/bin/sh
# Dedicated test VPS only, new private source/storage/network. No app env/accounts,
# listening ports, daemon settings, image pulls, serving, production or deployment.
set -eu
panel_lab_root=$(readlink -f "${1:?New /tmp panel lab directory required}")
panel_node_image=${2:?Pinned already-cached Node image required}
panel_memory=${3:-512m}
case "$panel_memory" in
    512m) panel_heap=384 ;;
    1g)
        # One explicitly authorized run, and only with >=2 GiB available on host.
        panel_available_kib=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
        test "${panel_available_kib:-0}" -ge 2097152
        panel_heap=768
        ;;
    *) exit 2 ;;
esac
test "$(id -u)" = 0
test "$(dirname "$panel_lab_root")" = /tmp
case "$(basename "$panel_lab_root")" in waflow-v1-panel-lab-*) ;; *) exit 2 ;; esac
printf '%s\n' "$panel_node_image" | grep -Eq '^sha256:[0-9a-f]{64}$'
test -f "$panel_lab_root/source/admin-panel/package-lock.json"
test -f "$panel_lab_root/source/admin-panel/vite.config.js"
test ! -e "$panel_lab_root/stage"
test -z "$(find "$panel_lab_root/source" -name '.env' -o -name '.env.*')"
panel_stage="$panel_lab_root/stage"
mkdir -m 755 "$panel_stage"
cp -R "$panel_lab_root/source/admin-panel/." "$panel_stage/"
test "$(readlink -f "$panel_stage")" = "$panel_lab_root/stage"
chown -R 65534:65534 "$panel_stage"
panel_nonce=$(basename "$panel_lab_root" | tr '[:upper:]' '[:lower:]')
panel_network="$panel_nonce-network"
panel_container="$panel_nonce-build"
panel_network_created=0
panel_cleanup() {
    # Exact freshly-created identities + label checks; never generic Docker cleanup.
    if [ "$(docker inspect --format '{{index .Config.Labels "waflow.test"}}' "$panel_container" 2>/dev/null || true)" = v1-panel-build ]; then
        docker stop --time 5 "$panel_container" >/dev/null 2>&1 || true
    fi
    if [ "$panel_network_created" = 1 ] && [ "$(docker network inspect --format '{{index .Labels "waflow.test"}}' "$panel_network" 2>/dev/null || true)" = v1-panel-build ]; then
        docker network rm "$panel_network" >/dev/null 2>&1 || true
    fi
}
trap panel_cleanup EXIT HUP INT TERM
docker network create --driver bridge --label waflow.test=v1-panel-build "$panel_network" >/dev/null
panel_network_created=1
# Network is only for locked public dependency installation. env -i strips image
# configuration; build mode v1-validation is deliberately NON-DEPLOYABLE, not a
# bypass of the production required-variable guard.
timeout 300s docker run --rm --pull never --name "$panel_container" --label waflow.test=v1-panel-build \
    --network "$panel_network" --read-only --cpus 0.25 --memory "$panel_memory" --memory-swap "$panel_memory" \
    --pids-limit 64 --cap-drop ALL --security-opt no-new-privileges --user 65534:65534 \
    --mount "type=bind,src=$panel_stage,dst=/lab" --tmpfs /tmp:rw,nosuid,size=16m,mode=1777 \
    --workdir /lab --entrypoint sh "$panel_node_image" -c '
        set -eu
        node --version
        before_lock=$(sha256sum package-lock.json)
        before_manifest=$(sha256sum package.json)
        env -i PATH=/usr/local/bin:/usr/bin:/bin NPM_CONFIG_CACHE=/lab/npm-cache NODE_OPTIONS=--max-old-space-size=256 \
            npm ci --include=dev --no-audit --no-fund --loglevel=error
        test "$before_lock" = "$(sha256sum package-lock.json)"
        test "$before_manifest" = "$(sha256sum package.json)"
        env -i PATH=/usr/local/bin:/usr/bin:/bin NODE_OPTIONS="--max-old-space-size=$1" \
            npm run build -- --mode v1-validation
        test -s dist/index.html
        test "$before_lock" = "$(sha256sum package-lock.json)"
        printf "V1_PANEL_VALIDATION_BUILD_PASSED; NON_DEPLOYABLE, not production Docker image or account test\n"
    ' v1-panel-build "$panel_heap"
