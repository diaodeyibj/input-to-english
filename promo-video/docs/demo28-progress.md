# 28-second rhythm demo — 2026-10-02

Approved spec: full A music, 960x540/60fps/28s, simple UI/type/cursor/perspective/paths, original logo, logo-design request throughout, ChatGPT+Claude, timed shot labels; 0.6s tail fade. Deliver demo first, then wait for creative feedback before full production. No Drive research, voice generation, global skill install or publishing.

Ruling: create an independent entry/composition under src/demo28, scripts and out/demo28 in this checkout. The existing project and brand assets are untracked alongside extensive user work; do not change branch or move/copy their work into another checkout. Old compositions/output and extension code remain untouched.

Ruling: validate the visual prototype with real decoded frames/clip playback and real audio/container checks. Small contract tests cover click geometry, deterministic seeking and readable translated-prompt hold. No screenshot-wording tests.

Music evidence: A decodes to 28.000s at 48kHz stereo; candidate transients 0.243/7.456/14.670/21.894s. Use nearest 60fps frames 15/447/880/1314. No assumed BPM from the old 40s composition. Initial production landmarks; validate by playback.

Tasks:
- [x] timing + independent composition; contract tests RED then GREEN 3/3; typecheck passed
- [x] source-A mix with sparse action sounds and tail fade; 28.000s, stereo48k, sample peak -4.86dBFS, final sample zero; source hash recorded
- [x] 20 representative frames inspected; readable requests/EN/host identity/brand. Baseline continuity into logo corrected after sheet review.
- [x] full MP4: 960x540 / 60fps / 1680 frames / 28.000s / stereo48k; complete decode passed. A source and master hashes matched. Final AAC -15.51 LUFS / -4.44dBTP. Actual MP4 contact sheet inspected.
- [x] browser playback loaded the actual MP4 with duration 28s, readyState 4, unmuted playback; rendered UI readable during playback. Acoustic/creative preference still for user review.
- [x] deliver MP4 + concise demo notes at docs/demo28-review.md

Final checks: npm video-project suite 27/27 passed; typecheck passed. Independent read-only source/frame review found no important blocker; reviewer could not launch local verification due sandbox error1909. Main agent ran actual render/decode/audio verification successfully using approved local execution.

Next: user creative feedback on this demo. Do not begin final materials or 1080p production until demo feedback is incorporated.

Ruling: renderer uses existing Chrome explicitly. Default Remotion attempted a network browser download, blocked with EACCES; no download or dependency install was performed. Windows sandbox process launch subsequently reported account-lock error 1909; use a narrowly scoped approved local invocation for render/verification if sandbox cannot start.
