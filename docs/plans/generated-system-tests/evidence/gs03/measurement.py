#!/usr/bin/env python3
"""GS03 evidence helper: run the ordinary CLI; sample only its recorded project labels."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import uuid

ROOT = Path('/home/ash/github/jeeves')
OUTPUT = Path('/tmp/gs03-measurements-confirmed')
OUTPUT.mkdir(exist_ok=False)
BUILDER = f'gs03-{uuid.uuid4().hex}'
STORE = Path(tempfile.mkdtemp(prefix='gs03-pnpm-'))
ENV = {key: value for key, value in os.environ.items()
       if not key.startswith(('GITHUB_', 'ACTIONS_', 'RUNNER_'))}
ENV['PATH'] = '/home/ash/.nvm/versions/node/v24.21.0/bin:' + ENV['PATH']
ENV['BUILDX_BUILDER'] = BUILDER
ENV['PNPM_CONFIG_STORE_DIR'] = str(STORE)

def command(args, timeout=30):
    return subprocess.check_output(args, cwd=ROOT, env=ENV, text=True,
                                   stderr=subprocess.STDOUT, timeout=timeout).strip()

def save(name, value):
    (OUTPUT / name).write_text(json.dumps(value, indent=2) + '\n')

def inventory():
    return {kind: command(args).splitlines() for kind, args in {
        'containers': ['docker', 'ps', '-aq'],
        'networks': ['docker', 'network', 'ls', '-q'],
        'volumes': ['docker', 'volume', 'ls', '-q'],
    }.items()}

def memory_bytes(value):
    amount, unit = re.fullmatch(r'([\d.]+)\s*([A-Za-z]+)', value).groups()
    return round(float(amount) * {'B': 1, 'kB': 1000, 'MB': 1000**2, 'GB': 1000**3,
        'KiB': 1024, 'MiB': 1024**2, 'GiB': 1024**3}[unit])

def sample(record):
    run = json.loads(record.read_text())
    ids = []
    for stack in run['stacks']:
        ids += command(['docker', 'ps', '-q', '--filter',
            f"label=com.docker.compose.project={stack['project']}"]).splitlines()
    builder_ids = command(['docker', 'ps', '-q', '--filter', f'name=buildx_buildkit_{BUILDER}']).splitlines()
    stats = [json.loads(line) for line in command(['docker', 'stats', '--no-stream',
        '--format', '{{json .}}', *ids, *builder_ids], timeout=20).splitlines()]
    run_stats = [row for row in stats if not row['Name'].startswith('buildx_buildkit_')]
    builder_stats = [row for row in stats if row['Name'].startswith('buildx_buildkit_')]
    return {'running': len(ids),
            'memoryBytes': sum(memory_bytes(row['MemUsage'].split('/')[0].strip()) for row in run_stats),
            'cpuPercent': round(sum(float(row['CPUPerc'].rstrip('%')) for row in run_stats), 2),
            'builderMemoryBytes': sum(memory_bytes(row['MemUsage'].split('/')[0].strip()) for row in builder_stats),
            'builderCpuPercent': round(sum(float(row['CPUPerc'].rstrip('%')) for row in builder_stats), 2)}

before = inventory()
provider_refs = json.loads((ROOT / 'jeeves-generator/templates/local-v2/assets/providers.json').read_text())
images = [provider_refs[key] for key in ['postgres', 'broker', 'nginx']]
provider_cache = []
for image in images:
    provider_cache.append({'reference': image,
        'presentBefore': subprocess.run(['docker', 'image', 'inspect', image],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0})
save('identity.json', {'builder': BUILDER, 'privatePnpmStore': str(STORE),
    'commit': command(['git', 'rev-parse', 'HEAD']),
    'githubEnvironmentPresent': any(key.startswith(('GITHUB_', 'ACTIONS_', 'RUNNER_')) for key in ENV),
    'providerCache': provider_cache,
    'machine': {'cpu': command(['lscpu']), 'docker': command(['docker', 'info', '--format', '{{.NCPU}} {{.MemTotal}}']),
                'memory': Path('/proc/meminfo').read_text().splitlines()[:3]},
    'scope': 'Cold means fresh standalone pnpm store and empty dedicated BuildKit builder. Provider images and repository node_modules already exist. Warm reuses only those download/build caches, never provider volumes/runtime.'})

try:
    (OUTPUT / 'builder-create.log').write_text(command(['docker', 'buildx', 'create',
        '--name', BUILDER, '--driver', 'docker-container', '--bootstrap'], timeout=180) + '\n')
    (OUTPUT / 'cold-builder-cache.txt').write_text(command(['docker', 'buildx', 'du', '--builder', BUILDER]) + '\n')
    for temperature in ['cold', 'warm']:
        artifacts = Path(f'/tmp/gs03-{temperature}-confirmed')
        log_path = Path(f'/tmp/gs03-{temperature}-confirmed-command.log')
        time_path = Path(f'/tmp/gs03-{temperature}-confirmed-time.txt')
        started = time.monotonic()
        print(f'{temperature}: started; artifacts={artifacts}; builder={BUILDER}', flush=True)
        with log_path.open('w') as log:
            process = subprocess.Popen(['/usr/bin/time', '-v', '-o', str(time_path), 'pnpm',
                'test:generated', '--suite=core', f'--artifacts={artifacts}'],
                cwd=ROOT, env=ENV, stdout=log, stderr=subprocess.STDOUT)
            samples = []
            while process.poll() is None:
                observation = {'elapsedSeconds': round(time.monotonic() - started, 3)}
                try:
                    if (artifacts / 'run.json').exists():
                        observation.update(sample(artifacts / 'run.json'))
                except Exception as error:
                    observation['samplingError'] = str(error)
                samples.append(observation)
                if time.monotonic() - started > 1200:
                    process.terminate()
                    raise RuntimeError(f'{temperature} command exceeded measurement deadline')
                time.sleep(5)
        measured = {'temperature': temperature, 'exitCode': process.returncode,
            'elapsedSeconds': round(time.monotonic() - started, 3),
            'sampleIntervalSeconds': 5,
            'peakRunningContainers': max(row.get('running', 0) for row in samples),
            'peakContainerMemoryBytes': max(row.get('memoryBytes', 0) for row in samples),
            'peakContainerCpuPercent': max(row.get('cpuPercent', 0) for row in samples),
            'peakBuilderMemoryBytes': max(row.get('builderMemoryBytes', 0) for row in samples),
            'peakCombinedContainerMemoryBytes': max(row.get('memoryBytes', 0)+row.get('builderMemoryBytes', 0) for row in samples),
            'peakCombinedCpuPercent': max(row.get('cpuPercent', 0)+row.get('builderCpuPercent', 0) for row in samples),
            'gnuTime': time_path.read_text(), 'samples': samples}
        save(f'{temperature}.json', measured)
        (OUTPUT / f'{temperature}-builder-cache.txt').write_text(command(['docker', 'buildx', 'du', '--builder', BUILDER]) + '\n')
        print(json.dumps({key: value for key, value in measured.items() if key not in ['samples', 'gnuTime']}), flush=True)
        if process.returncode != 0 or measured['peakRunningContainers'] == 0:
            raise RuntimeError(f'{temperature} did not produce a successful observed run')
finally:
    (OUTPUT / 'builder-history.log').write_text(command(['docker', 'buildx', 'history', 'ls', '--builder', BUILDER, '--format', 'json']))
    builder_ids=command(['docker','ps','-q','--filter',f'name=buildx_buildkit_{BUILDER}']).splitlines()
    if builder_ids: (OUTPUT / 'builder-daemon.log').write_text(command(['docker','logs','--timestamps',builder_ids[0]]))
    removal = subprocess.run(['docker', 'buildx', 'rm', BUILDER], text=True,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=120)
    (OUTPUT / 'builder-remove.log').write_text(removal.stdout)
    shutil.rmtree(STORE)
    after = inventory()
    save('cleanup.json', {'builder': BUILDER, 'builderRemoveExit': removal.returncode,
        'privatePnpmStoreRemoved': not STORE.exists(),
        'resourceDifferences': {kind: {'added': sorted(set(after[kind]) - set(before[kind])),
            'removed': sorted(set(before[kind]) - set(after[kind]))} for kind in before},
        'beforeInventoryHash': hashlib.sha256(json.dumps(before, sort_keys=True).encode()).hexdigest(),
        'afterInventoryHash': hashlib.sha256(json.dumps(after, sort_keys=True).encode()).hexdigest()})
