import { useState, type FormEvent } from "react";
import type { Channel, ChannelMember } from "../../types";
import { useUpdateChannel, useUpdateNotificationPreference } from "../../api";

interface ChannelSettingsProps {
  channel: Channel;
  currentMember: ChannelMember | undefined;
  slug: string;
}

export function ChannelSettings({ channel, currentMember, slug }: ChannelSettingsProps) {
  const updateChannel = useUpdateChannel();
  const updatePref = useUpdateNotificationPreference();

  const isAdmin = currentMember?.role === "admin" || currentMember?.role === "owner";
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? "");
  const [saved, setSaved] = useState(false);

  function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    updateChannel.mutate(
      { slug, payload: { name, description } },
      { onSuccess: () => setSaved(true) },
    );
  }

  function handlePrefChange(pref: "all" | "mentions" | "none") {
    if (!currentMember) return;
    updatePref.mutate({ slug, memberId: currentMember.id, preference: pref });
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
      {/* Notification Preferences */}
      <div className="rounded-2xl border border-border-default bg-surface-raised p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Notifications</h3>
        <div className="space-y-1">
          {(["all", "mentions", "none"] as const).map((pref) => (
            <button
              key={pref}
              onClick={() => handlePrefChange(pref)}
              className={`flex w-full items-center rounded-xl border px-3 py-2 text-xs transition-colors ${
                currentMember?.notification_preference === pref
                  ? "border-primary/30 bg-primary/15 text-foreground"
                  : "border-border-default text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="capitalize">{pref === "all" ? "All messages" : pref === "mentions" ? "Mentions only" : "Nothing"}</span>
              {currentMember?.notification_preference === pref && (
                <span className="ml-auto text-[10px] text-primary">Active</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Channel Info (admin-editable) */}
      {isAdmin ? (
        <form
          onSubmit={handleSave}
          className="space-y-3 rounded-2xl border border-border-default bg-surface-raised p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
        >
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Channel Settings</h3>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false); }}
              className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
              rows={3}
              className="w-full resize-none rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={updateChannel.isPending}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {updateChannel.isPending ? "Saving..." : "Save"}
            </button>
            {saved && <span className="text-[11px] text-green-400">Saved</span>}
          </div>

          <div className="border-t border-border-default pt-3">
            <p className="text-[11px] text-muted-foreground">
              Type: <span className="text-foreground capitalize">{channel.type}</span>
              {" / "}
              Visibility: <span className="text-foreground capitalize">{channel.visibility}</span>
            </p>
          </div>
        </form>
      ) : (
        <div className="space-y-2 rounded-2xl border border-border-default bg-surface-raised p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Channel Info</h3>
          <p className="text-xs text-muted-foreground">{channel.description || "No description"}</p>
          <p className="text-[11px] text-muted-foreground">
            Type: <span className="capitalize">{channel.type}</span>
            {" / "}
            Visibility: <span className="capitalize">{channel.visibility}</span>
          </p>
        </div>
      )}
    </div>
  );
}
