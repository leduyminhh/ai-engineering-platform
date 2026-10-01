// Trình phân tích cờ dòng lệnh cho `aip` — tách khỏi index.mjs để unit-test độc lập.
// Zero-dependency.

/** Tách chuỗi CSV thành mảng đã trim, bỏ phần tử rỗng. */
function csv(s) {
  return String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
}

export function parse(argv) {
  const a = { _: [], scope: 'project', provider: 'all', plugin: 'all', skill: [], target: 'all', mode: 'skills' };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '-g' || v === '--global') a.scope = 'global';
    else if (v === '--provider') { a.provider = argv[++i]; a.explicit = true; }
    else if (v === '--plugin') { a.plugin = argv[++i]; a.explicit = true; a.pluginExplicit = true; }
    else if (v === '--skill') { a.skill = csv(argv[++i]); a.explicit = true; }
    else if (v === '--all') a.all = true; // cố ý KHÔNG đặt explicit: --all chỉ mở rộng cây wizard, vẫn vào wizard
    else if (v === '--target') a.target = argv[++i];
    else if (v === '--as-plugin') { a.mode = 'plugin'; a.explicit = true; } // claude: cài như plugin (qua `claude` CLI)
    else if (v.startsWith('--provider=')) { a.provider = v.slice(11); a.explicit = true; }
    else if (v.startsWith('--plugin=')) { a.plugin = v.slice(9); a.explicit = true; a.pluginExplicit = true; }
    else if (v.startsWith('--skill=')) { a.skill = csv(v.slice(8)); a.explicit = true; }
    else if (v.startsWith('--target=')) a.target = v.slice(9);
    else if (v === '-h' || v === '--help') a.help = true;
    else a._.push(v);
  }
  return a;
}
