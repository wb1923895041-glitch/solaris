"""Package only this phase's source, evidence, inputs, and verified build."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
entries = [".gitignore", ".gitattributes", "README.md", "package.json", "package-lock.json",
           "tsconfig.json", "index.html", "00-启动空场景.cmd", "01-预览已构建场景.cmd",
           "src", "schemas", "data", "docs", "scripts", "SOLARIS_visual_baseline", "output", "dist"]
out = root / "deliverables"
out.mkdir(exist_ok=True)
archive = out / "SOLARIS_第0期_验收包.zip"
inventory = []
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for entry in entries:
        target = root / entry
        for path in sorted(target.rglob("*")) if target.is_dir() else [target]:
            if path.is_file() and "__pycache__" not in path.parts:
                name = path.relative_to(root).as_posix()
                z.write(path, name)
                inventory.append({"path": name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert "dist/index.html" in z.namelist()
(out / "archive-inventory.json").write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(out / "SHA256.txt").write_text(hashlib.sha256(archive.read_bytes()).hexdigest() + "  " + archive.name + "\n", encoding="utf-8")
print(f"Packaged {len(inventory)} files; ZIP integrity check passed: {archive}")
