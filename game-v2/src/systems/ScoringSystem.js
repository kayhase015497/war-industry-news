import { GRADES, RESOURCES } from '../constants.js';

/**
 * Calculate score comparing player allocation vs adjusted optimal allocation.
 * Events may have shifted the optimal weights during the game.
 *
 * @param {Object} playerAlloc   - { artillery: n, air_defense: n, ... }
 * @param {Object} baseOptimal   - original optimal from JSON
 * @param {Object[]} appliedEvents - events that triggered during the game
 * @returns {{ score, grade, breakdown, adjustedOptimal, debtMultiplier }}
 */
export function calculateScore(playerAlloc, baseOptimal, appliedEvents = []) {
  const adjusted = applyEventShifts(baseOptimal, appliedEvents);
  const totalOptimal = Object.values(adjusted).reduce((a, b) => a + b, 0);

  // Normalise both allocations to percentages for fair comparison
  const totalPlayer = Object.values(playerAlloc).reduce((a, b) => a + b, 0);

  let totalDeviation = 0;
  const breakdown = {};

  for (const res of RESOURCES) {
    const id = res.id;
    const optPct  = totalOptimal  > 0 ? (adjusted[id]     / totalOptimal)  * 100 : 0;
    const playPct = totalPlayer   > 0 ? (playerAlloc[id]  / totalPlayer)   * 100 : 0;
    const deviation = Math.abs(playPct - optPct);
    totalDeviation += deviation;

    breakdown[id] = {
      player:   playerAlloc[id],
      optimal:  adjusted[id],
      playerPct: Math.round(playPct),
      optPct:    Math.round(optPct),
      deviation: Math.round(deviation),
    };
  }

  // Max possible deviation ≈ 200 (two categories completely swapped), scale to 0-100
  const rawScore = Math.max(0, 100 - totalDeviation * 1.8);
  const score = Math.round(rawScore);

  const gradeInfo = GRADES.find(g => score >= g.min) || GRADES[GRADES.length - 1];

  // How well we did as a multiplier for debt change (0.1 worst → 1.0 best)
  const debtMultiplier = 0.1 + (score / 100) * 0.9;

  return {
    score,
    grade: gradeInfo.grade,
    gradeLabel: gradeInfo.label,
    gradeColor: gradeInfo.color,
    breakdown,
    adjustedOptimal: adjusted,
    debtMultiplier,
  };
}

/**
 * Apply weight shifts from triggered events to the optimal allocation.
 * We add the shifts and re-clamp so no category goes below 0.
 */
function applyEventShifts(baseOptimal, appliedEvents) {
  const result = { ...baseOptimal };

  for (const event of appliedEvents) {
    if (!event.effects) continue;

    const { weightShift, randomShift } = event.effects;

    if (weightShift) {
      for (const [key, delta] of Object.entries(weightShift)) {
        if (key in result) {
          result[key] = Math.max(0, result[key] + delta);
        }
      }
    }

    if (randomShift) {
      // Randomly move 1 point from one category to another
      const keys = Object.keys(result);
      const from = keys[Math.floor(Math.random() * keys.length)];
      const to   = keys[Math.floor(Math.random() * keys.length)];
      if (from !== to && result[from] > 0) {
        result[from] -= 1;
        result[to]   += 1;
      }
    }
  }

  return result;
}

/**
 * Calculate the actual debt change based on score and role's optimal debt change.
 */
export function calculateDebtChange(optimalDebtChange, debtMultiplier) {
  // Good score → debt decreases (negative change means decrease)
  // Poor score → smaller benefit or slightly worse
  const change = optimalDebtChange * debtMultiplier;
  return Math.round(change * 10) / 10;  // 1 decimal place
}
