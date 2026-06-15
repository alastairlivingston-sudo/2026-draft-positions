/**
 * Maps SEED_MATCHES ids (src/lib/data/seed.ts) to ESPN's numeric event ids,
 * so src/lib/api/espn-provider.ts can pull live status/scores/events for
 * the right fixture from ESPN's public scoreboard:
 *
 *   https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260618
 *   https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event={id}
 *
 * Covers FIFA World Cup 2026 Group Stage · Matchday 1 only (m1-m22). Add
 * entries here (and to SEED_MATCHES) for later matchdays as they're played.
 */
export const ESPN_FIXTURE_ID_MAP: Record<string, number> = {
  m1: 760415,
  m2: 760414,
  m3: 760416,
  m4: 760417,
  m5: 760420,
  m6: 760419,
  m7: 760418,
  m8: 760421,
  m9: 760422,
  m10: 760425,
  m11: 760423,
  m12: 760424,
  m13: 760428,
  m14: 760426,
  m15: 760429,
  m16: 760427,
  m17: 760432,
  m18: 760430,
  m19: 760433,
  m20: 760431,
  m21: 760437,
  m22: 760434,
};

/** ESPN scoreboard date range covering all fixtures in ESPN_FIXTURE_ID_MAP. */
export const ESPN_SCOREBOARD_DATE_RANGE = "20260611-20260618";
