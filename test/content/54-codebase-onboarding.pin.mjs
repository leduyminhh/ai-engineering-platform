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
    // Regex cũ quay lui về nhánh không lấy `(` rồi `\S` khớp `(`: include chuỗi dạng gọi hàm bị ghi chú nhầm là động.
    for (const line of ['include(":a")', "include(':a')", 'include ":a"', 'include(":a", ":b")']) {
      const r = inv.inventoryModules(mk({ 'settings.gradle.kts': `${line}\n`, 'a/build.gradle.kts': '\n', 'b/build.gradle.kts': '\n' }));
      ok(r.notes.length === 0 && r.modules.length >= 1, `AC2.2: ${line} là include chuỗi, không ghi chú include động`);
    }
    const dynReal = inv.inventoryModules(mk({ 'settings.gradle.kts': 'include(":a")\ninclude(*names.toTypedArray())\n', 'a/build.gradle.kts': '\n' }));
    ok(dynReal.notes.filter((x) => x.includes('include động')).length === 1, 'AC2.2: include động thật vẫn có đúng một ghi chú');
    const escapedNames = mk({
      'settings.gradle': "include '../../x', ':a:..:..:y', '/abs/z', ':ok'\n",
      'ok/build.gradle': '\n', 'a/build.gradle': '\n',
    });
    const esc = inv.inventoryModules(escapedNames);
    ok(esc.modules.length === 1 && esc.modules[0].path === 'ok' && esc.notes.some((x) => x.includes("'..'")) && !esc.notes.join(' ').includes('/abs/z'),
      'AC2.2: tên module có `..` hoặc tuyệt đối bị bỏ và ghi chú, không in tên');
    const bigXml = (open, close) => `<project><artifactId>x</artifactId>${open.repeat(20000)}${close}</project>`;
    for (const [open, close] of [['<!--', ''], ['<parent>', '']]) {
      const t0 = Date.now();
      const r = inv.inventoryModules(mk({ 'pom.xml': bigXml(open, close) }));
      ok(Date.now() - t0 < 3000 && r.modules.length === 1, `AC2.1: pom có 20.000 lần ${open} không đóng không gây quét bậc hai`);
    }
    const t1 = Date.now();
    inv.inventoryModules(mk({ 'settings.gradle': `include${' '.repeat(200000)}x\n${'include ('.repeat(20000)}\n${'/*'.repeat(20000)}\n` }));
    ok(Date.now() - t1 < 3000, 'AC2.2: settings.gradle nhiều `include (` và `/*` không đóng không gây quét bậc hai');
    const huge = inv.inventoryModules(mk({ 'pom.xml': `<project><artifactId>big</artifactId></project>${' '.repeat((1 << 20) + 1)}`, 'package.json': '{"name":"ok"}' }));
    ok(huge.notes.some((x) => x.includes('pom.xml') && x.includes('1 MB')) && !huge.modules.some((x) => x.id === 'big'), 'AC2.1: build file lớn hơn 1 MB bị bỏ qua và ghi chú');

    const sub = mk({ 'sub/pkg/package.json': '{"name":"pkg"}', 'sub/pkg/src/a.js': 'a\n', 'sub/.venv/lib/requirements.txt': 'x\n', 'sub/.venv/lib/site.py': 'x\n' });
    ok(JSON.stringify(inv.inventoryModules(path.join(sub, 'sub')).modules.map((x) => x.id)) === '["pkg"]', 'AC2.1: phạm vi thư mục con (không git) bỏ .venv, không biến requirements.txt trong đó thành module');
    spawnSync('git', ['init', '-q'], { cwd: sub });
    ok(JSON.stringify(inv.inventoryModules(path.join(sub, 'sub')).modules.map((x) => x.id)) === '["pkg"]', 'AC2.1: phạm vi thư mục con của repo git cũng bỏ .venv');
    const subFiles = inv.inventoryModules(path.join(sub, 'sub'));
    ok(subFiles.modules[0].sourceFiles === 1, 'AC2.1: phạm vi thư mục con của repo git chỉ đếm file dưới thư mục đó');

    // Symlink tracked/untracked trỏ ra ngoài gốc: git ls-files liệt kê, readFileSync đi theo link; cả hai chế độ phải bỏ.
    const outside = mk({ 'secret.js': 'o1\no2\no3\no4\n' });
    for (const withGit of [false, true]) {
      const lroot = mk({ 'mod/package.json': '{"name":"mod"}', 'mod/src/ok.js': 'a\n' });
      let sym = false;
      try { fs.symlinkSync(path.join(outside, 'secret.js'), path.join(lroot, 'mod', 'src', 'leak.js')); sym = true; } catch { /* không tạo được symlink */ }
      if (withGit) spawnSync('git', ['init', '-q'], { cwd: lroot });
      const lr = inv.inventoryModules(lroot);
      ok(!sym || (byId(lr, 'mod')?.sourceFiles === 1 && byId(lr, 'mod').lines === 1), `AC2.3: symlink ra ngoài gốc không được đếm (${withGit ? 'git' : 'walk'})`);
    }

    const dirty54 = inv.inventoryModules(mk({ 'm/package.json': '{"name":"a|b\\nc\\u0007d"}' }));
    ok(dirty54.modules[0].id === 'abcd', 'AC2.3: id bỏ ký tự điều khiển và `|` (chống chèn vào bảng markdown và prompt)');
    const longName = inv.inventoryModules(mk({ 'package.json': `{"name":"${'n'.repeat(300)}"}` }));
    ok(longName.modules[0].id.length === 100, 'AC2.3: id cắt ở 100 ký tự');

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
    // Giá trị bắt đầu bằng từ khoá placeholder hoặc chứa ngoặc vẫn là secret thật; số nhiều của tên khoá cũng vậy.
    const kv = (k, v) => [k, ': ', v].join('');
    const bearer = ['Authoriz', 'ation: Bear', 'er abcd1234efgh'].join('');
    for (const line of [kv('secret', 'example-prod-key'), kv('token', 'yourcompany123'), kv('api_key', 'yourcompany-live-7f3a9b2c1d'), pw('Yourpass99'), pw('abc(123)xyz'), kv('passwords', 'hunter22xyz'), kv('access_token', 'abcdefgh1234'),
      // `$` và `<` đứng đầu chỉ được miễn khi là tham chiếu biến hoặc cặp ngoặc đóng; thêm tên khoá passphrase, Bearer, AccountKey.
      pw('$hunter-22xyz'), pw('<hunter22xyz'), pw('<ab>hunter22'), kv('passphrase', 'hunter22xyz'), bearer, ['Account', 'Key=', 'abcdefghijklmnop12345'].join('')]) {
      ok(scan.scanText(line).length === 1, `AC3.1: không bỏ sót "${line.slice(0, 12)}…"`);
    }
    for (const line of [pw('<your-password>'), pw('<your password here>'), pw('<giá-trị>'), pw('${DB_PASSWORD}'), pw('$DB_PASSWORD'), 'Authorization: Bearer <token>', 'Authorization: Bearer $TOKEN', ['Account', 'Key=<account-key-value>'].join('')]) {
      ok(scan.scanText(line).length === 0, `AC3.2: placeholder không bị báo "${line.slice(0, 24)}…"`);
    }
    const started = Date.now();
    scan.scanText(`http://u:${'b'.repeat(80000)}\n${'a://'.repeat(20000)}\n${'a'.repeat(80000)}`);
    ok(Date.now() - started < 3000, 'AC3.1: dòng rất dài không gây quét bậc hai');

    const clean = mk({ 'clean.md': [
      '`DB_PASSWORD`', 'password: <your-password>', 'DB_PASSWORD=${DB_PASSWORD}', 'password: $DB_PASSWORD', 'token: ***', 'secret=', 'api_key: ""',
      'host 127.0.0.1, 0.0.0.0 và 192.0.2.10', 'phiên bản 1.2.3', '| DB_PASSWORD | mật khẩu của DB |',
      'max_tokens: 4096', 'password: string', 'password = os.environ["DB_PASSWORD"]', 'mongodb://user:pass@host/db',
      'api_key: YOUR_API_KEY', ['AKIA', 'IOSFODNN7EXAMPLE'].join(''), ''].join('\n') });
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
    const linkDir = mk({});
    let okLink = false;
    try { fs.symlinkSync(path.join(dir, 'a.md'), path.join(linkDir, 'ok-link.md')); okLink = true; } catch { /* không tạo được symlink */ }
    ok(!okLink || cli('scan-secrets.mjs', [linkDir]).status === 1, 'AC3.3: symlink .md trỏ tới file thường vẫn được quét');

    // AC4.4: SKILL.md gọi check-citations.mjs của skill anh em; đổi chỗ script mà không đổi SKILL.md thì bước kiểm trích dẫn thành not_run lặng lẽ.
    // AC1.1 do contract conventions chung kiểm (frontmatter, description, H2); AC6.1 do contract versions lock và npm test kiểm.
    // AC4.1, AC4.2, AC4.3, AC4.5, AC5.1, AC6.2 là nội dung hướng dẫn: kiểm ở review, không có test tự động (không pin câu chữ).
    const citations = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-spec-backfill', 'scripts', 'check-citations.mjs');
    ok(fs.existsSync(citations), 'AC4.4: check-citations.mjs của engineering-spec-backfill còn ở đường dẫn SKILL.md gọi');
    const skillMd = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
    ok(['inventory-modules.mjs', 'scan-secrets.mjs', 'check-citations.mjs', '<thư mục skill engineering-spec-backfill>/scripts/check-citations.mjs'].every((n) => skillMd.includes(n)), 'AC4.4: SKILL.md nhắc hai script của skill và check-citations.mjs của skill anh em');
    ok((skillMd.match(/⏸/g) || []).length >= 2, 'AC4.1: SKILL.md có ít nhất hai cổng ⏸');
    ok(fs.existsSync(path.join(PLUGINS_DIR, '..', 'test', 'routing', 'engineering-codebase-onboarding.json')), 'AC1.2: có dữ liệu routing của skill (số đo do scripts/routing-score.mjs kiểm trong npm test)');
  } finally {
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  }
}
