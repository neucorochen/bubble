const signatures = {
  wOF2: { extension: "woff2", mime: "font/woff2", header: 48 },
  wOFF: { extension: "woff", mime: "font/woff", header: 44 },
  OTTO: { extension: "otf", mime: "font/otf", header: 12 },
  "\x00\x01\x00\x00": { extension: "ttf", mime: "font/ttf", header: 12 },
} as const;

export function detectFontType(buffer: Buffer) {
  const signature = buffer.toString("latin1", 0, 4);
  if (!Object.hasOwn(signatures, signature)) return null;
  const format = signatures[signature as keyof typeof signatures];
  if (buffer.length <= format.header) return null;
  if (signature === "wOF2" || signature === "wOFF") {
    if (buffer.readUInt32BE(8) !== buffer.length || buffer.readUInt16BE(12) === 0) return null;
  } else if (!buffer.readUInt16BE(4) || 12 + buffer.readUInt16BE(4) * 16 > buffer.length) {
    return null;
  }
  return format;
}
