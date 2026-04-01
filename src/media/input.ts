import { Input, StreamSource, UrlSource, ALL_FORMATS } from "mediabunny";
import type { TargetRef } from "../types";

type EnvWithBucket = {
  BORIS_BUCKET: R2Bucket;
};

export async function openMediaInput(target: TargetRef, env: EnvWithBucket): Promise<Input> {
  if (target.type === "url") {
    return new Input({
      formats: ALL_FORMATS,
      source: new UrlSource(target.url),
    });
  }

  const head = await env.BORIS_BUCKET.head(target.key);
  if (!head || typeof head.size !== "number") {
    throw new Error(`R2 object not found: ${target.key}`);
  }

  const source = new StreamSource({
    getSize: () => head.size,
    prefetchProfile: "network",
    read: async (start, end) => {
      const object = await env.BORIS_BUCKET.get(target.key, {
        range: {
          offset: start,
          length: end - start,
        },
      });
      if (!object) {
        throw new Error(`Failed to read R2 object: ${target.key}`);
      }
      const bytes = await object.arrayBuffer();
      return new Uint8Array(bytes);
    },
  });

  return new Input({
    formats: ALL_FORMATS,
    source,
  });
}
