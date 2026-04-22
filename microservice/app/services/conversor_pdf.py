from __future__ import annotations

import argparse
from collections.abc import Iterable, Sequence
from pathlib import Path
import shutil
import sys
import tempfile

import cv2
import numpy as np
from PIL import Image

__all__ = [
    "__version__",
    "ALL_SUPPORTED_EXTENSIONS",
    "SUPPORTED_EXTENSIONS",
    "SUPPORTED_SOURCE_EXTENSIONS",
    "convert_file_to_pdf",
    "convert_document_to_pdf",
    "convert_documents_to_pdfs",
    "discover_images",
    "load_image",
    "main",
    "save_images_as_pdf",
]

__version__ = "0.1.0"

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
SUPPORTED_SOURCE_EXTENSIONS = SUPPORTED_EXTENSIONS | {".pdf", ".docx"}
ALL_SUPPORTED_EXTENSIONS = SUPPORTED_SOURCE_EXTENSIONS


def discover_images(input_path: str | Path, recursive: bool = False) -> list[Path]:
    """Return a stable, sorted list of supported image files."""
    normalized_path = Path(input_path).expanduser().resolve()
    if normalized_path.is_file():
        return [normalized_path] if normalized_path.suffix.lower() in SUPPORTED_EXTENSIONS else []

    if not normalized_path.exists():
        raise FileNotFoundError(f"Input path does not exist: {normalized_path}")
    if not normalized_path.is_dir():
        raise ValueError(f"Input path must be a file or directory: {normalized_path}")

    iterator = normalized_path.rglob("*") if recursive else normalized_path.glob("*")
    files = [
        path.resolve()
        for path in iterator
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    return sorted(files, key=lambda path: path.as_posix().lower())


def load_image(image_path: str | Path) -> np.ndarray:
    normalized_path = Path(image_path).expanduser().resolve()
    image = cv2.imread(str(normalized_path), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Could not read image: {normalized_path}")
    return image


def _to_pil_image(image: np.ndarray) -> Image.Image:
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb_image)


def save_images_as_pdf(images: Sequence[np.ndarray], output_path: str | Path) -> Path:
    if not images:
        raise ValueError("At least one image is required to generate a PDF.")

    normalized_output = Path(output_path).expanduser().resolve()
    normalized_output.parent.mkdir(parents=True, exist_ok=True)

    pil_images = [_to_pil_image(image).convert("RGB") for image in images]
    first_image, rest_images = pil_images[0], pil_images[1:]
    first_image.save(normalized_output, save_all=True, append_images=rest_images)
    return normalized_output


def _coerce_document_inputs(
    inputs: str | Path | Sequence[str | Path],
    recursive: bool = False,
) -> list[Path]:
    if isinstance(inputs, (str, Path)):
        return discover_images(inputs, recursive=recursive)

    image_paths: list[Path] = []
    for item in inputs:
        if isinstance(item, (str, Path)):
            discovered = discover_images(item, recursive=recursive)
            image_paths.extend(discovered)
        else:
            raise TypeError("Document inputs must be strings or Path-like values.")

    deduplicated = sorted({path.resolve() for path in image_paths}, key=lambda path: path.as_posix().lower())
    return deduplicated


def _copy_pdf_to_output(input_path: str | Path, output_path: str | Path) -> Path:
    normalized_input = Path(input_path).expanduser().resolve()
    normalized_output = Path(output_path).expanduser().resolve()
    normalized_output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(normalized_input, normalized_output)
    return normalized_output


def _convert_docx_to_pdf(input_path: str | Path, output_path: str | Path) -> Path:
    normalized_input = Path(input_path).expanduser().resolve()
    normalized_output = Path(output_path).expanduser().resolve()
    normalized_output.parent.mkdir(parents=True, exist_ok=True)

    try:
        from docx2pdf import convert as convert_docx_to_pdf
    except ImportError as exc:  # pragma: no cover - depends on optional package
        raise RuntimeError(
            "Conversao de DOCX para PDF indisponivel porque a dependencia 'docx2pdf' nao esta instalada."
        ) from exc

    with tempfile.TemporaryDirectory() as tmp_dir:
        temp_dir = Path(tmp_dir)
        temp_input = temp_dir / normalized_input.name
        temp_output = temp_dir / normalized_output.name

        shutil.copyfile(normalized_input, temp_input)
        convert_docx_to_pdf(str(temp_input), str(temp_output))

        if not temp_output.exists():
            raise RuntimeError("A conversao de DOCX para PDF nao gerou arquivo de saida.")

        shutil.copyfile(temp_output, normalized_output)

    return normalized_output


def convert_file_to_pdf(input_path: str | Path, output_path: str | Path) -> Path:
    normalized_input = Path(input_path).expanduser().resolve()
    suffix = normalized_input.suffix.lower()

    if suffix == ".pdf":
        return _copy_pdf_to_output(normalized_input, output_path)
    if suffix in SUPPORTED_EXTENSIONS:
        return convert_document_to_pdf(normalized_input, output_path)
    if suffix == ".docx":
        return _convert_docx_to_pdf(normalized_input, output_path)

    raise ValueError(f"Formato '{suffix or 'desconhecido'}' nao suporta conversao para PDF.")


def convert_document_to_pdf(
    inputs: str | Path | Sequence[str | Path],
    output_path: str | Path,
    recursive: bool = False,
) -> Path:
    """
    Convert one document into a PDF.

    `inputs` accepts:
    - a single image path
    - a directory path containing images
    - a list of image paths when the document is composed of multiple pages/images
    """
    image_paths = _coerce_document_inputs(inputs, recursive=recursive)
    if not image_paths:
        raise ValueError("No supported images were found for the document.")

    images = [load_image(path) for path in image_paths]
    return save_images_as_pdf(images, output_path)


def convert_documents_to_pdfs(
    documents: Sequence[str | Path | Sequence[str | Path]],
    output_dir: str | Path,
    output_names: Sequence[str] | None = None,
    recursive: bool = False,
) -> list[Path]:
    """
    Convert multiple documents into PDFs.

    Each entry in `documents` may be:
    - one image path
    - one directory path
    - a list of image paths representing a composed document
    """
    normalized_output_dir = Path(output_dir).expanduser().resolve()
    normalized_output_dir.mkdir(parents=True, exist_ok=True)

    if output_names is not None and len(output_names) != len(documents):
        raise ValueError("output_names must match the number of documents.")

    generated_pdfs: list[Path] = []
    for index, document in enumerate(documents, start=1):
        if output_names is None:
            output_name = f"documento_{index:03d}.pdf"
        else:
            output_name = output_names[index - 1]
            if not output_name.lower().endswith(".pdf"):
                output_name = f"{output_name}.pdf"

        generated_pdfs.append(
            convert_document_to_pdf(
                document,
                normalized_output_dir / output_name,
                recursive=recursive,
            )
        )

    return generated_pdfs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="conversor_pdf",
        description="Converte uma imagem ou uma pasta de imagens em um PDF.",
    )
    parser.add_argument("input", help="Arquivo de imagem ou pasta com imagens.")
    parser.add_argument("output", help="Caminho do PDF de saida.")
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Procura imagens recursivamente quando a entrada for uma pasta.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        output_path = convert_document_to_pdf(args.input, args.output, recursive=args.recursive)
    except (FileNotFoundError, ValueError, TypeError) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:  # noqa: BLE001
        print(f"Erro ao gerar PDF: {exc}", file=sys.stderr)
        return 1

    page_count = len(_coerce_document_inputs(args.input, recursive=args.recursive))
    print(f"PDF gerado em '{output_path}'. Paginas: {page_count}. Arquivos ignorados: 0.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
