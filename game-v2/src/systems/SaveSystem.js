const STORAGE_KEY = 'industrial_trial_v2';

const DEFAULT_SAVE = {
  gamesPlayed: 0,
  bestScore: 0,
  history: [],      // last 10 results
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
  } catch { /* ignore storage errors */ }
}

export function recordResult({ scenarioId, role, country, score, grade, debtChange, difficulty }) {
  const save = loadSave();
  save.gamesPlayed += 1;
  if (score > save.bestScore) save.bestScore = score;

  save.history.unshift({ scenarioId, role, country, score, grade, debtChange, difficulty, date: Date.now() });
  if (save.history.length > 10) save.history.pop();

  saveSave(save);
  return save;
}
