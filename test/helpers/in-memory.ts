import { readFile } from "node:fs/promises";
import { buildManifest } from "../../src/manifest";
import type { JobRecord, ManifestRecord, ProviderKeyRecord, QueueMessage } from "../../src/types";

type StoredObject = {
  bytes: Uint8Array;
  contentType: string;
};

class InMemoryR2Object {
  constructor(private readonly stored: StoredObject) {}

  get size(): number {
    return this.stored.bytes.byteLength;
  }

  get httpMetadata() {
    return {
      contentType: this.stored.contentType,
    };
  }

  get body(): ReadableStream<Uint8Array> {
    const bytes = this.stored.bytes;
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.stored.bytes.buffer.slice(
      this.stored.bytes.byteOffset,
      this.stored.bytes.byteOffset + this.stored.bytes.byteLength,
    ) as ArrayBuffer;
  }
}

export class InMemoryR2Bucket {
  readonly name = "test-bucket";
  private readonly objects = new Map<string, StoredObject>();

  async put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<void> {
    this.objects.set(key, {
      bytes: value,
      contentType: options?.httpMetadata?.contentType ?? "application/octet-stream",
    });
  }

  async head(key: string): Promise<InMemoryR2Object | null> {
    const stored = this.objects.get(key);
    return stored ? new InMemoryR2Object(stored) : null;
  }

  async get(
    key: string,
    options?: { range?: { offset: number; length: number } },
  ): Promise<InMemoryR2Object | null> {
    const stored = this.objects.get(key);
    if (!stored) {
      return null;
    }
    if (!options?.range) {
      return new InMemoryR2Object(stored);
    }
    const bytes = stored.bytes.slice(
      options.range.offset,
      options.range.offset + options.range.length,
    );
    return new InMemoryR2Object({
      bytes,
      contentType: stored.contentType,
    });
  }
}

class InMemoryQueue<T> {
  readonly messages: T[] = [];

  async send(message: T): Promise<void> {
    this.messages.push(message);
  }
}

type StateStore = {
  manifest: ManifestRecord;
  keys: Map<string, ProviderKeyRecord>;
  jobs: Map<string, JobRecord>;
};

class InMemoryStateStub {
  constructor(private readonly state: StateStore) {}

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (request.method === "GET" && url.pathname === "/manifest") {
      return Response.json(this.state.manifest);
    }

    if (request.method === "PUT" && url.pathname === "/manifest") {
      this.state.manifest = (await request.json()) as ManifestRecord;
      return Response.json(this.state.manifest);
    }

    if (request.method === "PUT" && parts[0] === "keys" && parts[1]) {
      const record = (await request.json()) as ProviderKeyRecord;
      this.state.keys.set(parts[1], record);
      return Response.json(record);
    }

    if (request.method === "GET" && parts[0] === "keys" && parts[1]) {
      const record = this.state.keys.get(parts[1]);
      return record ? Response.json(record) : new Response("Not found", { status: 404 });
    }

    if (request.method === "PUT" && parts[0] === "jobs" && parts[1]) {
      const record = (await request.json()) as JobRecord;
      this.state.jobs.set(parts[1], record);
      return Response.json(record);
    }

    if (request.method === "GET" && parts[0] === "jobs" && parts[1]) {
      const record = this.state.jobs.get(parts[1]);
      return record ? Response.json(record) : new Response("Not found", { status: 404 });
    }

    if (request.method === "PATCH" && parts[0] === "jobs" && parts[1]) {
      const existing = this.state.jobs.get(parts[1]);
      if (!existing) {
        return new Response("Not found", { status: 404 });
      }
      const patch = (await request.json()) as Partial<JobRecord>;
      const merged = { ...existing, ...patch } satisfies JobRecord;
      this.state.jobs.set(parts[1], merged);
      return Response.json(merged);
    }

    return new Response("Not found", { status: 404 });
  }
}

class InMemoryDurableObjectNamespace {
  private readonly stub: InMemoryStateStub;

  constructor(state: StateStore) {
    this.stub = new InMemoryStateStub(state);
  }

  idFromName(name: string): string {
    return name;
  }

  get(): InMemoryStateStub {
    return this.stub;
  }
}

export function createTestEnv() {
  const state: StateStore = {
    manifest: buildManifest(),
    keys: new Map(),
    jobs: new Map(),
  };

  return {
    BORIS_BUCKET: new InMemoryR2Bucket() as unknown as R2Bucket,
    BORIS_BUCKET_NAME: "test-bucket",
    BORIS_STATE: new InMemoryDurableObjectNamespace(state) as unknown as DurableObjectNamespace,
    TRANSCRIPTION_QUEUE: new InMemoryQueue<QueueMessage>() as unknown as Queue<QueueMessage>,
    BORIS_API_TOKEN: "test-api-token",
    BORIS_OPERATOR_TOKEN: "test-operator-token",
    KEY_ENCRYPTION_SECRET: "test-encryption-secret",
    DEFAULT_OPENAI_TRANSCRIPTION_MODEL: "gpt-4o-mini-transcribe",
    CLOUDFLARE_ACCOUNT_ID: "test-account",
    R2_ACCESS_KEY_ID: "test-r2-key",
    R2_SECRET_ACCESS_KEY: "test-r2-secret",
  };
}

export async function seedSample(
  env: ReturnType<typeof createTestEnv>,
  key: string,
  path: string,
  contentType: string,
): Promise<void> {
  const bytes = await readFile(path);
  await env.BORIS_BUCKET.put(key, new Uint8Array(bytes), {
    httpMetadata: { contentType },
  });
}
