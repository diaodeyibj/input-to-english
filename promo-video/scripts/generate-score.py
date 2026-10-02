"""Original, deterministic 144 BPM software-promo score. No external samples.

Run: python scripts/generate-score.py
Outputs: public/audio/music.wav and public/audio/effects.wav (48 kHz stereo PCM24).
All note/sound construction is original additive/subtractive synthesis using
NumPy and SciPy. Stem gains are intentionally conservative for native voices.
"""
from pathlib import Path
import json
import wave
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "audio"
SR = 48000
SECONDS = 30
N = SR * SECONDS
BPM = 144
BEAT = 60 / BPM
BAR = BEAT * 4
RNG = np.random.default_rng(20261001)


def db(v):
    return 10 ** (v / 20)


def hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def timeline(duration):
    return np.arange(round(duration * SR), dtype=np.float64) / SR


def smooth_env(t, duration, attack=.008, release=.07):
    a = np.minimum(t / attack, 1)
    r = np.minimum(np.maximum(duration - t, 0) / release, 1)
    return np.sin(np.pi / 2 * a) ** 2 * np.sin(np.pi / 2 * r) ** 2


def filt(x, kind, cutoff, order=2):
    return sosfilt(butter(order, cutoff, kind, fs=SR, output="sos"), x)


def stereo(x, pan=0):
    angle = (pan + 1) * np.pi / 4
    return np.stack([x * np.cos(angle), x * np.sin(angle)], axis=1)


def add(dest, x, sec, gain=1, pan=0):
    if x.ndim == 1:
        x = stereo(x, pan)
    start = round(sec * SR)
    offset = max(-start, 0)
    start = max(start, 0)
    count = min(len(x) - offset, len(dest) - start)
    if count > 0:
        dest[start:start + count] += x[offset:offset + count] * gain


def short_room(x, delays=(.023, .037, .061), gains=(.11, .08, .05)):
    out = np.zeros((len(x) + round(.1 * SR), 2))
    add(out, x, 0)
    for i, (d, g) in enumerate(zip(delays, gains)):
        add(out, x[:, ::-1] if i % 2 == 0 else x, d, g)
    return out


def kick():
    t = timeline(.34)
    frequency = 49 + 90 * np.exp(-t * 43)
    phase = 2 * np.pi * np.cumsum(frequency) / SR
    body = np.sin(phase) * np.exp(-t * 13)
    body *= np.minimum(t / .0015, 1)
    attack = filt(RNG.normal(0, 1, len(t)), 'highpass', 3200) * np.exp(-t * 280) * .10
    return np.tanh((body + attack) * 1.6) * .69 * smooth_env(t, .34, .0008, .05)


def snare():
    t = timeline(.22)
    noise = filt(RNG.normal(0, 1, len(t)), 'bandpass', [1200, 10500])
    snap = noise * np.exp(-t * 27) * .37
    body = (np.sin(2 * np.pi * 183 * t) + .4 * np.sin(2 * np.pi * 330 * t)) * np.exp(-t * 39) * .18
    return (snap + body) * smooth_env(t, .22, .001, .04)


def clap():
    t = timeline(.20)
    noise = filt(RNG.normal(0, 1, len(t)), 'bandpass', [1100, 8400])
    e = np.zeros_like(t)
    for offset, amp in [(0, .4), (.010, .65), (.023, 1.0)]:
        shifted = t - offset
        e += np.where(shifted >= 0, np.exp(-np.maximum(shifted, 0) * 48) * amp, 0)
    return noise * e * .15 * smooth_env(t, .2, .0005, .03)


def hat(open_hat=False):
    duration = .15 if open_hat else .048
    t = timeline(duration)
    noise = filt(RNG.normal(0, 1, len(t)), 'highpass', 6800, 3)
    # Inharmonic metal partials keep the hat crisp without loud broad noise.
    metal = sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate([7103, 8227, 9329, 10891])) / 4
    e = np.exp(-t * (24 if open_hat else 100)) * smooth_env(t, duration, .0006, .014)
    return (noise * .48 + metal * .20) * e


def bass(note, duration):
    t = timeline(duration)
    f = hz(note)
    phase = 2 * np.pi * f * t
    harmonic = sum(np.sin(phase * h) / h ** 1.6 for h in range(1, 8))
    sound = np.tanh(harmonic * 1.25) * .6
    return sound * smooth_env(t, duration, .007, .065) * np.exp(-t * 1.7)


def chord(notes, duration):
    t = timeline(duration)
    out = np.zeros((len(t), 2))
    for i, note in enumerate(notes):
        f = hz(note)
        voice_l = sum(np.sin(2 * np.pi * f * (1 - .0009) * h * t + i * .31) / h ** 2.5 for h in range(1, 6))
        voice_r = sum(np.sin(2 * np.pi * f * (1 + .0009) * h * t + i * .39) / h ** 2.5 for h in range(1, 6))
        out += np.stack([voice_l, voice_r], axis=1)
    out /= len(notes)
    env = smooth_env(t, duration, .085, .26) * (.78 + .22 * np.exp(-t * 3))
    return out * env[:, None]


