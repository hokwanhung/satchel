import { reportFileStem } from './report';

export interface MindMapNode {
  name: string;
  children: MindMapNode[];
}

interface LayoutNode {
  name: string;
  lines: string[];
  children: LayoutNode[];
  width: number;
  height: number;
  x: number;
  y: number;
}

const LINE_H = 16;
const PAD_X = 10;
const PAD_Y = 7;
const RANK_GAP = 56;
const SIB_GAP = 14;
const MAX_LINE_UNITS = 32;
const ASCII_W = 7.4;
const WIDE_W = 12.4;
const TOGGLE_R = 7;
const MARGIN = 24;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return '';
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function looksLikeHierarchy(record: Record<string, unknown>): boolean {
  if (!('data' in record)) return false;
  return (
    record.parent !== undefined ||
    typeof record.depth === 'number' ||
    typeof record.height === 'number'
  );
}

function childList(record: Record<string, unknown>): unknown[] {
  const kids = Array.isArray(record.children) ? record.children : [];
  if (kids.length > 0) return kids;
  if (Array.isArray(record._children) && record._children.length > 0) return record._children;
  if (Array.isArray(record.nodes)) return record.nodes;
  return kids;
}

function hasTreeKeys(record: Record<string, unknown>): boolean {
  return 'children' in record || '_children' in record || 'nodes' in record;
}

function walkToRoot(value: unknown): unknown {
  let current = value;
  const seen = new Set<object>();
  while (true) {
    const record = asRecord(current);
    if (!record || seen.has(record)) return current;
    seen.add(record);
    if (!('parent' in record) || record.parent == null) return current;
    current = record.parent;
  }
}

function normalize(value: unknown, seen: WeakSet<object>, unwrap: boolean): MindMapNode | null {
  const parsed = parseMaybeJson(value);
  const record = asRecord(parsed);
  if (!record || seen.has(record)) return null;
  seen.add(record);

  if (looksLikeHierarchy(record)) {
    const data = asRecord(record.data) ?? record;
    const name = stringField(data, 'name', 'label', 'text', 'title');
    const children = childList(record).flatMap((child) => {
      const node = normalize(child, seen, false);
      return node ? [node] : [];
    });
    if (name.length > 0 || children.length > 0) {
      return { name, children };
    }
  }

  const name = stringField(record, 'name', 'label', 'text', 'title');
  if (hasTreeKeys(record)) {
    const children = childList(record).flatMap((child) => {
      const node = normalize(child, seen, false);
      return node ? [node] : [];
    });
    if (name.length > 0 || children.length > 0) {
      return { name, children };
    }
  }

  if (!unwrap && name.length > 0) {
    return { name, children: [] };
  }

  if (!unwrap) return null;

  for (const key of ['mind_map', 'mindMap', 'tree', 'root', 'data']) {
    if (!(key in record)) continue;
    const inner = normalize(record[key], seen, false);
    if (inner) return inner;
  }

  return null;
}

export function parseMindMap(raw: unknown): MindMapNode | null {
  const fromRoot = normalize(walkToRoot(raw), new WeakSet<object>(), true);
  if (fromRoot) return fromRoot;
  return normalize(raw, new WeakSet<object>(), true);
}

export function countMindMapNodes(node: MindMapNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countMindMapNodes(child), 0);
}

export function collectMindMapNames(node: MindMapNode): string[] {
  return [node.name, ...node.children.flatMap(collectMindMapNames)];
}

export function mindMapFileStem(node: MindMapNode): string {
  const stem = reportFileStem(node.name);
  if (stem === 'Report' && node.name.trim().length === 0) return 'Mind map';
  return stem;
}

function charUnits(text: string): number {
  let units = 0;
  for (const char of text) {
    units += char.charCodeAt(0) > 127 ? 1.7 : 1;
  }
  return units;
}

function wrapLabel(name: string): string[] {
  const source = name.length > 0 ? name : ' ';
  const words = source.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  const pushChunks = (word: string) => {
    if (charUnits(word) <= MAX_LINE_UNITS) {
      lines.push(word);
      return;
    }
    let chunk = '';
    for (const char of word) {
      if (chunk && charUnits(chunk + char) > MAX_LINE_UNITS) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk += char;
      }
    }
    if (chunk) lines.push(chunk);
  };

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (charUnits(next) <= MAX_LINE_UNITS) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = '';
    if (charUnits(word) <= MAX_LINE_UNITS) {
      current = word;
    } else {
      pushChunks(word);
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [' '];
}

function lineWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += char.charCodeAt(0) > 127 ? WIDE_W : ASCII_W;
  }
  return width;
}

function measure(name: string): { lines: string[]; width: number; height: number } {
  const lines = wrapLabel(name);
  const textW = Math.max(...lines.map(lineWidth));
  return {
    lines,
    width: Math.ceil(textW + PAD_X * 2),
    height: Math.ceil(lines.length * LINE_H + PAD_Y * 2),
  };
}

function subtreeHeight(node: LayoutNode): number {
  if (node.children.length === 0) return node.height;
  const kids =
    node.children.reduce((sum, child) => sum + subtreeHeight(child), 0) +
    SIB_GAP * (node.children.length - 1);
  return Math.max(node.height, kids);
}

function buildLayout(node: MindMapNode): LayoutNode {
  const size = measure(node.name);
  return {
    name: node.name,
    lines: size.lines,
    children: node.children.map(buildLayout),
    width: size.width,
    height: size.height,
    x: 0,
    y: 0,
  };
}

function place(node: LayoutNode, x: number, yTop: number): void {
  const height = subtreeHeight(node);
  node.x = x;
  node.y = yTop + (height - node.height) / 2;
  if (node.children.length === 0) return;

  const kidsHeight =
    node.children.reduce((sum, child) => sum + subtreeHeight(child), 0) +
    SIB_GAP * (node.children.length - 1);
  let cursor = yTop + Math.max(0, (height - kidsHeight) / 2);
  const nextX = x + node.width + RANK_GAP;
  for (const child of node.children) {
    place(child, nextX, cursor);
    cursor += subtreeHeight(child) + SIB_GAP;
  }
}

