#!/usr/bin/env python3
"""Build the dependency-free public site. No package install needed."""
from pathlib import Path
import hashlib
root = Path(__file__).resolve().parent.parent
source = root / 'src'
template = (source / 'index.html').read_text()
css = (source / 'style.css').read_text()
scripts = ['storage.js', 'core.js', 'workspace.js', 'content.js', 'network.js',
           'app.js', 'studio.js', 'studio-actions.js', 'editor.js', 'transfer.js',
           'backup.js', 'github.js', 'publish.js', 'player.js', 'bootstrap.js']
code = '\n'.join((source / filename).read_text() for filename in scripts)
css_version = hashlib.sha256(css.encode()).hexdigest()[:12]
js_version = hashlib.sha256(code.encode()).hexdigest()[:12]
page = template.replace('<!-- INLINE_STYLE -->', f'<link rel="stylesheet" href="./assets/blog.css?v={css_version}">')
page = page.replace('<!-- INLINE_SCRIPT -->', f'<script src="./assets/blog.js?v={js_version}" defer></script>')
out = root / 'dist'
out.mkdir(exist_ok=True)
(out / 'assets').mkdir(exist_ok=True)
(out / 'assets/blog.css').write_text(css)
(out / 'assets/blog.js').write_text(code)
(out / 'index.html').write_text(page)
(out / '.nojekyll').write_text('')
print(f'Built {out / "index.html"} ({len(page.encode()):,} bytes)')
