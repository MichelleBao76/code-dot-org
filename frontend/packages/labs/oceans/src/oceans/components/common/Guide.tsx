/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import * as React from 'react';
import Typist from 'react-typist';

import '@/oceans/styles/fade.css';

import arrowDownImage from '@/assets/images/arrow-down.png';
import fingerClickIcon1 from '@/assets/images/finger-click-icon-1.svg';
import fingerClickIcon2 from '@/assets/images/finger-click-icon-2.svg';
import Button from '@/oceans/components/common/Button';
import I18n from '@/oceans/i18n';
import guide from '@/oceans/models/guide';
import type {GuideEntry} from '@/oceans/models/guideTypes';
import soundLibrary from '@/oceans/models/soundLibrary';
import {getState, setState} from '@/oceans/state';
import {cancel as cancelSpeech, speak} from '@/utils/speech';

/**
 * Whether the browser will let the page speak yet.  Speech, like audio, is
 * blocked until the user has interacted with the page.
 */
const pageHasUserActivation = (gestureSeen: boolean): boolean => {
  const activation = (
    navigator as Navigator & {userActivation?: {hasBeenActive: boolean}}
  ).userActivation;
  return activation ? activation.hasBeenActive : gestureSeen;
};

/**
 * Map a `GuideEntry.style` value to its modifier class name.  The
 * registry's keys are typed as strings ("Info" / "Center" / etc.); we
 * mirror them here to a small registry so the lookup is type-safe.
 */
const GUIDE_STYLE_CLASS: Record<string, string> = {
  Info: 'ocean-guide--info',
  Center: 'ocean-guide--center',
};

/**
 * The enabled lab button under a tap on the guide's dimmed background, if
 * any.  Taps on the guide's own text box never reach the lab underneath.
 */
const findButtonUnderScrim = (event: React.MouseEvent): HTMLElement | null => {
  const elements = document.elementsFromPoint(event.clientX, event.clientY);
  if (elements[0]?.closest('.guide-dialog')) {
    return null;
  }
  for (const element of elements) {
    const button = element.closest<HTMLElement>('.ocean-button');
    if (
      button &&
      !button.closest('.guide-dialog') &&
      button.getAttribute('aria-disabled') !== 'true'
    ) {
      return button;
    }
  }
  return null;
};

/** Map a `GuideEntry.arrow` value to its modifier class name. */
const GUIDE_ARROW_CLASS: Record<string, string> = {
  BotRight: 'ocean-guide__arrow--bot-right',
  LowerLeft: 'ocean-guide__arrow--lower-left',
  LowerRight: 'ocean-guide__arrow--lower-right',
  LowishRight: 'ocean-guide__arrow--lowish-right',
  LowerCenter: 'ocean-guide__arrow--lower-center',
  UpperRight: 'ocean-guide__arrow--upper-right',
  UpperFarRight: 'ocean-guide__arrow--upper-far-right',
};

class Guide extends React.Component<Record<string, never>> {
  guideDialogRef = React.createRef<HTMLDivElement>();
  lastFocusedGuideId: string | null = null;
  /** Guide whose typing animation was skipped by a tap; its full text shows. */
  skippedGuideId: string | null = null;
  /** Guide that speech was last started (or attempted) for. */
  spokenGuideId: string | null = null;
  /** Fallback for browsers without navigator.userActivation. */
  gestureSeen = false;

  componentDidMount() {
    this.syncSpeech();
  }

  /** Speak each guide once when it appears; stop when it closes. */
  syncSpeech() {
    const currentGuide = guide.getCurrentGuide();
    if (this.spokenGuideId && this.spokenGuideId !== currentGuide?.id) {
      cancelSpeech();
      this.spokenGuideId = null;
    }
    if (currentGuide && pageHasUserActivation(this.gestureSeen)) {
      this.speakGuide(currentGuide);
    }
  }

  /** Starts speech for `currentGuide` unless already tried; true if started. */
  speakGuide(currentGuide: GuideEntry): boolean {
    if (this.spokenGuideId === currentGuide.id) {
      return false;
    }
    this.spokenGuideId = currentGuide.id;
    const state = getState();
    // `?tts=xx` still overrides the language, for testing.
    const lang = state.textToSpeechLocale || state.locale || 'en';
    return speak(currentGuide.textFn(state), lang);
  }

  componentDidUpdate() {
    this.syncSpeech();

    // Focus the dialog only when the guide changes, not on every re-render
    const currentGuide = guide.getCurrentGuide();
    const currentGuideId = currentGuide ? currentGuide.id : null;

    if (
      currentGuideId !== this.lastFocusedGuideId &&
      currentGuide &&
      this.guideDialogRef &&
      this.guideDialogRef.current
    ) {
      // `focusVisible` is a non-standard option (Firefox extension) accepted
      // by some browsers; cast since it isn't in lib.dom's FocusOptions.
      this.guideDialogRef.current.focus({focusVisible: false} as FocusOptions);
      this.lastFocusedGuideId = currentGuideId;
    } else if (!currentGuide) {
      this.lastFocusedGuideId = null;
    }
  }
  onTypingDone() {
    clearInterval(
      getState().guideTypingTimer as ReturnType<typeof setInterval>,
    );
    setState({guideShowing: true, guideTypingTimer: undefined});
  }

  onGuideKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') {
      e.preventDefault();
      this.onGuideClick();
    }
  };

  closeGuide = (guideId: string) => {
    guide.dismissGuide(guideId);
  };

  onGuideClick = (event?: React.MouseEvent) => {
    const state = getState();
    const currentGuide = guide.getCurrentGuide();
    this.gestureSeen = true;

    // Make sure we don't try and dismiss a guide if it's not modal.
    if (!currentGuide || currentGuide.noDimBackground) {
      return;
    }

    // A tap on a lab button showing through the dimmed background closes
    // the guide and presses that button, so one tap is enough to move on.
    const buttonUnderTap =
      event && currentGuide.style !== 'Info'
        ? findButtonUnderScrim(event)
        : null;
    if (buttonUnderTap) {
      this.closeGuide(currentGuide.id);
      buttonUnderTap.click();
      return;
    }

    // If speech was waiting for the user's first tap, this tap starts it.
    if (this.speakGuide(currentGuide)) {
      return;
    }

    // While the text is still typing, a tap shows all of it at once.
    if (!state.guideShowing) {
      this.skippedGuideId = currentGuide.id;
      this.onTypingDone();
      return;
    }

    // "Did You Know" boxes close only from their own Continue button.
    if (currentGuide.style === 'Info') {
      return;
    }

    if (guide.dismissCurrentGuide()) {
      soundLibrary.playSound('other');
    }
  };

  render() {
    const state = getState();
    const currentGuide = guide.getCurrentGuide();

    // Background variant: hidden, info-darkened, or the default scrim.
    let bgClassName = 'ocean-guide__bg';
    if (currentGuide) {
      if (currentGuide.noDimBackground) {
        bgClassName = 'ocean-guide__bg ocean-guide__bg--hidden';
      } else if (currentGuide.style === 'Info') {
        bgClassName = 'ocean-guide__bg ocean-guide__bg--info';
      }
    }

    const renderClickToContinueReminder =
      state.guides === 'K5' &&
      state.guideShowing &&
      currentGuide &&
      !currentGuide.noDimBackground &&
      currentGuide.style !== 'Info';

    const guideClassName =
      currentGuide &&
      currentGuide.style &&
      GUIDE_STYLE_CLASS[currentGuide.style]
        ? `ocean-guide ${GUIDE_STYLE_CLASS[currentGuide.style]}`
        : 'ocean-guide';

    const arrowClassName =
      currentGuide &&
      currentGuide.arrow &&
      GUIDE_ARROW_CLASS[currentGuide.arrow]
        ? `ocean-guide__arrow ${GUIDE_ARROW_CLASS[currentGuide.arrow]}`
        : 'ocean-guide__arrow';

    // imageStyle on a GuideEntry is one of two opaque {top,left} object
    // literals from guidesHoc / guidesK5; pass through verbatim.
    const imageStyle = currentGuide?.imageStyle;

    const typingSkipped =
      !!currentGuide && this.skippedGuideId === currentGuide.id;

    return (
      <div>
        {currentGuide && currentGuide.image && (
          <img
            src={currentGuide.image}
            className="ocean-guide__image"
            style={imageStyle}
            alt=""
          />
        )}
        {!!currentGuide && (
          <div>
            <div
              key={currentGuide.id}
              className={bgClassName}
              onClick={this.onGuideClick}
              id="uitest-dismiss-guide"
            >
              <div
                aria-labelledby="guide-heading"
                tabIndex={-1}
                className={`guide-dialog ${guideClassName}`}
              >
                <div>
                  {currentGuide.style === 'Info' && (
                    <div id="guide-heading" className="ocean-guide__heading">
                      {I18n.t('didYouKnow')}
                    </div>
                  )}

                  {/* Visible Typist animation for sighted users */}
                  {!typingSkipped && (
                    <div
                      className="ocean-guide__typing-text"
                      aria-hidden="true"
                    >
                      <Typist
                        avgTypingDelay={35}
                        stdTypingDelay={15}
                        cursor={{show: false}}
                        onTypingDone={this.onTypingDone}
                      >
                        {currentGuide.textFn(getState())}
                      </Typist>
                    </div>
                  )}

                  <div
                    className={
                      currentGuide.style === 'Info'
                        ? 'ocean-guide__final-text-container--info'
                        : undefined
                    }
                  >
                    <div
                      ref={this.guideDialogRef}
                      aria-live="polite"
                      tabIndex={0}
                      onKeyDown={this.onGuideKeyDown}
                      className={
                        typingSkipped
                          ? 'ocean-guide__final-text ocean-guide__final-text--shown'
                          : 'ocean-guide__final-text'
                      }
                    >
                      {currentGuide.textFn(getState())}
                    </div>
                  </div>
                  {renderClickToContinueReminder && (
                    <div className="ocean-guide__continue-reminder">
                      <img
                        src={fingerClickIcon1}
                        alt=""
                        className="ocean-guide__continue-reminder-1"
                      />
                      <img
                        src={fingerClickIcon2}
                        alt=""
                        className="ocean-guide__continue-reminder-2"
                      />
                    </div>
                  )}
                  {currentGuide.style === 'Info' && (
                    <Button
                      className="ocean-guide__info-button"
                      onClick={event => {
                        // Keep the tap from also reaching the background.
                        event.stopPropagation();
                        this.closeGuide(currentGuide.id);
                      }}
                    >
                      {I18n.t('continue')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {currentGuide.arrow && (
              <img src={arrowDownImage} className={arrowClassName} alt="" />
            )}
          </div>
        )}
      </div>
    );
  }
}
export default Guide;
