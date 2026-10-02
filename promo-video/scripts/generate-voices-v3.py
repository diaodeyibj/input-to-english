"""Local v3 production: immutable keyed full takes, Whisper word boundaries, natural speed.

Run with C:\\Users\\diaod\\.conda\\envs\\cosyvoice\\python.exe -B.
Only this project's public/audio/v3 and docs/voices-v3-report files are written.
"""
from __future__ import annotations
import argparse
import gc
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time

sys.dont_write_bytecode = True
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, 'reconfigure'):
        stream.reconfigure(encoding='utf-8', errors='replace')
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/audio/v3'
RAW = OUT / 'raw'
REPO = Path(r'D:\TTS\CosyVoice3-Test')
MODEL = REPO / 'pretrained_models/Fun-CosyVoice3-0.5B-2512'
WHISPER = Path(r'C:\Users\diaod\.cache\whisper\large-v3-turbo.pt')
FPS = 60

NATIVE = [
    ('zh', '帮我。请设计一张新海报。', '帮我', 'zero_shot_prompt.wav', '请用自然温和的语气说一句话。'),
    ('ja', 'テツダッテ、アタラシイ ロゴ ヲ ツクッテ。', '手伝って', 'cross_lingual_prompt.wav', 'Speak Japanese naturally, with friendly curiosity and a little warmth.'),
    ('ko', '도와줘, 새 영상을 만들어줘.', '도와줘', 'zero_shot_prompt.wav', 'Speak Korean naturally, with warm interest and clear articulation.'),
    ('de', 'Hilf mir, ein neues Logo zu entwerfen.', 'Hilf mir', 'cross_lingual_prompt.wav', 'Speak German naturally, with engaged friendly confidence.'),
    ('es', 'Ayúdame, quiero crear un nuevo cartel.', 'Ayúdame', 'zero_shot_prompt.wav', 'Speak Spanish naturally, with warm enthusiasm and engaged expression.'),
    ('fr', 'Aide-moi, je veux créer une nouvelle affiche.', 'Aide-moi', 'cross_lingual_prompt.wav', 'Speak French naturally, with lively warmth and positive energy.'),
    ('it', 'Aiutami, voglio creare un nuovo video.', 'Aiutami', 'zero_shot_prompt.wav', 'Speak Italian naturally, with bright enthusiasm and confident expression.'),
    ('ru', 'Помоги мне, я хочу сделать новый сайт.', 'Помоги мне', 'cross_lingual_prompt.wav', 'Speak Russian naturally, with warm enthusiastic confidence and clear expression.'),
]
ENG = [
    ('en-a', 'cross-full', '请用尽可能慢地语速说一句话。使用成熟、低沉、浑厚的男声播音腔，语气自然沉稳，不要喊叫。'),
    ('en-b', 'cross-first6', '请用尽可能慢地语速说一句话。用成熟低沉的男声播音腔，语气温暖沉稳，发音清楚，不要喊叫。'),
    ('en-c', 'cross-last6', '请用尽可能慢地语速说一句话。使用成熟低沉浑厚的男声，专业播音，温暖沉稳，自然停顿，不要喊叫。'),
]

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def setup():
    RAW.mkdir(parents=True, exist_ok=True)
    cache = RAW / 'runtime-cache'
    cache.mkdir(exist_ok=True)
    for key, value in {
        'HF_HOME': str(cache / 'huggingface'), 'HF_HUB_OFFLINE': '1',
        'TRANSFORMERS_OFFLINE': '1', 'MODELSCOPE_CACHE': str(cache / 'modelscope'),
        'TORCH_HOME': str(cache / 'torch'), 'XDG_CACHE_HOME': str(cache),
        'NUMBA_CACHE_DIR': str(cache / 'numba'), 'MPLCONFIGDIR': str(cache / 'matplotlib'),
        'TEMP': str(cache / 'tmp'), 'TMP': str(cache / 'tmp'), 'TMPDIR': str(cache / 'tmp'),
    }.items():
        os.environ[key] = value
    (cache / 'tmp').mkdir(exist_ok=True)
    sys.path[:0] = [str(ROOT / 'public/audio/raw/runtime-cache/python-deps'), str(REPO), str(REPO / 'third_party/Matcha-TTS')]

