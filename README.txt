AI Psych Engine — AI Mod Center Beta v0.1

Run:
    python ai_mod_center_beta.py

This is a standalone beta of the CORE chart pipeline, before engine integration.

Works:
- .osz import only
- Finds osu!mania maps
- 4K-only validation
- Reads timing/BPM
- Basic mania pattern detection
- Exports each 4K difficulty separately
- Generates Psych-style chart JSON
- AI analysis panel

Output:
beta_output/<song>/<song>-<difficulty>.json

Not yet included:
- Psych Engine executable integration / Main Menu key 7
- Real online/local AI model connection
- AI song audio generation
- OGG conversion
- Complete mod packaging

Next step: wire this core into Psych Engine 1.0.4's Main Menu so pressing 7 opens the AI Mod Center.
