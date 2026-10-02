"""Original 40-second 144 BPM v2 score, effects, and measured master.

Reuses only original synthesizer primitives, never alters v1 assets.
"""
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
sys.dont_write_bytecode = True
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/audio/v2'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('score_original', ROOT / 'scripts/generate-score.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
SR, N, BPM = 48000, 40 * 48000, 144
B, BAR = 60/BPM, 240/BPM
FFMPEG = 'ffmpeg'

def save(name, data):
    assert np.isfinite(data).all() and data.shape[1] == 2
    assert np.max(np.abs(data)) < 1
    sf.write(OUT / name, data, SR, subtype='PCM_24')

def peak_safe(data, ceiling=-1.6):
    true = float(np.max(np.abs(resample_poly(data, 4, 1, axis=0))))
    return data * min(1, 10**(ceiling/20)/max(true, 1e-10))

def measure(path):
    proc = subprocess.run([FFMPEG, '-hide_banner', '-i', str(path), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, check=True)
    match = re.findall(r'\{\s*"input_i".*?\}', proc.stderr, re.S)[-1]
    raw = json.loads(match)
    return {'integrated_lufs': float(raw['input_i']), 'true_peak_dbtp': float(raw['input_tp']),
            'loudness_range_lu': float(raw['input_lra']), 'threshold_lufs': float(raw['input_thresh'])}, raw

def build():
    drums, low, harmony, motif, transitions, fx = [np.zeros((N, 2)) for _ in range(6)]
    roots = [38, 45, 40, 42]
    chords = [[62,66,69,73,76], [61,64,69,71,76], [59,64,68,71,78], [61,64,66,69,73]]
    melodies = [[78,76,73,76], [76,73,71,73], [76,78,80,76], [78,76,73,73]]
    k, sn, cl = s.kick(), s.snare(), s.clap()
    for bar in range(24):
        sec, c = bar * BAR, (bar//2) % 4
        # Feature beats at 16.667-21.667 s occupy bars 10-12.
        energetic = 10 <= bar <= 12 or 18 <= bar <= 21
        sparse = bar < 2 or bar >= 23
        for beat in ([0,2] if sparse else [0,1,2,3]):
            s.add(drums, k, sec+beat*B, .84 if energetic else .66)
        if bar:
            for beat in [1,3]:
                if bar == 23 and beat == 3:
                    continue
                s.add(drums, sn, sec+beat*B, .65 if energetic else .48)
                s.add(drums, cl, sec+beat*B+.003, .40 if energetic else .24, .12)
        for step in (range(16) if energetic else range(8)):
            division = 4 if energetic else 2
            s.add(drums, s.hat(energetic and step%8 == 6), sec+step*B/division,
                  (.105 if step%2 else .075) if energetic else .062, -.26 if step%2 else .26)
        for beat, length, gain in [(0,.72,.46),(1.5,.34,.33),(2,.65,.43),(3.5,.32,.30)]:
            if sparse and beat in [1.5,3.5]:
                continue
            s.add(low, s.bass(roots[c], B*length), sec+beat*B, gain)
        s.add(harmony, s.chord(chords[c], BAR+.13), sec, .38 if energetic else .30)
        if bar>=2:
            for i,note in enumerate(melodies[c]):
                pan = -.45 if i%2 else .45
                s.add(motif, s.pluck(note), sec+(i+.5)*B, .21 if energetic else .105, pan)
                if energetic:
                    s.add(motif, s.pluck(note+12,.21), sec+(i+.75)*B, .072,-pan)
    t = np.arange(N)/SR
    pump = .59+.41*(1-np.exp(-np.mod(t,B)*18))
    low *= pump[:,None]
    harmony *= pump[:,None]
    events = [(1000/60,[69,73,78]),(1100/60,[73,76,81]),(1200/60,[76,78,81]),
              (1400/60,[69,73,76]),(25,[73,76,81]),(1750/60,[76,81,85]),(2200/60,[69,73,76])]
    for sec,notes in events:
        s.add(transitions, s.accent(notes,.8), sec,.4)
    for sec in [1000/60,1400/60,1750/60,2200/60]:
        s.add(transitions,s.swell(.55),sec-.55,.45)
    music = drums*.62+low*.75+harmony*.42+motif*.62+transitions*.42
    duck = np.ones(N)
    for frame in [200,300,400,500,600,700,800,900,1600]:
        start = frame/60
        local = np.interp(t,[start-.1,start,start+1.05,start+1.25],[1,.47,.47,1])
        duck = np.minimum(duck,local)
    music *= duck[:,None]
    music = np.tanh(music*1.22)/1.22
    music *= 10**(-12/20)/np.max(np.abs(music))
    ending = np.clip((39.85-t)/1.65,0,1)
    music *= np.minimum(ending, np.minimum(t/.014,1))[:,None]
    for i,frame in enumerate([200,300,400,500,600,700,800,900]):
        for j,delay in enumerate([.045,.155,.28]):
            tt = s.timeline(.025)
            tap = (s.filt(s.RNG.normal(0,1,len(tt)),'bandpass',[2200,9000])*.15
                   +np.sin(2*np.pi*(1320+i*35)*tt)*.16)*np.exp(-tt*180)*s.smooth_env(tt,.025,.0007,.006)
            s.add(fx,tap,frame/60+delay,.32-j*.055,-.24+i*.065)
    tt = s.timeline(.10)
    click = (.34*np.sin(2*np.pi*1450*tt)*np.exp(-tt*115)+.32*np.sin(2*np.pi*165*tt)*np.exp(-tt*52)
             +s.filt(s.RNG.normal(0,1,len(tt)),'highpass',3500)*.14*np.exp(-tt*170))*s.smooth_env(tt,.1,.0006,.024)
    s.add(fx,click,1400/60,.56)
    s.add(fx,s.accent([73,76,81],.65),25,.24)
    s.add(fx,s.swell(.68,True),1750/60,.39)
    s.add(fx,s.accent([76,81],.63),1750/60+.035,.14)
    s.add(fx,s.accent([69,73,76],1.5),2200/60,.39)
    fx = np.tanh(fx*1.15)/1.15
    fx *= 10**(-16.5/20)/np.max(np.abs(fx))
    fx *= np.clip((39.85-t)/.3,0,1)[:,None]
    save('music.wav',peak_safe(music))
    save('effects.wav',peak_safe(fx))
    voices = np.zeros((N,2))
    manifest = json.loads((OUT/'voices-manifest.json').read_text(encoding='utf-8'))
    for entry in manifest['voices']:
        clip,rate = sf.read(ROOT/entry['output_file'],always_2d=True)
        assert rate == SR and len(clip) < 1.05*SR
        s.add(voices,clip,entry['start_frame']/60,.79)
    save('voices.wav',peak_safe(voices))
    premix = peak_safe(music+fx+voices, -3)
    save('master-premix.wav',premix)
    _, raw = measure(OUT/'master-premix.wav')
    # 0.1 dB guard compensates encoder/meter rounding around the -1.5 ceiling.
    norm = ('loudnorm=I=-16:TP=-1.6:LRA=11:linear=true:measured_I='+raw['input_i']+
            ':measured_TP='+raw['input_tp']+':measured_LRA='+raw['input_lra']+
            ':measured_thresh='+raw['input_thresh']+':offset='+raw['target_offset'])
    subprocess.run([FFMPEG,'-y','-hide_banner','-i',str(OUT/'master-premix.wav'),'-af',norm,
                    '-ar','48000','-ac','2','-c:a','pcm_s24le',str(OUT/'master.wav')],capture_output=True,check=True)
    master,rate = sf.read(OUT/'master.wav',always_2d=True)
    assert rate == SR and master.shape == (N,2) and np.max(np.abs(master)) < 1
    measured = {name:measure(OUT/name)[0] for name in ['music.wav','effects.wav','voices.wav','master-premix.wav','master.wav']}
    assert measured['master.wav']['true_peak_dbtp'] <= -1.5
    report = dict(version='approved-40sec-v2',sample_rate=SR,channels=2,pcm_bits=24,seconds=40,video_frames=2400,
                  bpm=BPM,bars=24,seed=20261001,original_score=True,
                  score_provenance='Original additive/subtractive synthesis using existing project synthesizer primitives; no external samples.',
                  master_target_lufs=-16,master_true_peak_ceiling_dbtp=-1.5,measurements=measured,
                  sync_events={'native_voice_frames':[200,300,400,500,600,700,800,900], 'feature_beats_frames':[1000,1100,1200],
                               'click_frame':1400,'lines_bar_frame':1500,'english_frame':1600,'mint_frame':1750,'logo_frame':2200,'end_frame':2400},
                  voice_mix_gain=.79,subjective_review='Objective timing, finite samples, peak and loudness verified. No native speaker review.')
    (OUT/'audio-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    (ROOT/'docs/audio-v2-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))

if __name__ == '__main__':
    build()
