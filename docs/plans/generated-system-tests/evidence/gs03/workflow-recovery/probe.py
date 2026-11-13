import hashlib,json,os,subprocess,tempfile,uuid
from pathlib import Path

repository=Path('/home/ash/github/jeeves')
workflow=repository/'.github/workflows/generated-system.yml'
def script(name):
 lines=workflow.read_text().splitlines()
 at=next(i for i,line in enumerate(lines) if line.strip()=='- name: '+name)
 at=next(i for i in range(at,len(lines)) if lines[i].strip()=='run: |')+1
 text=[]
 for line in lines[at:]:
  if line and not line.startswith('          '): break
  text.append(line[10:] if line else '')
 result='\n'.join(text)+'\n'
 assert '${{' not in result
 return result
recover=script("Recover this run's scoped resources")
adapter=script('Record adapter outcome')
out=Path('/tmp/gs03-workflow-recovery-probe')
out.mkdir(exist_ok=False)
(out/'recovery.sh').write_text(recover)
(out/'adapter.sh').write_text(adapter)
results=[]
for fail in [False,True]:
 case=out/('unreadable-secret' if fail else 'success')
 artifacts=case/'run'
 artifacts.mkdir(parents=True)
 temporary=Path(tempfile.mkdtemp(prefix='jeeves-system-workflow-probe-'))
 app=temporary/'1-probe'
 secrets=app/'.runtime/secrets'
 secrets.mkdir(parents=True,mode=0o700)
 token=secrets/'sentinel'
 sentinel=uuid.uuid4().hex+uuid.uuid4().hex
 token.write_text(sentinel)
 token.chmod(0o600)
 (artifacts/'reporter.json').write_text(json.dumps({'message':sentinel})+'\n')
 runid='gs-'+str(uuid.uuid4())
 record={'version':1,'id':runid,'temporary':str(temporary),'suite':'core','stacks':[
  {'project':runid+'-1','application':str(app),'artifacts':str(artifacts/'1-probe'),
   'fixture':'probe','ports':[45951,45952,45953]}]}
 (artifacts/'run.json').write_text(json.dumps(record,indent=2)+'\n')
 (artifacts/'sanitized.json').write_text(json.dumps({'version':1,'id':'stale','complete':True})+'\n')
 output=case/'github-output.txt'
 output.write_text('')
 env=os.environ.copy()
 env.update(PATH='/home/ash/.nvm/versions/node/v24.21.0/bin:'+env['PATH'],
            ARTIFACT_ROOT=str(case),ARTIFACTS=str(artifacts),GITHUB_OUTPUT=str(output),
            SELECTED_SUITE='core',INSTALL_OUTCOME='success',BUILDER_OUTCOME='success',GENERATED_OUTCOME='failure')
 if fail:
  if os.geteuid()==0:
   obstruction=secrets/'unreadable'
   obstruction.mkdir()
  else: token.chmod(0)
 def invoke(text,name):
  value=subprocess.run(['bash','--noprofile','--norc','-e','-o','pipefail','-c',text],
        cwd=repository,env=env,capture_output=True,text=True,timeout=60)
  (case/name).write_text(value.stdout+value.stderr)
  return value.returncode
 cleanup_exit=invoke(recover,'recovery-command.log')
 env['CLEANUP_OUTCOME']='success' if cleanup_exit==0 else 'failure'
 env['SANITIZED_ARTIFACTS']='true' if 'sanitized=true' in output.read_text().splitlines() else ''
 assert invoke(adapter,'adapter-command.log')==0
 uploads=list((case/'upload').rglob('*'))
 uploaded_secret=any(sentinel.encode() in p.read_bytes() for p in uploads if p.is_file())
 has_raw_copy=(case/'upload/run').exists()
 result={'case':case.name,'recoveryExitCode':cleanup_exit,
         'fullUploadAllowed':env['SANITIZED_ARTIFACTS']=='true','copiedRun':has_raw_copy,
         'uploadContainsSecret':uploaded_secret,'runtimeRemoved':not temporary.exists(),
         'safeAdapter':json.loads((case/'upload/adapter.json').read_text()),
         'secretSha256':hashlib.sha256(sentinel.encode()).hexdigest()}
 if fail:
  result['staleMarkerRemoved']=not (artifacts/'sanitized.json').exists()
  assert cleanup_exit!=0 and not has_raw_copy and not uploaded_secret and temporary.exists() and result['staleMarkerRemoved']
  if os.geteuid()==0: obstruction.rmdir()
  else: token.chmod(0o600)
  assert invoke(recover,'repaired-recovery.log')==0
  result['runtimeRemovedAfterRepair']=not temporary.exists()
  assert result['runtimeRemovedAfterRepair']
 else:
  assert cleanup_exit==0 and has_raw_copy and not uploaded_secret and not temporary.exists()
  assert '[REDACTED]' in (case/'upload/run/reporter.json').read_text()
 results.append(result)
(out/'results.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results),flush=True)
