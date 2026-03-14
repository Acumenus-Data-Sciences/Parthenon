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
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
      {/* Notification Preferences */}
      <div>
        <h3 className="text-xs font-semibold text-foreground mb-2">Notifications</h3>
        <div className="space-y-1">
          {(["all", "mentions", "none"] as const).map((pref) => (
            <button
              key={pref}
              onClick={() => handlePrefChange(pref)}
              className={`flex w-full items-center rounded px-3 py-2 text-xs transition-colors ${
                currentMember?.notification_preference === pref
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
        <form onSubmit={handleSave} className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground">Channel Settings</h3>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false); }}
              className="w-full rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={updateChannel.isPending}
              className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {updateChannel.isPending ? "Saving..." : "Save"}
            </button>
            {saved && <span className="text-[11px] text-green-400">Saved</span>}
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-[11px] text-muted-foreground">
              Type: <span className="text-foreground capitalize">{channel.type}</span>
              {" / "}
              Visibility: <span className="text-foreground capitalize">{channel.visibility}</span>
            </p>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-foreground">Channel Info</h3>
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
