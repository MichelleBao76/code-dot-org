import {expect, test} from 'playwright/test';

import {FishVTrashPage} from './poms/FishVTrashPage';
import {OceansPage} from './poms/OceansPage';

test('training exposes a question and object description, and retains answer focus', async ({
  page,
}) => {
  const oceans = await FishVTrashPage.load(page);
  const status = page.locator('#ocean-scene-description');
  await expect(oceans.yesButton).toBeEnabled();
  await expect(status).toContainText('Item 1. Is this a fish?');
  await expect(status).not.toContainText('description is not available');
  await expect(page.locator('canvas')).toHaveCount(2);
  for (const canvas of await page.locator('canvas').all())
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  await oceans.yesButton.focus();
  await page.keyboard.press('Enter');
  await expect(oceans.trainCount).toHaveText('1');
  await expect(oceans.yesButton).toBeFocused();
  await expect(oceans.yesButton).toBeEnabled();
  await expect(status).toContainText('Item 2.');
  await page.keyboard.press('Enter');
  await expect(oceans.trainCount).toHaveText('2');
  await expect(oceans.yesButton).toBeFocused();
});

test('guide gives full text once and provides keyboard Continue', async ({
  page,
}) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({timeout: 30_000});
  await expect(dialog).toHaveAttribute('aria-describedby', 'ocean-guide-text');
  await expect(dialog.locator('#ocean-guide-text')).not.toBeEmpty();
  await expect(dialog.locator('.ocean-guide__typing-text')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  const next = dialog.getByRole('button', {name: 'Continue', exact: true});
  await expect(next).toHaveAttribute('aria-label', 'Continue');
  await expect(next).toHaveCSS('clip-path', 'none');
  const initialBox = await next.boundingBox();
  expect(initialBox!.height).toBeGreaterThanOrEqual(44);
  await expect(next).toBeFocused();
  await expect(next).toHaveAccessibleDescription(
    (await dialog.locator('#ocean-guide-text').innerText()).trim(),
  );
  await page.keyboard.press('Tab');
  await expect(next).toBeFocused();
  const dialogBox = await dialog.boundingBox();
  const buttonBox = await next.boundingBox();
  expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(
    dialogBox!.y + dialogBox!.height + 1,
  );
  await page.keyboard.press('Tab');
  await expect(next).toBeFocused();
  const text = await dialog.locator('#ocean-guide-text').textContent();
  await page.keyboard.press('Enter');
  await expect(dialog.locator('#ocean-guide-text')).not.toHaveText(text!);
  await expect(next).toBeFocused();
});

test('erase dialog traps focus and Escape returns to Erase', async ({page}) => {
  const oceans = await FishVTrashPage.load(page);
  await oceans.eraseButton.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', {name: 'Are you sure?'});
  await expect(dialog).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', {name: 'Cancel'})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', {name: 'Erase'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(oceans.eraseButton).toBeFocused();
});

test('results can be read and individual objects selected with the keyboard', async ({
  page,
}) => {
  const oceans = await FishVTrashPage.load(page);
  await oceans.fullFlow(2, 2);
  await expect(page.locator('#ocean-scene-description')).toContainText(
    /The AI correctly classified \d+ out of \d+ objects\./,
  );
  const summary = page.locator('.ocean-accessible-results summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ocean-accessible-results')).toHaveAttribute(
    'open',
    '',
  );
  const object = page.locator('.ocean-accessible-results button').first();
  await expect(object).toContainText('Object 1:');
  await object.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', {name: 'Close details'})).toBeVisible();
  await page.getByRole('button', {name: 'Close details'}).focus();
  await page.keyboard.press('Enter');
  await expect(object).toBeFocused();
});

test('host-provided translated labels and language are exposed', async ({
  page,
}) => {
  await page.goto('/?guide=off&mode=creaturesvtrashdemo');
  const oceans = new OceansPage(page);
  await oceans.waitForPredictScene();
  await page.evaluate(async () => {
    const i18nPath = '/src/oceans/i18n.ts';
    const statePath = '/src/oceans/state.ts';
    const {default: i18n} = await import(i18nPath);
    const {setState} = await import(statePath);
    i18n.initI18n(
      {
        a11yLab: () => 'Océans',
        a11yStagePredicting: () => 'Observez le tri',
        a11yPredictions: () => 'Descriptions du tri',
      },
      'fr',
    );
    setState({});
  });
  await expect(page.getByRole('region', {name: 'Océans'})).toHaveAttribute(
    'lang',
    'fr',
  );
  await expect(
    page.getByRole('heading', {name: 'Observez le tri'}),
  ).toBeAttached();
  await expect(page.locator('summary')).toHaveText('Descriptions du tri');
});

test('generated fish can be classified by keyboard after choosing a word', async ({
  page,
}) => {
  await page.goto('/?guide=off&mode=short');
  const blue = page.getByRole('button', {name: 'Blue', exact: true});
  await expect(blue).toBeVisible();
  await blue.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ocean-scene-heading')).toHaveText('Train the AI');
  await expect(page.locator('.ocean-scene-heading')).toBeFocused();
  const answer = page.locator('.ocean-train__button-yes');
  await expect(answer).toBeEnabled();
  await expect(page.locator('#ocean-scene-description')).toContainText(
    'body color',
  );
  await expect(page.locator('#ocean-scene-description')).toContainText('fins');
  await answer.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#uitest-train-count')).toHaveText('1');
});

test('sorting exposes descriptions of predictions already shown in the animation', async ({
  page,
}) => {
  await page.goto('/?guide=off&mode=creaturesvtrashdemo');
  const oceans = new OceansPage(page);
  await oceans.waitForPredictScene();
  await oceans.runButton.focus();
  await page.keyboard.press('Enter');
  const summary = page.locator('.ocean-accessible-results summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  const result = page.locator('.ocean-accessible-results li').first();
  await expect(result).toContainText('AI prediction:', {timeout: 20_000});
  await expect(result).not.toContainText('description is not available');
  await expect(page.locator('#ocean-scene-description')).toContainText(
    'AI prediction:',
  );
});
