const STORAGE_KEY = "cubeverse_inspection_voice";

export function isInspectionVoiceEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setInspectionVoiceEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Private mode / blocked storage — keep the in-memory toggle only.
  }
}

export function unlockInspectionVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.getVoices();
  const unlock = new SpeechSynthesisUtterance(" ");
  unlock.volume = 0;
  unlock.rate = 4;
  window.speechSynthesis.speak(unlock);
}

export function speakInspectionMark(seconds: 8 | 12) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!isInspectionVoiceEnabled()) return;
  if (document.visibilityState === "hidden") return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`${seconds} seconds!`);
  utterance.rate = 1.08;
  utterance.pitch = 1.05;
  window.speechSynthesis.speak(utterance);
}

export function silenceInspectionVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
