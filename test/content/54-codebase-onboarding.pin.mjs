// Pin nội dung: hai script của engineering-codebase-onboarding (kiểm kê module, quét secret). Fixture dựng lúc chạy.
import { spawnSync } from 'node:child_process';

export default async function run({ ok, ctx }) {
  const { fs, path, os, pathToFileURL, PLUGINS_DIR } = ctx;
  const skillDir = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-codebase-onboarding');
  const roots = [];
  const mk = (files) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onboarding-'));
    roots.push(root);
    for (const [rel, body] of Object.entries(files)) {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, body);
    }
    return root;
  };
  const cli = (script, args) => spawnSync(process.execPath, [path.join(skillDir, 'scripts', script), ...args], { encoding: 'utf8' });

  try {
    const inv = await import(pathToFileURL(path.join(skillDir, 'scripts', 'inventory-modules.mjs')).href);
    const byId = (r, id) => r.modules.find((m) => m.id === id);
    const pom = (artifact, extra = '') => `<project>${extra}<artifactId>${artifact}</artifactId></project>`;

    const maven = mk({
      'pom.xml': '<project><artifactId>parent</artifactId><packaging>pom</packaging><modules><module>core</module><module>web</module></modules></project>',
      'core/pom.xml': pom('core', '<parent><artifactId>parent</artifactId></parent>'),
      'core/README.md': '# core\n',
      'core/src/main/java/A.java': 'l1\nl2\nl3\n',
      'web/pom.xml': pom('web', '<parent><artifactId>parent</artifactId></parent>')
        .replace('</project>', '<dependencies><dependency><artifactId>core</artifactId></dependency><dependency><artifactId>spring-boot-starter</artifactId></dependency></dependencies></project>'),
      'web/src/main/java/B.java': 'x\n',
      'web/src/main/java/C.java': 'y\n',
    });
    const m = inv.inventoryModules(maven);
    ok(m.modules.length === 2 && m.modules.every((x) => x.kind === 'maven'), 'AC2.1: Maven cha khai hai module → đúng hai module kind maven');
    ok(byId(m, 'core')?.path === 'core' && byId(m, 'core').buildFile === 'core/pom.xml', 'AC2.1: module có path và buildFile');
    ok(byId(m, 'core')?.sourceFiles === 1 && byId(m, 'core').lines === 3 && byId(m, 'web')?.sourceFiles === 2, 'AC2.1: sourceFiles và lines đúng số file nguồn');
    ok(byId(m, 'core')?.hasReadme === true && byId(m, 'web')?.hasReadme === false, 'AC2.1: hasReadme theo README có thật');
    ok(JSON.stringify(byId(m, 'web')?.declaredDeps) === '["core"]' && byId(m, 'core')?.declaredDeps.length === 0, 'AC2.1: declaredDeps chỉ gồm module anh em, không gồm thư viện ngoài');

    const kinds = [
      { name: 'Gradle include', kind: 'gradle', want: 2, files: {
        'settings.gradle': "rootProject.name = 'x'\ninclude ':app', ':libs:core'\n",
        'app/build.gradle': "dependencies { implementation project(':libs:core') }\n",
        'libs/core/build.gradle': '\n' } },
      { name: 'npm workspaces dạng mảng', kind: 'npm', want: 2, files: {
        'package.json': '{"name":"root","workspaces":["packages/*"]}',
        'packages/a/package.json': '{"name":"@x/a","dependencies":{"@x/b":"1.0.0"}}',
        'packages/b/package.json': '{"name":"@x/b"}' } },
      { name: 'npm workspaces dạng {packages}', kind: 'npm', want: 1, files: {
        'package.json': '{"name":"root","workspaces":{"packages":["apps/*"]}}',
        'apps/web/package.json': '{"name":"web"}' } },
      { name: 'pnpm-workspace.yaml', kind: 'npm', want: 2, files: {
        'package.json': '{"name":"root"}',
        'pnpm-workspace.yaml': "packages:\n  - 'pkgs/*'\n",
        'pkgs/x/package.json': '{"name":"x"}', 'pkgs/y/package.json': '{"name":"y"}' } },
      { name: 'Python hai thư mục pyproject', kind: 'python', want: 2, files: {
        'svc1/pyproject.toml': '[project]\nname="a"\n', 'svc2/pyproject.toml': '[project]\nname="b"\n' } },
    ];
    for (const c of kinds) {
      const r = inv.inventoryModules(mk(c.files));
      ok(r.modules.length === c.want && r.modules.every((x) => x.kind === c.kind), `AC2.2: ${c.name} → ${c.want} module kind ${c.kind}`);
    }
    const gr = inv.inventoryModules(mk(kinds[0].files));
    ok(JSON.stringify(byId(gr, 'app')?.declaredDeps) === '["core"]', 'AC2.2: Gradle project(\':libs:core\') thành declaredDeps của module anh em');
    const nr = inv.inventoryModules(mk(kinds[1].files));
    ok(JSON.stringify(byId(nr, '@x/a')?.declaredDeps) === '["@x/b"]', 'AC2.2: npm dependencies trùng tên package anh em thành declaredDeps');

    const secret = mk({
      'pom.xml': '<project><artifactId>svc</artifactId><properties><db.password>SENTINEL_PASS_1</db.password></properties></project>',
      'src/main/resources/application.yml': 'spring:\n  datasource:\n    password: SENTINEL_PASS_2\n',
      '.env': 'API_TOKEN=SENTINEL_PASS_3\n',
      'src/main/java/Main.java': 'class Main {}\n',
    });
    const sec = cli('inventory-modules.mjs', [secret]);
    const secTable = cli('inventory-modules.mjs', [secret, '--format', 'table']);
    ok(sec.status === 0 && !/SENTINEL_PASS/.test(sec.stdout + sec.stderr) && !/SENTINEL_PASS/.test(secTable.stdout + secTable.stderr),
      'AC2.3: stdout và stderr không chứa giá trị cấu hình trong application.yml, .env, pom.xml');

    const edge = mk({
      'pom.xml': '<project><artifactId>parent</artifactId><modules><module>core</module></modules></project>',
      'core/pom.xml': pom('core'),
      'core/src/main/java/A.java': 'a\n',
      'core/node_modules/dep/index.js': 'ignored\n',
      'docs/guide.md': '# guide\n',
    });
    const e = inv.inventoryModules(edge);
    ok(e.unclaimed.includes('docs') && !e.unclaimed.includes('core'), 'AC2.4: thư mục ngoài mọi module vào unclaimed');
    ok(byId(e, 'core')?.sourceFiles === 1, 'AC2.4: file trong node_modules không vào sourceFiles');
    ok(cli('inventory-modules.mjs', []).status === 2, 'AC2.4: thiếu đối số → exit 2');
    ok(cli('inventory-modules.mjs', [path.join(edge, 'khong-co')]).status === 2, 'AC2.4: gốc không tồn tại → exit 2');
    const unknown = mk({ Makefile: 'all:\n', 'main.go': 'package main\n' });
    const u = cli('inventory-modules.mjs', [unknown]);
    const uj = u.status === 0 ? JSON.parse(u.stdout) : null;
    ok(uj && uj.modules.length === 0 && uj.notes.length > 0, 'AC2.4: stack không nhận ra → modules rỗng, notes không rỗng, exit 0');

    const nested = mk({
      'pom.xml': '<project><artifactId>top</artifactId><modules><module>parent</module></modules></project>',
      'parent/pom.xml': '<project><artifactId>parent</artifactId><packaging>pom</packaging><modules><module>child</module></modules></project>',
      'parent/Helper.java': 'h\n',
      'parent/child/pom.xml': pom('child'),
      'parent/child/src/main/java/A.java': 'a\n',
      'parent/child/src/main/java/B.java': 'b\n',
      'parent/child/src/test/java/ATest.java': 't\n',
      'Top.java': 'top\n',
    });
    const n = inv.inventoryModules(nested);
    const child = byId(n, 'child');
    ok(n.modules.length === 1 && child?.sourceFiles === 2 && child.testFiles === 1, 'AC2.5: file của module con chỉ tính cho module con, testFiles tách khỏi sourceFiles');
    ok(n.unclaimed.includes('parent') && n.rootFiles === 1, 'AC2.5: file của module tổng hợp vào unclaimed, file ở gốc vào rootFiles');

    const viet = mk({
      'mod/package.json': '{"name":"mod"}',
      'mod/src/Đơn.js': 'a\n',
      'mod/src/ok.js': 'b\n',
      'tài-liệu/a.md': '# a\n',
    });
    spawnSync('git', ['init', '-q'], { cwd: viet });
    const v = inv.inventoryModules(viet);
    ok(byId(v, 'mod')?.sourceFiles === 2 && v.unclaimed.length === 1 && v.unclaimed[0] === 'tài-liệu',
      'AC2.1: repo git có tên file và thư mục không ASCII vẫn đếm đủ, unclaimed không dính nháy escape');
    const single = inv.inventoryModules(mk({ 'settings.gradle': "rootProject.name = 'x'\n", 'src/main/java/A.java': 'a\n' }));
    ok(single.modules.length === 1 && single.modules[0].kind === 'gradle' && single.modules[0].sourceFiles === 1 && single.notes.length === 0,
      'AC2.2: settings.gradle không có include là một module gradle, không báo stack lạ');
    const dyn = inv.inventoryModules(mk({
      'settings.gradle.kts': 'include(*listOf("a", "b").toTypedArray())\n',
      'a/src/A.kt': 'a\n', 'b/src/B.kt': 'b\n',
    }));
    ok(!dyn.modules.some((x) => x.path === '.') && dyn.notes.some((x) => x.includes('include động')),
      'AC2.2: include Gradle động không biến gốc thành module và có ghi chú kiểm kê tay');
    const mixed = inv.inventoryModules(mk({
      'settings.gradle.kts': 'include(":app")\ninclude(*listOf("x", "y").toTypedArray())\n', 'app/build.gradle.kts': '\n',
    }));
    ok(mixed.notes.some((x) => x.includes('include động')), 'AC2.2: settings vừa có include chuỗi vừa có include động vẫn ghi chú kiểm kê tay');
    const commented = inv.inventoryModules(mk({ 'settings.gradle': "rootProject.name = 'x'\n// include other modules later\n", 'src/main/java/A.java': 'a\n' }));
    ok(commented.modules.length === 1 && commented.modules[0].path === '.' && commented.notes.length === 0, 'AC2.2: chữ include trong comment không làm settings thành aggregator');
    const fx = inv.inventoryModules(mk({ 'build.gradle': '\n', 'src/main/java/A.java': 'a\n', 'src/test/resources/fx/settings.gradle': 'include "z"\n' }));
    ok(fx.modules.length === 1 && fx.modules[0].kind === 'gradle', 'AC2.2: settings.gradle trong fixture không làm mất build.gradle ở gốc');

    const scan = await import(pathToFileURL(path.join(skillDir, 'scripts', 'scan-secrets.mjs')).href);
    // Chuỗi giống secret ghép từ mảnh để chính file test không chứa nguyên chuỗi.
    const dirty = {
      'private-key': ['-----BEGIN ', 'RSA PRIVATE KEY-----'].join(''),
      'cloud-key-id': ['AK', 'IA', 'ABCDEFGHIJKLMNOP'].join(''),
      jwt: ['ey', 'JhbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiIxMjM0NTY3', '.', 'abcdefghijklmnop'].join(''),
      'url-credentials': ['postgres://', 'admin:', 'hunter22', '@db.example.com/x'].join(''),
      'secret-assignment': ['DB_PASS', 'WORD=', 'hunter22xyz'].join(''),
      'private-ip': ['host ', '10.', '20.30.40'].join(''),
    };
    const secretKinds = Object.keys(dirty);
    const md = mk({ 'dirty.md': `${secretKinds.map((k) => dirty[k]).join('\n')}\n` });
    const r1 = cli('scan-secrets.mjs', [path.join(md, 'dirty.md')]);
    const lines = r1.stdout.split('\n').filter((l) => /:\d+ /.test(l));
    ok(r1.status === 1 && lines.length === 6 && secretKinds.every((k, i) => lines[i].endsWith(`:${i + 1} ${k}`)),
      'AC3.1: mỗi loại trong sáu loại in một dòng file:line loại theo thứ tự, exit 1');
    ok(!/hunter22|ABCDEFGHIJKLMNOP|abcdefghijklmnop|20\.30\.40|PRIVATE KEY/.test(r1.stdout + r1.stderr), 'AC3.1: stdout và stderr không chứa giá trị nào của fixture');
    const pw = (v) => ['pass', 'word: ', v].join('');
    const hit = scan.scanText(`x\n${pw('hunter22xyz')}\n`);
    ok(hit.length === 1 && hit[0].line === 2 && hit[0].kind === 'secret-assignment', 'AC3.1: scanText trả line và kind');
    ok(scan.scanText(pw('`hunter22xyz`')).length === 1, 'AC3.1: giá trị bọc code inline vẫn bị báo');
    const started = Date.now();
    scan.scanText(`http://u:${'b'.repeat(80000)}\n${'a://'.repeat(20000)}\n${'a'.repeat(80000)}`);
    ok(Date.now() - started < 3000, 'AC3.1: dòng rất dài không gây quét bậc hai');

    const clean = mk({ 'clean.md': [
      '`DB_PASSWORD`', 'password: <your-password>', 'DB_PASSWORD=${DB_PASSWORD}', 'password: $DB_PASSWORD', 'token: ***', 'secret=', 'api_key: ""',
      'host 127.0.0.1, 0.0.0.0 và 192.0.2.10', 'phiên bản 1.2.3', '| DB_PASSWORD | mật khẩu của DB |',
      'max_tokens: 4096', 'password: string', 'password = os.environ["DB_PASSWORD"]', 'mongodb://user:pass@host/db', ''].join('\n') });
    const r2 = cli('scan-secrets.mjs', [path.join(clean, 'clean.md')]);
    ok(r2.status === 0 && !/:\d+ /.test(r2.stdout), 'AC3.2: placeholder, tên khoá, địa chỉ loopback và số phiên bản không bị báo');

    const dir = mk({ 'a.md': `${dirty['secret-assignment']}\n`, 'b.txt': `${dirty['secret-assignment']}\n` });
    const r3 = cli('scan-secrets.mjs', [dir]);
    ok(r3.status === 1 && r3.stdout.includes('a.md') && !r3.stdout.includes('b.txt'), 'AC3.3: thư mục chỉ quét .md');
    ok(cli('scan-secrets.mjs', [path.join(dir, 'b.txt')]).status === 1, 'AC3.3: file nêu rõ được quét bất kể đuôi');
    ok(cli('scan-secrets.mjs', []).status === 2, 'AC3.3: thiếu đối số → exit 2');
    const missing = cli('scan-secrets.mjs', [path.join(dir, 'a.md'), path.join(dir, 'khong-co.md')]);
    ok(missing.status === 2 && !/hunter22/.test(missing.stdout + missing.stderr), 'AC3.3: có file không đọc được → exit 2, không in giá trị của file đọc được');
    // Windows thường không cho tạo symlink khi thiếu quyền: ca này chỉ chạy được nơi tạo được.
    let linked = false;
    try { fs.symlinkSync(path.join(dir, 'khong-co.md'), path.join(dir, 'broken.md')); linked = true; } catch { /* không tạo được symlink */ }
    ok(!linked || cli('scan-secrets.mjs', [dir]).status === 1, 'AC3.3: symlink .md hỏng trong thư mục bị bỏ qua, không chặn lần quét');
  } finally {
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  }
}
