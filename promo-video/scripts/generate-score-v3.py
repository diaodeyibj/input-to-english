"""Original 40 s / 24 bar promo cue and speech-aware mix, 48 kHz PCM24.

python scripts/generate-score-v3.py --revision c --music-only

C always produces previews only while replacement native voices and the
music candidate await approval. Re-running C rebinds input FX to current text.

No downloaded audio or external samples. The old synthesis helpers are used
as instruments only; harmony, bass, motif, groove, fills and cue map are new.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
sys.dont_write_bytecode = True
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, sosfiltfilt, resample_poly

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'public/audio/v3'
OUT = BASE
AUDITION = ROOT / 'audition'
SR, SECONDS, BPM = 48000, 40, 144
N, BEAT, BAR = SR * SECONDS, 60 / BPM, 240 / BPM
RNG = np.random.default_rng(1442403)
spec = importlib.util.spec_from_file_location('original_instruments', ROOT / 'scripts/generate-score.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)


def filt(x, kind, cutoff, order=3):
    return sosfilt(butter(order, cutoff, kind, fs=SR, output='sos'), x, axis=0)


def env(t, duration, attack=.001, release=.04):
    return s.smooth_env(t, duration, attack, release)


def save(path, data):
    assert data.ndim == 2 and data.shape[1] == 2 and np.isfinite(data).all()
    assert np.max(np.abs(data)) < 1, (path, np.max(np.abs(data)))
    sf.write(path, data, SR, subtype='PCM_24')


def measure(path):
    p = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(path), '-af',
                        'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True, check=True)
    raw = json.loads(re.findall(r'\{\s*"input_i".*?\}', p.stderr, re.S)[-1])
    return {'integrated_lufs': float(raw['input_i']), 'true_peak_dbtp': float(raw['input_tp']),
            'loudness_range_lu': float(raw['input_lra']), 'threshold_lufs': float(raw['input_thresh'])}, raw


def kick():
    t = s.timeline(.31)
    f = 51 + 112 * np.exp(-t * 49)
    body = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t*14)
    click = filt(RNG.normal(size=len(t)), 'highpass', 2800) * np.exp(-t*240) * .085
    return np.tanh((body + click)*1.7)*.8*env(t, .31, .001, .045)


def snare():
    t = s.timeline(.175)
    noise = filt(RNG.normal(size=len(t)), 'bandpass', [1500, 10000])
    body = np.sin(2*np.pi*195*t)*np.exp(-t*49)*.32
    return (noise*np.exp(-t*33)*.56 + body)*env(t, .175, .0007, .032)


def rim():
    t = s.timeline(.059)
    return (np.sin(2*np.pi*850*t)+.55*np.sin(2*np.pi*1423*t))*np.exp(-t*85)*env(t,.059)*.36


def bass(note, duration, bright=False):
    t = s.timeline(duration)
    f = s.hz(note)
    phase = 2*np.pi*f*t
    # A rounded sub and short upper harmonics translate on phone speakers.
    x = np.sin(phase)*.72
    x += np.sin(phase*2 + np.sin(phase)*(.7 if bright else .3))*np.exp(-t*9)*.24
    x += np.sin(phase*3)*np.exp(-t*18)*.09
    return np.tanh(x*1.3)*env(t,duration,.003,.035)*np.exp(-t*2)


def stab(notes, duration=.18):
    t = s.timeline(duration)
    out = np.zeros((len(t),2))
    for i,note in enumerate(notes):
        f = s.hz(note)
        x = (np.sin(2*np.pi*f*t)+.24*np.sin(2*np.pi*f*2.001*t))*np.exp(-t*11)
        out += s.stereo(x, (i-1)*.28)
    return out/len(notes)*env(t,duration,.004,.055)[:,None]


def bell(note, duration=.32):
    t = s.timeline(duration)
    phase = 2*np.pi*s.hz(note)*t
    x = np.sin(phase + np.sin(phase*2)*.9*np.exp(-t*18))*np.exp(-t*10)
    return x*env(t,duration,.003,.045)


def whoosh(duration=.5, descending=False):
    t = s.timeline(duration)
    noise = filt(RNG.normal(size=len(t)), 'bandpass', [1200, 10500])
    rise = t/duration
    if descending:
        e = np.exp(-rise*5)*(1-np.exp(-rise*70))
    else:
        e = rise**2*(1-np.exp(-(1-rise)*38))
    x = noise*e*.22
    pan = np.linspace(-.8,.8,len(t))
    return np.column_stack([x*np.cos((pan+1)*np.pi/4), x*np.sin((pan+1)*np.pi/4)])


def tick(pitch=1750):
    t = s.timeline(.035)
    x = np.sin(2*np.pi*pitch*t)*np.exp(-t*150)*.22
    x += filt(RNG.normal(size=len(t)), 'highpass', 4800)*np.exp(-t*220)*.1
    return x*env(t,.035,.0007,.009)


def fade_range(data, start, end, edge=.008):
    lo, hi = round(start*SR), round(end*SR)
    k = round(edge*SR)
    if lo > k:
        data[lo-k:lo] *= np.linspace(1,0,k)[:,None]
    data[lo:hi] = 0
    if hi+k < len(data):
        data[hi:hi+k] *= np.linspace(0,1,k)[:,None]


def compose():
    drums, low, melodic, effects = [np.zeros((N,2)) for _ in range(4)]
    ks, ss, clap, rs = kick(), snare(), s.clap(), rim()
    # E minor, D, C, A minor. New motif is a syncopated call / reply.
    roots = [40,38,36,33]
    chords = [[64,67,71], [62,66,69], [60,64,67], [60,64,69]]
    motif = [[76,79,83,78], [78,81,74,78], [76,79,72,76], [76,81,79,74]]
    for bar in range(24):
        at = bar*BAR
        c = ((bar-1)//2)%4 if bar>0 else 0
        if bar>=20: c = [2,3,0,0][bar-20]
        intro, overhead = bar==0, 9<=bar<11
        english, closing = 18<=bar<20, bar>=22
        full = 14<=bar<18 or 20<=bar<22
        # Sustained drum pulse under every language; English gets a softer rim.
        kicks = [0,2.5] if intro else ([0,1.5,2.75] if overhead else [0,1,2,3])
        if closing: kicks = [0,1.5] if bar==22 else []
        if bar in [8,10,13,17,21]: kicks = [0,1,2]
        if full and bar%2: kicks += [3.5]
        for beat in kicks:
            s.add(drums,ks,at+beat*BEAT,.73 if not english else .52)
        if not intro and not closing:
            for beat in [1,3]:
                s.add(drums,rs if english else ss,at+beat*BEAT,.46 if english else .53)
                if not english: s.add(drums,clap,at+beat*BEAT+.004,.39,.08)
            # Ghost notes give the backbeat a broken, propulsive feel.
            if bar%2==0 and not english:
                s.add(drums,ss,at+2.75*BEAT,.10,-.18)
        hats = range(16) if full else range(0,16,2)
        if intro: hats = [8,10,12,14,15]
        if closing: hats = [0,2,4] if bar==22 else []
        for step in hats:
            swing = .011 if step%2 else 0
            gain = .085 if step%4==2 else (.051 if step%2==0 else .027)
            if english: gain *= .72
            s.add(drums,s.hat(step%8==6 and full),at+step*BEAT/4+swing,gain,(-1 if step%4 else 1)*.28)
        # Percussion identity changes every two bars; no static repeated loop.
        if 1<=bar<22 and not english:
            for beat in ([.75,2.25,3.75] if bar%2 else [.5,2.5]):
                s.add(drums,rs,at+beat*BEAT,.15 if full else .10,-.42 if beat<2 else .42)
        if bar in [4,8,10,13,17,21]:
            for j,beat in enumerate([3,3.25,3.5,3.75]):
                s.add(drums,ss,at+beat*BEAT,.14+j*.055,(-1 if j%2 else 1)*.2)
                s.add(drums,rs,at+beat*BEAT+.012,.1+j*.02)
        # Main bass line moves around the kicks with anticipations and octaves.
        pattern = [(0,.65,0),(.75,.42,0),(1.5,.35,12),(2,.7,0),(2.75,.36,7),(3.5,.4,0)]
        if bar%2: pattern = [(0,.55,0),(.5,.3,12),(1.25,.52,0),(2,.6,0),(3,.4,7),(3.5,.4,0)]
        if intro: pattern = [(0,.9,0),(2.5,.5,0)]
        if overhead: pattern = [(0,.48,0),(1.5,.4,0),(2.75,.38,7)]
        if english: pattern = [(0,1.2,0),(2,1.15,0)]
        if closing: pattern = [(0,1.6,0)] if bar==22 else []
        for beat,length,octave in pattern:
            s.add(low,bass(roots[c]+octave,length*BEAT,full),at+beat*BEAT,.35 if english else .45)
        # Muted offbeat chords leave speech frequencies spacious.
        stabs = [.75,2.5] if bar%2==0 else [1.5,3.5]
        if intro or english: stabs = []
        if closing: stabs = [0] if bar==22 else []
        for beat in stabs:
            s.add(melodic,stab(chords[c],.23 if full else .18),at+beat*BEAT,.22 if full else .15)
        if bar>=1 and not overhead and not english and not closing:
            beats = [.5,1.75,2.5,3.25] if bar%2==0 else [.75,1.5,2.75,3.5]
            for i,(beat,note) in enumerate(zip(beats,motif[c])):
                p = -.43 if i%2==0 else .43
                gain = .18 if full else .105
                s.add(melodic,bell(note),at+beat*BEAT,gain,p)
                if full: s.add(melodic,bell(note),at+(beat+.75)*BEAT,gain*.16,-p)
    # Audible musical preparation and arrivals, aligned to visual bar boundaries.
    for frame in [900,1100,1400,1600,1800,2000,2200]:
        onset = frame/60
        s.add(effects,whoosh(.36 if frame!=1400 else .58),onset-(.36 if frame!=1400 else .58),.40)
        s.add(effects,whoosh(.18,True),onset,.36)
    # Eight languages each have a restrained dry click, distinct pitches.
    for i in range(8):
        onset=(100+i*100)/60
        s.add(effects,tick(1500+i*65),onset+.025,.43, -.25+i*.07)
        s.add(effects,tick(2500+i*37),onset+.17,.19, .25-i*.07)
    # Waiting ticks: displaced rhythmic punctuation, then a quick build.
    for step in range(12):
        s.add(effects,tick(1000+step*43),15+step*BEAT/2,.30 if step%2==0 else .16,(step%3-1)*.35)
    # Settings detents and the pivotal EN button's low impact + dry tactile click.
    for frame,pitch in [(1110,1320),(1150,1620),(1200,1950),(1270,2230)]:
        s.add(effects,tick(pitch),frame/60,.40)
    en=1400/60
    s.add(drums,ks,en,.35)
    s.add(effects,tick(1350),en,.88)
    s.add(effects,bass(28,.32),en,.48)
    s.add(melodic,s.accent([76,79,83],.48),en,.30)
    for i in range(8):
        s.add(effects,tick(1850+i*150),en+.06+i*.025,.19,(-.6+i*.17))
    # Benefit titles hit as a question / answer with a tight paired percussion hit.
    for frame in [1600,1700]:
        s.add(effects,tick(1880),frame/60,.49)
        s.add(drums,rs,frame/60+.07,.19)
    # English entry stays dry and low; melodic response returns after speech.
    s.add(effects,tick(1140),30,.22)
    for i,note in enumerate([76,79,83]):
        s.add(melodic,bell(note,.43),33.333+i*.105,.22,(-.38+i*.38))
    # Brand lands in E minor, resolves into E/add9 and decays with no reverb tail.
    land=2200/60
    s.add(effects,tick(1480),land,.48)
    s.add(melodic,s.chord([52,59,64,67,78],2.25),land,.24)
    for i,note in enumerate([83,79,78,76]):
        s.add(melodic,bell(note,.65),land+i*.105,.17,(-.3+i*.2))
    # Two designed stops; clicking EN is preceded by a complete 167 ms pocket.
    for track in [drums,low,melodic,effects]:
        fade_range(track,1390/60,1400/60,edge=.005)
    # Stop between Waiting and Settings then restart crisp on bar 11.
    for track in [drums,low,melodic]:
        fade_range(track,1095/60,1100/60,edge=.004)
    t=np.arange(N)/SR
    # Kick/bass interaction only; harmony is not pumped along with all music.
    sidechain=.72+.28*(1-np.exp(-np.mod(t,BEAT)*30))
    low *= sidechain[:,None]
    drums = np.tanh(drums*1.2)/1.2*.65
    low *= .55
    melodic *= .72
    effects *= .66
    ending=np.interp(t,[0,.008,38.1,39.65,40],[0,1,1,0,0])
    for track in [drums,low,melodic,effects]:
        track *= ending[:,None]
        track[t>=39.65]=0
    return drums,low,melodic,effects


def compose_b():
    """Pleasant straight pulse: no FM bell, metal rim or ghost-note lattice."""
    drums,low,melodic,effects=[np.zeros((N,2)) for _ in range(4)]
    t=s.timeline(.32)
    frequency=52+70*np.exp(-t*52)
    k=np.sin(2*np.pi*np.cumsum(frequency)/SR)*np.exp(-t*12.5)
    k=np.tanh(k*1.25)*.77*env(t,.32,.0025,.045)
    t=s.timeline(.17)
    noise=filt(RNG.normal(size=len(t)),'bandpass',[1150,5800])
    e=np.zeros_like(t)
    for at,g in [(0,.36),(.011,.55),(.024,1)]:
        e+=np.where(t>=at,np.exp(-np.maximum(t-at,0)*42)*g,0)
    cp=noise*e*.16*env(t,.17,.001,.03)
    cp+=np.sin(2*np.pi*190*t)*np.exp(-t*52)*.052*env(t,.17)

    def soft_hat(duration=.044):
        tt=s.timeline(duration)
        n=filt(RNG.normal(size=len(tt)),'bandpass',[5400,10500])
        return n*np.exp(-tt*82)*env(tt,duration,.001,.01)*.40

    def warm_bass(note,duration):
        tt=s.timeline(duration)
        phase=2*np.pi*s.hz(note)*tt
        x=.74*np.sin(phase)+.17*np.sin(2*phase)+.065*np.sin(3*phase)
        return np.tanh(x*1.15)*env(tt,duration,.008,.033)*np.exp(-tt*.9)

    def warm_keys(notes,duration=.28):
        tt=s.timeline(duration)
        x=np.zeros((len(tt),2))
        for i,note in enumerate(notes):
            f=s.hz(note)
            a=(np.sin(2*np.pi*f*tt)+.10*np.sin(4*np.pi*f*tt))*np.exp(-tt*5.5)
            x+=s.stereo(a,(i-1)*.24)
        return x/len(notes)*env(tt,duration,.015,.07)[:,None]

    roots=[38,35,43,33]
    chords=[[62,66,69],[62,66,71],[62,67,71],[61,64,69]]
    for bar in range(24):
        at=bar*BAR
        c=((bar-1)//2)%4 if bar else 0
        if bar>=20: c=[2,3,0,0][bar-20]
        intro=bar==0
        waiting=9<=bar<11
        english=18<=bar<20
        full=14<=bar<18 or 20<=bar<22
        brand=bar>=22
        kicks=[0,2] if intro or waiting else [0,1,2,3]
        if bar==13: kicks=[0,1,2]
        if brand: kicks=[0] if bar==22 else []
        for beat in kicks:
            s.add(drums,k,at+beat*BEAT,.81 if full else (.58 if english else .72))
        if not intro and not brand:
            for beat in [1,3]:
                s.add(drums,cp,at+beat*BEAT,.91 if full else (.34 if english else .77))
        steps=[4,6] if intro else range(8)
        if brand: steps=[0,1] if bar==22 else []
        for step in steps:
            gain=.072 if step%2 else .047
            if english: gain*=.50
            s.add(drums,soft_hat(),at+step*BEAT/2,gain,-.17 if step%2 else .17)
        # A consistent offbeat bass line locks to the quarter-note pulse.
        # Tiny phrase endings occur only at scene changes, never every bar.
        bassbeats=[.5,1.5,2.5,3.5]
        if intro: bassbeats=[.5,2.5]
        if waiting: bassbeats=[.5,2.5]
        if english: bassbeats=[.5,2.5]
        if brand: bassbeats=[0] if bar==22 else []
        for beat in bassbeats:
            duration=BEAT*(.74 if not english else 1.2)
            if brand: duration=BEAT*2.2
            s.add(low,warm_bass(roots[c],duration),at+beat*BEAT,.39 if english else .48)
        if not english:
            # A soft pad supports the same diatonic progression as the keys.
            if not brand:
                s.add(melodic,s.chord(chords[c],BAR+.035),at,.055 if not intro else .035)
            beats=[.5,2.5] if not waiting else [2.5]
            if intro: beats=[2.5]
            if brand: beats=[]
            for beat in beats:
                s.add(melodic,warm_keys(chords[c],.30),at+beat*BEAT,.24 if full else .17)
        # Transition-only clap fills, restrained and metrically clear.
        if bar in [8,10,13,17,21]:
            for j,beat in enumerate([3,3.5,3.75]):
                s.add(drums,cp,at+beat*BEAT,.18+j*.13,(-1 if j%2 else 1)*.08)
    # Short motion air, filtered to remove sharp upper hiss.
    for frame in [900,1100,1400,1600,1800,2000,2200]:
        onset=frame/60
        duration=.45 if frame==1400 else .28
        w=filt(whoosh(duration),'lowpass',5700)
        s.add(effects,w,onset-duration,.32)
        s.add(effects,filt(whoosh(.16,True),'lowpass',5700),onset,.20)
    # Soft interface touches replace bright metallic ticks.
    for i in range(8):
        s.add(effects,filt(tick(1100+i*30),'lowpass',3800),(100+i*100)/60+.025,.22)
    for frame in [1110,1150,1200,1270]:
        s.add(effects,filt(tick(1400),'lowpass',3800),frame/60,.25)
    en=1400/60
    s.add(drums,k,en,.30)
    s.add(effects,filt(tick(1250),'lowpass',4300),en,.67)
    s.add(low,warm_bass(26,.26),en,.25)
    s.add(melodic,warm_keys([62,66,69,73],.62),en,.34)
    # Converging paths read as one brief air movement, not eight pitched taps.
    s.add(effects,filt(whoosh(.34,True),'lowpass',4900),en+.03,.16)
    for frame in [1600,1700]:
        s.add(effects,filt(tick(1500),'lowpass',4300),frame/60,.27)
    s.add(effects,filt(tick(900),'lowpass',3200),30,.13)
    # Friendly major cadence at the brand; soft transient, warm resolving body.
    land=2200/60
    s.add(effects,filt(tick(1350),'lowpass',4000),land,.31)
    s.add(melodic,s.chord([50,57,62,66,69,71],2.65),land,.22)
    s.add(melodic,warm_keys([66,69,74],.95),land+.055,.17)
    for x in [drums,low,melodic,effects]:
        fade_range(x,1390/60,1400/60,.005)
    for x in [drums,low,melodic]:
        fade_range(x,1095/60,1100/60,.005)
    tt=np.arange(N)/SR
    # Bass-only kick breathing is shallow; the whole cue stays even.
    low*= (.85+.15*(1-np.exp(-np.mod(tt,BEAT)*25)))[:,None]
    drums*=.67
    low*=.57
    melodic*=.73
    effects*=.95
    ending=np.interp(tt,[0,.012,38.5,39.65,40],[0,1,1,0,0])
    for x in [drums,low,melodic,effects]:
        x*=ending[:,None]
        x[tt>=39.65]=0
    return drums,low,melodic,effects


def archive_a():
    """Copy explicitly named A artifacts once, never delete or overwrite them."""
    archive=BASE/'revision-a-rejected'
    archive.mkdir(parents=True,exist_ok=True)
    for name in ['drums.wav','bass.wav','melody.wav','music.wav','effects.wav','voices.wav','master.wav','master-premix.wav']:
        source=BASE/name
        dest=archive/name
        if source.exists() and not dest.exists(): shutil.copy2(source,dest)
    dest=AUDITION/'music-groove-a-rejected.wav'
    if (AUDITION/'music-groove.wav').exists() and not dest.exists():
        shutil.copy2(AUDITION/'music-groove.wav',dest)
    for ext in ['json','md']:
        source=ROOT/f'docs/score-v3-report.{ext}'
        dest=ROOT/f'docs/score-v3-report-a-rejected.{ext}'
        if source.exists() and not dest.exists(): shutil.copy2(source,dest)


def current_ui_events():
    """Evaluate the real animation helpers, including grapheme text, per frame."""
    js="""