def prepare_specs():
    import soundfile as sf
    ref = REPO / 'asset/cross_lingual_prompt.wav'
    data, sr = sf.read(ref, dtype='float32')
    refs = {'cross-full': ref}
    for key, audio in [('cross-first6', data[:6 * sr]), ('cross-last6', data[-6 * sr:])]:
        dest = RAW / f'reference-{key}.wav'
        if not dest.exists():
            sf.write(dest, audio, sr, subtype='PCM_16')
        refs[key] = dest
    specs = []
    for index, (lang, text, phrase, refname, mood) in enumerate(NATIVE):
        specs.append(dict(id=lang, language=lang, text=text, phrase=phrase,
                          ref=str(REPO / 'asset' / refname), instruction=mood + ' Use a natural conversational pace; no rushing or shouting.',
                          speed=1.0, seed=7300 + index, start_frame=100 + index * 100))
    for index, (name, refkey, instruction) in enumerate(ENG):
        specs.append(dict(id=name, language='en', text='Help me design a new logo.', phrase='Help me design a new logo.',
                          ref=str(refs[refkey]), instruction=instruction, speed=1.0, seed=7390 + index, start_frame=1800))
    for spec in specs:
        spec['ref_sha256'] = digest(spec['ref'])
        identity = {k: spec[k] for k in ('text', 'instruction', 'ref_sha256', 'speed', 'seed')}
        identity['engine'] = MODEL.name
        spec['cache_key'] = hashlib.sha256(json.dumps(identity, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        spec['raw_file'] = str(RAW / f"voice-{spec['id']}-{spec['cache_key'][:16]}-original.wav")
    return specs

def synthesize(specs):
    import numpy as np
    import soundfile as sf
    import torch
    model = None
    for spec in specs:
        path = Path(spec['raw_file'])
        if path.exists():
            print(f"IDENTITY CACHE {spec['id']} {spec['cache_key'][:16]}", flush=True)
            continue
        if model is None:
            sys.modules['ttsfrd'] = None
            sys.modules['wetext'] = None
            from cosyvoice.cli.cosyvoice import AutoModel
            if not torch.cuda.is_available():
                raise RuntimeError('Local CUDA GPU required')
            print('Loading local CosyVoice3 on ' + torch.cuda.get_device_name(), flush=True)
            model = AutoModel(model_dir=str(MODEL), fp16=True, load_trt=False, load_vllm=False)
        torch.manual_seed(spec['seed'])
        torch.cuda.manual_seed_all(spec['seed'])
        print('SYNTH ' + spec['id'] + ': ' + spec['text'], flush=True)
        chunks = model.inference_instruct2(spec['text'], 'You are a helpful assistant. ' + spec['instruction'] + '<|endofprompt|>',
                                          spec['ref'], stream=False, speed=1.0, text_frontend=False)
        data = np.concatenate([c['tts_speech'].detach().cpu().float().numpy().reshape(-1) for c in chunks])
        if not np.isfinite(data).all() or len(data) < 12000:
            raise ValueError('Invalid or absent synthesized speech')
        sf.write(path, data, model.sample_rate, subtype='FLOAT')
        path.with_suffix('.json').write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f"RAW {spec['id']} {len(data)/model.sample_rate:.3f}s", flush=True)
    del model
    gc.collect()
    torch.cuda.empty_cache()

def normalized(text):
    return re.sub(r'[^\w]', '', text, flags=re.UNICODE).lower()

def english_character_markers(words, sentence, first_character_frame):
    """Preserve every sentence character; spaces appear at the following word onset."""
    markers = []
    cursor = 0
    for word in words:
        token = word['text']
        # Word alignment strips leading whitespace, so restore it from source text.
        while cursor < len(sentence) and sentence[cursor].isspace():
            markers.append(dict(character=sentence[cursor], frame=round(word['start_frame'], 4),
                                method='source whitespace at next aligned word onset'))
            cursor += 1
        if sentence[cursor:cursor + len(token)] != token:
            raise ValueError(f'Word marker does not match full sentence at character {cursor}: {token!r}')
        for index, char in enumerate(token):
            frame = word['start_frame'] + (word['end_frame'] - word['start_frame']) * index / max(1, len(token))
            markers.append(dict(character=char, frame=round(frame, 4),
                                method='interpolated within Whisper-aligned word; not phoneme alignment'))
        cursor += len(token)
    if cursor != len(sentence):
        raise ValueError(f'Unaligned trailing sentence characters: {sentence[cursor:]!r}')
    if markers:
        markers[0]['frame'] = round(first_character_frame, 4)
    assert ''.join(marker['character'] for marker in markers) == sentence
    assert all(a['frame'] <= b['frame'] for a, b in zip(markers, markers[1:]))
    return markers

def repair_character_markers():
    """Repair metadata without loading models, synthesizing, or rewriting any WAV."""
    path = OUT / 'voices-manifest.json'
    manifest = json.loads(path.read_text(encoding='utf-8'))
    entries = [entry for entry in manifest['voices'] + manifest['english_candidates'] if entry['language'] == 'en']
    before = {entry['output_file']: digest(ROOT / entry['output_file']) for entry in entries}
    proof = []
    for entry in entries:
        entry['character_markers'] = english_character_markers(entry['word_markers'], entry['text'], entry['first_character_frame'])
        joined = ''.join(marker['character'] for marker in entry['character_markers'])
        assert joined == entry['text'] == 'Help me design a new logo.'
        assert len(entry['character_markers']) == len(entry['text']) == 26
        proof.append(dict(take=entry['take_id'], output_file=entry['output_file'], marker_count=len(entry['character_markers']),
                          joined_text=joined, full_sentence_match=True))
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    after = {file: digest(ROOT / file) for file in before}
    assert after == before, 'Metadata repair must leave every WAV byte unchanged'
    report_path = ROOT / 'docs/voices-v3-report.json'
    report = json.loads(report_path.read_text(encoding='utf-8'))
    report['character_marker_validation'] = dict(status='PASS', repair='Metadata only; no GPU inference or WAV writes.',
                                                 wav_hashes_unchanged=True, wav_sha256=after, entries=proof)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    report_md = ROOT / 'docs/voices-v3-report.md'
    note = 'English character marker validation: PASS. Every selected/candidate marker sequence reconstructs exactly `Help me design a new logo.` (26 characters including five spaces and final period). Spaces appear at the following aligned word onset. The repair changed metadata only; every English WAV SHA256 is unchanged. Listening approval remains pending.'
    existing = report_md.read_text(encoding='utf-8')
    if note not in existing:
        report_md.write_text(existing.rstrip() + '\n\n' + note + '\n', encoding='utf-8')
    print(json.dumps(report['character_marker_validation'], ensure_ascii=False, indent=2), flush=True)

def activity(data, sr):
    import numpy as np
    hop = max(1, sr // 200)
    n = len(data) // hop
    energy = np.sqrt(np.mean(data[:n * hop].reshape(n, hop) ** 2, axis=1))
    threshold = max(0.002, float(energy.max()) * 0.025)
    active = np.flatnonzero(energy > threshold)
    if not len(active):
        raise ValueError('No speech activity')
    return int(active[0] * hop), int((active[-1] + 1) * hop), energy, hop, threshold

def align(specs):
    import logging
    import numpy as np
    import soundfile as sf
    import torch
    import whisper
    logging.getLogger('numba').setLevel(logging.WARNING)
    model = None
    for spec in specs:
        path = Path(spec['raw_file'])
        alignment = path.with_suffix(spec.get('alignment_suffix', '.alignment.json'))
        if alignment.exists():
            spec['alignment'] = json.loads(alignment.read_text(encoding='utf-8'))
            continue
        if model is None:
            print('Loading cached local Whisper large-v3-turbo for word alignment', flush=True)
            model = whisper.load_model(str(WHISPER), device='cuda', download_root=str(RAW / 'runtime-cache/whisper'))
        data, sr = sf.read(path, dtype='float32')
        from scipy.signal import resample_poly
        audio = resample_poly(data, 16000, sr).astype(np.float32)
        result = model.transcribe(audio, language=spec['language'], task='transcribe', word_timestamps=True, fp16=True,
                                  condition_on_previous_text=False, temperature=0.0, initial_prompt=spec.get('asr_initial_prompt', spec['text']))
        record = dict(text=result['text'], words=[w for s in result['segments'] for w in s.get('words', [])],
                      method='Local cached Whisper large-v3-turbo word timestamps; automatic estimated alignment, no native-speaker certification.')
        alignment.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
        spec['alignment'] = record
        print(f"ALIGN {spec['id']} {record['text']} {record['words']}", flush=True)
    del model
    gc.collect()
    torch.cuda.empty_cache()

def deliver(spec):
    import numpy as np
    import soundfile as sf
    from scipy.signal import resample_poly
    data, sr = sf.read(spec['raw_file'], dtype='float32')
    onset, full_end, energy, hop, threshold = activity(data, sr)
    words = spec['alignment']['words']
    wanted = normalized(spec['phrase'])
    collected = ''
    chosen = []
    for word in words:
        chosen.append(word)
        collected += normalized(word['word'])
        if wanted in collected:
            break
    matched = wanted in collected
    if not matched:
        raise RuntimeError(f"Phrase alignment did not match {spec['id']}: {spec['alignment']['text']}")
    if spec['language'] == 'en':
        speech_end = full_end
        cut_end = min(len(data), full_end + round(.10 * sr))
    else:
        aligned_end = float(chosen[-1]['end'])
        # Choose an energy trough after the final aligned word, before following word.
        idx = len(chosen)
        next_start = float(words[idx]['start']) if idx < len(words) else full_end / sr
        lower = max(onset + 1, round((aligned_end - .035) * sr))
        upper = max(lower + 1, min(len(data), round((next_start - .012) * sr)))
        bins = np.arange(max(0, lower // hop), min(len(energy), upper // hop + 1))
        boundary = int(bins[np.argmin(energy[bins])] * hop) if len(bins) else lower
        # If there is no inter-word gap, keep the complete aligned word and flag it.
        boundary = max(boundary, round(aligned_end * sr))
        speech_end = boundary
        # Fade takes place inside a natural gap when available, without cutting phonemes.
        cut_end = min(len(data), max(boundary, min(round(next_start * sr), boundary + round(.07 * sr))))
    mono = resample_poly(data[onset:cut_end], 48000, sr).astype(np.float32)
    if not len(mono):
        raise ValueError('Empty delivery')
    rms = float(np.sqrt(np.mean(mono ** 2)))
    peak = float(np.max(np.abs(mono)))
    gain = min(10 ** (-17 / 20) / max(rms, 1e-8), 10 ** (-1.5 / 20) / max(peak, 1e-8))
    mono *= gain
    fade_in = min(len(mono), 240)
    mono[:fade_in] *= np.linspace(0, 1, fade_in)
    # Fade only retained tail; no forced 76-frame truncation.
    tail_samples = max(0, round((cut_end - speech_end) / sr * 48000))
    fade_out = min(2400, tail_samples)
    if fade_out > 1:
        mono[-fade_out:] *= np.linspace(1, 0, fade_out)
    dest = OUT / f"voice-{spec['id']}.wav"
    sf.write(dest, mono, 48000, subtype='PCM_24')
    actual, actual_sr = sf.read(dest, dtype='float32', always_2d=True)
    assert actual_sr == 48000 and actual.shape[1] == 1 and np.isfinite(actual).all()
    assert float(np.max(np.abs(actual))) < .999
    duration = len(actual) / actual_sr
    onset_actual, end_actual, _, _, _ = activity(actual[:, 0], actual_sr)
    relative_onset = onset_actual / actual_sr * FPS
    relative_end = end_actual / actual_sr * FPS
    markers = []
    char_markers = []
    displayed = spec['phrase']
    for word in chosen:
        begin = max(relative_onset / FPS, float(word['start']) - onset / sr)
        end = max(begin, min(duration, float(word['end']) - onset / sr))
        marker = dict(text=word['word'].strip(), start_seconds=round(begin, 6), end_seconds=round(end, 6),
                      start_frame=round(spec['start_frame'] + begin * FPS, 4), end_frame=round(spec['start_frame'] + end * FPS, 4),
                      confidence=word.get('probability'))
        markers.append(marker)
    # English characters preserve the source sentence including spaces and punctuation.
    if spec['language'] == 'en':
        char_markers = english_character_markers(markers, spec['text'], spec['start_frame'] + relative_onset)
    entry = dict(language=spec['language'], take_id=spec['id'], text=spec['text'], display_text=displayed,
                 instruction=spec['instruction'], prompt_ref=spec['ref'], prompt_sha256=spec['ref_sha256'],
                 inference_speed=1.0, seed=spec['seed'], cache_key=spec['cache_key'],
                 raw_file=Path(spec['raw_file']).relative_to(ROOT).as_posix(), raw_sha256=digest(spec['raw_file']),
                 raw_duration_seconds=len(data)/sr, raw_sample_rate=sr,
                 output_file=dest.relative_to(ROOT).as_posix(), output_sha256=digest(dest),
                 duration_seconds=duration, start_frame=spec['start_frame'], end_frame=spec['start_frame'] + duration * FPS,
                 speech_onset_frames=relative_onset, speech_end_frames=relative_end,
                 speech_onset_frame=spec['start_frame'] + relative_onset, speech_end_frame=spec['start_frame'] + relative_end,
                 first_character_frame=spec['start_frame'] + relative_onset,
                 crop_start_seconds=onset/sr, crop_end_seconds=cut_end/sr, fade_in_seconds=fade_in/48000,
                 fade_out_seconds=fade_out/48000, gain_db=float(20*np.log10(gain)),
                 peak_dbfs=float(20*np.log10(max(np.max(np.abs(actual)),1e-10))),
                 rms_dbfs=float(20*np.log10(max(np.sqrt(np.mean(actual**2)),1e-10))),
                 fps=FPS, word_markers=markers, character_markers=char_markers,
                 alignment=spec['alignment'], phrase_matched=matched,
                 within_target=(2.5 <= duration <= 3.1) if spec['language']=='en' else duration <= 76/FPS,
                 boundary_review='Automatic word timestamps and energy trough; listen to native audition to approve boundary and pronunciation.',
                 provenance='New local CosyVoice3 full-sentence synthesis, natural speed; raw never reused across changed identity.')
    print(f"DELIVER {spec['id']} {duration:.3f}s speech {relative_onset:.2f}..{relative_end:.2f} frames", flush=True)
    return entry

def audition(entries, dest, sequence=False):
    import numpy as np
    import soundfile as sf
    if sequence:
        total = int(16 * 48000)
        output = np.zeros(total, dtype=np.float32)
        for entry in entries:
            data, _ = sf.read(ROOT / entry['output_file'], dtype='float32')
            start = round(entry['start_frame']/FPS * 48000)
            output[start:start+len(data)] += data
    else:
        chunks = []
        for entry in entries:
            data, _ = sf.read(ROOT / entry['output_file'], dtype='float32')
            chunks += [np.zeros(24000, dtype=np.float32), data, np.zeros(48000, dtype=np.float32)]
        output = np.concatenate(chunks)
    sf.write(dest, output, 48000, subtype='PCM_24')

def main():
    setup()
    specs = prepare_specs()
    synthesize(specs)
    align(specs)
    entries = [deliver(spec) for spec in specs]
    natives = [e for e in entries if e['language'] != 'en']
    candidates = [e for e in entries if e['language'] == 'en']
    # Provisional objective choice: complete, within requested timing, closest to 2.75s.
    best = min(candidates, key=lambda e: (not e['within_target'], abs(e['duration_seconds'] - 2.75)))
    import shutil
    dest = OUT / 'voice-en.wav'
    shutil.copyfile(ROOT / best['output_file'], dest)
    chosen = dict(best, selected_candidate=best['take_id'], output_file=dest.relative_to(ROOT).as_posix(), output_sha256=digest(dest))
    auditions = dict(native_sequence=str(OUT / 'audition-native-sequence.wav'), english_candidates=str(OUT / 'audition-english-candidates.wav'))
    audition(natives, Path(auditions['native_sequence']), sequence=True)
    audition(candidates, Path(auditions['english_candidates']))
    manifest = dict(version='v3-provisional-listening-approval', engine=MODEL.name, inference='local CUDA; no download/cloud',
                    fps=FPS, sample_rate_delivery=48000, delivery_channels=1,
                    subjective_review='No native-speaker fluency or subjective announcer approval performed. These are audition candidates for user review.',
                    english_selection='Provisional objective timing selection; mature/deep instruction is a request, not a listening-certified result.',
                    voices=natives+[chosen], english_candidates=candidates, auditions=auditions)
    path = OUT / 'voices-manifest.json'
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    report = ROOT / 'docs/voices-v3-report.json'
    report.parent.mkdir(exist_ok=True)
    report.write_text(json.dumps(dict(manifest=str(path), selected_english=best['take_id'], auditions=auditions,
                    measurements=[dict(take=e['take_id'], raw_seconds=e['raw_duration_seconds'], clip_seconds=e['duration_seconds'],
                    within_target=e['within_target'], onset_frames=e['speech_onset_frames'], speech_end_frames=e['speech_end_frames'], sha256=e['output_sha256']) for e in entries]), indent=2), encoding='utf-8')
    lines = ['# v3 voice production', '', 'All full source sentences were newly synthesized locally at speed 1.0. No v1/v2 recordings were copied. No pitch shifting or tempo changes were used.', '',
             'Whisper large-v3-turbo word timestamps use existing local weights. Native crops end around the requested phrase boundary; pronunciation and crop boundaries require listening approval. English character markers are estimated within aligned words, not phoneme measurements.', '',
             f'Provisional English choice: {best["take_id"]}. User listening approval remains pending.', '', '| Take | Full raw seconds | Clip seconds | Speech end relative frames | Within timing target |', '|---|---:|---:|---:|---|']
    lines += [f"| {e['take_id']} | {e['raw_duration_seconds']:.3f} | {e['duration_seconds']:.3f} | {e['speech_end_frames']:.2f} | {e['within_target']} |" for e in entries]
    lines += ['', 'Native sequence audition: ' + auditions['native_sequence'], '', 'English A/B/C audition (order A, B, C; quiet gaps between): ' + auditions['english_candidates'], '', 'Manifest: ' + str(path)]
    (ROOT / 'docs/voices-v3-report.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')
    print('READY ' + str(path), flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--repair-character-markers', action='store_true', help='Repair existing English metadata only; no model loading or audio writes')
    args = parser.parse_args()
    if args.repair_character_markers:
        repair_character_markers()
    else:
        main()
