# AI FNF Mod Maker v0.5

Fixes the SF2 importer error caused by trying to import `SoundBankLoader` from `spessasynth_lib`.

The browser synth now uses the documented `WorkletSynthesizer.soundBankManager.addSoundBank(arrayBuffer, "main")` path. The preset dropdown is a MIDI program selector (0–127), so SF2 loading no longer depends on an unavailable export.

API-key testing remains independent of the SF2 code.
