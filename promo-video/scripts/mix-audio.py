"""Build one deterministic stereo master from original stems and local CosyVoice takes."""
from pathlib import Path
import numpy as np
from scipy.io import wavfile
import subprocess,json
ROOT=Path(__file__).resolve().parents[1]
SR=48000
def read(name):
    rate,x=wavfile.read(ROOT/'public/audio'/name)
    if rate!=SR: raise ValueError(f'{name}: {rate}')
    if x.ndim==1: x=np.column_stack([x,x])
    return x.astype(np.float64)/(np.iinfo(x.dtype).max if np.issubdtype(x.dtype,np.integer) else 1)
mix=read('music.wav')*1.5+read('effects.wav')
voices=['zh','ja','ko','de','es','fr','it','ru','en']
for i,voice in enumerate(voices):
    x=read('voice-'+voice+'.wav')
    start=round(((200+i*50) if i<8 else 720)/60*SR)
    if i<8: x=x[:min(len(x),480000-start)]
    end=start+len(x)
    mix[start:end]+=x*(.88+i*.012 if i<8 else 1)
peak=float(np.max(np.abs(mix)))
gain=min(1,.91/max(peak,1e-9))
wavfile.write(ROOT/'public/audio/master-premix.wav',SR,(mix*gain).astype(np.float32))
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','warning','-i',str(ROOT/'public/audio/master-premix.wav'),'-af','loudnorm=I=-16:TP=-1.5:LRA=9','-ar','48000','-ac','2','-c:a','pcm_s24le',str(ROOT/'public/audio/master.wav')],check=True)
(ROOT/'docs/audio-mix.json').write_text(json.dumps({'sample_rate':SR,'duration_seconds':30,'voice_sources':'local CosyVoice3','original_score_bpm':144,'music_gain':1.5,'premix_peak':peak,'premix_safe_gain':gain,'target_lufs':-16,'true_peak_db':-1.5,'voice_start_frames':[200,250,300,350,400,450,500,550,720]},indent=2))
print('Master ready: public/audio/master.wav')
