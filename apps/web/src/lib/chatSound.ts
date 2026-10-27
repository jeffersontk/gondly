const SOUND_KEY = "gondly.chat-sound";
export const CHAT_SOUND_CHANGED = "gondly:chat-sound-changed";
let fallbackEnabled = true;

export function getChatSoundEnabled() {
  try { const stored = window.localStorage.getItem(SOUND_KEY); return stored === "off" ? false : stored === "on" ? true : fallbackEnabled; }
  catch { return fallbackEnabled; }
}

export function saveChatSoundEnabled(enabled: boolean) {
  fallbackEnabled = enabled;
  try { window.localStorage.setItem(SOUND_KEY, enabled ? "on" : "off"); }
  catch { /* Keep the in-memory preference when storage is unavailable. */ }
  window.dispatchEvent(new Event(CHAT_SOUND_CHANGED));
}

export function createChatSoundPlayer(createContext: () => AudioContext | undefined, now = Date.now) {
  let context: AudioContext | undefined;
  let lastPlayed = -Infinity;
  return {
    unlock() {
      try {
        context ??= createContext();
        if (context && context.state !== "running") void context.resume().catch(() => {});
      } catch { /* Audio is optional; notifications remain visible. */ }
    },
    play() {
      if (!context || context.state !== "running" || now() - lastPlayed < 1500) return false;
      try {
        for (const [offset, frequency] of [[0, 880], [0.13, 1174]]) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const start = context.currentTime + offset;
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, start);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.06, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
          oscillator.start(start);
          oscillator.stop(start + 0.18);
        }
        lastPlayed = now();
        return true;
      } catch { return false; }
    },
  };
}

const player = createChatSoundPlayer(() => {
  const BrowserAudioContext = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return BrowserAudioContext ? new BrowserAudioContext() : undefined;
});

// Call unlock from a user gesture. Never queue an old notification for later playback.
export const unlockChatSound = () => player.unlock();
export const playChatSound = () => player.play();
