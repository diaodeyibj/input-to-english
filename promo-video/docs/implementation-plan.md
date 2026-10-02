# Glass-floating promo implementation plan

Goal: render the approved 30s / 60fps / 1920x1080 film and deliver an editable project.
Spec: approved user plan, preserved in storyboard.md.
Tech: Remotion 4.0.531, @remotion/three, R3F 9, Three.js, local CosyVoice3, FFmpeg.
Constraints: no bulk deletion; preserve existing extension files; no token benchmarks; 144BPM; 8 mother tongues + English.

1. Build timing manifest and validate 1800 frames, eight 50-frame language slots, shared click/voice events, all media paths.
2. Implement browser glass shell with readable texture, environment lighting, rounded bevel, shadows; inspect a 3s sample and 4K stills.
3. Generate nine CosyVoice WAV clips with local model and rotating reference timbres; synthesize an original 30s electronic bed and click/merge accents.
4. Compose 64 seeded spatial paths, beat-driven window changes, click/replacement sequence, host/provider showcase, logo morph and end card.
5. Typecheck, validate assets and key frames, render 4K intermediate, downsample to 1080p H.264/AAC and verify frame count, duration, fps, stereo audio and decode.

Review focus: cut points / text clipping / multilingual glyphs / transparent sorting / voice overlap and final clean ending.
