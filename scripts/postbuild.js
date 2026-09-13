import fs from 'fs';
import path from 'path';

try {
  const distDir = path.resolve('dist');
  const rootAssetsDir = path.resolve('assets');
  const distAssetsDir = path.join(distDir, 'assets');

  // 1. Ensure assets directory in root and copy compiled assets
  if (fs.existsSync(distAssetsDir)) {
    if (!fs.existsSync(rootAssetsDir)) {
      fs.mkdirSync(rootAssetsDir, { recursive: true });
    }
    const files = fs.readdirSync(distAssetsDir);
    for (const file of files) {
      fs.copyFileSync(path.join(distAssetsDir, file), path.join(rootAssetsDir, file));
    }
    console.log(`[postbuild] Copied ${files.length} asset files to ./assets/`);
  }

  // 2. Read dist/index.html and inject cache-busting timestamp
  const distHtmlPath = path.join(distDir, 'index.html');
  if (fs.existsSync(distHtmlPath)) {
    let html = fs.readFileSync(distHtmlPath, 'utf8');
    const timestamp = Date.now();

    // Replace assets references with unique version query
    html = html
      .replace(/(\.\/assets\/index\.js|\/assets\/index\.js)/g, `./assets/index.js?v=${timestamp}`)
      .replace(/(\.\/assets\/index\.css|\/assets\/index\.css)/g, `./assets/index.css?v=${timestamp}`);

    fs.writeFileSync(distHtmlPath, html, 'utf8');
    fs.writeFileSync(path.join(distDir, '404.html'), html, 'utf8');
    fs.writeFileSync(path.resolve('404.html'), html, 'utf8');
    fs.writeFileSync(path.resolve('index.html'), html, 'utf8');

    console.log(`[postbuild] Injected cache-buster v=${timestamp} into dist/index.html, dist/404.html, index.html, 404.html`);
  }

  // 3. Create .nojekyll in dist
  fs.writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf8');
  console.log('[postbuild] Created .nojekyll in dist');

} catch (err) {
  console.error('[postbuild] Error in postbuild script:', err);
}
