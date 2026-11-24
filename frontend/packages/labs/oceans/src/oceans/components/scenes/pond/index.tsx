import {faBan, faCheck, faInfo} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import _ from 'lodash';
import * as React from 'react';

import aiBotClosed from '@/assets/images/ai-bot/ai-bot-closed.png';
import {Body, Button} from '@/oceans/components/common';
import PondPanel from '@/oceans/components/scenes/pond/PondPanel';
import constants, {AppMode, Modes} from '@/oceans/constants';
import {describeObject} from '@/oceans/describeObject';
import helpers, {$time} from '@/oceans/helpers';
import I18n from '@/oceans/i18n';
import modeHelpers from '@/oceans/modeHelpers';
import guide from '@/oceans/models/guide';
import {arrangeFish} from '@/oceans/models/pond';
import soundLibrary from '@/oceans/models/soundLibrary';
import {getState, setState, type PondFish} from '@/oceans/state';
import SVMTrainer from '@/utils/SVMTrainer';

/** True when the current mode trains an SVM on word-attribute fish. */
function isFishVariantMode(appMode: string | null): boolean {
  return appMode === AppMode.FishShort || appMode === AppMode.FishLong;
}

function Collide(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number,
): boolean {
  // Detect a non-collision.
  if (
    x1 + w1 - 1 < x2 ||
    x1 > x2 + w2 - 1 ||
    y1 + h1 - 1 < y2 ||
    y1 > y2 + h2 - 1
  ) {
    return false;
  }

  // Otherwise we have a collision.
  return true;
}

class Pond extends React.Component {
  constructor(props: Record<string, never>) {
    super(props);
  }

  getMatchingFishSet = (e: React.MouseEvent | null, showMatching: boolean) => {
    const state = getState();

    // No-op if transition is already in progress or if already showing the desired fish set.
    // Note that recallFish are fish that are not matching the word/attribute.
    // pondFish are fish that are matching the word/attribute.
    // showMatching true -> want matching (showRecallFish false)
    // showMatching false -> want recalled fish (showRecallFish true).
    if (
      state.pondFishTransitionStartTime ||
      state.showRecallFish === !showMatching
    ) {
      return;
    }

    let currentFishSet, nextFishSet;
    if (state.showRecallFish) {
      currentFishSet = state.recallFish;
      nextFishSet = state.pondFish;
      soundLibrary.playSound('yes');
    } else {
      currentFishSet = state.pondFish;
      nextFishSet = state.recallFish;
      soundLibrary.playSound('no');
    }

    // Don't call arrangeFish if fish have already been arranged.
    if (nextFishSet.length > 0 && !nextFishSet[0].getXY?.()) {
      arrangeFish(nextFishSet as unknown as Parameters<typeof arrangeFish>[0]);
    }

    if (currentFishSet.length === 0) {
      // Immediately transition to nextFishSet rather than waiting for empty animation.
      setState({showRecallFish: !state.showRecallFish, pondClickedFish: null});
    } else {
      setState({pondFishTransitionStartTime: $time(), pondClickedFish: null});
    }

    if (e) {
      e.stopPropagation();
    }
  };

