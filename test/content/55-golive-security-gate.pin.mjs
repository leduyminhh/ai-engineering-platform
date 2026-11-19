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

  // Coverity/ZAP/SARIF: tên trường theo tài liệu tool, [Unverified] với report thật (AC6.1).
  const coverity = (issues) => JSON.stringify({
    issues: issues.map(([file, line, impact, cwe, name = 'CHECKER']) => ({
      checkerName: name,
      mainEventFilePathname: file,
      mainEventLineNumber: line,
      checkerProperties: { impact, cweCategory: cwe === undefined ? undefined : String(cwe), categoryDescription: name },
    })),
  });
  const zap = (alerts) => JSON.stringify({
    site: [{ '@name': 'http://app', alerts: alerts.map(([name, risk, cwe = '-1', uri = 'http://app/x']) => ({ alert: name, name, riskcode: risk, cweid: String(cwe), instances: [{ uri }] })) }],
  });
  const sarif = (results) => JSON.stringify({
    version: '2.1.0',
    runs: [{
      tool: { driver: { name: 't', rules: results.map((r) => ({ id: r.rule, name: r.name || r.rule, properties: { tags: r.cwe ? [`external/cwe/cwe-${r.cwe}`] : [] } })) } },
      results: results.map((r) => ({
        ruleId: r.rule,
        level: r.level,
        message: { text: r.text || 'm' },
        properties: r.score === undefined ? undefined : { 'security-severity': r.score },
        locations: [{ physicalLocation: { artifactLocation: { uri: r.uri }, region: { startLine: r.line } } }],
      })),
    }],
  });

  // Nessus CSV, BlackDuck CycloneDX, Sonar issues, CISA KEV: tên cột/trường [Unverified] với report thật (AC6.1).
  const csvCell = (v) => (/[",\r\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));
  const nessus = (rows, header = ['Plugin ID', 'CVE', 'Risk', 'Host', 'Port', 'Name']) => `${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
  const blackduck = (vulns) => JSON.stringify({
    bomFormat: 'CycloneDX',
    vulnerabilities: vulns.map(([id, severities, ref, cwes]) => ({ id, cwes, ratings: severities.map((severity) => ({ severity })), affects: [{ ref }] })),
  });
  const sonar = (issues) => JSON.stringify({
    issues: issues.map(([type, severity, file, line, extra = {}]) => ({ key: `k-${file}-${line}`, rule: 'r:1', type, severity, component: `proj:${file}`, line, message: 'm', ...extra })),
  });
  const kevFile = (cves, dateReleased) => JSON.stringify({ catalogVersion: '1', ...(dateReleased ? { dateReleased } : {}), vulnerabilities: cves.map((cveID) => ({ cveID })) });

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

    // ---- Task 2: SARIF, ZAP, Coverity, RCE, gộp theo khoá mã nguồn ----
    const sevOf = (r, prefix) => r.findings.find((f) => f.key.startsWith(prefix))?.severity;
    const throwsInput = (inputs) => {
      try { gate(inputs, { now: NOW }); } catch (e) { return e instanceof InputError; }
      return false;
    };

    // AC1.3: bảng chuẩn hoá severity
    const rz = gate({ zap: zap([['ZA', 3], ['ZB', 2], ['ZC', 1], ['ZD', 0]]) }, { now: NOW });
    ok(['ZA', 'ZB', 'ZC', 'ZD'].map((p) => sevOf(rz, `${p}@`)).join() === 'High,Medium,Low,Info', 'AC1.3: ZAP riskcode 3/2/1/0 → High/Medium/Low/Info');
    const rs = gate({ sarif: [sarif([
      { rule: 'r1', uri: 'a.js', line: 1, score: '9.0' }, { rule: 'r2', uri: 'a.js', line: 2, score: '7.0' },
      { rule: 'r3', uri: 'a.js', line: 3, score: 4 }, { rule: 'r4', uri: 'a.js', line: 4, score: '0.1' },
      { rule: 'r5', uri: 'a.js', line: 5, level: 'error' }, { rule: 'r6', uri: 'a.js', line: 6, level: 'warning' },
      { rule: 'r7', uri: 'a.js', line: 7, level: 'note' }, { rule: 'r8', uri: 'a.js', line: 8, level: 'none' },
    ])] }, { now: NOW });
    ok([1, 2, 3, 4, 5, 6, 7, 8].map((n) => sevOf(rs, `a.js:${n}`)).join() === 'Critical,High,Medium,Low,High,Medium,Low,Info', 'AC1.3: SARIF security-severity 9.0/7.0/4.0/0.1 rồi level error/warning/note/none');
    ok(sevOf(gate({ trivy: trivy({ vulns: [['CVE-2026-1', 'UNKNOWN']] }) }, { now: NOW }), 'CVE-2026-1@') === 'Info', 'AC1.3: Trivy UNKNOWN → Info');
    ok(sevOf(gate({ trivy: trivy({ vulns: [['CVE-2026-2', 'Critical '], ['CVE-2026-3', 'high']] }) }, { now: NOW }), 'CVE-2026-2@') === 'Critical'
      && sevOf(gate({ trivy: trivy({ vulns: [['CVE-2026-3', 'high']] }) }, { now: NOW }), 'CVE-2026-3@') === 'High', 'AC1.3: Trivy viết khác hoa/thường hoặc có khoảng trắng vẫn chuẩn hoá đúng');
    const rv = gate({ zap: zap([['ZV', ' 3 ']]) }, { now: NOW });
    ok(sevOf(rv, 'ZV@') === 'High', 'AC1.3: ZAP riskcode có khoảng trắng vẫn chuẩn hoá đúng');
    ok([
      { trivy: trivy({ vulns: [['CVE-2026-4', 'SEVERE']] }) },
      { zap: zap([['ZX', 9]]) },
      { sarif: [sarif([{ rule: 'rx', uri: 'a.js', line: 1, score: 'cao' }])] },
      { sarif: [sarif([{ rule: 'ry', uri: 'a.js', line: 1 }])] },
      { coverity: coverity([['a.java', 1, 'Catastrophic']]) },
    ].every(throwsInput), 'AC1.3: severity lạ hoặc không xác định được (Trivy, ZAP, SARIF, Coverity) → InputError');
    // JSON hợp lệ nhưng sai cấu trúc: phải là InputError (exit 2), không được là TypeError.
    const sarifDoc = (run) => JSON.stringify({ version: '2.1.0', runs: [run] });
    const zapDoc = (alert) => JSON.stringify({ site: [{ '@name': 'http://app', alerts: [alert] }] });
    ok([
      { sarif: [sarifDoc({ results: {} })] },
      { sarif: [sarifDoc({ results: [null] })] },
      { sarif: [sarifDoc({ tool: { driver: { rules: {} } }, results: [] })] },
      { sarif: [sarifDoc({ tool: { driver: { rules: [null] } }, results: [] })] },
      { sarif: [sarifDoc({ tool: { driver: { rules: [{ id: 'r', properties: { tags: 5 } }] } }, results: [{ ruleId: 'r', level: 'error', locations: [{ physicalLocation: { artifactLocation: { uri: 'a' }, region: { startLine: 1 } } }] }] })] },
      { zap: zapDoc({ alert: 'A', riskcode: 1, instances: 'x' }) },
      { zap: zapDoc({ alert: 'A', riskcode: 1, instances: {} }) },
      { zap: zapDoc(null) },
      { coverity: JSON.stringify({ issues: [null] }) },
      { coverity: JSON.stringify({ issues: [{ mainEventFilePathname: 'a', mainEventLineNumber: 1, checkerProperties: { impact: 'High', cweCategory: {} } }] }) },
      { trivy: JSON.stringify({ ArtifactName: 'a', Results: [{ Target: 't', Vulnerabilities: [{ VulnerabilityID: 'CVE-1', Severity: 'HIGH', CweIDs: 'CWE-78' }] }] }) },
      { zap: zapDoc({ alert: 'A', riskcode: [3] }) },
    ].every(throwsInput), 'AC1.13: JSON sai cấu trúc ở SARIF, ZAP, Coverity, Trivy (kể cả trường CWE sai kiểu) → InputError, không TypeError');
    const fz = write({ weirdZap: zap([['ZX', 9]]), badShape: sarifDoc({ results: {} }) });
    ok(cli(['--sarif', fz.badShape]).status === 2, 'AC1.13: sai cấu trúc qua CLI → exit 2, không phải exit 1 kèm stack');
    ok(cli(['--zap', fz.weirdZap]).status === 2, 'AC1.3: severity lạ của ZAP qua CLI → exit 2');

    // AC1.10: RCE theo CWE hoặc nhãn, bất kể severity
    const rceOf = (inputs) => gate(inputs, { now: NOW }).thresholds.rce.count;
    const rr = gate({
      coverity: coverity([['a.java', 10, 'High', 78], ['b.java', 20, 'Low', 502]]),
      sarif: [sarif([{ rule: 'x79', uri: 'c.js', line: 1, score: '9.5', cwe: 79 }])],
      zap: zap([['Remote Code Execution', 1, 200]]),
    }, { now: NOW });
    ok(rr.thresholds.rce.count === 3, 'AC1.10: CWE-78, CWE-502 và nhãn "Remote Code Execution" (CWE-200) → RCE = 3');
    ok(rr.thresholds.critHigh.count === 2 && rr.findings.find((f) => f.key.startsWith('c.js:1'))?.rce === false, 'AC1.10: CWE-79 Critical vào critHigh nhưng không vào RCE');
    ok([77, 78, 94, 95, 502, 917, 1336].every((c) => rceOf({ sarif: [sarif([{ rule: 'r', uri: 'a.js', line: 1, level: 'note', cwe: c }])] }) === 1), 'AC1.10: mỗi CWE trong {77,78,94,95,502,917,1336} đều là RCE, kể cả severity thấp');
    ok([79, 89, 200].every((c) => rceOf({ sarif: [sarif([{ rule: 'r', uri: 'a.js', line: 1, score: '9.8', cwe: c }])] }) === 0), 'AC1.10: CWE ngoài danh sách không phải RCE kể cả Critical');
    ok(rceOf({ zap: zap([['REMOTE code EXECUTION via upload', 1]]) }) === 1, 'AC1.10: nhãn RCE không phân biệt hoa thường');
    ok(rceOf({ zap: zap([['Injection', 1, 78]]) }) === 1, 'AC1.10: ZAP cweid thuộc danh sách là RCE');
    ok(rceOf({
      coverity: coverity([['a.java', 5, 'Low', 89, 'plain']]),
      sarif: [sarif([{ rule: 'r', uri: 'a.java', line: 5, level: 'note', cwe: 89, text: 'Remote Code Execution' }])],
    }) === 1, 'AC1.10: RCE do nhãn ở nguồn thứ hai vẫn giữ sau khi gộp finding');
    const trivyRce = JSON.stringify({ ArtifactName: 'app:1', Results: [{ Target: 't', Vulnerabilities: [
      { VulnerabilityID: 'CVE-2026-70', PkgName: 'p', InstalledVersion: '1', Severity: 'LOW', CweIDs: ['CWE-94'] },
      { VulnerabilityID: 'CVE-2026-71', PkgName: 'q', InstalledVersion: '1', Severity: 'LOW', Title: 'libx: Remote Code Execution in parser' },
      { VulnerabilityID: 'CVE-2026-72', PkgName: 'r', InstalledVersion: '1', Severity: 'CRITICAL', CweIDs: ['CWE-79'] },
    ] }] });
    ok(rceOf({ trivy: trivyRce }) === 2, 'AC1.10: Trivy CweIDs thuộc danh sách hoặc Title có nhãn RCE đều tính RCE (Trivy là nguồn bắt buộc của RCE)');

    // AC1.11 (phần mã nguồn): Coverity + SARIF cùng file:line + CWE-89 gộp một, ZAP không gộp
    const rm = gate({
      coverity: coverity([['src/Dao.java', 42, 'High', 89]]),
      sarif: [sarif([{ rule: 'sql', uri: 'src/Dao.java', line: 42, score: '7.5', cwe: 89 }])],
      zap: zap([['SQL Injection', 3, 89]]),
    }, { now: NOW });
    const merged = rm.findings.find((f) => f.key === 'src/Dao.java:42+CWE-89');
    ok(rm.findings.length === 2 && merged?.sources.length === 2 && merged.sources.includes('coverity') && merged.sources.includes('sarif'), 'AC1.11: Coverity + SARIF cùng file:line và CWE-89 gộp thành một finding có hai nguồn');
    ok(rm.findings.some((f) => f.key === 'SQL Injection@http://app/x' && f.sources.join() === 'zap'), 'AC1.11: ZAP giữ khoá alert@URL, không gộp với finding có file:line');

    // ---- Task 3: Nessus CSV, BlackDuck, Sonar, KEV; cộng với kiểm cấu trúc còn bỏ sót ở Task 2 ----
    const cnt = (inputs, k = 'critHigh') => gate(inputs, { now: NOW }).thresholds[k].count;

    // AC1.3: Nessus Risk
    const rn = gate({ nessus: nessus([
      ['1', 'CVE-2026-0001', 'Critical', 'H', '80', 'a'], ['2', 'CVE-2026-0002', 'High', 'H', '80', 'b'], ['3', 'CVE-2026-0003', 'Medium', 'H', '80', 'c'],
      ['4', 'CVE-2026-0004', 'Low', 'H', '80', 'd'], ['5', 'CVE-2026-0005', 'None', 'H', '80', 'e'],
      ['6', 'CVE-2026-0006', ' critical ', 'H', '80', 'f'],
    ]) }, { now: NOW });
    ok([1, 2, 3, 4, 5, 6].map((n) => sevOf(rn, `CVE-2026-000${n}@`)).join() === 'Critical,High,Medium,Low,Info,Critical', 'AC1.3: Nessus Risk Critical/High/Medium/Low/None → Critical/High/Medium/Low/Info, biến thể hoa/thường và khoảng trắng');
    ok([
      { nessus: nessus([['1', 'CVE-2026-0001', 'Severe', 'H', '80', 'a']]) },
      { nessus: nessus([['1', 'CVE-2026-0001', 'High']], ['Plugin ID', 'CVE', 'Host']) },
      { nessus: nessus([['1', 'CVE-2026-0001', 'High', '', '80', 'a']]) },
    ].every(throwsInput), 'AC1.3: Nessus Risk lạ, thiếu cột bắt buộc hoặc Host rỗng → InputError');
    ok(cnt({ nessus: nessus([]) }) === 0, 'AC1.5: Nessus CSV chỉ có header là nguồn hợp lệ, không finding');

    // AC1.19: ô CVE nhiều giá trị trong nháy kép, dòng không CVE, tên plugin có phẩy và nháy
    const r19 = gate({ nessus: nessus([
      ['10', 'CVE-2026-0301, CVE-2026-0302', 'High', 'H', '443', 'Apache, "Struts" RCE'],
      ['12345', '', 'High', 'H', '22', 'SSH\nweak'],
    ]) }, { now: NOW });
    ok(r19.findings.length === 3 && ['CVE-2026-0301@H', 'CVE-2026-0302@H', '12345@H'].every((k) => r19.findings.some((f) => f.key === k)), 'AC1.19: ô CVE hai giá trị → hai finding CVE@H; dòng không CVE → plugin@H; phẩy/nháy/xuống dòng trong ô nháy kép không làm lệch cột');
    ok(r19.thresholds.critHigh.count === 3 && r19.thresholds.kev.count === 0, 'AC1.19: dòng không CVE vẫn vào critHigh theo Risk nhưng không vào KEV');

    // AC1.14: cùng CVE trên 3 host + 1 image → 4 finding (đếm theo tài sản)
    ok(cnt({
      nessus: nessus([['9', 'CVE-2026-0400', 'Critical', 'H1', '1', 'x'], ['9', 'CVE-2026-0400', 'Critical', 'H2', '1', 'x'], ['9', 'CVE-2026-0400', 'Critical', 'H3', '1', 'x']]),
      trivy: trivy({ vulns: [['CVE-2026-0400', 'CRITICAL']] }),
    }) === 4, 'AC1.14: CVE-Y trên ba host và một image → critHigh = 4');
    ok(cnt({ nessus: nessus([['9', 'CVE-2026-0400', 'Critical', 'H1', '1', 'x'], ['9', 'CVE-2026-0400', 'Critical', 'H1', '2', 'x']]) }) === 1, 'AC1.14: cùng CVE cùng host khác port là một finding');

    // AC1.11 đủ ca: Trivy CVE-X@image + Nessus CVE-X@host riêng; Coverity + SARIF gộp; ZAP riêng
    const r11 = gate({
      trivy: trivy({ vulns: [['CVE-2026-0500', 'HIGH']] }),
      nessus: nessus([['9', 'CVE-2026-0500', 'High', 'H', '1', 'x']]),
      coverity: coverity([['src/Dao.java', 42, 'High', 89]]),
      sarif: [sarif([{ rule: 'sql', uri: 'src/Dao.java', line: 42, score: '7.5', cwe: 89 }])],
      zap: zap([['SQL Injection', 3, 89]]),
    }, { now: NOW });
    ok(r11.findings.length === 4 && r11.findings.filter((f) => f.cve?.includes('CVE-2026-0500')).length === 2, 'AC1.11: năm dòng nguồn → 4 finding (Trivy và Nessus riêng, Coverity + SARIF gộp, ZAP riêng)');

    // AC1.9: KEV khớp theo CVE; thiếu file → chưa đo; không gọi mạng
    const r9 = gate({ trivy: trivy({ vulns: [['CVE-2026-0100', 'HIGH'], ['CVE-2026-0101', 'HIGH']] }), kev: kevFile(['CVE-2026-0100'], '2026-11-18T00:00:00Z') }, { now: NOW });
    ok(r9.thresholds.kev.count === 1 && r9.findings.filter((f) => f.kev).map((f) => f.cve[0]).join() === 'CVE-2026-0100', 'AC1.9: KEV có CVE-A, Trivy có CVE-A và CVE-B → KEV = 1');
    ok(gate({ trivy: trivy({ vulns: [['CVE-2026-0100', 'HIGH']] }) }, { now: NOW }).thresholds.kev.status === 'chưa đo', 'AC1.9: không có file KEV → status chưa đo');
    ok(cnt({ nessus: nessus([['9', 'CVE-2026-0100', 'Low', 'H1', '1', 'x'], ['9', 'CVE-2026-0100', 'Low', 'H2', '1', 'x']]), kev: kevFile(['cve-2026-0100'], '2026-11-18T00:00:00Z') }, 'kev') === 2, 'AC1.9: KEV đếm theo tài sản và không phân biệt hoa/thường của CVE');
    ok(throwsInput({ kev: JSON.stringify({ catalogVersion: '1' }) }) && throwsInput({ kev: JSON.stringify({ vulnerabilities: [{ id: 'x' }] }) }), 'AC1.9: file KEV thiếu vulnerabilities hoặc cveID → InputError');
    const gateSrc = fs.readFileSync(scriptPath, 'utf8');
    ok(!/node:(http|https|net|dns|dgram|tls)|\bfetch\b|XMLHttpRequest/.test(gateSrc), 'AC1.9: source script không import mô-đun mạng và không dùng fetch');

    // AC1.18: tuổi file KEV
    const warnsOf = (kev) => gate({ trivy: trivy(), kev }, { now: NOW });
    const wOld = warnsOf(kevFile(['CVE-2026-0100'], '2026-11-01T00:00:00Z'));
    const wFresh = warnsOf(kevFile(['CVE-2026-0100'], '2026-11-15T00:00:00Z'));
    const wNone = warnsOf(kevFile(['CVE-2026-0100']));
    ok(wOld.warnings.length === 1 && /KEV/.test(wOld.warnings[0]), 'AC1.18: dateReleased cũ hơn 7 ngày → đúng một warning về tuổi file KEV');
    ok(wNone.warnings.length === 1 && /KEV/.test(wNone.warnings[0]), 'AC1.18: file KEV không có ngày → đúng một warning');
    ok(wFresh.warnings.length === 0 && wOld.thresholds.kev.status === wFresh.thresholds.kev.status && wNone.thresholds.kev.status === wFresh.thresholds.kev.status, 'AC1.18: file KEV mới không có warning; warning không đổi status');

    // AC1.16: BlackDuck CycloneDX
    const r16 = gate({ blackduck: blackduck([['CVE-2026-0200', ['critical'], 'P@1.0'], ['CVE-2026-0201', ['low'], 'Q@2.0']]) }, { now: NOW });
    ok(r16.thresholds.critHigh.count === 1 && r16.findings.some((f) => f.key === 'CVE-2026-0200@P@1.0' && f.sources.join() === 'blackduck'), 'AC1.16: critical trên P@1.0 + low trên Q@2.0 → critHigh = 1, khoá CVE@component@version');
    ok(sevOf(gate({ blackduck: blackduck([['CVE-2026-0202', ['low', 'High', 'medium'], 'R@1']]) }, { now: NOW }), 'CVE-2026-0202@') === 'High', 'AC1.16: nhiều ratings lấy mức cao nhất');
    ok(cnt({ blackduck: blackduck([['CVE-2026-0203', ['low'], 'R@1', [94]]]) }, 'rce') === 1, 'AC1.16: BlackDuck có CWE trong danh sách → RCE');
    ok([
      { blackduck: JSON.stringify({ bomFormat: 'CycloneDX', components: [] }) },
      { blackduck: blackduck([['CVE-2026-0204', ['catastrophic'], 'R@1']]) },
      { blackduck: JSON.stringify({ vulnerabilities: [{ id: 'CVE-2026-0205', ratings: [{ severity: 'high' }] }] }) },
    ].every(throwsInput), 'AC1.16: thiếu vulnerabilities, rating lạ hoặc thiếu affects → InputError');
    ok(cnt({ blackduck: blackduck([]) }) === 0, 'AC1.5: BlackDuck vulnerabilities rỗng là nguồn hợp lệ');

    // AC1.17: Sonar chỉ VULNERABILITY vào critHigh/RCE
    const r17 = gate({ sonar: sonar([['VULNERABILITY', 'BLOCKER', 'a.java', 1], ['BUG', 'CRITICAL', 'b.java', 2], ['CODE_SMELL', 'MAJOR', 'c.java', 3]]) }, { now: NOW });
    ok(r17.thresholds.critHigh.count === 1 && r17.findings.length === 1 && r17.findings[0].key === 'a.java:1', 'AC1.17: VULNERABILITY BLOCKER đếm, BUG và CODE_SMELL không vào findings');
    ok(cnt({ sonar: sonar([['VULNERABILITY', 'MINOR', 'a.java', 1, { cwe: ['CWE-78'] }], ['BUG', 'CRITICAL', 'b.java', 2, { cwe: ['CWE-78'] }]]) }, 'rce') === 1, 'AC1.17: RCE chỉ đếm issue VULNERABILITY có CWE trong danh sách');
    const sevSonar = (extra, severity = 'INFO') => sevOf(gate({ sonar: sonar([['VULNERABILITY', severity, 'a.java', 1, extra]]) }, { now: NOW }), 'a.java:1');
    ok(sevSonar({ impacts: [{ softwareQuality: 'SECURITY', severity: 'HIGH' }] }, 'MINOR') === 'High', 'AC1.17: impacts SECURITY cao hơn severity thì lấy impacts');
    ok(sevSonar({ impacts: [{ softwareQuality: 'MAINTAINABILITY', severity: 'HIGH' }] }) === 'Info', 'AC1.17: impacts không phải SECURITY bị bỏ qua');
    ok(sevSonar({}, 'BLOCKER') === 'Critical' && sevSonar({}, 'CRITICAL') === 'High' && sevSonar({}, 'MAJOR') === 'Medium' && sevSonar({}, 'MINOR') === 'Low', 'AC1.17: severity Sonar BLOCKER/CRITICAL/MAJOR/MINOR → Critical/High/Medium/Low');
    ok([
      { sonar: sonar([['VULNERABILITY', 'SEVERE', 'a.java', 1]]) },
      { sonar: JSON.stringify({ rules: [] }) },
      { sonar: JSON.stringify({ issues: [{ type: 'VULNERABILITY', severity: 'MAJOR' }] }) },
    ].every(throwsInput), 'AC1.17: severity lạ, thiếu issues hoặc thiếu component → InputError');
    ok(cnt({ sonar: sonar([]) }) === 0, 'AC1.5: Sonar issues rỗng là nguồn hợp lệ');

    // Kiểm cấu trúc còn bỏ sót ở Task 2: report hỏng một phần không được đếm thiếu im lặng
    const goodSarifRun = JSON.parse(sarif([{ rule: 'r', uri: 'a.js', line: 1, level: 'error' }])).runs[0];
    ok([
      { sarif: [JSON.stringify({ runs: [5] })] },
      { sarif: [JSON.stringify({ runs: [goodSarifRun, null] })] },
      { sarif: [sarifDoc({ results: '' })] },
      { sarif: [sarifDoc({ tool: { driver: { rules: [{ id: 'r', properties: { tags: 'external/cwe/cwe-78' } }] } }, results: [{ ruleId: 'r', level: 'error', locations: goodSarifRun.results[0].locations }] })] },
      { zap: zapDoc({ alert: 'A', riskcode: 1, cweid: 'abc' }) },
      { zap: zapDoc({ alert: 'A', riskcode: 1, cweid: [78] }) },
      { coverity: JSON.stringify({ issues: [{ mainEventFilePathname: 'a', mainEventLineNumber: 1, checkerProperties: { impact: 'High', cweCategory: 'abc' } }] }) },
    ].every(throwsInput), 'AC1.13: SARIF runs/results/tags, ZAP cweid, Coverity cweCategory sai cấu trúc → InputError, không bỏ qua im lặng');

    // ---- Task 4: trạng thái chỉ tiêu, nguồn bắt buộc, --na, overall ----
    // Fixture hợp lệ nhưng rỗng của từng nguồn: phải tính là "đã có nguồn", không phải chưa đo.
    const EMPTY = {
      gitleaksTree: '[]',
      gitleaksHistory: '[]',
      trivy: '{"Results":[]}',
      coverity: coverity([]),
      zap: JSON.stringify({ site: [] }),
      nessus: nessus([]),
      blackduck: blackduck([]),
      sonar: sonar([]),
      kev: kevFile([], '2026-11-18T00:00:00Z'),
    };
    const statusOf = (r) => Object.fromEntries(Object.entries(r.thresholds).map(([k, t]) => [k, t.status]));
    const without = (...drop) => Object.fromEntries(Object.entries(EMPTY).filter(([k]) => !drop.includes(k)));

    // AC1.5: đủ nguồn bắt buộc, không finding → đạt
    const rAll = gate(EMPTY, { now: NOW });
    ok(Object.values(statusOf(rAll)).every((s) => s === 'đạt') && rAll.overall === 'đạt', 'AC1.5: đủ mọi nguồn bắt buộc với report rỗng hợp lệ → bốn chỉ tiêu đạt, overall đạt');
    ok(Object.values(rAll.thresholds).every((t) => t.missing.length === 0), 'AC1.5: không chỉ tiêu nào còn missing');
    const rOne = gate({ ...EMPTY, trivy: trivy({ vulns: [['CVE-2026-0001', 'CRITICAL']] }), coverity: undefined }, { now: NOW });
    ok(rOne.thresholds.critHigh.status === 'không đạt' && rOne.thresholds.critHigh.missing.join() === 'coverity', 'AC1.5: thêm một Critical và thiếu Coverity → không đạt (một finding đã đủ kết luận), vẫn liệt kê nguồn thiếu');

    // AC1.4: thiếu Coverity → critHigh và rce chưa đo, secret và kev vẫn đạt; qua CLI exit 0
    const rNoCov = gate(without('coverity'), { now: NOW });
    ok(rNoCov.thresholds.critHigh.status === 'chưa đo' && rNoCov.thresholds.rce.status === 'chưa đo' && rNoCov.thresholds.critHigh.missing.join() === 'coverity', 'AC1.4: thiếu Coverity → critHigh và rce chưa đo, missing nêu coverity');
    ok(rNoCov.thresholds.secret.status === 'đạt' && rNoCov.thresholds.kev.status === 'đạt' && rNoCov.overall === 'chưa đo', 'AC1.4: secret và kev (không cần Coverity) vẫn đạt; overall chưa đo');
    const f4 = write({
      tree: EMPTY.gitleaksTree, hist: EMPTY.gitleaksHistory, trivy: EMPTY.trivy, zap: EMPTY.zap, nessus: EMPTY.nessus,
      bd: EMPTY.blackduck, sonar: EMPTY.sonar, kev: EMPTY.kev,
    });
    const rCli4 = cli(['--gitleaks-tree', f4.tree, '--gitleaks-history', f4.hist, '--trivy', f4.trivy, '--zap', f4.zap, '--nessus', f4.nessus, '--blackduck', f4.bd, '--sonar', f4.sonar, '--kev', f4.kev]);
    let out4 = {};
    try { out4 = JSON.parse(rCli4.stdout); } catch { /* đỏ bên dưới */ }
    ok(rCli4.status === 0 && out4.thresholds?.critHigh?.status === 'chưa đo', 'AC1.4: thiếu --coverity qua CLI → exit 0 và critHigh chưa đo (không đạt)');

    // AC1.6: --na
    const NA_NESSUS = 'không có VM trong đợt này';
    const rNa = gate({ kev: EMPTY.kev, trivy: EMPTY.trivy, blackduck: EMPTY.blackduck, na: { nessus: NA_NESSUS } }, { now: NOW });
    ok(rNa.thresholds.kev.status === 'đạt' && rNa.thresholds.kev.missing.length === 0 && rNa.thresholds.kev.na?.nessus === NA_NESSUS, 'AC1.6: --na nessus thay cho Nessus ở KEV, status theo nguồn còn lại, bằng chứng được chép lại');
    ok(rNa.thresholds.critHigh.missing.includes('nessus') === false && rNa.thresholds.critHigh.missing.includes('coverity'), 'AC1.6: --na nessus áp cho mọi chỉ tiêu có Nessus nhưng không che nguồn khác');
    const allNaKev = { kev: 'a', trivy: 'b', nessus: 'c', blackduck: 'd' };
    const rNaAll = gate({ na: allNaKev }, { now: NOW });
    ok(rNaAll.thresholds.kev.status === 'không áp dụng' && rNaAll.overall !== 'đạt', 'AC1.6: mọi nguồn bắt buộc của một chỉ tiêu đều --na → không áp dụng, không tính là đạt');
    ok(statusOf(gate({ ...without('nessus'), na: { nessus: NA_NESSUS } }, { now: NOW })).kev === 'đạt', 'AC1.6: --na và nguồn khác đã cung cấp → vẫn đạt');
    ok(throwsInput({ trivy: EMPTY.trivy, nessus: EMPTY.nessus, na: { nessus: 'x' } }) && throwsInput({ trivy: EMPTY.trivy, na: { khongco: 'x' } }), 'AC1.6: --na trùng với nguồn đã cung cấp hoặc tên nguồn lạ → InputError');
    ok([['--na', 'nessus'], ['--na', 'nessus='], ['--na', '=bang-chung'], ['--na']].every((a) => cli([...a, '--trivy', f4.trivy]).status === 2), 'AC1.6: --na thiếu bằng chứng, thiếu tên hoặc thiếu giá trị → exit 2');
    const rNaCli = cli(['--trivy', f4.trivy, '--na', `nessus=${NA_NESSUS}`, '--na', 'blackduck=không dùng Black Duck']);
    let outNa = {};
    try { outNa = JSON.parse(rNaCli.stdout); } catch { /* đỏ bên dưới */ }
    ok(rNaCli.status === 0 && outNa.thresholds?.kev?.na?.blackduck === 'không dùng Black Duck', 'AC1.6: --na lặp được qua CLI');

    // AC1.15: bảng overall
    const overallRows = [
      [['không đạt', 'đạt', 'đạt', 'đạt'], 'không đạt'],
      [['đạt', 'đạt', 'đạt', 'đạt'], 'đạt'],
      [['đạt', 'đạt', 'đạt', 'không áp dụng'], 'chưa đo'],
      [['đạt', 'chưa đo', 'đạt', 'đạt'], 'chưa đo'],
      [['chưa đo', 'không đạt', 'không áp dụng', 'đạt'], 'không đạt'],
      [['không áp dụng', 'không áp dụng', 'không áp dụng', 'không áp dụng'], 'chưa đo'],
    ];
    ok(typeof mod.overallOf === 'function' && overallRows.every(([statuses, want]) => mod.overallOf(statuses) === want), 'AC1.15: overallOf đúng từng dòng của bảng bốn trạng thái');

    // Mọi cờ nguồn đều có reader: mỗi nguồn với một Critical phải ra một finding được đếm, không bị bỏ qua im lặng
    const oneCritical = {
      trivy: trivy({ vulns: [['CVE-2026-0900', 'CRITICAL']] }),
      coverity: coverity([['a.java', 1, 'High', 89]]),
      zap: zap([['Z', 3]]),
      nessus: nessus([['1', 'CVE-2026-0901', 'Critical', 'H', '1', 'x']]),
      blackduck: blackduck([['CVE-2026-0902', ['critical'], 'P@1']]),
      sonar: sonar([['VULNERABILITY', 'BLOCKER', 'a.java', 1]]),
      sarif: [sarif([{ rule: 'r', uri: 'a.js', line: 1, score: '9.5' }])],
    };
    ok(Object.entries(oneCritical).every(([k, v]) => cnt({ [k]: v }) === 1), 'mọi cờ nguồn của critHigh đều có reader (không bỏ qua im lặng)');
    ok(cnt({ gitleaksTree: gitleaks([['r', 'f.js', 1]]) }, 'secret') === 1 && cnt({ gitleaksHistory: gitleaks([['r', 'f.js', 1]]) }, 'secret') === 1, 'mọi cờ nguồn của secret đều có reader');

    // Hoãn từ review Task 3: so khớp KEV không phân biệt hoa/thường ở mọi nguồn; tag số thuần của Sonar không phải CWE; CWE Coverity có khoảng trắng
    ok(cnt({ trivy: trivy({ vulns: [['cve-2026-0100', 'HIGH']] }), kev: kevFile(['CVE-2026-0100'], '2026-11-18T00:00:00Z') }, 'kev') === 1, 'AC1.9: CVE chữ thường của Trivy vẫn khớp KEV');
    ok(gate({ sonar: sonar([['VULNERABILITY', 'MAJOR', 'a.java', 1, { tags: ['2024', 'a1'] }]]) }, { now: NOW }).findings[0]?.key === 'a.java:1', 'AC1.10: tag số thuần của Sonar không tạo CWE');
    ok(gate({ coverity: coverity([['a.java', 1, 'High', ' 89']]) }, { now: NOW }).findings[0]?.key === 'a.java:1+CWE-89', 'AC1.11: cweCategory có khoảng trắng vẫn ra CWE');
  } finally {
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  }
}
