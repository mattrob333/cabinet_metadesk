/**
 * Unit tests for PipelineScheduler.
 *
 * We don't exercise the real scrapers / debate here (those have their own
 * tests and would need live API keys). Instead we cover:
 *   - Default config shape + env-var overrides.
 *   - Cron validation (invalid expressions must throw at start()).
 *   - runOnce() with a pre-built config that marks every job disabled —
 *     asserts we get a well-formed "skipped" entry per job.
 *   - Heartbeat + log file writes land in the expected location.
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

let tmpDir: string;
let originalCwd: string;
let originalEnv: Record<string, string | undefined>;
let PipelineScheduler: typeof import('./pipeline-scheduler').PipelineScheduler;
let defaultConfig: typeof import('./pipeline-scheduler').defaultConfig;

describe('PipelineScheduler', () => {
  before(async () => {
    originalCwd = process.cwd();
    originalEnv = {
      METADESK_DEX_CRON: process.env.METADESK_DEX_CRON,
      METADESK_X_CRON: process.env.METADESK_X_CRON,
      METADESK_DEBATE_CRON: process.env.METADESK_DEBATE_CRON,
      METADESK_DEX_ENABLED: process.env.METADESK_DEX_ENABLED,
      METADESK_X_ENABLED: process.env.METADESK_X_ENABLED,
      METADESK_DEBATE_ENABLED: process.env.METADESK_DEBATE_ENABLED,
      XAI_API_KEY: process.env.XAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    };
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cabinet-scheduler-test-'));
    process.chdir(tmpDir);
    ({ PipelineScheduler, defaultConfig } = await import('./pipeline-scheduler'));
  });

  after(async () => {
    process.chdir(originalCwd);
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Reset env between tests so defaultConfig() reads fresh values.
    delete process.env.METADESK_DEX_CRON;
    delete process.env.METADESK_X_CRON;
    delete process.env.METADESK_DEBATE_CRON;
    delete process.env.METADESK_DEX_ENABLED;
    delete process.env.METADESK_X_ENABLED;
    delete process.env.METADESK_DEBATE_ENABLED;
    delete process.env.XAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  test('defaultConfig: emits dex / x / debate with stable order + safe defaults', () => {
    const configs = defaultConfig();
    assert.deepEqual(
      configs.map((c) => c.id),
      ['dex', 'x', 'debate']
    );
    assert.equal(configs.find((c) => c.id === 'dex')!.cron, '*/15 * * * *');
    assert.equal(configs.find((c) => c.id === 'x')!.cron, '*/30 * * * *');
    assert.equal(configs.find((c) => c.id === 'debate')!.cron, '0 9 * * *');
  });

  test('defaultConfig: auto-disables x when XAI_API_KEY missing', () => {
    // No key in env.
    const configs = defaultConfig();
    assert.equal(configs.find((c) => c.id === 'x')!.enabled, false);
  });

  test('defaultConfig: auto-disables debate when ANTHROPIC_API_KEY missing', () => {
    const configs = defaultConfig();
    assert.equal(configs.find((c) => c.id === 'debate')!.enabled, false);
  });

  test('defaultConfig: respects METADESK_DEX_ENABLED=false even with key present', () => {
    process.env.METADESK_DEX_ENABLED = 'false';
    const configs = defaultConfig();
    assert.equal(configs.find((c) => c.id === 'dex')!.enabled, false);
  });

  test('defaultConfig: honors custom cron overrides', () => {
    process.env.METADESK_DEX_CRON = '*/5 * * * *';
    const configs = defaultConfig();
    assert.equal(configs.find((c) => c.id === 'dex')!.cron, '*/5 * * * *');
  });

  test('validate(): throws on invalid cron expression for an enabled job', () => {
    const scheduler = new PipelineScheduler([
      { id: 'dex', cron: 'not-a-cron', enabled: true, description: '' },
      { id: 'x', cron: '*/30 * * * *', enabled: false, description: '' },
      { id: 'debate', cron: '0 9 * * *', enabled: false, description: '' },
    ]);
    assert.throws(() => scheduler.validate(), /Invalid cron expression/);
  });

  test('validate(): ignores bad cron on disabled jobs', () => {
    const scheduler = new PipelineScheduler([
      { id: 'dex', cron: 'not-a-cron', enabled: false, description: '' },
      { id: 'x', cron: '*/30 * * * *', enabled: false, description: '' },
      { id: 'debate', cron: '0 9 * * *', enabled: false, description: '' },
    ]);
    assert.doesNotThrow(() => scheduler.validate());
  });

  test('runOnce(): every disabled job emits a well-formed "skipped" entry', async () => {
    const scheduler = new PipelineScheduler([
      { id: 'dex', cron: '*/15 * * * *', enabled: false, description: 'dex' },
      { id: 'x', cron: '*/30 * * * *', enabled: false, description: 'x' },
      { id: 'debate', cron: '0 9 * * *', enabled: false, description: 'debate' },
    ]);
    const entries = await scheduler.runOnce();
    assert.equal(entries.length, 3);
    for (const e of entries) {
      assert.equal(e.status, 'skipped');
      assert.match(e.detail || '', /disabled/);
      assert.equal(e.duration_ms, 0);
    }

    // Heartbeat file must exist after runOnce.
    const hb = JSON.parse(
      await fs.readFile(path.join(tmpDir, 'data', '.cabinet', 'pipeline-heartbeat.json'), 'utf-8')
    );
    assert.equal(typeof hb.scheduler_started_at, 'string');
    assert.deepEqual(Object.keys(hb.jobs).sort(), ['debate', 'dex', 'x']);
  });

  test('getState(): reflects config snapshot before first run', () => {
    const scheduler = new PipelineScheduler([
      { id: 'dex', cron: '*/15 * * * *', enabled: true, description: 'dex' },
      { id: 'x', cron: '*/30 * * * *', enabled: false, description: 'x' },
      { id: 'debate', cron: '0 9 * * *', enabled: false, description: 'debate' },
    ]);
    const state = scheduler.getState();
    assert.equal(state.jobs.dex.config.enabled, true);
    assert.equal(state.jobs.x.config.enabled, false);
  });
});
