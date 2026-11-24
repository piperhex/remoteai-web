import { init, parse } from 'es-module-lexer';
import { fromByteArray, toByteArray } from 'base64-js';
import type { HomeBundle } from './package';
import zoomWheel from './zoomWheel.js?raw';

type File = HomeBundle['files'][number];
const text = (file: File) => new TextDecoder().decode(toByteArray(file.data));
const dataUrl = (type: string, source: string) =>
  `data:${type};base64,${fromByteArray(new TextEncoder().encode(source))}`;
const scriptFile = (file: File) => /\.(m?js)$/i.test(file.path);

/** Opaque sandbox frames cannot use Service Workers. Embed the validated resources instead. */
export async function homeDocument(bundle: HomeBundle, base: string): Promise<string> {
  await init;
  const root = new URL(`/browser-home/site/${bundle.revision}/`, base);
  const files = new Map(bundle.files.map(file => [new URL(file.path, root).href, file]));
  const urls = new Map<string, string>();
  const resolving = new Set<string>();
  const resolve = (reference: string, from: string): string => {
    try {
      const url = new URL(reference, from);
      url.hash = ''; url.search = '';
      return url.href;
    } catch { return reference; }
  };
  const resource = (reference: string, from: string): string => {
    const key = resolve(reference, from), file = files.get(key);
    if (!file) return reference;
    const cached = urls.get(key);
    if (cached) return cached;
    if (resolving.has(key)) throw new Error('Circular stylesheet reference');
    resolving.add(key);
    const value = file.contentType.startsWith('text/css')
      ? dataUrl(file.contentType, rewriteCss(text(file), key, resource))
      : `data:${file.contentType};base64,${file.data}`;
    urls.set(key, value); resolving.delete(key);
    return value;
  };
  // Import-map keys stay stable, including cyclic and lazy module graphs.
  const imports: Record<string, string> = {};
  for (const [key, file] of files) {
    if (!scriptFile(file)) continue;
    imports[key] = dataUrl(file.contentType, rewriteScript(text(file), key, { files, resolve, resource }));
  }
  const entry = bundle.files.find(file => file.path === 'index.html');
  if (!entry) throw new Error('Home entry missing');
  return rewriteHtml(text(entry), root.href, {
    imports, resource, script: source => rewriteScript(source, root.href, { files, resolve, resource }),
  });
}

function rewriteCss(source: string, from: string, resource: (ref: string, from: string) => string) {
  return source.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g,
    (_match, _quote, ref: string) => `url("${resource(ref, from)}")`)
    .replace(/(@import\s+)(['"])([^'"]+)\2/g,
      (_match, prefix: string, _quote, ref: string) => `${prefix}"${resource(ref, from)}"`);
}

interface ScriptResources {
  files: Map<string, File>;
  resolve: (ref: string, from: string) => string;
  resource: (ref: string, from: string) => string;
}

function rewriteScript(source: string, from: string, resources: ScriptResources) {
  // Rewrite static asset literals first; module specifiers are handled by the lexer below.
  const rewritten = source.replace(/(['"])([^'"\r\n\\]+)\1/g, (match, quote: string, ref: string) => {
    const key = resources.resolve(ref, from), file = resources.files.get(key);
    if (!file || scriptFile(file)) return match;
    return quote + resources.resource(ref, from) + quote;
  });
  const [imports] = parse(rewritten);
  let result = rewritten;
  for (const item of [...imports].reverse()) {
    if (!item.n) continue;
    const key = resources.resolve(item.n, from);
    if (!resources.files.has(key)) continue;
    const replacement = item.d >= 0 ? JSON.stringify(key) : key;
    result = result.slice(0, item.s) + replacement + result.slice(item.e);
  }
  return result;
}

function rewriteHtml(source: string, root: string, resources: {
  imports: Record<string, string>; resource: (ref: string, from: string) => string;
  script: (source: string) => string;
}) {
  const document = new DOMParser().parseFromString(source, 'text/html');
  document.querySelectorAll('base').forEach(element => element.remove());
  const base = document.createElement('base'); base.href = root; document.head.prepend(base);
  for (const script of document.querySelectorAll('script:not([src])')) {
    const type = script.getAttribute('type');
    if (!type || type === 'module' || type === 'text/javascript') {
      script.textContent = resources.script(script.textContent ?? '');
    }
  }
  for (const element of document.querySelectorAll('[src],link[href],source[srcset],img[srcset]')) {
    const attribute = element.hasAttribute('src') ? 'src' : 'href';
    const reference = element.getAttribute(attribute);
    if (reference) {
      const url = new URL(reference, root).href;
      element.setAttribute(attribute, resources.imports[url] ?? resources.resource(reference, root));
      element.removeAttribute('integrity');
    }
    const srcset = element.getAttribute('srcset');
    if (srcset && !srcset.includes('data:')) element.setAttribute('srcset', srcset.split(',').map(item => {
      const [ref, ...descriptors] = item.trim().split(/\s+/);
      return [resources.resource(ref, root), ...descriptors].join(' ');
    }).join(','));
  }
  for (const element of document.querySelectorAll('style,[style]')) {
    if (element.tagName === 'STYLE') element.textContent = rewriteCss(element.textContent ?? '', root, resources.resource);
    const style = element.getAttribute('style');
    if (style) element.setAttribute('style', rewriteCss(style, root, resources.resource));
  }
  const mapping = document.createElement('script'); mapping.type = 'importmap';
  mapping.textContent = JSON.stringify({ imports: resources.imports }).replace(/</g, '\\u003c');
  base.after(mapping);
  const policy = document.createElement('meta'); policy.httpEquiv = 'Content-Security-Policy';
  policy.content = "object-src 'none'; frame-src 'none'; form-action 'none'";
  document.head.prepend(policy);
  const zoom = document.createElement('script');
  zoom.textContent = zoomWheel;
  document.head.append(zoom);
  return '<!doctype html>' + document.documentElement.outerHTML;
}
