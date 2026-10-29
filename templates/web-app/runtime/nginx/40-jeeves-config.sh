#!/bin/sh
# Writes the web app's runtime config when the container starts: /etc/jeeves/config.json.template
# with each ${NAME} replaced by that environment variable, JSON-escaped, into the served files.
# Runs from the nginx image's /docker-entrypoint.d/ (part of @jeeves/web-runtime).
set -eu

template=/etc/jeeves/config.json.template
output=/usr/share/nginx/html/jeeves-config.json
[ -f "$template" ] || exit 0

names=$(grep -o '\${[A-Z_][A-Z0-9_]*}' "$template" | sort -u | sed 's/[${}]//g')
(
  for name in $names; do
    value=$(printenv "$name" || true)
    escaped=$(printf '%s' "$value" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    export "$name=$escaped"
  done
  # Only the template's own variables are substituted.
  envsubst "$(printf '${%s} ' $names)" < "$template" > "$output"
)
echo "$0: wrote $output"
