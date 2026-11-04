import type { HtmlTagDescriptor, Plugin } from 'vite';

const appName = 'Simple IRC Client';
const projectSite = 'https://simpleircclient.com/';
const appDescription =
  'Open-source IRC client in your browser, with end-to-end encrypted private messages. No install or account: join Libera.Chat, OFTC or any other IRC network.';

function meta(attrs: Record<string, string>): HtmlTagDescriptor {
  return { tag: 'meta', attrs, injectTo: 'head' };
}

// What crawlers that don't run JavaScript see instead of the empty app root.
function describingTags(): HtmlTagDescriptor[] {
  return [
    meta({ name: 'description', content: appDescription }),
    {
      tag: 'noscript',
      injectTo: 'body-prepend',
      children: `<h1>${appName}</h1><p>${appDescription}</p><p>This web chat needs JavaScript. About the project, desktop apps and docs: <a href="${projectSite}">simpleircclient.com</a></p>`,
    },
  ];
}

function structuredData(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: appName,
    description: appDescription,
    url: siteUrl,
    applicationCategory: 'CommunicationApplication',
    operatingSystem: 'Web browser',
    browserRequirements: 'Requires JavaScript',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
    sameAs: [projectSite],
  };
}

// Canonical address, link previews and structured data only make sense where the web chat is publicly hosted.
function publicAddressTags(siteUrl: string): HtmlTagDescriptor[] {
  return [
    { tag: 'link', attrs: { rel: 'canonical', href: siteUrl }, injectTo: 'head' },
    meta({ property: 'og:type', content: 'website' }),
    meta({ property: 'og:site_name', content: appName }),
    meta({ property: 'og:title', content: appName }),
    meta({ property: 'og:description', content: appDescription }),
    meta({ property: 'og:url', content: siteUrl }),
    meta({ property: 'og:image', content: new URL('icon-512.png', siteUrl).href }),
    {
      tag: 'script',
      attrs: { type: 'application/ld+json' },
      children: JSON.stringify(structuredData(siteUrl)),
      injectTo: 'head',
    },
  ];
}

export function metadataTags(siteUrl: string | undefined): HtmlTagDescriptor[] {
  return siteUrl ? [...describingTags(), ...publicAddressTags(siteUrl)] : describingTags();
}

// llms.txt (https://llmstxt.org): tells AI agents how to use the web chat and where the project docs live.
export function llmsText(siteUrl: string): string {
  return `# ${appName} web chat

> ${appDescription}

- Link straight into a network and channels, or embed the chat in an iframe: ${siteUrl}?server=<network or hostname>&channel=%23<channel>
- URL parameters: \`server\` (network name such as Libera.Chat or OFTC, or a hostname), \`port\` (defaults to 6697), \`tls\` (\`true\` or \`false\`), \`channel\` (comma-separated, \`#\` written as \`%23\`).
- Project site, desktop apps and docs: ${new URL('llms.txt', projectSite).href}
`;
}

export function publicSiteMetadata(publicUrl: string | undefined): Plugin {
  const siteUrl = publicUrl ? new URL(publicUrl).href : undefined;
  return {
    name: 'sic-public-site-metadata',
    transformIndexHtml: () => metadataTags(siteUrl),
    generateBundle() {
      if (siteUrl) {
        this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llmsText(siteUrl) });
      }
    },
  };
}
