import * as tf from '@tensorflow/tfjs';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';

import {AppMode} from '@/oceans/constants';
import {
  configureProgress,
  getSaveStatus,
  hasSavedTraining,
  restoreProgress,
  saveProgress,
  scheduleProgressSave,
  stopProgress,
} from '@/oceans/progress';
import {getState, resetState, setState} from '@/oceans/state';
import KNNTrainer from '@/utils/KNNTrainer';
import SVMTrainer from '@/utils/SVMTrainer';

beforeEach(async () => {
  resetState();
  localStorage.clear();
  await tf.setBackend('cpu');
  setState({appMode: AppMode.FishLong});
});
afterEach(() => {
  stopProgress();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it.each(['svm', 'knn'])(
  'restores %s training and counts after a reload',
  async kind => {
    const create = () =>
      kind === 'svm'
        ? new SVMTrainer<number[]>()
        : new KNNTrainer<number[]>(input => tf.tensor1d(input));
    const trainer = create();
    for (let i = 0; i < 5; i++) {
      trainer.addTrainingExample([1, 0], 0);
      trainer.addTrainingExample([0, 1], 1);
    }
    setState({
      trainer,
      yesCount: 5,
      noCount: 5,
      word: 'angry',
      trainingQuestion: 'Is it angry?',
      guideDismissals: ['intro'],
    });
    configureProgress('student');
    saveProgress();
    expect(getSaveStatus()).toBe('saved');
    resetState();
    setState({appMode: AppMode.FishLong});
    configureProgress('student');
    expect(hasSavedTraining()).toBe(true);
    const restored = create();
    setState({trainer: restored});
    restoreProgress();
    expect(getSaveStatus()).toBe('restored');
    expect(getState()).toMatchObject({
      yesCount: 5,
      noCount: 5,
      word: 'angry',
      guideDismissals: ['intro'],
    });
    restored.train();
    expect((await restored.predict([1, 0])).predictedClassId).toBe(0);
    expect((await restored.predict([0, 1])).predictedClassId).toBe(1);
    if (trainer instanceof KNNTrainer) {
      trainer.dispose();
      (restored as KNNTrainer).dispose();
    }
  },
);

it('coalesces animation updates and saves an erased model', () => {
  vi.useFakeTimers();
  const trainer = new SVMTrainer();
  setState({trainer});
  configureProgress('student');
  const spy = vi.spyOn(Storage.prototype, 'setItem');
  for (let frame = 0; frame < 20; frame++) scheduleProgressSave();
  vi.advanceTimersByTime(300);
  expect(spy).toHaveBeenCalledTimes(1);
  trainer.addTrainingExample([1, 0], 0);
  setState({yesCount: 1});
  scheduleProgressSave();
  trainer.clearAll();
  setState({yesCount: 0});
  scheduleProgressSave();
  vi.advanceTimersByTime(300);
  configureProgress('student');
  restoreProgress();
  expect(getState().yesCount).toBe(0);
  expect(trainer.getDatasetJSON()).toBe('[]');
});

it('isolates student slots and activity modes', () => {
  setState({trainer: new SVMTrainer()});
  configureProgress('one');
  saveProgress();
  configureProgress('two');
  expect(hasSavedTraining()).toBe(false);
  setState({appMode: AppMode.FishVTrash});
  configureProgress('one');
  expect(hasSavedTraining()).toBe(false);
});

it('reports blocked storage without stopping the activity', () => {
  setState({trainer: new SVMTrainer()});
  configureProgress('student');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Quota exceeded');
  });
  expect(saveProgress).not.toThrow();
  expect(getSaveStatus()).toBe('unavailable');
});

it('rejects corrupt checkpoints and model data', () => {
  setState({trainer: new SVMTrainer()});
  configureProgress('student');
  saveProgress();
  const key = localStorage.key(0)!;
  localStorage.setItem(key, '{bad json');
  configureProgress('student');
  expect(hasSavedTraining()).toBe(false);
  expect(getSaveStatus()).toBe('unavailable');
  expect(() =>
    new SVMTrainer().loadDatasetJSON('[{"label":1,"example":[null]}]'),
  ).toThrow();
  expect(() =>
    new KNNTrainer().loadDatasetJSON('{"0":{"shape":[2,2],"data":[1]}}'),
  ).toThrow();
});
