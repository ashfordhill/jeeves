import hashlib,json,pathlib,subprocess
base='ba89ff12822a1e3d07bfe62666e6008a52193d5c'
root=pathlib.Path('/home/ash/github/jeeves')
sha=lambda value:hashlib.sha256(value).hexdigest()
original=json.load(open('/tmp/jeeves-rg-resume-root-files.json'))
current={p:sha((root/p).read_bytes()) for p in original}
assert all(current[p]==digest for p,digest in original.items() if p!='README.md')
print('Six original non-README root files unchanged; owner README current SHA256',current['README.md'])
paths=json.load(open('/tmp/jeeves-rg-original-owner-paths.json'))
paths=[p.replace('.docs/youtube-v3/','.docs/readme/v0/youtube-v3/') for p in paths]
expected=pathlib.Path('/tmp/jeeves-rg-owner-diff.patch').read_bytes().replace(b'.docs/youtube-v3/',b'.docs/readme/v0/youtube-v3/')
actual=subprocess.check_output(['git','diff','--binary','--',*paths],cwd=root)
assert actual==expected,(len(actual),len(expected),sha(actual),sha(expected))
print('Original 28-path 34001-byte owner patch preserved exactly after owner archive mapping; normalized patch:',len(actual),'bytes',sha(actual))
previous=json.load(open(root/'docs/plans/reliable-generation/evidence/rg14/docker-before.json'))['containers']
containers=[json.loads(line) for line in subprocess.check_output(['docker','ps','-a','--no-trunc','--format','{{json .}}'],text=True).splitlines()]
triples=lambda rows:sorted((r['ID'],r['Names'],r['State']) for r in rows)
assert triples(previous)==triples(containers)
print('All',len(previous),'original container IDs/names/states unchanged')
assert sorted(map(tuple,json.load(open(root/'docs/plans/reliable-generation/evidence/rg19/docker-after.json')))) == triples(containers)
print('Saved RG19 container triples also match')
assert subprocess.check_output(['git','diff',base,'--','jeeves-generator/templates/local-v1'],cwd=root)==b''
print('Frozen v1 untouched')
p='jeeves-generator/templates/local-v2/assets/src/runtime/counter-sql.ts'
assert subprocess.check_output(['git','show',f'{base}:{p}'],cwd=root)==(root/p).read_bytes()
p='jeeves-generator/templates/local-v2/assets/src/runtime/durable-sql.ts'
assert subprocess.check_output(['git','show',f'{base}:{p}'],cwd=root)==(root/p).read_bytes()
print('Accepted receipt/counter SQL builders unchanged')
p='jeeves-generator/src/v2/client-wiring.ts'
before=subprocess.check_output(['git','show',f'{base}:{p}'],cwd=root,text=True);after=(root/p).read_text()
for name in ['idempotencyMigration','localOperationMigration','durableWorkMigration','consumerReceiptMigration']:
 def migration(source):
  value=source[source.index('export const '+name+' ='):]
  return value[:value.index('} as const;')+len('} as const;')]
 assert migration(before)==migration(after),name
 print('Accepted migration unchanged:',name,sha(migration(after).encode()))
print('HEAD',subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip())
print('Index paths:',subprocess.check_output(['git','diff','--cached','--name-only'],cwd=root,text=True).strip() or '(empty)')
