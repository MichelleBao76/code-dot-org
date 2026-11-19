import {AppMode} from './constants';
import {getState, setState} from './state';

interface Checkpoint {
  version: 1;
  dataset: string;
  yesCount: number;
  noCount: number;
  word: string | null;
  trainingQuestion: string | null;
  guideDismissals: string[];
}

export type SaveStatus =
  | 'disabled'
  | 'ready'
  | 'saved'
  | 'restored'
  | 'unavailable';
let key: string | undefined;
let pending: Checkpoint | undefined;
let signature = '';
let timer: ReturnType<typeof setTimeout> | undefined;
let status: SaveStatus = 'disabled';
const listeners = new Set<() => void>();
const MAX_BYTES = 4_000_000;

function notify(next: SaveStatus): void {
  if (status === next) return;
  status = next;
  listeners.forEach(listener => listener());
}

export const getSaveStatus = (): SaveStatus => status;
export const subscribeToSaves = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function configureProgress(progressKey?: string, locale = 'en'): void {
  clearTimeout(timer);
  pending = undefined;
  signature = '';
  const state = getState();
  key =
    progressKey && state.appMode !== AppMode.CreaturesVTrashDemo
      ? `oceans-progress-v1:${JSON.stringify([progressKey, state.appMode, state.guides, locale])}`
      : undefined;
  notify(key ? 'ready' : 'disabled');
  if (!key) return;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    if (raw.length > MAX_BYTES) throw new Error('Checkpoint too large');
    const saved: Checkpoint = JSON.parse(raw);
    if (
      saved.version !== 1 ||
      typeof saved.dataset !== 'string' ||
      !Number.isSafeInteger(saved.yesCount) ||
      saved.yesCount < 0 ||
      !Number.isSafeInteger(saved.noCount) ||
      saved.noCount < 0 ||
      !(saved.word === null || typeof saved.word === 'string') ||
      !(
        saved.trainingQuestion === null ||
        typeof saved.trainingQuestion === 'string'
      ) ||
      !Array.isArray(saved.guideDismissals) ||
      saved.guideDismissals.some(id => typeof id !== 'string')
    )
      throw new Error('Invalid checkpoint');
    pending = saved;
  } catch {
    notify('unavailable');
  }
}

export const hasSavedTraining = (): boolean => !!pending;

export function restoreProgress(): void {
  const saved = pending;
  pending = undefined;
  if (!saved) return;
  try {
    getState().trainer!.loadDatasetJSON(saved.dataset);
    setState({
      yesCount: saved.yesCount,
      noCount: saved.noCount,
      word: saved.word,
      trainingQuestion: saved.trainingQuestion,
      guideDismissals: saved.guideDismissals,
    });
    notify('restored');
  } catch {
    notify('unavailable');
  }
}

export function saveProgress(): void {
  clearTimeout(timer);
  const state = getState();
  if (!key || pending || !state.trainer) return;
  try {
    const saved: Checkpoint = {
      version: 1,
      dataset: state.trainer.getDatasetJSON(),
      yesCount: state.yesCount,
      noCount: state.noCount,
      word: state.word,
      trainingQuestion: state.trainingQuestion,
      guideDismissals: state.guideDismissals,
    };
    const json = JSON.stringify(saved);
    if (json.length > MAX_BYTES) throw new Error('Checkpoint too large');
    localStorage.setItem(key, json);
    notify('saved');
  } catch {
    notify('unavailable');
  }
}

export function scheduleProgressSave(): void {
  const state = getState();
  if (!key || pending || !state.trainer) return;
  const next = JSON.stringify([
    state.yesCount,
    state.noCount,
    state.word,
    state.guideDismissals,
  ]);
  if (next === signature) return;
  signature = next;
  clearTimeout(timer);
  timer = setTimeout(saveProgress, 300);
}

export function stopProgress(): void {
  saveProgress();
  clearTimeout(timer);
  key = undefined;
  pending = undefined;
}
