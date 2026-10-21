import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';

import {localization} from '@code-dot-org/core/plugins/localization';

import {AppMode, ClassType} from '../../../../src/oceans/constants';
import I18n from '../../../../src/oceans/i18n';
import {resetState, setState, getState} from '../../../../src/oceans/state';
import {initFishData} from '../../../../src/utils/fishData';

vi.mock('../../../../src/oceans/models/soundLibrary', () => ({
  default: {playSound: vi.fn(), loadSounds: vi.fn(), injectSoundAPIs: vi.fn()},
}));

describe('train model — onClassifyFish', () => {
  let mockTrainer;

  beforeEach(async () => {
    resetState();
    initFishData();
    mockTrainer = {
      addTrainingExample: vi.fn(),
      train: vi.fn(),
      clearAll: vi.fn(),
      predict: vi.fn().mockResolvedValue({predictedClassId: ClassType.Like}),
    };
    setState({
      appMode: AppMode.FishVTrash,
      trainer: mockTrainer,
      trainingIndex: 0,
      yesCount: 0,
      noCount: 0,
      loadTrashImages: true,
    });
    // generateOcean will be called by onClassifyFish when the training index
    // nears the end of the fish array — ensure a non-empty fish list is ready.
    const {generateOcean} = await import('../../../../src/utils/generateOcean');
    setState({fishData: generateOcean(20, 0, true, false, false)});
  });

  it('calls addTrainingExample with ClassType.Like on yes', async () => {
    const {default: train} = await import(
      '../../../../src/oceans/models/train'
    );
    train.onClassifyFish(true);
    expect(mockTrainer.addTrainingExample).toHaveBeenCalledWith(
      expect.anything(),
      ClassType.Like,
    );
  });

  it('calls addTrainingExample with ClassType.Dislike on no', async () => {
    const {default: train} = await import(
      '../../../../src/oceans/models/train'
    );
    train.onClassifyFish(false);
    expect(mockTrainer.addTrainingExample).toHaveBeenCalledWith(
      expect.anything(),
      ClassType.Dislike,
    );
  });

  it('increments yesCount on yes', async () => {
    const {default: train} = await import(
      '../../../../src/oceans/models/train'
    );
    train.onClassifyFish(true);
    expect(getState().yesCount).toBe(1);
  });

  it('increments noCount on no', async () => {
    const {default: train} = await import(
      '../../../../src/oceans/models/train'
    );
    train.onClassifyFish(false);
    expect(getState().noCount).toBe(1);
  });
});

describe('refreshLocalizedState', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the Spanish abbreviation for the robot label', () => {
    I18n.initI18n();
    vi.spyOn(localization, 'locale', 'get').mockReturnValue('es-419');

    expect(I18n.t('aiAbbreviation')).toBe('IA');
  });

  it('drops cached strings when a translation dictionary is updated', () => {
    I18n.initI18n();
    const translate = vi
      .spyOn(localization, 'translate')
      .mockImplementation(source => source);

    expect(I18n.t('fish')).toBe('Fish');

    translate.mockImplementation(source => `translated:${source}`);
    I18n.clearTranslationCache();

    expect(I18n.t('fish')).toBe('translated:Fish');
  });

  it('refreshes labels and preserves training progress', async () => {
    I18n.initI18n();
    vi.spyOn(localization, 'translate').mockImplementation(source =>
      `translated:${source}`,
    );
    const fishData = [{id: 'fish'}];
    setState({
      appMode: AppMode.FishLong,
      wordKey: 'fun',
      word: 'Fun',
      trainingQuestionKey: 'isThisFish',
      trainingQuestion: 'Is this fish fun?',
      fishData,
      yesCount: 7,
      noCount: 3,
    });

    const {refreshLocalizedState} = await import(
      '../../../../src/oceans/models/train'
    );
    refreshLocalizedState();

    expect(getState().word).toBe('translated:Fun');
    expect(getState().trainingQuestion).toBe(
      'translated:Is this fish translated:fun?',
    );
    expect(getState().fishData).toBe(fishData);
    expect(getState().yesCount).toBe(7);
    expect(getState().noCount).toBe(3);
  });
});
