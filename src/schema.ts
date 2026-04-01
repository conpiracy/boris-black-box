import { z } from "zod";
import {
  DEFAULT_MAX_CHUNK_SECONDS,
  DEFAULT_PARALLELISM,
  DIRECT_UPLOAD_EXPIRY_SECONDS,
  MAX_PARALLELISM,
} from "./constants";

const targetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("url"),
    url: z.string().url(),
  }),
  z.object({
    type: z.literal("r2"),
    key: z.string().min(1),
  }),
]);

const chunkingSchema = z.object({
  mode: z.literal("mediabunny_segment").default("mediabunny_segment"),
  maxChunkSeconds: z.number().int().positive().max(600).default(DEFAULT_MAX_CHUNK_SECONDS),
  silenceAware: z.boolean().default(false),
});

export const transcriptionRequestSchema = z
  .object({
    transcriptionProvider: z.literal("openai"),
    transcriptionApiKey: z.string().min(10).optional(),
    transcriptionApiKeyRef: z.string().min(8).optional(),
    target: targetSchema,
    options: z
      .object({
        language: z.string().min(2).max(12).optional(),
        chunking: chunkingSchema.default({ mode: "mediabunny_segment", maxChunkSeconds: DEFAULT_MAX_CHUNK_SECONDS, silenceAware: false }),
        parallelism: z.number().int().positive().max(MAX_PARALLELISM).default(DEFAULT_PARALLELISM),
        returnFormat: z.enum(["segments+srt+json", "json"]).default("segments+srt+json"),
      })
      .default({
        chunking: {
          mode: "mediabunny_segment",
          maxChunkSeconds: DEFAULT_MAX_CHUNK_SECONDS,
          silenceAware: false,
        },
        parallelism: DEFAULT_PARALLELISM,
        returnFormat: "segments+srt+json",
      }),
  })
  .superRefine((value, ctx) => {
    if (!value.transcriptionApiKey && !value.transcriptionApiKeyRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either transcriptionApiKey or transcriptionApiKeyRef is required.",
        path: ["transcriptionApiKey"],
      });
    }
  });

export const bootstrapRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("store_transcription_key"),
    transcriptionProvider: z.literal("openai"),
    transcriptionApiKey: z.string().min(10),
    label: z.string().max(64).optional(),
  }),
  z.object({
    action: z.literal("create_upload"),
    fileName: z.string().min(1).max(256),
    contentType: z.string().min(3),
    expiresInSeconds: z.number().int().positive().max(DIRECT_UPLOAD_EXPIRY_SECONDS).default(DIRECT_UPLOAD_EXPIRY_SECONDS),
  }),
]);
