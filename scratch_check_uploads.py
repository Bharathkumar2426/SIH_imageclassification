import cv2
from pathlib import Path

uploads = Path("d:/classification/data/uploads")
files = sorted(uploads.glob("*orig*"), key=lambda f: f.stat().st_mtime, reverse=True)
seen = set()
for f in files[:20]:
    sz = f.stat().st_size
    img = cv2.imread(str(f))
    h, w = img.shape[:2] if img is not None else (0, 0)
    key = (sz, h, w)
    if key not in seen:
        seen.add(key)
        print(f"{f.name}: size={sz} bytes, dim={w}x{h}, mtime={f.stat().st_mtime}")