def pluck(note, duration=.42):
    t = timeline(duration)
    f = hz(note)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 8)
    s += .33 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 15)
    s += .11 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t * 27)
    return s * smooth_env(t, duration, .004, .1)


def accent(notes, duration=1.2):
    t = timeline(duration)
    out = np.zeros((len(t), 2))
    for i, note in enumerate(notes):
        f = hz(note)
        s = np.sin(2 * np.pi * f * t) * np.exp(-t * 3.4)
        s += .23 * np.sin(2 * np.pi * f * 2.002 * t) * np.exp(-t * 6.5)
        add(out, s * smooth_env(t, duration, .004, .2), .015 * i, .35, (i - 1) * .48)
    return short_room(out)


def swell(duration, descending=False):
    t = timeline(duration)
    n = filt(RNG.normal(0, 1, len(t)), 'bandpass', [2400, 8500], 2)
    env = np.sin(np.pi * np.clip(t / duration, 0, 1)) ** 2
    if descending:
        env *= np.exp(-t * 2.5)
    l = filt(n, 'lowpass', 7000) * env
    r = np.roll(l, round(.007 * SR))
    return np.stack([l, r], axis=1) * .12


def write24(path, data):
    assert data.shape == (N, 2), data.shape
    assert np.isfinite(data).all()
    assert np.max(np.abs(data)) < 1
    integers = np.clip(np.round(data * (2 ** 23 - 1)), -(2 ** 23), 2 ** 23 - 1).astype(np.int32)
    bytes3 = np.empty((N, 2, 3), dtype=np.uint8)
    for i in range(3):
        bytes3[:, :, i] = (integers >> (8 * i)) & 255
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(3)
        wav.setframerate(SR)
        wav.writeframes(bytes3.tobytes())


