import { GRADES, RESOURCES } from '../constants.js';

/**
 * Calculate score by comparing player's allocation percentages
 * against the scenario's optimal weight ratios.
 *
 * Matches original game.html formula:
 *   deviation = Σ |playerPct[i] - optimalWeight[i]|
 *   score     = max(0, 100 - deviation × 100)
 *
 * @param {Object} playerAlloc    - { shell: n, drone: n, ... } (absolute points)
 * @param {Object} optimalWeights - { shell: 0.35, drone: 0.25, ... } (ratios sum ≈ 1)
 * @param {Object[]} appliedEvents
 * @returns {{ score, grade, gradeLabel, gradeColor, breakdown, adjustedWeights }}
 */
export function calculateScore(playerAlloc, optimalWeights, appliedEvents = []) {
  const adjusted = applyEventShifts(optimalWeights, appliedEvents);
  normaliseWeights(adjusted); // ensure they sum to 1

  const totalPlayer = Math.max(1, Object.values(playerAlloc).reduce((a, b) => a + b, 0));

  let totalDeviation = 0;
  const breakdown = {};

  for (const res of RESOURCES) {
    const id      = res.id;
    const optW    = adjusted[id] ?? 0;
    const playW   = (playerAlloc[id] ?? 0) / totalPlayer;
    const dev     = Math.abs(playW - optW);
    totalDeviation += dev;

    breakdown[id] = {
      player:    playerAlloc[id] ?? 0,
      playerPct: Math.round(playW * 100),
      optPct:    Math.round(optW  * 100),
      deviation: Math.round(dev   * 100),   // percentage points
    };
  }

  const score     = Math.max(0, Math.round(100 - totalDeviation * 100));
  const gradeInfo = GRADES.find(g => score >= g.min) || GRADES[GRADES.length - 1];

  return {
    score,
    grade:          gradeInfo.grade,
    gradeLabel:     gradeInfo.label,
    gradeColor:     gradeInfo.color,
    breakdown,
    adjustedWeights: adjusted,
  };
}

/**
 * Debt INCREASES when the player performs poorly.
 * Matches original: debtChange = (1 − score/100) × 25 × gdpMult
 *
 * @param {number|null} gdpMult  - null for special cases (Houthi)
 * @param {number}      score    - 0-100
 * @returns {number|null}        - positive = debt increase (bad); null = special case
 */
export function calculateDebtChange(gdpMult, score) {
  if (gdpMult === null) return null;
  return +((1 - score / 100) * 25 * gdpMult).toFixed(1);
}

// ── Helpers ────────────────────────────────────────────────────────

function applyEventShifts(baseWeights, appliedEvents) {
  const result = { ...baseWeights };

  for (const event of appliedEvents) {
    if (!event.effects) continue;
    const { weightShift, randomShift } = event.effects;

    if (weightShift) {
      for (const [k, delta] of Object.entries(weightShift)) {
        if (k in result) result[k] = Math.max(0, result[k] + delta);
      }
    }

    if (randomShift) {
      const keys = Object.keys(result);
      const from = keys[Math.floor(Math.random() * keys.length)];
      let   to   = keys[Math.floor(Math.random() * keys.length)];
      if (from !== to && result[from] >= 0.05) {
        result[from] -= 0.05;
        result[to]   += 0.05;
      }
    }
  }

  return result;
}

/** Re-normalise so weights sum to 1.0 after shifts. */
function normaliseWeights(weights) {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum <= 0) return;
  for (const k of Object.keys(weights)) weights[k] /= sum;
}
