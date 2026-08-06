# Parche 0.21.0

`script/patch.txt` (parche Python comprimido y validado por SHA-256) reconstruye Lulu Finity 0.21.0 partiendo de la fuente publicada de 0.20.0.

El parche elimina la API key de EulerStream de la aplicación, migra cualquier valor antiguo fuera del archivo local de ajustes y conecta Electron con el relay WebSocket de Railway incluido en `railway-relay/`.
