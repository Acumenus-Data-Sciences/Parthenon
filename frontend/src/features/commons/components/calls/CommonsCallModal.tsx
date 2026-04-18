import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("commons");
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
      const message =
        error instanceof Error ? error.message : t("call.modal.permissionDenied");
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
          toast.error(error.message || t("call.modal.joinFailed"));
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
      title={call ? t("call.modal.channelTitle", { slug }) : t("call.modal.channelCall")}
      size="full"
      className="max-w-[min(1280px,96vw)]"
    >
      <div className="h-[78vh] overflow-hidden rounded-2xl border border-border-default bg-surface-base">
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
            <div className="max-w-md rounded-2xl border border-border-default bg-surface-raised px-6 py-5 text-center">
              <p className="text-sm font-medium text-foreground">
                {t("call.modal.allowDevices", {
                  devices:
                    call.call_type === "video"
                      ? t("call.modal.devicesVideo")
                      : t("call.modal.devicesAudio"),
                })}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t("call.modal.permissionMessage")}
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
                  ? t("call.modal.requestAccess")
                  : t("call.modal.enableDevices", {
                      devices:
                        call.call_type === "video"
                          ? t("call.modal.enableDevicesVideo")
                          : t("call.modal.enableDevicesAudio"),
                    })}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-2xl border border-border-default bg-surface-raised px-6 py-5 text-center">
              <p className="text-sm font-medium text-foreground">
                {tokenMutation.isPending
                  ? t("call.modal.joining")
                  : t("call.modal.preparing")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("call.modal.setupMessage")}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
