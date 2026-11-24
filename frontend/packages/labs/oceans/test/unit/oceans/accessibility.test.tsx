import {cleanup, fireEvent, render, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import Button from '@/oceans/components/common/Button';
import Dialog from '@/oceans/components/common/Dialog';
import SceneDescription from '@/oceans/components/common/SceneDescription';
import {Modes} from '@/oceans/constants';
import {describeObject} from '@/oceans/describeObject';
import I18n from '@/oceans/i18n';
import {FishOceanObject, TrashOceanObject} from '@/oceans/OceanObject';
import {getState, resetState, setState} from '@/oceans/state';
import {fishData, initFishData} from '@/utils/fishData';
import {trashImagePaths} from '@/utils/imagePaths';

vi.mock('@/oceans/models/soundLibrary', () => ({
  default: {playSound: vi.fn()},
}));
afterEach(cleanup);
beforeEach(() => {
  resetState();
  I18n.initI18n();
  initFishData();
});

describe('object descriptions', () => {
  it('describes generated features after classifier normalization', () => {
    const fish = new FishOceanObject(1);
    fish.body = fishData.bodies.circle_1;
    fish.mouth = Object.values(fishData.mouths)[0];
    fish.eye = fishData.eyes.eyes11;
    fish.colorPalette = {
      bodyRgb: fishData.colors.blue.rgb,
      finRgb: fishData.colors.red.rgb,
    };
    const description = describeObject(fish);
    expect(description).toContain('round body');
    expect(description).toContain('blue body color');
    expect(description).toContain('red fins');
    expect(description).toContain('2 visible teeth');
    expect(description).toContain('eyebrows slanting down toward the nose');
    expect(description).not.toMatch(/delicious|not fish/i);
  });
  it('describes the image asset rather than its filename or classification', () => {
    const item = new TrashOceanObject(2);
    item.image = new Image();
    item.image.src = trashImagePaths[3];
    expect(describeObject(item)).toBe('A plastic bottle.');
  });
  it('uses author-supplied descriptions for imported or generated images', () => {
    const fish = new FishOceanObject(3);
    fish.accessibleDescription = 'A silver fish with two dark stripes.';
    expect(describeObject(fish)).toBe(fish.accessibleDescription);
  });
  it('uses translated descriptions and records the selected language', () => {
    I18n.initI18n({a11yUnknownObject: () => 'Description indisponible.'}, 'fr');
    expect(describeObject(undefined)).toBe('Description indisponible.');
    expect(I18n.getLocale()).toBe('fr');
    expect(I18n.getMessageLocale('a11yUnknownObject')).toBe('fr');
    expect(I18n.getMessageLocale('a11yLab')).toBe('en');
  });
});

it('announces a new question without replacing focus on each animation frame', () => {
  setState({currentMode: Modes.Training, trainingQuestion: 'Is this a fish?'});
  const {getByRole, rerender} = render(<SceneDescription state={getState()} />);
  const heading = getByRole('heading');
  expect(document.activeElement).toBe(heading);
  expect(getByRole('status').textContent).toContain('Item 1. Is this a fish?');
  const control = document.createElement('button');
  document.body.append(control);
  control.focus();
  setState({trainingIndex: 1});
  rerender(<SceneDescription state={getState()} />);
  expect(getByRole('status').textContent).toContain('Item 2.');
  expect(document.activeElement).toBe(control);
  control.remove();
});

it('announces the correct total on the results scene', () => {
  setState({
    currentMode: Modes.Pond,
    totalCorrectPredictions: 25,
    fishData: Array.from({length: 30}, (_, index) =>
      new TrashOceanObject(index),
    ),
  });
  const {getByRole} = render(<SceneDescription state={getState()} />);
  expect(getByRole('status').textContent).toBe(
    'The AI correctly classified 25 out of 30 objects.',
  );
});

it('keeps answer focus while blocking animation-time clicks', () => {
  const answer = vi.fn();
  const {getByRole, rerender} = render(<Button onClick={answer}>Yes</Button>);
  getByRole('button').focus();
  rerender(
    <Button disabled preserveFocusWhenDisabled onClick={answer}>
      Yes
    </Button>,
  );
  fireEvent.click(getByRole('button'));
  expect(answer).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(getByRole('button'));
  expect(getByRole('button').getAttribute('aria-disabled')).toBe('true');
});

it('traps Tab, supports Escape, and returns focus when a dialog closes', async () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const dismiss = vi.fn();
  const {getByRole, unmount} = render(
    <Dialog aria-label="Erase training" onDismiss={dismiss}>
      <button>Erase</button>
      <button>Cancel</button>
    </Dialog>,
  );
  const dialog = getByRole('dialog');
  expect(document.activeElement).toBe(dialog);
  fireEvent.keyDown(dialog, {key: 'Tab', shiftKey: true});
  expect(document.activeElement).toBe(getByRole('button', {name: 'Cancel'}));
  fireEvent.keyDown(document.activeElement!, {key: 'Tab'});
  expect(document.activeElement).toBe(getByRole('button', {name: 'Erase'}));
  fireEvent.keyDown(dialog, {key: 'Escape'});
  expect(dismiss).toHaveBeenCalledTimes(1);
  unmount();
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  trigger.remove();
});
