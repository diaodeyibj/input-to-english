# V3 C melody and input-sound audition

Status: Candidate C music audition; approval pending, no speech master generated. No native voice or speech master is produced.

40 seconds, 48 kHz stereo PCM24, 144 BPM, 24 bars.

B drum/bass foundation unchanged; sparse four-note F#5–E5–D5–A4 theme across two bars, warm harmonic additive synth with short soft stereo echoes and quiet D-major pads. No FM/metallic lead or extra drum lattice. Independent mechanical keyboard, mouse and motion tracks bound to current rendered text/action frames.

The four-note theme leaves a beat of space between phrases; it disappears during the full English line. C preserves B's comfortable kick/clap/bass while adding a recognizable airy melodic identity. It responds to the user's request for melody and atmosphere; the reference soundtrack remains unavailable. The coordinating agent inspected direct browser playback and observed a 39-second feature promo with fast UI movement, feature headings and mouse zooms. Page inventory exposed no exportable video. Documented downloadMedia on the actual video blob timed out after 30 seconds. Reference audio was not heard or measured; no claim of tempo, beat or instrumentation equivalence is made.

Two matched-gain 20-second auditions cover source seconds 14–34. Pure music: audition/music-groove-c-pure.wav. Music with input sounds: audition/music-groove-c-ui.wav. Settings click occurs at audition 4.333s, DeepSeek at 6.500s, EN at 9.333s; English typing runs from audition 16s.

keyboard.wav, mouse.wav and motion.wav are independent 40-second tracks. Keyboard sounds vary in seven soft mechanical body pitches and several velocities; each is placed at the exact integer frame when a new grapheme becomes visible. Spaces/punctuation are quieter. Native input clicks use timeline inputClicks (98,198,…798), two frames before typing. Mouse clicks also bind to settings 1100, DeepSeek 1230, EN 1400. ui-events.json logs every character, frame, sample, velocity and input source hash. Native text/voice timing is provisional and will be rebound by rerunning C after the replacement native takes are accepted. English B is approved; this preview does not include voices.

A and B files remain unchanged. C resides in public/audio/v3/revision-c/. All tracks are silent in the EN pocket and from 39.65 seconds.

| File | Integrated LUFS | True peak dBTP |
|---|---:|---:|
| drums | -24.18 | -8.91 |
| bass | -23.10 | -12.81 |
| melody | -27.57 | -13.77 |
| music | -20.17 | -6.71 |
| effects | -39.79 | -18.03 |
| motion | -38.73 | -20.79 |
| keyboard | -40.66 | -18.03 |
| mouse | -46.69 | -18.22 |
| audition | -16.40 | -2.65 |
| audition_pure | -16.42 | -2.65 |

Actual written WAV files measured with FFmpeg loudnorm.
