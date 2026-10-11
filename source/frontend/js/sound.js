// The sound of the gates, synthesised with the Web Audio API (no audio files, so
// it works in the bundle of Qollab as well). Each native gate has its own voice:
//   GPI and GPI2  a thin laser zap (a fast fall in pitch) over a faint buzzing
//                 beam; the GPI is lower and twice as long
//   MS and ZZ     a long, detuned two-tone swell, as long as the pulse
//   VirtualZ      a click (it is a software phase: no laser, no tone)
//   Measure       a thin readout beam and a shower of photon ticks, one per |1> ion
// The length of every tone follows the pulse of the gate (`laserPulseFor`), so
// the sound ends when the beam does. Browsers only allow audio after a gesture,
// so the context is created on the first sound and a failure is ignored: the
// viewer works without sound.

import { state } from "./state.js";

const PEAK = 0.22; // the gain of one voice, before the volume of the user
const RAMP = 0.15; // the rise and the fall, as a fraction of the pulse (as in the beam)

let context = null;
let master = null;
let voices = [];

/** The audio context, created on first use; ``null`` when there is none. */
function audioContext() {
  if (context) return context;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    context = new Context();
    master = context.createGain();
    master.connect(context.destination);
  } catch (error) {
    context = null;
    master = null;
  }
  return context;
}

/** A gain node that rises, holds and falls over ``seconds``, wired to the output. */
function envelope(start, seconds, peak) {
  const gain = context.createGain();
  const ramp = seconds * RAMP;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + ramp);
  gain.gain.setValueAtTime(peak, start + seconds - ramp);
  gain.gain.linearRampToValueAtTime(0, start + seconds);
  gain.connect(master);
  return gain;
}

/** An oscillator that sweeps from ``from`` to ``to`` Hz by ``end`` and stops at ``stopAt``. */
function tone(type, from, to, start, end, destination, stopAt = end) {
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, end);
  if (destination) oscillator.connect(destination);
  oscillator.start(start);
  oscillator.stop(stopAt + 0.05);
  return oscillator;
}

/**
 * A GPI or GPI2: a thin laser "zap". A bright, narrow tone falls fast in pitch
 * (``fromHz`` to ``toHz``) and dies down to a faint, buzzing beam that lasts
 * until the end of the pulse.
 */
function laserTone(start, seconds, fromHz, toHz) {
  const end = start + seconds;
  const drop = Math.min(0.16, seconds * 0.3);

  // The zap: a square wave through a narrow band-pass that follows the pitch, so
  // only a thin whistle is left of it.
  const zap = tone("square", fromHz, toHz, start, start + drop, null, end);
  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 7;
  band.frequency.setValueAtTime(fromHz, start);
  band.frequency.exponentialRampToValueAtTime(toHz, start + drop);
  zap.connect(band);
  const zapGain = context.createGain();
  zapGain.gain.setValueAtTime(0, start);
  zapGain.gain.linearRampToValueAtTime(PEAK * 1.6, start + 0.004);
  zapGain.gain.exponentialRampToValueAtTime(PEAK * 0.25, start + drop + 0.05);
  zapGain.gain.setValueAtTime(PEAK * 0.25, Math.max(start + drop + 0.05, end - seconds * RAMP));
  zapGain.gain.linearRampToValueAtTime(0, end);
  band.connect(zapGain);
  zapGain.connect(master);

  // The beam: a faint, high sine with a fast tremolo, which gives the buzz.
  const hum = tone("sine", toHz * 1.5, toHz * 1.5, start, end, null);
  const humGain = envelope(start, seconds, PEAK * 0.18);
  const tremolo = context.createOscillator();
  const depth = context.createGain();
  tremolo.frequency.value = 48;
  depth.gain.value = PEAK * 0.09;
  tremolo.connect(depth);
  depth.connect(humGain.gain);
  hum.connect(humGain);
  tremolo.start(start);
  tremolo.stop(end + 0.05);
  return [zap, hum, tremolo, zapGain, humGain];
}

