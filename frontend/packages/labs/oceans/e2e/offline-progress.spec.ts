import {expect, test} from 'playwright/test';

import {OceansPage} from './poms/OceansPage';

for (const mode of ['fishvtrash', 'long']) {
  test(`${mode}: keep training offline, reconnect, and restore saved training`, async ({
    page,
    context,
  }) => {
    await page.goto(`/?guide=off&mode=${mode}`);
    const oceans = new OceansPage(page);
    if (mode === 'long') await oceans.wordButtons.first().click();
    await oceans.waitForTrainingScene();
    const yes = page.locator('.ocean-train__button-yes');
    await expect(yes).not.toHaveAttribute('aria-disabled', 'true');
    await yes.click();
    await expect(oceans.trainCount).toHaveText('1');
    await expect(page.locator('.ocean-connectivity')).toContainText(
      'Training saved',
    );
    await context.setOffline(true);
    await expect(page.locator('.ocean-connectivity')).toContainText(
      'appear to be offline',
    );
    await expect(yes).not.toHaveAttribute('aria-disabled', 'true');
    await yes.click();
    await expect(oceans.trainCount).toHaveText('2');
    await context.setOffline(false);
    await expect(page.locator('.ocean-connectivity')).toContainText(
      'Connection detected again',
    );
    await page.reload();
    await oceans.waitForTrainingScene();
    await expect(oceans.trainCount).toHaveText('2');
    await context.setOffline(true);
    await oceans.trainingContinueButton.click();
    await oceans.waitForPredictScene();
    await oceans.runButton.click();
    await expect(oceans.mediaControlsContainer).toBeVisible();
    await oceans.fastForwardButton.click();
    await expect(oceans.predictContinueButton).toBeVisible({timeout: 45_000});
    await oceans.predictContinueButton.click();
    await expect(oceans.trainMoreButton).toBeVisible();
    await context.setOffline(false);
  });
}
