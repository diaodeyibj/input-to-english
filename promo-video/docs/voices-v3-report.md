# v3 voice production

All full source sentences were newly synthesized locally at speed 1.0. No v1/v2 recordings were copied. No pitch shifting or tempo changes were used.

Whisper large-v3-turbo word timestamps use existing local weights. Native crops end around the requested phrase boundary; pronunciation and crop boundaries require listening approval. English character markers are estimated within aligned words, not phoneme measurements.

Provisional English choice: en-a. User listening approval remains pending.

| Take | Full raw seconds | Clip seconds | Speech end relative frames | Within timing target |
|---|---:|---:|---:|---|
| zh | 3.040 | 0.460 | 16.80 | True |
| ja | 2.680 | 0.785 | 46.50 | True |
| ko | 1.440 | 0.330 | 18.90 | True |
| de | 2.120 | 0.645 | 38.40 | True |
| es | 2.320 | 0.690 | 32.10 | True |
| fr | 2.800 | 0.575 | 22.50 | True |
| it | 2.480 | 0.825 | 42.30 | True |
| ru | 2.440 | 0.760 | 41.40 | True |
| en-a | 2.760 | 2.690 | 155.40 | True |
| en-b | 3.040 | 2.975 | 172.50 | True |
| en-c | 3.240 | 3.100 | 180.00 | True |

Native sequence audition: F:\chatGPT\Second-Class\promo-video\public\audio\v3\audition-native-sequence.wav

English A/B/C audition (order A, B, C; quiet gaps between): F:\chatGPT\Second-Class\promo-video\public\audio\v3\audition-english-candidates.wav

Manifest: F:\chatGPT\Second-Class\promo-video\public\audio\v3\voices-manifest.json

Independent final validation: PASS. Delivered/raw SHA256, 48 kHz mono PCM24, finite samples, peak/RMS, full English transcript with six word markers, English duration 2.5–3.1 seconds, native speech end within 76 frames, and both audition WAVs checked. Initial short English takes and a rejected instruction-reading take remain in keyed raw archive; only manifest-listed final candidates are delivered. No native-speaker or subjective voice approval is claimed.

English character marker validation: PASS. Every selected/candidate marker sequence reconstructs exactly `Help me design a new logo.` (26 characters including five spaces and final period). Spaces appear at the following aligned word onset. The repair changed metadata only; every English WAV SHA256 is unchanged. Listening approval remains pending.
