/** Read declared icons in the page itself, where relative URLs and <base> are available. */
export function readPageIcons(document) {
  const links = [...document.querySelectorAll('link[rel][href]')];
  const icons = links.filter(link => link.rel.toLowerCase().split(/\s+/).includes('icon'));
  const touch = links.filter(link => link.rel.toLowerCase() === 'apple-touch-icon');
  return [...new Set([...icons, ...touch].flatMap(link => {
    if (link.media && !document.defaultView?.matchMedia(link.media).matches) return [];
    try {
      const url = new URL(link.getAttribute('href'), document.baseURI);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
        && url.href.length <= 4096 ? [url.href] : [];
    } catch { return []; }
  }))].slice(0, 4);
}
