// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * VayuAI — Comprehensive End-to-End Interactive QA Suite (Playwright)
 * Covers every button, form, slider, select, modal, toggle, export, copy,
 * API loading/error state, keyboard navigation, and mobile viewport.
 */

test.describe('VayuAI Complete Interactive Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Open-Meteo Geocoding & Air Quality APIs for deterministic E2E testing
    await page.route('**/geocoding-api.open-meteo.com/**', async (route) => {
      const url = route.request().url();
      if (url.includes('ZzNotACity999')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) });
      }
      if (url.includes('Simulate503City')) {
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Upstream unavailable' }) });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{ name: 'Bengaluru', admin1: 'Karnataka', country: 'India', latitude: 12.97, longitude: 77.59 }],
        }),
      });
    });

    await page.route('**/air-quality-api.open-meteo.com/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          current: { pm2_5: 48.2, pm10: 76.5, nitrogen_dioxide: 24.1, sulphur_dioxide: 9.4 },
        }),
      });
    });

    await page.route('**/api/gemini', async (route) => {
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Fallback mode' }) });
    });

    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  });

  test('1. Header controls: theme toggle, voice advisory, walkthrough, and settings modal (including Escape)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Theme toggle round-trip
    const themeBtn = page.locator('#themeToggleBtn');
    const initialDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await themeBtn.click();
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(!initialDark);
    await themeBtn.click();
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(initialDark);

    // Voice advisory start/stop
    await page.evaluate(() => {
      window.__spoken = [];
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          speaking: false,
          cancel() { this.speaking = false; },
          speak(u) { this.speaking = true; window.__spoken.push(u.text); },
        },
        configurable: true,
      });
    });
    await page.locator('#voiceAdvisoryBtn').click();
    expect(await page.evaluate(() => window.__spoken.length)).toBeGreaterThanOrEqual(1);
    await page.locator('#voiceAdvisoryBtn').click();
    expect(await page.evaluate(() => window.speechSynthesis.speaking)).toBe(false);

    // Walkthrough start/stop
    const demoBtn = page.locator('#autoDemoBtn');
    await demoBtn.click();
    await expect(page.locator('#autoDemoLabel')).toHaveText(/Stop/i);
    await demoBtn.click();
    await expect(page.locator('#autoDemoLabel')).toHaveText(/Walkthrough/i);

    // Settings modal: open, save key, clear key, close button, Escape key
    await page.locator('#settingsBtn').click();
    await expect(page.locator('#apiModal')).toBeVisible();
    await page.locator('#geminiApiKeyInput').fill('AIzaSyPlaywrightTest123');
    await page.locator('#saveApiKeyBtn').click();
    await expect(page.locator('#apiModal')).toBeHidden();
    await expect(page.locator('#apiStatusLabel')).toContainText('Session Gemini Key Active');

    await page.locator('#settingsBtn').click();
    await page.locator('#clearApiKeyBtn').click();
    await expect(page.locator('#apiModal')).toBeHidden();
    await expect(page.locator('#apiStatusLabel')).toContainText('Zero-Key CPCB/WHO Engine');

    await page.locator('#settingsBtn').click();
    await page.locator('#closeApiModalBtn').click();
    await expect(page.locator('#apiModal')).toBeHidden();

    await page.locator('#settingsBtn').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#apiModal')).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('2. Overview telemetry: city preset, profile preset, custom AQI slider, benchmark, and live city sync (empty/not-found/503/success)', async ({ page }) => {
    await page.locator('#citySelector').selectOption('jodhpur');
    await expect(page.locator('#liveAqiValue')).toHaveText('265');

    await page.locator('#profileSelector').selectOption('hostel');
    expect(await page.locator('#purifierModelSelect').inputValue()).toBe('diy_2inch');
    expect(await page.locator('#roomAreaSlider').inputValue()).toBe('140');

    await page.locator('#customAqiSlider').fill('420');
    await page.locator('#customAqiSlider').dispatchEvent('input');
    await expect(page.locator('#liveAqiValue')).toHaveText('420');
    await expect(page.locator('#liveDataSourceBadge')).toContainText('Simulation');

    await page.locator('#compareCitySelect').selectOption('mumbai');
    await expect(page.locator('#cityCompareReadout')).toContainText('Mumbai');

    // Live city validation + error + success
    await page.locator('#liveCityInput').fill('');
    await page.locator('#liveCityFetchBtn').click();
    await expect(page.locator('#toastMessage')).toContainText(/Enter a city name/i);

    await page.locator('#liveCityInput').fill('ZzNotACity999');
    await page.locator('#liveCityFetchBtn').click();
    await expect(page.locator('#toastMessage')).toContainText(/not found/i);

    await page.locator('#liveCityInput').fill('Simulate503City');
    await page.locator('#liveCityFetchBtn').click();
    await expect(page.locator('#toastMessage')).toContainText(/Offline|unreachable|failed/i);

    await page.locator('#liveCityInput').fill('Bengaluru');
    await page.locator('#liveCityFetchBtn').click();
    await expect(page.locator('#cityTitleDisplay')).toContainText('Bengaluru');
    await expect(page.locator('#liveDataSourceBadge')).toContainText('Live Feed');
  });

  test('3. AI Assistant: language toggle, quick chips, empty validation, custom prompt, clear, and apply optimal plan', async ({ page }) => {
    const beforeLang = await page.locator('#langBadge').textContent();
    await page.locator('#langToggleBtn').click();
    expect(await page.locator('#langBadge').textContent()).not.toBe(beforeLang);

    const chips = page.locator('.ai-chip');
    expect(await chips.count()).toBe(3);
    for (let i = 0; i < 3; i++) {
      const before = await page.locator('#aiChatStream > div').count();
      await chips.nth(i).click();
      await expect(page.locator('#aiChatStream > div')).toHaveCount(before + 1);
    }

    // Empty prompt blocked
    const countBeforeEmpty = await page.locator('#aiChatStream > div').count();
    await page.locator('#aiPromptInput').fill('   ');
    await page.locator('#aiSubmitBtn').click();
    await expect(page.locator('#aiChatStream > div')).toHaveCount(countBeforeEmpty);

    // Valid prompt
    await page.locator('#aiPromptInput').fill('Best purifier for 180 sq ft hostel room?');
    await page.locator('#aiSubmitBtn').click();
    await expect(page.locator('#aiChatStream > div')).toHaveCount(countBeforeEmpty + 1);

    // Clear chat
    await page.locator('#clearChatBtn').click();
    await expect(page.locator('#aiChatStream > div')).toHaveCount(1);

    // Apply optimal plan
    await page.locator('#applyAiPlanBtn').click();
    await expect(page.locator('#kpiActiveRoutinesCount')).toContainText('6/6');
  });

  test('4. Navigation tabs (desktop & mobile) + keyboard Enter + Daily Shield controls', async ({ page, isMobile }) => {
    const tabSelector = isMobile ? 'header div.md\\:hidden button[data-tab]' : 'header nav button[data-tab]';
    for (const tab of ['overview', 'routines', 'home', 'impact']) {
      const btn = page.locator(`${tabSelector.replace(']', `="${tab}"]`)}`);
      await btn.click();
      await expect(page.locator(`#view-${tab}`)).toBeVisible();
      await expect(btn).toHaveAttribute('aria-current', 'page');
    }

    // Switch to Daily Shield
    const routinesTab = page.locator(`${tabSelector.replace(']', '="routines"]')}`);
    await routinesTab.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#view-routines')).toBeVisible();

    // Filter + empty state + reset filter
    await page.locator('#routineFilterInput').fill('N95');
    expect(await page.locator('[data-routine-id]').count()).toBeGreaterThan(0);
    await page.locator('#routineFilterInput').fill('xyznomatch999');
    await expect(page.locator('[data-routine-id]')).toHaveCount(0);
    await expect(page.locator('#routineListContainer')).toContainText('No routines match');
    await page.locator('#routineFilterInput').fill('');
    await expect(page.locator('[data-routine-id]')).toHaveCount(6);

    // All On & Reset
    await page.locator('#enableAllRoutinesBtn').click();
    await expect(page.locator('#kpiActiveRoutinesCount')).toContainText('6/6');
    await page.locator('#resetDefaultsBtn').click();
    await expect(page.locator('#kpiActiveRoutinesCount')).toContainText('5/6');

    // Toggle all 6 routine buttons with aria-pressed verification
    const routineIds = await page.locator('[data-routine-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-routine-id')));
    for (const rid of routineIds) {
      const btn = page.locator(`[data-routine-id="${rid}"]`);
      const before = await btn.getAttribute('aria-pressed');
      await btn.click();
      expect(await btn.getAttribute('aria-pressed')).not.toBe(before);
      await btn.click();
      expect(await btn.getAttribute('aria-pressed')).toBe(before);
    }

    // Mask select & outdoor hours slider
    await page.locator('#maskSelect').selectOption({ index: 2 });
    await expect(page.locator('#maskEfficiencyPct')).toContainText('%');
    await page.locator('#outdoorHoursSlider').fill('6');
    await page.locator('#outdoorHoursSlider').dispatchEvent('input');
    await expect(page.locator('#outdoorHoursReadout')).toContainText('6');
  });

  test('5. Home Air controls: purifier, room area, window seal, 4 zone cards, and 6 indoor hacks', async ({ page, isMobile }) => {
    const homeTab = isMobile ? 'header div.md\\:hidden button[data-tab="home"]' : 'header nav button[data-tab="home"]';
    await page.locator(homeTab).click();
    await expect(page.locator('#view-home')).toBeVisible();

    const achBefore = await page.locator('#achReadout').textContent();
    await page.locator('#purifierModelSelect').selectOption({ index: 2 });
    expect(await page.locator('#achReadout').textContent()).not.toBe(achBefore);

    await page.locator('#roomAreaSlider').fill('300');
    await page.locator('#roomAreaSlider').dispatchEvent('input');
    await expect(page.locator('#roomAreaReadout')).toContainText('300');

    const ioBefore = await page.locator('#ioRatioReadout').textContent();
    await page.locator('#windowSealSelect').selectOption({ index: 2 });
    expect(await page.locator('#ioRatioReadout').textContent()).not.toBe(ioBefore);

    await page.locator('#aiBalanceZonesBtn').click();
    const allTrue = await page.locator('[data-zone-id]').evaluateAll((els) => els.every((e) => e.getAttribute('aria-pressed') === 'true'));
    expect(allTrue).toBe(true);

    await page.locator('#resetZonesBtn').click();
    const zoneIds = await page.locator('[data-zone-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-zone-id')));
    for (const zid of zoneIds) {
      const card = page.locator(`[data-zone-id="${zid}"]`);
      const before = await card.getAttribute('aria-pressed');
      await card.click();
      expect(await card.getAttribute('aria-pressed')).not.toBe(before);
    }

    const hackIds = await page.locator('[data-hack-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-hack-id')));
    for (const hid of hackIds) {
      const btn = page.locator(`[data-hack-id="${hid}"]`);
      const before = await btn.getAttribute('aria-pressed');
      await btn.click();
      expect(await btn.getAttribute('aria-pressed')).not.toBe(before);
    }
  });

  test('6. Impact & Export: commute calculator, SVG/JSON/MD downloads, print, WhatsApp copy, submission helper, and a11y audit', async ({ page, isMobile }) => {
    const impactTab = isMobile ? 'header div.md\\:hidden button[data-tab="impact"]' : 'header nav button[data-tab="impact"]';
    await page.locator(impactTab).click();
    await expect(page.locator('#view-impact')).toBeVisible();

    const co2Before = await page.locator('#swapAnnualCo2Readout').textContent();
    await page.locator('#baselineModeSelect').selectOption({ index: 2 });
    expect(await page.locator('#swapAnnualCo2Readout').textContent()).not.toBe(co2Before);

    const cutBefore = await page.locator('#swapPctCutReadout').textContent();
    await page.locator('#sustainableSwapSelect').selectOption({ index: 1 });
    expect(await page.locator('#swapPctCutReadout').textContent()).not.toBe(cutBefore);

    await page.locator('#commuteKmSlider').fill('40');
    await page.locator('#commuteKmSlider').dispatchEvent('input');
    await expect(page.locator('#commuteKmReadout')).toContainText('40');

    await page.locator('#commuteDaysSlider').fill('5');
    await page.locator('#commuteDaysSlider').dispatchEvent('input');
    await expect(page.locator('#commuteDaysReadout')).toContainText('5');

    await page.locator('#communityUnitsSlider').fill('250');
    await page.locator('#communityUnitsSlider').dispatchEvent('input');
    await expect(page.locator('#communityUnitsReadout')).toContainText('250');

    // Downloads (SVG, JSON, MD)
    for (const btnId of ['#downloadSvgPosterBtn', '#exportJsonBtn', '#exportMdBtn']) {
      const dlPromise = page.waitForEvent('download');
      await page.locator(btnId).click();
      const dl = await dlPromise;
      expect(dl.suggestedFilename().length).toBeGreaterThan(3);
    }

    // Print
    await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await page.locator('#printPdfBtn').click();
    expect(await page.evaluate(() => window.__printed)).toBe(1);

    // Copy WhatsApp bulletin + Submission Helper <details> copy buttons
    await page.locator('#copyBulletinBtn').click();
    await expect(page.locator('#toastMessage')).toContainText(/Copied/i);

    await page.locator('#view-impact details summary').click();
    await expect(page.locator('#subQ1Long')).toBeVisible();
    await page.locator('.copy-btn[data-copy-target="subQ1Long"]').click();
    await page.locator('.copy-btn[data-copy-target="subQ2Long"]').click();

    // Global accessibility check: every button has an accessible name, every input/select/textarea has a label
    const a11y = await page.evaluate(() => {
      const missingBtn = [...document.querySelectorAll('button')].filter(
        (b) => !(b.innerText.trim() || b.getAttribute('aria-label') || b.getAttribute('title'))
      ).length;
      const missingInput = [...document.querySelectorAll('select, input, textarea')].filter(
        (el) => !(el.getAttribute('aria-label') || el.getAttribute('title') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label'))
      ).length;
      const badLinks = [...document.querySelectorAll('a[href]')].filter(
        (a) => !a.href.startsWith('https://') || a.target !== '_blank' || !(a.rel || '').includes('noopener')
      ).length;
      return { missingBtn, missingInput, badLinks };
    });
    expect(a11y).toEqual({ missingBtn: 0, missingInput: 0, badLinks: 0 });
  });
});
