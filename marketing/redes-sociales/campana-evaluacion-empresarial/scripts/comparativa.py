"""Genera comparativa.png con las propuestas A y B lado a lado."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent)
a = Image.open(root / "propuesta-a" / "propuesta-a.png").convert("RGB")
b = Image.open(root / "propuesta-b" / "propuesta-b.png").convert("RGB")

W, H = 2 * 1080 + 3 * 60, 1080 + 60 + 110
canvas = Image.new("RGB", (W, H), "#e9ecf1")
draw = ImageDraw.Draw(canvas)
font = ImageFont.truetype("/System/Library/Fonts/Avenir Next.ttc", 44, index=0)
for i, (img, title) in enumerate([(a, "A · Fotográfica"), (b, "B · Conceptual")]):
    x = 60 + i * (1080 + 60)
    draw.text((x, 40), title, fill="#1d2f68", font=font)
    canvas.paste(img, (x, 110))
canvas.save(root / "comparativa.png")
