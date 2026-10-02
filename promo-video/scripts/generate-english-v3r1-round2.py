"""Different English references and context generation; retains rejected A/B/C."""
from pathlib import Path
import importlib.util,json,hashlib,urllib.request,sys
import numpy as np
import soundfile as sf
ROOT=Path(__file__).resolve().parents[1]
def load(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
v=load('voice_helpers2','generate-voices-v3.py');n=load('native_helpers2','generate-native-voices-v3-b.py')
OUT=ROOT/'public/audio/v3r1';RAW=OUT/'raw/round2';v.OUT=OUT;v.RAW=RAW;n.v=v
TEXT='Help me design a more creative new logo'
def main():
 v.setup()
 import librosa
 refs=[]
 for name,relative in [('male','cosyvoice3/audio/prompt/cross-lingual/en_m.wav'),('third','cosyvoice2/audios/1.ZeroShot/En_3_prompt.wav'),('neutral','cosyvoice2/audios/4.Emotion/Neutral_EN_prompt.wav')]:
  path=RAW/f'reference-{name}.wav';url='https://raw.githubusercontent.com/QwenAudio/FunAudioLLM.github.io/master/'+relative
  if not path.exists():
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'VoiceProduction/1.0'}),timeout=30) as r:payload=r.read(8000001)
   assert len(payload)<=8000000;path.write_bytes(payload)
  audio,sr=sf.read(path,dtype='float32');audio=audio.mean(axis=1) if audio.ndim==2 else audio
  f0=librosa.yin(audio,fmin=65,fmax=350,sr=sr);e=librosa.feature.rms(y=audio)[0];count=min(len(e),len(f0));pitch=float(np.median(f0[:count][e[:count]>e.max()*.2]))
  ref=dict(id=name,language='en',raw_file=str(path),text='English reference recording',ref=str(path),ref_sha256=v.digest(path),url=url,estimated_median_f0=pitch)
  refs.append(ref);print('REFERENCE',name,round(pitch),flush=True)
 v.align(refs)
 male=refs[0]
 others=[r for r in refs[1:] if r['estimated_median_f0']<180]
 alternate=others[0] if others else male
 records=[]
 for i,(ref,mode) in enumerate([(male,'zero_shot'),(alternate,'zero_shot'),(male,'instruct2')]):
  r=dict(id=f'en-r1-{chr(100+i)}',language='en',text=TEXT,phrase=TEXT,ref=ref['ref'],ref_sha256=ref['ref_sha256'],prompt=ref['alignment']['text'].strip(),instruction=None if mode=='zero_shot' else '请像和同事聊天一样自然地说这句话，语气从容自信，不要朗读或播音。',mode=mode,speed=1.0,seed=9811+i,start_frame=1770)
  identity={k:r[k] for k in ['text','instruction','ref_sha256','prompt','mode','speed','seed']};identity['engine']=v.MODEL.name
  r['cache_key']=hashlib.sha256(json.dumps(identity,ensure_ascii=False,sort_keys=True).encode()).hexdigest();r['raw_file']=str(RAW/f"{r['id']}-{r['cache_key'][:16]}-original.wav")
  records.append(r)
 n.synthesize(records);v.align(records)
 for r in records:
  words=r['alignment']['words'];assert v.normalized(''.join(w['word'] for w in words))==v.normalized(TEXT),r['alignment']
  assert len(words)==len(TEXT.split())
  for w,token in zip(words,TEXT.split()):w['word']=token
 entries=[dict(v.deliver(r),mode=r['mode'],prompt_text=r['prompt']) for r in records]
 v.audition(entries,OUT/'audition-english-def.wav')
 old=json.loads((ROOT/'public/audio/v3/voices-manifest.json').read_text(encoding='utf-8'))
 locks={e['output_file']:v.digest(ROOT/e['output_file']) for e in old['voices']}
 manifest=dict(version='v3r1-english-round2',approval_status='pending-user-listening',text=TEXT,engine=v.MODEL.name,reference_sources=refs,english_candidates=entries,preserved_v3_voice_hashes=locks)
 (OUT/'english-candidates-round2.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('READY',OUT/'audition-english-def.wav',flush=True)
if __name__=='__main__':main()
