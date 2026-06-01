// Generates a short pleasant notification beep using Web Audio API
let ctx: AudioContext | null = null;
const getCtx = () => {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
};

export const playNotificationSound = () => {
  try {
    const c = getCtx();
    if (c.state === "suspended") c.resume();
    const now = c.currentTime;
    const osc1 = c.createOscillator();
    const gain = c.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.setValueAtTime(1320, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc1.connect(gain);
    gain.connect(c.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);
  } catch {}
};
