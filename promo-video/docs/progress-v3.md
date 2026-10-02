# v3 production ledger

Approved brief: 40 seconds, 60 fps, eight languages, moving camera, true settings with DeepSeek, EN introduced after setup, pre/post illustrative benefits, new voices and original music, continuous English-to-logo formation.

- Existing v1/v2 and extension source are preserved. New v3 source/media directories isolate this revision within the current checkout; no incidental user changes are committed or reverted.
- Voice and music production run as independent domains. Root owns frame events, visual integration and render validation.
- Audio approval is a real listening gate from the approved brief: finish reviewable audition files and visuals while waiting; do not call the sound locked without user selection.
- Frame boundaries: 0,100,900,1100,1400,1600,1800,2000,2200,2400.
- Timeline test written before implementation; initial run must fail on missing v3 module.
- English B approved by user; native A rejected for delivery, pronunciation and abrupt cropping. Music A rejected; B is more comfortable but melody/atmosphere still need revision.
- User correction: continuous native tails fade across the next onset. Planned overlap 20 frames; retain 100-frame onset intervals. Recession uses a positive duration after the actual tail end even when tails exceed a slot.
- Input focus clicks occur two frames before input. Keyboard/mouse tracks follow the real events. Source windows enter 24 frames before voice; increased separation prevents previous windows obscuring the next input.
- Corrected overview continuity and vertical settings cards against the real render-options.ts and options/style.css. Masked fixtures only; no connection test result.
- Timeline checks: 5/5 passing; TypeScript passed. Three silent visual segments rendering; sound remains unapproved.
- Sound approved: user explicitly adopted native B and music C including keyboard/mouse. Official manifest selects B-logo and English B; final C mix reads this manifest.
- Final review: one Important finding, camera/window discontinuities at phase boundaries. Regression reproduced camera jump at frame 100; adjacent phase endpoints now blend over 24 frames, including the setup window retreat. First incomplete render preserved, then restarted after this fix.
- Final: fixed the discontinuity finding — boundary continuity regression RED→GREEN, complete V3 suite 8/8 passing and TypeScript passing. No open Important/Critical review findings.
- Final sound: C master verified at -16.15 LUFS / -1.66 dBTP, 40s stereo48k PCM24. Contract validates final master, manifest and timing hashes before mux. 248 actual character key events and 11 mouse events; independent selected-voice reconstruction matches.
- Standalone editable package assembled under out/v3/editable-project with selected original/dry/faded voice files, ten audio buses/stems, source, pinned Node dependencies and export instructions. Package-local tests 8/8 and TypeScript passing.
- Final delivery verification PASS: 3840×2160 and 1920×1080 MP4s, both exactly 40.000 seconds / 2400 frames / 60 fps / 48kHz stereo; both full decodes passed. Final contact sheet and selected EN/setup/English/logo frames inspected. Audio/visual source hashes checked before mux.
