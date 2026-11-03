// Trình phân tích cờ dòng lệnh cho `aip` — tách khỏi index.mjs để unit-test độc lập.
// Zero-dependency.

/** Tách chuỗi CSV thành mảng đã trim, bỏ phần tử rỗng. */
function csv(s) {
  return String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
}

// Cờ vòng đời nhận giá trị: thiếu giá trị (hết argv, token kế là một cờ, hoặc dạng `=` rỗng) từng thành undefined = "không lọc" nên uninstall gỡ hết.
function need(flag, v) {
  if (v === undefined || v.trim() === '' || v.startsWith('-')) throw new Error(`Cờ ${flag} cần một giá trị (xem aip --help)`);
  return v;
}
function needList(flag, v) {
  const list = csv(need(flag, v));
  if (!list.length) throw new Error(`Cờ ${flag} cần ít nhất một giá trị (xem aip --help)`);
  return list;
}

export function parse(argv) {
  const a = { _: [], scope: 'project', provider: 'all', plugin: 'all', skill: [], target: 'all', mode: 'skills' };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '-g' || v === '--global') a.scope = 'global';
    else if (v === '--provider') { a.provider = need('--provider', argv[++i]); a.explicit = true; }
    else if (v === '--plugin') { a.plugin = need('--plugin', argv[++i]); a.explicit = true; a.pluginExplicit = true; }
    else if (v === '--skill') { a.skill = needList('--skill', argv[++i]); a.explicit = true; }
    else if (v === '--all') a.all = true; // cố ý KHÔNG đặt explicit: --all chỉ mở rộng cây wizard, vẫn vào wizard
    else if (v === '--target') a.target = need('--target', argv[++i]);
    else if (v === '--full') a.full = true;
    else if (v === '--session') a.session = argv[++i];
    else if (v.startsWith('--session=')) a.session = v.slice(10);
    else if (v === '--usage') a.usage = true;
    else if (v === '--since') a.since = argv[++i] ?? '';
    else if (v.startsWith('--since=')) a.since = v.slice(8);
    else if (v === '--json') a.json = true;
    else if (v === '--soft') a.soft = argv[++i];
    else if (v.startsWith('--soft=')) a.soft = v.slice(7);
    else if (v === '--hard') a.hard = argv[++i];
    else if (v.startsWith('--hard=')) a.hard = v.slice(7);
    else if (v === '--no-color') a.noColor = true;
    else if (v === '--html') a.html = true;
    else if (v === '--watch') a.watch = true;
    else if (v === '--part') a.part = argv[++i];
    else if (v.startsWith('--part=')) a.part = v.slice(7);
    else if (v === '--as-plugin') { a.mode = 'plugin'; a.explicit = true; } // claude: cài như plugin (qua `claude` CLI)
    else if (v.startsWith('--provider=')) { a.provider = need('--provider', v.slice(11)); a.explicit = true; }
    else if (v.startsWith('--plugin=')) { a.plugin = need('--plugin', v.slice(9)); a.explicit = true; a.pluginExplicit = true; }
    else if (v.startsWith('--skill=')) { a.skill = needList('--skill', v.slice(8)); a.explicit = true; }
    else if (v.startsWith('--target=')) a.target = need('--target', v.slice(9));
    else if (v === '-h' || v === '--help') a.help = true;
    else if (v === '-y' || v === '--yes') a.yes = true;
    // Cờ gõ sai mà bỏ qua thì plugin giữ mặc định 'all' → cài/gỡ mọi plugin ngoài ý muốn.
    else if (v.startsWith('-')) throw new Error(`Cờ không hợp lệ: ${v} (xem aip --help)`);
    else a._.push(v);
  }
  return a;
}
