import {AppMode, Modes} from './constants';
import {getState, setState} from './state';

interface Checkpoint {
  version: 1;
  dataset: string;
  yesCount: number;
  noCount: number;
  word: string | null;
  trainingQuestion: string | null;
  guideDismissals: string[];
  /** Stage to resume at; older saves without it resume at training. */
  stage?: number;
}

/**
 * Stages a student can resume at.  Results (Pond) resume at the Run step,
 * since its predictions are rebuilt from the restored model.
 */
const RESUME_STAGE: Record<number, number> = {
  [Modes.Words]: Modes.Words,
  [Modes.Training]: Modes.Training,
  [Modes.Predicting]: Modes.Predicting,
  [Modes.Pond]: Modes.Predicting,
};

export type SaveStatus =
  | 'disabled'
  | 'ready'
  | 'saved'
  | 'restored'
  | 'unavailable';
let key: string | undefined;
let pending: Checkpoint | undefined;
let signature = '';
/** Last stage saved, kept while loading screens are showing. */
let lastStage: number | undefined;
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
  lastStage = undefined;
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
    // An unknown stage is not worth discarding the training for.
    if (saved.stage !== undefined && !(saved.stage in RESUME_STAGE)) {
      delete saved.stage;
    }
    lastStage = saved.stage;
    pending = saved;
  } catch {
    notify('unavailable');
  }
}

export const hasSavedTraining = (): boolean => !!pending;

/** Where a restored student should resume, if a save recorded it. */
export const savedStage = (): number | undefined =>
  pending?.stage === undefined ? undefined : RESUME_STAGE[pending.stage];

/**
 * Restores only which guides were closed.  Used when resuming at the word
 * picker: New Word erases training, so the saved word must not come back.
 */
export function restoreGuidesOnly(): void {
  const saved = pending;
  pending = undefined;
  if (!saved) return;
  setState({guideDismissals: saved.guideDismissals});
  notify('restored');
}

const currentStage = (): number | undefined => {
  const stage = RESUME_STAGE[getState().currentMode ?? -1];
  if (stage !== undefined) lastStage = stage;
  return lastStage;
};

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
      stage: currentStage(),
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
    currentStage(),
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
