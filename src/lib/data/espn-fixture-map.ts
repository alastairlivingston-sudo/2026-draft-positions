/**
 * Maps SEED_MATCHES ids (src/lib/data/seed.ts) to ESPN's numeric event ids,
 * so src/lib/api/espn-provider.ts can pull live status/scores/events for
 * the right fixture from ESPN's public scoreboard:
 *
 *   https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260720
 *   https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event={id}
 *
 * Covers FIFA World Cup 2026 Group Stage · Matchday 1-3 (m1-m66) - these
 * fixtures and their scoring have been validated, so this map is
 * intentionally left untouched for the knockout rounds.
 *
 * Round of 32 onward isn't pre-mapped here because the matchups aren't
 * known until the group stage concludes. Instead,
 * espn-provider.ts#discoverDynamicMatches scans the wider
 * ESPN_SCOREBOARD_DATE_RANGE below (which already covers the whole
 * tournament) for any fixture not listed in this map that involves a
 * country picked by a squad, and adds it as a new Match automatically -
 * purely additive, it never changes how m1-m66 are synced.
 */
export const ESPN_FIXTURE_ID_MAP: Record<string, number> = {
  // Matchday 1
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
  // Matchday 2
  m23: 760438,
  m24: 760439,
  m25: 760440,
  m26: 760441,
  m27: 760442,
  m28: 760445,
  m29: 760444,
  m30: 760443,
  m31: 760447,
  m32: 760448,
  m33: 760446,
  m34: 760449,
  m35: 760453,
  m36: 760451,
  m37: 760450,
  m38: 760452,
  m39: 760456,
  m40: 760457,
  m41: 760454,
  m42: 760455,
  m43: 760458,
  m44: 760460,
  // Matchday 3
  m45: 760462,
  m46: 760463,
  m47: 760464,
  m48: 760465,
  m49: 760467,
  m50: 760466,
  m51: 760473,
  m52: 760468,
  m53: 760471,
  m54: 760472,
  m55: 760469,
  m56: 760470,
  m57: 760475,
  m58: 760474,
  m59: 760478,
  m60: 760479,
  m61: 760476,
  m62: 760477,
  m63: 760480,
  m64: 760485,
  m65: 760484,
  m66: 760483,
};

/**
 * ESPN scoreboard date range covering the entire tournament (group stage
 * through the final on 2026-07-19, plus a one-day buffer), so
 * espn-provider.ts can both sync ESPN_FIXTURE_ID_MAP's group-stage fixtures
 * and dynamically discover knockout fixtures in a single request.
 */
export const ESPN_SCOREBOARD_DATE_RANGE = "20260611-20260720";
