import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { useAuthStore } from "@/stores/authStore";

// Pusher must be on window for Echo to find it
(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

let echoInstance: Echo | null = null;

export function getEcho(): Echo {
  if (!echoInstance) {
    // Read token directly from Zustand auth store (no localStorage parsing needed)
    const token = useAuthStore.getState().token ?? "";

    echoInstance = new Echo({
      broadcaster: "reverb",
      key: import.meta.env.VITE_REVERB_APP_KEY,
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
