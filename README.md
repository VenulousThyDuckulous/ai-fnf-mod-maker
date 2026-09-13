# AI FNF Mod Maker v0.6

## SF2 CDN fix
The previous build requested `spessasynth_lib@4.3.22`, but that version is not published for `spessasynth_lib`; the currently published package is 4.3.14. This version uses the published 4.3.14 package for both the ESM import and audio worklet processor.

The SF2 loader uses `WorkletSynthesizer` and `soundBankManager.addSoundBank()`.
