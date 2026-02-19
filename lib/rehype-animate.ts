/**
 * rehype plugin：per-word fade-in 動畫
 *
 * 參考 Vercel Streamdown 的 animate plugin 實作方式：
 * 在 Markdown → HTML 的 AST 階段，把文字節點拆分成 per-word <span>，
 * 每個 span 帶 CSS animation，讓新出現的文字逐 word 淡入。
 *
 * @see https://github.com/vercel/streamdown — packages/streamdown/lib/animate.ts
 * @see https://github.com/Ephibbs/flowtoken — src/components/SplitText.tsx
 */

import type { Root, Element, Text, ElementContent } from 'hast'
import { visitParents, SKIP } from 'unist-util-visit-parents'
import type { Node } from 'unist'

const WHITESPACE_RE = /\s/
const WHITESPACE_ONLY_RE = /^\s+$/
const SKIP_TAGS = new Set(['code', 'pre', 'svg', 'math'])

function isElement(node: unknown): node is Element {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    (node as Element).type === 'element'
  )
}

function hasSkipAncestor(ancestors: Node[]): boolean {
  return ancestors.some(
    (a) => isElement(a) && SKIP_TAGS.has(a.tagName)
  )
}

function splitByWord(text: string): string[] {
  const parts: string[] = []
  let current = ''
  let inWhitespace = false

  for (const char of text) {
    const isWs = WHITESPACE_RE.test(char)
    if (isWs !== inWhitespace && current) {
      parts.push(current)
      current = ''
    }
    current += char
    inWhitespace = isWs
  }
  if (current) parts.push(current)
  return parts
}

function makeSpan(word: string): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: { 'data-animate': true },
    children: [{ type: 'text', value: word }],
  }
}

/**
 * rehype plugin factory
 */
export function rehypeAnimate() {
  return (tree: Root) => {
    visitParents(tree, 'text', (node: Text, ancestors: Node[]) => {
      if (hasSkipAncestor(ancestors)) return SKIP

      const parent = ancestors.at(-1) as { children: ElementContent[] } | undefined
      if (!parent || !('children' in parent)) return

      const index = parent.children.indexOf(node as ElementContent)
      if (index === -1) return

      const text = node.value
      if (!text.trim()) return

      const parts = splitByWord(text)
      const nodes: ElementContent[] = parts.map((part) =>
        WHITESPACE_ONLY_RE.test(part)
          ? ({ type: 'text', value: part } as Text)
          : makeSpan(part)
      )

      parent.children.splice(index, 1, ...nodes)
      return index + nodes.length
    })
  }
}
