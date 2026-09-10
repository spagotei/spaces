Spaces 0.0.18 FULL SOURCE REPAIR

Why this exists:
The 0.0.18 UI patch left the local project with several 0.0.17 feature modules missing, causing TS2307 import errors. This repair contains the complete known-good 0.0.17 frontend source with all 0.0.18 UI/motion files overlaid.

It also updates all version metadata to 0.0.18 using an external Node script, avoiding cmd.exe regex escaping issues.

No Worker deploy and no D1 migration are required.

Run REPAIR_0.0.18.ps1, then VERIFY_REPAIRED_0.0.18.ps1.
