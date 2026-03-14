import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { useAuthStore } from "@/stores/authStore";

// Pusher must be on window for Echo to find it
(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

let echoInstance: Echo | null = null;
let warnedInvalidHost = false;
let warnedMissingKey = false;

function resolveEchoConfig() {
  const rawHost = import.meta.env.VITE_REVERB_HOST ?? window.location.hostname;
  const isLocalhostTarget =
    rawHost === "localhost" || rawHost === "127.0.0.1" || rawHost === "::1";
  const isBrowserLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1";
  const scheme = import.meta.env.VITE_REVERB_SCHEME ?? window.location.protocol.replace(":", "");
  const forceTLS = scheme === "https";

  if (isLocalhostTarget && !isBrowserLocalhost) {
    if (!warnedInvalidHost) {
      warnedInvalidHost = true;
      console.warn(
        `[Echo] Refusing to connect to ${rawHost} from ${window.location.hostname}. Real-time disabled until VITE_REVERB_HOST is configured for this environment.`,
      );
    }
    return null;
  }

  const defaultPort = forceTLS ? 443 : 80;
  const port = Number(import.meta.env.VITE_REVERB_PORT ?? defaultPort);

  return {
    host: rawHost,
    port,
    forceTLS,
  };
}

export function getEcho(): Echo | null {
  if (!echoInstance) {
    const key = import.meta.env.VITE_REVERB_APP_KEY;
    if (!key) {
      if (!warnedMissingKey) {
        warnedMissingKey = true;
        console.warn("[Echo] VITE_REVERB_APP_KEY not set — real-time disabled");
      }
      return null;
    }

    const token = useAuthStore.getState().token ?? "";
    const config = resolveEchoConfig();
    if (!config) {
      return null;
    }

    try {
      echoInstance = new Echo({
        broadcaster: "reverb",
        key,
        wsHost: config.host,
        wsPort: config.port,
        wssPort: config.port,
        forceTLS: config.forceTLS,
        enabledTransports: ["ws", "wss"],
        authEndpoint: "/broadcasting/auth",
        auth: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });
    } catch (err) {
      console.error("[Echo] Failed to initialize:", err);
      return null;
    }
  }
  return echoInstance;
}

/**
 * Disconnect and clear the Echo singleton.
 * Call this on logout so the next login gets a fresh connection with the new token.
 */
export function disconnectEcho(): void {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
  }
}
