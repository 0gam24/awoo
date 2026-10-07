#!/usr/bin/env node
/**
 * hwp-text — 한글(HWP 5) 파일에서 본문 글자만 뽑는다. 의존성 없음(OLE 복합 문서·zlib 직접 해석).
 *
 * 왜: 지자체·공단 공고는 금액·기한이 HWP 첨부에만 있는 경우가 많다. 2026-10-08 0400 자동 발행이
 * 희망리턴패키지 공고 금액을 첨부에서 못 읽어 발행 0건으로 끝났다. 표는 칸마다 한 줄씩 나온다.
 *
 * 사용:
 *   curl -sL -o 공고.hwp "<첨부 내려받기 주소>"
 *   node scripts/hwp-text.mjs 공고.hwp 공고.txt     # 두 번째 인자를 빼면 화면에 출력
 * HWPX(.hwpx)는 zip이라 이 도구 대상이 아니다 — unzip 후 Contents/section*.xml을 읽는다.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

const buf = fs.readFileSync(process.argv[2]);

const secShift = buf.readUInt16LE(30);
const miniShift = buf.readUInt16LE(32);
const SEC = 1 << secShift;
const MINI = 1 << miniShift;
const numFat = buf.readUInt32LE(44);
const dirStart = buf.readInt32LE(48);
const miniCutoff = buf.readUInt32LE(56);
const miniFatStart = buf.readInt32LE(60);
const numMiniFat = buf.readUInt32LE(64);
const difatStart = buf.readInt32LE(68);
const numDifat = buf.readUInt32LE(72);
const secOff = (s) => 512 + s * SEC;

// DIFAT → FAT 섹터 목록
const fatSecs = [];
for (let i = 0; i < 109 && fatSecs.length < numFat; i++) {
  const v = buf.readInt32LE(76 + i * 4);
  if (v >= 0) fatSecs.push(v);
}
let d = difatStart;
for (let k = 0; k < numDifat && d >= 0; k++) {
  const o = secOff(d);
  for (let i = 0; i < SEC / 4 - 1 && fatSecs.length < numFat; i++) {
    const v = buf.readInt32LE(o + i * 4);
    if (v >= 0) fatSecs.push(v);
  }
  d = buf.readInt32LE(o + SEC - 4);
}
const fat = [];
for (const s of fatSecs)
  for (let i = 0; i < SEC / 4; i++) fat.push(buf.readInt32LE(secOff(s) + i * 4));
const chain = (start, table) => {
  const out = [];
  for (let s = start; s >= 0 && out.length < 1e6; s = table[s]) out.push(s);
  return out;
};
const readBig = (start, size) =>
  Buffer.concat(chain(start, fat).map((s) => buf.subarray(secOff(s), secOff(s) + SEC))).subarray(
    0,
    size,
  );

// 디렉터리
const dirBuf = Buffer.concat(
  chain(dirStart, fat).map((s) => buf.subarray(secOff(s), secOff(s) + SEC)),
);
const entries = [];
for (let o = 0; o + 128 <= dirBuf.length; o += 128) {
  const nameLen = dirBuf.readUInt16LE(o + 64);
  const name = dirBuf.subarray(o, o + Math.max(0, nameLen - 2)).toString('utf16le');
  entries.push({
    name,
    type: dirBuf[o + 66],
    left: dirBuf.readInt32LE(o + 68),
    right: dirBuf.readInt32LE(o + 72),
    child: dirBuf.readInt32LE(o + 76),
    start: dirBuf.readInt32LE(o + 116),
    size: dirBuf.readUInt32LE(o + 120),
  });
}
const root = entries[0];
const miniStream = readBig(root.start, root.size);
const miniFat = [];
if (numMiniFat > 0)
  for (const s of chain(miniFatStart, fat))
    for (let i = 0; i < SEC / 4; i++) miniFat.push(buf.readInt32LE(secOff(s) + i * 4));
const readStream = (e) =>
  e.size < miniCutoff
    ? Buffer.concat(
        chain(e.start, miniFat).map((s) => miniStream.subarray(s * MINI, s * MINI + MINI)),
      ).subarray(0, e.size)
    : readBig(e.start, e.size);

// 트리에서 경로 찾기
const childrenOf = (idx) => {
  const out = [];
  const walk = (i) => {
    if (i < 0 || i >= entries.length) return;
    out.push(i);
    walk(entries[i].left);
    walk(entries[i].right);
  };
  walk(entries[idx].child);
  return out;
};
const find = (parentIdx, name) => childrenOf(parentIdx).find((i) => entries[i].name === name);
const fh = readStream(entries[find(0, 'FileHeader')]);
const compressed = (fh.readUInt32LE(36) & 1) === 1;
const bodyIdx = find(0, 'BodyText');
const sections = childrenOf(bodyIdx)
  .filter((i) => /^Section\d+$/.test(entries[i].name))
  .sort((a, b) => Number(entries[a].name.slice(7)) - Number(entries[b].name.slice(7)));

const CHAR_CTRL = new Set([0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31]);
const lines = [];
for (const si of sections) {
  let data = readStream(entries[si]);
  if (compressed) data = zlib.inflateRawSync(data);
  let o = 0;
  while (o + 4 <= data.length) {
    const h = data.readUInt32LE(o);
    const tag = h & 0x3ff;
    let size = (h >>> 20) & 0xfff;
    o += 4;
    if (size === 0xfff) {
      size = data.readUInt32LE(o);
      o += 4;
    }
    if (tag === 67) {
      let s = '';
      let p = o;
      const end = o + size;
      while (p + 2 <= end) {
        const c = data.readUInt16LE(p);
        if (c < 32) {
          if (CHAR_CTRL.has(c)) {
            if (c === 10 || c === 13) s += '\n';
            p += 2;
          } else p += 16;
        } else {
          s += String.fromCharCode(c);
          p += 2;
        }
      }
      const t = s.replace(/\s+$/g, '');
      if (t.trim()) lines.push(t);
    }
    o += size;
  }
}
if (process.argv[3]) {
  fs.writeFileSync(process.argv[3], lines.join('\n'));
  console.error(`[hwp-text] 구역 ${sections.length} · 줄 ${lines.length} → ${process.argv[3]}`);
} else process.stdout.write(`${lines.join('\n')}\n`);
