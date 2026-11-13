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
import {findGuideClip, playSynced, type SyncedAudio} from '@/utils/guideAudio';
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
  /** Guide whose speech request is active, including while a voice is loading. */
  speechGuideId: string | null = null;
  /** Prerecorded narration currently playing, if any. */
  activeClip: SyncedAudio | null = null;
  /** Guide whose text is being revealed in step with its audio clip. */
  syncedGuideId: string | null = null;
  /** How many characters of the synced guide are showing. */
  syncedChars = 0;
  /** Fallback for browsers without navigator.userActivation. */
  gestureSeen = false;
  typingSoundGuideId: string | null = null;
  typingSoundTimer: ReturnType<typeof setInterval> | undefined;
  syncedTypingTimer: ReturnType<typeof setInterval> | undefined;
  lastGuideId: string | null = null;
  lastTextToSpeechEnabled = getState().textToSpeechEnabled;

  componentDidMount() {
    this.syncPlayback();
  }

  componentWillUnmount() {
    this.stopTypingSound();
    this.stopSyncedTyping();
    this.stopNarration();
  }

  /** Stops whichever narration is active, recorded or spoken. */
  stopNarration() {
    cancelSpeech();
    this.activeClip?.stop();
    this.activeClip = null;
    this.speechGuideId = null;
  }

  /** Apply narration and typing audio to the current guide and setting. */
  syncPlayback() {
    const currentGuide = guide.getCurrentGuide();
    const currentGuideId = currentGuide?.id ?? null;
    const guideChanged = currentGuideId !== this.lastGuideId;
    const enabled = getState().textToSpeechEnabled;
    const settingChanged = enabled !== this.lastTextToSpeechEnabled;

    if (guideChanged) {
      if (this.lastGuideId !== null) {
        this.stopNarration();
      }
      this.spokenGuideId = null;
      this.syncedGuideId = null;
      this.syncedChars = 0;
      this.stopSyncedTyping();
      this.lastGuideId = currentGuideId;
    }

    if (settingChanged && !enabled) {
      this.stopNarration();
      this.spokenGuideId = null;
      if (currentGuide && this.syncedGuideId === currentGuide.id) {
        this.continueSyncedTyping(currentGuide);
      }
    } else if (settingChanged && enabled) {
      this.spokenGuideId = null;
      this.gestureSeen = true;
      this.stopSyncedTyping();
    }
    this.lastTextToSpeechEnabled = enabled;

    if (
      enabled &&
      currentGuide &&
      (guideChanged || settingChanged) &&
      pageHasUserActivation(this.gestureSeen)
    ) {
      this.speakGuide(currentGuide);
    }

    this.syncTypingSound(currentGuide);
  }

  syncTypingSound(currentGuide: GuideEntry | null) {
    const state = getState();
    if (
      state.textToSpeechEnabled ||
      state.guideShowing ||
      !currentGuide
    ) {
      this.stopTypingSound();
      return;
    }
    if (
      this.typingSoundGuideId === currentGuide.id &&
      this.typingSoundTimer !== undefined
    ) {
      return;
    }
    this.stopTypingSound();
    this.typingSoundGuideId = currentGuide.id;
    this.typingSoundTimer = setInterval(
      () => soundLibrary.playSound('no', 0.5),
      100,
    );
    setState({guideTypingTimer: this.typingSoundTimer});
  }

  stopTypingSound() {
    const timer = this.typingSoundTimer ?? getState().guideTypingTimer;
    if (timer !== undefined) {
      clearInterval(timer);
    }
    this.typingSoundTimer = undefined;
    if (getState().guideTypingTimer !== undefined) {
      setState({guideTypingTimer: undefined}, {skipCallback: true});
    }
    this.typingSoundGuideId = null;
  }

  continueSyncedTyping(currentGuide: GuideEntry) {
    if (this.syncedTypingTimer !== undefined) {
      return;
    }
    const text = currentGuide.textFn(getState());
    this.syncedTypingTimer = setInterval(() => {
      this.syncedChars = Math.min(this.syncedChars + 1, text.length);
      this.forceUpdate();
      if (this.syncedChars === text.length) {
        this.onTypingDone();
      }
    }, 35);
  }

  stopSyncedTyping() {
    if (this.syncedTypingTimer !== undefined) {
      clearInterval(this.syncedTypingTimer);
      this.syncedTypingTimer = undefined;
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
    const clip = findGuideClip(currentGuide.id, lang);
    if (clip) {
      this.playClip(currentGuide, clip, lang);
      return true;
    }
    return this.speakWithVoice(currentGuide, lang);
  }

  /** Plays a guide's clip, revealing its text in step with the voice. */
  playClip(currentGuide: GuideEntry, url: string, lang: string) {
    const text = currentGuide.textFn(getState());
    // Text that has already finished typing stays on screen as it is.
    const syncText = !getState().guideShowing;
    this.speechGuideId = currentGuide.id;
    this.syncedGuideId = syncText ? currentGuide.id : null;
    this.syncedChars = 0;
    this.activeClip = playSynced(url, {
      onProgress: fraction => {
        const chars = Math.floor(fraction * text.length);
        if (syncText && chars !== this.syncedChars) {
          this.syncedChars = chars;
          this.forceUpdate();
        }
      },
      onEnd: () => {
        this.activeClip = null;
        this.speechGuideId = null;
        if (!getState().guideShowing) {
          this.onTypingDone();
        }
      },
      onFail: () => {
        // Never leave the box empty: go back to typed text and Web Speech.
        this.activeClip = null;
        this.syncedGuideId = null;
        this.speakWithVoice(currentGuide, lang);
        this.forceUpdate();
      },
    });
    if (syncText) {
      this.forceUpdate();
    }
  }

  /** Speaks a guide with Web Speech; true if speech started. */
  speakWithVoice(currentGuide: GuideEntry, lang: string): boolean {
    const started = speak(currentGuide.textFn(getState()), lang, {
      onStart: () => {
        if (this.spokenGuideId === currentGuide.id) {
          this.speechGuideId = currentGuide.id;
        }
      },
      onEnd: () => {
        if (this.spokenGuideId === currentGuide.id) {
          this.speechGuideId = null;
        }
      },
    });
    this.speechGuideId = started ? currentGuide.id : null;
    return started;
  }

  componentDidUpdate() {
    this.syncPlayback();

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
  onTypingDone = () => {
    this.stopTypingSound();
    this.stopSyncedTyping();
    const currentGuide = guide.getCurrentGuide();
    if (currentGuide && this.syncedGuideId === currentGuide.id) {
      this.syncedChars = currentGuide.textFn(getState()).length;
    }
    setState({guideShowing: true, guideTypingTimer: undefined});
  };

  onGuideKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') {
      e.preventDefault();
      this.onGuideClick();
    }
  };

  closeGuide = (guideId: string) => {
    this.stopNarration();
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

    // While narration is active (or waiting for a voice), a click stops it
    // and reveals the complete bubble without advancing to another guide.
    if (this.speechGuideId === currentGuide.id) {
      this.stopNarration();
      this.skippedGuideId = currentGuide.id;
      if (!state.guideShowing) {
        this.onTypingDone();
      } else {
        this.forceUpdate();
      }
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
    if (state.textToSpeechEnabled && this.speakGuide(currentGuide)) {
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
      this.stopNarration();
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
    const textSynced = !!currentGuide && this.syncedGuideId === currentGuide.id;

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
                      {textSynced ? (
                        currentGuide
                          .textFn(getState())
                          .slice(0, this.syncedChars)
                      ) : (
                        <Typist
                          avgTypingDelay={35}
                          stdTypingDelay={15}
                          cursor={{show: false}}
                          onTypingDone={this.onTypingDone}
                        >
                          {currentGuide.textFn(getState())}
                        </Typist>
                      )}
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
