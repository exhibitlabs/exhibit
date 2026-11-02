import "server-only";
import type { AskEvent } from "./schema";

/**
 * Pulls the `text` field out of present_answer's tool input while it is still streaming as partial
 * JSON, so the prose reads out live. Works on raw API stream events from either provider.
 */
export function answerTextStreamer(emit: (e: AskEvent) => void, isAnswerTool: (name: string) => boolean) {
  let index = -1;
  let json = "";
  let sent = "";
  return (raw: unknown) => {
    const ev = raw as { type: string; index?: number; content_block?: { type: string; name?: string }; delta?: { type?: string; partial_json?: string } };
    if (ev.type === "content_block_start" && ev.content_block?.type === "tool_use" && isAnswerTool(ev.content_block.name ?? "")) {
      index = ev.index ?? -1;
      json = "";
      if (sent) emit({ t: "text_reset" });
      sent = "";
    } else if (ev.type === "content_block_delta" && ev.index === index && ev.delta?.type === "input_json_delta") {
      json += ev.delta.partial_json ?? "";
      const text = partialString(json, "text");
      if (text !== null && text.length > sent.length && text.startsWith(sent)) {
        emit({ t: "text", text: text.slice(sent.length) });
        sent = text;
      }
    }
  };
}

/** Decodes a (possibly unterminated) JSON string value for `key` from partial JSON. */
export function partialString(json: string, key: string): string | null {
  const m = new RegExp(`"${key}"\\s*:\\s*"`).exec(json);
  if (!m) return null;
  let out = "";
  for (let i = m.index + m[0].length; i < json.length; i++) {
    const ch = json[i];
    if (ch === '"') return out;
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const nx = json[i + 1];
    if (nx === undefined) return out;
    if (nx === "u") {
      const hex = json.slice(i + 2, i + 6);
      if (hex.length < 4) return out;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
      continue;
    }
    out += ({ n: "\n", t: "\t", r: "", b: "", f: "", '"': '"', "\\": "\\", "/": "/" } as Record<string, string>)[nx] ?? nx;
    i++;
  }
  return out;
}
