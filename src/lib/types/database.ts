export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          username: string;
          avatar_url: string | null;
          tier: "free" | "premium";
          aura_points: number;
          is_admin: boolean;
          is_public: boolean;
          is_premium: boolean;
          premium_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          username?: string;
          avatar_url?: string | null;
          tier?: "free" | "premium";
          aura_points?: number;
          is_admin?: boolean;
          is_public?: boolean;
          is_premium?: boolean;
          premium_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          username?: string;
          avatar_url?: string | null;
          tier?: "free" | "premium";
          aura_points?: number;
          is_admin?: boolean;
          is_public?: boolean;
          is_premium?: boolean;
          premium_expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      topics: {
        Row: {
          id: string;
          title: string;
          slug: string;
          category: string[];
          description: string | null;
          cover_image_url: string | null;
          card_image_url: string | null;
          card_video_url: string | null;
          video_url: string | null;
          status: "draft" | "coming_soon" | "active" | "archived";
          creator_id: string;
          view_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          category: string[];
          description?: string | null;
          cover_image_url?: string | null;
          card_image_url?: string | null;
          card_video_url?: string | null;
          video_url?: string | null;
          status?: "draft" | "coming_soon" | "active" | "archived";
          creator_id: string;
          view_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          slug?: string;
          category?: string[];
          description?: string | null;
          cover_image_url?: string | null;
          card_image_url?: string | null;
          card_video_url?: string | null;
          video_url?: string | null;
          status?: "draft" | "coming_soon" | "active" | "archived";
          creator_id?: string;
          view_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      subjects: {
        Row: {
          id: string;
          topic_id: string;
          name: string;
          description: string | null;
          era: string | null;
          stats: Json | null;
          photo_url: string | null;
          link_photo: string | null;
          link_music: string | null;
          link_video: string | null;
          video_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          name: string;
          description?: string | null;
          era?: string | null;
          stats?: Json | null;
          photo_url?: string | null;
          link_photo?: string | null;
          link_music?: string | null;
          link_video?: string | null;
          video_url?: string | null;
          created_at?: string;
        };
        Update: {
          topic_id?: string;
          name?: string;
          description?: string | null;
          era?: string | null;
          stats?: Json | null;
          photo_url?: string | null;
          link_photo?: string | null;
          link_music?: string | null;
          link_video?: string | null;
          video_url?: string | null;
        };
        Relationships: [];
      };
      attributes: {
        Row: {
          id: string;
          topic_id: string;
          name: string;
          description: string | null;
          status: "active" | "suggested" | "voting" | "approved" | "rejected";
          suggested_by: string | null;
          approved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          name: string;
          description?: string | null;
          status?: "active" | "suggested" | "voting" | "approved" | "rejected";
          suggested_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
        };
        Update: {
          topic_id?: string;
          name?: string;
          description?: string | null;
          status?: "active" | "suggested" | "voting" | "approved" | "rejected";
          suggested_by?: string | null;
          approved_at?: string | null;
        };
        Relationships: [];
      };
      user_attribute_ranks: {
        Row: {
          id: string;
          user_id: string;
          topic_id: string;
          attribute_id: string;
          rank_position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id: string;
          attribute_id: string;
          rank_position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          topic_id?: string;
          attribute_id?: string;
          rank_position?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_subject_scores: {
        Row: {
          id: string;
          user_id: string;
          topic_id: string;
          subject_id: string;
          attribute_id: string;
          score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id: string;
          subject_id: string;
          attribute_id: string;
          score: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          topic_id?: string;
          subject_id?: string;
          attribute_id?: string;
          score?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_lists: {
        Row: {
          id: string;
          user_id: string;
          topic_id: string;
          subject_id: string;
          calculated_score: number;
          rank_position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id: string;
          subject_id: string;
          calculated_score: number;
          rank_position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          topic_id?: string;
          subject_id?: string;
          calculated_score?: number;
          rank_position?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      attribute_suggestion_votes: {
        Row: {
          id: string;
          attribute_id: string;
          user_id: string;
          vote_type: "cosign" | "nah";
          created_at: string;
        };
        Insert: {
          id?: string;
          attribute_id: string;
          user_id: string;
          vote_type: "cosign" | "nah";
          created_at?: string;
        };
        Update: {
          attribute_id?: string;
          user_id?: string;
          vote_type?: "cosign" | "nah";
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          user_id: string;
          topic_id: string;
          parent_id: string | null;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id: string;
          parent_id?: string | null;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          topic_id?: string;
          parent_id?: string | null;
          body?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cosigns: {
        Row: {
          id: string;
          user_id: string;
          target_type: string;
          target_id: string;
          vote_type: "cosign" | "nah";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_type: string;
          target_id: string;
          vote_type: "cosign" | "nah";
          created_at?: string;
        };
        Update: {
          user_id?: string;
          target_type?: string;
          target_id?: string;
          vote_type?: "cosign" | "nah";
        };
        Relationships: [];
      };
      aura_transactions: {
        Row: {
          id: string;
          user_id: string;
          source_type: string;
          source_id: string;
          points: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_type: string;
          source_id: string;
          points: number;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          source_type?: string;
          source_id?: string;
          points?: number;
        };
        Relationships: [];
      };
      credit_bundles: {
        Row: {
          id: string;
          name: string;
          credit_amount: number;
          price_cents: number;
          stripe_price_id: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          credit_amount: number;
          price_cents: number;
          stripe_price_id: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          credit_amount?: number;
          price_cents?: number;
          stripe_price_id?: string;
          active?: boolean;
        };
        Relationships: [];
      };
      user_credits: {
        Row: {
          id: string;
          user_id: string;
          balance: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          balance?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          balance?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      credit_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          type: "purchase" | "spend";
          stripe_payment_id: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          type: "purchase" | "spend";
          stripe_payment_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          amount?: number;
          type?: "purchase" | "spend";
          stripe_payment_id?: string | null;
          description?: string | null;
        };
        Relationships: [];
      };
      user_topic_unlocks: {
        Row: {
          id: string;
          user_id: string;
          topic_id: string;
          unlock_type: "result_position" | "additional_subject";
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id: string;
          unlock_type: "result_position" | "additional_subject";
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          topic_id?: string;
          unlock_type?: "result_position" | "additional_subject";
          reference_id?: string | null;
        };
        Relationships: [];
      };
      user_category_preferences: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          category?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          topic_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          topic_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          type?: string;
          title?: string;
          message?: string;
          topic_id?: string | null;
          read?: boolean;
        };
        Relationships: [];
      };
      topic_suggestions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string;
          categories: string[];
          status: string;
          vote_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description: string;
          categories?: string[];
          status?: string;
          vote_count?: number;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          title?: string;
          description?: string;
          categories?: string[];
          status?: string;
          vote_count?: number;
        };
        Relationships: [];
      };
      topic_suggestion_votes: {
        Row: {
          id: string;
          suggestion_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          suggestion_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          suggestion_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          following_id?: string;
        };
        Relationships: [];
      };
      scoring_configs: {
        Row: {
          id: string;
          attribute_count: number;
          weights: Json;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          attribute_count: number;
          weights: Json;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          attribute_count?: number;
          weights?: Json;
          active?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_aura_tier: {
        Args: { points: number };
        Returns: string;
      };
      increment_topic_view: {
        Args: { p_topic_id: string };
        Returns: undefined;
      };
      get_global_rankings: {
        Args: { p_topic_id: string };
        Returns: { subject_id: string; avg_score: number }[];
      };
      notify_new_topic: {
        Args: { p_topic_id: string; p_category: string; p_title: string };
        Returns: undefined;
      };
    };
    Enums: {
      user_tier: "free" | "premium";
      topic_status: "draft" | "coming_soon" | "active" | "archived";
      attribute_status: "active" | "suggested" | "voting" | "approved" | "rejected";
      vote_type: "cosign" | "nah";
      aura_source_type:
        | "list_cosign"
        | "list_nah"
        | "topic_voters"
        | "attribute_approved"
        | "attribute_ranked"
        | "comment_cosign"
        | "comment_nah";
      credit_transaction_type: "purchase" | "spend";
      unlock_type: "result_position" | "additional_subject";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