/** An MS or ZZ: two detuned saws that beat, a slow vibrato and a rising filter. */
function entanglerSwell(start, seconds) {
  const end = start + seconds;
  const gain = envelope(start, seconds, PEAK * 0.7);
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 4;
  filter.frequency.setValueAtTime(400, start);
  filter.frequency.exponentialRampToValueAtTime(2200, start + seconds * 0.6);
  filter.frequency.exponentialRampToValueAtTime(700, end);
  filter.connect(gain);

  const low = tone("sawtooth", 196, 262, start, end, filter);
  const high = tone("sawtooth", 200, 268, start, end, filter);
  const fifth = tone("sine", 294, 392, start, end, gain);

  // The vibrato moves the pitch of all three by a few hertz.
  const lfo = context.createOscillator();
  const depth = context.createGain();
  lfo.frequency.value = 5;
  depth.gain.value = 3;
  lfo.connect(depth);
  for (const oscillator of [low, high, fifth]) depth.connect(oscillator.frequency);
  lfo.start(start);
  lfo.stop(end + 0.05);
  return [low, high, fifth, lfo, gain];
}

/** A VirtualZ: a click, a few milliseconds of filtered noise that dies at once. */
function click(start, hz = 2800, level = PEAK * 4) {
  const length = Math.round(context.sampleRate * 0.02);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = hz;
  filter.Q.value = 1.2;
  const gain = context.createGain();
  gain.gain.value = level;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(start);
  return [source, gain];
}

/**
 * The readout: a steady, thin beam that swells in, holds and fades out with the
 * animation of the measurement (``measurement.js``), and a shower of tiny ticks,
 * the photons, that is as dense as the number of ions found in |1>. Ions in |0>
 * stay dark, so a register measured as all zeros has no ticks.
 */
function readoutSound(start, ones) {
  const seconds = 1.3;
  const end = start + seconds;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(PEAK * 0.7, start + 0.2);
  gain.gain.setValueAtTime(PEAK * 0.7, start + 1.0);
  gain.gain.linearRampToValueAtTime(0, end);
  gain.connect(master);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 5;
  filter.frequency.setValueAtTime(700, start);
  filter.frequency.exponentialRampToValueAtTime(1300, start + 0.2);
  filter.connect(gain);
  const beam = tone("sawtooth", 650, 1300, start, start + 0.2, filter, end);
  const hum = tone("sine", 2600, 2600, start, end, gain);
  const voices = [beam, hum, gain];

  const ticks = ones > 0 ? Math.min(40, 8 + 8 * ones) : 0;
  for (let i = 0; i < ticks; i++) {
    voices.push(...click(start + 0.45 + Math.random() * 0.55, 4500 + Math.random() * 1500, PEAK * 2.5));
  }
  return voices;
}

/** Silence what is still sounding, with a short fade so it does not pop. */
export function stopGateSounds() {
  if (!context) return;
  const now = context.currentTime;
  for (const node of voices) {
    try {
      if (node.gain && node.gain.cancelScheduledValues) {
        node.gain.cancelScheduledValues(now);
        node.gain.setTargetAtTime(0, now, 0.015);
      }
      if (node.stop) node.stop(now + 0.1);
    } catch (error) {
      // A source that already stopped throws on a second stop: nothing to do.
    }
  }
  voices = [];
}

/**
 * Play the sound of a native gate (``gpi``, ``gpi2``, ``ms``, ``zz`` or
 * ``virtual_z``) for a pulse of ``ms`` milliseconds. It does nothing when the
 * sound is off, the browser has no audio or the gate has no sound.
 */
export function playGateSound(operation, ms) {
  if (!state.view.sound) return;
  const audio = audioContext();
  if (!audio) return;
  try {
    if (audio.state === "suspended") audio.resume().catch(() => {});
    master.gain.value = state.view.soundVolume;
    const start = audio.currentTime + 0.01;
    const seconds = Math.max(0.05, ms / 1000);
    if (operation === "gpi") voices = laserTone(start, seconds, 2200, 900);
    else if (operation === "gpi2") voices = laserTone(start, seconds, 3000, 1600);
    else if (operation === "ms" || operation === "zz") voices = entanglerSwell(start, seconds);
    else if (operation === "virtual_z") voices = click(start);
  } catch (error) {
    voices = [];
  }
}

/**
 * Play the sound of the readout for a measurement whose outcome is ``outcome``
 * (an array with 1 for an ion found in |1> and 0 for |0>).
 */
export function playMeasureSound(outcome) {
  if (!state.view.sound) return;
  const audio = audioContext();
  if (!audio) return;
  try {
    stopGateSounds();
    if (audio.state === "suspended") audio.resume().catch(() => {});
    master.gain.value = state.view.soundVolume;
    voices = readoutSound(audio.currentTime + 0.01, outcome.reduce((sum, bit) => sum + bit, 0));
  } catch (error) {
    voices = [];
  }
}

/** Follow the volume slider while a sound is playing. */
export function setSoundVolume(volume) {
  if (master) master.gain.value = volume;
}
