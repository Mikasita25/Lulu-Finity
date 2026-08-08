# Lulu Finity 0.34.2

Hotfix del error de arranque de Electron introducido al cargar `automation-engine.js` desde un preload con `sandbox: true`.

La corrección conserva el sandbox y mueve las operaciones del motor de automatizaciones al proceso principal mediante IPC.
