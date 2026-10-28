import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("primes mobile audio during a gesture and recovers a previously unlocked suspended context", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { createChatSoundPlayer } = await server.ssrLoadModule("/src/lib/chatSound.ts");
    let primed = 0, notes = 0;
    const context = {
      state: "suspended", currentTime: 0, sampleRate: 44100, destination: {},
      resume: async () => { context.state = "running"; },
      createBuffer: () => ({}),
      createBufferSource: () => ({ buffer: null, connect() {}, disconnect() {}, start() { primed++; } }),
      createOscillator: () => ({ frequency: { setValueAtTime() {} }, connect() {}, disconnect() {}, start() { notes++; }, stop() {} }),
      createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }),
    };
    const player = createChatSoundPlayer(() => context);
    await player.unlock();
    assert.equal(primed, 1);
    context.state = "suspended";
    assert.equal(await player.playAfterResume(), true);
    assert.equal(notes, 2);
    assert.equal(await player.playAfterResume(), false, "preserve burst throttling");
  } finally { await server.close(); }
});
