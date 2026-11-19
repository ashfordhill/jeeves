import hashlib
import json
from pathlib import Path
import sys
from zipfile import ZipFile

studio_zip, cli_root, design = map(Path, sys.argv[1:])
digest = lambda data: hashlib.sha256(data).hexdigest()
with ZipFile(studio_zip) as archive:
    assert archive.testzip() is None
    names = [entry.filename for entry in archive.infolist() if not entry.is_dir()]
    assert len(set(names)) == len(names)
    cli_paths = {
        path.relative_to(cli_root).as_posix() for path in cli_root.rglob("*") if path.is_file()
    }
    assert set(names) == cli_paths, {"studioOnly": sorted(set(names) - cli_paths),
                                    "cliOnly": sorted(cli_paths - set(names))}
    per_file = {}
    for name in sorted(names):
        studio_bytes = archive.read(name)
        assert studio_bytes == (cli_root / name).read_bytes(), name
        per_file[name] = digest(studio_bytes)
    manifest = json.loads(archive.read(".jeeves/manifest.json"))
    assert set(names) - {".jeeves/manifest.json"} == {
        item["path"] for item in manifest["files"]
    }
    for item in manifest["files"]:
        assert item["sha256"] == per_file[item["path"]], item["path"]
        assert item["bytes"] == archive.getinfo(item["path"]).file_size, item["path"]
    assert manifest["input"]["sourceSha256"] == digest(design.read_bytes()), (
        "CLI must take the same canonical source bytes as Studio"
    )
    assert archive.read(".jeeves/inputs/design.json") == design.read_bytes()
    report = json.loads(archive.read(".jeeves/report.json"))
    print(json.dumps({
        "files": len(names),
        "findings": report["findings"],
        "requiredGaps": [gap["id"] for gap in report["gaps"] if gap["required"]],
        "savedRevision": json.loads(design.read_bytes())["revision"],
        "sourceSha256": manifest["input"]["sourceSha256"],
        "studioZipSha256": digest(studio_zip.read_bytes()),
        "manifestSha256": per_file[".jeeves/manifest.json"],
        "deploymentContractSha256": per_file["deploy/contract.json"],
        "perFileSha256": per_file,
    }, indent=2))
