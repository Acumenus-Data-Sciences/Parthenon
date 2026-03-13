import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { useAuthStore } from "@/stores/authStore";

// Pusher must be on window for Echo to find it
(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

let echoInstance: Echo | null = null;

export function getEcho(): Echo | null {
  if (!echoInstance) {
    const key = import.meta.env.VITE_REVERB_APP_KEY;
    if (!key) {
      console.warn("[Echo] VITE_REVERB_APP_KEY not set — real-time disabled");
      return null;
    }

    const token = useAuthStore.getState().token ?? "";

    try {
      echoInstance = new Echo({
        broadcaster: "reverb",
        key,
        wsHost: import.meta.env.VITE_REVERB_HOST ?? "localhost",
        wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
        wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
        forceTLS: import.meta.env.VITE_REVERB_SCHEME === "https",
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
