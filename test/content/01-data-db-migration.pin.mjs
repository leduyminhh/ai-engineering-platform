// Pin nội dung: data-db-migration.
export default async function run({ ok, ctx }) {
  const { fs, path, PLUGINS_DIR, frontmatter, listFilesRec, core } = ctx;

  // 8. SOURCE: data-db-migration — hợp đồng references/ (spec 2026-09-29 §7.1, G2 §5–§7; ADR 0001: skill thuộc plugin data)
  {
    const dbmRef = path.join(PLUGINS_DIR, 'data', 'skills', 'data-db-migration', 'references');
    const dbmFiles = listFilesRec(dbmRef);
    const dbmRead = (rel) => fs.readFileSync(path.join(dbmRef, rel), 'utf8');
    const skillPath = path.join(dbmRef, '..', 'SKILL.md');
    const skillExists = fs.existsSync(skillPath);
    ok(skillExists, 'data-db-migration: có SKILL.md');
    const skillMd = skillExists ? fs.readFileSync(skillPath, 'utf8') : '';
    // ADR 0001: mọi năng lực liên quan database thuộc plugin data; bản cũ ở backend phải biến mất hẳn.
    ok(!fs.existsSync(path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-db-migration')),
      'data-db-migration: không còn thư mục backend-db-migration ở plugin backend');
    ok(/^name: data-db-migration$/m.test(skillMd) && /^order: 5$/m.test(skillMd),
      'data-db-migration: frontmatter name, order 5 trong plugin data');
    for (const f of ['adopt/inventory-checklist.md', 'adopt/tool-comparison-rubric.md']) {
      ok(dbmFiles.includes(f), `data-db-migration: có references/${f}`);
      ok(skillMd.includes(`(references/${f})`), `data-db-migration: SKILL.md link tới references/${f}`);
    }
    const rubric = dbmFiles.includes('adopt/tool-comparison-rubric.md') ? dbmRead('adopt/tool-comparison-rubric.md') : '';
    ok(['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].every((t) => rubric.includes(`| ${t} |`)),
      'data-db-migration: rubric đủ 6 tiêu chí T1–T6');
    ok(/\|\s*Bằng chứng\s*\|/.test(rubric), 'data-db-migration: rubric bắt buộc cột Bằng chứng');
    for (const f of ['change/change-patterns.md', 'change/lock-risk-postgres.md', 'change/verify-cycle.md']) {
      ok(dbmFiles.includes(f), `data-db-migration: có references/${f}`);
      ok(skillMd.includes(`(references/${f})`), `data-db-migration: SKILL.md link tới references/${f}`);
    }
    const cycle = dbmFiles.includes('change/verify-cycle.md') ? dbmRead('change/verify-cycle.md') : '';
    ok(['## Flyway', '## Liquibase', '## Alembic'].every((h) => cycle.includes(h)),
      'data-db-migration: verify-cycle có đủ Flyway / Liquibase / Alembic');
    ok(cycle.includes('forward-only'), 'data-db-migration: verify-cycle nêu Flyway forward-only (M3)');
    // Lệnh chờ ACCESS EXCLUSIVE chặn cả SELECT đến sau; mẫu thiếu lock_timeout sẽ bị chép nguyên vào project.
    const patterns = dbmFiles.includes('change/change-patterns.md') ? dbmRead('change/change-patterns.md') : '';
    const sqlSegments = [...patterns.matchAll(/```sql\n([\s\S]*?)```/g)]
      .flatMap((m) => m[1].split(/^(?=-- migration)/m));
    ok(sqlSegments.length > 0 && sqlSegments
      .filter((s) => /ADD CONSTRAINT|SET NOT NULL/.test(s)).every((s) => s.includes('lock_timeout')),
      'data-db-migration: mẫu ADD CONSTRAINT/SET NOT NULL có lock_timeout');
    const lock = dbmFiles.includes('change/lock-risk-postgres.md') ? dbmRead('change/lock-risk-postgres.md') : '';
    ok(lock.includes('| Nguồn |'), 'data-db-migration: bảng rủi ro khoá có cột Nguồn');
    const lockRows = lock.split('\n').filter((l) => l.startsWith('|'));
    ok(lockRows.some((l) => l.includes('https://')), 'data-db-migration: bảng rủi ro khoá có link nguồn https://');
    ok(!lockRows.some((l) => /\|\s*[LFQ]\d+(,\s*[LFQ]\d+)*\s*\|/.test(l)),
      'data-db-migration: bảng rủi ro khoá không dùng mã nguồn viết tắt (L1/F1/Q1)');
    const sbFiles = dbmFiles.filter((f) => f.startsWith('spring-boot/'));
    const sbRead = (rel) => dbmRead(rel);
    for (const f of ['module-pom.xml.tpl', 'DbMigrationApplication.java.tpl', 'application-migration.yml',
      'env.example']) {
      ok(sbFiles.includes(`spring-boot/common/${f}`), `data-db-migration: có spring-boot/common/${f}`);
    }
    // B2 của G2: env.example thừa/thiếu key so với yml là lỗi im lặng lúc chạy job.
    const ymlVars = new Set(sbFiles.filter((f) => f.endsWith('.yml'))
      .flatMap((f) => [...sbRead(f).matchAll(/\$\{([A-Z0-9_]+)(?::[^}]*)?\}/g)].map((m) => m[1])));
    const envKeys = new Set(sbFiles.includes('spring-boot/common/env.example')
      ? [...sbRead('spring-boot/common/env.example').matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]) : []);
    ok(ymlVars.size > 0 && [...ymlVars].every((v) => envKeys.has(v)) && [...envKeys].every((k) => ymlVars.has(k)),
      `data-db-migration: env.example khớp đúng biến yml (yml=${[...ymlVars].sort()} env=${[...envKeys].sort()})`);
    // D1–D3, B1 của G2: bean tự viết vô hiệu autoconfig; spring.factories trỏ class không tồn tại.
    ok(!dbmFiles.some((f) => f.endsWith('spring.factories')), 'data-db-migration: không ship spring.factories');
    ok(sbFiles.filter((f) => f.endsWith('.tpl')).every((f) => !sbRead(f).includes('@Configuration')),
      'data-db-migration: template không có @Configuration tự viết');
    const pom = sbFiles.includes('spring-boot/common/module-pom.xml.tpl') ? sbRead('spring-boot/common/module-pom.xml.tpl') : '';
    ok(pom.includes('<artifactId>flyway-core</artifactId>') && pom.includes('<artifactId>liquibase-core</artifactId>')
      && !/<artifactId>(flyway-core|flyway-database-postgresql|liquibase-core)<\/artifactId>\s*<version>/.test(pom),
      'data-db-migration: pom có cả hai khối công cụ, không ghim version (để BOM pin)');
    const fw = sbFiles.filter((f) => f.startsWith('spring-boot/flyway/db/migration/'));
    const baseName = (f) => f.split('/').pop();
    ok(sbFiles.includes('spring-boot/flyway/application-flyway.yml') && sbFiles.includes('spring-boot/flyway/CONVENTIONS.md'),
      'data-db-migration: có flyway/application-flyway.yml + CONVENTIONS.md');
    ok(fw.length === 5, `data-db-migration: layout mẫu flyway đủ 5 file (=${fw.length})`);
    // B4 của G2: sai separator thì Flyway bỏ qua migration mà không báo.
    ok(fw.every((f) => /^(V\d{14}__[a-z0-9_]+\.sql\.(tpl|conf)|R__[a-z0-9_]+\.sql\.tpl)$/.test(baseName(f))),
      'data-db-migration: tên file flyway đúng V<14 số>__ / R__');
    ok(fw.filter((f) => f.endsWith('.conf')).every((c) => fw.includes(c.replace(/\.conf$/, '.tpl'))),
      'data-db-migration: mỗi .conf có migration mẫu cùng tên');
    const fwRoot = 'spring-boot/flyway/db/migration/';
    ok(fw.every((f) => (baseName(f).startsWith('R__')
      ? f.startsWith(`${fwRoot}repeatable/`)
      : f.startsWith(`${fwRoot}baseline/`) || f.startsWith(`${fwRoot}versioned/`))),
      'data-db-migration: file flyway đúng thư mục baseline/versioned/repeatable');
    const lbRoot = 'spring-boot/liquibase/db/changelog/';
    const lb = sbFiles.filter((f) => f.startsWith(lbRoot));
    ok(sbFiles.includes('spring-boot/liquibase/application-liquibase.yml') && sbFiles.includes('spring-boot/liquibase/CONVENTIONS.md'),
      'data-db-migration: có liquibase/application-liquibase.yml + CONVENTIONS.md');
    const lbMaster = lb.includes(lbRoot + 'db.changelog-master.yaml') ? sbRead(lbRoot + 'db.changelog-master.yaml') : '';
    const lbIncludes = [...lbMaster.matchAll(/file:\s*(\S+\.yaml)/g)].map((m) => m[1]);
    ok(lbIncludes.length === 3 && lbIncludes.every((i) => lb.includes(lbRoot + i)),
      `data-db-migration: master include đủ 3 changelog có thật (=${lbIncludes})`);
    const lbSets = lb.filter((f) => f.endsWith('.yaml') && !f.endsWith('db.changelog-master.yaml'));
    // D6 của G2: changeSet thiếu rollback thì trả chi phí Liquibase mà mất lợi ích chính.
    ok(lbSets.length === 3 && lbSets.every((f) => {
      const c = sbRead(f);
      return (c.match(/- changeSet:/g) || []).length === (c.match(/^\s+rollback:/gm) || []).length;
    }), 'data-db-migration: mỗi changeSet mẫu có rollback');
    ok(lbSets.every((f) => [...sbRead(f).matchAll(/path:\s*(\S+)/g)].every((m) => {
      const p = path.posix.join(path.posix.dirname(f), m[1]);
      return lb.includes(p) || lb.includes(p + '.tpl');
    })), 'data-db-migration: sqlFile trong changeSet trỏ tới file có thật');
    // SET LOCAL không có tác dụng trong changeSet runInTransaction: false; luật phải tách hai trường hợp.
    const lbConv = sbFiles.includes('spring-boot/liquibase/CONVENTIONS.md') ? sbRead('spring-boot/liquibase/CONVENTIONS.md') : '';
    ok(lbConv.includes('SET LOCAL lock_timeout') && lbConv.includes('RESET lock_timeout'),
      'data-db-migration: CONVENTIONS liquibase tách luật lock_timeout trong/ngoài transaction');
    ok(dbmFiles.includes('README.md') && !dbmFiles.includes('spring-boot/README.md'),
      'data-db-migration: README ở gốc references/, không ở spring-boot/ (trùng path với vault-consul)');
    ok(skillMd.includes('(references/README.md)'), 'data-db-migration: SKILL.md link tới references/README.md');
    const readme = dbmFiles.includes('README.md') ? dbmRead('README.md') : '';
    ok(sbFiles.every((f) => readme.includes(f.replace(/^spring-boot\//, ''))),
      'data-db-migration: README liệt kê mọi file template spring-boot/');
    // Job chỉ chạy update: thiếu precondition MARK_RAN thì baseline chạy DDL trên DB đã có schema.
    ok(readme.includes('MARK_RAN') && readme.includes('changelog-sync'),
      'data-db-migration: README có đường adopt Liquibase cho DB đã có dữ liệu (MARK_RAN + changelog-sync)');
    ok(readme.includes('bỏ đuôi `.tpl`'), 'data-db-migration: README nêu quy tắc bỏ đuôi .tpl khi copy template');
  }
}
