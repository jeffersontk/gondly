import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

test("chat alerts count only unread messages from others and deduplicate live sounds", async () => {
  const server = await createServer({ root: fileURLToPath(new URL("../", import.meta.url)), server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { unreadChatMessages, createChatAlertTracker, mergeChatMessages } = await server.ssrLoadModule("/src/pages/lists/chatNotifications.ts");
    const make = (id, userId, seconds) => ({ id, userId, createdAt: new Date(seconds * 1000).toISOString(), body: "Mensagem", user: { name: "Pessoa" } });
    const old = make("old", "other", 1), mine = make("mine", "me", 4), first = make("first", "other", 3), last = make("last", "other", 5);
    assert.deepEqual(unreadChatMessages([last, old, mine, first], "me", 2000).map(x => x.id), ["first", "last"]);
    assert.deepEqual(unreadChatMessages([last], undefined, 0), []);
    assert.deepEqual(unreadChatMessages([last], "me", 5000), []);
    assert.deepEqual(mergeChatMessages([old, first], [first, last]).map(x => x.id), ["old", "first", "last"], "history response must preserve live messages received during fetch");
    const tracker = createChatAlertTracker();
    const context = { currentUserId: "me", chatOpen: false, visible: true, lastReadAt: 2000 };
    assert.equal(tracker.accept(first, context), true);
    assert.equal(tracker.accept(first, context), false);
    assert.equal(tracker.accept(mine, context), false);
    assert.equal(tracker.accept(old, context), false);
    assert.equal(tracker.accept(make("open", "other", 6), { ...context, chatOpen: true }), false);
    assert.equal(tracker.accept(make("hidden", "other", 7), { ...context, visible: false }), false);
    assert.equal(tracker.accept(last, context), true);

    const { createChatSoundPlayer } = await server.ssrLoadModule("/src/lib/chatSound.ts");
    let clock = 0, starts = 0, created = 0;
    const contextAudio = {
      state: "running", currentTime: 0, destination: {}, resume: async () => {},
      createOscillator: () => ({ type: "", frequency: { setValueAtTime() {} }, connect() {}, disconnect() {}, start() { starts++; }, stop() {} }),
      createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }),
    };
    const player = createChatSoundPlayer(() => { created++; return contextAudio; }, () => clock);
    assert.equal(player.play(), false, "do not create audio or queue playback before interaction");
    assert.equal(created, 0);
    player.unlock();
    assert.equal(player.play(), true);
    assert.equal(starts, 2, "one short two-note alert");
    clock = 500;
    assert.equal(player.play(), false, "limit sounds during bursts of messages");
    clock = 2000;
    assert.equal(player.play(), true);
    assert.equal(created, 1, "reuse the unlocked audio context");
    contextAudio.state = "suspended";
    clock = 4000;
    assert.equal(player.play(), false, "autoplay blocking must not throw or replay later");
    const unsupported = createChatSoundPlayer(() => undefined);
    unsupported.unlock();
    assert.equal(unsupported.play(), false);
  } finally { await server.close(); }
});
