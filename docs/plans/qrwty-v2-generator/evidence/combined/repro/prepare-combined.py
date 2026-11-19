from copy import deepcopy
import json
from pathlib import Path
from shutil import copyfile
import sys

fixture_root, target = map(Path, sys.argv[1:])
names = ('qr-auth0', 'qr-stripe', 'qr-retention')
parts = [json.loads((fixture_root / name / 'design.json').read_bytes()) for name in names]
combined = deepcopy(parts[0])
combined['revision'] = 1
combined['architecture']['system']['name'] = 'Combined QRWTY generator fixture'

for other in parts[1:]:
    for key in ('elements', 'connections'):
        combined[key].extend(other[key])
    for key in ('nodes', 'relationships'):
        combined['architecture'][key].extend(other['architecture'][key])
    for key, rows in other['architecture']['studio'].items():
        if isinstance(rows, list):
            for row in rows:
                if row not in combined['architecture']['studio'][key]:
                    combined['architecture']['studio'][key].append(row)
    for key, rows in other['ownership'].items():
        combined['ownership'][key].extend(rows)
    combined['generation']['selections'].extend(other['generation']['selections'])

channel = next(row for row in combined['architecture']['studio']['elements'] if row['element'] == 'click-events')
channel['settings']['provider'] = 'google-cloud'

target.mkdir(parents=True, exist_ok=True)
(target / 'design.json').write_text(json.dumps(combined, separators=(',', ':'), ensure_ascii=False))
attachments = []
for name in names:
    for entry in json.loads((fixture_root / name / 'attachments.json').read_bytes()):
        source = Path('owned') / name / Path(entry['source']).name
        (target / source.parent).mkdir(parents=True, exist_ok=True)
        copyfile(fixture_root / name / entry['source'], target / source)
        attachments.append({**entry, 'source': source.as_posix()})
(target / 'attachments.json').write_text(json.dumps(attachments, indent=2) + '\n')
