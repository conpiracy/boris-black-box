import { Mp3OutputFormat, Mp4OutputFormat } from "mediabunny";
import type { OutputFormat } from "mediabunny";
import { PROVEN_AUDIO_CODECS } from "../constants";

export type SupportedPacketCodec = (typeof PROVEN_AUDIO_CODECS)[number];

export type OutputDescriptor = {
  codec: SupportedPacketCodec;
  format: OutputFormat;
  fileExtension: string;
  contentType: string;
};

export function getOutputDescriptor(codec: string): OutputDescriptor {
  switch (codec) {
    case "aac":
      return {
        codec: "aac",
        format: new Mp4OutputFormat(),
        fileExtension: ".mp4",
        contentType: "audio/mp4",
      };
    case "mp3":
      return {
        codec: "mp3",
        format: new Mp3OutputFormat(),
        fileExtension: ".mp3",
        contentType: "audio/mpeg",
      };
    default:
      throw new Error(`Codec ${codec} is outside the proven MediaBunny packet-copy matrix.`);
  }
}
