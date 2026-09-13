#!/usr/bin/env bash
# A private network and an invisible X server: no host pointer/focus access.
set -euo pipefail
ADI_SERVER_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1-}" != --inside ]]; then
  python3 "$ADI_SERVER_ROOT/prepare.py" --prefill
  exec unshare --user --map-root-user --net "$0" --inside
fi
ip link set lo up
export WINEPREFIX="$ADI_SERVER_ROOT/runtime/wine"
export WINEDEBUG="${WINEDEBUG:--all}"
export DISPLAY=:100
# Do not replace, use, or stop an existing display belonging to another task.
if [[ -e /tmp/.X100-lock || -S /tmp/.X11-unix/X100 ]]; then
  echo 'Display :100 is already occupied. Stop the earlier test session first.' >&2
  exit 1
fi
ADI_XVFB="${ADI_XVFB:-$ADI_SERVER_ROOT/runtime/xvfb/usr/bin/Xvfb}"
if [[ ! -x "$ADI_XVFB" ]]; then
  ADI_XVFB="$(command -v Xvfb || true)"
fi
if [[ ! -x "$ADI_XVFB" ]]; then
  echo 'Xvfb is required; see serveur/README.md. No visible-display fallback is used.' >&2
  exit 1
fi
"$ADI_XVFB" :100 -screen 0 1024x768x24 -nolisten tcp -ac > "$ADI_SERVER_ROOT/runtime/xvfb.log" 2>&1 &
ADI_X_PID=$!
ADI_SERVER_PID=''
cleanup() {
  wineserver -k || true
  [[ -z "$ADI_SERVER_PID" ]] || kill "$ADI_SERVER_PID" 2>/dev/null || true
  kill "$ADI_X_PID" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM
for ADI_TRY in {1..50}; do
  [[ ! -S /tmp/.X11-unix/X100 ]] || break
  kill -0 "$ADI_X_PID"
  sleep 0.1
done
python3 "$ADI_SERVER_ROOT/server.py" --log "$ADI_SERVER_ROOT/runtime/session.jsonl" &
ADI_SERVER_PID=$!
cd "$ADI_SERVER_ROOT/runtime/game"
wine explorer /desktop=ADI4,1024x768 "$PWD/ADI4.EXE" > ../wine.log 2>&1 &
printf '%s\n' 'Isolated test ready. Wine has no visible window and no Internet access.'
printf '%s\n' 'Use the test controls documented in serveur/README.md; exit to stop this session.'
bash --noprofile --norc
