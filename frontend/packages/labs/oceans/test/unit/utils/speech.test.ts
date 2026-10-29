import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

type Handler = () => void;

interface FakeUtterance {
  text: string;
  lang: string;
  voice: {name: string; lang: string} | null;
  onstart: Handler | null;
  onend: Handler | null;
  onerror: Handler | null;
}

const voice = (name: string, lang: string, isDefault = false) => ({
  name,
  lang,
  default: isDefault,
  localService: true,
  voiceURI: name,
});

/** Minimal stand-in for window.speechSynthesis, which jsdom lacks. */
function installFakeSpeech(initialVoices: ReturnType<typeof voice>[]) {
  let voices = initialVoices;
  const listeners: Handler[] = [];
  const spoken: FakeUtterance[] = [];
  const synth = {
    getVoices: () => voices,
    speak: vi.fn((utterance: FakeUtterance) => spoken.push(utterance)),
    cancel: vi.fn(),
    addEventListener: (_: string, fn: Handler) => listeners.push(fn),
    removeEventListener: (_: string, fn: Handler) => {
      const i = listeners.indexOf(fn);
      if (i >= 0) {
        listeners.splice(i, 1);
      }
    },
  };
  class Utterance implements FakeUtterance {
    lang = '';
    voice = null;
    onstart = null;
    onend = null;
    onerror = null;
    constructor(public text: string) {}
  }
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  return {
    synth,
    spoken,
    loadVoices(next: ReturnType<typeof voice>[]) {
      voices = next;
      [...listeners].forEach(fn => fn());
    },
  };
}

async function loadSpeech() {
  vi.resetModules();
  return import('../../../src/utils/speech');
}

describe('speech', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does nothing and reports unsupported when the browser has no speech', async () => {
    vi.stubGlobal('speechSynthesis', undefined);
    // `'speechSynthesis' in window` is still true with a stubbed undefined,
    // so also remove the utterance constructor the way old browsers lack it.
    vi.stubGlobal('SpeechSynthesisUtterance', undefined);
    const speech = await loadSpeech();
    expect(speech.isSupported('en')).toBe(false);
    expect(speech.speak('Hello', 'en')).toBe(false);
    expect(() => speech.cancel()).not.toThrow();
  });

  it('speaks with a voice for the requested language, cancelling first', async () => {
    const fake = installFakeSpeech([
      voice('Alex', 'en-US', true),
      voice('Mónica', 'es-ES'),
    ]);
    const speech = await loadSpeech();

    expect(speech.speak('Hola', 'es-MX')).toBe(true);

    expect(fake.synth.cancel).toHaveBeenCalled();
    expect(fake.spoken).toHaveLength(1);
    expect(fake.spoken[0].text).toBe('Hola');
    expect(fake.spoken[0].voice?.name).toBe('Mónica');
    expect(fake.spoken[0].lang).toBe('es-ES');
  });

  it('prefers a voice from the recommended list when installed', async () => {
    const fake = installFakeSpeech([
      voice('Fred', 'en-US', true),
      voice('Samantha', 'en-US'),
    ]);
    const speech = await loadSpeech();

    speech.speak('Hello', 'en-US');

    expect(fake.spoken[0].voice?.name).toBe('Samantha');
  });

  it('fails quietly when no voice speaks the language', async () => {
    const fake = installFakeSpeech([voice('Alex', 'en-US')]);
    const speech = await loadSpeech();

    expect(speech.isSupported('ja')).toBe(false);
    expect(speech.speak('こんにちは', 'ja')).toBe(false);
    expect(fake.spoken).toHaveLength(0);
  });

  it('does nothing when the language is missing', async () => {
    const fake = installFakeSpeech([voice('Alex', 'en-US')]);
    const speech = await loadSpeech();

    expect(speech.speak('Hello', '')).toBe(false);
    expect(speech.speak('Hello', undefined as unknown as string)).toBe(false);
    expect(speech.isSupported('')).toBe(false);
    expect(fake.spoken).toHaveLength(0);
  });

  it('never throws when the speech engine itself fails', async () => {
    const fake = installFakeSpeech([voice('Alex', 'en-US')]);
    fake.synth.speak.mockImplementation(() => {
      throw new Error('engine failure');
    });
    fake.synth.cancel.mockImplementation(() => {
      throw new Error('engine failure');
    });
    const speech = await loadSpeech();

    expect(() => speech.speak('Hello', 'en')).not.toThrow();
    expect(speech.speak('Hello', 'en')).toBe(false);
    expect(() => speech.cancel()).not.toThrow();
  });

  it('waits for voices to load before speaking', async () => {
    const fake = installFakeSpeech([]);
    const speech = await loadSpeech();

    expect(speech.speak('Hello', 'en')).toBe(true);
    expect(fake.spoken).toHaveLength(0);

    fake.loadVoices([voice('Alex', 'en-US')]);
    await Promise.resolve();

    expect(fake.spoken).toHaveLength(1);
  });

  it('drops speech still waiting for voices when cancelled', async () => {
    const fake = installFakeSpeech([]);
    const speech = await loadSpeech();

    speech.speak('First', 'en');
    speech.cancel();
    fake.loadVoices([voice('Alex', 'en-US')]);
    await Promise.resolve();

    expect(fake.spoken).toHaveLength(0);
  });

  it('keeps only the newest speech when called twice while voices load', async () => {
    const fake = installFakeSpeech([]);
    const speech = await loadSpeech();

    speech.speak('First', 'en');
    speech.speak('Second', 'en');
    fake.loadVoices([voice('Alex', 'en-US')]);
    await Promise.resolve();

    expect(fake.spoken.map(u => u.text)).toEqual(['Second']);
  });

  it('reports start and end from onstart and onend', async () => {
    const fake = installFakeSpeech([voice('Alex', 'en-US')]);
    const speech = await loadSpeech();
    const onStart = vi.fn();
    const onEnd = vi.fn();

    speech.speak('Hello there', 'en', {onStart, onEnd});
    fake.spoken[0].onstart?.();
    fake.spoken[0].onend?.();

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('still reports the end if the browser never fires onend', async () => {
    const fake = installFakeSpeech([voice('Alex', 'en-US')]);
    const speech = await loadSpeech();
    const onEnd = vi.fn();

    speech.speak('Hello there', 'en', {onEnd});
    fake.spoken[0].onstart?.();
    vi.advanceTimersByTime(60_000);

    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('reports the end once when speech fails', async () => {
    const fake = installFakeSpeech([voice('Alex', 'en-US')]);
    const speech = await loadSpeech();
    const onEnd = vi.fn();

    speech.speak('Hello', 'en', {onEnd});
    fake.spoken[0].onerror?.();
    fake.spoken[0].onend?.();

    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
