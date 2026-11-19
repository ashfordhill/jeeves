#!/usr/bin/env bash
set -euo pipefail

source_directory=${1:?Pass the prepared fixture directory}
fixture=${2:?Pass the review fixture name}
probe=${3:?Pass the probe script}
artifacts=${4:?Pass the new artifact directory}
test "$fixture" = qr-combined-review || test "$fixture" = qr-legacy-counter-review
fixture_path="$PWD/field-projects/generator-system/fixtures/$fixture"
test ! -e "$fixture_path"
test ! -e "$artifacts"
mkdir "$fixture_path"
trap 'rm -r -- "$fixture_path"' EXIT
cp -a "$source_directory/." "$fixture_path/"
date -u
node -v
pnpm -v
"$PWD/jeeves-generator/node_modules/.bin/tsx" "$probe" "$artifacts"
date -u
