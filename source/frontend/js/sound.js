// The sound of the gates, synthesised with the Web Audio API (no audio files, so
// it works in the bundle of Qollab as well). Each native gate has its own voice:
//   GPI and GPI2  a short laser tone; the GPI is lower and twice as long
//   MS and ZZ     a long, detuned two-tone swell, as long as the pulse
//   VirtualZ      a click (it is a software phase: no laser, no tone)
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

/** An oscillator that sweeps from ``from`` to ``to`` Hz and stops at ``end``. */
function tone(type, from, to, start, end, destination) {
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, end);
  oscillator.connect(destination);
  oscillator.start(start);
  oscillator.stop(end + 0.05);
  return oscillator;
}

/** A GPI or GPI2: a laser tone with a soft overtone and a slight fall in pitch. */
function laserTone(start, seconds, pitch) {
  const end = start + seconds;
  const gain = envelope(start, seconds, PEAK);
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 3200;
  filter.connect(gain);
  return [
    tone("triangle", pitch, pitch * 0.9, start, end, filter),
    tone("sine", pitch * 2, pitch * 1.8, start, end, filter),
    gain,
  ];
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

  // The vibrato moves the pitch of all three by a few cents.
  const lfo = context.createOscillator();
  const depth = context.createGain();
  lfo.frequency.value = 5;
  depth.gain.value = 6;
  lfo.connect(depth);
  for (const oscillator of [low, high, fifth]) depth.connect(oscillator.detune);
  lfo.start(start);
  lfo.stop(end + 0.05);
  return [low, high, fifth, lfo, gain];
}

/** A VirtualZ: a click, a few milliseconds of filtered noise that dies at once. */
function click(start) {
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
  filter.frequency.value = 2800;
  filter.Q.value = 1.2;
  const gain = context.createGain();
  gain.gain.value = PEAK * 3;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(start);
  return [source, gain];
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
    if (audio.state === "suspended") audio.resume();
    master.gain.value = state.view.soundVolume;
    const start = audio.currentTime + 0.01;
    const seconds = Math.max(0.05, ms / 1000);
    if (operation === "gpi") voices = laserTone(start, seconds, 440);
    else if (operation === "gpi2") voices = laserTone(start, seconds, 660);
    else if (operation === "ms" || operation === "zz") voices = entanglerSwell(start, seconds);
    else if (operation === "virtual_z") voices = click(start);
  } catch (error) {
    voices = [];
  }
}

/** Follow the volume slider while a sound is playing. */
export function setSoundVolume(volume) {
  if (master) master.gain.value = volume;
}
