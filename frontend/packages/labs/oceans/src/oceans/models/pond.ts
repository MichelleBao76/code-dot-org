import _ from 'lodash';

import constants, {ClassType, AppMode} from '../constants';
import {FishOceanObject, SeaCreatureOceanObject} from '../OceanObject';
import {setState, getState} from '../state';
import type {PondFish, State} from '../state';

/**
 * Shape of a fish object as the pond model needs to call it.
 *
 * `PondFish` (= `OceanObject`) types `getResult()` as returning `unknown`;
 * the model layer downcasts at the call site to the prediction-result
 * shape that has actually been attached at this point.
 */
type PondPredictionResult = {predictedClassId: number};
type ModelPondFish = PondFish;

/**
 * Count correct classifications when objects have an objective fish/trash label.
 * Word-attribute modes depend on the student's chosen meaning, so they do not
 * have a reliable ground-truth accuracy score.
 */
export const countCorrectPredictions = (
  fish: PondFish[],
  appMode: State['appMode'],
): number | null => {
  if (appMode !== AppMode.FishVTrash && appMode !== AppMode.CreaturesVTrash) {
    return null;
  }

  return fish.filter(object => {
    const shouldMatch =
      object instanceof FishOceanObject ||
      (appMode === AppMode.CreaturesVTrash &&
        object instanceof SeaCreatureOceanObject);
    const expectedClassId = shouldMatch ? ClassType.Like : ClassType.Dislike;
    return (
      (object.getResult() as PondPredictionResult | null)?.predictedClassId ===
      expectedClassId
    );
  }).length;
};

/**
 * Initialize the pond model: run all pending predictions, split fish into
 * liked/disliked groups, lay them out on screen, and compute explain summaries.
 *
 * @returns Promise resolving when all predictions and layout are complete.
 */
export const init = async (): Promise<void> => {
  const state = getState();
  const fishWithPredictions = await predictAllFish(state);
  const fishByClassType = _.groupBy(
    fishWithPredictions,
    fish => (fish.getResult() as PondPredictionResult).predictedClassId,
  );

  let pondFish = fishByClassType[ClassType.Like] || [];
  setState({
    totalPondFish: pondFish.length,
    totalCorrectPredictions: countCorrectPredictions(
      fishWithPredictions,
      state.appMode,
    ),
  });
  pondFish = pondFish.splice(0, constants.maxPondFish);
  const recallFish = (fishByClassType[ClassType.Dislike] || []).splice(
    0,
    constants.maxPondFish,
  );
  arrangeFish(pondFish);
  arrangeFish(recallFish);
  setState({pondFish, recallFish});
  if (
    state.appMode === AppMode.FishShort ||
    state.appMode === AppMode.FishLong
  ) {
    if (pondFish.length > 0 && recallFish.length > 0) {
      const firstFishFieldInfos = (state.fishData[0] as ModelPondFish)
        .fieldInfos;
      const trainer = state.trainer as unknown as {
        summarize: (fieldInfos: unknown) => unknown;
        explainFish: (fish: unknown) => Array<{impact: number}>;
      };
      setState({
        pondExplainGeneralSummary: trainer.summarize(
          firstFishFieldInfos,
        ) as State['pondExplainGeneralSummary'],
        pondFishMaxExplainValue: getMaxExplainValue(pondFish),
        pondRecallFishMaxExplainValue: getMaxExplainValue(recallFish),
      });
    }
  }
};

/**
 * Run trainer.predict on every fish in state.fishData that does not yet have a result.
 *
 * @param state - Current lab state.
 * @returns Promise resolving to the array of all fish with predictions attached.
 */
const predictAllFish = async (
  state: ReturnType<typeof getState>,
): Promise<ModelPondFish[]> => {
  const trainer = state.trainer as unknown as {
    predict: (fish: unknown) => Promise<unknown>;
  };
  // Wait for every prediction before calculating the full results total.
  return Promise.all(
    (state.fishData as ModelPondFish[]).map(async fish => {
      fish.setResult(await trainer.predict(fish));
      return fish;
    }),
  );
};

/**
 * Lay out the given fishes at pre-computed grid positions.
 *
 * @param fishes - Array of fish objects with setXY methods.
 */
export const arrangeFish = (fishes: ModelPondFish[]): void => {
  const fishPositions = formatArrangement();

  fishes.forEach(fish => {
    const pos = fishPositions.shift();
    if (!pos) return;
    const x = pos[0] * 140 - 50;
    const y = pos[1] * 150;

    fish.setXY({x, y});
  });
};

/**
 * Find the maximum absolute impact value across all fish in the collection.
 * Used to normalise the pond explanation bar charts.
 *
 * @param fishCollection - Array of pond fish to evaluate.
 * @returns Maximum impact value found, or 0.
 */
const getMaxExplainValue = (fishCollection: ModelPondFish[]): number => {
  const state = getState();
  const trainer = state.trainer as unknown as {
    explainFish: (fish: unknown) => Array<{impact: number}>;
  };

  let maxValue = 0;

  fishCollection.forEach(fish => {
    const summary = trainer.explainFish(fish);
    if (summary.length > 0) {
      const value = Math.abs(summary[0].impact);
      if (value > maxValue) {
        maxValue = value;
      }
    }
  });

  return maxValue;
};

/**
 * Describes the 20 possible fish positions on the screen.
 * The value at each cell is the fill priority (0 = highest priority).
 * null cells are skipped.
 */
const arrangement: (number | null)[][] = [
  [2, 1, 0, 0, 0, 1, 2],
  [2, 1, 0, 0, 0, 1, 2],
  [2, 1, 0, null, 0, 1, 2],
];

/**
 * Reformat the arrangement constant into a priority-ordered 1-D list of [col, row] positions.
 *
 * @returns Array of [colIdx, rowIdx] pairs, lowest priority number first.
 */
const formatArrangement = (): [number, number][] => {
  const intermediateArr: [number, number][][] = [];
  arrangement.forEach((row, rowIdx) => {
    row.forEach((col, colIdx) => {
      if (typeof col !== 'number') {
        return;
      }

      if (!intermediateArr[col]) {
        intermediateArr[col] = [];
      }

      intermediateArr[col].push([colIdx, rowIdx]);
    });
  });

  let formattedArrangement: [number, number][] = [];
  intermediateArr.forEach(a => {
    formattedArrangement = formattedArrangement.concat(_.shuffle(a));
  });

  return formattedArrangement;
};
