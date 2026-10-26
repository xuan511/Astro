import { deployment } from './deployment.mjs';

/** Prefix public Markdown URLs at build time; relative source images stay optimizable. */
export default function contentAssets() {
  const { base } = deployment();
  const resolve = (url) =>
    typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.startsWith(base)
      ? base + url.slice(1)
      : url;
  return (tree) => {
    function walk(node) {
      if (node.type === 'element') {
        const props = (node.properties ||= {});
        if (node.tagName === 'img') {
          props.src = resolve(props.src);
          props.loading ||= 'lazy';
          props.decoding ||= 'async';
        }
        if (node.tagName === 'a') {
          props.href = resolve(props.href);
          if (/^https?:\/\//.test(props.href || '')) {
            props.target = '_blank';
            props.rel = ['noopener', 'noreferrer'];
          }
        }
      }
      node.children?.forEach(walk);
    }
    walk(tree);
  };
}
