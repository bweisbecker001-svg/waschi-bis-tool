from pathlib import Path
import os
import zipfile

parts = sorted(Path("chunks").glob("index.part*.txt"))
if not parts:
    raise SystemExit("Keine BIS-HTML-Teile gefunden")

html = "".join(p.read_text(encoding="utf-8") for p in parts)
Path("index.html").write_text(html, encoding="utf-8", newline="")

out = Path("public")
out.mkdir(parents=True, exist_ok=True)
(out / "index.html").write_text(html, encoding="utf-8", newline="")

download_dir = out / "downloads"
download_dir.mkdir(parents=True, exist_ok=True)
zip_path = download_dir / "Waschi_WoW_BiS_Tool.zip"
commit = os.environ.get("VERCEL_GIT_COMMIT_SHA", "lokaler-build")

with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.writestr("Waschi_WoW_BiS_Tool/index.html", html)
    for rel in ("api/index.py", "requirements.txt", "vercel.json", "README_WEB.md", "Dockerfile", ".env.example"):
        p = Path(rel)
        if p.exists():
            z.write(p, "Waschi_WoW_BiS_Tool/" + rel)
    z.writestr("Waschi_WoW_BiS_Tool/VERSION.txt", f"Online- und Downloadstand: {commit}\n")

(download_dir / "VERSION.txt").write_text(f"{commit}\n", encoding="utf-8")
print(f"BIS Dashboard gebaut: {len(html)} Zeichen aus {len(parts)} Teilen")
print(f"Download-Paket gebaut: {zip_path}")
