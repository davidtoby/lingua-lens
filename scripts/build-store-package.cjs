/**
 * 生成 Chrome 应用商店上架用 zip：从 public/extension 复制一份，
 * 去掉 update_url（商店渠道由 Chrome 商店托管更新），输出到 store/。
 * 用法：node scripts/build-store-package.cjs
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'public/extension');
const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'manifest.json'), 'utf8'));
const outDir = path.join(root, 'store');
fs.mkdirSync(outDir, { recursive: true });

const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'lingualens-store-'));
fs.cpSync(srcDir, staging, { recursive: true });

const stagedManifestPath = path.join(staging, 'manifest.json');
const staged = JSON.parse(fs.readFileSync(stagedManifestPath, 'utf8'));
delete staged.update_url;
fs.writeFileSync(stagedManifestPath, JSON.stringify(staged, null, 2) + '\n');

const zipName = `lingualens-v${manifest.version}-store.zip`;
const outFile = path.join(outDir, zipName);
if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
execFileSync('zip', ['-r', '-q', outFile, '.'], { cwd: staging, stdio: 'inherit' });
fs.rmSync(staging, { recursive: true, force: true });

const size = fs.statSync(outFile).size;
console.log(`built store/${zipName} (${(size / 1024).toFixed(1)} KB, update_url removed)`);
