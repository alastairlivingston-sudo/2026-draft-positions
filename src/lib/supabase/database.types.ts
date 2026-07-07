// Hand-authored types mirroring supabase/schema.sql. Keep in sync with that
// file (and with src/lib/types.ts, which defines the camelCase domain shapes
// these rows get mapped to/from - see mappers.ts).

export interface Database {
  public: {
    Tables: {
      managers: {
        Row: {
          id: string;
          name: string;
          initials: string;
          color: string;
          tagline: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["managers"]["Row"]> &
          Pick<Database["public"]["Tables"]["managers"]["Row"], "id" | "name" | "initials" | "color">;
        Update: Partial<Database["public"]["Tables"]["managers"]["Row"]>;
        Relationships: [];
      };
      squad_assets: {
        Row: {
          id: string;
          manager_id: string;
          slot: number;
          name: string;
          country: string;
          country_code: string;
          position: string;
          asset_type: string;
          unavailable: boolean | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["squad_assets"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["squad_assets"]["Row"],
            "id" | "manager_id" | "slot" | "name" | "country" | "country_code" | "position" | "asset_type"
          >;
        Update: Partial<Database["public"]["Tables"]["squad_assets"]["Row"]>;
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          stage: string;
          home_team: string;
          home_country_code: string;
          away_team: string;
          away_country_code: string;
          kickoff: string;
          status: string;
          home_score: number | null;
          away_score: number | null;
          minute: number | null;
          winner: string | null;
          venue: string;
          locked: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["matches"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["matches"]["Row"],
            "id" | "stage" | "home_team" | "home_country_code" | "away_team" | "away_country_code" | "kickoff" | "status" | "venue"
          >;
        Update: Partial<Database["public"]["Tables"]["matches"]["Row"]>;
        Relationships: [];
      };
      scoring_rules: {
        Row: {
          id: number;
          goal: number;
          assist: number;
          clean_sheet_defender_gk: number;
          yellow_card: number;
          red_card: number;
          own_goal: number;
          missed_penalty: number;
          penalty_saved: number;
          team_win: number;
          team_loss: number;
          team_scored_3plus: number;
          team_conceded_3plus: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["scoring_rules"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["scoring_rules"]["Row"]>;
        Relationships: [];
      };
      fantasy_events: {
        Row: {
          id: string;
          match_id: string | null;
          asset_id: string;
          manager_id: string;
          type: string;
          points: number;
          minute: number | null;
          detail: string | null;
          created_at: string;
          source: string;
          event_hash: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["fantasy_events"]["Row"]> &
          Pick<Database["public"]["Tables"]["fantasy_events"]["Row"], "id" | "asset_id" | "manager_id" | "type" | "points" | "source">;
        Update: Partial<Database["public"]["Tables"]["fantasy_events"]["Row"]>;
        Relationships: [];
      };
      manual_adjustments: {
        Row: {
          id: string;
          manager_id: string;
          asset_id: string | null;
          points: number;
          reason: string;
          created_at: string;
          created_by: string;
        };
        Insert: Partial<Database["public"]["Tables"]["manual_adjustments"]["Row"]> &
          Pick<Database["public"]["Tables"]["manual_adjustments"]["Row"], "id" | "manager_id" | "points" | "reason" | "created_by">;
        Update: Partial<Database["public"]["Tables"]["manual_adjustments"]["Row"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          action: string;
          actor: string;
          manager_id: string | null;
          manager_name: string | null;
          asset_id: string | null;
          asset_name: string | null;
          old_value: string | null;
          new_value: string | null;
          reason: string | null;
          timestamp: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_log"]["Row"]> &
          Pick<Database["public"]["Tables"]["audit_log"]["Row"], "id" | "action" | "actor">;
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Row"]>;
        Relationships: [];
      };
      api_event_cache: {
        Row: {
          hash: string;
          fixture_id: string;
          processed_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["api_event_cache"]["Row"]> &
          Pick<Database["public"]["Tables"]["api_event_cache"]["Row"], "hash" | "fixture_id">;
        Update: Partial<Database["public"]["Tables"]["api_event_cache"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
