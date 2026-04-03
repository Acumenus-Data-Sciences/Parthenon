import os

X_FRAME_OPTIONS = 'SAMEORIGIN'
PROXY_X_FOR_COUNT = 1
PROXY_X_PROTO_COUNT = 1
PROXY_X_HOST_COUNT = 1

_AUTH_DOMAIN = f"auth.{os.environ.get('DOMAIN', 'acumenus.net')}"

AUTHENTICATION_SOURCES = ['oauth2', 'internal']
OAUTH2_AUTO_CREATE_USER = True
OAUTH2_CONFIG = [
    {
        'OAUTH2_NAME': 'Authentik',
        'OAUTH2_DISPLAY_NAME': 'Authentik SSO',
        'OAUTH2_CLIENT_ID': os.environ.get('AUTHENTIK_PGADMIN_CLIENT_ID', ''),
        'OAUTH2_CLIENT_SECRET': os.environ.get('AUTHENTIK_PGADMIN_CLIENT_SECRET', ''),
        'OAUTH2_TOKEN_URL': f'https://{_AUTH_DOMAIN}/application/o/token/',
        'OAUTH2_AUTHORIZATION_URL': f'https://{_AUTH_DOMAIN}/application/o/authorize/',
        'OAUTH2_API_BASE_URL': f'https://{_AUTH_DOMAIN}/application/o/',
        'OAUTH2_USERINFO_ENDPOINT': f'https://{_AUTH_DOMAIN}/application/o/userinfo/',
        'OAUTH2_SERVER_METADATA_URL': f'https://{_AUTH_DOMAIN}/application/o/pgadmin/.well-known/openid-configuration',
        'OAUTH2_SCOPE': 'openid email profile',
        'OAUTH2_ICON': 'fa-key',
        'OAUTH2_BUTTON_COLOR': '#fd4b2d',
    }
]
