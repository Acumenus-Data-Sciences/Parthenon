export interface AbbyUserProfile {
  id: number;
  user_id: number;
  research_interests: string[];
  expertise_domains: Record<string, number>;
  interaction_preferences: {
    verbosity?: 'terse' | 'normal' | 'verbose';
    corrections?: string[];
  };
  frequently_used: Record<string, string[]>;
  learned_at: string;
  created_at: string;
  updated_at: string;
}

export interface AbbyProfileResponse {
  data: AbbyUserProfile;
}

export interface AbbyProfileUpdateRequest {
  research_interests?: string[];
  expertise_domains?: Record<string, number>;
  interaction_preferences?: {
    verbosity?: 'terse' | 'normal' | 'verbose';
  };
}
