import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  // jsPDF lazily references these for HTML/SVG rendering; we only draw text.
  external: ['canvg', 'html2canvas', 'dompurify'],
  outfile: 'dist/app.js',
});

cpSync('index.html', 'dist/index.html');
cpSync('public', 'dist', { recursive: true });

// Single-file variant: everything inlined, no service worker, opens from file://
const html = readFileSync('index.html', 'utf8');
const js = readFileSync('dist/app.js', 'utf8');
writeFileSync(
  'dist/factura-standalone.html',
  html
    .replace('<script src="./app.js"></script>', `<script>${js}</script>`)
    .replace(/\s*<link rel="manifest"[^>]*>/, '')
    .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
    .replace(/\s*<link rel="icon"[^>]*>/, '')
);
console.log('built');
