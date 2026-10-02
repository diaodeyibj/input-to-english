# Implementation ledger — Input to English / 2026-10-01

Approved spec: user-supplied 30-second glass-floating film plan in chat.
Architecture: independent Remotion + Three.js project; CosyVoice 3 offline audio; 144 BPM, 60fps, 1800 frames.

Ruling: use a new isolated artifact folder in the existing checkout, without a Git worktree or branch changes. The original working tree has extensive user edits and untracked brand assets that must remain available and untouched. Cost: video files appear as one new untracked folder.
Ruling: retain this ledger and all generated artifacts; no directory cleanup. User AGENTS.md forbids bulk deletion.
Ruling: do not recreate product tests for artistic scene details; validate timeline, media existence, deterministic rendering, typecheck, key frames and actual encoded metadata.

Tasks:
- [x] Glass/material sample: 4K / 1080p three-second sample, actual 180 frames verified
- [x] Nine local CosyVoice clips and original score: retained raw takes, manifest and separate stems
- [x] Full deterministic 3D composition: frame-driven glass, 64 paths, prompt conversion, host/provider shots and logo convergence
- [x] 4K intermediate render, downsampled 1080p delivery and QA

Review: independent source review found a Cyrillic word-wrap defect and an imprecise English replacement sentence. Both fixed. English type reduced to 100px in the 2800px texture to fit one line; merged paths lowered to preserve readability. A 4K still at frame760 inspected after fixes.
Final full encode regenerated with the wording/layout corrections. Extracted actual encoded frames inspected at 640 (whole-word Cyrillic wrapping), 760 (one-line faithful English and unobstructed text), and 1799 (complete logo/title/tagline). Earlier full encode contact sheet and logo transition inspected.
Verification: final typecheck and all three timeline/media tests passed. Master audio measured -17.63 LUFS integrated, -1.50 dBTP, 7.90 LU LRA; native-speaker pronunciation review remains unperformed.
Delivery verification passed: 1920×1080, 60/1 fps, 1800 frames, stereo 48kHz AAC; container duration 30.016s (AAC padding), video 30s. Full final delivery decoded without error. Intermediate verified 3840×2160 / 60fps / 1800 frames. See out/verification.json. Original extension files were not edited by this production task.
