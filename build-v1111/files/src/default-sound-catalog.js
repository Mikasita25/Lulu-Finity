'use strict';

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const DEFAULT_SOUND_DEFINITIONS = Object.freeze([
  { id:'confirmacion', name:'Confirmación', category:'Alertas', icon:'✓', file:'confirmacion.ogg' },
  { id:'brillo', name:'Brillo mágico', category:'Alertas', icon:'✦', file:'brillo.ogg' },
  { id:'campana', name:'Campana', category:'Alertas', icon:'◉', file:'campana.ogg' },
  { id:'pop-suave', name:'Pop suave', category:'Alertas', icon:'●', file:'pop-suave.ogg' },
  { id:'pop-brillante', name:'Pop brillante', category:'Alertas', icon:'◆', file:'pop-brillante.ogg' },
  { id:'cristal', name:'Cristal', category:'Alertas', icon:'◇', file:'cristal.ogg' },
  { id:'glitch', name:'Glitch', category:'Digital', icon:'⌁', file:'glitch.ogg' },
  { id:'subida', name:'Subida', category:'Digital', icon:'↗', file:'subida.ogg' },
  { id:'bajada', name:'Bajada', category:'Digital', icon:'↘', file:'bajada.ogg' },
  { id:'aparecer', name:'Aparecer', category:'Digital', icon:'＋', file:'aparecer.ogg' },
  { id:'cerrar', name:'Cerrar', category:'Digital', icon:'×', file:'cerrar.ogg' },
  { id:'pregunta', name:'Pregunta', category:'Digital', icon:'?', file:'pregunta.ogg' },
  { id:'error', name:'Error', category:'Digital', icon:'!', file:'error.ogg' },
  { id:'seleccion', name:'Selección', category:'Digital', icon:'◎', file:'seleccion.ogg' },
  { id:'ruleta-tick', name:'Ruleta · tick', category:'Juegos', icon:'◌', file:'ruleta-tick.ogg' },
  { id:'rasca', name:'Rasca', category:'Juegos', icon:'▧', file:'rasca.ogg' },
  { id:'moneda', name:'Moneda', category:'Juegos', icon:'●', file:'moneda.ogg' },
  { id:'monedas', name:'Monedas', category:'Juegos', icon:'◉', file:'monedas.ogg' },
  { id:'barajar', name:'Barajar cartas', category:'Juegos', icon:'▤', file:'barajar.ogg' },
  { id:'agitar-dados', name:'Agitar dados', category:'Juegos', icon:'⚄', file:'agitar-dados.ogg' },
  { id:'lanzar-dados', name:'Lanzar dados', category:'Juegos', icon:'⚂', file:'lanzar-dados.ogg' },
  { id:'abanico-cartas', name:'Abanico de cartas', category:'Juegos', icon:'♠', file:'abanico-cartas.ogg' },
  { id:'carta', name:'Colocar carta', category:'Juegos', icon:'▣', file:'carta.ogg' },
  { id:'fichas', name:'Apilar fichas', category:'Juegos', icon:'◍', file:'fichas.ogg' }
]);

function defaultSoundCatalog(baseDirectory = path.join(__dirname, 'default-sounds')) {
  return DEFAULT_SOUND_DEFINITIONS.map((sound) => {
    const soundPath = path.join(baseDirectory, sound.file);
    if (!fs.existsSync(soundPath)) return null;
    return {
      ...sound,
      path: soundPath,
      url: pathToFileURL(soundPath).href,
      license: 'CC0',
      source: sound.category === 'Juegos' ? 'Kenney · Casino Audio / Interface Sounds' : 'Kenney · Interface Sounds'
    };
  }).filter(Boolean);
}

module.exports = { DEFAULT_SOUND_DEFINITIONS, defaultSoundCatalog };