function bounds(node: LayoutNode, box = { minX: 0, minY: 0, maxX: 0, maxY: 0 }): typeof box {
  box.minX = Math.min(box.minX, node.x);
  box.minY = Math.min(box.minY, node.y);
  box.maxX = Math.max(box.maxX, node.x + node.width);
  box.maxY = Math.max(box.maxY, node.y + node.height);
  for (const child of node.children) bounds(child, box);
  return box;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function linkPath(parent: LayoutNode, child: LayoutNode): string {
  const x1 = parent.x + parent.width;
  const y1 = parent.y + parent.height / 2;
  const x2 = child.x;
  const y2 = child.y + child.height / 2;
  const mid = (x1 + x2) / 2;
  return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
}

function renderNode(node: LayoutNode, isRoot: boolean, interactive: boolean): string {
  const className = isRoot ? 'n root' : 'n';
  const textX = node.x + PAD_X;
  const textClass = isRoot ? ' class="root-label"' : '';
  const textParts = node.lines.map((line, index) => {
    const dy = index === 0 ? 0 : LINE_H;
    return `<tspan x="${textX}" dy="${dy}">${escapeXml(line)}</tspan>`;
  });
  const baseline = node.y + PAD_Y + 12;
  const toggle =
    interactive && node.children.length > 0
      ? `<g data-satchel-toggle="1" class="toggle" transform="translate(${node.x + node.width},${node.y + node.height / 2})">
          <circle r="${TOGGLE_R}" />
          <text text-anchor="middle" dy="4">−</text>
        </g>`
      : '';
  const kids =
    node.children.length > 0
      ? `<g data-satchel-kids="1">${node.children
          .map((child) => {
            const path = `<path class="l" d="${linkPath(node, child)}" />`;
            return `${path}${renderNode(child, false, interactive)}`;
          })
          .join('')}</g>`
      : '';

  return `<g data-satchel-node="1">
    <rect class="${className}" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="10" />
    <text${textClass} x="${textX}" y="${baseline}">${textParts.join('')}</text>
    ${toggle}
    ${kids}
  </g>`;
}

function layoutRoot(node: MindMapNode): { root: LayoutNode; width: number; height: number } {
  const root = buildLayout(node);
  place(root, 0, 0);
  const box = bounds(root);
  const shiftX = MARGIN - box.minX;
  const shiftY = MARGIN - box.minY;
  function shift(item: LayoutNode) {
    item.x += shiftX;
    item.y += shiftY;
    item.children.forEach(shift);
  }
  shift(root);
  return {
    root,
    width: box.maxX - box.minX + MARGIN * 2,
    height: box.maxY - box.minY + MARGIN * 2,
  };
}

function svgCss(): string {
  return `.n{fill:#eef6f1;stroke:#1b3a2f;stroke-width:1.25}
.root{fill:#1b3a2f}
text{font:13px "Google Sans",system-ui,sans-serif;fill:#133226}
.root-label{fill:#f4fff8}
.l{fill:none;stroke:#8aa896;stroke-width:1.6}
.toggle{cursor:pointer}
.toggle circle{fill:#d8f3dc;stroke:#1b3a2f;stroke-width:1.2}
.toggle text{font:12px system-ui,sans-serif;fill:#133226}`;
}

export function mindMapToSvg(node: MindMapNode, interactive = false): string {
  const { root, width, height } = layoutRoot(node);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <style>${svgCss()}</style>
  ${renderNode(root, true, interactive)}
</svg>`;
}

export function mindMapToHtml(node: MindMapNode): string {
  const title = escapeXml(node.name || 'Mind map');
  const svg = mindMapToSvg(node, true).replace(/^<\?xml[^>]*>\s*/, '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    html, body { margin: 0; height: 100%; background: #f4faf6; }
    #hint {
      position: fixed; top: 12px; left: 12px; z-index: 2;
      font: 13px "Google Sans", system-ui, sans-serif; color: #133226;
      background: #d8f3dc; border-radius: 999px; padding: 6px 12px;
    }
    #viewport { width: 100%; height: 100%; overflow: hidden; cursor: grab; }
    #viewport.drag { cursor: grabbing; }
    #canvas { transform-origin: 0 0; }
  </style>
</head>
<body>
  <div id="hint">Drag to pan, scroll to zoom, click − to fold a branch</div>
  <div id="viewport"><div id="canvas">${svg}</div></div>
  <script>
    (function () {
      var viewport = document.getElementById('viewport');
      var canvas = document.getElementById('canvas');
      var scale = 1, x = 16, y = 48, dragging = false, lx = 0, ly = 0;
      function apply() {
        canvas.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
      }
      apply();
      viewport.addEventListener('pointerdown', function (event) {
        if (event.target.closest && event.target.closest('[data-satchel-toggle]')) return;
        dragging = true;
        lx = event.clientX;
        ly = event.clientY;
        viewport.classList.add('drag');
        viewport.setPointerCapture(event.pointerId);
      });
      viewport.addEventListener('pointermove', function (event) {
        if (!dragging) return;
        x += event.clientX - lx;
        y += event.clientY - ly;
        lx = event.clientX;
        ly = event.clientY;
        apply();
      });
      function stop() {
        dragging = false;
        viewport.classList.remove('drag');
      }
      viewport.addEventListener('pointerup', stop);
      viewport.addEventListener('pointercancel', stop);
      viewport.addEventListener('wheel', function (event) {
        event.preventDefault();
        var factor = event.deltaY < 0 ? 1.08 : 0.92;
        scale = Math.min(3, Math.max(0.2, scale * factor));
        apply();
      }, { passive: false });
      canvas.addEventListener('click', function (event) {
        var toggle = event.target.closest('[data-satchel-toggle]');
        if (!toggle) return;
        event.preventDefault();
        event.stopPropagation();
        var group = toggle.closest('[data-satchel-node]');
        var kids = group && group.querySelector(':scope > [data-satchel-kids]');
        if (!kids) return;
        var hidden = kids.style.display === 'none';
        kids.style.display = hidden ? '' : 'none';
        var label = toggle.querySelector('text');
        if (label) label.textContent = hidden ? '\\u2212' : '+';
      });
    })();
  </script>
</body>
</html>`;
}

export function createMindMapHtmlBlob(node: MindMapNode): Blob {
  return new Blob([mindMapToHtml(node)], { type: 'text/html;charset=utf-8' });
}

export function createMindMapSvgBlob(node: MindMapNode): Blob {
  return new Blob([mindMapToSvg(node)], { type: 'image/svg+xml;charset=utf-8' });
}
