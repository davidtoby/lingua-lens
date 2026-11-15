/**
 * 打包 Chrome 扩展为 zip，输出到 public/ 供下载页直接下载。
 * 用法：node scripts/build-extension.cjs
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'public/extension');
const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'manifest.json'), 'utf8'));
const notesFile = path.join(root, 'extension-notes.json');
const allNotes = fs.existsSync(notesFile) ? JSON.parse(fs.readFileSync(notesFile, 'utf8')) : {};
const zipName = `lingualens-v${manifest.version}.zip`;
const outFile = path.join(root, 'public', zipName);

if (fs.existsSync(outFile)) fs.unlinkSync(outFile);

execFileSync('zip', ['-r', '-q', outFile, '.'], { cwd: srcDir, stdio: 'inherit' });

const size = fs.statSync(outFile).size;
console.log(`built ${zipName} (${(size / 1024).toFixed(1)} KB)`);

// crx 由 scripts/pack-crx.sh 生成，存在时一并写入元数据
const crxName = 'lingualens.crx';
const crxPath = path.join(root, 'public', crxName);
const crxSize = fs.existsSync(crxPath) ? fs.statSync(crxPath).size : 0;

// 同时保留一份版本元数据，下载页用它展示版本号与体积
fs.writeFileSync(
  path.join(root, 'public/extension-meta.json'),
  JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      file: zipName,
      size,
      sizeLabel: `${(size / 1024).toFixed(1)} KB`,
      crxFile: crxSize ? crxName : null,
      crxSize: crxSize || null,
      notes: allNotes[manifest.version] || [],
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
