/* ========================================
   HarvestVoice — Push-to-talk speech capture
   ----------------------------------------
   Uses the browser's Web Speech API. This is the
   right call for a local desktop prototype: zero
   setup, zero keys, works in Chrome today.

   It is NOT the production path. Web Speech is
   unreliable on iOS Safari and gives no control
   over vocabulary — which is exactly where strain
   names fail. Phase 2 swaps this module for a
   WebSocket to a Deepgram relay with the facility's
   strain list loaded as keyterms. The interface
   below is the seam that makes that a swap.

   Three things this has to survive that a naive
   wrapper does not:
     1. Release-before-final. Chrome often ends
        recognition without ever marking a result
        isFinal. Keeping only final results throws
        away short utterances — which is every
        utterance in a rapid-fire loop.
     2. Auto-end on silence. Chrome stops listening
        on its own pause detection. If the worker is
        still holding the button, restart.
     3. Pointer drift. A thumb that slides 3px off
        the button must not cancel the recording.
   ======================================== */

/* Chrome ends recognition on its own silence detection; we restart to keep a
   held/latched take alive. This bounds that so a silent room can't leave the
   button stuck in "listening" indefinitely. */
const MAX_RESTARTS = 10;

/* Virtual audio devices frequently steal the system default and then record
   perfect silence — the single most confusing way for voice input to fail. */
const VIRTUAL_DEVICE = /virtual|oculus|meta quest|vb-audio|voicemeeter|obs|steam|nvidia broadcast/i;

