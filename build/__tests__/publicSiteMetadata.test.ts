import { describe, expect, it } from 'vitest';
import type { HtmlTagDescriptor } from 'vite';
import { llmsText, metadataTags, publicSiteMetadata } from '../publicSiteMetadata';

const siteUrl = 'https://chat.example.org/';

function findTag(tags: HtmlTagDescriptor[], tag: string, attrs: Record<string, string> = {}) {
  return tags.find(
    (descriptor) => descriptor.tag === tag && Object.entries(attrs).every(([key, value]) => descriptor.attrs?.[key] === value),
  );
}

function metaContent(tags: HtmlTagDescriptor[], attrs: Record<string, string>) {
  return findTag(tags, 'meta', attrs)?.attrs?.content;
}

describe('metadataTags', () => {
  it('describes the app to crawlers in every build', () => {
    const tags = metadataTags(undefined);

    expect(metaContent(tags, { name: 'description' })).toContain('IRC client');
    expect(findTag(tags, 'noscript')?.children).toContain('href="https://simpleircclient.com/"');
  });

  it('adds no canonical address, link previews or structured data without a public address', () => {
    const tags = metadataTags(undefined);

    expect(findTag(tags, 'link', { rel: 'canonical' })).toBeUndefined();
    expect(findTag(tags, 'meta', { property: 'og:url' })).toBeUndefined();
    expect(findTag(tags, 'script', { type: 'application/ld+json' })).toBeUndefined();
  });

  it('points the canonical address and link previews at the public address', () => {
    const tags = metadataTags(siteUrl);

    expect(findTag(tags, 'link', { rel: 'canonical' })?.attrs?.href).toBe(siteUrl);
    expect(metaContent(tags, { property: 'og:url' })).toBe(siteUrl);
    expect(metaContent(tags, { property: 'og:image' })).toBe('https://chat.example.org/icon-512.png');
  });

  it('describes the hosted web chat as a free web application in structured data', () => {
    const script = findTag(metadataTags(siteUrl), 'script', { type: 'application/ld+json' });

    const structuredData = JSON.parse(String(script?.children));

    expect(structuredData).toMatchObject({ '@type': 'WebApplication', url: siteUrl, isAccessibleForFree: true });
  });
});

describe('llmsText', () => {
  it('shows agents how to link into a channel and where the project docs are', () => {
    const text = llmsText(siteUrl);

    expect(text).toContain('https://chat.example.org/?server=<network or hostname>&channel=%23<channel>');
    expect(text).toContain('https://simpleircclient.com/llms.txt');
  });
});

describe('publicSiteMetadata', () => {
  it('rejects a public address that is not a URL', () => {
    expect(() => publicSiteMetadata('chat.example.org')).toThrow(TypeError);
  });
});
