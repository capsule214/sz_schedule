import { apiArray } from './api';

const TASK_MASTER_STORAGE_KEY = 'sz_schedule_task_master';

function readCachedTasks() {
  try {
    const raw = window.sessionStorage?.getItem(TASK_MASTER_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function writeCachedTasks(tasks) {
  try {
    window.sessionStorage?.setItem(TASK_MASTER_STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // sessionStorage が使えない環境では通常のAPI取得だけで動かす。
  }
}

export async function loadTaskMaster() {
  const cached = readCachedTasks();
  if (cached) return cached;

  const tasks = await apiArray('/task');
  writeCachedTasks(tasks);
  return tasks;
}

export function clearTaskMasterCache() {
  try {
    window.sessionStorage?.removeItem(TASK_MASTER_STORAGE_KEY);
  } catch {
    // noop
  }
}
