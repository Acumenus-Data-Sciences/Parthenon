import { useAbbyProfile } from '../hooks/useAbbyProfile';

export function AbbyProfilePanel() {
  const { profile, isLoading, error, resetProfile } = useAbbyProfile();

  if (isLoading) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        Loading profile...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-400 text-sm">
        Failed to load profile
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="border-t border-border/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">My Research Profile</h3>
        <button
          onClick={() => resetProfile()}
          className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
        >
          Reset
        </button>
      </div>

      {profile.research_interests.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Research Interests</p>
          <div className="flex flex-wrap gap-1">
            {profile.research_interests.map((interest) => (
              <span
                key={interest}
                className="px-2 py-0.5 text-xs rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}

      {Object.keys(profile.expertise_domains).length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Expertise</p>
          <div className="space-y-1">
            {Object.entries(profile.expertise_domains).map(([domain, level]) => (
              <div key={domain} className="flex items-center gap-2">
                <span className="text-xs text-foreground/80 w-24 truncate">{domain}</span>
                <div className="flex-1 h-1.5 bg-border/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full transition-all"
                    style={{ width: `${(level as number) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {profile.interaction_preferences.verbosity && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Response Style</p>
          <span className="text-xs text-foreground/80">
            {profile.interaction_preferences.verbosity === 'terse' ? 'Concise' :
             profile.interaction_preferences.verbosity === 'verbose' ? 'Detailed' : 'Standard'}
          </span>
        </div>
      )}

      {profile.research_interests.length === 0 &&
       Object.keys(profile.expertise_domains).length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Abby is learning about your research interests. Keep chatting and she will build your profile automatically.
        </p>
      )}
    </div>
  );
}
