"""English-only natural requests. No v3 files are written. Local CosyVoice3."""
from pathlib import Path
import importlib.util,json,hashlib,sys,urllib.request
import numpy as np
import soundfile as sf
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('voice_helpers',ROOT/'scripts/generate-voices-v3.py')
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
OUT=ROOT/'public/audio/v3r1';RAW=OUT/'raw'
v.OUT=OUT;v.RAW=RAW
TEXT='Help me design a more creative new logo'
def main():
 v.setup();OUT.mkdir(exist_ok=True,parents=True)
 original=json.loads((ROOT/'public/audio/v3/voices-manifest.json').read_text(encoding='utf-8'))
 locks={e['output_file']:v.digest(ROOT/e['output_file']) for e in original['voices']}
 import librosa
 refs=[]
 for folder,i in [('en',2),('hard-en',4)]:
  path=RAW/f'reference-{folder}-official-{i}.wav'
  url=f'https://raw.githubusercontent.com/QwenAudio/FunAudioLLM.github.io/master/cosyvoice3/audio/prompt/zero-shot/{folder}/prompt_audio_{i}.wav'
  if not path.exists():
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'VoiceProduction/1.0'}),timeout=30) as r:payload=r.read(8000001)
   assert len(payload)<=8000000
   path.write_bytes(payload)
  audio,sr=sf.read(path,dtype='float32');assert audio.ndim==1
  f0=librosa.yin(audio,fmin=65,fmax=350,sr=sr)
  energy=librosa.feature.rms(y=audio)[0];n=min(len(energy),len(f0))
  pitch=float(np.median(f0[:n][energy[:n]>energy.max()*.2]))
  refs.append(dict(file=str(path),url=url,sha256=v.digest(path),estimated_median_f0=pitch,duration=len(audio)/sr))
  print('REFERENCE',i,round(pitch),flush=True)
 male=sorted(refs,key=lambda x:x['estimated_median_f0'])[:2]
 assert male[0]['estimated_median_f0']<180,'No likely male English reference; audition references first'
 styles=[
  '请像在商务会议上自然地向设计师提出需求，成熟男性，语气从容自信、温暖清晰，像平时聊天，不要朗读或播音，不要刻意放慢，不要夸张。',
  '请像一位有经验的创业者在和设计师交流一样自然地说这句话，成熟男性，轻松干练，连读自然，在 more creative 上有轻微重音，不要播音腔，不要刻意放慢。',
  '请像一位专业产品负责人面对面请求同事帮助一样说这句话，成熟男性，平静有自信，自然口语，轻微微笑，不要朗读，不要夸张，不要刻意放慢。']
 records=[]
 for i,instruction in enumerate(styles):
  ref=male[0]
  r=dict(id=f'en-r1-{chr(97+i)}',language='en',text=TEXT,phrase=TEXT,ref=ref['file'],ref_sha256=ref['sha256'],instruction=instruction,speed=1.0,seed=9701+i,start_frame=1770)
  identity={k:r[k] for k in ['text','instruction','ref_sha256','speed','seed']};identity['engine']=v.MODEL.name
  r['cache_key']=hashlib.sha256(json.dumps(identity,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
  r['raw_file']=str(RAW/f"{r['id']}-{r['cache_key'][:16]}-original.wav")
  records.append(r)
 v.synthesize(records);v.align(records)
 # Whisper sometimes appends punctuation; restore exact authored word spelling.
 for r in records:
  words=r['alignment']['words'];assert v.normalized(''.join(w['word'] for w in words))==v.normalized(TEXT),r['alignment']
  for w,token in zip(words,TEXT.split()):w['word']=token
  assert len(words)==len(TEXT.split())
 entries=[v.deliver(r) for r in records]
 v.audition(entries,OUT/'audition-english-abc.wav')
 manifest=dict(version='v3r1-english-audition',approval_status='pending-user-listening',text=TEXT,engine=v.MODEL.name,reference_sources=refs,english_candidates=entries,preserved_v3_voice_hashes=locks)
 (OUT/'english-candidates.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 assert all(v.digest(ROOT/p)==h for p,h in locks.items())
 print('READY',OUT/'audition-english-abc.wav',flush=True)
if __name__=='__main__':main()
