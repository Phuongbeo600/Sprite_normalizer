// 1. THƯ VIỆN NỀN TẢNG (Môi trường hook cô lập)
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

// 2. THƯ VIỆN BÊN NGOÀI (Bộ chuyển đổi đã có cùng Vite)
import { transformSync } from '../../../frontend/node_modules/esbuild/lib/main.js';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Không sử dụng)

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không cần giao diện)

/** Chạy hook với state, dependency và cleanup để kiểm tra workflow ngoại tuyến. */
export function mountHook(file, exportName, initialProps, globals = {}, overrides = {}) {
  const slots = [];
  let cursor = 0;
  let pending = [];
  let props = initialProps;
  let value;
  const same = (a, b) => a && b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (next) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useEffect(callback, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) pending.push(() => {
        slots[i]?.cleanup?.();
        slots[i] = { deps, cleanup: callback() };
      });
    },
    useMemo(callback, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { deps, value: callback() };
      return slots[i].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
  };
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const module = { exports: {} };
    const code = transformSync(readFileSync(path, 'utf8'), { loader: path.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs' }).code;
    vm.runInNewContext(code, {
      module, exports: module.exports, console, File, Blob, AbortController, URL,
      setTimeout, clearTimeout, ...globals,
      require(id) {
        if (id === 'react') return react;
        if (id in overrides) return overrides[id];
        const base = resolve(dirname(path), id);
        return load(/\.(js|jsx)$/.test(base) ? base : `${base}.js`);
      },
    }, { filename: path });
    cache.set(path, module.exports);
    return module.exports;
  }
  const hook = load(resolve(file))[exportName];
  function render(nextProps = props) {
    props = nextProps;
    cursor = 0;
    pending = [];
    value = hook(props);
    return value;
  }
  render();
  return {
    get value() { return value; }, render,
    flushEffects() { const run = pending; pending = []; run.forEach((callback) => callback()); },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
  };
}
