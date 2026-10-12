#!/bin/sh
# Renders the security headers for the API the bundle was built against.
# An empty VITE_API_URL means the API is served from the app's own origin,
# which 'self' already covers.
set -eu

api_origin=$(printf '%s' "${VITE_API_URL:-}" | sed -E 's#^(https?://[^/]+).*#\1#')

API_ORIGIN="$api_origin" envsubst '${API_ORIGIN}' < "$1" > "$2"
