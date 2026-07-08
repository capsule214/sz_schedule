import { apiArray } from './api';

const TEAM_MASTER_STORAGE_KEY = 'sz_schedule_team_master';

function readCachedTeams() {
  try {
    const raw = window.sessionStorage?.getItem(TEAM_MASTER_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function writeCachedTeams(teams) {
  try {
    window.sessionStorage?.setItem(TEAM_MASTER_STORAGE_KEY, JSON.stringify(teams));
  } catch {
    // sessionStorage が使えない環境では通常のAPI取得だけで動かす。
  }
}

export async function loadTeamMaster() {
  const cached = readCachedTeams();
  if (cached) return cached;

  const teams = await apiArray('/worker/team');
  writeCachedTeams(teams);
  return teams;
}

export function clearTeamMasterCache() {
  try {
    window.sessionStorage?.removeItem(TEAM_MASTER_STORAGE_KEY);
  } catch {
    // noop
  }
}
