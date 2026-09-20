import { test, expect } from '@playwright/test';

test.describe('SOUND + HAPTIC ENGINE - Verification Suite', () => {

  test('1. Central AudioEngine Procedural Synthesis & Haptic Dispatch', async ({ page }) => {
    // Intercept navigator.vibrate to verify haptic pulses
    await page.addInitScript(() => {
      window.__vibrateCalls = [];
      navigator.vibrate = (pattern) => {
        window.__vibrateCalls.push(pattern);
        return true;
      };
    });

    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // Test all 10 sound & haptic events via client window
    const results = await page.evaluate(async () => {
      const audioEngine = window.audioEngine;
      if (!audioEngine) throw new Error("window.audioEngine not found on window object");
      
      const events = [
        'click', 'bet', 'accepted', 'countdown', 
        'card', 'win', 'loss', 'jackpot', 
        'roundStart', 'roundEnd'
      ];

      const executed = [];
      for (const ev of events) {
        try {
          audioEngine.play(ev);
          executed.push(ev);
        } catch (e) {
          executed.push(`ERROR: ${ev}: ${e.message}`);
        }
      }

      return {
        executed,
        vibrateCalls: window.__vibrateCalls,
        soundEnabled: audioEngine.isSoundEnabled(),
        hapticsEnabled: audioEngine.isHapticsEnabled(),
        volume: audioEngine.getVolume()
      };
    });

    // Verify all 10 events executed without error
    expect(results.executed).toEqual([
      'click', 'bet', 'accepted', 'countdown', 
      'card', 'win', 'loss', 'jackpot', 
      'roundStart', 'roundEnd'
    ]);

    // Verify haptic patterns were received
    expect(results.vibrateCalls.length).toBeGreaterThanOrEqual(10);
    expect(results.soundEnabled).toBe(true);
    expect(results.hapticsEnabled).toBe(true);
    console.log('✓ All 10 procedural sound events & haptic pulses executed successfully');
  });

  test('2. Header Sound & Haptic Controls Modal & Mute State', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // 1. Locate and click Header Sound Button
    const headerSoundBtn = page.locator('[data-testid="header-sound-btn"]');
    await expect(headerSoundBtn).toBeVisible({ timeout: 10000 });
    await headerSoundBtn.click();

    // 2. Verify AudioControlsModal opens
    const modalTitle = page.locator('#audio-settings-title');
    await expect(modalTitle).toBeVisible();
    await expect(modalTitle).toHaveText(/Sound & Haptics/i);

    // 3. Verify Sound Toggle Switch
    const soundToggle = page.locator('[data-testid="audio-toggle-sound-btn"]');
    await expect(soundToggle).toBeVisible();
    await expect(soundToggle).toHaveAttribute('aria-checked', 'true');

    // Toggle mute
    await soundToggle.click();
    await expect(soundToggle).toHaveAttribute('aria-checked', 'false');

    // Verify persisted in localStorage
    const storedSound = await page.evaluate(() => localStorage.getItem('windaq_sound_enabled'));
    expect(storedSound).toBe('false');

    // Unmute
    await soundToggle.click();
    await expect(soundToggle).toHaveAttribute('aria-checked', 'true');

    // 4. Test Volume Slider
    const volumeSlider = page.locator('[data-testid="audio-volume-slider"]');
    await expect(volumeSlider).toBeVisible();
    await volumeSlider.fill('0.4');
    await volumeSlider.dispatchEvent('change');

    const storedVol = await page.evaluate(() => localStorage.getItem('windaq_volume'));
    expect(parseFloat(storedVol)).toBeCloseTo(0.4, 1);

    // 5. Test Haptics Toggle
    const hapticsToggle = page.locator('[data-testid="audio-toggle-haptics-btn"]');
    await expect(hapticsToggle).toBeVisible();
    await hapticsToggle.click();
    await expect(hapticsToggle).toHaveAttribute('aria-checked', 'false');
    await hapticsToggle.click();
    await expect(hapticsToggle).toHaveAttribute('aria-checked', 'true');

    // Close modal
    const doneBtn = page.getByRole('button', { name: 'Done' });
    await doneBtn.click();
    await expect(modalTitle).not.toBeVisible();

    // Take screenshot of header with active sound button
    await page.screenshot({ path: 'tests/sound_controls_header.png' });
    console.log('✓ Header Sound & Haptic controls modal, toggle, and persistence verified');
  });

  test('3. UniversalBetPanel Tactile Sound & Haptic Integration', async ({ page }) => {
    await page.addInitScript(() => {
      window.__vibrateCalls = [];
      navigator.vibrate = (pattern) => {
        window.__vibrateCalls.push(pattern);
        return true;
      };
    });

    await page.goto('http://localhost:3000/games/bet-panel-demo');
    await page.waitForLoadState('networkidle');

    // Find and click a quick chip or stepper in UniversalBetPanel
    const chipBtn = page.locator('[data-testid="chip-500"]').first();
    await expect(chipBtn).toBeVisible({ timeout: 10000 });
    await chipBtn.click();

    // Verify haptic was triggered
    const vibrateCalls = await page.evaluate(() => window.__vibrateCalls);
    expect(vibrateCalls.length).toBeGreaterThan(0);
    console.log('✓ UniversalBetPanel chip selection triggered tactile audio/haptic feedback');
  });

  test('4. Accessibility: Reduced Motion Handling', async ({ page }) => {
    // Emulate prefers-reduced-motion: reduce
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.addInitScript(() => {
      window.__vibrateCalls = [];
      navigator.vibrate = (pattern) => {
        window.__vibrateCalls.push(pattern);
        return true;
      };
    });

    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    const reducedResults = await page.evaluate(async () => {
      const audioEngine = window.audioEngine;
      if (!audioEngine) throw new Error("window.audioEngine not found on window object");
      
      // Trigger jackpot which normally has [50, 50, 50, 50, 100, 50, 150]
      audioEngine.play('jackpot');

      return {
        isReduced: audioEngine.isReducedMotion(),
        vibrateCalls: window.__vibrateCalls
      };
    });

    expect(reducedResults.isReduced).toBe(true);
    // In reduced motion, vibration pattern is softened/clamped to <= 15ms
    expect(reducedResults.vibrateCalls.length).toBeGreaterThan(0);
    const lastVibe = reducedResults.vibrateCalls[reducedResults.vibrateCalls.length - 1];
    if (Array.isArray(lastVibe)) {
      expect(lastVibe[0]).toBeLessThanOrEqual(15);
    } else {
      expect(lastVibe).toBeLessThanOrEqual(15);
    }
    console.log('✓ Reduced motion preference correctly detected and haptics/transients softened');
  });

});
