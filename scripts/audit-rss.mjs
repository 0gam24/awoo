#!/usr/bin/env node
// audit-rss.mjs — dist/ RSS feed 무결성 검증 (Cycle #5 P0-8)
//
// 검증:
//   - feed.xml / feed-issues.xml 존재
//   - <?xml version 선언
//   - <rss version + xmlns:atom + xmlns:dc 선언 (Cycle #4 P0-5 dc:creator 추가 효과)
//   - <atom:updated> ISO 8601 형식
//   - 각 <item>에 title·link·pubDate·guid 필수 필드 존재
//
// 출력: stdout JSON, 위반 시 exit 1

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const HTML_ROOT = existsSync(path.join(DIST, 'client')) ? path.join(DIST, 'client') : DIST;

if (!existsSync(HTML_ROOT)) {
  console.error('[audit-rss] dist/ 미발견');
  process.exit(0);
}

const feeds = [
  { name: 'feed.xml', path: path.join(HTML_ROOT, 'feed.xml') },
  { name: 'feed-issues.xml', path: path.join(HTML_ROOT, 'feed-issues.xml') },
];

const violations = [];
const summaries = [];

for (const feed of feeds) {
  if (!existsSync(feed.path)) {
    violations.push({ feed: feed.name, issue: 'file_missing' });
    continue;
  }
  const xml = readFileSync(feed.path, 'utf8');

  // XML 선언
  if (!xml.startsWith('<?xml')) {
    violations.push({ feed: feed.name, issue: 'no_xml_declaration' });
  }
  // RSS 버전
  if (!/<rss\s+version=("|')2\.0\1/.test(xml)) {
    violations.push({ feed: feed.name, issue: 'no_rss_2_version' });
  }
  // atom namespace
  if (!/xmlns:atom=("|')http:\/\/www\.w3\.org\/2005\/Atom\1/.test(xml)) {
    violations.push({ feed: feed.name, issue: 'no_atom_namespace' });
  }
  // dc namespace (Cycle #4 P0-5)
  if (!/xmlns:dc=("|')http:\/\/purl\.org\/dc\/elements\/1\.1\/\1/.test(xml)) {
    violations.push({ feed: feed.name, issue: 'no_dc_namespace' });
  }
  // atom:updated ISO 8601
  const atomUpdatedMatch = xml.match(/<atom:updated>([^<]+)<\/atom:updated>/);
  if (!atomUpdatedMatch) {
    violations.push({ feed: feed.name, issue: 'no_atom_updated' });
  } else {
    const ts = atomUpdatedMatch[1];
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(ts)) {
      violations.push({ feed: feed.name, issue: 'atom_updated_invalid_iso8601', value: ts });
    }
  }

  // <item> 카운트
  const items = xml.match(/<item>/g) ?? [];
  // <item> 필수 필드 sample 검증 (첫 5개)
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let itemIdx = 0;
  for (const m of xml.matchAll(itemRe)) {
    if (itemIdx >= 5) break;
    const body = m[1];
    if (!/<title>/.test(body)) violations.push({ feed: feed.name, issue: 'item_no_title', index: itemIdx });
    if (!/<link>/.test(body)) violations.push({ feed: feed.name, issue: 'item_no_link', index: itemIdx });
    if (!/<pubDate>/.test(body)) violations.push({ feed: feed.name, issue: 'item_no_pubDate', index: itemIdx });
    if (!/<guid/.test(body)) violations.push({ feed: feed.name, issue: 'item_no_guid', index: itemIdx });
    itemIdx++;
  }

  summaries.push({
    name: feed.name,
    bytes: Buffer.byteLength(xml, 'utf8'),
    items: items.length,
  });
}

const result = {
  generated_at: new Date().toISOString(),
  feeds: summaries,
  violations_count: violations.length,
  violations,
};

console.log(JSON.stringify(result, null, 2));
process.exit(violations.length > 0 ? 1 : 0);
