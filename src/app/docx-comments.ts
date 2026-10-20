import JSZip from 'jszip';

const WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export interface DocxComment {
  id: string;
  author: string;
  text: string;
  quote: string;
  severity: 'error' | 'warning' | 'comment';
}

export async function extractDocxComments(docx: Blob): Promise<DocxComment[]> {
  const archive = await JSZip.loadAsync(docx);
  const commentsFile = archive.file('word/comments.xml');
  const documentFile = archive.file('word/document.xml');

  if (!commentsFile || !documentFile) {
    return [];
  }

  const [commentsXml, documentXml] = await Promise.all([
    commentsFile.async('text'),
    documentFile.async('text'),
  ]);
  const comments = parseXml(commentsXml);
  const sourceDocument = parseXml(documentXml);
  const quotes = readCommentQuotes(sourceDocument);

  return Array.from(comments.getElementsByTagNameNS(WORD_NAMESPACE, 'comment'))
    .map((comment): DocxComment => {
      const id = comment.getAttributeNS(WORD_NAMESPACE, 'id') ?? '';
      const author = comment.getAttributeNS(WORD_NAMESPACE, 'author') || 'Unknown author';
      const text = Array.from(comment.getElementsByTagNameNS(WORD_NAMESPACE, 'p'))
        .map((paragraph) => Array.from(paragraph.getElementsByTagNameNS(WORD_NAMESPACE, 't'))
          .map((textNode) => textNode.textContent ?? '')
          .join(''))
        .filter(Boolean)
        .join('\n')
        .replace(new RegExp(`\\s*autor:\\s*${escapeRegExp(author)}\\s*$`, 'i'), '')
        .trim();

      return {
        id,
        author,
        text,
        quote: quotes.get(id)?.trim() ?? '',
        severity: /\[ERRO\]/i.test(text)
          ? 'error'
          : /\[AVISO\]/i.test(text)
            ? 'warning'
            : 'comment',
      };
    })
    .filter((comment) => comment.text);
}

function readCommentQuotes(document: XMLDocument): Map<string, string> {
  const quotes = new Map<string, string>();
  const activeIds = new Set<string>();

  const appendText = (text: string): void => {
    for (const id of activeIds) {
      quotes.set(id, `${quotes.get(id) ?? ''}${text}`);
    }
  };

  const visit = (node: Node): void => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if (element.namespaceURI === WORD_NAMESPACE) {
        if (element.localName === 'commentRangeStart') {
          activeIds.add(element.getAttributeNS(WORD_NAMESPACE, 'id') ?? '');
          return;
        }
        if (element.localName === 'commentRangeEnd') {
          activeIds.delete(element.getAttributeNS(WORD_NAMESPACE, 'id') ?? '');
          return;
        }
        if (element.localName === 't') {
          appendText(element.textContent ?? '');
          return;
        }
        if (element.localName === 'tab') {
          appendText('\t');
          return;
        }
        if (element.localName === 'br') {
          appendText('\n');
          return;
        }
      }
    }

    for (const child of Array.from(node.childNodes)) {
      visit(child);
    }
  };

  visit(document);
  return quotes;
}

function parseXml(source: string): XMLDocument {
  const document = new DOMParser().parseFromString(source, 'application/xml');
  if (document.documentElement.localName === 'parsererror') {
    throw new Error('The DOCX contains invalid comment data.');
  }
  return document;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
