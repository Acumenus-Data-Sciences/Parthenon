import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { toast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { useCallToken } from "../../api";
import type { CommonsCall } from "../../types";

interface CommonsCallModalProps {
  open: boolean;
  slug: string;
  call: CommonsCall | null;
  onClose: () => void;
}

export function CommonsCallModal({
  open,
  slug,
  call,
  onClose,
}: CommonsCallModalProps) {
  const tokenMutation = useCallToken();
  const [token, setToken] = useState<string>();
  const [serverUrl, setServerUrl] = useState<string>();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionRequesting, setPermissionRequesting] = useState(false);
  const [permissionError, setPermissionError] = useState<string>();

  async function requestDeviceAccess() {
    if (!call || permissionRequesting) return;

    setPermissionRequesting(true);
    setPermissionError(undefined);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: call.call_type === "video",
      });

      stream.getTracks().forEach((track) => track.stop());
      setPermissionGranted(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Browser access to microphone/camera was denied.";
      setPermissionGranted(false);
      setPermissionError(message);
    } finally {
      setPermissionRequesting(false);
    }
  }

  useEffect(() => {
    if (!open || !call || !permissionGranted) return;

    tokenMutation.mutate(
      { slug },
      {
        onSuccess: (data) => {
          setToken(data.token);
          setServerUrl(data.server_url);
        },
        onError: (error) => {
          setToken(undefined);
          setServerUrl(undefined);
          toast.error(error.message || "Unable to join LiveKit call");
        },
      },
    );
  }, [open, slug, call, permissionGranted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) {
      setToken(undefined);
      setServerUrl(undefined);
      setPermissionGranted(false);
      setPermissionRequesting(false);
      setPermissionError(undefined);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={call ? `#${slug} call` : "Channel call"}
      size="full"
      className="max-w-[min(1280px,96vw)]"
    >
      <div className="h-[78vh] overflow-hidden rounded-2xl border border-border-default bg-[#0f1014]">
        {call && token && serverUrl && permissionGranted ? (
          <LiveKitRoom
            token={token}
            serverUrl={serverUrl}
            connect
            audio
            video={call.call_type === "video"}
            data-lk-theme="default"
            onDisconnected={onClose}
            className="h-full"
          >
            <VideoConference />
            <RoomAudioRenderer />
          </LiveKitRoom>
        ) : call && !permissionGranted ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md rounded-2xl border border-[#25252b] bg-surface-raised px-6 py-5 text-center">
              <p className="text-sm font-medium text-foreground">
                Allow {call.call_type === "video" ? "camera and microphone" : "microphone"} access
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Parthenon needs browser permission before joining this LiveKit call.
              </p>
              {permissionError ? (
                <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {permissionError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={requestDeviceAccess}
                disabled={permissionRequesting}
                className="mt-4 inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {permissionRequesting
                  ? "Requesting access..."
                  : `Enable ${call.call_type === "video" ? "camera & microphone" : "microphone"}`}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-2xl border border-[#25252b] bg-surface-raised px-6 py-5 text-center">
              <p className="text-sm font-medium text-foreground">
                {tokenMutation.isPending ? "Joining call..." : "Preparing room..."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                LiveKit session setup should only take a moment.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
