import { describe, expect, it } from 'vitest';
import { parseAppData } from '../lib/extract';
import {
  collectMindMapNames,
  countMindMapNodes,
  mindMapFileStem,
  mindMapToHtml,
  mindMapToSvg,
  parseMindMap,
} from '../lib/mindmap';

const tree = {
  name: 'Root Topic',
  children: [
    {
      name: 'Visible',
      children: [{ name: 'Leaf A' }],
    },
    {
      name: 'Collapsed',
      children: [],
      _children: [{ name: 'Hidden leaf' }],
    },
  ],
};

describe('parseMindMap', () => {
  it('reads name/children trees', () => {
    const node = parseMindMap({
      name: 'Root',
      children: [{ name: 'Child' }, { label: 'Other' }],
    });
    expect(node).toEqual({
      name: 'Root',
      children: [
        { name: 'Child', children: [] },
        { name: 'Other', children: [] },
      ],
    });
  });

  it('reads nodes aliases', () => {
    const node = parseMindMap({
      title: 'Root',
      nodes: [{ text: 'A' }, { name: 'B', nodes: [{ name: 'C' }] }],
    });
    expect(collectMindMapNames(node!)).toEqual(['Root', 'A', 'B', 'C']);
  });

  it('includes collapsed _children when children is empty', () => {
    const node = parseMindMap(tree);
    expect(collectMindMapNames(node!)).toEqual([
      'Root Topic',
      'Visible',
      'Leaf A',
      'Collapsed',
      'Hidden leaf',
    ]);
    expect(countMindMapNodes(node!)).toBe(5);
  });

  it('unwraps nested mind_map / tree payloads', () => {
    const node = parseMindMap({
      mind_map: JSON.stringify({ name: 'Wrapped', children: [{ name: 'Inner' }] }),
    });
    expect(node).toEqual({
      name: 'Wrapped',
      children: [{ name: 'Inner', children: [] }],
    });
  });

  it('walks D3 hierarchy parents and collapsed _children', () => {
    const leaf: Record<string, unknown> = {
      data: { name: 'Leaf' },
      depth: 2,
      children: [],
    };
    const branch: Record<string, unknown> = {
      data: { name: 'Branch' },
      depth: 1,
      children: [],
      _children: [leaf],
    };
    const root: Record<string, unknown> = {
      data: { name: 'Root' },
      depth: 0,
      parent: null,
      children: [],
      _children: [branch],
    };
    leaf.parent = branch;
    branch.parent = root;

    const node = parseMindMap(leaf);
    expect(collectMindMapNames(node!)).toEqual(['Root', 'Branch', 'Leaf']);
  });
});

describe('parseAppData mind maps', () => {
  it('decodes HTML entities in mind map payloads', () => {
    const result = parseAppData('{"name":"A &amp; B","children":[{"name":"C"}]}');
    expect(result?.kind).toBe('mindmap');
    expect(result?.mindMap).toEqual({
      name: 'A & B',
      children: [{ name: 'C', children: [] }],
    });
  });

  it('keeps flashcards ahead of a coincidental children field', () => {
    const result = parseAppData(
      JSON.stringify({
        flashcards: [{ f: 'Q', b: 'A' }],
        children: [{ name: 'nope' }],
      }),
    );
    expect(result?.kind).toBe('flashcards');
    expect(result?.cards).toEqual([{ front: 'Q', back: 'A' }]);
  });
});

describe('mind map export', () => {
  const node = parseMindMap(tree)!;

  it('puts every node label in the SVG and HTML', () => {
    const svg = mindMapToSvg(node);
    const html = mindMapToHtml(node);
    for (const name of collectMindMapNames(node)) {
      expect(svg).toContain(name);
      expect(html).toContain(name);
    }
    expect(html).toContain('Drag to pan');
    expect(html).not.toContain('cdn.');
    expect(svg).toContain('Hidden leaf');
  });

  it('names files from the root topic', () => {
    expect(mindMapFileStem(node)).toBe('Root Topic');
  });
});
