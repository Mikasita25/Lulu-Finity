# Lulu Finity 1.0.4

Hotfix de navegación sobre la fuente reproducible 1.0.3.

- Cierra correctamente la categoría Cuenta para que las demás páginas no queden anidadas.
- Mantiene una sola ventana principal y una sola categoría visible/activa.
- Suspende vistas previas web al salir de Overlays, Alertas o Juegos.
- Conserva un LIVE, una canción, una partida y fuentes externas que sigan realmente en uso.
- Evita que actualizaciones del relay vuelvan a cargar vistas ocultas.
- Agrupa las ventanas auxiliares bajo Lulu Finity y las excluye de la barra de tareas.
- Incluye seis voces de TikTok en español: Super Mamá y Álex (México), además de Alejandra, Julio, Mariana y una voz masculina de España.
- Muestra dentro de la app cuántas voces de TikTok hablan español.
- Recorre todas las categorías en el ejecutable de Windows antes de publicar.

```bash
python build-v1004/apply-v1004.py app
python build-v1004/test-v1004.py app
node build-v1004/test-main-startup.js app
```
