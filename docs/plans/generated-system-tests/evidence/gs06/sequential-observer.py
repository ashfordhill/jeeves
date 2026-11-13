import json, os, subprocess, time
from pathlib import Path
root=Path('/home/ash/github/jeeves')
out=Path('/tmp/gs06-all-final');log=Path('/tmp/gs06-all-final-command.log')
env={**os.environ,'PATH':'/home/ash/.nvm/versions/node/v24.21.0/bin:'+os.environ['PATH']}
samples=[];start=time.monotonic()
with log.open('w') as stream:
 p=subprocess.Popen(['pnpm','test:generated','--suite=all',f'--artifacts={out}'],cwd=root,env=env,stdout=stream,stderr=subprocess.STDOUT)
 while p.poll() is None:
  row={'elapsedSeconds':round(time.monotonic()-start,3),'projects':[]}
  record=out/'run.json'
  if record.exists():
   try:
    for stack in json.loads(record.read_text())['stacks']:
     ids=subprocess.check_output(['docker','ps','-aq','--filter',f"label=com.docker.compose.project={stack['project']}"],text=True,timeout=10).splitlines()
     row['projects'].append({'project':stack['project'],'containers':len(ids),'cleanupComplete':(Path(stack['artifacts'])/'stack-cleanup.json').exists()})
   except Exception as e: row['error']=str(e)
  samples.append(row)
  time.sleep(3)
value={'exitCode':p.returncode,'elapsedSeconds':round(time.monotonic()-start,3),'samples':samples}
(out/'sequential-observations.json').write_text(json.dumps(value,indent=2)+'\n')
raise SystemExit(p.returncode)
