"""Decode approved A without changing its timing; add sparse UI sounds, fade tail."""
from pathlib import Path
import subprocess, hashlib, json, wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'out/A_ui_90-118.mp3'
OUT = ROOT / 'public/audio/demo28'
OUT.mkdir(parents=True, exist_ok=True)
SR, SECONDS = 48000, 28
result = subprocess.run(['ffmpeg','-v','error','-i',str(SOURCE),'-f','f32le','-ac','2','-ar',str(SR),'-'],check=True,capture_output=True)
music = np.frombuffer(result.stdout,dtype='<f4').reshape(-1,2).astype(np.float64)
assert len(music) == SR*SECONDS, f'Expected exact decoded A duration, got {len(music)/SR}'
mix = music.copy()
rng = np.random.default_rng(20261002)
events = []

def add(frame, kind, gain):
    # SFX peak, rather than arbitrary file start, is aligned to the visual event.
    duration = .055 if kind == 'tap' else .095 if kind == 'click' else .17
    t = np.arange(round(SR*duration))/SR
    if kind in ('tap','click'):
        sound = (np.sin(2*np.pi*(1250 if kind=='tap' else 890)*t)*.65 + rng.normal(0,.18,len(t))) * np.exp(-t*80)
    else:
        sound = (np.sin(2*np.pi*880*t)+.38*np.sin(2*np.pi*1320*t))*np.exp(-t*24)*(1-np.exp(-t*180))
    sound = sound / max(np.max(np.abs(sound)), 1e-9) * gain
    peak = int(np.argmax(np.abs(sound)))
    start = round(frame/60*SR)-peak
    assert start >= 0 and start+len(sound) <= len(mix)
    mix[start:start+len(sound),:] += sound[:,None]
    events.append({'frame':frame,'seconds':frame/60,'kind':kind,'peak_aligned':True,'gain':gain})

for frame in [123,177,204,231,258,285,312]: add(frame,'tap',.055)
add(447,'click',.13)
add(528,'ready',.045)
fade_samples = round(.6*SR)
fade = .5*(1+np.cos(np.linspace(0,np.pi,fade_samples)))
mix[-fade_samples:,:] *= fade[:,None]
peak = float(np.max(np.abs(mix)))
assert peak < .89, f'Mix needs headroom, peak={peak}'
pcm = np.round(np.clip(mix,-1,1)*32767).astype('<i2')
master = OUT/'master.wav'
with wave.open(str(master),'wb') as wf:
    wf.setnchannels(2);wf.setsampwidth(2);wf.setframerate(SR);wf.writeframes(pcm.tobytes())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
contract={'source':str(SOURCE),'source_sha256':sha(SOURCE),'source_selection':'A_ui_90-118','master_sha256':sha(master),'duration_seconds':SECONDS,'sample_rate':SR,'channels':2,'samples_per_channel':len(mix),'fade_seconds':.6,'sfx':events,'sample_peak_dbfs':20*np.log10(peak),'tail_last_sample':float(mix[-1,0]),'voice':False,'music_stretch':False}
(OUT/'audio-contract.json').write_text(json.dumps(contract,indent=2),encoding='utf-8')
print(json.dumps({'master':str(master),'duration':SECONDS,'sample_peak_dbfs':round(contract['sample_peak_dbfs'],2),'source_sha256':contract['source_sha256'],'tail_last_sample':contract['tail_last_sample']},indent=2))
