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

  useEffect(() => {
    if (!open || !call) return;

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
  }, [open, slug, call]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) {
      setToken(undefined);
      setServerUrl(undefined);
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
      <div className="h-[78vh] overflow-hidden rounded-2xl border border-[#232328] bg-[#0f1014]">
        {call && token && serverUrl ? (
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
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-2xl border border-[#25252b] bg-[#151518] px-6 py-5 text-center">
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
