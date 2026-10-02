"""Native B auditions: same-language references, complete conversational requests, overlap tails.

English selection and locked native files are read-only. Every cache key includes actual
reference SHA, source/prompt text, instruction, inference mode, speed, seed, and engine.
"""
from __future__ import annotations
import gc
import argparse
import difflib
import hashlib
import importlib.util
import json
import logging
from pathlib import Path
import re
import sys
import urllib.request

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('v3_helpers', ROOT / 'scripts/generate-voices-v3.py')
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)
OUT = ROOT / 'public/audio/v3/native-b'
RAW = ROOT / 'public/audio/v3/raw/native-b'
BASE_URL = 'https://raw.githubusercontent.com/QwenAudio/FunAudioLLM.github.io/master/cosyvoice3/'
SOURCE_PAGE = 'https://github.com/QwenAudio/FunAudioLLM.github.io/tree/master/cosyvoice3'
DATA = [
    dict(lang='zh', source='帮我设计一张更有创意的新海报吧。', text='帮我设计一张更有创意的新海报吧。', head='帮我', ref_id=4, prompt='转任福建路转运判官。'),
    dict(lang='ja', source='手伝ってほしいんだけど新しいロゴを一緒に作ってくれる？', text='テツダッテ ホシインダケド アタラシイ ロゴ ヲ イッショニ ツクッテ クレル？', head='手伝って', ref_id=25, prompt='ライシュウ ビヨウイン デ カミ ヲ キロウ ト オモッテ イマス。', revision='r2'),
    dict(lang='ko', source='도와줘 새 영상을 좀 더 멋지게 만들어 보고 싶어.', text='도와줘 새 영상을 좀 더 멋지게 만들어 보고 싶어.', head='도와줘', ref_id=5, prompt='그들이 집까지 왔을 때는 어슬어슬한 황혼이었다.'),
    dict(lang='de', source='Hilf mir bitte bei einem neuen Logo für mein Projekt.', text='Hilf mir bitte bei einem neuen Logo für mein Projekt.', head='Hilf mir', ref_id=1, prompt='Zieht euch bitte draußen die Schuhe aus.'),
    dict(lang='es', source='Ayúdame a diseñar un nuevo cartel para mi proyecto.', text='Ayúdame a diseñar un nuevo cartel para mi proyecto.', head='Ayúdame', ref_id=1, prompt='Durante unos años, enseñó Física e Historia en el colegio de nobles de Parma.'),
    dict(lang='fr', source='Aide-moi à créer une nouvelle affiche pour mon projet.', text='Aide-moi à créer une nouvelle affiche pour mon projet.', head='Aide-moi', ref_id=1, prompt="Ce dernier a évolué tout au long de l'histoire romaine."),
    dict(lang='it', source='Aiutami a creare un nuovo video per il mio progetto.', text='Aiutami a creare un nuovo video per il mio progetto.', head='Aiutami', ref_id=2, prompt="Fin dall'inizio la sede episcopale è stata immediatamente soggetta alla Santa Sede."),
    dict(lang='ru', source='Помоги мне сделать новый сайт для моего проекта.', text='Помоги мне сделать новый сайт для моего проекта.', head='Помоги мне', ref_id=3, prompt='Неожиданно катастрофа приобрела глобальные масштабы.'),
]

def save_json(path, obj):
    Path(path).write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding='utf-8')

def references():
    import soundfile as sf
    refs = RAW / 'references'
    refs.mkdir(parents=True, exist_ok=True)
    inventory = []
    for item in DATA:
        relative = f"audio/prompt/zero-shot/{item['lang']}/prompt_audio_{item['ref_id']}.wav"
        url = BASE_URL + relative
        path = refs / f"reference-{item['lang']}-official.wav"
        if not path.exists():
            print('FETCH native reference ' + item['lang'], flush=True)
            request = urllib.request.Request(url, headers={'User-Agent': 'NativeVoiceAudition/1.0'})
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = response.read(8_000_001)
            if len(payload) > 8_000_000:
                raise ValueError('Unexpected oversized reference')
            path.write_bytes(payload)
        info = sf.info(path)
        if not 1 <= info.duration <= 25:
            raise ValueError(f'Unexpected reference duration {path}: {info.duration}')
        item['ref'] = str(path)
        item['ref_sha256'] = v.digest(path)
        inventory.append(dict(language=item['lang'], source_url=url, official_page=SOURCE_PAGE, file=str(path),
                              sha256=item['ref_sha256'], duration_seconds=info.duration, prompt_text=item['prompt'],
                              reference_language=item['lang'], reference_type='Official demo zero-shot prompt, not generated comparison output.'))
    save_json(refs / 'references-manifest.json', inventory)
    return inventory

