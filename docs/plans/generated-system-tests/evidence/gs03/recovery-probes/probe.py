import hashlib,json,os,shutil,subprocess,sys,tempfile,uuid
from pathlib import Path

mode=sys.argv[1]
out=Path('/tmp/gs03-recovery-'+mode)
out.mkdir(exist_ok=False)
temporary=Path(tempfile.mkdtemp(prefix='jeeves-system-recovery-'))
application=temporary/'1-probe'
secrets=application/'.runtime/secrets'
secrets.mkdir(parents=True,mode=0o700)
os.chmod(application/'.runtime',0o700)
sentinel=uuid.uuid4().hex+uuid.uuid4().hex
secret=secrets/'sentinel'
secret.write_text(sentinel)
secret.chmod(0o600)
reporter=out/'reporter.json'
reporter.write_text(json.dumps({'message':'raw reporter operand '+sentinel})+'\n')
runid='gs-'+str(uuid.uuid4())
record={'version':1,'id':runid,'temporary':str(temporary),'suite':'core','stacks':[
 {'project':runid+'-1','application':str(application),'artifacts':str(out/'1-probe'),
  'fixture':'probe','ports':[45951,45952,45953]}]}
(out/'run.json').write_text(json.dumps(record,indent=2)+'\n')
if mode=='io-failure':
 (out/'sanitized.json').write_text(json.dumps({'version':1,'id':runid,'complete':True})+'\n')
 if os.geteuid()==0:
  obstruction=secrets/'unreadable'
  obstruction.mkdir()
  fault='EISDIR from an invalid existing secret entry'
 else:
  secret.chmod(0)
  fault='EACCES from an unreadable existing secret'
else:
 fault=None
env=os.environ.copy()
env['PATH']='/home/ash/.nvm/versions/node/v24.21.0/bin:'+env['PATH']
command=['pnpm','test:generated','--cleanup',str(out/'run.json')]
def invoke(name):
 value=subprocess.run(command,cwd='/home/ash/github/jeeves',env=env,capture_output=True,text=True,timeout=60)
 (out/name).write_text(value.stdout+value.stderr)
 return value.returncode
exitcode=invoke('command.log')
marker=json.loads((out/'sanitized.json').read_text()) if (out/'sanitized.json').exists() else None
result={'mode':mode,'exitCode':exitcode,'artifactContainsSecret':sentinel in reporter.read_text(),
        'artifactRedacted':'[REDACTED]' in reporter.read_text(),'runtimeRemoved':not temporary.exists(),
        'marker':marker,'secretSha256':hashlib.sha256(sentinel.encode()).hexdigest(),'fault':fault}
if mode=='io-failure':
 result['failClosed']=exitcode!=0 and marker is None and temporary.exists()
 assert result['failClosed'],result
 if os.geteuid()==0: obstruction.rmdir()
 else: secret.chmod(0o600)
 result['recoveryExitCode']=invoke('recovery-command.log')
 result['runtimeRemovedAfterRecovery']=not temporary.exists()
 result['artifactRedactedAfterRecovery']=sentinel not in reporter.read_text() and '[REDACTED]' in reporter.read_text()
 assert result['recoveryExitCode']==0 and result['runtimeRemovedAfterRecovery'] and result['artifactRedactedAfterRecovery']
else:
 result['passed']=exitcode==0 and result['artifactRedacted'] and not result['artifactContainsSecret'] and result['runtimeRemoved'] and marker is not None and marker.get('id')==runid
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result),flush=True)
if mode=='before':
 assert not result['passed']
 sys.exit(1)
if mode=='after': assert result['passed']
