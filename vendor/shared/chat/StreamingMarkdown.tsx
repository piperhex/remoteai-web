import { Fragment, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import type { Root, RootContent } from 'mdast';
import { normalizeMathDelimiters } from './mathMarkdown';

const CHUNK_SIZE = 1_024;
const LIVE_BLOCK_LIMIT = 4 * CHUNK_SIZE;
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath).freeze();
const overflowStyle = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const;

interface MarkdownDraft {
  inspected: string;
  chunks: readonly string[];
  end: number;
  scanAt: number;
}

const empty: MarkdownDraft = { inspected: '', chunks: [], end: 0, scanAt: 2 * CHUNK_SIZE };

function startsAfterBlankLine(text: string, start: number) {
  const previousEnd = start - 1;
  return previousEnd > 0 && !text.slice(text.lastIndexOf('\n', previousEnd - 1) + 1, previousEnd).trim();
}

function hasDefinitions(node: Root | RootContent): boolean {
  return node.type === 'definition' || node.type === 'footnoteDefinition'
    || ('children' in node && node.children.some(hasDefinitions));
}

function scanDraft(text: string, previous: MarkdownDraft, streaming: boolean): MarkdownDraft {
  if (!text.startsWith(previous.inspected)) previous = empty;
  const remaining = text.slice(previous.end);
  const possibleDefinition = remaining.includes(']:');
  const checkDefinition = possibleDefinition && (!streaming || remaining.length <= LIVE_BLOCK_LIMIT);
  if (text.length < previous.scanAt && (!checkDefinition || previous.inspected === text)) return previous;
  if (previous.scanAt === Infinity) return previous;

  const tree = parser.parse(remaining) as Root;
  // Definitions can resolve a link or footnote in any earlier block. Keep that document together.
  if (possibleDefinition && hasDefinitions(tree)) return { ...empty, inspected: text, scanAt: Infinity };
  const chunks = [...previous.chunks];
  let end = 0;
  // Leave the last block mutable. Use root boundaries so a list, fence, table or formula stays intact.
  for (const block of tree.children.slice(1, -1)) {
    const offset = block.position?.start.offset;
    if (offset === undefined || offset - end < CHUNK_SIZE) continue;
    const start = remaining.lastIndexOf('\n', offset - 1) + 1;
    if (start - end < CHUNK_SIZE || !startsAfterBlankLine(remaining, start)) continue;
    chunks.push(remaining.slice(end, start));
    end = start;
  }
  // Back off while a large open block keeps growing without a new boundary.
  const wait = Math.max(CHUNK_SIZE, Math.floor((remaining.length - end) / 2));
  return { inspected: text, chunks, end: previous.end + end, scanAt: text.length + wait };
}

function liveBlockEnd(text: string, start: number) {
  const end = Math.min(start + LIVE_BLOCK_LIMIT, text.length);
  // A provisional text run must never split an emoji between two elements.
  return end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1]) ? end - 1 : end;
}

/** Keep settled blocks mounted while the tail grows, including the final append. */
export function StreamingMarkdown({ text, streaming = false, children }: {
  text: string;
  streaming?: boolean;
  children: (part: string) => ReactNode;
}) {
  const normalized = useMemo(() => normalizeMathDelimiters(text), [text]);
  const committed = useRef(empty);
  const draft = useMemo(() => {
    const previous = committed.current;
    const continueDraft = previous.end > 0 && normalized.startsWith(previous.inspected);
    return streaming || continueDraft ? scanDraft(normalized, previous, streaming) : empty;
  }, [normalized, streaming]);
  useLayoutEffect(() => { committed.current = draft; }, [draft]);
  if (!streaming && !draft.end) return children(normalized);

  const end = streaming ? liveBlockEnd(normalized, draft.end) : normalized.length;
  return <>
    {[...draft.chunks, normalized.slice(draft.end, end)].map((part, index) =>
      <Fragment key={index}>{index > 0 && '\n'}{children(part)}</Fragment>)}
    {end < normalized.length && <p style={overflowStyle}>{normalized.slice(end)}</p>}
  </>;
}
