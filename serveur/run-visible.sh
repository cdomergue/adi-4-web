#!/usr/bin/env bash
# User-operated window, with the client and server in a private network.
set -euo pipefail
ADI_SERVER_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export WINEPREFIX="$ADI_SERVER_ROOT/runtime/wine"
export WINEDEBUG="${WINEDEBUG:--all}"

if [[ "${1-}" == --inside ]]; then
  ip link set lo up
  export DISPLAY=:99
  unset WAYLAND_DISPLAY
  python3 "$ADI_SERVER_ROOT/server.py" --log "$ADI_SERVER_ROOT/runtime/manual-session.jsonl" > "$ADI_SERVER_ROOT/runtime/manual-server.log" 2>&1 &
  ADI_SERVER_PID=$!
  cleanup() {
    wineserver -k || true
    kill "$ADI_SERVER_PID" 2>/dev/null || true
  }
  trap cleanup EXIT
  trap 'exit 130' INT TERM
  sleep 0.2
  kill -0 "$ADI_SERVER_PID"
  cd "$ADI_SERVER_ROOT/runtime/game"
  wine explorer /desktop=ADI4,1024x768 "$PWD/ADI4.EXE" > ../manual-wine.log 2>&1 &
  ADI_WINE_PID=$!
  wait "$ADI_WINE_PID"
  wineserver -w &
  wait $!
  exit
fi

python3 "$ADI_SERVER_ROOT/prepare.py" --prefill
if [[ -e /tmp/.X99-lock || -S /tmp/.X11-unix/X99 ]]; then
  echo 'Display :99 is already occupied; no existing session was changed.' >&2
  exit 1
fi
Xephyr :99 -screen 1024x768 -title 'ADI421 — serveur local' -nolisten tcp -ac > "$ADI_SERVER_ROOT/runtime/manual-xephyr.log" 2>&1 &
ADI_X_PID=$!
ADI_SESSION_PID=''
cleanup() {
  if [[ -n "$ADI_SESSION_PID" ]]; then
    kill "$ADI_SESSION_PID" 2>/dev/null || true
    wait "$ADI_SESSION_PID" 2>/dev/null || true
  fi
  kill "$ADI_X_PID" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM
for ADI_TRY in {1..50}; do
  [[ ! -S /tmp/.X11-unix/X99 ]] || break
  kill -0 "$ADI_X_PID"
  sleep 0.1
done
unshare --user --map-root-user --net bash "$0" --inside &
ADI_SESSION_PID=$!
printf '%s\n' 'ADI421 visible session started. Close its window to stop the session and server.'
wait -n "$ADI_X_PID" "$ADI_SESSION_PID"