class SpeechCapture {
  constructor() {
    const Impl = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = Boolean(Impl);

    Log.info('SpeechCapture init', {
      supported: this.supported,
      secureContext: window.isSecureContext,
      hasMediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
      protocol: location.protocol,
    });
    if (!window.isSecureContext) {
      Log.error('Not a secure context — speech recognition will be blocked. Use http://localhost or https.');
    }
    this.listening = false;     // engine is actually running
    this.wanted = false;        // user still wants to be heard
    this.permission = 'unknown'; // 'unknown' | 'granted' | 'denied'

    this.onInterim = () => {};
    this.onFinal = () => {};
    this.onError = () => {};
    this.onStateChange = () => {};
    this.onEmpty = () => {};    // take ended with nothing heard

    if (!this.supported) return;

    this.rec = new Impl();
    this.rec.lang = 'en-US';
    this.rec.continuous = false;
    this.rec.interimResults = true;
    this.rec.maxAlternatives = 1;

    this._final = '';
    this._interim = '';
    this._starting = false;
    this._restarts = 0;

    this.rec.onstart = () => {
      this._starting = false;
      this.listening = true;
      this.permission = 'granted';
      Log.info('engine onstart — now listening');
      this.onStateChange(true);
    };

    this.rec.onaudiostart = () => Log.info('engine onaudiostart — mic is open');
    this.rec.onspeechstart = () => Log.info('engine onspeechstart — speech detected');
    this.rec.onspeechend = () => Log.info('engine onspeechend — speech stopped');
    this.rec.onnomatch = () => Log.warn('engine onnomatch — audio heard but nothing recognized');

    this.rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) this._final += result[0].transcript;
        else interim += result[0].transcript;
      }
      // Hold onto the interim text. If recognition ends without ever
      // finalizing — the common case on a short press — this is all we get,
      // and it is far better than dropping the utterance.
      if (interim) {
        this._interim = interim;
        this.onInterim(interim);
      }
      Log.info('engine onresult', { interim, final: this._final });
    };

    this.rec.onerror = (event) => {
      this._starting = false;
      Log.warn('engine onerror', { error: event.error, message: event.message || '' });

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.permission = 'denied';
        this.wanted = false;
        this.onError('not-allowed');
        return;
      }
      if (event.error === 'network') {
        // Chrome's Web Speech API sends audio to Google's servers.
        Log.error('Speech recognition needs internet access — Chrome sends audio to Google to transcribe it.');
      }
      // 'aborted' and 'no-speech' are normal push-to-talk outcomes.
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        this.onError(event.error);
      }
    };

    this.rec.onend = () => {
      this._starting = false;
      this.listening = false;
      Log.info('engine onend', {
        stillWanted: this.wanted,
        restarts: this._restarts,
        final: this._final,
        interim: this._interim,
      });

      // Chrome ends on its own silence detection. If the worker is still
      // holding (or has latched), keep going rather than dropping the rest —
      // but bound it, so a latched take in a silent room can't spin forever.
      if (this.wanted && this._restarts < MAX_RESTARTS) {
        this._restarts++;
        Log.info('restarting engine (still held/latched)', { restart: this._restarts });
        this._restart();
        return;
      }
      if (this.wanted) Log.warn('restart limit reached — finishing the take');
      this.wanted = false;

      this.onStateChange(false);
      const text = (this._final || this._interim || '').trim();
      const usedInterim = !this._final && Boolean(this._interim);
      this._final = '';
      this._interim = '';

      if (text) {
        Log.info('TRANSCRIPT' + (usedInterim ? ' (from interim — engine never finalized)' : ''), text);
        this.onFinal(text);
      } else {
        Log.warn('take produced no transcript — nothing was heard');
        // Never let this fail silently. A dead take that says nothing reads as
        // "the app is broken" when the real cause is usually the input device.
        this.onEmpty();
      }
    };
  }

  _restart() {
    try {
      this._starting = true;
      this.rec.start();
      Log.info('engine.start() called');
    } catch (err) {
      this._starting = false;
      Log.warn('engine.start() threw', { name: err.name, message: err.message });
    }
  }

  /**
   * Ask for mic permission up front. Chrome's SpeechRecognition prompt is
   * easy to miss mid-press; priming through getUserMedia makes the grant
   * explicit and lets us report a clear state afterwards.
   */
  async prime() {
    if (!navigator.mediaDevices?.getUserMedia) {
      Log.warn('prime skipped — navigator.mediaDevices.getUserMedia unavailable');
      return this.permission;
    }
    Log.info('prime — requesting microphone permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const label = stream.getAudioTracks()[0]?.label || '(unnamed device)';
      stream.getTracks().forEach((t) => t.stop());
      this.permission = 'granted';
      Log.info('prime — microphone granted', label);
      // Catch the wrong-default-device case on the very first press, rather
      // than leaving the worker to infer it from a silent failure.
      if (VIRTUAL_DEVICE.test(label)) {
        Log.error(`"${label}" is a VIRTUAL audio device, not a real microphone — it will record silence.`);
        Log.error('Chrome pins a capture device per site, so Windows sound settings alone may not fix this.');
        Log.error('Run "Test mic" in this panel for the exact steps and the name of your real microphone.');
        this.onError('virtual-device');
      }
    } catch (err) {
      this.permission = 'denied';
      Log.error('prime — microphone denied', { name: err.name, message: err.message });
    }
    return this.permission;
  }

  start() {
    if (!this.supported) { Log.error('start ignored — SpeechRecognition unsupported'); return; }
    Log.info('start requested', { alreadyListening: this.listening, starting: this._starting });
    this.wanted = true;
    this._final = '';
    this._interim = '';
    this._restarts = 0;
    if (this.listening || this._starting) return;
    this._restart();
  }

  /**
   * `delay` gives the engine a moment to catch trailing audio — releasing a
   * button is faster than finishing a word.
   */
  stop(delay = 220) {
    if (!this.supported) return;
    if (!this.wanted) { Log.info('stop ignored — not currently wanted'); return; }
    Log.info('stop requested', { delay });
    this.wanted = false;
    setTimeout(() => {
      if (this.listening) {
        try { this.rec.stop(); Log.info('engine.stop() called'); }
        catch (err) { Log.warn('engine.stop() threw', String(err.message)); }
      } else {
        // Never started (permission prompt, or released too fast).
        Log.warn('stop — engine was never listening, nothing to flush');
        this.onStateChange(false);
      }
    }, delay);
  }
}

/* ========================================
   Input level meter
   ----------------------------------------
   SpeechRecognition gives no access to its audio, so this opens its own
   stream alongside it purely to measure signal. It exists because "the mic is
   open but hearing nothing" is invisible otherwise — which is exactly the
   failure a wrong default input device produces.

   Every take logs its peak level, so a dead input is self-evident in the log
   without anyone having to run a separate test.
   ======================================== */
const Meter = {
  stream: null,
  ctx: null,
  raf: 0,
  peak: 0,
  onLevel: () => {},

  async start() {
    if (this.stream) return;
    this.peak = 0;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      Log.warn('level meter unavailable', String(err.name));
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 1024;
    this.ctx.createMediaStreamSource(this.stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / buf.length);
      if (rms > this.peak) this.peak = rms;
      this.onLevel(rms);
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  },

  /** Returns peak level for this take as a 0-100 integer. */
  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.onLevel(0);
    return Math.round(this.peak * 100);
  },
};

/* Screen Wake Lock — a phone that sleeps mid-session drops the batch.
   Has to be in from the start, not bolted on. */
const WakeLock = {
  sentinel: null,
  async acquire() {
    if (!('wakeLock' in navigator)) return false;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => { this.sentinel = null; });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.sentinel === null) this.acquire();
      });
      return true;
    } catch (err) {
      return false;
    }
  },
  async release() {
    try { await this.sentinel?.release(); } catch (err) { /* no-op */ }
    this.sentinel = null;
  },
};
