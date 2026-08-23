# Parche reproducible de Lulu Finity 1.1.1

Este directorio transforma el ZIP oficial `Lulu-Finity-Source-1.1.0.zip` en la fuente 1.1.1. Antes de copiar cualquier archivo, `apply-v1111.py` verifica la versión y el SHA-256 de cada archivo base modificado.

La versión añade:

- 24 sonidos locales CC0 de Kenney, con sus licencias originales;
- una biblioteca compartida por Comandos, Automatizaciones y Eventos, conservando archivos propios;
- un filtro TTS opcional para respuestas que comienzan con `@usuario`;
- 12 fondos independientes para cada uno de los seis widgets HTTPS/locales.

Uso local sobre una extracción limpia:

```bash
python build-v1111/apply-v1111.py app
python build-v1111/test-v1111.py app
```

El workflow `v1111.yml` repite la reconstrucción en Linux y Windows, prueba un túnel HTTPS real, compila NSIS + ZIP y arranca el ejecutable recorriendo las 12 categorías. Una ejecución de pull request nunca publica una Release.
