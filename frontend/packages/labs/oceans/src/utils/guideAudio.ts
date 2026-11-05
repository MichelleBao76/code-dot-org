/**
 * Prerecorded guide narration, with progress reporting so the text on screen
 * can follow the voice.  Unlike Web Speech, an audio file exposes currentTime
 * and duration.
 *
 * Clips live at src/assets/guide-audio/<language>/<guide id>.<mp3|m4a>, and a
 * guide with no clip simply uses Web Speech.
 */
const clipUrls = import.meta.glob('../assets/guide-audio/*/*.{mp3,m4a}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** How long a clip may take to start before the guide falls back without it. */
const START_TIMEOUT_MS = 4000;

/** The clip for a guide in `lang`, trying "es-mx" and then "es". */
export function findGuideClip(
  guideId: string,
  lang: string,
): string | undefined {
  const fullLang = lang.toLowerCase().replace('_', '-');
  const candidates = [fullLang, fullLang.split('-')[0]];
  for (const candidate of candidates) {
    for (const extension of ['mp3', 'm4a']) {
      const url =
        clipUrls[`../assets/guide-audio/${candidate}/${guideId}.${extension}`];
      if (url) {
        return url;
      }
    }
  }
  return undefined;
}

export interface SyncedAudioCallbacks {
  /** Called on each animation frame with playback progress from 0 to 1. */
  onProgress: (fraction: number) => void;
  onEnd: () => void;
  /** Called if the clip can't load, is blocked, or never starts. */
  onFail: () => void;
}

export interface SyncedAudio {
  /** Stops playback.  No callback fires after this returns. */
  stop: () => void;
}

/** Plays `url`, reporting progress until it ends, fails, or is stopped. */
export function playSynced(
  url: string,
  {onProgress, onEnd, onFail}: SyncedAudioCallbacks,
): SyncedAudio {
  const audio = new Audio(url);
  let finished = false;
  let frame = 0;

  const release = () => {
    finished = true;
    cancelAnimationFrame(frame);
    clearTimeout(startTimer);
  };
  const fail = () => {
    if (!finished) {
      release();
      audio.pause();
      onFail();
    }
  };
  const tick = () => {
    if (finished) {
      return;
    }
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      onProgress(Math.min(audio.currentTime / audio.duration, 1));
    }
    frame = requestAnimationFrame(tick);
  };
  const startTimer = setTimeout(fail, START_TIMEOUT_MS);

  audio.addEventListener('playing', () => clearTimeout(startTimer));
  audio.addEventListener('error', fail);
  audio.addEventListener('ended', () => {
    if (!finished) {
      release();
      onProgress(1);
      onEnd();
    }
  });
  audio.play()?.catch(fail);
  frame = requestAnimationFrame(tick);

  return {
    // Mark finished before pausing: pausing fires one last time update, which
    // would otherwise pull text that was just shown in full back to partial.
    stop: () => {
      if (!finished) {
        release();
        audio.pause();
      }
    },
  };
}
