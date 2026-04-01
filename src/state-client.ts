import { STATE_OBJECT_NAME } from "./constants";
import type { JobRecord, ManifestRecord, ProviderKeyRecord } from "./types";

type BorisEnvLike = {
  BORIS_STATE: DurableObjectNamespace;
};

function stateStub(env: BorisEnvLike): DurableObjectStub {
  const id = env.BORIS_STATE.idFromName(STATE_OBJECT_NAME);
  return env.BORIS_STATE.get(id);
}

async function request<T>(
  env: BorisEnvLike,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await stateStub(env).fetch(`https://state.internal${path}`, init);
  if (!response.ok) {
    throw new Error(`State request failed: ${response.status} ${path}`);
  }
  return (await response.json()) as T;
}

export function getManifest(env: BorisEnvLike): Promise<ManifestRecord> {
  return request(env, "/manifest");
}

export function putManifest(env: BorisEnvLike, manifest: ManifestRecord): Promise<ManifestRecord> {
  return request(env, "/manifest", {
    method: "PUT",
    body: JSON.stringify(manifest),
  });
}

export function putKeyRecord(env: BorisEnvLike, record: ProviderKeyRecord): Promise<ProviderKeyRecord> {
  return request(env, `/keys/${record.ref}`, {
    method: "PUT",
    body: JSON.stringify(record),
  });
}

export function getKeyRecord(env: BorisEnvLike, ref: string): Promise<ProviderKeyRecord> {
  return request(env, `/keys/${ref}`);
}

export function putJob(env: BorisEnvLike, job: JobRecord): Promise<JobRecord> {
  return request(env, `/jobs/${job.id}`, {
    method: "PUT",
    body: JSON.stringify(job),
  });
}

export function patchJob(env: BorisEnvLike, jobId: string, patch: Partial<JobRecord>): Promise<JobRecord> {
  return request(env, `/jobs/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function getJob(env: BorisEnvLike, jobId: string): Promise<JobRecord> {
  return request(env, `/jobs/${jobId}`);
}
