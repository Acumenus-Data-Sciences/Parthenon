import os

# Authentication: Authentik forward auth via Traefik middleware.
# No native OAuth2 — pgAdmin uses its own admin login after the SSO gate.

X_FRAME_OPTIONS = 'SAMEORIGIN'
PROXY_X_FOR_COUNT = 1
PROXY_X_PROTO_COUNT = 1
PROXY_X_HOST_COUNT = 1
