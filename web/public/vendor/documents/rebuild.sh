#!/usr/bin/env bash
set -euo pipefail
# Arguments: pristine ScummVM 2.9.0 source directory, activated emsdk 4.0.10 directory.
if [[ $# != 2 ]]; then
  echo "Usage: bash rebuild.sh /path/to/scummvm-2.9.0 /path/to/emsdk" >&2
  exit 2
fi
vendor_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source_dir=$(cd -- "$1" && pwd)
sdk_dir=$(cd -- "$2" && pwd)
source "$sdk_dir/emsdk_env.sh"
cp "$vendor_dir"/source/engines/gob/* "$source_dir/engines/gob/"
cd "$source_dir"
./configure --host=wasm32-unknown-emscripten --build=wasm32-unknown-emscripten \
  --disable-all-engines --enable-engine=gob --disable-detection-full \
  --disable-debug --enable-release --disable-opengl-game --disable-fluidsynth \
  --disable-mt32emu --disable-sdlnet --disable-libcurl --enable-zlib
printf '\nLDFLAGS += -sEXPORTED_RUNTIME_METHODS=FS,IDBFS,callMain -lidbfs.js\n' >> config.mk
make -j"${JOBS:-4}"
cp scummvm.js scummvm.wasm "$vendor_dir/"
