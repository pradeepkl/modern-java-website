#!/usr/bin/env python3
"""
Append a Classpath "Stay Updated" CTA page to the Modern Java preview PDF.

Idempotent: if the last page already contains the subscribe CTA marker, the
input is copied unchanged.

Usage:
  python3 scripts/stamp-preview-subscribe-cta.py \\
    --input assets/books/modern-java-preview.pdf \\
    --output /tmp/modern-java-preview-stamped.pdf

  # In-place (writes via a temp file):
  python3 scripts/stamp-preview-subscribe-cta.py --in-place \\
    --input assets/books/modern-java-preview.pdf
"""

from __future__ import annotations

import argparse
import io
import shutil
import sys
import tempfile
from pathlib import Path

from pypdf import PdfReader, PdfWriter

CTA_MARKER = "Stay Updated - Classpath Reader List"
SUBSCRIBE_URL = "https://modern-java.classpath.in/subscribe?source=preview-pdf"


def _escape_pdf_text(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_cta_page_pdf(
    *,
    width: float = 612.0,
    height: float = 792.0,
    subscribe_url: str = SUBSCRIBE_URL,
) -> bytes:
    """Build a single-page PDF with a Stay Updated CTA and clickable link."""
    # Blue button region (PDF user space, origin bottom-left)
    btn_x1, btn_y1, btn_x2, btn_y2 = 72.0, 540.0, 232.0, 576.0

    content = "\n".join(
        [
            "BT",
            "/F1 18 Tf",
            f"1 0 0 1 72 {height - 120:.2f} Tm",
            f"({_escape_pdf_text('Enjoying the preview?')}) Tj",
            "/F1 12 Tf",
            f"1 0 0 1 72 {height - 160:.2f} Tm",
            f"({_escape_pdf_text('Get practical Java insights, book updates')}) Tj",
            f"1 0 0 1 72 {height - 178:.2f} Tm",
            f"({_escape_pdf_text('and early announcements from Classpath.')}) Tj",
            f"1 0 0 1 72 {height - 220:.2f} Tm",
            f"({_escape_pdf_text('Unsubscribe anytime. No email is embedded in this link.')}) Tj",
            "/F1 9 Tf",
            "1 0 0 1 72 72 Tm",
            f"({_escape_pdf_text(CTA_MARKER)}) Tj",
            "ET",
            "0.043 0.247 0.624 rg",
            f"{btn_x1:.2f} {btn_y1:.2f} {btn_x2 - btn_x1:.2f} {btn_y2 - btn_y1:.2f} re",
            "f",
            "1 1 1 rg",
            "BT",
            "/F1 14 Tf",
            f"1 0 0 1 {btn_x1 + 24:.2f} {btn_y1 + 11:.2f} Tm",
            "(Stay Updated) Tj",
            "ET",
        ]
    ).encode("latin-1", errors="replace")

    objects: list[bytes] = []

    def obj(n: int, body: bytes) -> None:
        while len(objects) < n:
            objects.append(b"")
        objects[n - 1] = body

    obj(1, b"<< /Type /Catalog /Pages 2 0 R >>")
    obj(2, b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    obj(
        3,
        (
            f"<< /Type /Page /Parent 2 0 R "
            f"/MediaBox [0 0 {width:.2f} {height:.2f}] "
            f"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> "
            f"/Annots [6 0 R] >>"
        ).encode("ascii"),
    )
    obj(
        4,
        f"<< /Length {len(content)} >>\nstream\n".encode("ascii")
        + content
        + b"\nendstream",
    )
    obj(5, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    obj(
        6,
        (
            f"<< /Type /Annot /Subtype /Link "
            f"/Rect [{btn_x1} {btn_y1} {btn_x2} {btn_y2}] "
            f"/Border [0 0 0] "
            f"/A << /S /URI /URI ({subscribe_url}) >> >>"
        ).encode("ascii"),
    )

    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = [0]
    for i, body in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n".encode("ascii"))
        out.write(body)
        out.write(b"\nendobj\n")
    xref_pos = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    out.write(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.write(f"{off:010d} 00000 n \n".encode("ascii"))
    out.write(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n".encode("ascii")
    )
    return out.getvalue()


def last_page_has_cta(reader: PdfReader) -> bool:
    if not reader.pages:
        return False
    text = reader.pages[-1].extract_text() or ""
    return CTA_MARKER in text or "subscribe?source=preview-pdf" in text


def stamp(input_path: Path, output_path: Path) -> str:
    reader = PdfReader(str(input_path))
    writer = PdfWriter()

    if last_page_has_cta(reader):
        for page in reader.pages:
            writer.add_page(page)
        with output_path.open("wb") as fh:
            writer.write(fh)
        return "unchanged"

    for page in reader.pages:
        writer.add_page(page)

    media = reader.pages[0].mediabox
    width = float(media.width)
    height = float(media.height)
    cta_bytes = build_cta_page_pdf(width=width, height=height)
    cta_reader = PdfReader(io.BytesIO(cta_bytes))
    writer.add_page(cta_reader.pages[0])

    with output_path.open("wb") as fh:
        writer.write(fh)
    return "stamped"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--in-place",
        action="store_true",
        help="Overwrite --input after writing via a temporary file",
    )
    args = parser.parse_args()

    if not args.input.is_file():
        print(f"Input PDF not found: {args.input}", file=sys.stderr)
        return 1

    if args.in_place:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            result = stamp(args.input, tmp_path)
            shutil.move(str(tmp_path), str(args.input))
        finally:
            if tmp_path.exists():
                tmp_path.unlink(missing_ok=True)
        print(f"{result}: {args.input}")
        return 0

    if not args.output:
        print("--output is required unless --in-place is set", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    result = stamp(args.input, args.output)
    print(f"{result}: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
