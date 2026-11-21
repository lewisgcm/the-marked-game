#!/usr/bin/env bash
# Build game models with headless Blender.
#
#   tools/blender/build.sh                  # every asset
#   tools/blender/build.sh teleport_pad     # one asset
#   tools/blender/build.sh --no-render      # skip preview PNGs
#
# Override the Blender binary with BLENDER=/path/to/blender.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ -z "${BLENDER:-}" ]]; then
	if command -v blender >/dev/null 2>&1; then
		BLENDER="$(command -v blender)"
	elif [[ -x "/Applications/Blender.app/Contents/MacOS/Blender" ]]; then
		BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"
	else
		echo "error: Blender not found. Install it or set BLENDER=/path/to/blender" >&2
		exit 1
	fi
fi

exec "$BLENDER" --background --factory-startup \
	--python "$repo_root/tools/blender/build.py" -- "$@"
