# Gemini / X implementation ledger — 2026-10-02

Authority: the user-approved “Edge 首批支持 Gemini 和 X” plan in this chat.

## Tasks
- [x] Site adapters, exact origins, native rich-editor writes and submission scope.
- [x] Focus lifecycle and synchronous cancellation; regression coverage.
- [x] Provider-independent protected text and controller integration.
- [x] Documentation, Edge build, manifest audit, final review.
- [ ] Real Edge acceptance after user-reported bugs (reload/retest required).

## Baseline and rulings
- Baseline: `npm test` — 23 files / 199 tests passed.
- Existing uncommitted changes and deleted Ollama files preserved.
- Ruling: work in the existing checkout on `codex/gemini-x-edge`, because the approved plan extends its uncommitted implementation. No clean checkout or bulk deletion.
- Browser evidence: Edge is unavailable through the browser tool. User subsequently logged in to X and Gemini in the in-app browser; authenticated composer DOM inspected, test text cleared without sending. No real Edge extension acceptance claim.
- Ruling: X uses framework plain-text paste, preserving Draft-owned blocks; Gemini uses native insertion and waits for Quill normalization. Quill 1 uses a hidden clipboard, so synthetic paste is unsuitable there. No direct DOM rewrite fallback. Host failures after partial edits expose the original in a read-only recovery field, without overwriting newer typing.
- Ruling: protected placeholders must round-trip exactly and in order; missing, duplicate, reordered or changed markers refuse writeback. Providers receive one request per translation, retaining the existing Browser Local activation path and deadline.

## Evidence
Implementation and verification results will be recorded below.
- Adapter/protection/native-edit tests: 13 passed after RED (missing implementations).
- Focus/controller/legacy-adapter regression tests: 64 passed after RED (lost markers, removed editors, ignored focus and sibling send buttons).
- Native nested Draft blank-line and history-before-observer regressions: reproduced RED, corrected, targeted 14 passed.
- Native synthetic-beforeinput regression: reproduced RED, removed manual synthetic pre-edit, native pipeline test passed.
- Typecheck fixture cleanup: TS2790 fixed with Reflect.deleteProperty; `npm run typecheck` passed.
- Full suite before final edge cases: 26 files / 221 tests passed.
- `npm run build:edge` passed; manifest contains six exact hosts and four input-site matches, storage only.
- Independent final reviewer completed: focus-triggered mutation race, Chinese-adjacent mentions and partial-write recovery were addressed with regression coverage.
- User initial Edge feedback: X could translate but deletion broke; Gemini control flashed then disappeared. Both FAILED initial acceptance. Fixes: Draft paste pipeline, stable outer Gemini anchor, refocus/remount discovery, async write/Undo validation. Updated build awaits reload/retest. Actual-site DOM inspections are not extension acceptance.

## Editor reference checks
- Draft paste updates EditorState through its handler: https://github.com/facebookarchive/draft-js/blob/main/src/component/handlers/edit/editOnPaste.js
- Quill 1 redirects paste to its hidden clipboard: https://github.com/slab/quill/blob/v1.3.7/modules/clipboard.js
- These references explain the write paths; they do not prove the current sites' custom framework behavior.

## Latest verification after reported bugs
- `npm test`: PASS — 26 files / 236 tests.
- `npm run typecheck`: PASS.
- `npm run build:edge`: PASS — `.output/edge-mv3` rebuilt with the fixes.
- Manifest audit: exact four content-script origins, exact six host permissions, storage only.
- `git diff --check`: PASS (one preexisting CRLF conversion warning).
- Added regression cases: asynchronous framework writes/Undo, Draft-owned blocks, selection movement before paste, newer typing during render, focus-induced draft changes, Gemini outer anchor and editor remount, Chinese-adjacent mention protection, recovery of original after partial host failure.
- Actual Edge deletion, native counter, Gemini button visibility and continuing-input behavior remain pending reload/retest. No post or prompt was sent by the extension or agent.

## X focus and background connection follow-up
- User reported focus jumping on EN and intermittent Browser Local failure. Exact displayed error: `The extension background service could not be reached.`
- Trace: `beginUserAction` refreshes the active provider through the background even for Browser Local; runtime send rejection was previously mapped to a generic message. Exact live browser rejection/worker status is unavailable, so reload invalidation versus transient connection loss has not been established in Edge.
- Runtime read now retries once; invalidated contexts request page refresh. Translation and connection-test requests are not automatically resent, and no cached/cloud provider fallback was introduced.
- Reproduced RED regressions for event bubbling/default focus, Draft selection normalization, deferred host rendering, failed-write caret restoration and focus moving to another page control. All passed after changes.
- Mouse activation keeps editor focus/caret and blocks propagation to composer handlers; keyboard focus still works. Late responses do not reclaim focus from unrelated page controls. Temporary full-editor selection accepts equivalent text-leaf boundaries and restores the prior caret if paste fails while the original remains current.
- Paste acceptance now waits on actual text/ownership/revision checks up to 500 ms instead of assuming one timer turn suffices. Newer typing is preserved.
- Latest `npm test`: PASS, 26 files / 245 tests. `npm run typecheck`: PASS. Edge rebuild and manual reload/retest follow below.

- Follow-up `npm run build:edge`: PASS; manifest permissions/matches unchanged. `git diff --check`: PASS. Real Edge focus and background-worker retest remain pending.

## Gemini placement correction — 2026-10-02
- User found EN at the page's lower left. Read-only inspection of the authenticated Gemini welcome page confirmed the cause: `input-container` was at x288/y667 while its absolutely positioned `.input-area-container` and the editor fieldset were at x454/y328. The previous outer-container anchor followed the wrong layout box.
- Corrected anchor to the actual `fieldset.input-area-fieldset`, with the local `.input-area`/composer as legacy fallbacks. A positioned input anchor hosts the control absolutely at its upper right (right 8px, bottom 100% + 6px), outside the clipped text-input grid. Static legacy anchors use local flow rather than page-level positioning. No host styles are changed.
- Regression fixture reproduces the independently positioned page-bottom shell and actual input fieldset; observed RED before correction, then PASS. Editor replacement remains covered.
- Full checks: `npm test` PASS (26 files / 245 tests), `npm run typecheck` PASS, `npm run build:edge` PASS.
- Actual Edge extension placement in welcome/conversation/mobile layouts remains pending reload and refresh. In-app DOM inspection confirms the layout cause, not loaded-extension acceptance.
