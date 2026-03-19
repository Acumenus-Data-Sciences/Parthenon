"""ParthenonAuthenticator — validates JWTs minted by Laravel."""

import os
import jwt
import time
import requests
from jupyterhub.auth import Authenticator
from jupyterhub.handlers import BaseHandler
from tornado import web

PARTHENON_API_URL = os.environ.get("PARTHENON_API_URL", "http://nginx/api/v1")
HUB_API_KEY = os.environ.get("JUPYTER_HUB_API_KEY", "")


def _post_audit(event: str, user_id: int | None = None, metadata: dict | None = None, ip: str | None = None):
    """Fire-and-forget audit event to Parthenon."""
    try:
        payload = {"event": event, "user_id": user_id, "metadata": metadata or {}}
        requests.post(
            f"{PARTHENON_API_URL}/jupyter/audit",
            json=payload,
            headers={"X-Hub-Api-Key": HUB_API_KEY},
            timeout=5,
        )
    except Exception:
        pass  # Audit failure must not block auth flow


class ParthenonLoginHandler(BaseHandler):
    """Accepts POST with JWT, authenticates, redirects to user server."""

    async def post(self):
        token = self.get_argument("token", default=None)
        if not token:
            raise web.HTTPError(400, "Missing token")

        user = await self.login_user({"token": token})
        if user is None:
            _post_audit("auth.failure", metadata={"reason": "invalid_token"}, ip=self.request.remote_ip)
            raise web.HTTPError(401, "Authentication failed")

        # Log successful auth
        auth_state = await user.get_auth_state() or {}
        _post_audit("auth.login", user_id=auth_state.get("user_id"), metadata={"email": auth_state.get("email", "")}, ip=self.request.remote_ip)

        self.redirect(self.get_next_url(user))


class ParthenonAuthenticator(Authenticator):
    """Validates short-lived JWTs signed by Laravel backend."""

    _consumed_jtis: dict[str, float] = {}

    def get_handlers(self, app):
        return [("/jupyter/hub/login", ParthenonLoginHandler)]

    async def authenticate(self, handler, data):
        token = data.get("token")
        if not token:
            return None

        secret = os.environ.get("JUPYTER_JWT_SECRET", "")
        if not secret:
            self.log.error("JUPYTER_JWT_SECRET not configured")
            return None

        try:
            payload = jwt.decode(token, secret, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            self.log.warning("JWT expired")
            return None
        except jwt.InvalidTokenError as e:
            self.log.warning("JWT invalid: %s", e)
            return None

        # Require jti for replay protection
        jti = payload.get("jti")
        if not jti:
            self.log.warning("JWT missing jti claim")
            return None

        now = time.time()
        # Clean expired jtis (older than 120s)
        self._consumed_jtis = {
            k: v for k, v in self._consumed_jtis.items()
            if now - v < 120
        }
        if jti in self._consumed_jtis:
            self.log.warning("JWT replay attempt: jti=%s", jti)
            return None
        self._consumed_jtis[jti] = now

        user_id = payload.get("sub")
        email = payload.get("email", "")
        roles = payload.get("roles", [])

        if not user_id or not email:
            self.log.warning("JWT missing sub or email")
            return None

        # Use user_id as the JupyterHub username for container naming
        username = f"user-{user_id}"

        return {
            "name": username,
            "auth_state": {
                "user_id": user_id,
                "email": email,
                "roles": roles,
            },
        }
