// build-page.mjs — inline the gated kernel into index.html VERBATIM, between the markers.
// CI diffs the rebuild so the live page cannot drift from the proven law. Fixpoint by construction.
// The kernel file and its export list are DERIVED, never typed: the one-kernel rule.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const kernelFile = readdirSync('.').find((f) => f.endsWith('.mjs') && !f.includes('.test.') && f !== 'build-page.mjs');
if (!kernelFile) { console.error('REFUSED: no kernel found'); process.exit(1); }
const src = readFileSync(kernelFile, 'utf8');
const exports = [...src.matchAll(/^export (?:function|const) ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
if (exports.length === 0) { console.error('REFUSED: the kernel exports nothing'); process.exit(1); }
const NS = kernelFile.replace('.mjs', '').toUpperCase();

let kernel = src.replace(/^export /gm, '').replace(/<\/script/g, '<\\/script');
const shell = readFileSync('page.template.html', 'utf8');
const START = '/*__KERNEL_START__*/', END = '/*__KERNEL_END__*/';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const re = new RegExp(esc(START) + '[\\s\\S]*?' + esc(END));
const block = START + '\n' + kernel + '\nwindow.' + NS + ' = { ' + exports.join(', ') + ' };\n' + END;
const out = shell.replace(re, () => block);
if (!shell.includes(START)) { console.error('REFUSED: kernel markers not found in template'); process.exit(1); }
writeFileSync('index.html', out);
console.log('inlined ' + kernelFile + ' → index.html (' + kernel.length + 'b kernel, window.' + NS + ' = { ' + exports.join(', ') + ' })');
