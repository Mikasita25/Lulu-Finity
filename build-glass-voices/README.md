# Prueba Glass y catálogo de voces

Parche para la fuente publicada de Lulu Finity 1.3.3. El catálogo Microsoft deja de excluir idiomas y nombres que no terminen en `Neural`, conserva la selección mientras se cargan las voces y avisa cuando utiliza una lista guardada o reducida. La interfaz añade superficies translúcidas, bordes y transiciones compartidos, conservando los temas.

Para aplicarlo, extraer `Lulu-Finity-Source-1.3.3.zip` a `app/` y ejecutar `python build-glass-voices/apply.py app`. El script verifica los archivos originales antes de aplicar cambios. Ejecutar `npm ci` y `npm test` dentro de `app/`.

La versión es de prueba: necesita validación visual de todas las pantallas y prueba de voz en Windows, con el proveedor online y voces instaladas reales. La disponibilidad local depende de lo que Electron expone; la online depende del catálogo y de la red. No se ha implementado un modo claro completo. El código fuente publicado mantiene un marcador para la credencial del relay, que se inyecta mediante el proceso seguro de compilación del proyecto. Este parche no crea ni publica un instalador.
