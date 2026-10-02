"""Rebind UI sounds and English only; retain approved C composition and native B."""
from pathlib import Path
import importlib.util,json,hashlib,subprocess,sys
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('score',ROOT/'scripts/generate-score-v3.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
import numpy as np
import soundfile as sf
BASE=ROOT/'public/audio/v3r1';m.BASE=BASE
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def events():
 js="""import * as t from './src/v3r1/timeline.mjs';
const keyboard=[];const capture=(id,fn)=>{let prev=[];for(let f=0;f<2400;f++){const now=t.graphemes(fn(f));let n=0;while(n<prev.length&&n<now.length&&prev[n]===now[n])n++;for(const character of now.slice(n))keyboard.push({frame:f,language:id,character});prev=now;}};
t.LANGUAGES.forEach((l,i)=>capture(l.id,f=>t.languageState(i,f).value));capture('en',t.englishTextAt);
const mouse=t.inputClicks.map((frame,i)=>({frame,event:'input_focus',language:t.LANGUAGES[i].id}));mouse.push({frame:t.EVENTS.settings,event:'settings_open'},{frame:t.EVENTS.select,event:'DeepSeek_select'},{frame:t.EVENTS.click,event:'EN_click'});
process.stdout.write(JSON.stringify({keyboard:keyboard.sort((a,b)=>a.frame-b.frame),mouse}));"""
 e=json.loads(subprocess.run(['node','--input-type=module','-e',js],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',check=True).stdout)
 for x in e['keyboard']+e['mouse']:x['sample_frame']=x['frame']*800
 return e
def main():
 manifest=json.loads((BASE/'voices-manifest.json').read_text(encoding='utf-8'))
 assert manifest['english_selection']['status']=='user-approved'
 candidate=manifest['english_selection']['candidate']
 old=json.loads((ROOT/'public/audio/v3/voices-manifest.json').read_text(encoding='utf-8'))
 for e in old['voices']:assert sha(ROOT/e['output_file'])==e['output_sha256']
 for e in manifest['voices']:assert sha(ROOT/e['output_file'])==e['output_sha256']
 m.current_ui_events=events
 drums,bass,melody,effects,parts,ev=m.compose_c()
 # C's drum and bass stems are byte-preserved. Melody is rebound for new speech.
 for name in ['drums','bass']:
  data,sr=sf.read(ROOT/f'public/audio/v3/{name}.wav',always_2d=True);assert sr==48000
  if name=='drums':drums=data
  else:bass=data
 voices,windows=m.load_voices(False)
 assert next(w for w in windows if w['language']=='en')['end_frame']<2000
 melody=m.duck_melody(melody,windows);voices=m.peak_limit(voices)
 music=drums+bass+melody
 stems=dict(drums=drums,bass=bass,melody=melody,music=music,effects=effects,voices=voices,**parts)
 for name,data in stems.items():m.save(BASE/f'{name}.wav',data)
 premix=m.peak_limit(music+effects+voices,-2);m.save(BASE/'master-premix.wav',premix)
 _,raw=m.measure(BASE/'master-premix.wav')
 af=('loudnorm=I=-16:TP=-1.6:LRA=11:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:measured_thresh={input_thresh}:offset={target_offset}:linear=true').format(**raw)
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(BASE/'master-premix.wav'),'-af',af,'-ar','48000','-ac','2','-c:a','pcm_s24le',str(BASE/'master.wav')],check=True)
 master,_=sf.read(BASE/'master.wav',always_2d=True);master=m.peak_limit(master);master[1390*800:1400*800]=0;master[-16800:]=0;m.save(BASE/'master.wav',master)
 loudness=m.measure(BASE/'master.wav')[0];assert loudness['true_peak_dbtp']<=-1.5;assert abs(loudness['integrated_lufs']+16)<.6
 ev['voice_windows']=windows
 (BASE/'ui-events-final.json').write_text(json.dumps(ev,ensure_ascii=False,indent=2),encoding='utf-8')
 contract=dict(approval_status='user-approved',music_revision='C',native_selection='B-logo',english_selection=candidate,master_sha256=sha(BASE/'master.wav'),official_manifest_sha256=sha(BASE/'voices-manifest.json'),voice_timing_sha256=sha(ROOT/'src/v3r1/voice-timing.json'),timeline_sha256=sha(ROOT/'src/v3r1/timeline.mjs'),loudness=loudness)
 (BASE/'final-audio-contract.json').write_text(json.dumps(contract,indent=2)+'\n',encoding='utf-8')
 (ROOT/'docs/mix-v3r1-report.json').write_text(json.dumps(dict(contract=contract,windows=windows),indent=2),encoding='utf-8')
 print('PASS v3r1 mix',candidate,loudness)
if __name__=='__main__':main()