  onPondClick = (e: React.MouseEvent) => {
    // Don't allow pond clicks if a Guide is currently showing.
    if (guide.getCurrentGuide()) {
      return;
    }

    const state = getState();
    const clickX = e.nativeEvent.offsetX;
    const clickY = e.nativeEvent.offsetY;

    const boundingRect = (e.target as HTMLElement).getBoundingClientRect();
    const pondWidth = boundingRect.width;
    const pondHeight = boundingRect.height;

    // Scale the click to the pond canvas dimensions.
    const normalizedClickX = (clickX / pondWidth) * constants.canvasWidth;
    const normalizedClickY = (clickY / pondHeight) * constants.canvasHeight;

    const fishCollection = state.showRecallFish
      ? state.recallFish
      : state.pondFish;

    if (state.pondFishBounds) {
      let fishClicked = false;
      // Look through the array in reverse so that we click on a fish that
      // is rendered topmost.
      _.reverse(state.pondFishBounds).forEach(fishBound => {
        // If we haven't already clicked on a fish in this current iteration,
        // and we're not clicking on a fish that is already actively clicked,
        // and we have a collision, then we have clicked on a new fish!
        if (
          !fishClicked &&
          !(
            state.pondClickedFish &&
            fishBound.fishId === state.pondClickedFish.id
          ) &&
          Collide(
            fishBound.x,
            fishBound.y,
            fishBound.w,
            fishBound.h,
            normalizedClickX,
            normalizedClickY,
            1,
            1,
          )
        ) {
          setState({
            pondClickedFish: {
              id: fishBound.fishId,
              x: fishBound.x,
              y: fishBound.y,
            },
          });
          fishClicked = true;
          soundLibrary.playSound('yes');

          if (
            state.appMode === AppMode.FishShort ||
            state.appMode === AppMode.FishLong
          ) {
            const clickedFish = fishCollection.find(
              f => f.id === fishBound.fishId,
            );
            if (
              clickedFish &&
              clickedFish.knnData &&
              state.trainer instanceof SVMTrainer
            ) {
              setState({
                pondExplainFishSummary: state.trainer.explainFish({
                  knnData: clickedFish.knnData,
                  fieldInfos: clickedFish.fieldInfos,
                }),
              });
            }
            if (normalizedClickX < constants.canvasWidth / 2) {
              setState({pondPanelSide: 'right'});
            } else {
              setState({pondPanelSide: 'left'});
            }
          }
        }
      });

      if (!fishClicked) {
        setState({pondClickedFish: null});
        soundLibrary.playSound('no');
      }
    }
  };

  selectAccessibleFish = (fish: PondFish) => {
    const state = getState();
    const xy = fish.getXY() ?? {x: 0, y: 0};
    setState({
      pondClickedFish: {id: fish.id, ...xy},
      pondPanelShowing: true,
      pondPanelSide: 'right',
    });
    if (fish.knnData && state.trainer instanceof SVMTrainer) {
      setState({
        pondExplainFishSummary: state.trainer.explainFish({
          knnData: fish.knnData,
          fieldInfos: fish.fieldInfos,
        }),
      });
    }
  };

  onPondPanelButtonClick = (e: React.MouseEvent | null) => {
    const state = getState();

    if (isFishVariantMode(state.appMode)) {
      setState({
        pondPanelShowing: !state.pondPanelShowing,
      });

      if (state.pondPanelShowing) {
        soundLibrary.playSound('sortno');
      } else {
        soundLibrary.playSound('sortyes');
      }
    }

    if (e) {
      e.stopPropagation();
    }
  };

