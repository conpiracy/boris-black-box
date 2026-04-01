import { AwsClient } from "aws4fetch";
import { Hono } from "hono";
import type { Context } from "hono";
import type { worker } from "../alchemy.run";
import { requireBearer } from "./auth";
import {
  CAPABILITY_NAME,
  DIRECT_UPLOAD_EXPIRY_SECONDS,
  MANIFEST_VERSION,
} from "./constants";
import { BorisState } from "./state-do";
import { buildBootstrapManifest, createJobFromRequest, createStoredProviderKey, processJobMessage } from "./jobs";
import { logError } from "./logger";
import { buildManifest } from "./manifest";
import { getJob, getManifest, putManifest } from "./state-client";
import { bootstrapRequestSchema } from "./schema";
import type { PublicJobRecord } from "./types";
import { assertMediaType, jsonResponse, nowIso, randomHex } from "./util";

type Env = typeof worker.Env;

const app = new Hono<{ Bindings: Env }>();

function toPublicJob(job: Awaited<ReturnType<typeof getJob>>): PublicJobRecord {
  return {
    ...job,
    request: {
      transcriptionProvider: job.request.transcriptionProvider,
      target: job.request.target,
      options: job.request.options,
    },
  };
}

function operatorGuard(c: Context<{ Bindings: Env }>): Response | null {
  return requireBearer(c, c.env.BORIS_OPERATOR_TOKEN);
}

function apiGuard(c: Context<{ Bindings: Env }>): Response | null {
  return requireBearer(c, c.env.BORIS_API_TOKEN);
}

app.post("/v1/bootstrap", async (c) => {
  const unauthorized = operatorGuard(c);
  if (unauthorized) {
    return unauthorized;
  }

  const payload = bootstrapRequestSchema.parse(await c.req.json());

  if (payload.action === "store_transcription_key") {
    const ref = await createStoredProviderKey(
      c.env,
      payload.transcriptionApiKey,
      payload.label,
    );
    return jsonResponse({
      transcriptionApiKeyRef: ref,
      createdAt: nowIso(),
      ...buildBootstrapManifest(),
    });
  }

  assertMediaType(payload.contentType);
  if (!c.env.R2_ACCESS_KEY_ID || !c.env.R2_SECRET_ACCESS_KEY || !c.env.CLOUDFLARE_ACCOUNT_ID) {
    return jsonResponse(
      {
        error: "Direct upload bootstrap is not configured on this deployment.",
      },
      { status: 501 },
    );
  }

  const key = `uploads/${randomHex(6)}-${payload.fileName}`;
  const client = new AwsClient({
    accessKeyId: c.env.R2_ACCESS_KEY_ID,
    secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
  });
  const url = new URL(
    `https://${c.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${c.env.BORIS_BUCKET_NAME}/${key}`,
  );
  url.searchParams.set("X-Amz-Expires", String(payload.expiresInSeconds ?? DIRECT_UPLOAD_EXPIRY_SECONDS));
  const signed = await client.sign(
    new Request(url.toString(), {
      method: "PUT",
      headers: {
        "content-type": payload.contentType,
      },
    }),
    {
      aws: { signQuery: true },
    },
  );

  return jsonResponse({
    uploadUrl: signed.url,
    expiresAt: new Date(
      Date.now() + (payload.expiresInSeconds ?? DIRECT_UPLOAD_EXPIRY_SECONDS) * 1000,
    ).toISOString(),
    target: {
      type: "r2",
      key,
    },
    manifestVersion: MANIFEST_VERSION,
  });
});

app.post("/v1/manifest/refresh", async (c) => {
  const unauthorized = operatorGuard(c);
  if (unauthorized) {
    return unauthorized;
  }

  const manifest = buildManifest();
  await putManifest(c.env, manifest);
  return jsonResponse(manifest);
});

app.post("/v1/transcriptions", async (c) => {
  const unauthorized = apiGuard(c);
  if (unauthorized) {
    return unauthorized;
  }

  const payload = await c.req.json();
  const job = await createJobFromRequest(c.env, payload);
  return jsonResponse(
    {
      id: job.id,
      capability: CAPABILITY_NAME,
      status: job.status,
      manifestVersion: MANIFEST_VERSION,
    },
    { status: 202 },
  );
});

app.get("/v1/transcriptions/:id", async (c) => {
  const unauthorized = apiGuard(c);
  if (unauthorized) {
    return unauthorized;
  }

  const job = await getJob(c.env, c.req.param("id"));
  return jsonResponse(toPublicJob(job));
});

app.get("/v1/transcriptions/:id/artifacts/:name", async (c) => {
  const unauthorized = apiGuard(c);
  if (unauthorized) {
    return unauthorized;
  }

  const object = await c.env.BORIS_BUCKET.get(
    `jobs/${c.req.param("id")}/artifacts/${c.req.param("name")}`,
  );
  if (!object) {
    return jsonResponse({ error: "Artifact not found" }, { status: 404 });
  }
  return new Response(object.body, {
    status: 200,
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
    },
  });
});

app.get("/healthz", async (c) => {
  const manifest = await getManifest(c.env).catch(() => buildManifest());
  return jsonResponse({
    ok: true,
    capability: CAPABILITY_NAME,
    manifestVersion: manifest.manifestVersion,
  });
});

export { BorisState };

export default {
  async fetch(request: Request, env: Env, executionContext: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, executionContext);
  },
  async queue(batch: MessageBatch<{ jobId: string }>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processJobMessage(env, message.body);
        message.ack();
      } catch (error) {
        logError("Queue message failed", {
          jobId: message.body.jobId,
          error: error instanceof Error ? error.message : String(error),
        });
        message.retry();
      }
    }
  },
};
