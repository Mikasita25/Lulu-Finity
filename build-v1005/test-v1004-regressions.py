from pathlib import Path
import sys


root = Path(sys.argv[1] if len(sys.argv) > 1 else "app").resolve()
repo = Path(__file__).resolve().parents[1]
scripts = (
    repo / "build-v1004" / "test-v1004.py",
    repo / "build-v1004" / "test-v1003-regression.py",
    repo / "build-v1004" / "test-v1002-regression.py",
)

for script in scripts:
    source = script.read_text(encoding="utf-8").replace("1.0.4", "1.0.5")
    source = source.replace(
        '"if (moduleName === \'live\') return Boolean(liveConnection)",',
        '"if (moduleName === \'live\') return Boolean(liveConnection || liveReconnectEnabled || liveReconnectTimer || liveReconnectInFlight)",',
    )
    namespace = {"__name__": "__main__", "__file__": str(script)}
    previous = list(sys.argv)
    try:
        sys.argv = [str(script), str(root)]
        exec(compile(source, str(script), "exec"), namespace)
    finally:
        sys.argv = previous

print("Regresiones 1.0.2, 1.0.3 y 1.0.4 conservadas dentro de 1.0.5")
