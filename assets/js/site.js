// Menu toggle (mobile)
const toggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

// Centre filters
document.querySelectorAll('.filters').forEach((bar) => {
  const grid = bar.parentElement.querySelector('[data-filterable]');
  if (!grid) return;
  bar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-filter]');
    if (!btn) return;
    const f = btn.dataset.filter;
    bar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    grid.querySelectorAll('[data-centre]').forEach((card) => {
      card.style.display = f === 'all' || card.dataset.centre === f ? '' : 'none';
    });
  });
});

// Lightbox
const grid = document.querySelector('[data-lightbox]');
const box = document.querySelector('.lightbox');
if (grid && box) {
  const items = [...grid.querySelectorAll('button[data-full]')];
  const img = box.querySelector('img');
  const count = box.querySelector('.count');
  let i = 0;
  const show = (n) => {
    i = (n + items.length) % items.length;
    img.src = items[i].dataset.full;
    count.textContent = `${i + 1} / ${items.length}`;
  };
  const open = (n) => { show(n); box.classList.add('open'); document.body.style.overflow = 'hidden'; box.querySelector('.close').focus(); };
  const close = () => { box.classList.remove('open'); document.body.style.overflow = ''; items[i].focus(); };
  items.forEach((b, n) => b.addEventListener('click', () => open(n)));
  box.querySelector('.close').addEventListener('click', close);
  box.querySelector('.next').addEventListener('click', () => show(i + 1));
  box.querySelector('.prev').addEventListener('click', () => show(i - 1));
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  document.addEventListener('keydown', (e) => {
    if (!box.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(i + 1);
    if (e.key === 'ArrowRight') show(i - 1);
  });
}

// Dropdown menus (click / keyboard)
document.querySelectorAll('.dd').forEach((dd) => {
  const btn = dd.querySelector('.dd-btn');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !dd.classList.contains('open');
    document.querySelectorAll('.dd.open').forEach((o) => { o.classList.remove('open'); o.querySelector('.dd-btn').setAttribute('aria-expanded', 'false'); });
    dd.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  });
});
document.addEventListener('click', () => document.querySelectorAll('.dd.open').forEach((o) => o.classList.remove('open')));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.dd.open').forEach((o) => o.classList.remove('open')); });
