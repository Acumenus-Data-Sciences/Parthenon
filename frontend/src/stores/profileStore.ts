import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentProfile {
  personId: number;
  sourceId: number;
  sourceName: string;
  gender: string;
  yearOfBirth: number;
  viewedAt: number; // epoch ms
}

const MAX_RECENT = 15;

interface ProfileState {
  recentProfiles: RecentProfile[];
  addRecentProfile: (profile: Omit<RecentProfile, "viewedAt">) => void;
  clearRecentProfiles: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      recentProfiles: [],
      addRecentProfile: (profile) =>
        set((state) => {
          // Remove duplicate (same personId + sourceId)
          const filtered = state.recentProfiles.filter(
            (p) =>
              !(p.personId === profile.personId && p.sourceId === profile.sourceId),
          );
          // Prepend new entry
          const updated = [
            { ...profile, viewedAt: Date.now() },
            ...filtered,
          ].slice(0, MAX_RECENT);
          return { recentProfiles: updated };
        }),
      clearRecentProfiles: () => set({ recentProfiles: [] }),
    }),
    { name: "parthenon-recent-profiles" },
  ),
);
