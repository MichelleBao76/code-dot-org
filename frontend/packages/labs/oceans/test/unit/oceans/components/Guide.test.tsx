import {fireEvent, render} from '@testing-library/react';
import type {ReactNode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  currentGuide: null as null | {
    id: string;
    textFn: () => string;
    style?: string;
  },
  speak: vi.fn(),
  cancel: vi.fn(),
  dismissCurrentGuide: vi.fn(),
  dismissGuide: vi.fn(),
  setState: vi.fn(),
  playSound: vi.fn(),
  state: {
    locale: 'en',
    textToSpeechLocale: undefined,
    textToSpeechEnabled: true,
    guideShowing: false,
    guideTypingTimer: undefined,
  },
  getState: vi.fn(),
}));

vi.mock('@/utils/speech', () => ({
  speak: mocks.speak,
  cancel: mocks.cancel,
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
  default: ({
    children,
    onTypingDone,
  }: {
    children: ReactNode;
    onTypingDone?: () => void;
  }) => (
    <>
      {children}
      <button
        type="button"
        data-testid="typing-complete"
        onClick={event => {
          event.stopPropagation();
          onTypingDone?.();
        }}
      />
    </>
  ),
}));

import Guide from '@/oceans/components/common/Guide';

Object.defineProperty(document, 'elementsFromPoint', {value: () => []});

describe('Guide narration skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentGuide = {
      id: 'guide-1',
      textFn: () => 'Localized guide text',
    };
    Object.assign(mocks.state, {
      locale: 'es-MX',
      textToSpeechLocale: undefined,
      textToSpeechEnabled: true,
      guideShowing: false,
      guideTypingTimer: undefined,
    });
    mocks.getState.mockReturnValue(mocks.state);
    mocks.setState.mockImplementation(patch =>
      Object.assign(mocks.state, patch),
    );
    mocks.speak.mockReturnValue(true);
    mocks.dismissCurrentGuide.mockReturnValue(false);
  });

  it('stops narration, ends typing, reveals all text, and keeps the guide open', () => {
    const {container, rerender} = render(<Guide />);
    const background = container.querySelector('#uitest-dismiss-guide')!;

    // First click is the user gesture that starts speech.
    fireEvent.click(background);
    expect(mocks.speak).toHaveBeenCalledWith(
      'Localized guide text',
      'es-MX',
      expect.objectContaining({
        onStart: expect.any(Function),
        onEnd: expect.any(Function),
      }),
    );

    // The next click skips active speech and the text animation.
    fireEvent.click(background);
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
    expect(mocks.setState).toHaveBeenCalledWith({
      guideShowing: true,
      guideTypingTimer: undefined,
    });
    rerender(<Guide />);

    expect(
      container.querySelector('.ocean-guide__final-text--shown')?.textContent,
    ).toContain('Localized guide text');
    expect(mocks.dismissCurrentGuide).not.toHaveBeenCalled();

    // A later click can now advance the completed guide.
    fireEvent.click(background);
    expect(mocks.dismissCurrentGuide).toHaveBeenCalledTimes(1);
  });

  it('cancels speech when Continue closes an Info guide', () => {
    mocks.currentGuide = {
      id: 'info-guide',
      textFn: () => 'More information',
      style: 'Info',
    };
    const {getByRole} = render(<Guide />);

    fireEvent.click(getByRole('button', {name: 'continue'}));

    expect(mocks.cancel).toHaveBeenCalledTimes(1);
    expect(mocks.dismissGuide).toHaveBeenCalledWith('info-guide');
  });

  it('keeps guide clicks working when narration is disabled', () => {
    mocks.state.textToSpeechEnabled = false;
    mocks.state.guideShowing = true;
    mocks.dismissCurrentGuide.mockReturnValue(true);
    const {container} = render(<Guide />);

    fireEvent.click(container.querySelector('#uitest-dismiss-guide')!);

    expect(mocks.speak).not.toHaveBeenCalled();
    expect(mocks.dismissCurrentGuide).toHaveBeenCalledTimes(1);
  });

  it('plays the existing typing sound ten times per second when narration is off', () => {
    mocks.state.textToSpeechEnabled = false;
    vi.useFakeTimers();
    try {
      const {container} = render(<Guide />);
      vi.advanceTimersByTime(300);

      expect(mocks.playSound).toHaveBeenCalledTimes(3);
      expect(mocks.playSound).toHaveBeenNthCalledWith(1, 'no', 0.5);
      expect(mocks.playSound).toHaveBeenNthCalledWith(2, 'no', 0.5);
      expect(mocks.playSound).toHaveBeenNthCalledWith(3, 'no', 0.5);

      fireEvent.click(container.querySelector('[data-testid="typing-complete"]')!);
      expect(mocks.playSound).toHaveBeenCalledTimes(3);
      vi.advanceTimersByTime(300);
      expect(mocks.playSound).toHaveBeenCalledTimes(3);
      expect(mocks.setState).toHaveBeenCalledWith({
        guideShowing: true,
        guideTypingTimer: undefined,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
