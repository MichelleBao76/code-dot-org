/**
 * Text-to-speech for the lab, built on the browser's Web Speech API.
 *
 * The rest of the lab only uses speak / cancel / isSupported, so the engine
 * can be swapped later without touching UI code.
 *
 * Deliberately avoids the `boundary` event and `pause()`: Chrome for Android
 * never fires `boundary`, and its `pause()` behaves like `cancel()`.
 */
import en from './textToSpeech/en.json';
import it from './textToSpeech/it.json';

interface PreferredVoice {
  name: string;
  altNames?: string[];
}

/** Higher-quality voices to prefer when installed, keyed by language. */
const PREFERRED_VOICES: Record<string, {voices: PreferredVoice[]}> = {en, it};

/** How long to wait for the browser to list its voices before giving up. */
const VOICE_LOAD_TIMEOUT_MS = 2000;

/** Rough speaking speed at rate 1, used only for the end-of-speech fallback. */
const CHARS_PER_SECOND = 14;

export interface SpeakCallbacks {
  onStart?: () => void;
  /** Called once when speech finishes, fails, or is cut short by the browser. */
  onEnd?: () => void;
}

/** Bumped on every speak/cancel so stale queued speech never starts. */
let generation = 0;
let endFallbackTimer: ReturnType<typeof setTimeout> | undefined;
let voicesLoaded: Promise<void> | null = null;

function getSynth(): SpeechSynthesis | null {
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return null;
  }
  return window.speechSynthesis;
}

const primaryLanguage = (lang: string | undefined) =>
  (lang || '').toLowerCase().split(/[-_]/)[0];
const normalizeLang = (lang: string | undefined) =>
  (lang || '').toLowerCase().replace('_', '-');

/** The best installed voice for `lang`, or null if none speaks it. */
function findVoice(synth: SpeechSynthesis, lang: string) {
  if (!primaryLanguage(lang)) {
    return null;
  }
  const sameLanguage = synth
    .getVoices()
    .filter(voice => primaryLanguage(voice.lang) === primaryLanguage(lang));
  const sameRegion = sameLanguage.filter(
    voice => normalizeLang(voice.lang) === normalizeLang(lang),
  );
  const pool = sameRegion.length ? sameRegion : sameLanguage;
  if (!pool.length) {
    return null;
  }
  for (const preferred of PREFERRED_VOICES[primaryLanguage(lang)]?.voices ??
    []) {
    const names = [preferred.name, ...(preferred.altNames ?? [])];
    const match = pool.find(voice => names.includes(voice.name));
    if (match) {
      return match;
    }
  }
  return pool.find(voice => voice.default) ?? pool[0];
}

/**
 * Resolves once the browser has listed its voices.  getVoices() is often
 * empty at first and fills in later via `voiceschanged`; some browsers never
 * fire it, so this also gives up after a short timeout.
 */
export function whenVoicesReady(): Promise<void> {
  const synth = getSynth();
  if (!synth || synth.getVoices().length > 0) {
    return Promise.resolve();
  }
  if (!voicesLoaded) {
    voicesLoaded = new Promise(resolve => {
      const done = () => {
        synth.removeEventListener?.('voiceschanged', done);
        clearTimeout(timer);
        voicesLoaded = null;
        resolve();
      };
      const timer = setTimeout(done, VOICE_LOAD_TIMEOUT_MS);
      try {
        synth.addEventListener('voiceschanged', done);
      } catch {
        // No voiceschanged support: the timeout above still settles this.
      }
    });
  }
  return voicesLoaded;
}

/** True if the browser can speak `lang` with an installed voice right now. */
export function isSupported(lang: string): boolean {
  const synth = getSynth();
  try {
    return !!synth && !!findVoice(synth, lang);
  } catch {
    return false;
  }
}

/** Stops any speech in progress and drops any speech waiting to start. */
export function cancel(): void {
  generation++;
  clearTimeout(endFallbackTimer);
  try {
    getSynth()?.cancel();
  } catch {
    // Speech is optional; a broken engine must never break the lab.
  }
}

/**
 * Speaks `text` in `lang` (BCP-47, e.g. "en-US" or "de"), replacing any
 * speech already in progress.
 *
 * @returns False if speech is unavailable for `lang`, in which case nothing
 *   happens and nothing throws. True if speech started, or is waiting for the
 *   browser's voice list (it then starts only if a matching voice appears).
 */
export function speak(
  text: string,
  lang: string,
  callbacks: SpeakCallbacks = {},
): boolean {
  const synth = getSynth();
  if (!synth || !text.trim() || !primaryLanguage(lang)) {
    return false;
  }
  cancel();
  const myGeneration = generation;

  try {
    if (synth.getVoices().length > 0) {
      return startUtterance(synth, text, lang, callbacks);
    }
  } catch {
    return false;
  }
  whenVoicesReady().then(() => {
    if (myGeneration === generation) {
      try {
        startUtterance(synth, text, lang, callbacks);
      } catch {
        // No audio; the text is still on screen.
      }
    }
  });
  return true;
}

function startUtterance(
  synth: SpeechSynthesis,
  text: string,
  lang: string,
  {onStart, onEnd}: SpeakCallbacks,
): boolean {
  const voice = findVoice(synth, lang);
  if (!voice) {
    return false;
  }
  const myGeneration = generation;
  let ended = false;
  const finish = () => {
    if (ended) {
      return;
    }
    ended = true;
    if (myGeneration === generation) {
      clearTimeout(endFallbackTimer);
    }
    onEnd?.();
  };

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.onstart = () => {
    onStart?.();
    // Some browsers cut long speech short without firing `end`; finish anyway
    // once well past the expected length.
    const expectedMs = (text.length / CHARS_PER_SECOND) * 1000;
    clearTimeout(endFallbackTimer);
    endFallbackTimer = setTimeout(finish, expectedMs * 1.5 + 2000);
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  synth.speak(utterance);
  return true;
}
