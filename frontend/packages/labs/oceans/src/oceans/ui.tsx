import * as React from 'react';

import {Loading, ConfirmationDialog} from '@/oceans/components/common';
import Pond from '@/oceans/components/scenes/pond';
import Predict from '@/oceans/components/scenes/predict';
import Train from '@/oceans/components/scenes/train';
import Words from '@/oceans/components/scenes/words';

import ConnectivityStatus from './components/common/ConnectivityStatus';
import {Modes} from './constants';
import I18n from './i18n';
import {getState, setState} from './state';

export default class UI extends React.Component {
  render() {
    const state = getState();
    const currentMode = getState().currentMode;
    const isLoading = (
      [Modes.Loading, Modes.IntermediateLoading] as number[]
    ).includes(currentMode as number);

    return (
      <section aria-label={I18n.t('a11yLab')} lang={I18n.getLocale()}>
        <ConnectivityStatus />
        <div inert={state.showConfirmationDialog || undefined}>
          {isLoading && <Loading />}
          {currentMode === Modes.Words && <Words />}
          {currentMode === Modes.Training && <Train />}
          {currentMode === Modes.Predicting && <Predict />}
          {currentMode === Modes.Pond && <Pond />}
        </div>
        {state.showConfirmationDialog && (
          <ConfirmationDialog
            onYesClick={state.confirmationDialogOnYes as () => void}
            onNoClick={() => setState({showConfirmationDialog: false})}
          />
        )}
      </section>
    );
  }
}
