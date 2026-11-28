/** Utility and recovery pages stay reachable, but are excluded from search engines. */
export function isIndexablePath(pathname, base = '/') {
  const prefix = '/' + base.split('/').filter(Boolean).join('/');
  const root = prefix === '/' ? '/' : prefix + '/';
  if (!pathname.startsWith(root)) return false;
  const path = pathname.slice(root.length).replace(/\/+$/, '');
  return (
    !['404', '404.html', 'search', 'writing', 'legacy', 'projects/embedded-console'].includes(
      path,
    ) &&
    !path.startsWith('legacy/') &&
    !path.startsWith('companion/')
  );
}
