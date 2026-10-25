from pathlib import Path

parts = sorted(Path("chunks").glob("index.part*.txt"))
if not parts:
    raise SystemExit("Keine BIS-HTML-Teile gefunden")

html = "".join(p.read_text(encoding="utf-8") for p in parts)
out = Path("public")
out.mkdir(parents=True, exist_ok=True)
(out / "index.html").write_text(html, encoding="utf-8", newline="")
print(f"BIS Dashboard gebaut: {len(html)} Zeichen aus {len(parts)} Teilen")