  render() {
    const state = getState();

    const showInfoButton =
      isFishVariantMode(state.appMode) &&
      state.pondFish.length > 0 &&
      state.recallFish.length > 0;

    // When the info button is hidden, the recall icons shift to the lab's
    // right edge to take its place.
    const recallIconsClassName = showInfoButton
      ? 'ocean-pond__recall-icons'
      : 'ocean-pond__recall-icons ocean-pond__recall-icons--no-info';

    // The currently-active toggle is highlighted; the inactive one stays
    // on the white base.
    const matchingToggleClassName = state.showRecallFish
      ? 'ocean-toggle-icon ocean-toggle-icon--matching-left'
      : 'ocean-toggle-icon ocean-toggle-icon--matching-left ocean-toggle-icon--bg-green';
    const nonMatchingToggleClassName = state.showRecallFish
      ? 'ocean-toggle-icon ocean-toggle-icon--non-matching-right ocean-toggle-icon--bg-red'
      : 'ocean-toggle-icon ocean-toggle-icon--non-matching-right';
    const infoButtonClassName = state.pondPanelShowing
      ? 'ocean-info-icon-container ocean-info-icon-container--active'
      : 'ocean-info-icon-container';

    return (
      <Body>
        <div
          role="button"
          aria-label={I18n.t('a11yPond')}
          tabIndex={0}
          onClick={this.onPondClick}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setState({pondClickedFish: null});
            }
          }}
          className="ocean-pond__surface"
        />
        <div className={recallIconsClassName}>
          <button
            key="toggle-matching"
            aria-pressed={!state.showRecallFish}
            type="button"
            onClick={e => this.getMatchingFishSet(e, true)}
            aria-label={I18n.t('switchToMatchingItems')}
            className={matchingToggleClassName}
          >
            <FontAwesomeIcon
              icon={faCheck}
              style={{width: '100%', height: '100%'}}
            />
          </button>
          <button
            key="toggle-non-matching"
            aria-pressed={state.showRecallFish}
            type="button"
            onClick={e => this.getMatchingFishSet(e, false)}
            aria-label={I18n.t('switchToNonMatchingItems')}
            className={nonMatchingToggleClassName}
          >
            <FontAwesomeIcon
              icon={faBan}
              style={{width: '100%', height: '100%'}}
            />
          </button>
        </div>
        {showInfoButton && (
          <button
            type="button"
            id="uitest-info-btn"
            aria-label={I18n.t('a11yFishInformation')}
            aria-pressed={state.pondPanelShowing ? 'true' : 'false'}
            className={infoButtonClassName}
            onClick={this.onPondPanelButtonClick}
          >
            <FontAwesomeIcon
              icon={faInfo}
              className="ocean-info-icon"
              aria-hidden
            />
          </button>
        )}
        <img className="ocean-pond__bot" src={aiBotClosed} alt="" />
        {state.canSkipPond && (
          <div id="uitest-nav-btns">
            {state.appMode === AppMode.FishLong ? (
              <div>
                <Button
                  className="ocean-button--play-again"
                  onClick={() => {
                    setState({pondClickedFish: null, pondPanelShowing: false});
                    helpers.resetTraining(state);
                    modeHelpers.toMode(Modes.Words);
                  }}
                >
                  {I18n.t('newWord')}
                </Button>
                <Button
                  className="ocean-button--finish"
                  onClick={state.onContinue}
                >
                  {I18n.t('finish')}
                </Button>
              </div>
            ) : (
              <Button
                className="ocean-button--continue"
                onClick={state.onContinue}
              >
                {I18n.t('continue')}
              </Button>
            )}
            <div>
              <Button
                className="ocean-button--back"
                onClick={() => {
                  modeHelpers.toMode(Modes.Training);
                  setState({pondClickedFish: null, pondPanelShowing: false});
                }}
              >
                {I18n.t('trainMore')}
              </Button>
            </div>
          </div>
        )}
        <details className="ocean-accessible-results">
          <summary>{I18n.t('a11yResults')}</summary>
          {state.totalCorrectPredictions !== null && (
            <p>
              {I18n.t('a11yCorrectCount', {
                correct: state.totalCorrectPredictions,
                total: state.fishData.length,
              })}
            </p>
          )}
          <p>
            {I18n.t('a11yResultsSummary', {
              matching: state.totalPondFish ?? state.pondFish.length,
              total: state.fishData.length,
              word: state.word ?? '',
            })}
          </p>
          <h3>
            {I18n.t(state.showRecallFish ? 'a11yNotMatching' : 'a11yMatching')}
          </h3>
          <p>
            {I18n.t('a11yDisplayedObjects', {
              count: (state.showRecallFish ? state.recallFish : state.pondFish)
                .length,
            })}
          </p>
          <ul>
            {(state.showRecallFish ? state.recallFish : state.pondFish).map(
              (fish, index) => (
                <li key={fish.id}>
                  <button
                    type="button"
                    id={`ocean-result-${fish.id}`}
                    onClick={() => this.selectAccessibleFish(fish)}
                  >
                    {I18n.t('a11yObjectNumber', {
                      number: index + 1,
                      description: describeObject(fish),
                    })}
                  </button>
                </li>
              ),
            )}
          </ul>
          {(state.showRecallFish ? state.recallFish : state.pondFish).length ===
            0 && <p>{I18n.t('a11yNoObjects')}</p>}
        </details>
        {state.pondPanelShowing && <PondPanel />}
      </Body>
    );
  }
}
export default Pond;
