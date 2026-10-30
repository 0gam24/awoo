/**
 * 사이트 아이콘 생성 — 네이버 파비콘 가이드(04-HTML 마크업/04) 대응(2026-10-30).
 * 예전 favicon.svg는 <text>에 Pretendard를 써서 글꼴 없는 렌더러에선 글자가 빠졌고,
 * PNG 아이콘은 64px 글자 없는 사각형이었다. satori로 '지'를 외곽선(path)으로 바꾼 SVG와
 * 180/192/512 PNG, 16·32·48 favicon.ico를 만든다. 사용: node scripts/generate-icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const font = await readFile(`${ROOT}/assets/fonts/Pretendard-Bold.otf`);

const svg = await satori(
  {
    type: 'div',
    props: {
      style: {
        width: 64,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0071e3',
        borderRadius: 14,
        color: '#ffffff',
        fontSize: 38,
        fontWeight: 700,
        fontFamily: 'Pretendard',
        lineHeight: 1,
      },
      children: '지',
    },
  },
  {
    width: 64,
    height: 64,
    fonts: [{ name: 'Pretendard', data: font, weight: 700, style: 'normal' }],
  },
);
if (/<text/.test(svg)) throw new Error('text 요소가 남았다');
await writeFile(`${ROOT}/public/favicon.svg`, `${svg}\n`);

const pngs = {};
for (const size of [16, 32, 48, 180, 192, 512]) {
  pngs[size] = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}
await writeFile(`${ROOT}/public/apple-touch-icon.png`, pngs[180]);
await writeFile(`${ROOT}/public/icon-192.png`, pngs[192]);
await writeFile(`${ROOT}/public/icon-512.png`, pngs[512]);

// ICO(PNG 내장) — 16·32·48
const sizes = [16, 32, 48];
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((sz, i) => {
  const b = 6 + i * 16;
  header.writeUInt8(sz, b);
  header.writeUInt8(sz, b + 1);
  header.writeUInt8(0, b + 2);
  header.writeUInt8(0, b + 3);
  header.writeUInt16LE(1, b + 4);
  header.writeUInt16LE(32, b + 6);
  header.writeUInt32LE(pngs[sz].length, b + 8);
  header.writeUInt32LE(offset, b + 12);
  offset += pngs[sz].length;
});
await writeFile(
  `${ROOT}/public/favicon.ico`,
  Buffer.concat([header, ...sizes.map((s) => pngs[s])]),
);

for (const f of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
  const m = await sharp(`${ROOT}/public/${f}`).metadata();
  const st = await sharp(`${ROOT}/public/${f}`).stats();
  console.log(
    f,
    m.width,
    m.height,
    'channels std',
    st.channels.map((c) => c.stdev.toFixed(1)).join(','),
  );
}
console.log('svg bytes', svg.length);
