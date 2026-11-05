import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {findGuideClip, playSynced} from '../../../src/utils/guideAudio';

class FakeAudio extends EventTarget {
  static last: FakeAudio;
  static playResult: Promise<void> = Promise.resolve();
  currentTime = 0;
  duration = NaN;
  pause = vi.fn(() => this.dispatchEvent(new Event('timeupdate')));
  play = vi.fn(() => FakeAudio.playResult);
  constructor(public src: string) {
    super();
    FakeAudio.last = this;
  }
}

describe('playSynced', () => {
  let frames: FrameRequestCallback[];
  const runFrame = () => frames.splice(0).forEach(fn => fn(0));
  const callbacks = () => ({
    onProgress: vi.fn(),
    onEnd: vi.fn(),
    onFail: vi.fn(),
  });

  beforeEach(() => {
    vi.useFakeTimers();
    frames = [];
    FakeAudio.playResult = Promise.resolve();
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
      frames.push(fn);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames = [];
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports progress on every frame once the duration is known', () => {
    const cb = callbacks();
    playSynced('clip.mp3', cb);

    runFrame();
    expect(cb.onProgress).not.toHaveBeenCalled();

    FakeAudio.last.duration = 10;
    FakeAudio.last.currentTime = 2.5;
    runFrame();
    expect(cb.onProgress).toHaveBeenLastCalledWith(0.25);

    FakeAudio.last.currentTime = 5;
    runFrame();
    expect(cb.onProgress).toHaveBeenLastCalledWith(0.5);
  });

  it('finishes at full progress when the clip ends', () => {
    const cb = callbacks();
    playSynced('clip.mp3', cb);

    FakeAudio.last.dispatchEvent(new Event('ended'));

    expect(cb.onProgress).toHaveBeenLastCalledWith(1);
    expect(cb.onEnd).toHaveBeenCalledTimes(1);
  });

  it('reports nothing after stop, even though pausing fires an update', () => {
    const cb = callbacks();
    const clip = playSynced('clip.mp3', cb);
    FakeAudio.last.duration = 10;
    FakeAudio.last.currentTime = 1;

    clip.stop();
    runFrame();
    FakeAudio.last.dispatchEvent(new Event('ended'));

    expect(FakeAudio.last.pause).toHaveBeenCalled();
    expect(cb.onProgress).not.toHaveBeenCalled();
    expect(cb.onEnd).not.toHaveBeenCalled();
    expect(cb.onFail).not.toHaveBeenCalled();
  });

  it('fails when the browser blocks or rejects playback', async () => {
    FakeAudio.playResult = Promise.reject(new Error('NotAllowedError'));
    const cb = callbacks();
    playSynced('clip.mp3', cb);

    await vi.advanceTimersByTimeAsync(0);

    expect(cb.onFail).toHaveBeenCalledTimes(1);
  });

  it('fails when the file cannot be loaded', () => {
    const cb = callbacks();
    playSynced('missing.mp3', cb);

    FakeAudio.last.dispatchEvent(new Event('error'));

    expect(cb.onFail).toHaveBeenCalledTimes(1);
  });

  it('fails if the clip never starts, so text is never left blank', () => {
    FakeAudio.playResult = new Promise(() => {});
    const cb = callbacks();
    playSynced('slow.mp3', cb);

    vi.advanceTimersByTime(5000);

    expect(cb.onFail).toHaveBeenCalledTimes(1);
  });

  it('does not time out once the clip is playing', () => {
    const cb = callbacks();
    playSynced('clip.mp3', cb);

    FakeAudio.last.dispatchEvent(new Event('playing'));
    vi.advanceTimersByTime(60_000);

    expect(cb.onFail).not.toHaveBeenCalled();
  });
});

describe('findGuideClip', () => {
  it('returns nothing for a guide with no clip', () => {
    expect(findGuideClip('no-such-guide', 'en-US')).toBeUndefined();
  });
});