def stats(data):
    p = float(np.max(np.abs(data)))
    rms = float(np.sqrt(np.mean(data ** 2)))
    return {'peak_dbfs': round(20 * np.log10(max(p, 1e-12)), 2),
            'rms_dbfs': round(20 * np.log10(max(rms, 1e-12)), 2),
            'tail_peak_dbfs': round(20 * np.log10(max(float(np.max(np.abs(data[-SR // 4:]))), 1e-12)), 2)}


def build():
    drums = np.zeros((N, 2))
    low = np.zeros_like(drums)
    harmony = np.zeros_like(drums)
    motif = np.zeros_like(drums)
    transitions = np.zeros_like(drums)
    effects = np.zeros_like(drums)
    kick_s, snare_s, clap_s = kick(), snare(), clap()
    roots = [38, 45, 40, 42]  # D2, A2, E2, F#2
    voicings = [[62, 66, 69, 73, 76], [61, 64, 69, 71, 76],
                [59, 64, 68, 71, 78], [61, 64, 66, 69, 73]]
    melody = [[78, 76, 73, 76], [76, 73, 71, 73], [76, 78, 80, 76], [78, 76, 73, 73]]
    # 18 bars form a complete, exact 30-second cue at 144 BPM.
    for bar in range(18):
        sec = bar * BAR
        c = (bar // 2) % 4 if bar < 14 else [1, 2, 0, 1][bar - 14]
        energetic = 6 <= bar < 14
        sparse = bar < 2 or bar >= 16
        # Sparse prelude, confident drop, and restrained closing phrase.
        kick_beats = [0, 2] if sparse else [0, 1, 2, 3]
        if bar == 5:
            kick_beats = [0, 1, 2]
        for b in kick_beats:
            add(drums, kick_s, sec + b * BEAT, .78 if energetic else .57)
        if bar >= 1:
            for b in [1, 3]:
                if bar == 17 and b == 3:
                    continue
                add(drums, snare_s, sec + b * BEAT, .60 if energetic else .43)
                add(drums, clap_s, sec + b * BEAT + .003, .37 if energetic else .23, .12)
        steps = range(8) if not sparse else [1, 3, 5, 7]
        for step in steps:
            if (bar == 5 and step >= 6) or (bar == 17 and step >= 5):
                continue
            at = sec + step * BEAT / 2
            # Quiet sixteenth pickup and alternated hats provide forward motion.
            gain = (.115 if step % 2 else .085) * (1 if energetic else .67)
            add(drums, hat(step in [3, 7] and energetic), at, gain, -.23 if step % 2 else .23)
            if energetic and step in [2, 6]:
                add(drums, hat(), at + BEAT / 4, .033, .39)
        for beat, length, gain in [(0, .7, .46), (1.5, .35, .33), (2, .65, .42), (3.5, .32, .29)]:
            if sparse and beat in [1.5, 3.5]:
                continue
            if bar == 17 and beat >= 2:
                continue
            add(low, bass(roots[c], BEAT * length), sec + beat * BEAT, gain)
        add(harmony, chord(voicings[c], BAR + .13), sec, .39 if energetic else .30)
        # Repeated four-note motif makes the cue identifiable and keeps mids open.
        if bar >= 2 and bar != 5:
            for i, note in enumerate(melody[c]):
                if bar == 17 and i >= 2:
                    continue
                at = sec + (i + .5) * BEAT
                p = -.4 if i % 2 == 0 else .4
                g = .17 if energetic else .095
                add(motif, pluck(note), at, g, p)
                add(motif, pluck(note), at + BEAT * .75, g * .20, -p)
    # A quarter-note breathing envelope ducks harmonic and bass layers around kick.
    t = np.arange(N) / SR
    phase = np.mod(t, BEAT)
    sidechain = .63 + .37 * (1 - np.exp(-phase * 15))
    low *= sidechain[:, None]
    harmony *= sidechain[:, None]
    add(transitions, swell(.62), 9.36, .53)
    add(transitions, accent([69, 73, 76]), 10, .45)
    add(transitions, accent([73, 76, 81], .72), 12, .26)
    add(transitions, swell(.42), 16.24, .33)
    add(transitions, accent([69, 73, 78]), 16 + 2 / 3, .31)
    add(transitions, accent([69, 73, 76], 1.4), 23 + 1 / 3, .42)
    # Final tonic arrives on bar 17, then the score decays before the last frame.
    add(harmony, chord([57, 61, 64, 69, 71], 1.45), 28 + 1 / 3, .29)
    music = drums * .62 + low * .76 + harmony * .42 + motif * .62 + transitions * .42
    # Explicit built-in dialogue ducking: growing overlap at 3.33–10 s and English 12 s.
    automation_t = [0, 2.95, 3.333, 5, 8.5, 9.7, 9.97, 10.06, 11.85, 12.0, 14.5, 15.0, 23.2, 23.333, 28.5, 29.1, 29.75, 30]
    automation_g = [1.0, 1.0, .76, .65, .47, .43, .45, 1.08, 1.05, .61, .61, 1.05, 1.05, .92, .85, .52, 0, 0]
    music *= np.interp(t, automation_t, automation_g)[:, None]
    # Smooth glue saturation with generous headroom, then a fixed reproducible peak.
    music = np.tanh(music * 1.22) / 1.22
    music *= db(-12.5) / np.max(np.abs(music))
    music *= np.minimum(t / .014, 1)[:, None]
    music[t >= 29.75] = 0
    # Typing taps at exact 50-frame language onsets; quick dry taps avoid voice smear.
    for i in range(8):
        onset = (200 + i * 50) / 60
        for j, delay in enumerate([.045, .155, .280]):
            tt = timeline(.025)
            noise = filt(RNG.normal(0, 1, len(tt)), 'bandpass', [2200, 9000])
            tone = np.sin(2 * np.pi * (1320 + i * 35) * tt)
            tap = (noise * .15 + tone * .16) * np.exp(-tt * 180) * smooth_env(tt, .025, .0007, .006)
            add(effects, tap, onset + delay, .32 - j * .055, -.24 + i * .065)
    # A definitive two-part UI click and low tactile thunk exactly at frame 600.
    tt = timeline(.10)
    click = (.34 * np.sin(2 * np.pi * 1450 * tt) * np.exp(-tt * 115)
             + .32 * np.sin(2 * np.pi * 165 * tt) * np.exp(-tt * 52)
             + filt(RNG.normal(0, 1, len(tt)), 'highpass', 3500) * .14 * np.exp(-tt * 170))
    click *= smooth_env(tt, .1, .0006, .024)
    add(effects, click, 10, .56)
    # Air opens after mint text onset, while a short tuned chime signals merge success.
    add(effects, swell(.68, True), 12, .39)
    add(effects, accent([76, 81], .63), 12.035, .14)
    add(effects, accent([69, 73, 76], 1.50), 23 + 1 / 3, .39)
    effects = np.tanh(effects * 1.15) / 1.15
    effects *= db(-16.5) / np.max(np.abs(effects))
    effects[t >= 29.75] = 0
    OUT.mkdir(parents=True, exist_ok=True)
    write24(OUT / 'music.wav', music)
    write24(OUT / 'effects.wav', effects)
    result = {'sample_rate': SR, 'channels': 2, 'pcm_bits': 24, 'seconds': SECONDS,
              'frames': N, 'bpm': BPM, 'bars': 18, 'seed': 20261001,
              'music': stats(music), 'effects': stats(effects),
              'music_multilingual_rms_dbfs': stats(music[round(3.333 * SR):10 * SR])['rms_dbfs'],
              'music_english_rms_dbfs': stats(music[12 * SR:round(14.5 * SR)])['rms_dbfs']}
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    build()
