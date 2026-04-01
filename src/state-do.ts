import { DurableObject } from "cloudflare:workers";
import { buildManifest } from "./manifest";
import type { JobRecord, ManifestRecord, ProviderKeyRecord } from "./types";

export class BorisState extends DurableObject {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (request.method === "GET" && url.pathname === "/manifest") {
      const manifest = (await this.ctx.storage.get<ManifestRecord>("manifest")) ?? buildManifest();
      return Response.json(manifest);
    }

    if (request.method === "PUT" && url.pathname === "/manifest") {
      const manifest = (await request.json()) as ManifestRecord;
      await this.ctx.storage.put("manifest", manifest);
      return Response.json(manifest);
    }

    if (request.method === "PUT" && parts[0] === "keys" && parts[1]) {
      const payload = (await request.json()) as ProviderKeyRecord;
      await this.ctx.storage.put(`key:${parts[1]}`, payload);
      return Response.json(payload);
    }

    if (request.method === "GET" && parts[0] === "keys" && parts[1]) {
      const record = await this.ctx.storage.get<ProviderKeyRecord>(`key:${parts[1]}`);
      if (!record) {
        return new Response("Not found", { status: 404 });
      }
      return Response.json(record);
    }

    if (request.method === "PUT" && parts[0] === "jobs" && parts[1]) {
      const payload = (await request.json()) as JobRecord;
      await this.ctx.storage.put(`job:${parts[1]}`, payload);
      return Response.json(payload);
    }

    if (request.method === "GET" && parts[0] === "jobs" && parts[1]) {
      const record = await this.ctx.storage.get<JobRecord>(`job:${parts[1]}`);
      if (!record) {
        return new Response("Not found", { status: 404 });
      }
      return Response.json(record);
    }

    if (request.method === "PATCH" && parts[0] === "jobs" && parts[1]) {
      const existing = await this.ctx.storage.get<JobRecord>(`job:${parts[1]}`);
      if (!existing) {
        return new Response("Not found", { status: 404 });
      }
      const patch = (await request.json()) as Partial<JobRecord>;
      const merged = { ...existing, ...patch } satisfies JobRecord;
      await this.ctx.storage.put(`job:${parts[1]}`, merged);
      return Response.json(merged);
    }

    return new Response("Not found", { status: 404 });
  }
}
