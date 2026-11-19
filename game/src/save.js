// Save / load for Solara Bay: cash, missions completed, best wanted level,
// and the player's last safe position. Stored in localStorage, guarded so a
// broken save never blocks the game.
const SAVE_KEY = 'solara-bay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number(data.cash) || 0,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone : [],
      bestWanted: Number(data.bestWanted) || 0,
      totalEarned: Number(data.totalEarned) || 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      missionsDone: state.missionsDone,
      bestWanted: state.bestWanted,
      totalEarned: state.totalEarned,
    }));
  } catch {
    // Storage full or unavailable: the game keeps running unsaved.
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
