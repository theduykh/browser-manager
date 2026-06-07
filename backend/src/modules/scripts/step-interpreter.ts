import { Page } from 'playwright';
import { config } from '../../config';
import { ScriptStep } from './types';

// Execute a single step against a connected page. Throws on failure; the runner
// records the failure and decides whether to continue.
export async function runStep(page: Page, step: ScriptStep): Promise<void> {
  const timeout = config.scriptStepTimeoutMs;
  switch (step.type) {
    case 'navigate':
      await page.goto(step.url, { timeout, waitUntil: 'load' });
      return;
    case 'click':
      await page.click(step.selector, { timeout });
      return;
    case 'fill':
      await page.fill(step.selector, step.value, { timeout });
      return;
    case 'press':
      if (step.selector) await page.press(step.selector, step.key, { timeout });
      else await page.keyboard.press(step.key);
      return;
    case 'select':
      await page.selectOption(step.selector, step.value, { timeout });
      return;
    case 'check':
      await page.check(step.selector, { timeout });
      return;
    case 'uncheck':
      await page.uncheck(step.selector, { timeout });
      return;
    case 'waitForSelector':
      await page.waitForSelector(step.selector, { timeout: step.timeoutMs ?? timeout });
      return;
    case 'waitForTimeout':
      await page.waitForTimeout(step.ms);
      return;
  }
}
