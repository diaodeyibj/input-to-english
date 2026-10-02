"""Local v2 English broadcast take; native clips are copied without alteration."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/audio/v2'
OUT.mkdir(parents=True, exist_ok=True)
RAW = OUT / 'raw'
RAW.mkdir(exist_ok=True)
spec = importlib.util.spec_from_file_location('original_voices', ROOT / 'scripts/generate-voices.py')
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)
cache = RAW / 'runtime-cache'
sys.path.insert(0, str(ROOT / 'public/audio/raw/runtime-cache/python-deps'))
sys.path.insert(0, str(v.REPO))
sys.path.insert(0, str(v.REPO / 'third_party/Matcha-TTS'))
sys.dont_write_bytecode = True
for key, value in {'HF_HOME': str(cache / 'huggingface'), 'HF_HUB_OFFLINE': '1', 'TRANSFORMERS_OFFLINE': '1', 'MODELSCOPE_CACHE': str(cache / 'modelscope'), 'TORCH_HOME': str(cache / 'torch')}.items():
    os.environ[key] = value
import numpy as np
import soundfile as sf
manifest = json.loads((ROOT / 'public/audio/voices-manifest.json').read_text(encoding='utf-8'))
old_entries = {e['language']: e for e in manifest['voices']}
entries = []
for index, lang in enumerate(['zh', 'ja', 'ko', 'de', 'es', 'fr', 'it', 'ru']):
    source = ROOT / 'public/audio' / f'voice-{lang}.wav'
    dest = OUT / source.name
    shutil.copyfile(source, dest)
    entry = dict(old_entries[lang])
    entry.update(start_frame=200 + index * 100, end_frame=200 + index * 100 + entry['duration_seconds'] * 60,
                 output_file=dest.relative_to(ROOT).as_posix(), source_file=source.relative_to(ROOT).as_posix(),
                 source_sha256=v.digest(source), output_sha256=v.digest(dest),
                 reuse='Bit-identical existing native delivery clip; no recrop or resynthesis.', shrink_start_frame=265 + index * 100)
    entries.append(entry)
raw = RAW / 'voice-en-broadcast-original.wav'
instruction = 'Speak in a mature, deep, resonant male broadcast voice. Use calm confidence, clear articulation, and a warm low register. Speak naturally; do not shout.'
if not raw.exists():
    import torch
    sys.modules['ttsfrd'] = None
    sys.modules['wetext'] = None
    from cosyvoice.cli.cosyvoice import AutoModel
    assert torch.cuda.is_available(), 'Local CUDA required'
    print('Loading local CosyVoice model for English v2', flush=True)
    model = AutoModel(model_dir=str(v.MODEL), fp16=True, load_trt=False, load_vllm=False)
    torch.manual_seed(3408)
    torch.cuda.manual_seed_all(3408)
    chunks = model.inference_instruct2('Help me design a new logo.', 'You are a helpful assistant. ' + instruction + '<|endofprompt|>',
                                      str(v.REPO / 'asset/zero_shot_prompt.wav'), stream=False, speed=1.08, text_frontend=False)
    mono = np.concatenate([c['tts_speech'].detach().cpu().float().numpy().reshape(-1) for c in chunks])
    sf.write(raw, mono, 24000, subtype='FLOAT')
mono, sr = sf.read(raw, dtype='float32')
clip, measurements = v.crop_voice(mono, sr, .98)
dest = OUT / 'voice-en.wav'
sf.write(dest, clip, 48000, subtype='PCM_24')
entry = dict(old_entries['en'])
entry.update(instruction=instruction, raw_file=raw.relative_to(ROOT).as_posix(), raw_sha256=v.digest(raw),
             raw_duration_seconds=len(mono)/sr, output_file=dest.relative_to(ROOT).as_posix(), output_sha256=v.digest(dest),
             duration_seconds=.98, start_frame=1600, end_frame=1658.8, **measurements)
entries.append(entry)
manifest.update(voices=entries, version='approved-40sec-v2', preserved_original_assets=True,
                english_review='Mature broadcast style requested by local instruction; no native-speaker or subjective listening certification.')
(OUT / 'voices-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'english_raw_seconds': len(mono)/sr, 'clip_seconds': .98, 'output': str(dest)}, indent=2), flush=True)