def specs():
    result = []
    for index, item in enumerate(DATA):
        for variant in ['context', 'conversation']:
            instruction = None if variant == 'context' else '请像和朋友聊天一样自然地说这句话，语气温暖轻松，不要朗读或播音。'
            suffix='-'+item['revision'] if item.get('revision') else ''
            record = dict(item, id=f"{item['lang']}-b-{variant}{suffix}", language=item['lang'], variant=variant,
                          instruction=instruction, mode='zero_shot' if variant=='context' else 'instruct2',
                          asr_initial_prompt=item['source'],alignment_suffix='.alignment-natural.json',
                          speed=1.0, seed=8600 + index*10 + int(variant=='conversation'), start_frame=100 + index*100)
            identity = {key:record[key] for key in ['text','prompt','ref_sha256','instruction','mode','speed','seed']}
            identity['engine'] = v.MODEL.name
            record['cache_key'] = hashlib.sha256(json.dumps(identity, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
            record['raw_file'] = str(RAW / f"voice-{record['id']}-{record['cache_key'][:16]}-original.wav")
            result.append(record)
    return result

def synthesize(records):
    import numpy as np
    import soundfile as sf
    import torch
    model = None
    for record in records:
        path = Path(record['raw_file'])
        if path.exists():
            print('IDENTITY CACHE ' + record['id'], flush=True)
            continue
        if model is None:
            sys.modules['ttsfrd'] = None
            sys.modules['wetext'] = None
            from cosyvoice.cli.cosyvoice import AutoModel
            assert torch.cuda.is_available(), 'Local GPU required'
            print('Loading local CosyVoice3 with mother-tongue references', flush=True)
            model = AutoModel(model_dir=str(v.MODEL), fp16=True, load_trt=False, load_vllm=False)
        torch.manual_seed(record['seed'])
        torch.cuda.manual_seed_all(record['seed'])
        print('SYNTH ' + record['id'], flush=True)
        if record['mode']=='zero_shot':
            chunks = model.inference_zero_shot(record['text'], 'You are a helpful assistant.<|endofprompt|>'+record['prompt'],
                                               record['ref'], stream=False, speed=1.0, text_frontend=False)
        else:
            chunks = model.inference_instruct2(record['text'], 'You are a helpful assistant. '+record['instruction']+'<|endofprompt|>',
                                               record['ref'], stream=False, speed=1.0, text_frontend=False)
        audio = np.concatenate([chunk['tts_speech'].detach().cpu().float().numpy().reshape(-1) for chunk in chunks])
        assert np.isfinite(audio).all() and len(audio)>12000
        sf.write(path, audio, model.sample_rate, subtype='FLOAT')
        save_json(path.with_suffix('.json'), record)
        print(f"RAW {record['id']} {len(audio)/model.sample_rate:.3f}s", flush=True)
    del model
    gc.collect()
    torch.cuda.empty_cache()

def head_markers(words, head, onset_seconds, start_frame, onset_frame):
    """Word-derived character estimates; source spaces/punctuation are preserved."""
    target = v.normalized(head)
    collected = ''
    usable = []
    for word in words:
        token = v.normalized(word['word'])
        begin = max(onset_frame/60, word['start']-onset_seconds)
        end = max(begin, word['end']-onset_seconds)
        for i,char in enumerate(token):
            usable.append((char, start_frame+(begin+(end-begin)*i/max(1,len(token)))*60,
                           start_frame+(begin+(end-begin)*(i+1)/max(1,len(token)))*60))
        collected += token
        if collected.startswith(target) and len(collected)>=len(target):
            break
    if not collected.startswith(target):
        return [], False
    output = []
    cursor = 0
    for char in head:
        if char.isalnum() or char=='_':
            expected, frame, end_frame = usable[cursor]
            if expected != char.lower():
                return [], False
            cursor += 1
        else:
            frame = usable[min(cursor,len(usable)-1)][1]
            end_frame = frame
        output.append(dict(character=char, frame=round(frame,4), end_frame=round(end_frame,4), method='automatic Whisper word boundary; within-word character estimate'))
    output[0]['frame'] = round(start_frame+onset_frame,4)
    assert ''.join(m['character'] for m in output)==head
    return output, True

def full_character_markers(words, sentence, onset_seconds, start_frame, onset_frame):
    tokens = []
    for word in words:
        token=v.normalized(word['word'])
        begin=max(onset_frame/60,word['start']-onset_seconds)
        end=max(begin,word['end']-onset_seconds)
        for index,char in enumerate(token):
            tokens.append((char,start_frame+(begin+(end-begin)*index/max(1,len(token)))*60,
                           start_frame+(begin+(end-begin)*(index+1)/max(1,len(token)))*60))
    if ''.join(token[0] for token in tokens)!=v.normalized(sentence):
        raise ValueError('Full character mapping must match recognized text')
    result=[]
    cursor=0
    for char in sentence:
        if char.isalnum() or char=='_':
            expected,frame,end=tokens[cursor]
            assert expected==char.lower()
            cursor+=1
        else:
            frame=tokens[min(cursor,len(tokens)-1)][1] if char.isspace() or char=='-' else tokens[max(0,cursor-1)][2]
            end=frame
        result.append(dict(character=char,frame=round(frame,4),end_frame=round(end,4),
                           method='automatic Whisper word boundaries; character times interpolated, punctuation estimated'))
    result[0]['frame']=round(start_frame+onset_frame,4)
    assert ''.join(marker['character'] for marker in result)==sentence
    return result

def deliver(record):
    import numpy as np
    import soundfile as sf
    from scipy.signal import resample_poly
    data,sr=sf.read(record['raw_file'],dtype='float32')
    onset,end,_,_,_=v.activity(data,sr)
    full=resample_poly(data[onset:min(len(data),end+round(.1*sr))],48000,sr).astype(np.float32)
    gain=min(10**(-17/20)/max(float(np.sqrt(np.mean(full**2))),1e-8),10**(-2/20)/max(float(np.max(np.abs(full))),1e-8))
    full*=gain
    full[:240]*=np.linspace(0,1,240)
    tail=min(2400,max(0,round((min(len(data),end+round(.1*sr))-end)/sr*48000)))
    if tail>1:
        full[-tail:]*=np.linspace(1,0,tail)
    dry=OUT/f"voice-{record['id']}-dry.wav"
    sf.write(dry,full,48000,subtype='PCM_24')
    # 100-frame spacing, with a real continuing voice tail fading through next onset.
    duration=2.0
    fade_begin=1.05
    faded=np.pad(full,(0,max(0,round(duration*48000)-len(full))))[:round(duration*48000)].copy()
    first=round(fade_begin*48000)
    envelope=np.cos(np.linspace(0,np.pi/2,len(faded)-first))**2
    faded[first:]*=envelope
    fadefile=OUT/f"voice-{record['id']}-faded.wav"
    sf.write(fadefile,faded,48000,subtype='PCM_24')
    actual,_=sf.read(fadefile,dtype='float32')
    overlap_samples=actual[round(100/60*48000):round(1.9*48000)]
    overlap_rms=float(np.sqrt(np.mean(overlap_samples**2)))
    dry_overlap_samples=full[round(100/60*48000):min(len(full),round(1.9*48000))]
    dry_overlap_rms=float(np.sqrt(np.mean(dry_overlap_samples**2))) if len(dry_overlap_samples) else 0.0
    astart,aend,_,_,_=v.activity(actual,48000)
    onset_frames=astart/48000*60
    words=record['alignment']['words']
    chars,matched=head_markers(words,record['head'],onset/sr,record['start_frame'],onset_frames)
    recognized=record['alignment']['text'].strip()
    content_similarity=difflib.SequenceMatcher(None,v.normalized(record['source']),v.normalized(recognized)).ratio()
    source_matches=v.normalized(record['source'])==v.normalized(recognized)
    display_full=record['source'] if source_matches else recognized
    full_chars=full_character_markers(words,display_full,onset/sr,record['start_frame'],onset_frames)
    for marker in full_chars:
        relative=(marker['frame']-record['start_frame'])/60
        marker['fade_gain']=round(1.0 if relative<=fade_begin else float(np.cos(min(1,max(0,(relative-fade_begin)/(duration-fade_begin)))*np.pi/2)**2),6)
        marker['within_faded_delivery']=bool(marker['frame']<=record['start_frame']+120)
    wm=[dict(text=w['word'].strip(),start_frame=round(record['start_frame']+max(0,w['start']-onset/sr)*60,4),
             end_frame=round(record['start_frame']+max(0,w['end']-onset/sr)*60,4),confidence=w.get('probability')) for w in words]
    return dict(language=record['lang'],take_id=record['id'],variant=record['variant'],source_text=record['source'],text=record['text'],
                display_text=record['head']+'…',display_phrase=record['head'],mode=record['mode'],instruction=record['instruction'],
                prompt_ref=record['ref'],prompt_sha256=record['ref_sha256'],prompt_text=record['prompt'],reference_language=record['lang'],
                cache_key=record['cache_key'],seed=record['seed'],inference_speed=1.0,
                raw_file=Path(record['raw_file']).relative_to(ROOT).as_posix(),raw_sha256=v.digest(record['raw_file']),raw_duration_seconds=len(data)/sr,
                dry_file=dry.relative_to(ROOT).as_posix(),dry_sha256=v.digest(dry),dry_duration_seconds=len(full)/48000,
                output_file=fadefile.relative_to(ROOT).as_posix(),output_sha256=v.digest(fadefile),duration_seconds=duration,
                start_frame=record['start_frame'],end_frame=record['start_frame']+120,fps=60,
                speech_onset_frames=onset_frames,speech_end_frames=aend/48000*60,first_character_frame=record['start_frame']+onset_frames,
                speech_onset_frame=record['start_frame']+onset_frames,speech_end_frame=record['start_frame']+aend/48000*60,
                fade_start_frame=record['start_frame']+fade_begin*60,fade_end_frame=record['start_frame']+120,
                nominal_next_start_frame=record['start_frame']+100,overlap_seconds=1/3,
                head_speech_end_frame=chars[-1]['end_frame'] if chars else None,
                main_reading_end_frame=chars[-1]['end_frame'] if chars else None,
                shrink_allowed_after_frame=record['start_frame']+120,
                full_dry_speech_end_frames=(end-onset)/sr*60,actual_dry_speech_available_at_next_start=dry_overlap_rms>.003,
                overlap_tail_rms_dbfs=float(20*np.log10(max(overlap_rms,1e-10))),has_audible_overlap_tail=overlap_rms>.001,
                crop_start_seconds=onset/sr,crop_end_seconds=min(len(data),end+round(.1*sr))/sr,
                phrase_matched=matched,word_markers=wm,character_markers=chars,alignment=record['alignment'],
                full_display_text=display_full,full_source_matches_recognition=source_matches,content_similarity=content_similarity,
                full_character_markers=full_chars,audible_character_markers=[m for m in full_chars if m['within_faded_delivery']],
                peak_dbfs=float(20*np.log10(max(np.max(np.abs(actual)),1e-10))),
                subjective_review='Not approved: reference language is matched, but accent, pronunciation, warmth and fade must be reviewed by user.')

def write_sequence(entries,path,dry=False):
    import numpy as np
    import soundfile as sf
    if dry:
        pieces=[]
        for e in entries:
            audio,_=sf.read(ROOT/e['dry_file'],dtype='float32')
            pieces.extend([audio,np.zeros(48000,dtype=np.float32)])
        result=np.concatenate(pieces)
    else:
        result=np.zeros(16*48000,dtype=np.float32)
        for e in entries:
            audio,_=sf.read(ROOT/e['output_file'],dtype='float32')
            start=round(e['start_frame']/60*48000)
            result[start:start+len(audio)]+=audio
    peak=float(np.max(np.abs(result)))
    gain=min(1.0,10**(-1/20)/max(peak,1e-8))
    sf.write(path,result*gain,48000,subtype='PCM_24')
    return dict(file=str(path),sha256=v.digest(path),duration_seconds=len(result)/48000,gain_db=float(20*np.log10(gain)))

def main():
    v.setup()
    OUT.mkdir(parents=True,exist_ok=True)
    RAW.mkdir(parents=True,exist_ok=True)
    locked_manifest=ROOT/'public/audio/v3/voices-manifest.json'
    locks={str(locked_manifest):v.digest(locked_manifest)}
    for lang in ['zh','ja','ko','de','es','fr','it','ru','en','en-a','en-b','en-c']:
        path=ROOT/f'public/audio/v3/voice-{lang}.wav'
        locks[str(path)]=v.digest(path)
    refs=references()
    records=specs()
    synthesize(records)
    v.align(records)
    entries=[deliver(record) for record in records]
    picked=[]
    for language in [item['lang'] for item in DATA]:
        choices=[e for e in entries if e['language']==language]
        # Preference is a production proposal, not a subjective fluency certification.
        chosen=min(choices,key=lambda e:(not e['phrase_matched'],e['content_similarity']<.9,not e['has_audible_overlap_tail'],not e['actual_dry_speech_available_at_next_start'],
                                        e['variant']!='conversation',abs(e['dry_duration_seconds']-3.5)))
        if not chosen['phrase_matched']:
            raise RuntimeError('No accurately recognized help-me head for '+language)
        picked.append(chosen)
    auditions={
        'selected_overlap':write_sequence(picked,OUT/'native-sequence-b.wav'),
        'selected_full_dry':write_sequence(picked,OUT/'native-full-dry-b.wav',dry=True),
        'context_overlap':write_sequence([e for e in entries if e['variant']=='context'],OUT/'native-sequence-b-context.wav'),
        'conversation_overlap':write_sequence([e for e in entries if e['variant']=='conversation'],OUT/'native-sequence-b-conversation.wav'),
    }
    assert all(v.digest(path)==sha for path,sha in locks.items()),'Locked audio or English selection changed'
    current=json.loads(locked_manifest.read_text(encoding='utf-8'))
    manifest=dict(version='v3-native-b-overlap-audition',status='Pending user listening approval; do not replace locked native files.',
                  engine=v.MODEL.name,inference='Local CUDA only; same-language official reference recordings; speed 1.0.',
                  sample_rate_delivery=48000,delivery_channels=1,fps=60,voices=picked,candidates=entries,
                  auditions=auditions,references=refs,locked_files_sha256=locks,
                  english_selection_preserved=current.get('english_selection'),english_voice_preserved=[e for e in current['voices'] if e['language']=='en'],
                  selection_method='Automatic head recognition, continued speech availability, conversational instruction preference; user review remains required.',
                  character_markers_method='Within-word estimates derived from automatic Whisper word alignment, not phoneme-ground-truth.')
    save_json(OUT/'voices-manifest-native-b.json',manifest)
    save_json(ROOT/'docs/voices-v3-report-native-b.json',manifest)
    lines=['# Native B overlap auditions','',
           'Each language uses its own mother-tongue prompt recording from the official CosyVoice3 demo. Complete everyday requests were synthesized locally at speed 1.0; no pitch or tempo processing. Both context zero-shot and conversational instruction takes are preserved.','',
           'The proposed overlap fade starts at 1.05 seconds, continues through the next language at 1.667 seconds, and reaches silence at 2.0 seconds. Full dry recordings remain available. Window retreat must start after fade_end_frame, not after the help-me head.','',
           'No pronunciation/accent/naturalness approval is claimed. English B and all locked native recordings/manifest remained byte-identical.','',
           '| Language | Proposed take | Dry seconds | Detected faded speech end frame | Fade end frame | Head recognized |',
           '|---|---|---:|---:|---:|---|']
    lines += [f"| {e['language']} | {e['take_id']} | {e['dry_duration_seconds']:.3f} | {e['speech_end_frame']:.2f} | {e['fade_end_frame']} | {e['phrase_matched']} |" for e in picked]
    lines += ['', 'Official reference source: '+SOURCE_PAGE, '', 'Overlap audition: '+str(OUT/'native-sequence-b.wav'),'', 'Full dry audition: '+str(OUT/'native-full-dry-b.wav')]
    (ROOT/'docs/voices-v3-report-native-b.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print('READY '+str(OUT/'voices-manifest-native-b.json'),flush=True)

def make_zh_logo():
    """Add only Chinese logo candidates; preserve the already auditioned B sequence."""
    global OUT,RAW,DATA
    v.setup()
    parent_path=OUT/'voices-manifest-native-b.json'
    parent=json.loads(parent_path.read_text(encoding='utf-8'))
    formal_path=ROOT/'public/audio/v3/voices-manifest.json'
    locks=dict(parent['locked_files_sha256'])
    locks[str(parent_path)]=v.digest(parent_path)
    for entry in parent['candidates']:
        for key in ['raw_file','dry_file','output_file']:
            path=ROOT/entry[key]
            locks[str(path)]=v.digest(path)
    for audition in parent['auditions'].values():
        locks[audition['file']]=v.digest(audition['file'])
    old_zh=next(entry for entry in parent['voices'] if entry['language']=='zh')
    DATA=[dict(lang='zh',source='帮我设计一个更有创意的新标志吧。',text='帮我设计一个更有创意的新标志吧。',
               head='帮我',ref_id=4,prompt=old_zh['prompt_text'],ref=old_zh['prompt_ref'],ref_sha256=old_zh['prompt_sha256'],revision='logo')]
    OUT=ROOT/'public/audio/v3/native-b-logo'
    RAW=ROOT/'public/audio/v3/raw/native-b-logo'
    OUT.mkdir(parents=True,exist_ok=True)
    RAW.mkdir(parents=True,exist_ok=True)
    records=specs()
    synthesize(records)
    v.align(records)
    chinese=[deliver(record) for record in records]
    chosen=min(chinese,key=lambda e:(not e['phrase_matched'],e['content_similarity']<.9,not e['has_audible_overlap_tail'],
                                     not e['actual_dry_speech_available_at_next_start'],e['variant']!='conversation'))
    assert chosen['phrase_matched'] and chosen['full_source_matches_recognition'] and chosen['has_audible_overlap_tail']
    voices=[chosen if entry['language']=='zh' else entry for entry in parent['voices']]
    auditions=dict(selected_overlap=write_sequence(voices,OUT/'native-sequence-b-logo.wav'),
                   selected_full_dry=write_sequence(voices,OUT/'native-full-dry-b-logo.wav',dry=True))
    assert all(v.digest(path)==sha for path,sha in locks.items()),'Existing B or locked English/native material changed'
    current=json.loads(formal_path.read_text(encoding='utf-8'))
    manifest=dict(version='v3-native-b-logo-audition',status='Pending user listening approval; existing B audition is preserved.',
                  parent_candidate_manifest=str(parent_path),parent_candidate_manifest_sha256=locks[str(parent_path)],
                  engine=v.MODEL.name,inference='New Chinese logo requests only, local CUDA and same mother-tongue reference, speed 1.0.',
                  sample_rate_delivery=48000,delivery_channels=1,fps=60,voices=voices,chinese_candidates=chinese,
                  auditions=auditions,references=parent['references'],locked_files_sha256=locks,
                  english_selection_preserved=current.get('english_selection'),english_voice_preserved=[e for e in current['voices'] if e['language']=='en'],
                  character_markers_method='Automatic word alignment with explicitly interpolated character times; spaces and punctuation preserved.')
    save_json(OUT/'manifest-b-logo.json',manifest)
    save_json(ROOT/'docs/voices-v3-report-native-b-logo.json',manifest)
    report=['# Native B Chinese logo variant','',
            'Only the Chinese request was newly synthesized: '+chosen['source_text'],'',
            'The same Chinese mother-tongue reference and natural conversational instruction were used at speed 1.0. Full dry recording, raw original, complete word boundaries and estimated character markers are preserved.','',
            f"Selected take: {chosen['take_id']}; dry duration {chosen['dry_duration_seconds']:.3f}s; head end {chosen['head_speech_end_frame']}f; fade {chosen['fade_start_frame']}..{chosen['fade_end_frame']}f; window shrink allowed after {chosen['shrink_allowed_after_frame']}f.",'',
            'Original B audition/manifest, all seven other languages, English B, and formal v3 assets remain byte-identical. Listening approval remains pending.','',
            'Overlap audition: '+str(OUT/'native-sequence-b-logo.wav'),'','Manifest: '+str(OUT/'manifest-b-logo.json')]
    (ROOT/'docs/voices-v3-report-native-b-logo.md').write_text('\n'.join(report)+'\n',encoding='utf-8')
    print('READY '+str(OUT/'manifest-b-logo.json'),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--zh-logo',action='store_true',help='Add Chinese logo variant only; preserve existing B and other language/English files')
    args=parser.parse_args()
    if args.zh_logo:
        make_zh_logo()
    else:
        main()
