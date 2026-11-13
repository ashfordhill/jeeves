import assert from "node:assert/strict";
import { inApplication, serviceContainers } from "./activity.ts";
import type { Application } from "./application.ts";
import { command, poll } from "./process.ts";

export const wiringTemplates = [...Array<string>(12).fill("module-stub"), "positive-cache-read"];
export const post = (app: Application, tile: string, module: string, body: unknown) =>
  app.request(`/api/${tile}/modules/${module}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
export async function publish(
  app: Application,
  channel: "broadcasts" | "jobs",
  messageId: string,
  value: string,
) {
  const body = { channel, messageId, value };
  assert.deepEqual(await post(app, "publisher-api", "publish", body), {
    status: 202,
    body,
  });
}

/** Harness-owned external service: no Compose/config edits or repository source mounts.
 * Exact project labels enroll it in ordinary success/failure/signal recovery. */
export async function externalFixture(app: Application) {
  const [client] = await serviceContainers(app, "app-wiring-api");
  assert(client);
  const [detail] = JSON.parse(await command("docker", ["inspect", client.Id])) as {
    Config: { Image: string };
    NetworkSettings: { Networks: Record<string, unknown> };
  }[];
  assert(detail);
  const networks = Object.keys(detail.NetworkSettings.Networks);
  assert.equal(networks.length, 1);
  const network = networks[0];
  assert(network);
  const [inspected] = JSON.parse(await command("docker", ["network", "inspect", network])) as {
    Labels: Record<string, string>;
  }[];
  assert.equal(inspected?.Labels["com.docker.compose.project"], app.stack.project);
  const script = `
    import {createServer} from 'node:http';
    const server=createServer(async (request,response)=>{
      request.setTimeout(3000,()=>request.destroy());
      if(request.url==='/health'){response.end('ready');return;}
      let body='';for await (const chunk of request){body+=chunk;if(body.length>65536){request.destroy();return;}}
      const {value}=JSON.parse(body);
      console.log(JSON.stringify({event:'external-request',method:request.method,path:request.url,body:{value}}));
      response.setHeader('content-type','application/json');
      response.end(JSON.stringify({received:value,result:'external:'+value.toUpperCase()}));
    });server.requestTimeout=3000;server.listen(3000,'0.0.0.0');
  `;
  const id = (
    await command(
      "docker",
      [
        "run",
        "-d",
        "--label",
        `com.docker.compose.project=${app.stack.project}`,
        "--label",
        "com.docker.compose.service=external-fixture",
        "--network",
        network,
        "--network-alias",
        "external-fixture",
        "--entrypoint",
        "node",
        detail.Config.Image,
        "--input-type=module",
        "-e",
        script,
      ],
      { timeoutMs: 30_000 },
    )
  ).trim();
  try {
    await poll(
      "harness external HTTP fixture ready",
      () =>
        inApplication(
          app,
          "app-wiring-api",
          `
    const response=await fetch('http://external-fixture:3000/health',{signal:AbortSignal.timeout(2000)});
    console.log(JSON.stringify({status:response.status,body:await response.text()}));
  `,
        ),
      (value) => (value as { status: number }).status === 200,
      15_000,
      (value) => app.record(value),
    );
  } catch (error) {
    await app.save("external-fixture-startup.json", {
      logs: await command("docker", ["logs", id]),
    });
    throw error;
  }
  return {
    endpoint: "http://external-fixture:3000/echo",
    async requests() {
      // Revalidate the label before addressing this harness-owned container.
      const [row] = JSON.parse(await command("docker", ["inspect", id])) as {
        Config: { Labels: Record<string, string> };
      }[];
      assert.equal(row?.Config.Labels["com.docker.compose.project"], app.stack.project);
      const requests = (await command("docker", ["logs", id]))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      app.record({ externalFixture: { id, requests } });
      return requests;
    },
  };
}

export async function seedSearch(app: Application) {
  const result = (await inApplication(
    app,
    "app-wiring-api",
    `
    const call=async(path,method,body)=>{
      const response=await fetch('http://search-items-index:9200'+path,{method,headers:{'content-type':'application/json'},body:body&&JSON.stringify(body),signal:AbortSignal.timeout(3000)});
      return {status:response.status,body:await response.json()};
    };
    const mapping={dynamic:'strict',properties:{id:{type:'keyword'},title:{type:'text'},state:{type:'keyword'}}};
    const created=await call('/items-index','PUT',{mappings:mapping});
    const documents=[{id:'amber',title:'Amber lighthouse',state:'published'},{id:'violet',title:'Violet harbor',state:'published'}];
    const writes=[];for(const document of documents)writes.push(await call('/items-index/_doc/'+document.id,'PUT',document));
    const refresh=await call('/items-index/_refresh','POST');
    const observed=await call('/items-index/_mapping','GET');
    console.log(JSON.stringify({mapping,created,writes,refresh,observed,documents}));
  `,
  )) as {
    created: { status: number };
    writes: { status: number }[];
    refresh: { status: number };
    observed: { status: number };
  };
  app.record({ searchSetup: result });
  assert.equal(result.created.status, 200);
  assert.deepEqual(
    result.writes.map((row) => row.status),
    [201, 201],
  );
  assert.equal(result.refresh.status, 200);
  assert.equal(result.observed.status, 200);
}

export async function objectScopeProbe(
  app: Application,
  service: "app-wiring-api" | "app-internal-api",
  bucket: string,
  key: string,
) {
  const tile = service.slice(4);
  const result = (await inApplication(
    app,
    service,
    `
    import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
    import {readFileSync} from 'node:fs';
    const client=new S3Client({endpoint:'http://local-objects:3900',region:'garage',forcePathStyle:true,
      credentials:JSON.parse(readFileSync('/run/secrets/s3-${tile}','utf8')),maxAttempts:1,
      requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
    const outcomes=[];
    try {
      for(const [operation,command] of [
        ['read',new GetObjectCommand({Bucket:${JSON.stringify(bucket)},Key:${JSON.stringify(key)}})],
        ['write',new PutObjectCommand({Bucket:${JSON.stringify(bucket)},Key:'denied-write',Body:Buffer.from('denied')})]
      ]) {
        try {const value=await client.send(command,{abortSignal:AbortSignal.timeout(3000)});if(value.Body)await value.Body.transformToByteArray();outcomes.push({operation,allowed:true});}
        catch(error){outcomes.push({operation,allowed:false,code:error.name,status:error.$metadata?.httpStatusCode});}
      }
      console.log(JSON.stringify(outcomes));
    } finally {client.destroy();}
  `,
  )) as { operation: string; allowed: boolean; code: string; status: number }[];
  app.record({ objectScope: { service, bucket, key, outcomes: result } });
  assert.equal(result.length, 2);
  for (const row of result) {
    assert.equal(row.allowed, false);
    assert.equal(row.status, 403);
    assert.equal(row.code, "AccessDenied");
  }
}

export type CacheObservation = {
  value: string | null;
  pttl: number;
  hits: number;
};
export async function cacheObservation(app: Application, key: string): Promise<CacheObservation> {
  const value = await inApplication<CacheObservation>(
    app,
    "app-catalog-api",
    `
    import {createClient} from 'redis';import {readFileSync} from 'node:fs';
    const client=createClient({password:readFileSync('/run/secrets/cache-catalog-cache','utf8').trim(),
      socket:{host:'cache-catalog-cache',port:6379,connectTimeout:2000,reconnectStrategy:false}});
    client.on('error',()=>{});
    try {await client.connect();const value=await client.get(${JSON.stringify(key)});
      const pttl=await client.pTTL(${JSON.stringify(key)});const stats=await client.info('stats');
      console.log(JSON.stringify({value,pttl,hits:Number(stats.match(/keyspace_hits:(\\d+)/)[1])}));
    }finally{client.destroy();}
  `,
  );
  app.record({ cacheObservation: { key, ...value } });
  return value;
}

export async function catalogLoads(app: Application, key: string) {
  const logs = await app.compose(["logs", "--no-color", "app-catalog-api"]);
  const loads = logs.split("\n").flatMap((line) => {
    try {
      const entry = JSON.parse(line.slice(line.indexOf("{")));
      return entry.event === "catalog-load" && entry.key === key ? [entry] : [];
    } catch {
      return [];
    }
  });
  app.record({ catalogLoads: { key, count: loads.length } });
  return loads.length;
}

/** INFO does not access a key, unlike both GET and PTTL, so this isolates the application's hit. */
export async function cacheHitCount(app: Application) {
  const hits = await inApplication<number>(
    app,
    "app-catalog-api",
    `
    import {createClient} from 'redis';import {readFileSync} from 'node:fs';
    const client=createClient({password:readFileSync('/run/secrets/cache-catalog-cache','utf8').trim(),
      socket:{host:'cache-catalog-cache',port:6379,connectTimeout:2000,reconnectStrategy:false}});
    client.on('error',()=>{});
    try{await client.connect();const stats=await client.info('stats');
      console.log(JSON.stringify(Number(stats.match(/keyspace_hits:(\\d+)/)[1])));
    }finally{client.destroy();}
  `,
  );
  app.record({ cacheHitCount: hits });
  return hits;
}
