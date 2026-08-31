# Parche reproducible de Lulu Finity 1.1.7

Este directorio transforma el ZIP oficial `Lulu-Finity-Source-1.1.1.zip` en la fuente 1.1.7. `apply-v1170.py` valida la versión y el SHA-256 de cada archivo base antes de copiar el payload.

Prioridades de esta versión:

- comandos tolerantes a caracteres invisibles, espacios especiales, signos alternativos, mayúsculas y acentos;
- controles musicales predeterminados `!true` (activo) y `!stop` (inactivo);
- cobro confiable de monedas en comandos con costo, sin ejecuciones gratuitas silenciosas;
- widgets de saldo, juegos, alertas y regalos visibles sólo durante su acción;
- metas persistentes únicamente cuando están habilitadas y música visible sólo durante solicitudes;
- recuperación de pausas musicales inesperadas sin deshacer las pausas manuales;
- comportamiento idéntico en preview, enlace local y HTTPS estable.

Uso local sobre una extracción limpia:

```bash
python build-v1170/apply-v1170.py app
python build-v1170/test-v1170.py app
```

El relay necesita un dominio público y, de forma recomendada, un Railway Volume con `OVERLAY_STATE_DIR=/data/lulu-overlays`. Aunque el volumen se pierda, Lulu vuelve a publicar las fuentes activas con la misma identidad y URL.
