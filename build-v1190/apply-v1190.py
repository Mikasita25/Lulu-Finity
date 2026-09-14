from pathlib import Path
import json
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8", newline="\n")

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: se esperó 1 coincidencia y se encontraron {count}")
    return text.replace(old, new, 1)

def update_version(path: str) -> None:
    data = json.loads(read(path))
    data["version"] = "1.1.9"
    if path.endswith("package-lock.json"):
        packages = data.get("packages")
        if isinstance(packages, dict) and isinstance(packages.get(""), dict):
            packages[""]["version"] = "1.1.9"
    write(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")

for file_name in ("package.json", "package-lock.json"):
    update_version(file_name)

index = read("src/index.html").replace("v1.1.8", "v1.1.9")
write("src/index.html", index)

renderer = read("src/renderer.js")

renderer = replace_once(
    renderer,
    """function automationSoundSelection(action = {}) {
  const resolved = resolveDefaultSound(action);
  return { ...action, soundId:String(resolved.soundId || ''), soundUrl:String(resolved.soundUrl || ''), soundPath:String(resolved.soundPath || ''), soundName:String(resolved.soundName || '') };
}""",
    """function automationSoundSelection(action = {}) {
  const resolved = resolveDefaultSound(action);
  const volume = Math.max(0, Math.min(1, Number(action?.volume ?? .9)));
  return { ...action, soundId:String(resolved.soundId || ''), soundUrl:String(resolved.soundUrl || ''), soundPath:String(resolved.soundPath || ''), soundName:String(resolved.soundName || ''), volume };
}""",
    "normalización de volumen de automatizaciones",
)

renderer = replace_once(
    renderer,
    """${action.type==='sound'?'<button class=\"ghost tiny automation-pick-sound\">Biblioteca</button>':''}<button class=\"ghost tiny automation-action-delete\">×</button>""",
    """${action.type==='sound'?`<button class=\"ghost tiny automation-pick-sound\">Biblioteca</button><div class=\"automation-action-volume\"><div class=\"label-value\"><label>Volumen</label><output>${Math.round(Math.max(0,Math.min(1,Number(action.volume??.9)))*100)}%</output></div><input class=\"automation-action-volume-input\" type=\"range\" min=\"0\" max=\"1\" step=\"0.05\" value=\"${Math.max(0,Math.min(1,Number(action.volume??.9)))}\"/></div>`:''}<button class=\"ghost tiny automation-action-delete\">×</button>""",
    "control de volumen por acción",
)

renderer = replace_once(
    renderer,
    """function bindAutomationStudio(){const rules=$('automationRulesList');rules?.addEventListener('change',async(e)=>{""",
    """function bindAutomationStudio(){const rules=$('automationRulesList');rules?.addEventListener('input',(e)=>{if(!e.target.classList.contains('automation-action-volume-input'))return;const output=e.target.closest('.automation-action-volume')?.querySelector('output');if(output)output.textContent=`${Math.round(Math.max(0,Math.min(1,Number(e.target.value||0)))*100)}%`;});rules?.addEventListener('change',async(e)=>{""",
    "vista previa del volumen",
)

renderer = replace_once(
    renderer,
    """if(action&&e.target.classList.contains('automation-action-value')&&action.type!=='sound')action.value=e.target.value;}state.settings.automationRules=list;saveAutomationStudio();""",
    """if(action&&e.target.classList.contains('automation-action-value')&&action.type!=='sound')action.value=e.target.value;if(action&&e.target.classList.contains('automation-action-volume-input')&&action.type==='sound')action.volume=Math.max(0,Math.min(1,Number(e.target.value??.9)));}state.settings.automationRules=list;saveAutomationStudio();""",
    "guardado del volumen",
)

renderer = replace_once(
    renderer,
    """const RELEASE_NOTES = Object.freeze({
  '1.1.8': Object.freeze([""",
    """const RELEASE_NOTES = Object.freeze({
  '1.1.9': Object.freeze([
    Object.freeze({ icon:'🔊', title:'Volumen por acción', text:'Cada sonido de Automatizaciones puede ajustar su volumen sin afectar música, TTS ni otros efectos.' }),
    Object.freeze({ icon:'🎁', title:'Regalos a tu nivel', text:'Las acciones activadas por regalos conservan su volumen individual y lo aplican cada vez que se ejecutan.' })
  ]),
  '1.1.8': Object.freeze([""",
    "notas 1.1.9",
)

write("src/renderer.js", renderer)

styles = read("src/styles.css")
volume_css = """
.automation-action-volume{display:grid;gap:4px;min-width:145px;padding:4px 6px}.automation-action-volume .label-value{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--muted);font-size:10px}.automation-action-volume input[type="range"]{width:100%;min-width:120px}
@media(max-width:720px){.automation-action-volume{grid-column:1/-1;min-width:0;width:100%}}
"""
if ".automation-action-volume{" not in styles:
    styles += "\n" + volume_css.strip() + "\n"
write("src/styles.css", styles)

changelog = read("CHANGELOG.md")
if "## 1.1.9" not in changelog:
    changelog = """## 1.1.9

- Añade control de volumen individual a cada acción de sonido en Automatizaciones.
- El volumen se guarda por acción y se conserva para regalos, likes, follows y demás disparadores.
- Los sonidos existentes sin ajuste previo mantienen 90% como valor predeterminado.
- Cambiar el volumen de una acción no modifica música, TTS ni otros efectos.

""" + changelog
write("CHANGELOG.md", changelog)

print("Lulu Finity 1.1.9 aplicada: volumen individual para sonidos de Automatizaciones")
