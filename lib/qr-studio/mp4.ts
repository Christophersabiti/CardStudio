// Bounded ISO-BMFF inspection. Only conventional, non-fragmented H.264/AAC MP4
// is accepted; unsupported layouts are rejected instead of guessed.
export function inspectMp4(bytes: Buffer) {
  type Box = { type: string; start: number; end: number };
  function boxes(start: number, end: number): Box[] {
    const out: Box[] = [];
    while (start < end) {
      if (start + 8 > end) throw Error("Invalid MP4 box");
      let size = bytes.readUInt32BE(start),
        header = 8;
      const type = bytes.toString("ascii", start + 4, start + 8);
      if (size === 1) {
        if (start + 16 > end) throw Error("Invalid MP4 size");
        const n = bytes.readBigUInt64BE(start + 8);
        if (n > BigInt(bytes.length)) throw Error("Invalid MP4 size");
        size = Number(n);
        header = 16;
      }
      if (size === 0) size = end - start;
      if (size < header || start + size > end) throw Error("Invalid MP4 size");
      out.push({ type, start: start + header, end: start + size });
      start += size;
      if (out.length > 10000) throw Error("Too many MP4 boxes");
    }
    return out;
  }
  const roots = boxes(0, bytes.length);
  const moov = roots.find((b) => b.type === "moov");
  if (
    !moov ||
    !roots.some((b) => b.type === "ftyp") ||
    !roots.some((b) => b.type === "mdat") ||
    roots.some((b) => b.type === "moof")
  )
    throw Error("Use a standard MP4 file");
  const children = boxes(moov.start, moov.end);
  const mvhd = children.find((b) => b.type === "mvhd");
  if (!mvhd) throw Error("Missing video duration");
  const version = bytes[mvhd.start];
  if (
    ![0, 1].includes(version) ||
    mvhd.end - mvhd.start < (version === 1 ? 32 : 20)
  )
    throw Error("Invalid video duration");
  const scale = bytes.readUInt32BE(mvhd.start + (version === 1 ? 20 : 12));
  const duration =
    version === 1
      ? Number(bytes.readBigUInt64BE(mvhd.start + 24))
      : bytes.readUInt32BE(mvhd.start + 16);
  const seconds = duration / scale;
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 300)
    throw Error("Video must be five minutes or less");
  let hasVideo = false;
  for (const trak of children.filter((b) => b.type === "trak")) {
    const mdia = boxes(trak.start, trak.end).find((b) => b.type === "mdia");
    if (!mdia) throw Error("Invalid track");
    const parts = boxes(mdia.start, mdia.end),
      hdlr = parts.find((b) => b.type === "hdlr"),
      minf = parts.find((b) => b.type === "minf");
    if (!hdlr || hdlr.end - hdlr.start < 12 || !minf)
      throw Error("Invalid track");
    const kind = bytes.toString("ascii", hdlr.start + 8, hdlr.start + 12);
    if (!["vide", "soun"].includes(kind))
      throw Error("Unsupported video track");
    const stbl = boxes(minf.start, minf.end).find((b) => b.type === "stbl");
    const stsd =
      stbl && boxes(stbl.start, stbl.end).find((b) => b.type === "stsd");
    if (!stsd || stsd.end - stsd.start < 8) throw Error("Missing codec");
    const entries = boxes(stsd.start + 8, stsd.end);
    if (
      entries.length !== 1 ||
      entries[0].type !== (kind === "vide" ? "avc1" : "mp4a")
    )
      throw Error("Use H.264 video with AAC audio");
    if (kind === "vide") hasVideo = true;
  }
  if (!hasVideo) throw Error("No H.264 video track found");
  return { duration: seconds };
}
