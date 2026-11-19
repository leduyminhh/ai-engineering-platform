// Pin nội dung: go-live-gate.mjs của engineering-quality-gate (đếm bốn chỉ tiêu ngưỡng go-live) và tài liệu đi kèm.
// Fixture dựng lúc chạy; sentinel ghép từ nhiều mảnh để scanner của repo không báo nhầm.
import { spawnSync } from 'node:child_process';

export default async function run({ ok, ctx }) {
  const { fs, path, os, pathToFileURL, PLUGINS_DIR } = ctx;
  const skillDir = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-quality-gate');
  const scriptPath = path.join(skillDir, 'scripts', 'go-live-gate.mjs');
  const roots = [];
  const SENT = ['SEN', 'TI', 'NEL', '-', '0042', '-', 'zq'].join('');
  const mkdir = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'golive-'));
    roots.push(root);
    return root;
  };
  // files: { tên: nội dung chuỗi } → trả { tên: đường dẫn tuyệt đối }
  const write = (files) => {
    const root = mkdir();
    return Object.fromEntries(Object.entries(files).map(([n, body]) => {
      const abs = path.join(root, n);
      fs.writeFileSync(abs, body);
      return [n, abs];
    }));
  };
  const cli = (args) => spawnSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8' });
  const NOW = new Date('2026-11-19T00:00:00Z');

  // Dựng fixture theo tài liệu tool; trường chứa giá trị secret luôn mang sentinel.
  const gitleaks = (items) => JSON.stringify(items.map(([rule, file, line]) => ({
    RuleID: rule, File: file, StartLine: line, Secret: SENT, Match: SENT, Fingerprint: `${file}:${rule}:${line}`,
  })));
  const trivy = ({ vulns = [], secrets = [], digest = 'sha256:aaa' } = {}) => JSON.stringify({
    ArtifactName: 'app:1',
    Metadata: { RepoDigests: [`app@${digest}`] },
    Results: [{
      Target: 'app:1 (debian)',
      Vulnerabilities: vulns.map(([id, sev, pkg = 'pkg@1.0']) => {
        const [name, version] = pkg.split('@');
        return { VulnerabilityID: id, PkgName: name, InstalledVersion: version, Severity: sev };
      }),
      Secrets: secrets.map(([rule, line]) => ({
        RuleID: rule, Category: 'generic', Severity: 'HIGH', StartLine: line, Match: SENT, Layer: { DiffID: 'sha256:layer1' },
      })),
    }],
  });

  try {
    let mod;
    try {
      mod = await import(pathToFileURL(scriptPath).href);
    } catch {
      ok(false, 'go-live-gate.mjs chưa có hoặc không nạp được');
      return;
    }
    const { gate, InputError } = mod;
    const bySev = (r) => Object.fromEntries(['Critical', 'High', 'Medium', 'Low', 'Info'].map((s) => [s, r.findings.filter((f) => f.severity === s).length]));

    // AC1.1: hai working tree + một lịch sử + một Trivy secret → secret = 4, secret không lọt sang critHigh
    const f1 = write({
      tree: gitleaks([['aws-key', 'src/a.js', 3], ['jwt', 'src/b.js', 9]]),
      history: gitleaks([['aws-key', 'old/c.js', 1]]),
      trivy: trivy({ secrets: [['private-key', 12]] }),
    });
    const r1 = cli(['--gitleaks-tree', f1.tree, '--gitleaks-history', f1.history, '--trivy', f1.trivy]);
    let out1 = {};
    try { out1 = JSON.parse(r1.stdout); } catch { /* assert bên dưới báo đỏ */ }
    ok(r1.status === 0 && out1.thresholds?.secret?.count === 4, 'AC1.1: 2 + 1 + 1 secret → count = 4, exit 0');
    ok(out1.thresholds?.secret?.status === 'không đạt' && out1.overall === 'không đạt', 'AC1.1: secret > 0 → status và overall không đạt');
    ok(out1.thresholds?.critHigh?.count === 0, 'AC1.1: secret của Trivy chỉ vào chỉ tiêu secret, không vào critHigh');
    ok(['secret', 'critHigh', 'rce', 'kev'].every((k) => out1.thresholds && k in out1.thresholds) && Array.isArray(out1.warnings), 'AC1.1: output có đủ bốn khoá chỉ tiêu và warnings');
    ok(out1.findings?.every((f) => f.key && Array.isArray(f.sources) && f.severity), 'AC1.1: mỗi finding có key, sources, severity');
    ok(out1.findings?.some((f) => f.key === 'aws-key@src/a.js:3' && f.sources.includes('gitleaks-tree')), 'AC1.1: khoá secret Gitleaks là rule@file:line');

    // AC1.2: Trivy 1 Critical + 1 High + 2 Medium + 1 Low → critHigh = 2
    const r2 = gate({ trivy: trivy({ vulns: [['CVE-2026-0001', 'CRITICAL'], ['CVE-2026-0002', 'HIGH'], ['CVE-2026-0003', 'MEDIUM'], ['CVE-2026-0004', 'MEDIUM', 'm2@1'], ['CVE-2026-0005', 'LOW']] }) }, { now: NOW });
    ok(r2.thresholds.critHigh.count === 2, 'AC1.2: 1 Critical + 1 High (+ 2 Medium + 1 Low) → critHigh = 2');
    ok(bySev(r2).Medium === 2 && bySev(r2).Low === 1, 'AC1.2: Medium và Low vẫn có trong findings nhưng không vào chỉ tiêu');
    ok(r2.findings.find((f) => f.key.startsWith('CVE-2026-0001@'))?.key.includes('sha256:aaa'), 'AC1.2: khoá CVE theo tài sản (digest image)');

    // AC1.12: sentinel không rò ra stdout/stderr ở ca hợp lệ, JSON hỏng, thiếu trường và severity lạ
    const f12 = write({
      tree: gitleaks([['aws-key', 'src/a.js', 3]]),
      okTrivy: trivy({ secrets: [['private-key', 12]] }),
      broken: `{"Results":[{"Secrets":[{"Match":"${SENT}"`,
      // Token sai đầu tiên mang sentinel: message gốc của JSON.parse sẽ chép đoạn này nếu script in nó ra.
      brokenHead: `${SENT}{"a":1}`,
      missing: JSON.stringify([{ File: 'x.js', StartLine: 1, Secret: SENT }]),
      weird: JSON.stringify({ ArtifactName: 'app:1', Results: [{ Target: 't', Vulnerabilities: [{ VulnerabilityID: 'CVE-2026-9', PkgName: 'p', InstalledVersion: '1', Severity: 'SEVERE', Title: SENT }] }] }),
    });
    const runs12 = [
      cli(['--gitleaks-tree', f12.tree, '--trivy', f12.okTrivy]),
      cli(['--trivy', f12.broken]),
      cli(['--gitleaks-tree', f12.missing]),
      cli(['--trivy', f12.weird]),
      cli(['--trivy', f12.brokenHead]),
    ];
    ok(runs12.every((r) => !r.stdout.includes(SENT) && !r.stderr.includes(SENT)), 'AC1.12: sentinel không xuất hiện ở stdout/stderr (hợp lệ, JSON hỏng cả hai kiểu, thiếu trường, severity lạ)');
    ok(runs12.slice(1).every((r) => r.status === 2), 'AC1.12: bốn ca lỗi đều exit 2');
    // JSON.parse của Node chỉ chép khoảng 10 ký tự đầu của input vào message, nên kiểm theo tiền tố thay vì cả sentinel.
    const prefix = SENT.slice(0, 8);
    ok(runs12.every((r) => !r.stderr.includes(prefix) && !r.stdout.includes(prefix)), 'AC1.12: tiền tố sentinel (đoạn JSON.parse có thể chép vào message) cũng không xuất hiện');
    let weirdErr = null;
    try { gate({ trivy: fs.readFileSync(f12.weird, 'utf8') }, { now: NOW }); } catch (e) { weirdErr = e; }
    ok(weirdErr instanceof InputError && !String(weirdErr.message).includes(SENT), 'AC1.12: InputError của severity lạ không chứa giá trị trong report');

    // AC1.13: lỗi đầu vào → exit 2 và stdout không có kết luận; đủ file có Critical → exit 0
    const f13 = write({
      good: trivy({ vulns: [['CVE-2026-0001', 'CRITICAL']] }),
      notJson: 'không phải json',
      noField: JSON.stringify({ Foo: 1 }),
      wrongType: JSON.stringify({ ArtifactName: 'app:1', Results: [{ Target: 't', Vulnerabilities: 5 }] }),
    });
    const bad = [
      ['không có đối số', []],
      ['cờ thiếu giá trị', ['--trivy']],
      ['cờ lạ', ['--khong-co', f13.good]],
      ['file không tồn tại', ['--trivy', path.join(path.dirname(f13.good), 'khong-ton-tai.json')]],
      ['JSON hỏng', ['--trivy', f13.notJson]],
      ['thiếu trường bắt buộc', ['--trivy', f13.noField]],
      ['trường sai kiểu (Vulnerabilities không phải mảng)', ['--trivy', f13.wrongType]],
      ['severity lạ', ['--trivy', f12.weird]],
    ];
    for (const [name, args] of bad) {
      const r = cli(args);
      ok(r.status === 2 && !r.stdout.includes('đạt'), `AC1.13: ${name} → exit 2, stdout không có đạt/không đạt`);
    }
    const rGood = cli(['--trivy', f13.good]);
    let outGood = {};
    try { outGood = JSON.parse(rGood.stdout); } catch { /* đỏ bên dưới */ }
    ok(rGood.status === 0 && outGood.thresholds?.critHigh?.count === 1, 'AC1.13: đọc được và có Critical → vẫn exit 0, kết luận nằm ở stdout');
  } finally {
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  }
}
