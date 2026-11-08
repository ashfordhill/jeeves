import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const directory = "/tmp/jeeves-fp03a/final3";
const env = { ...process.env, COMPOSE_PROJECT_NAME: "jeeves-fp03a" };
function run(service, code, input) {
  const output = execFileSync(
    "docker",
    ["compose", "exec", "-T", service, "node", "--input-type=module", "-e", code],
    { cwd: directory, env, input, encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  return output.trim() ? JSON.parse(output) : null;
}
const require = createRequire("/home/ash/github/jeeves/package.json");
const { chromium } = require("@playwright/test");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const summary = {
  scope: "Bounded infrastructure/helper integration only; S01–S08 business scenarios not run",
  checks: {},
};
let step = "edge";
try {
  const response = await page.goto("http://127.0.0.1:4400/");
  assert.equal(response.status(), 200);
  assert.match(await page.textContent("body"), /Infrastructure and service shells only/);
  const business = await page.request.get("http://127.0.0.1:4400/api/watch/videos/unimplemented");
  assert.equal(business.status(), 501);
  summary.checks.http = { root: 200, businessRoute: 501 };
  step = "storage";
  const upload = run(
    "upload",
    `import {objects,signPart} from './dist/lib/objects.js';
    import {CreateMultipartUploadCommand} from '@aws-sdk/client-s3';
    const result=await objects().send(new CreateMultipartUploadCommand({Bucket:'youtube-v1-originals',Key:'scaffold-probe.txt',ContentType:'text/plain'}));
    console.log(JSON.stringify({uploadId:result.UploadId,url:await signPart('youtube-v1-originals','scaffold-probe.txt',result.UploadId,1)}));`,
  );
  // The signed capability stays in process memory, never logged or written to evidence.
  const payload = "scaffold transport probe bytes";
  const put = await page.evaluate(
    async ({ url, payload }) => {
      const response = await fetch(url, {
        method: "PUT",
        body: payload,
        headers: { "Content-Type": "text/plain" },
      });
      return { status: response.status, etag: response.headers.get("etag") };
    },
    { url: upload.url, payload },
  );
  assert.equal(put.status, 200);
  assert.ok(put.etag);
  run(
    "upload",
    `import {objects} from './dist/lib/objects.js';import {ListPartsCommand,CompleteMultipartUploadCommand} from '@aws-sdk/client-s3';
    const client=objects(); const id=${JSON.stringify(upload.uploadId)};
    const listed=await client.send(new ListPartsCommand({Bucket:'youtube-v1-originals',Key:'scaffold-probe.txt',UploadId:id}));
    if(listed.Parts.length!==1 || listed.Parts[0].ETag!==${JSON.stringify(put.etag)})throw new Error('ListParts mismatch');
    await client.send(new CompleteMultipartUploadCommand({Bucket:'youtube-v1-originals',Key:'scaffold-probe.txt',UploadId:id,MultipartUpload:{Parts:[{PartNumber:1,ETag:${JSON.stringify(put.etag)}}]}}));`,
  );
  const read = run(
    "transcoder",
    `import {objects} from './dist/lib/objects.js';import {GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
    const client=objects();const result=await client.send(new GetObjectCommand({Bucket:'youtube-v1-originals',Key:'scaffold-probe.txt'}));
    const body=await result.Body.transformToString();
    await client.send(new PutObjectCommand({Bucket:'youtube-v1-transcoded',Key:'scaffold-probe.txt',Body:body,ContentType:'text/plain'}));
    console.log(JSON.stringify({body}));`,
  );
  assert.equal(read.body, payload);
  const anonymous = await page.request.get(
    "http://127.0.0.1:4402/youtube-v1-originals/scaffold-probe.txt",
  );
  assert.equal(anonymous.status(), 403);
  const media = await page.request.get("http://127.0.0.1:4400/media/scaffold-probe.txt");
  assert.equal(media.status(), 200);
  assert.equal(await media.text(), payload);
  const range = await page.request.get("http://127.0.0.1:4400/media/scaffold-probe.txt", {
    headers: { Range: "bytes=0-4" },
  });
  assert.equal(range.status(), 206);
  assert.equal(await range.text(), payload.slice(0, 5));
  summary.checks.storage = {
    browserSignedPartPut: 200,
    etagExposed: true,
    listPartsAndComplete: true,
    transcoderOriginalRead: true,
    anonymousOriginal: 403,
    publicWebsiteViaEdge: 200,
    range: 206,
    bytes: payload.length,
    applicationUploadLifecycle: "unimplemented",
    mediaEncoding: "not exercised",
  };
  step = "postgres";
  run(
    "completion-handler",
    `import {connect} from './dist/clients/handler-writer.js';const pool=connect();await pool.query('CREATE TABLE scaffold_probe(id int)');await pool.query('INSERT INTO scaffold_probe VALUES(1)');await pool.end();`,
  );
  const grants = run(
    "watch",
    `import {connect} from './dist/clients/watch-details.js';const pool=connect();const result=await pool.query('SELECT * FROM scaffold_probe');let denied=false;try{await pool.query('INSERT INTO scaffold_probe VALUES(2)')}catch(error){denied=error.code==='42501'}await pool.end();console.log(JSON.stringify({rows:result.rowCount,denied}));`,
  );
  assert.deepEqual(grants, { rows: 1, denied: true });
  run(
    "completion-handler",
    `import {connect} from './dist/clients/handler-writer.js';const pool=connect();await pool.query('DROP TABLE scaffold_probe');await pool.end();`,
  );
  summary.checks.postgres = {
    ownerCreateAndInsert: true,
    defaultReaderSelect: true,
    readerInsertDenied: true,
  };
  step = "cache";
  const cached = run(
    "watch",
    `import {cache} from './dist/lib/cache.js';const client=await cache();await client.set('scaffold-probe','ok',{EX:60});const value=await client.get('scaffold-probe');await client.del('scaffold-probe');await client.quit();console.log(JSON.stringify({value}));`,
  );
  assert.equal(cached.value, "ok");
  summary.checks.cache = { setGetDelete: true, cacheAside: "unimplemented" };
  step = "broker";
  const delivery = run(
    "upload",
    `import {broker,publisher} from './dist/lib/amqp.js';
    const connection=await broker();const channel=await connection.createChannel();
    for(const queue of ['upload-jobs','view-counter','completion-handler','search-indexer'])await channel.checkQueue(queue);
    const out=await publisher('','upload-jobs');await out.publish(Buffer.from('scaffold failure probe'),'scaffold-probe');await out.connection.close();
    let attempts=null;for(let i=0;i<100;i++){const message=await channel.get('upload-jobs.failed',{noAck:false});if(message){attempts=message.properties.headers['x-scaffold-attempt'];channel.ack(message);break}await new Promise(resolve=>setTimeout(resolve,100))}
    await connection.close();console.log(JSON.stringify({attempts}));`,
  );
  assert.equal(delivery.attempts, 4);
  summary.checks.broker = {
    durableQueuesPresent: 4,
    publisherConfirm: true,
    unimplementedHandlerTerminalAttempt: 4,
    applicationEffects: "none",
  };
  step = "search";
  const search = run(
    "search",
    `import {searchClient} from './dist/lib/search.js';const client=searchClient();const info=await client.info();const settings=await client.indices.getSettings({index:'videos'});console.log(JSON.stringify({version:info.body.version.number,settings:settings.body.videos.settings.index}));await client.close();`,
  );
  assert.equal(search.version, "3.9.0");
  assert.equal(search.settings.number_of_shards, "1");
  assert.equal(search.settings.number_of_replicas, "0");
  summary.checks.search = {
    version: search.version,
    shards: 1,
    replicas: 0,
    businessQuery: "unimplemented",
  };
  step = "oidc";
  const issuer = "http://127.0.0.1:4401/realms/youtube-v1";
  const discovery = await (
    await page.request.get(`${issuer}/.well-known/openid-configuration`)
  ).json();
  assert.equal(discovery.issuer, issuer);
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: "youtube-v1-web",
    redirect_uri: "http://127.0.0.1:4400/callback",
    response_type: "code",
    scope: "openid",
    code_challenge_method: "S256",
    code_challenge: challenge,
    state: "scaffold-probe",
  });
  await page.goto(`${discovery.authorization_endpoint}?${params}`);
  await page.locator("#username").fill("creator");
  await page
    .locator("#password")
    .fill(readFileSync(`${directory}/.runtime/secrets/creator_password`, "utf8").trim());
  await page.locator("#kc-login").click();
  await page.waitForURL("http://127.0.0.1:4400/callback?**");
  const code = new URL(page.url()).searchParams.get("code");
  assert.ok(code);
  const token = await page.evaluate(
    async ({ endpoint, code, verifier }) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: "youtube-v1-web",
          redirect_uri: "http://127.0.0.1:4400/callback",
          code,
          code_verifier: verifier,
        }),
      });
      if (!response.ok) throw new Error("OIDC token exchange failed");
      return response.json();
    },
    { endpoint: discovery.token_endpoint, code, verifier },
  );
  const verified = run(
    "upload",
    `import {creatorToken} from './dist/lib/jwt.js';let raw="";for await(const chunk of process.stdin)raw+=chunk;const payload=await creatorToken(raw);console.log(JSON.stringify({issuer:payload.iss,audience:payload.aud,expires:typeof payload.exp==='number',creator:payload.realm_access.roles.includes('creator')}));`,
    token.access_token,
  );
  assert.equal(verified.issuer, issuer);
  assert.ok([verified.audience].flat().includes("youtube-v1-api"));
  assert.ok(verified.expires && verified.creator);
  summary.checks.oidc = {
    realRealmPkceS256: true,
    browserCorsTokenExchange: true,
    internalJwksPublicIssuerAudienceExpiryRole: true,
    applicationSignInUi: "unimplemented",
  };
  run(
    "upload",
    `import {objects} from './dist/lib/objects.js';import {DeleteObjectCommand} from '@aws-sdk/client-s3';await objects().send(new DeleteObjectCommand({Bucket:'youtube-v1-originals',Key:'scaffold-probe.txt'}));`,
  );
  run(
    "transcoder",
    `import {objects} from './dist/lib/objects.js';import {DeleteObjectCommand} from '@aws-sdk/client-s3';await objects().send(new DeleteObjectCommand({Bucket:'youtube-v1-transcoded',Key:'scaffold-probe.txt'}));`,
  );
  writeFileSync("/tmp/jeeves-fp03a/provider-result.json", `${JSON.stringify(summary, null, 2)}\n`);
  console.log(
    "Bounded provider/helper checks passed; no business scenario or custom completion credit.",
  );
} catch (error) {
  console.error(
    `Probe failed at ${step}: ${error.name}. Inspect locally; tokens/capabilities are deliberately omitted.`,
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
