import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { connectMcp } from './mcp-client.mjs';

// This acceptance test is deliberately opt-in: use a dedicated new test canvas.
assert.equal(process.env.ACCEPTANCE_TEST_CANVAS, '1', 'Use only a dedicated test canvas and set ACCEPTANCE_TEST_CANVAS=1');
const url = process.env.CANVAS_URL || 'http://127.0.0.1:3031';
const container = process.env.TEST_CONTAINER || 'excalidraw-live';
assert.match(container, /^[a-zA-Z0-9_.-]+$/);
const docker = process.env.SSH_HOST
  ? ['ssh', '-T', '-o', 'BatchMode=yes', process.env.SSH_HOST, 'docker'] : ['docker'];
const evidence = process.env.EVIDENCE_DIR || 'evidence';
const { launch } = await import(process.env.BROWSER_MODULE || 'cloakbrowser');
const browser = await launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const mcp = connectMcp([...docker, 'exec', '-i', container, 'excalidraw-mcp']);
const check = async path => {
  const response = await fetch(url + path);
  assert(response.ok, path);
  return response.json();
};
const scene = async () => (await check('/api/elements')).elements;
const sync = async () => {
  const response = page.waitForResponse(r => r.url().endsWith('/api/elements/sync') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sync to Backend', exact: true }).click();
  assert((await response).ok());
};
const waitFor = async condition => {
  for (let i = 0; i < 100; i++) {
    try { if (await condition()) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Condition did not become true within 10 seconds');
};
const report = { checks: [] };
const pass = check => { report.checks.push(check); console.log('PASS:', check); };
try {
  await mkdir(evidence, { recursive: true });
  assert.equal((await scene()).length, 0, 'Start with an empty dedicated test canvas');
  const health = await check('/health');
  assert.equal(health.service, 'mcp-excalidraw-canvas');
  assert.equal(health.durable_state_enabled, true);
  pass('Service identity and persistence enabled');
  await mcp.initialize();
  const tools = await mcp.request('tools/list', {});
  for (const name of ['create_element', 'update_element', 'delete_element', 'query_elements', 'snapshot_scene'])
    assert(tools.tools.some(t => t.name === name), name);
  report.toolCount = tools.tools.length;
  pass('Real stdio MCP initialize and tool discovery');
  await page.goto(url);
  await page.getByRole('button', { name: 'Sync to Backend', exact: true }).waitFor({ state: 'visible' });
  await waitFor(async () => (await check('/health')).websocket_clients > 0);
  await page.screenshot({ path: `${evidence}/before.png` });
  await mcp.call('create_element', { id: 'acceptance-text', type: 'text', x: 150, y: 140, text: 'Live from MCP', fontSize: 32, fontFamily: 'helvetica', strokeColor: '#1e1e1e' });
  await mcp.call('create_element', { id: 'acceptance-box', type: 'rectangle', x: 150, y: 240, width: 360, height: 140, backgroundColor: '#a5d8ff', strokeColor: '#1971c2' });
  await waitFor(async () => (await scene()).length === 2);
  await new Promise(resolve => setTimeout(resolve, 1200));
  await page.screenshot({ path: `${evidence}/mcp-created.png` });
  // Browser's own scene replacement must contain the remotely created ids.
  await sync();
  assert((await scene()).some(e => e.id === 'acceptance-text' && e.text === 'Live from MCP'));
  assert((await scene()).some(e => e.id === 'acceptance-box'));
  pass('MCP creations arrive in open browser and survive browser scene sync without reload');
  await mcp.call('update_element', { id: 'acceptance-text', text: 'MCP update verified', x: 190 });
  await new Promise(resolve => setTimeout(resolve, 1200));
  await sync();
  assert((await scene()).some(e => e.id === 'acceptance-text' && e.text === 'MCP update verified' && e.x === 190));
  await page.screenshot({ path: `${evidence}/mcp-updated.png` });
  pass('MCP update reaches existing browser without reload');
  await mcp.call('delete_element', { id: 'acceptance-box' });
  await new Promise(resolve => setTimeout(resolve, 1200));
  await sync();
  assert(!(await scene()).some(e => e.id === 'acceptance-box'));
  pass('MCP deletion reaches existing browser');
  // Synthetic image attachment exercises persistent blob storage.
  const file = { id: 'acceptance-pixel', mimeType: 'image/png', created: 1, dataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOGQAAAAASUVORK5CYII=' };
  const upload = await fetch(url + '/api/files', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ files: [file] }) });
  assert(upload.ok);
  await mcp.call('snapshot_scene', { name: 'acceptance-snapshot' });
  const before = await scene();
  const beforeFiles = await check('/api/files');
  const beforeSnapshots = await check('/api/snapshots');
  const beforeSnapshot = await check('/api/snapshots/acceptance-snapshot');
  mcp.close();
  const restart = spawnSync(docker[0], [...docker.slice(1), 'restart', container], { encoding: 'utf8', timeout: 30000 });
  assert.equal(restart.status, 0, restart.stderr);
  await waitFor(async () => (await check('/health')).durable_state_enabled === true);
  assert.deepEqual(await scene(), before);
  assert.deepEqual(await check('/api/files'), beforeFiles);
  assert.deepEqual(await check('/api/snapshots'), beforeSnapshots);
  assert.deepEqual(await check('/api/snapshots/acceptance-snapshot'), beforeSnapshot);
  pass('Scene, image blob and snapshot survive actual Docker restart');
  await page.reload();
  await page.getByRole('button', { name: 'Sync to Backend', exact: true }).waitFor({ state: 'visible' });
  await sync();
  assert((await scene()).some(e => e.id === 'acceptance-text' && e.text === 'MCP update verified'));
  await page.screenshot({ path: `${evidence}/after-restart.png` });
  pass('Browser reload recovers persistent scene after restart');
  await writeFile(`${evidence}/acceptance.json`, JSON.stringify(report, null, 2) + '\n');
} finally {
  mcp.close();
  await browser.close();
}
