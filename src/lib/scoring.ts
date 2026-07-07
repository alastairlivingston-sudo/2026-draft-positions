import type { FantasyEventType, Match, Position, RawApiEvent, ScoringValues, SquadAsset } from "@/lib/types";

/** Default scoring values applied when the league is first created. */
export const DEFAULT_SCORING_VALUES: ScoringValues = {
  goal: 4,
  assist: 2,
  cleanSheetDefenderGk: 2,
  yellowCard: -1,
  redCard: -2,
  ownGoal: -2,
  missedPenalty: -1,
  penaltySaved: 4,
  teamWin: 1,
  teamLoss: -1,
  teamScored3Plus: 1,
  teamConceded3Plus: -1,
};

export const TEAM_ONLY_EVENTS: FantasyEventType[] = [
  "team_win",
  "team_loss",
  "team_scored_3plus",
  "team_conceded_3plus",
];

export const PLAYER_ONLY_EVENTS: FantasyEventType[] = [
  "goal",
  "assist",
  "yellow_card",
  "red_card",
  "own_goal",
  "penalty_saved",
  "penalty_missed",
  "clean_sheet",
];

/** All loggable fantasy event types (excludes manual_adjustment, which has its own flow). */
export const LOGGABLE_EVENT_TYPES: FantasyEventType[] = [...PLAYER_ONLY_EVENTS, ...TEAM_ONLY_EVENTS];

/**
 * Event types produced exclusively by `computeMatchResultEvents`, derived
 * purely from a match's final score rather than from a live keyEvents feed.
 * Used to identify and replace stale auto-derived events when a match's
 * reported score changes between polls (see `syncMatches`).
 */
export const RESULT_EVENT_TYPES: FantasyEventType[] = [...TEAM_ONLY_EVENTS, "clean_sheet"];

export const CLEAN_SHEET_POSITIONS: Position[] = ["Goalkeeper", "Defender"];

/**
 * Minimum minutes a player must be on the pitch to qualify for clean
 * sheet points - matches the standard fantasy-football "60 minutes"
 * appearance threshold.
 */
export const CLEAN_SHEET_MIN_MINUTES = 60;

/**
 * Whether a given event type can ever apply to this asset.
 * Team bonuses only apply to asset_type "team"; player events only
 * apply to asset_type "player". manual_adjustment is always eligible.
 */
export function isEventEligible(asset: Pick<SquadAsset, "assetType" | "position">, type: FantasyEventType): boolean {
  if (type === "manual_adjustment") return true;
  if (TEAM_ONLY_EVENTS.includes(type)) return asset.assetType === "team";
  if (PLAYER_ONLY_EVENTS.includes(type)) return asset.assetType === "player";
  return false;
}

/**
 * Computes the points awarded for a fantasy event, given the asset it
 * applies to and the scoring values currently in effect.
 *
 * Returns 0 for events that aren't eligible for this asset (e.g. a
 * team_win event applied to a player row), and for clean sheets
 * awarded to midfielders/strikers.
 */
export function calculateEventPoints(
  type: FantasyEventType,
  asset: Pick<SquadAsset, "assetType" | "position">,
  values: ScoringValues,
): number {
  if (!isEventEligible(asset, type)) return 0;

  switch (type) {
    case "goal":
      return values.goal;
    case "assist":
      return values.assist;
    case "yellow_card":
      return values.yellowCard;
    case "red_card":
      return values.redCard;
    case "own_goal":
      return values.ownGoal;
    case "penalty_saved":
      return values.penaltySaved;
    case "penalty_missed":
      return values.missedPenalty;
    case "clean_sheet":
      return CLEAN_SHEET_POSITIONS.includes(asset.position) ? values.cleanSheetDefenderGk : 0;
    case "team_win":
      return values.teamWin;
    case "team_loss":
      return values.teamLoss;
    case "team_scored_3plus":
      return values.teamScored3Plus;
    case "team_conceded_3plus":
      return values.teamConceded3Plus;
    case "manual_adjustment":
      // Manual adjustments carry an explicit point value set by the admin.
      return 0;
    default:
      return 0;
  }
}

/** Builds the unique dedup hash used to prevent duplicate API events. */
export function buildEventHash(params: {
  fixtureId: string;
  assetId: string;
  minute: number;
  type: FantasyEventType;
  detail: string;
}): string {
  return [params.fixtureId, params.assetId, params.minute, params.type, params.detail].join(":");
}

