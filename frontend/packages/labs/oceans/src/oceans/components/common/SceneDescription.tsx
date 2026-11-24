import {useLayoutEffect, useRef} from 'react';

import {Modes} from '@/oceans/constants';
import {describeObject} from '@/oceans/describeObject';
import I18n from '@/oceans/i18n';
import type {State} from '@/oceans/state';

export default function SceneDescription({state}: {state: State}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (!heading.current?.closest('[inert]')) heading.current?.focus();
  }, [state.currentMode]);
  const keys: Record<number, string> = {
    [Modes.Loading]: 'a11yStageLoading',
    [Modes.IntermediateLoading]: 'a11yStageLoading',
    [Modes.Words]: 'a11yStageWords',
    [Modes.Training]: 'a11yStageTraining',
    [Modes.Predicting]: 'a11yStagePredicting',
    [Modes.Pond]: 'a11yStagePond',
  };
  let status = '';
  if (state.currentMode === Modes.Training) {
    status = state.isRunning
      ? I18n.t('a11yNextObject')
      : I18n.t('a11yQuestion', {
          number: state.trainingIndex + 1,
          question: state.trainingQuestion ?? '',
          description: describeObject(state.fishData[state.trainingIndex]),
        });
  } else if (state.currentMode === Modes.Predicting) {
    status = I18n.t(
      state.canSkipPredict
        ? 'a11yPredictContinue'
        : state.isRunning || state.isPaused
          ? 'a11yPredictRunning'
          : 'a11yPredictReady',
    );
    const latest = state.accessiblePredictions.at(-1);
    if (latest) {
      status +=
        ' ' +
        I18n.t('a11yPredictionItem', {
          description: describeObject(
            state.fishData.find(fish => fish.id === latest.id),
          ),
          label:
            latest.classId === 0
              ? (state.word ?? '')
              : I18n.t('notWord', {word: state.word ?? ''}),
        });
    }
  } else if (state.currentMode === Modes.Pond) {
    status =
      state.totalCorrectPredictions !== null
        ? I18n.t('a11yCorrectCount', {
            correct: state.totalCorrectPredictions,
            total: state.fishData.length,
          })
        : I18n.t('a11yResultsSummary', {
            matching: state.totalPondFish ?? state.pondFish.length,
            total: state.fishData.length,
            word: state.word ?? '',
          });
  }
  return (
    <>
      <h2
        ref={heading}
        lang={I18n.getMessageLocale(
          keys[state.currentMode ?? Modes.Loading] ?? 'a11yLab',
        )}
        aria-describedby="ocean-scene-description"
        tabIndex={-1}
        className="ocean-visually-hidden ocean-scene-heading"
      >
        {I18n.t(keys[state.currentMode ?? Modes.Loading] ?? 'a11yLab')}
      </h2>
      <p
        id="ocean-scene-description"
        lang={I18n.getMessageLocale(
          state.currentMode === Modes.Training
            ? 'a11yQuestion'
            : state.currentMode === Modes.Pond
              ? state.totalCorrectPredictions !== null
                ? 'a11yCorrectCount'
                : 'a11yResultsSummary'
              : 'a11yPredictReady',
        )}
        className="ocean-visually-hidden"
        role="status"
        aria-atomic="true"
      >
        {status}
      </p>
    </>
  );
}
