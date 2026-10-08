/* 首頁下方的菜價抽屜：peek（只露出搜尋列）／half／full。拖曳或點把手切換；在搜尋框打字時自動全開。 */
(function () {
  'use strict';
  const el = document.getElementById('drawer'), handle = document.getElementById('drawerHandle');
  const body = document.getElementById('drawerBody'), search = document.getElementById('foodSearch');
  const PEEK = 92, ORDER = ['peek', 'half', 'full'];
  let state = 'peek', drag = null;

  const offset = s => {
    const h = el.clientHeight;
    return s === 'full' ? 0 : s === 'half' ? Math.round(h * .42) : Math.max(0, h - PEEK);
  };
  function apply(px) { el.style.transform = `translateY(${px}px)`; }
  function set(next) {
    state = next;
    el.dataset.state = next;
    handle.setAttribute('aria-expanded', String(next !== 'peek'));
    if (next === 'peek') body.scrollTop = 0;
    apply(offset(next));
  }

  handle.addEventListener('pointerdown', e => {
    drag = { id: e.pointerId, y: e.clientY, from: offset(state), moved: false };
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) > 6 && !drag.moved) { drag.moved = true; el.classList.add('dragging'); }
    if (drag.moved) apply(Math.min(offset('peek'), Math.max(0, drag.from + dy)));
  });
  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved, at = drag.from + (e.clientY - drag.y);
    drag = null;
    el.classList.remove('dragging');
    if (!moved) { set(ORDER[(ORDER.indexOf(state) + 1) % ORDER.length]); return; }
    // Snap to whichever state is nearest to where the finger let go.
    set(ORDER.reduce((a, b) => Math.abs(offset(b) - at) < Math.abs(offset(a) - at) ? b : a));
  }
  handle.addEventListener('pointerup', release);
  handle.addEventListener('pointercancel', release);
  handle.addEventListener('click', e => { if (e.detail === 0) set(ORDER[(ORDER.indexOf(state) + 1) % ORDER.length]); });  // Enter / Space
  handle.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') { set(ORDER[Math.min(2, ORDER.indexOf(state) + 1)]); e.preventDefault(); }
    if (e.key === 'ArrowDown') { set(ORDER[Math.max(0, ORDER.indexOf(state) - 1)]); e.preventDefault(); }
  });
  search.addEventListener('focus', () => { if (state !== 'full') set('full'); });
  new ResizeObserver(() => apply(offset(state))).observe(el);
  set('peek');

  window.Drawer = { set, get: () => state };
})();
