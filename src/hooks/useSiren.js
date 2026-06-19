import { useState, useEffect, useRef } from 'react';

/**
 * useSiren — Controls Web Audio API emergency siren.
 */
export function useSiren() {
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);
  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isSirenPlaying) {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          console.warn('[Siren] Web Audio API unavailable on this device.');
          setTimeout(() => setIsSirenPlaying(false), 0);
          return;
        }
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.connect(gain);
      gain.connect(ctx.destination);

      const modulate = () => {
        const t = ctx.currentTime;
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.linearRampToValueAtTime(1200, t + 0.5);
        osc.frequency.linearRampToValueAtTime(600, t + 1.0);
      };

      modulate();
      intervalRef.current = setInterval(modulate, 1000);

      osc.start();
      oscRef.current = osc;
    } else {
      if (oscRef.current) {
        try { oscRef.current.stop(); } catch { /* ignore stop error if already stopped */ }
        oscRef.current.disconnect();
        oscRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (oscRef.current) {
        try { oscRef.current.stop(); } catch { /* ignore stop error if already stopped */ }
        oscRef.current.disconnect();
        oscRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isSirenPlaying]);

  return { isSirenPlaying, setIsSirenPlaying };
}
