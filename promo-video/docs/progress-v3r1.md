# v3r1 implementation ledger

Approved plan: four local optimizations, 40 seconds, native B and music C preserved.

Working in the explicitly requested original promo-video project; existing uncommitted plugin changes are out of scope. Preserve v3 source/composition and media by adding a v3r1 composition and separate output/audio directories. No deletes and no worktree/branch mutation.

- Investigation: Japanese UI intersects transparent shadow receiver at z=-1.7; receiver defaults to depthWrite=true. Pending render comparison.
- Investigation: toolbar click misses icon by approximately 666px at 1080p.
- Investigation: existing English instruction requests slow announcer delivery and omits 'more creative'.
- User permits independent voice/subtitle timing and local tail adjustment, retaining 40 seconds.
- English listening selection must remain pending until the user chooses a candidate. Continue all independent visual work while waiting.

## Implementation and evidence

- Japanese frame 201 comparison: corrected shadow receiver eliminates the diagonal missing half. Continuous 2–4s contact sheet inspected, clear.
- Toolbar uses original master logo. New screen-projection tests verify toolbar and DeepSeek radio cursor hits. Closeup holds through toolbar click.
- Native B/C music preserved; source v3 and outputs untouched. New composition/source/output directories are additive.
- Cursor continuity regression reproduced at frame 1000, fixed, suite passed.
- English A/B/C were initially rejected; D/E/F generated using new English references and context synthesis. User first chose F, then explicitly corrected to C with all other choices unchanged. Final selection is en-r1-c from first-round ABC.
- Independent reviewer verified visuals and identified long D mix placement issue. Fixed by moving a complete selected recording earlier as needed; no speed or waveform alteration. Placement regression passes.
- TypeScript check and 21 tests passed. Full output verification and packaging pending.

## Final validation

- User's final corrected selection: English C / en-r1-c; native B, music C and visual changes retained.
- Typecheck and 24 tests PASS, including exact final English selection, native/rhythm hashes and current mux contract.
- Master: -16.16 LUFS, -1.66 dBTP. Complete selected C recording retained, speed 1.0.
- Both encoded deliveries PASS: 40.000 seconds, 2400 frames, 60 fps, 48 kHz stereo, full decode.
- Packaging uses a new v3r1 directory/ZIP and performs no deletions. Original v3 source/assets/media remain present.
