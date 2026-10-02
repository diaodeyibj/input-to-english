# Input to English — 40-second v2

The 40-second composition is `InputToEnglishV2`; the original 30-second composition and media remain available. No extension code was edited.

## Deliverables

- `out/v2/input-to-english-v2-1080p.mp4` — 1920×1080, 60fps, 40s, stereo.
- `out/v2/input-to-english-v2-4k.mp4` — 3840×2160 intermediate.
- `out/v2/languages-1080p.mp4`, `converge-1080p.mp4`, `identity-1080p.mp4` — motion review excerpts.
- `public/audio/v2/master.wav` plus independently editable music/effects/voice stems.
- `out/v2/verification.json` — actual output metadata and full-decode validation.

## Editing and rendering

```powershell
cd F:\chatGPT\Second-Class\promo-video
npm.cmd run studio
npm.cmd run typecheck
npm.cmd test
node scripts/render-v2.mjs checks
node scripts/render-v2.mjs segments
node scripts/render-v2.mjs full
node scripts/verify-v2.mjs
```

Use Node.js 22+ and FFmpeg on PATH. The preview composition is `http://localhost:3001/InputToEnglishV2` if Studio selects port3001; otherwise use its printed URL. All geometry, typography, camera and audio motion derives from frame numbers.

## Timeline

| Seconds | Action |
|---|---|
| 0–3.33 | Mouse-guided entrance and focus zoom, empty Chinese UI; no early prompt text. |
| 3.33–16.67 | Eight fully localized ChatGPT/Claude UI textures; four beats per language, progressive typing, speech then shrink into a4×2 grid. |
| 16.67–21.67 | Animated waiting track and token-block compaction, illustrative without numeric benchmark claims. |
| 21.67–23.33 | Mouse/camera approach the shared central EN button. |
| 23.33–30 | Click, windows flatten into64 blue paths, converge into EN, become a baseline, type the English sentence, mint dot arrives. |
| 30–36.67 | Shared path anchors compress/whiten into icon strokes; output line and the same mint dot move into logo positions. The blue tile enters during formation. |
| 36.67–40 | Supplied final logo, title and tagline hold; clean score ending. |

`src/v2/timeline.mjs` owns language starts, grapheme typing and speech-end/landing boundaries. `src/v2/Scene.tsx` owns shared mouse/camera coordinates, card positions, benefit shapes, blue paths and logo convergence. `localized-ui.ts` contains eight language dictionaries and large readable interface textures. These are reconstructed motion interfaces, not recorded host sessions; the central multi-window transformation is a brand metaphor.

## Audio

Eight native clips are retained from the local CosyVoice production with their v2 timeline offsets. The English phrase head was regenerated locally with a calm, mature, deep/resonant broadcast instruction, speed1.08 and0.98s duration; the displayed full sentence continues typing after the short spoken phrase head. No playback-rate slowdown was applied. Detailed inference instructions, hashes, crop offsets and references are in `public/audio/v2/voices-manifest.json`.

The original40s/144BPM score, clicks and tonal accents are synthesized by `scripts/generate-score-v2.py`; this also creates the mixed master. Measurements and source information are in `docs/audio-v2-report.json`. No native-speaker listening review has been performed.

Old output files and raw recordings are retained. Do not bulk-delete production folders.