import * as t from './src/v3/timeline.mjs';
import v from './src/v3/voice-timing.json' with {type:'json'};
const keys=[];
const capture=(id,fn)=>{let prev=[];for(let f=0;f<2400;f++){
const now=t.graphemes(fn(f));let common=0;while(common<prev.length&&common<now.length&&prev[common]===now[common])common++;
for(const ch of now.slice(common))keys.push({frame:f,language:id,character:ch});prev=now;}};
t.LANGUAGES.forEach((l,i)=>capture(l.id,f=>t.languageState(i,f).value));
capture('en',f=>v.en.characters?.length?v.en.characters.filter(c=>f>=c.frame).map(c=>c.character).join(''):t.typed(t.ENGLISH,f,1800,1800+Math.min(v.en.frames-4,177)));
const mouse=(t.inputClicks??t.LANGUAGES.map(l=>l.start-2)).map((frame,i)=>({frame,event:'input_focus',language:t.LANGUAGES[i].id}));
mouse.push({frame:1100,event:'settings_open'},{frame:1230,event:'DeepSeek_select'},{frame:1400,event:'EN_click'});
process.stdout.write(JSON.stringify({keyboard:keys.sort((a,b)=>a.frame-b.frame),mouse,native_status:v.native_status,english_status:v.english_status}));
"""
    p=subprocess.run(['node','--input-type=module','-e',js],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',check=True)
    events=json.loads(p.stdout)
    events['timeline_sha256']=hashlib.sha256((ROOT/'src/v3/timeline.mjs').read_bytes()).hexdigest()
    events['voice_timing_sha256']=hashlib.sha256((ROOT/'src/v3/voice-timing.json').read_bytes()).hexdigest()
    events['status']=('Bound to selected user-approved native and English timing.' if events.get('native_status')=='selected'
                      else 'Actual current visible-character frames; native voice/text timing undergoing revision. Rerun C to rebind.')
    for e in events['keyboard']+events['mouse']: e['sample_frame']=e['frame']*800
    return events


def compose_c():
    # The comfortable B foundation is deliberately unchanged.
    drums,low,melodic,_=compose_b()
    melodic*=.54

    def airy_note(note,duration=.64):
        tt=s.timeline(duration)
        f=s.hz(note)
        # Smooth harmonic additive voice; no metallic FM or pitch modulation.
        out=np.zeros((len(tt),2))
        for channel,detune in enumerate([-.00065,.00065]):
            phase=2*np.pi*f*(1+detune)*tt
            x=.78*np.sin(phase)+.13*np.sin(phase*2)+.035*np.sin(phase*3)
            out[:,channel]=x*env(tt,duration,.014,.20)*np.exp(-tt*3.5)
        return out

    # Four descending notes across two bars: a simple, memorable D-major theme.
    # The spacing is deliberate; UI and voices occupy the room between notes.
    phrase=[(0,.5,78),(0,2.5,76),(1,.5,74),(1,2.5,69)]
    for pair in range(1,22,2):
        if pair in [9,17,19]: continue
        gain=.18 if 13<=pair<18 or pair==21 else .12
        for offset,beat,note in phrase:
            bar=pair+offset
            if bar>=22 or bar in [18,19]: continue
            at=bar*BAR+beat*BEAT
            sound=airy_note(note)
            s.add(melodic,sound,at,gain)
            # Two soft stereo-space echoes keep the center clear.
            s.add(melodic,sound[:,::-1],at+BEAT*.75,gain*.15)
            s.add(melodic,sound,at+BEAT*1.5,gain*.065)
    # The brand answers the phrase on its tonic, then releases quietly.
    s.add(melodic,airy_note(74,1.2),2200/60+.04,.14)
    s.add(melodic,airy_note(81,.9),2200/60+.28,.052)
    motion,keyboard,mouse=[np.zeros((N,2)) for _ in range(3)]
    for frame in [900,1100,1400,1600,1800,2000,2200]:
        onset=frame/60
        duration=.42 if frame==1400 else .26
        s.add(motion,filt(whoosh(duration),'lowpass',6200),onset-duration,.29)
        s.add(motion,filt(whoosh(.17,True),'lowpass',5400),onset,.22)
    events=current_ui_events()

    def key_sound(index):
        tt=s.timeline(.032)
        # A close, soft mechanical key: low body + short filtered contact.
        contact=filt(RNG.normal(size=len(tt)),'bandpass',[650,4400])*np.exp(-tt*210)
        body=np.sin(2*np.pi*(240+(index%7)*21)*tt)*np.exp(-tt*125)*.31
        x=(contact*.72+body)*env(tt,.032,.0008,.008)
        x+=np.roll(contact,round(.009*SR))*.13*env(tt,.032,.001,.01)
        return x*.17/max(np.max(np.abs(x)),1e-12)

    for i,event in enumerate(events['keyboard']):
        char=event['character']
        velocity=.56+(i%5)*.035
        if char.isspace(): velocity*=.50
        elif char in ['.','…','。',',','，']: velocity*=.72
        event['velocity']=round(velocity,4)
        event['pitch_variant']=i%7
        event['source']='visible text change on exact integer render frame'
        s.add(keyboard,key_sound(i),event['frame']/60,velocity,(i%3-1)*.10)

    def mouse_sound():
        tt=s.timeline(.043)
        n=filt(RNG.normal(size=len(tt)),'bandpass',[1400,7200])
        x=n*np.exp(-tt*260)*.4+np.sin(2*np.pi*420*tt)*np.exp(-tt*170)*.13
        x*=env(tt,.043,.0006,.012)
        x+=np.roll(x,round(.016*SR))*.31*env(tt,.043,.0008,.014)
        return x*.22/max(np.max(np.abs(x)),1e-12)

    for event in events['mouse']:
        gain=.36 if event['event']=='input_focus' else (.77 if event['event']=='EN_click' else .61)
        event['velocity']=gain
        s.add(mouse,mouse_sound(),event['frame']/60,gain)
    # Preserve the EN breathing pocket. Inputs/clicks occur on their exact frame.
    tt=np.arange(N)/SR
    ending=np.interp(tt,[0,.012,38.5,39.65,40],[0,1,1,0,0])
    for x in [melodic,motion]:
        fade_range(x,1390/60,1400/60,.005)
    for x in [keyboard,mouse]:
        x[round(1390/60*SR):round(1400/60*SR)]=0
    for x in [melodic,motion,keyboard,mouse]:
        x*=ending[:,None]
        x[tt>=39.65]=0
    # Avoid fading the onset of the pivotal mouse click along with music.
    # Its 1400-frame event starts after the pocket, as rendered on screen.
    effects=motion+keyboard+mouse
    return drums,low,melodic,effects,{'motion':motion,'keyboard':keyboard,'mouse':mouse},events


def load_voices(provisional):
    voices=np.zeros((N,2))
    windows=[]
    if provisional: return voices,windows
    manifest=json.loads((BASE/'voices-manifest.json').read_text(encoding='utf-8'))
    for entry in manifest['voices']:
        path=ROOT/entry['output_file']
        clip,sr=sf.read(path,dtype='float64',always_2d=True)
        if sr!=SR: clip=resample_poly(clip,SR,sr,axis=0)
        if clip.shape[1]==1: clip=np.repeat(clip,2,axis=1)
        assert clip.shape[1]==2
        start=entry['start_frame']/60
        end=start+len(clip)/SR
        assert end<=40
        # Native clips remain original; mix automation may apply modest gain.
        gain=1.0 if entry['language']=='en' else .91
        s.add(voices,clip,start,gain)
        windows.append({'language':entry['language'],'start_frame':entry['start_frame'],
                        'end_frame':round(end*60,3),'mix_gain':gain,'file':entry['output_file']})
    return voices,windows


def duck_melody(melodic,windows):
    # Only 700-4800 Hz melodic content gives way. Drums never use voice ducking.
    # Zero-phase band extraction keeps subtraction complementary, avoiding the
    # phase-induced gain changes of subtracting a causal filtered signal.
    mid=sosfiltfilt(butter(3,[700,4800],'bandpass',fs=SR,output='sos'),melodic,axis=0)
    duck=np.ones(N)
    for w in windows:
        start,end=w['start_frame']/60,w['end_frame']/60
        seconds=np.arange(N)/SR
        gain=.24 if w['language']=='en' else .39
        curve=np.interp(seconds,[0,max(0,start-.035),start+.025,end-.02,end+.16,40],
                        [1,1,gain,gain,1,1])
        duck=np.minimum(duck,curve)
    return melodic-mid*(1-duck[:,None])


def peak_limit(data, ceiling=-1.65):
    # Transparent fixed gain guard using 4x oversampled true-peak estimate.
    peak=np.max(np.abs(resample_poly(data,4,1,axis=0)))
    return data*min(1,10**(ceiling/20)/max(peak,1e-9))


def final_c_delivery():
    """Explicit final branch, called after the coordinating agent binds approval."""
    manifest_path=BASE/'voices-manifest.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    timing=json.loads((ROOT/'src/v3/voice-timing.json').read_text(encoding='utf-8'))
    assert manifest.get('native_selection',{}).get('status')=='user-approved', 'Native selection not approved'
    assert timing.get('native_status')=='selected', 'Timing has not been bound to selected natives'
    assert timing.get('english_status')=='user-approved-B', 'English B selection not bound'
    voice_input_hashes={}
    for entry in manifest['voices']:
        source=ROOT/entry['output_file']
        actual=hashlib.sha256(source.read_bytes()).hexdigest()
        assert actual==entry['output_sha256'], ('Approved voice hash mismatch',entry['language'])
        voice_input_hashes[entry['language']]={'file':entry['output_file'],'sha256':actual}
    AUDITION.mkdir(parents=True,exist_ok=True)
    archive_a()
    preserved={name:hashlib.sha256((AUDITION/name).read_bytes()).hexdigest()
               for name in ['music-groove.wav','music-groove-a-rejected.wav','music-groove-b.wav',
                            'music-groove-c-pure.wav','music-groove-c-ui.wav'] if (AUDITION/name).exists()}
    drums,low,melodic,effects,parts,events=compose_c()
    voices,windows=load_voices(False)
    native_windows=[w for w in windows if w['language']!='en']
    assert [w['start_frame'] for w in native_windows]==list(range(100,900,100))
    assert all(w['end_frame']==w['start_frame']+120 for w in native_windows)
    en_window=next(w for w in windows if w['language']=='en')
    assert en_window['start_frame']==1800 and en_window['end_frame']==1978.5
    before_voice_peak=float(np.max(np.abs(voices)))
    voices=peak_limit(voices)
    voice_bus_gain=float(np.max(np.abs(voices)))/max(before_voice_peak,1e-12)
    melodic=duck_melody(melodic,windows)
    music=drums+low+melodic
    stems={'drums':drums,'bass':low,'melody':melodic,'keyboard':parts['keyboard'],
           'mouse':parts['mouse'],'motion':parts['motion'],'voices':voices,'music':music,'effects':effects}
    for name,x in stems.items(): save(BASE/f'{name}.wav',x)
    premix=peak_limit(music+effects+voices,-2)
    save(BASE/'master-premix.wav',premix)
    _,raw=measure(BASE/'master-premix.wav')
    af=('loudnorm=I=-16:TP=-1.6:LRA=11:measured_I={input_i}:measured_TP={input_tp}:'
        'measured_LRA={input_lra}:measured_thresh={input_thresh}:offset={target_offset}:'
        'linear=true:print_format=summary').format(**raw)
    subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(BASE/'master-premix.wav'),
                    '-af',af,'-ar',str(SR),'-ac','2','-c:a','pcm_s24le',str(BASE/'master.wav')],check=True)
    master,_=sf.read(BASE/'master.wav',always_2d=True)
    master=peak_limit(master)
    # Sample-rate conversion can add a tiny pre-echo at the silence edge.
    # Restore the deliberately designed exact pocket after the final converter.
    master[1390*800:1400*800]=0
    master[-round(.35*SR):]=0
    save(BASE/'master.wav',master)
    stems['master']=master
    # Requested video preview slice: frames 1400 through 2259 inclusive.
    clip=master[1400*800:2260*800]
    save(BASE/'output-logo.wav',clip)
    shutil.copy2(BASE/'master.wav',BASE/'preview-master-native-b-c.wav')
    zh=next(e for e in manifest['voices'] if e['language']=='zh')
    shutil.copy2(ROOT/zh['output_file'],BASE/'preview-chinese-mono.wav')
    phone=BASE/'master-phone-mono.mp3'
    subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(BASE/'master.wav'),
                    '-ac','1','-af','pan=mono|c0=0.5*c0+0.5*c1,loudnorm=I=-16:TP=-2.5:LRA=11','-ar',str(SR),
                    '-c:a','libmp3lame','-b:a','128k','-metadata',
                    'title=V3 C approved music and native B / phone mono',str(phone)],check=True)
    events['voice_manifest_sha256']=hashlib.sha256(manifest_path.read_bytes()).hexdigest()
    (BASE/'ui-events-final.json').write_text(json.dumps(events,ensure_ascii=False,indent=2),encoding='utf-8')
    measurements={name:measure(BASE/f'{name}.wav')[0] for name in stems}
    measurements['output_logo']=measure(BASE/'output-logo.wav')[0]
    measurements['phone_mono']=measure(phone)[0]
    now={name:hashlib.sha256((AUDITION/name).read_bytes()).hexdigest() for name in preserved}
    assert now==preserved, 'Old audition modified'
    validations={
        'frames_per_full_stem':N,'sample_rate':SR,'channels':2,'subtype':'PCM_24',
        'old_a_b_c_audition_hashes_preserved':now,
        'music_stem_sum_max_error':float(np.max(np.abs(drums+low+melodic-music))),
        'effects_stem_sum_max_error':float(np.max(np.abs(parts['keyboard']+parts['mouse']+parts['motion']-effects))),
        'en_pocket_max_amplitude':float(np.max(np.abs(master[1390*800:1400*800]))),
        'tail_max_amplitude':float(np.max(np.abs(master[-16800:]))),
        'output_logo_frame_range_inclusive':[1400,2259],'output_logo_sample_frames':len(clip),
        'native_starts':[w['start_frame'] for w in windows if w['language']!='en'],
        'native_ends':[w['end_frame'] for w in windows if w['language']!='en'],
        'overlap_frames':20,
    }
    assert all(x.shape==(N,2) and np.isfinite(x).all() for x in stems.values())
    assert validations['en_pocket_max_amplitude']<1e-7
    assert validations['tail_max_amplitude']==0
    assert measurements['master']['true_peak_dbtp']<=-1.5
    assert measurements['phone_mono']['true_peak_dbtp']<=-1.5
    assert abs(measurements['master']['integrated_lufs']+16)<=.6
    report={'status':'Final C mix: user-approved music C, keyboard/mouse, native B-logo and English B.',
            'approval':'Coordinating agent confirmed user adopted native B, English B and music C; final manifest and timing marked selected.',
            'reference_audio':'Reference soundtrack unavailable; no claim of listening, copying, measured tempo or musical equivalence.',
            'reference_urls':['https://x.com/Kimi_Moonshot/status/2102372557190230244','https://www.youtube.com/watch?v=L1y09RA3fts'],
            'voice_manifest':str(manifest_path),'voice_manifest_sha256':events['voice_manifest_sha256'],
            'voice_windows':windows,'voice_input_hashes':voice_input_hashes,'voice_bus_peak_guard_gain':voice_bus_gain,
            'keyboard_count':len(events['keyboard']),'mouse_events':events['mouse'],
            'bpm':144,'bars':24,'seconds':40,'fps':60,'mix':'Only 700–4800 Hz melody ducks for speech; drums and bass remain. Native overlapping fades are in approved delivery WAVs; no extra crop/stretch. 2-pass EBU -16 LUFS, guarded <=-1.5 dBTP.',
            'measurements':measurements,'validation':validations,
            'mobile':str(phone),'chinese_mono':str(BASE/'preview-chinese-mono.wav'),
            'preview_master':str(BASE/'preview-master-native-b-c.wav'),'output_logo':str(BASE/'output-logo.wav')}
    master_hash=hashlib.sha256((BASE/'master.wav').read_bytes()).hexdigest()
    report['master_sha256']=master_hash
    contract={'approval_status':'user-approved','music_revision':'C','native_selection':'B-logo','english_selection':'B',
              'official_manifest_version':manifest['version'],'official_manifest_sha256':events['voice_manifest_sha256'],
              'master_file':'public/audio/v3/master.wav','master_sha256':master_hash,
              'master_frames':N,'sample_rate':SR,'channels':2,'subtype':'PCM_24',
              'master_measurement':measurements['master'],'voice_windows':windows,'voice_input_hashes':voice_input_hashes,
              'voice_bus_peak_guard_gain':voice_bus_gain,'timeline_sha256':events['timeline_sha256'],
              'voice_timing_sha256':events['voice_timing_sha256'],
              'generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'stem_sha256':{name:hashlib.sha256((BASE/f'{name}.wav').read_bytes()).hexdigest() for name in stems},
              'preserved_master_file':'public/audio/v3/revision-a-rejected/master.wav',
              'preserved_master_sha256':hashlib.sha256((BASE/'revision-a-rejected/master.wav').read_bytes()).hexdigest(),
              'output_logo_file':'public/audio/v3/output-logo.wav','output_logo_frames_inclusive':[1400,2259],
              'output_logo_sha256':hashlib.sha256((BASE/'output-logo.wav').read_bytes()).hexdigest()}
    (BASE/'final-audio-contract.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2),encoding='utf-8')
    (ROOT/'docs/score-v3-final-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    rows='\n'.join(f'| {name} | {m["integrated_lufs"]:.2f} | {m["true_peak_dbtp"]:.2f} |' for name,m in measurements.items())
    text=f'''# 最终 C 混音\n\n用户已确认八语 B、英文 B、配乐 C 与键盘/鼠标音效。中文请求已统一为“帮我设计一个更有创意的新标志吧。”，英文为“Help me design a new logo.”。参考音轨未能取得，未声称已听取、复制或测量参考音乐。\n\n全部正式分轨 drums / bass / melody / keyboard / mouse / motion / voices / music / effects / master 均为 40 秒、48 kHz、双声道 PCM24。八语于 100、200、…800 帧启动，每段 120 帧；已确认的尾音淡出与下一句重叠 20 帧。只对旋律 700–4800 Hz 频带让位，鼓贝斯保持律动。EN 点击前 1390–1400 帧完全静音，39.65 秒后干净归零。\n\n键盘已按当前选定的实际可见字符重绑，共 {len(events['keyboard'])} 次；鼠标采用输入框 98、198、…798 帧以及设置 1100、DeepSeek 1230、EN 1400 帧。ui-events-final.json 保存逐字帧、采样点及源文件哈希。A/B/旧 C 试听文件哈希保持一致，正式语音清单没有改写。\n\n手机试听：public/audio/v3/master-phone-mono.mp3，单声道 128 kbps。中文单独试听：public/audio/v3/preview-chinese-mono.wav，与选定中文源文件逐字节一致。40 秒视频预览用 preview-master-native-b-c.wav，与正式 master 内容一致；PREVIEW 指视频用途。英文至 Logo 的 output-logo.wav 截取 1400–2259 帧，长 14.333 秒；英文于片段 6.667 秒开始，品牌落点在 13.333 秒。\n\n| 文件 | Integrated LUFS | True peak dBTP |\n|---|---:|---:|\n{rows}\n\n以上响度均测自写出的实际文件。正式音轨与试听副本保持 40 秒；中文独立片段和 Logo 截段按各自时长保留。\n'''
    (ROOT/'docs/score-v3-final-report.md').write_text(text,encoding='utf-8')
    print(json.dumps({'master':measurements['master'],'phone':measurements['phone_mono'],
                      'keyboard_events':len(events['keyboard']),'output_logo_seconds':len(clip)/SR,
                      'preserved_auditions':list(now),'voice_windows':windows},ensure_ascii=False,indent=2))


def main():
    global OUT
    parser=argparse.ArgumentParser()
    parser.add_argument('--music-only',action='store_true')
    parser.add_argument('--final-c',action='store_true')
    parser.add_argument('--revision',choices=['a','b','c'],default='c')
    args=parser.parse_args()
    if args.final_c:
        final_c_delivery()
        return
    AUDITION.mkdir(parents=True,exist_ok=True)
    if args.revision in ['b','c']:
        archive_a()
        OUT=BASE/('revision-'+args.revision)
    OUT.mkdir(parents=True,exist_ok=True)
    parts,events={},None
    if args.revision=='c':
        args.music_only=True  # C is an audition until music + new natives approved.
        drums,low,melodic,effects,parts,events=compose_c()
    else:
        drums,low,melodic,effects=compose_b() if args.revision=='b' else compose()
    voices,windows=load_voices(args.music_only)
    melodic=duck_melody(melodic,windows)
    music=drums+low+melodic
    stems=[('drums',drums),('bass',low),('melody',melodic),('music',music),('effects',effects)]
    if windows or args.revision=='a': stems.append(('voices',voices))
    stems.extend(parts.items())
    for name,track in stems:
        save(OUT/f'{name}.wav',track)
    # 20 s audition includes all eight native-bar grooves and both sides of EN.
    audition_start,audition_end=(14,34) if args.revision=='c' else (9,29)
    sl=slice(audition_start*SR,audition_end*SR)
    raw_audition=music[sl]+effects[sl]
    audition=raw_audition.copy()
    # Bring audition to a useful listening level without changing its groove.
    audition=peak_limit(audition*10**(6/20))
    audition_name={'a':'music-groove.wav','b':'music-groove-b.wav','c':'music-groove-c-ui.wav'}[args.revision]
    save(AUDITION/audition_name,audition)
    if args.revision in ['b','c']:
        # Match rejected A's audition loudness so loudness cannot bias comparison.
        aud_measure,_=measure(AUDITION/audition_name)
        audition=peak_limit(audition*10**((-16.4-aud_measure['integrated_lufs'])/20))
        save(AUDITION/audition_name,audition)
    pure_name=None
    if args.revision=='c':
        # Identical gain for pure/UI lets listeners assess the added input sounds.
        at=np.unravel_index(np.argmax(np.abs(raw_audition)),raw_audition.shape)
        preview_gain=float(audition[at]/raw_audition[at])
        pure_name='music-groove-c-pure.wav'
        save(AUDITION/pure_name,music[sl]*preview_gain)
        (OUT/'ui-events.json').write_text(json.dumps(events,ensure_ascii=False,indent=2),encoding='utf-8')
    master=None
    # B preview deliberately creates no speech master before the user listens.
    if not (args.revision in ['b','c'] and args.music_only):
        premix=peak_limit(music+effects+voices,-2)
        save(OUT/'master-premix.wav',premix)
        _,raw=measure(OUT/'master-premix.wav')
        af=('loudnorm=I=-16:TP=-1.6:LRA=11:measured_I={input_i}:measured_TP={input_tp}:'
            'measured_LRA={input_lra}:measured_thresh={input_thresh}:offset={target_offset}:'
            'linear=true:print_format=summary').format(**raw)
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(OUT/'master-premix.wav'),
                        '-af',af,'-ar',str(SR),'-ac','2','-c:a','pcm_s24le',str(OUT/'master.wav')],check=True)
        master,_=sf.read(OUT/'master.wav',always_2d=True)
        master=peak_limit(master)
        master[-round(.35*SR):]=0
        save(OUT/'master.wav',master)
    measurements={}
    for name in ['drums','bass','melody','music','effects']+list(parts)+(['master'] if master is not None else []):
        measurements[name],_=measure(OUT/f'{name}.wav')
    if windows: measurements['voices'],_=measure(OUT/'voices.wav')
    measurements['audition'],_=measure(AUDITION/audition_name)
    if pure_name: measurements['audition_pure'],_=measure(AUDITION/pure_name)
    # Continuous active sections establish that the rhythm does not disappear.
    regions={}
    for label,start,end in [('languages',100/60,900/60),('before_en',21,1390/60),
                             ('after_en',1400/60,1600/60),('english',30,33.333),('brand',2200/60,39.65)]:
        sl=slice(round(start*SR),round(end*SR))
        regions[label]={name:round(20*np.log10(max(np.sqrt(np.mean(x[sl]**2)),1e-12)),2)
                        for name,x in [('drums',drums),('bass',low),('music',music),('voices',voices)]}
    composition_b='Original D major / B minor / G / A straight 4/4 pulse. Soft dry clap, closed sand hats, warm consistent bass, short mellow keyboard chords and quiet pads. No FM-bell lead, metallic rim, ghost snare or repeated fill lattice. Fills only at scene changes.'
    composition_c='B drum/bass foundation unchanged; sparse four-note F#5–E5–D5–A4 theme across two bars, warm harmonic additive synth with short soft stereo echoes and quiet D-major pads. No FM/metallic lead or extra drum lattice. Independent mechanical keyboard, mouse and motion tracks bound to current rendered text/action frames.'
    report={'version':'v3-'+args.revision,'status':f'Candidate {args.revision.upper()} music audition; approval pending, no speech master generated' if args.revision in ['b','c'] and args.music_only else ('provisional music-only; speech mix pending' if args.music_only else 'speech mix generated; approval pending'),
            'seconds':40,'sample_rate':SR,'channels':2,'pcm_bits':24,'bpm':BPM,'bars':24,'fps':60,
            'composition':composition_c if args.revision=='c' else (composition_b if args.revision=='b' else 'Original E minor / D / C / A minor syncopated bass, dry backbeat, ghost snare, hat variations, muted chord stabs and FM-bell call/reply. New composition; no reference audio sample.'),
            'reference_access':'The coordinating agent inspected direct browser playback and observed a 39-second feature promo with fast UI movement, feature headings and mouse zooms. Page inventory exposed no exportable video. Documented downloadMedia on the actual video blob timed out after 30 seconds. Reference audio was not heard or measured; no claim of tempo, beat or instrumentation equivalence is made.',
            'reference_urls':['https://x.com/Kimi_Moonshot/status/2102372557190230244','https://www.youtube.com/watch?v=L1y09RA3fts'],
            'mix':'Only 700-4800 Hz melodic band ducks for speech (native 0.39, English 0.24). No speech duck on drums/bass. 2-pass EBU master target -16 LUFS / <=-1.5 dBTP.',
            'voice_windows':windows,'measurements':measurements,'regional_rms_dbfs':regions,
            'validation':{'stem_frames':N,'audition_frames':len(audition),'stem_sum_max_error':float(np.max(np.abs(drums+low+melodic-music))),
                          'en_pocket_max_amplitude':float(np.max(np.abs((music+effects)[round(1390/60*SR):round(1400/60*SR)]))),
                          'tail_max_amplitude':float(np.max(np.abs((master if master is not None else music+effects)[-round(.35*SR):])))},
            'stops_frames':[[1390,1400],[1095,1100]],'dry_tail_start_seconds':39.65,
            'audition':{'file':'audition/'+audition_name,'pure_file':'audition/'+pure_name if pure_name else None,'source_start_seconds':audition_start,'duration_seconds':20,'en_click_in_audition_seconds':1400/60-audition_start},
            'ui_events':{'manifest':str(OUT/'ui-events.json'),'keyboard_count':len(events['keyboard']),'mouse_count':len(events['mouse']),'binding_status':events['status']} if events else None,
            'phase_map':[{'frame':f,'label':l} for f,l in [(0,'intro'),(100,'eight languages'),(900,'Waiting / Token overhead'),(1100,'settings / DeepSeek'),(1400,'EN click / converge'),(1600,'Less waiting / Fewer tokens'),(1800,'English full line'),(2000,'logo morph'),(2200,'brand land'),(2400,'end')]]}
    report_name='score-v3-report-'+args.revision if args.revision in ['b','c'] else 'score-v3-report'
    (ROOT/f'docs/{report_name}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    table='\n'.join(f'| {name} | {m["integrated_lufs"]:.2f} | {m["true_peak_dbtp"]:.2f} |' for name,m in measurements.items())
    text=f'''# V3 candidate {args.revision.upper()} original score\n\nStatus: {report['status']}.\n\n40 seconds, 48 kHz stereo PCM24; 144 BPM; 24 bars (100 video frames per bar at 60 fps). Original synthesis; no external music samples.\n\n{report['composition']}\n\nReference access: {report['reference_access']} The source URLs are logged in the JSON report. This revision responds to the user's uncomfortable-groove feedback; it does not assert that the reference soundtrack was auditioned.\n\nB changes the tonal center to a friendly D-major progression and replaces the busy bass jumps with a consistent warm offbeat pulse. It removes the FM-bell tune, metallic rim, ghost notes and frequent percussion variation. The short clap fills occur only at transitions; the waiting section thins the pulse, the EN click retains a 10-frame pocket before impact, and the brand resolves to D/add6. All stems are silent from 39.65 seconds. Speech mixing is deferred until music approval; the eventual mixer ducks only 700–4800 Hz melodic content, leaving drums intact.\n\nA is preserved as audition/music-groove-a-rejected.wav and public/audio/v3/revision-a-rejected/. The original audition/music-groove.wav remains A. B files are isolated in public/audio/v3/revision-b/.\n\nThe 20-second B audition spans source seconds 9–29; the EN impact occurs at audition second 14.333. It contains music plus FX with no dialogue.\n\n| File | Integrated LUFS | True peak dBTP |\n|---|---:|---:|\n{table}\n\nMeasured with FFmpeg loudnorm after writing the actual WAV files. Stem loudness includes intentionally sparse sections. See JSON for regional RMS and exact cue map.\n'''
    if args.revision=='c':
        text=f'''# V3 C melody and input-sound audition\n\nStatus: {report['status']}. No native voice or speech master is produced.\n\n40 seconds, 48 kHz stereo PCM24, 144 BPM, 24 bars.\n\n{composition_c}\n\nThe four-note theme leaves a beat of space between phrases; it disappears during the full English line. C preserves B's comfortable kick/clap/bass while adding a recognizable airy melodic identity. It responds to the user's request for melody and atmosphere; the reference soundtrack remains unavailable. {report['reference_access']}\n\nTwo matched-gain 20-second auditions cover source seconds 14–34. Pure music: audition/{pure_name}. Music with input sounds: audition/{audition_name}. Settings click occurs at audition 4.333s, DeepSeek at 6.500s, EN at 9.333s; English typing runs from audition 16s.\n\nkeyboard.wav, mouse.wav and motion.wav are independent 40-second tracks. Keyboard sounds vary in seven soft mechanical body pitches and several velocities; each is placed at the exact integer frame when a new grapheme becomes visible. Spaces/punctuation are quieter. Native input clicks use timeline inputClicks (98,198,…798), two frames before typing. Mouse clicks also bind to settings 1100, DeepSeek 1230, EN 1400. ui-events.json logs every character, frame, sample, velocity and input source hash. Native text/voice timing is provisional and will be rebound by rerunning C after the replacement native takes are accepted. English B is approved; this preview does not include voices.\n\nA and B files remain unchanged. C resides in public/audio/v3/revision-c/. All tracks are silent in the EN pocket and from 39.65 seconds.\n\n| File | Integrated LUFS | True peak dBTP |\n|---|---:|---:|\n{table}\n\nActual written WAV files measured with FFmpeg loudnorm.\n'''
    (ROOT/f'docs/{report_name}.md').write_text(text,encoding='utf-8')
    print(json.dumps({'status':report['status'],'measurements':measurements,'audition':str(AUDITION/audition_name)},indent=2))


if __name__=='__main__':
    main()
