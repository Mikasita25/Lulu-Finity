# Parche reproducible de Lulu Finity 1.1.6

Este directorio transforma el ZIP oficial `Lulu-Finity-Source-1.1.1.zip` en la fuente 1.1.6. `apply-v1160.py` valida la versión y el SHA-256 de cada archivo base antes de copiar el payload.

Prioridades de esta versión:

- widget musical transparente cuando está inactivo y visible sólo durante solicitudes;
- activación HTTPS automática al abrir cada fuente y diagnóstico visible si falla;
- editor propio por widget con colores, fondo, opacidad, bordes y barra de metas;
- sincronización del mismo diseño en preview, enlace local y HTTPS estable;
- compatibilidad HTTPS con los catorce temas y doce fondos;
- overlays y muestras sin animaciones continuas;
- conservación de la recuperación musical y HTTPS fijo de 1.1.2.

Uso local sobre una extracción limpia:

```bash
python build-v1160/apply-v1160.py app
python build-v1160/test-v1160.py app
```

El relay necesita un dominio público y, de forma recomendada, un Railway Volume con `OVERLAY_STATE_DIR=/data/lulu-overlays`. Aunque el volumen se pierda, Lulu vuelve a publicar las fuentes activas con la misma identidad y URL.
