"""Generate the promo's local CosyVoice3 takes and frame-bounded voice crops.

Run with the existing cosyvoice environment. Model/repository files are read only.
No online inference, downloads, model cache writes, or file deletions are used.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time

# Windows' default GBK console cannot print every supported language.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "public" / "audio"
RAW = AUDIO / "raw"
REPO = Path(r"D:\TTS\CosyVoice3-Test")
MODEL = REPO / "pretrained_models" / "Fun-CosyVoice3-0.5B-2512"

# Native short requests are generated in full, then deliberately interrupted in edit.
# Japanese uses katakana, as required by the installed CosyVoice3 example.
TAKES = [
    dict(lang="zh", text="帮我设计一个新海报。", display="帮我设计…", ref="zero_shot_prompt.wav", instruct="请非常开心地说一句话。", speed=1.12, seconds=1.02, frame=200),
    dict(lang="ja", text="テツダッテ、アタラシイ ロゴ ヲ ツクッテ。", display="手伝って…", ref="cross_lingual_prompt.wav", instruct=None, speed=1.08, seconds=1.00, frame=250),
    dict(lang="ko", text="도와줘, 새 영상을 만들어줘.", display="도와줘…", ref="zero_shot_prompt.wav", instruct=None, speed=1.05, seconds=1.02, frame=300),
    dict(lang="de", text="Hilf mir, ein neues Logo zu entwerfen.", display="Hilf mir…", ref="cross_lingual_prompt.wav", instruct=None, speed=1.14, seconds=1.02, frame=350),
    dict(lang="es", text="Ayúdame a crear un nuevo cartel.", display="Ayúdame…", ref="zero_shot_prompt.wav", instruct=None, speed=1.12, seconds=1.04, frame=400),
    dict(lang="fr", text="Aide-moi à créer une nouvelle affiche.", display="Aide-moi…", ref="cross_lingual_prompt.wav", instruct=None, speed=1.04, seconds=1.04, frame=450),
    dict(lang="it", text="Aiutami a creare un nuovo video.", display="Aiutami…", ref="zero_shot_prompt.wav", instruct=None, speed=1.15, seconds=1.04, frame=500),
    dict(lang="ru", text="Помоги мне сделать новый сайт.", display="Помоги мне…", ref="cross_lingual_prompt.wav", instruct=None, speed=1.12, seconds=50/60, frame=550),
    dict(lang="en", text="Help me design a new logo.", display="Help me design…", ref="zero_shot_prompt.wav", instruct="Please say a sentence as loudly as possible.", speed=1.08, seconds=0.98, frame=720),
]


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def crop_voice(samples, sample_rate, seconds):
    import numpy as np
    from scipy.signal import resample_poly

    mono = np.asarray(samples, dtype=np.float32).reshape(-1)
    if not np.isfinite(mono).all() or len(mono) < sample_rate // 2:
        raise ValueError("Generated audio is invalid or too short")
    # 10 ms energy windows identify onset; retain 15 ms before the first activity.
    window = sample_rate // 100
    energy = np.sqrt(np.mean(mono[:len(mono)//window*window].reshape(-1, window)**2, axis=1))
    threshold = max(0.003, float(energy.max()) * 0.035)
    active = np.flatnonzero(energy > threshold)
    if not len(active):
        raise ValueError("No audible speech detected")
    begin = max(0, int(active[0] * window - 0.015 * sample_rate))
    end = min(len(mono), begin + round(seconds * sample_rate))
    cut = resample_poly(mono[begin:end], 48000, sample_rate).astype(np.float32)
    desired = round(seconds * 48000)
    if len(cut) < desired:
        cut = np.pad(cut, (0, desired-len(cut)))
    cut = cut[:desired]
    rms = float(np.sqrt(np.mean(cut**2)))
    peak = float(np.max(np.abs(cut)))
    # RMS target -16 dBFS, capped at -1 dBFS peak: speech stays in foreground.
    gain = min(10**(-16/20)/max(rms, 1e-8), 10**(-1/20)/max(peak, 1e-8))
    cut *= gain
    fade_in = round(0.005 * 48000)
    fade_out = round(0.05 * 48000)
    cut[:fade_in] *= np.linspace(0, 1, fade_in, dtype=np.float32)
    cut[-fade_out:] *= np.linspace(1, 0, fade_out, dtype=np.float32)
    return np.column_stack((cut, cut)), dict(
        crop_start_seconds=round(begin/sample_rate, 6),
        crop_end_seconds=round(end/sample_rate, 6),
        leading_silence_trim_seconds=round(begin/sample_rate, 6),
        fade_in_seconds=0.005, fade_out_seconds=0.05,
        gain_db=round(float(20*np.log10(gain)), 3),
        peak_dbfs=round(float(20*np.log10(max(np.max(np.abs(cut)), 1e-10))), 3),
        rms_dbfs=round(float(20*np.log10(max(np.sqrt(np.mean(cut**2)), 1e-10))), 3),
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--languages", nargs="*", default=[t["lang"] for t in TAKES])
    parser.add_argument("--reuse-raw", action="store_true", help="Process saved original takes without loading model")
    parser.add_argument("--regenerate", action="store_true", help="Replace selected original takes with fresh deterministic inference")
    args = parser.parse_args()
    AUDIO.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)
    # Keep any third-party caches inside the owned output subtree.
    cache = RAW / "runtime-cache"
    # Missing x-transformers 2.11.24 is installed into this project-only target.
    sys.path.insert(0, str(cache / "python-deps"))
    os.environ.setdefault("HF_HOME", str(cache / "huggingface"))
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    os.environ.setdefault("MODELSCOPE_CACHE", str(cache / "modelscope"))
    os.environ.setdefault("TORCH_HOME", str(cache / "torch"))
    sys.path.insert(0, str(REPO))
    sys.path.insert(0, str(REPO / "third_party" / "Matcha-TTS"))
    import numpy as np
    import soundfile as sf
    model = None
    manifest_path = AUDIO / "voices-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else dict(
        engine="Fun-CosyVoice3-0.5B-2512", inference="local CUDA, no cloud TTS",
        source_repository=str(REPO), model_directory=str(MODEL),
        sample_rate_raw=24000, sample_rate_delivery=48000, delivery_channels=2,
        subjective_review="No native-speaker fluency review performed; objective checks only.",
        voices=[],
    )
    for index, take in enumerate(TAKES):
        if take["lang"] not in args.languages:
            continue
        original = RAW / f"voice-{take['lang']}-original.wav"
        prompt = REPO / "asset" / take["ref"]
        started = time.time()
        if args.regenerate or not original.exists():
            if args.reuse_raw:
                raise FileNotFoundError(original)
            if model is None:
                import torch
                # We pass text_frontend=False throughout. Avoid optional normalizers
                # attempting to fetch their own models during constructor probes.
                sys.modules["ttsfrd"] = None
                sys.modules["wetext"] = None
                from cosyvoice.cli.cosyvoice import AutoModel
                if not torch.cuda.is_available():
                    raise RuntimeError("CUDA GPU required for this production run")
                print(f"Loading local model on {torch.cuda.get_device_name()}...", flush=True)
                model = AutoModel(model_dir=str(MODEL), fp16=True, load_trt=False, load_vllm=False)
                assert model.sample_rate == 24000
                print("Model loaded", flush=True)
            import torch
            torch.manual_seed(3400 + index)
            torch.cuda.manual_seed_all(3400 + index)
            print(f"Synthesizing {take['lang']}: {take['text']}", flush=True)
            if take["instruct"]:
                chunks = model.inference_instruct2(take["text"], "You are a helpful assistant. " + take["instruct"] + "<|endofprompt|>", str(prompt), stream=False, speed=take["speed"], text_frontend=False)
            else:
                chunks = model.inference_cross_lingual("You are a helpful assistant.<|endofprompt|>" + take["text"], str(prompt), stream=False, speed=take["speed"], text_frontend=False)
            samples = [out["tts_speech"].detach().cpu().float().numpy().reshape(-1) for out in chunks]
            if not samples:
                raise RuntimeError("Model returned no audio")
            mono = np.concatenate(samples)
            sf.write(original, mono, 24000, subtype="FLOAT")
        mono, rate = sf.read(original, dtype="float32")
        delivered, measurements = crop_voice(mono, rate, take["seconds"])
        output = AUDIO / f"voice-{take['lang']}.wav"
        sf.write(output, delivered, 48000, subtype="PCM_24")
        # Verify actual file contents, not only the pre-save buffer.
        actual, actual_rate = sf.read(output, dtype="float32", always_2d=True)
        assert actual_rate == 48000 and actual.shape[1] == 2
        assert len(actual) == round(take["seconds"] * 48000)
        assert np.isfinite(actual).all() and np.max(np.abs(actual)) < 0.999
        endframe = take["frame"] + len(actual)/48000*60
        assert take["lang"] == "en" or endframe <= 600.0001
        entry = dict(
            language=take["lang"], text=take["text"], display_text=take["display"],
            prompt_ref=str(prompt), prompt_sha256=digest(prompt),
            instruction=take["instruct"], inference_speed=take["speed"], seed=3400+index,
            raw_file=str(original.relative_to(ROOT)).replace("\\", "/"),
            raw_duration_seconds=round(len(mono)/rate, 6), raw_sample_rate=rate,
            output_file=str(output.relative_to(ROOT)).replace("\\", "/"),
            output_sha256=digest(output), duration_seconds=len(actual)/48000,
            start_frame=take["frame"], end_frame=round(endframe, 6), fps=60,
            provenance="Locally generated by the installed Fun-CosyVoice3-0.5B-2512 weights from bundled reference audio.",
            **measurements,
        )
        manifest["voices"] = [v for v in manifest["voices"] if v["language"] != take["lang"]] + [entry]
        manifest["voices"].sort(key=lambda v: v["start_frame"])
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"READY {take['lang']} raw={len(mono)/rate:.3f}s clip={len(actual)/48000:.3f}s peak={measurements['peak_dbfs']}dBFS took={time.time()-started:.1f}s", flush=True)
    print(f"Manifest: {manifest_path}", flush=True)


if __name__ == "__main__":
    main()
