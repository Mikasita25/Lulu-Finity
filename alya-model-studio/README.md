# Alya Model Studio

Editor de modelos cúbicos Minecraft con texturas pixeladas y UV por cara.

Abre `index.html` junto con su carpeta `vendor`. El editor usa Three.js si WebGL está disponible. Si no hay WebGL, renderiza las caras con Canvas 2D, incluyendo rotaciones alrededor del pivot, texturas, selección y edición. El modelo sigue siendo tridimensional y exportable en ambos modos.

## Uso

- **+ Cubo**, **Duplicar**, **Borrar** y el inspector modifican las piezas.
- **Seleccionar**: pulsa una pieza. En el visor compatible arrastra para orbitar; rueda para zoom; Shift + arrastrar para desplazar la vista.
- **Mover**, **Rotar**, **Escalar**: arrastra una pieza o edita sus valores en el inspector. En el visor compatible Alt + arrastrar rota en X; la vista superior rota en Y; las demás en Z.
- **Deshacer / Rehacer**: botones o Ctrl/Cmd+Z, Ctrl/Cmd+Y. Ctrl/Cmd+S guarda.
- **Textura/UV**: crea o importa una imagen, asígnala a un cubo, pinta con lápiz/relleno/borrador/cuentagotas y edita las seis caras.
- **Work Bridge**: aplica planes JSON con `cubes`, `textures`, `paint` y `ops`. Un plan inválido restaura el proyecto anterior.
- **Importar**: proyecto Alya, `.bbmodel` (incluyendo texturas incrustadas), o geometry Bedrock.
- **Exportar .bbmodel**: modelo editable con grupos y PNG incrustados.
- **Bedrock + textura (.zip)**: geometría y atlas PNG único; las rotaciones UV se hornean en el atlas. No es un addon completo.
- **geometry.json**: descarga geometría y su atlas PNG, que deben mantenerse juntos.

Al exportar, pulsa el enlace de descarga de la ventana «Archivo listo». Esta descarga directa funciona también cuando el navegador bloquea descargas automáticas.

El guardado es local a este navegador. Exporta el proyecto Alya para transferirlo a otro dispositivo o conservar una copia. Si se llena el almacenamiento, la página pide exportar sin borrar el trabajo.

El visor compatible usa proyección ortográfica y ordenación de caras; está pensado para modelos de cubos. No sustituye todos los formatos y funciones avanzadas de Blockbench.

## Pruebas

En `tests`, ejecuta `npm ci` y `npm test`. Las pruebas usan un DOM aislado y un canvas raster real sin WebGL. Cubren inicio, inspector, duplicación/borrado, deshacer/rehacer, vistas, pintura, UV, persistencia, importación/exportación `.bbmodel`, planes Work con rollback y exportación del atlas Bedrock.
