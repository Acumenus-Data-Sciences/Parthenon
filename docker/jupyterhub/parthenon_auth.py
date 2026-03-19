"""ParthenonAuthenticator — validates JWTs minted by Laravel for seamless SSO."""

import os
import jwt
import time
import requests
from jupyterhub.auth import Authenticator
from jupyterhub.handlers import BaseHandler
from tornado import web

PARTHENON_API_URL = os.environ.get("PARTHENON_API_URL", "http://nginx/api/v1")
HUB_API_KEY = os.environ.get("JUPYTER_HUB_API_KEY", "")


def _post_audit(event, user_id=None, metadata=None, ip=None):
    """Fire-and-forget audit event to Parthenon."""
    try:
        requests.post(
            f"{PARTHENON_API_URL}/jupyter/audit",
            json={"event": event, "user_id": user_id, "metadata": metadata or {}},
            headers={"X-Hub-Api-Key": HUB_API_KEY},
            timeout=5,
        )
    except Exception:
        pass


class ParthenonLoginHandler(BaseHandler):
    """Accepts GET with ?token=<jwt>, authenticates, redirects to user server.

    Used as iframe src: /jupyter/hub/parthenon-login?token=<jwt>&next=/jupyter/hub/
    The GET approach avoids XSRF issues that plague POST-based flows in iframes.
    """

    async def get(self):
        token = self.get_argument("token", default=None)
        if not token:
            raise web.HTTPError(400, "Missing token parameter")

        user = await self.login_user({"token": token})
        if user is None:
            _post_audit("auth.failure", metadata={"reason": "invalid_token"}, ip=self.request.remote_ip)
            raise web.HTTPError(401, "Authentication failed")

        auth_state = await user.get_auth_state() or {}
        _post_audit(
            "auth.login",
            user_id=auth_state.get("user_id"),
            metadata={"email": auth_state.get("email", "")},
            ip=self.request.remote_ip,
        )

        next_url = self.get_argument("next", self.get_next_url(user))
        self.redirect(next_url)


class ParthenonAuthenticator(Authenticator):
    """Validates short-lived JWTs signed by Laravel backend."""

    _consumed_jtis: dict[str, float] = {}

    def get_handlers(self, app):
        return [("/parthenon-login", ParthenonLoginHandler)]

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
        # Purge expired jtis
        self._consumed_jtis = {
            k: v for k, v in self._consumed_jtis.items() if now - v < 120
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

        username = f"user-{user_id}"

        return {
            "name": username,
            "auth_state": {
                "user_id": user_id,
                "email": email,
                "roles": roles,
            },
        }