/**
 * Derives the result-based fantasy events - clean sheets and team
 * win/loss/3-or-more bonuses - for every squad asset whose country
 * played in a completed match. Used to auto-score those bonuses once a
 * live provider reports a final score, without needing any per-asset
 * API ID mapping (matched purely on `SquadAsset.country`).
 *
 * Clean sheet points require the player to have been on the pitch for
 * at least CLEAN_SHEET_MIN_MINUTES without their team conceding while
 * they were on it. This function awards the auto/default case - the
 * team conceded nothing in the whole match, so every qualifying
 * GK/Defender gets it, except those listed in `ineligibleAssetIds`
 * (squad players who either didn't appear in the match at all, or were
 * on the pitch for under CLEAN_SHEET_MIN_MINUTES per the substitution
 * clock - see EspnProvider.getCleanSheetIneligibleAssetIds) or flagged
 * `asset.unavailable` (not in their country's real World Cup squad at
 * all, so absent from provider roster data too - admin-set via the
 * Mapping tab).
 */
export function computeMatchResultEvents(
  match: Match,
  squadAssets: SquadAsset[],
  ineligibleAssetIds?: Set<string>,
): RawApiEvent[] {
  if (match.homeScore === null || match.awayScore === null) return [];

  const sides = [
    { team: match.homeTeam, scored: match.homeScore, conceded: match.awayScore, side: "home" as const },
    { team: match.awayTeam, scored: match.awayScore, conceded: match.homeScore, side: "away" as const },
  ];

  const events: RawApiEvent[] = [];
  for (const side of sides) {
    // A knockout tie level after extra time is decided on penalties; the goal
    // score reads as a draw, so fall back to match.winner to award the win/loss.
    const wonByShootout = side.scored === side.conceded && match.winner === side.side;
    const lostByShootout =
      side.scored === side.conceded && match.winner != null && match.winner !== side.side;
    const won = side.scored > side.conceded || wonByShootout;
    const lost = side.scored < side.conceded || lostByShootout;
    for (const asset of squadAssets.filter((a) => a.country === side.team)) {
      if (asset.assetType === "team") {
        if (won) {
          const detail = wonByShootout
            ? `${side.team} win ${side.scored}-${side.conceded} on penalties`
            : `${side.team} win ${side.scored}-${side.conceded}`;
          events.push({ fixtureId: match.id, assetId: asset.id, type: "team_win", minute: 90, detail });
        } else if (lost) {
          const detail = lostByShootout
            ? `${side.team} lose ${side.scored}-${side.conceded} on penalties`
            : `${side.team} lose ${side.scored}-${side.conceded}`;
          events.push({ fixtureId: match.id, assetId: asset.id, type: "team_loss", minute: 90, detail });
        }
        if (side.scored >= 3) {
          events.push({ fixtureId: match.id, assetId: asset.id, type: "team_scored_3plus", minute: 90, detail: `${side.team} score ${side.scored}` });
        }
        if (side.conceded >= 3) {
          events.push({ fixtureId: match.id, assetId: asset.id, type: "team_conceded_3plus", minute: 90, detail: `${side.team} concede ${side.conceded}` });
        }
      } else if (
        side.conceded === 0 &&
        CLEAN_SHEET_POSITIONS.includes(asset.position) &&
        !asset.unavailable &&
        !ineligibleAssetIds?.has(asset.id)
      ) {
        events.push({ fixtureId: match.id, assetId: asset.id, type: "clean_sheet", minute: 90, detail: `${side.team} keep a clean sheet` });
      }
    }
  }
  return events;
}

export const SCORING_LABELS: Record<keyof ScoringValues, { label: string; description: string; appliesTo: string }> = {
  goal: { label: "Goal", description: "Player scores a goal", appliesTo: "Players" },
  assist: { label: "Assist", description: "Player assists a goal", appliesTo: "Players" },
  cleanSheetDefenderGk: {
    label: "Clean sheet",
    description: "Team doesn't concede while the player is on the pitch (goalkeeper or defender, 60+ mins played)",
    appliesTo: "GK / Defenders",
  },
  yellowCard: { label: "Yellow card", description: "Player is booked", appliesTo: "Players" },
  redCard: { label: "Red card", description: "Player is sent off", appliesTo: "Players" },
  ownGoal: { label: "Own goal", description: "Player scores into their own net", appliesTo: "Players" },
  missedPenalty: {
    label: "Missed penalty",
    description: "Player misses a penalty, including shootouts",
    appliesTo: "Players",
  },
  penaltySaved: {
    label: "Penalty saved",
    description: "Goalkeeper saves a penalty, including shootouts",
    appliesTo: "Players",
  },
  teamWin: { label: "Team win", description: "Team wins the match", appliesTo: "Team rows" },
  teamLoss: { label: "Team loss", description: "Team loses the match", appliesTo: "Team rows" },
  teamScored3Plus: { label: "Scores 3+", description: "Team scores 3 or more goals", appliesTo: "Team rows" },
  teamConceded3Plus: { label: "Concedes 3+", description: "Team concedes 3 or more goals", appliesTo: "Team rows" },
};
