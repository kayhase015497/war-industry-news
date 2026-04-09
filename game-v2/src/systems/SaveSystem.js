const STORAGE_KEY = 'industrial_trial_v2';

const DEFAULT_SAVE = {
  gamesPlayed: 0,
  bestScore: 0,
  history: [],        // last 10 results
  unlockedScenarios: ['ukraine_2024'],  // first scenario always unlocked
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    return { ...DEFAULT_SAVE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function saveSave(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export function recordResult({ scenarioId, roleId, score, grade, debtChange, difficulty }) {
  const save = loadSave();
  save.gamesPlayed += 1;
  if (score > save.bestScore) save.bestScore = score;

  // Unlock next scenario on score ≥ 35
  if (score >= 35) {
    if (scenarioId === 'ukraine_2024'  && !save.unlockedScenarios.includes('taiwan_strait')) {
      save.unlockedScenarios.push('taiwan_strait');
    }
    if (scenarioId === 'taiwan_strait' && !save.unlockedScenarios.includes('red_sea')) {
      save.unlockedScenarios.push('red_sea');
    }
  }

  save.history.unshift({ scenarioId, roleId, score, grade, debtChange, difficulty, date: Date.now() });
  if (save.history.length > 10) save.history.pop();

  saveSave(save);
  return save;
}
