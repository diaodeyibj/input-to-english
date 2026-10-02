# Native B overlap auditions

Each language uses its own mother-tongue prompt recording from the official CosyVoice3 demo. Complete everyday requests were synthesized locally at speed 1.0; no pitch or tempo processing. Both context zero-shot and conversational instruction takes are preserved.

The proposed overlap fade starts at 1.05 seconds, continues through the next language at 1.667 seconds, and reaches silence at 2.0 seconds. Full dry recordings remain available. Window retreat must start after fade_end_frame, not after the help-me head.

No pronunciation/accent/naturalness approval is claimed. English B and all locked native recordings/manifest remained byte-identical.

| Language | Proposed take | Dry seconds | Detected faded speech end frame | Fade end frame | Head recognized |
|---|---|---:|---:|---:|---|
| zh | zh-b-conversation | 2.135 | 212.20 | 220 | True |
| ja | ja-b-conversation-r2 | 4.270 | 310.40 | 320 | True |
| ko | ko-b-conversation | 2.895 | 410.10 | 420 | True |
| de | de-b-conversation | 3.800 | 513.10 | 520 | True |
| es | es-b-conversation | 3.355 | 612.20 | 620 | True |
| fr | fr-b-conversation | 2.750 | 710.10 | 720 | True |
| it | it-b-conversation | 3.395 | 809.50 | 820 | True |
| ru | ru-b-conversation | 3.360 | 907.40 | 920 | True |

Official reference source: https://github.com/QwenAudio/FunAudioLLM.github.io/tree/master/cosyvoice3

Overlap audition: F:\chatGPT\Second-Class\promo-video\public\audio\v3\native-b\native-sequence-b.wav

Full dry audition: F:\chatGPT\Second-Class\promo-video\public\audio\v3\native-b\native-full-dry-b.wav

Independent validation: PASS. All raw/dry/faded/audition hashes and 48 kHz mono PCM files checked. Full text markers preserve spaces and punctuation, clear heads finish before fade, all eight have measured ongoing speech during the next onset, fades end at +120 frames, and locked English/native recordings plus formal manifest remain byte-identical. User listening approval remains pending.
