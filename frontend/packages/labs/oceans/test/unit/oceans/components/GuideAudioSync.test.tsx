import {act, fireEvent, render} from '@testing-library/react';
import type {ReactNode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  currentGuide: {id: 'guide-1', textFn: () => 'Hello ocean'},
  speak: vi.fn(),
  cancel: vi.fn(),
  dismissCurrentGuide: vi.fn(),
  dismissGuide: vi.fn(),
  setState: vi.fn(),
  getState: vi.fn(),
  findGuideClip: vi.fn(),
  playSynced: vi.fn(),
  stop: vi.fn(),
  playSound: vi.fn(),
  state: {
    locale: 'en',
    textToSpeechLocale: undefined,
    textToSpeechEnabled: true,
    guideShowing: false,
    guideTypingTimer: undefined,
  },
}));

vi.mock('@/utils/speech', () => ({speak: mocks.speak, cancel: mocks.cancel}));
vi.mock('@/utils/guideAudio', () => ({
  findGuideClip: mocks.findGuideClip,
  playSynced: mocks.playSynced,
}));
vi.mock('@/oceans/models/guide', () => ({
  default: {
    getCurrentGuide: () => mocks.currentGuide,
    dismissCurrentGuide: mocks.dismissCurrentGuide,
    dismissGuide: mocks.dismissGuide,
  },
}));
vi.mock('@/oceans/state', () => ({
  getState: mocks.getState,
  setState: mocks.setState,
}));
vi.mock('@/oceans/models/soundLibrary', () => ({
  default: {playSound: mocks.playSound},
}));
vi.mock('@/oceans/i18n', () => ({default: {t: (key: string) => key}}));
vi.mock('react-typist', () => ({
  default: ({children}: {children: ReactNode}) => (
    <span data-testid="typist">{children}</span>
  ),
}));

import Guide from '@/oceans/components/common/Guide';

Object.defineProperty(document, 'elementsFromPoint', {value: () => []});

const typedText = (container: HTMLElement) =>
  container.querySelector('.ocean-guide__typing-text')?.textContent;

/** Renders the guide and uses the first click to start the clip. */
function startClip() {
  const view = render(<Guide />);
  const background = view.container.querySelector('#uitest-dismiss-guide')!;
  fireEvent.click(background);
  const callbacks = mocks.playSynced.mock.calls[0][1];
  return {...view, background, callbacks};
}

describe('Guide text synced to an audio clip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.state, {
      guideShowing: false,
      textToSpeechEnabled: true,
    });
    mocks.getState.mockReturnValue(mocks.state);
    mocks.setState.mockImplementation(patch =>
      Object.assign(mocks.state, patch),
    );
    mocks.findGuideClip.mockReturnValue('clip.mp3');
    mocks.playSynced.mockReturnValue({stop: mocks.stop});
    mocks.speak.mockReturnValue(true);
  });

  it('plays the clip instead of Web Speech and reveals text with it', () => {
    const {container, callbacks} = startClip();

    expect(mocks.playSynced).toHaveBeenCalledWith(
      'clip.mp3',
      expect.anything(),
    );
    expect(mocks.speak).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid=typist]')).toBeNull();

    act(() => callbacks.onProgress(0.5));
    expect(typedText(container)).toBe('Hello');
  });

  it('marks the guide finished when the clip ends', () => {
    const {callbacks} = startClip();

    act(() => callbacks.onEnd());

    expect(mocks.setState).toHaveBeenCalledWith({
      guideShowing: true,
      guideTypingTimer: undefined,
    });
  });

  it('stops the clip and shows all the text on a skip, keeping the guide', () => {
    const {container, background, rerender} = startClip();

    fireEvent.click(background);
    rerender(<Guide />);

    expect(mocks.stop).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('.ocean-guide__final-text--shown')?.textContent,
    ).toContain('Hello ocean');
    expect(mocks.dismissCurrentGuide).not.toHaveBeenCalled();
  });

  it('switches from clip narration to typing sound and finishes the remaining text', () => {
    vi.useFakeTimers();
    try {
      const {container, rerender} = startClip();
      mocks.state.textToSpeechEnabled = false;
      rerender(<Guide />);

      expect(mocks.stop).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(105));

      expect(typedText(container)).toBe('Hel');
      expect(mocks.playSound).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to typed text and Web Speech if the clip fails', () => {
    const {container, callbacks} = startClip();

    act(() => callbacks.onFail());

    expect(mocks.speak).toHaveBeenCalledWith(
      'Hello ocean',
      'en',
      expect.anything(),
    );
    expect(container.querySelector('[data-testid=typist]')).not.toBeNull();
  });

  it('leaves finished text alone if the clip starts late', () => {
    mocks.state.guideShowing = true;
    const {container} = startClip();

    expect(container.querySelector('[data-testid=typist]')).not.toBeNull();
  });

  it('stops the clip when the guide goes away', () => {
    const {unmount} = startClip();

    unmount();

    expect(mocks.stop).toHaveBeenCalledTimes(1);
  });

  it('uses Web Speech when a guide has no clip', () => {
    mocks.findGuideClip.mockReturnValue(undefined);

    startClip2();

    expect(mocks.playSynced).not.toHaveBeenCalled();
    expect(mocks.speak).toHaveBeenCalled();
  });
});

function startClip2() {
  const {container} = render(<Guide />);
  fireEvent.click(container.querySelector('#uitest-dismiss-guide')!);
}
