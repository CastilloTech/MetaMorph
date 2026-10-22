// Builds app/index.html from src/: the page template plus the style and script parts, joined in file order.
// No dependencies. Edit files in src/, then run `npm run build`.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const at = p => new URL(p, import.meta.url);
const read = p => readFileSync(at(p), 'utf8');
const join = (dir, ext) => readdirSync(at(dir)).filter(f => f.endsWith(ext)).sort().map(f => read(dir + f)).join('');

const css = join('src/css/', '.css'), js = join('src/js/', '.js');
// function replacements, so "$" sequences inside the code are left alone
const html = read('src/template.html').replace('{{CSS}}\n', () => css).replace('{{JS}}\n', () => js);
writeFileSync(at('app/index.html'), html);
console.log(`Built app/index.html (${Math.round(html.length / 1024)} KB from ${readdirSync(at('src/css/')).length} style and ${readdirSync(at('src/js/')).length} script parts)`);
