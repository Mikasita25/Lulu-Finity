#!/usr/bin/env python3
"""Proceso local de conversión de timbre para la Voz Oficial de Lulu Finity."""

from __future__ import annotations

import argparse
import base64
import contextlib
import json
import os
from pathlib import Path
import sys
import tempfile


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--serve", action="store_true")
    parser.add_argument("--config", required=True)
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--reference", required=True)
    parser.add_argument("--input")
    parser.add_argument("--output")
    return parser.parse_args()


def emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


class LuluCloneEngine:
    def __init__(self, config: Path, checkpoint: Path, reference: Path) -> None:
        os.environ.setdefault("OMP_NUM_THREADS", "2")
        os.environ.setdefault("MKL_NUM_THREADS", "2")
        import torch
        from openvoice.api import ToneColorConverter

        torch.set_num_threads(max(1, min(4, os.cpu_count() or 2)))
        with contextlib.redirect_stdout(sys.stderr):
            self.converter = ToneColorConverter(str(config), device="cpu", enable_watermark=False)
            self.converter.load_ckpt(str(checkpoint))
            self.target_se = self.converter.extract_se([str(reference)])
        self.source_se = None
        self.sample_rate = int(self.converter.hps.data.sampling_rate)

    def convert(self, source: Path, output: Path) -> None:
        with contextlib.redirect_stdout(sys.stderr):
            if self.source_se is None:
                self.source_se = self.converter.extract_se([str(source)])
            self.converter.convert(
                audio_src_path=str(source),
                src_se=self.source_se,
                tgt_se=self.target_se,
                output_path=str(output),
                tau=0.3,
                message="LuluFinity",
            )


def serve(engine: LuluCloneEngine) -> None:
    emit({"type": "ready", "sampleRate": engine.sample_rate})
    for raw_line in sys.stdin:
        request_id = None
        try:
            message = json.loads(raw_line)
            if message.get("type") != "convert":
                continue
            request_id = str(message.get("requestId") or "")[:100]
            encoded = str(message.get("audio") or "")
            if not encoded or len(encoded) > 20_000_000:
                raise ValueError("El audio base no es válido.")
            source_bytes = base64.b64decode(encoded, validate=True)
            if len(source_bytes) < 44 or len(source_bytes) > 15_000_000:
                raise ValueError("El audio base tiene un tamaño no válido.")
            with tempfile.TemporaryDirectory(prefix="lulu-clone-") as folder:
                source = Path(folder) / "source.wav"
                output = Path(folder) / "output.wav"
                source.write_bytes(source_bytes)
                engine.convert(source, output)
                result = output.read_bytes()
            emit({
                "type": "result",
                "requestId": request_id,
                "audio": base64.b64encode(result).decode("ascii"),
                "bytes": len(result),
                "sampleRate": engine.sample_rate,
            })
        except Exception as error:  # noqa: BLE001 - frontera del proceso auxiliar
            print(f"Error de clonación: {error}", file=sys.stderr, flush=True)
            emit({"type": "error", "requestId": request_id, "message": str(error)[:500]})


def main() -> int:
    args = parse_args()
    config = Path(args.config).resolve()
    checkpoint = Path(args.checkpoint).resolve()
    reference = Path(args.reference).resolve()
    for file in (config, checkpoint, reference):
        if not file.is_file():
            raise FileNotFoundError(file)
    engine = LuluCloneEngine(config, checkpoint, reference)
    if args.serve:
        serve(engine)
        return 0
    if not args.input or not args.output:
        raise ValueError("Usa --serve o proporciona --input y --output.")
    engine.convert(Path(args.input).resolve(), Path(args.output).resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
