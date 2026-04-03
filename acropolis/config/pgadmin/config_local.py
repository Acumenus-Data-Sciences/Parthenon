import os

# Authentication: Authentik OIDC via OAuth2.
# Forward-auth gate preserved as defense-in-depth via Traefik middleware.

X_FRAME_OPTIONS = 'SAMEORIGIN'
PROXY_X_FOR_COUNT = 1
PROXY_X_PROTO_COUNT = 1
PROXY_X_HOST_COUNT = 1

# Authentik OIDC SSO
DOMAIN = os.environ.get("DOMAIN", "acumenus.net")
AUTHENTICATION_SOURCES = ['oauth2', 'internal']
OAUTH2_AUTO_CREATE_USER = True
OAUTH2_CONFIG = [{
    'OAUTH2_NAME': 'authentik',
    'OAUTH2_DISPLAY_NAME': 'Authentik',
    'OAUTH2_CLIENT_ID': os.environ.get('PGADMIN_OAUTH_CLIENT_ID', ''),
    'OAUTH2_CLIENT_SECRET': os.environ.get('PGADMIN_OAUTH_CLIENT_SECRET', ''),
    'OAUTH2_TOKEN_URL': f'https://auth.{DOMAIN}/application/o/token/',
    'OAUTH2_AUTHORIZATION_URL': f'https://auth.{DOMAIN}/application/o/authorize/',
    'OAUTH2_API_BASE_URL': f'https://auth.{DOMAIN}/application/o/',
    'OAUTH2_USERINFO_ENDPOINT': f'https://auth.{DOMAIN}/application/o/userinfo/',
    'OAUTH2_SERVER_METADATA_URL': f'https://auth.{DOMAIN}/application/o/pgadmin-oidc/.well-known/openid-configuration',
    'OAUTH2_SCOPE': 'openid profile email',
    'OAUTH2_ICON': 'fa-key',
    'OAUTH2_BUTTON_COLOR': '#fd4b2d',
}]
