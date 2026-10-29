// Static site generator for the SGF website (no dependencies).
// Content comes from data/*.json. In the next phase the events, news and
// albums files are filled automatically from Zoho CRM before each build.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = dirname(new URL(import.meta.url).pathname);
const OUT = join(ROOT, 'dist');
const read = (f) => JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8'));

const site = read('site.json');
const khobar = read('khobar.json');
const people = read('people.json');
const coaches = read('coaches.json');
const partners = read('partners.json');
const published = (a) => a.filter((x) => x.status === 'published');
const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '');
const events = published(read('events.json')).sort(byDateDesc);
const albums = published(read('albums.json')).sort(byDateDesc);
const news = published(read('news.json')).sort(byDateDesc);

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const fmtDate = (d) => { if (!d) return ''; const [y, m, day] = d.split('-').map(Number); return `${day} ${MONTHS[m - 1]} ${y}`; };
const fmtRange = (e) => {
  if (e.date_label) return e.date_label;
  if (!e.date_end) return fmtDate(e.date);
  const [y1, m1, d1] = e.date.split('-').map(Number); const [y2, m2, d2] = e.date_end.split('-').map(Number);
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${MONTHS[m1 - 1]} ${y1}`;
  return `${fmtDate(e.date)} – ${fmtDate(e.date_end)}`;
};
const centre = (k) => site.centres[k] || site.centres.federation;
const liveCentres = Object.values(site.centres).filter((c) => c.page);
const today = new Date().toISOString().slice(0, 10);
const TYPE = { competition: 'بطولة', event: 'فعالية', news: 'خبر' };
const wa = (c) => `https://wa.me/${c.whatsapp}`;

// ---------- layout ----------
const NAV = [
  { href: '/', label: 'الرئيسية', key: 'home' },
  { label: 'عن الاتحاد', key: 'about', children: [['/about/team/', 'مجلس الإدارة والفريق'], ['/about/coaches/', 'المدربون'], ['/about/partners/', 'الأندية والشركاء']] },
  { label: 'مراكز التدريب', key: 'centres', children: [...liveCentres.map((c) => [`/centres/${c.slug}/`, c.name]), ['/#centres', 'كل المراكز']] },
  { label: 'المركز الإعلامي', key: 'media', children: [['/events/', 'البطولات والفعاليات'], ['/news/', 'الأخبار'], ['/gallery/', 'معرض الصور'], ['/media/', 'كل المحتوى الإعلامي']] },
];

function navHtml(active) {
  return NAV.map((n) => {
    const cls = n.key === active ? ' class="active" aria-current="page"' : '';
    if (!n.children) return `<a href="${n.href}"${cls}>${n.label}</a>`;
    const items = n.children.map(([h, l]) => `<a href="${h}">${l}</a>`).join('');
    return `<div class="dd"><button type="button" class="dd-btn${n.key === active ? ' active' : ''}" aria-expanded="false">${n.label} <span aria-hidden="true">▾</span></button><div class="dd-menu">${items}</div></div>`;
  }).join('');
}

function layout({ title, desc = site.tagline, active = '', body, extraHead = '' }) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}${title === site.name ? '' : ' | ' + esc(site.name)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<link rel="icon" href="/assets/img/sgf_emblem.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@600;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/assets/css/site.css">${extraHead}
</head>
<body>
<div class="preview-bar">نسخة معاينة أولية — المحتوى والتصميم قابلان للتحديث</div>
<header class="site-header">
  <div class="wrap">
    <a class="logo" href="/"><img src="/assets/img/sgf_logo_horizontal.png" alt="${esc(site.name)}" width="229" height="48"></a>
    <button class="menu-toggle" aria-expanded="false" aria-controls="nav">القائمة ☰</button>
    <nav id="nav" class="nav" aria-label="القائمة الرئيسية">${navHtml(active)}<a class="nav-portal" href="${site.portal.url}">${site.portal.label}</a><a class="lang" href="#" title="قريبًا">English</a></nav>
    <div class="header-cta">
      <a class="btn btn-outline" href="${site.portal.url}" title="${esc(site.portal.note)}">🔐 ${site.portal.label}</a>
      <a class="btn btn-primary" href="${site.register_url}">سجّل الآن</a>
    </div>
  </div>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="cols">
      <div class="col"><img src="/assets/img/sgf_logo_horizontal_white.png" alt="${esc(site.name)}"><p style="margin:0">نطوّر رياضة الجمباز في المملكة من المراكز إلى المنتخبات.</p></div>
      <div class="col"><p class="h">عن الاتحاد</p><a href="/about/team/">مجلس الإدارة والفريق</a><a href="/about/coaches/">المدربون</a><a href="/about/partners/">الأندية والشركاء</a></div>
      <div class="col"><p class="h">المركز الإعلامي</p><a href="/events/">البطولات والفعاليات</a><a href="/news/">الأخبار</a><a href="/gallery/">معرض الصور</a><a href="${site.register_url}">التسجيل</a><a href="${site.portal.url}">${site.portal.label}</a></div>
      <div class="col"><p class="h">تواصل معنا</p>
        ${liveCentres.map((c) => `<span>${c.name}: <a href="${wa(c)}"><bdi dir="ltr">${c.whatsapp_label}</bdi></a></span>`).join('')}
      </div>
    </div>
    <p class="copy">© ${new Date().getFullYear()} ${esc(site.name)}</p>
  </div>
</footer>
<script src="/assets/js/site.js" defer></script>
</body>
</html>`;
}

// ---------- components ----------
const ph = `<img class="ph" src="/assets/img/sgf_emblem.png" alt="" aria-hidden="true">`;
const secHead = (eyebrow, title, sub = '') => `<div class="sec-head"><p class="eyebrow">${eyebrow}</p><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>`;
const pageHero = ({ crumbs = [], title, sub = '', extra = '' }) => `<section class="page-hero">${crumbs.length ? `<div class="crumbs">${[['/', 'الرئيسية'], ...crumbs].map(([h, l]) => `<a href="${h}">${l}</a>`).join(' › ')}</div>` : ''}<h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}${extra}</section>`;
const mediaTabs = (active) => `<nav class="tabs" aria-label="أقسام المركز الإعلامي">${[['hub', '/media/', 'الكل'], ['events', '/events/', 'البطولات والفعاليات'], ['news', '/news/', 'الأخبار'], ['gallery', '/gallery/', 'معرض الصور']].map(([k, h, l]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
const MEDIA = ['/media/', 'المركز الإعلامي'];
const aboutTabs = (active) => `<nav class="tabs" aria-label="أقسام عن الاتحاد">${[['team', '/about/team/', 'مجلس الإدارة والفريق'], ['coaches', '/about/coaches/', 'المدربون'], ['partners', '/about/partners/', 'الأندية والشركاء']].map(([k, h, l]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;

function eventCard(e) {
  const c = centre(e.centre);
  const media = e.cover ? `<img src="${esc(e.cover)}" alt="" loading="lazy">` : ph;
  const upcoming = (e.date_end || e.date) >= today;
  return `<a class="card" href="/events/${e.slug}/" data-centre="${e.centre}">
  <div class="media">${media}</div>
  <div class="body">
    <div class="meta"><span class="tag" style="--tc:${c.color}">${esc(c.short)}</span><span>${esc(TYPE[e.type] || 'فعالية')}</span>${upcoming ? '<span class="tag" style="--tc:#B36B00">قادمة</span>' : ''}</div>
    <h3>${esc(e.title)}</h3>
    <div class="meta"><span>📅 ${esc(fmtRange(e))}</span><span>📍 ${esc(e.location)}</span></div>
    <p>${esc(e.summary)}</p>
    <span class="more">التفاصيل ←</span>
  </div>
</a>`;
}

function newsCard(n) {
  const c = centre(n.centre);
  const media = n.cover ? `<img src="${esc(n.cover)}" alt="" loading="lazy">` : ph;
  return `<a class="card" href="/news/${n.slug}/" data-centre="${n.centre}">
  <div class="media">${media}</div>
  <div class="body">
    <div class="meta"><span class="tag" style="--tc:${c.color}">${esc(c.short)}</span><span>${esc(fmtDate(n.date))}</span></div>
    <h3>${esc(n.title)}</h3>
    <p>${esc(n.summary)}</p>
    <span class="more">اقرأ الخبر ←</span>
  </div>
</a>`;
}

function albumCard(a) {
  const c = centre(a.centre);
  return `<a class="card" href="/gallery/${a.slug}/" data-centre="${a.centre}">
  <div class="media"><img src="${a.photo_dir}${a.cover}-sm.webp" alt="" loading="lazy"></div>
  <div class="body">
    <div class="meta"><span class="tag" style="--tc:${c.color}">${esc(c.short)}</span><span>${esc(fmtDate(a.date))}</span><span>🖼 ${a.photos.length} صورة</span></div>
    <h3>${esc(a.title)}</h3>
    <span class="more">عرض الألبوم ←</span>
  </div>
</a>`;
}

const personCard = (p, sub = '') => `<article class="person"><div class="photo">${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">` : ph}</div><h3>${esc(p.name)}</h3><p class="role">${esc(p.role)}</p>${sub ? `<p class="sub">${sub}</p>` : ''}</article>`;

const filterBar = (keys) => `<div class="filters" role="group" aria-label="تصفية حسب المركز">
  <button type="button" data-filter="all" aria-pressed="true">الكل</button>
  ${keys.map((k) => `<button type="button" data-filter="${k}" aria-pressed="false">${esc(site.centres[k].short)}</button>`).join('')}
</div>`;

function centreCard(c) {
  if (c.soon) return `<article class="centre soon"><p class="city" style="--c:var(--muted)">${c.short}</p><h3>${c.name}</h3><p class="addr">التفاصيل قريبًا</p><span class="pill-muted">قريبًا</span></article>`;
  return `<article class="centre" style="--c:${c.color}"><p class="city">${c.short}</p><h3>${c.name}</h3><p class="addr">${esc(c.address)}</p><p>الأوقات: ${c.hours}<br>${c.days}</p><div class="acts"><a class="btn btn-primary btn-sm" href="/centres/${c.slug}/">صفحة المركز</a><a class="btn btn-soft" href="${wa(c)}">واتساب المركز</a></div></article>`;
}

function portalBand() {
  return `<section class="section"><div class="wrap"><div class="band">
  <div class="band-text"><p class="eyebrow-light">لأولياء الأمور واللاعبين</p><h2>${site.portal.label}</h2>
  <p>تابع اشتراك طفلك وحضوره وتقييماته، وارفع إيصال التحويل، وتواصل مع المركز — من مكان واحد.</p>
  <p class="small">💻 ${esc(site.portal.note)}</p></div>
  <div class="band-acts"><a class="btn btn-accent" href="${site.portal.url}">الدخول إلى البوابة</a><a class="btn btn-ghost" href="${site.register_url}">تسجيل لاعب جديد</a></div>
</div></div></section>`;
}

// ---------- pages ----------
function home() {
  const upcoming = events.filter((e) => (e.date_end || e.date) >= today);
  const latestEvents = [...[...upcoming].reverse(), ...events.filter((e) => !upcoming.includes(e))].slice(0, 3);
  const quick = [
    ['#EB0045', 'سجّل الآن', 'نموذج تسجيل سريع للاعبين الجدد من عمر 5 سنوات.', site.register_url, 'ابدأ التسجيل'],
    ['#FFA500', 'الباقات والأسعار', 'اشتراكات شهرية تبدأ من 800 ريال، بأوقات تناسب الجميع.', '/centres/khobar/#packages', 'عرض الباقات'],
    ['#0075C9', 'جداول البطولات', 'مواعيد البطولات والفعاليات القادمة في مراكز الاتحاد.', '/events/', 'عرض الجداول'],
    ['#0A5640', 'مراكز التدريب', 'اختر المركز الأقرب إليك: الخبر، الرياض، وقريبًا جدة.', '#centres', 'عرض المراكز'],
  ].map(([c, t, d, h, l]) => `<article style="--c:${c}"><h3>${t}</h3><p>${d}</p><a class="btn btn-soft" href="${h}">${l}</a></article>`).join('');
  const body = `
<section class="hx hx-b home-hero"><div class="slides">${['DSC01789', 'DSC00565', 'DSC01611', 'DSC01024'].map((p, i) => `<img src="/assets/img/gfa2026/${p}.webp" alt="" aria-hidden="true"${i ? ' loading="lazy"' : ' fetchpriority="high"'}>`).join('')}</div><div class="inner">
  <h1>${esc(site.name)}</h1><p class="sub">${esc(site.tagline)}</p>
  <div class="actions"><a class="btn btn-accent" href="#centres">مراكز التدريب</a><a class="btn btn-ghost" href="/events/">جداول البطولات</a></div>
</div></section>
<div class="wrap"><div class="quick">${quick}</div></div>

<section class="section" id="events"><div class="wrap">
  ${secHead('البطولات والفعاليات', 'آخر البطولات والفعاليات')}
  <div class="grid">${latestEvents.map(eventCard).join('')}</div>
  <div class="sec-more"><a class="btn btn-primary" href="/events/">كل البطولات والفعاليات</a></div>
</div></section>

<section class="section"><div class="wrap">
  ${secHead('الأخبار', 'آخر الأخبار')}
  <div class="grid">${news.slice(0, 3).map(newsCard).join('')}</div>
  <div class="sec-more"><a class="btn btn-primary" href="/news/">كل الأخبار</a></div>
</div></section>

<section class="section"><div class="wrap">
  ${secHead('معرض الصور', 'لحظات من بطولاتنا')}
  <div class="grid">${albums.slice(0, 3).map(albumCard).join('')}</div>
  <div class="sec-more"><a class="btn btn-primary" href="/gallery/">معرض الصور</a></div>
</div></section>

<section class="section" id="centres"><div class="wrap">
  ${secHead('مراكز التدريب', 'اختر المركز الأقرب إليك')}
  <div class="grid">${Object.values(site.centres).filter((c) => c.slug).map(centreCard).join('')}</div>
</div></section>

${portalBand()}

<section class="section"><div class="wrap">
  ${secHead('عن الاتحاد', 'الفريق الذي يقف خلف الجمباز السعودي')}
  <div class="grid about">
    <a href="/about/team/"><span class="t">مجلس الإدارة والفريق</span><span class="d">أعضاء مجلس الإدارة، الجهاز الإداري، وإدارة المراكز.</span><span class="m">تعرّف على الفريق ←</span></a>
    <a href="/about/coaches/"><span class="t">المدربون</span><span class="d">مدربون ومدربات معتمدون في الخبر والرياض.</span><span class="m">عرض المدربين ←</span></a>
    <a href="/about/partners/"><span class="t">الأندية والشركاء</span><span class="d">الأندية المعتمدة والشركاء والرعاة.</span><span class="m">عرض الشركاء ←</span></a>
  </div>
</div></section>`;
  return layout({ title: site.name, active: 'home', body, extraHead: '<link rel="stylesheet" href="/assets/css/heroes.css"><link rel="preload" as="image" href="/assets/img/gfa2026/DSC01789.webp">' });
}

function centrePage(c) {
  const isKhobar = c.slug === 'khobar';
  const k = khobar;
  const cCoaches = coaches.filter((x) => x.centre === c.slug);
  const cEvents = events.filter((e) => e.centre === c.slug).slice(0, 3);
  const cAlbums = albums.filter((a) => a.centre === c.slug).slice(0, 3);
  const cNews = news.filter((n) => n.centre === c.slug).slice(0, 3);

  const hero = `<section class="hero centre-hero" style="--c:${c.color}"><img class="emblem" src="/assets/img/sgf_emblem.png" alt="" aria-hidden="true"><span class="ring r1"></span><span class="ring r2"></span><div class="inner">
  <div class="crumbs"><a href="/">الرئيسية</a> › <a href="/#centres">مراكز التدريب</a></div>
  <h1>${c.name}</h1><p class="sub">${isKhobar ? k.hero_sub : 'تدريب الجمباز بإشراف مدربي الاتحاد'}</p>
  <p class="place">${esc(c.address)}${isKhobar ? ' · ' + k.founded : ''}</p>
  <div class="actions">${isKhobar ? '<a class="btn btn-accent" href="#packages">الباقات والأسعار</a>' : `<a class="btn btn-accent" href="${site.register_url}">سجّل الآن</a>`}<a class="btn btn-ghost" href="${wa(c)}">تواصل عبر واتساب</a></div>
</div></section>`;

  const stats = isKhobar ? `<div class="wrap"><div class="stats">${k.stats.map((s) => `<div><span class="n">${s.n}</span><span class="l">${s.l}</span></div>`).join('')}</div></div>` : '';

  const packages = isKhobar ? `<section class="section" id="packages"><div class="wrap">
  ${secHead('الباقات', 'اختر الباقة المناسبة', k.packages_note)}
  <div class="grid pk">${k.packages.map((p) => `<article class="package" style="--c:${p.color}"><p class="ptag">${p.tag}</p><h3>${p.title}</h3><p class="price">${p.price} <span>${p.unit}</span></p><ul>${p.points.map((x) => `<li>${x}</li>`).join('')}</ul><a class="btn btn-primary" href="${p.cta.includes('تواصل') ? wa(c) : site.register_url}">${p.cta}</a></article>`).join('')}</div>
</div></section>
<section class="section tight"><div class="wrap"><div class="grid two">
  <article class="info" style="--c:#0075C9"><p class="ptag">للأندية</p><h3>${k.clubs_box.title}</h3><p>${k.clubs_box.text}</p><p>${k.clubs_box.clubs}</p><a class="btn btn-soft" href="/about/partners/">التفاصيل والاشتراطات</a></article>
  <article class="info" style="--c:#EB0045"><p class="ptag">قبل التسجيل</p><h3>شروط التسجيل</h3><ul>${k.conditions.map((x) => `<li>${x}</li>`).join('')}</ul></article>
</div></div></section>
<section class="section"><div class="wrap narrow">
  ${secHead('الجدول', 'أيام وأوقات الحصص', k.schedule.note)}
  <div class="table-wrap"><table><thead><tr><th class="start">الأيام</th>${k.schedule.slots.map((s) => `<th>${s}</th>`).join('')}</tr></thead><tbody>${k.schedule.rows.map((r) => `<tr><td class="start"><strong>${r.days}</strong></td>${r.cells.map((x) => `<td>${x === '✓' ? '<span class="ok">✓</span>' : `<span class="pill-warn">${x}</span>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
</div></section>` : `<section class="section"><div class="wrap narrow"><div class="notice">الباقات والأسعار وجدول الحصص لمركز الرياض تُضاف قريبًا. للاستفسار تواصل مع المركز عبر <a href="${wa(c)}">واتساب</a>.</div></div></section>`;

  const coachSec = cCoaches.length ? `<section class="section"><div class="wrap">
  ${secHead('الجهاز الفني', `مدربو ${c.name}`)}
  <div class="grid people sm">${cCoaches.map((p) => personCard(p)).join('')}</div>
  <div class="sec-more"><a class="btn btn-soft" href="/about/coaches/">كل المدربين</a></div>
</div></section>` : '';

  const evSec = (cEvents.length || cAlbums.length || cNews.length) ? `<section class="section"><div class="wrap">
  ${secHead('من المركز', 'بطولات وأخبار وصور المركز')}
  <div class="grid">${[...cEvents.map(eventCard), ...cNews.map(newsCard), ...cAlbums.map(albumCard)].slice(0, 6).join('')}</div>
  <div class="sec-more"><a class="btn btn-soft" href="/events/">كل البطولات</a> <a class="btn btn-soft" href="/gallery/">معرض الصور</a></div>
</div></section>` : '';

  const visit = `<section class="section"><div class="wrap narrow"><div class="band visit">
  <div class="band-text"><h2>زرنا في الصالة</h2><p>${esc(c.address)}</p><p>${c.days} · ${c.hours}</p><p>واتساب: <bdi dir="ltr" class="hl">${c.whatsapp_label}</bdi> · البريد: <a class="hl" href="mailto:${c.email}">${c.email}</a></p></div>
  <div class="band-acts"><a class="btn btn-accent" href="${c.map}" target="_blank" rel="noopener">الموقع على الخريطة</a><a class="btn btn-ghost" href="${wa(c)}">راسلنا على واتساب</a></div>
</div></div></section>`;

  const body = hero + stats + packages + coachSec + evSec + portalBand() + visit;
  return layout({ title: c.name, desc: `${c.name} — ${c.address}`, active: 'centres', body });
}

function teamPage() {
  const groups = people.map((g) => `<section class="section tight"><div class="wrap"><div class="group-head"><h2>${g.group}</h2><span></span></div><div class="grid people">${g.people.map((p) => personCard(p)).join('')}</div></div></section>`).join('');
  const body = pageHero({ crumbs: [['/about/team/', 'عن الاتحاد']], title: 'مجلس الإدارة والفريق الإداري', sub: 'القيادات والفريق الذي يعمل على تطوير رياضة الجمباز في المملكة.', extra: aboutTabs('team') }) + groups;
  return layout({ title: 'مجلس الإدارة والفريق', active: 'about', body });
}

function coachesPage() {
  const keys = [...new Set(coaches.map((c) => c.centre))];
  const cards = coaches.map((p) => `<div data-centre="${p.centre}">${personCard(p, centre(p.centre).name)}</div>`).join('');
  const body = pageHero({ crumbs: [['/about/team/', 'عن الاتحاد']], title: 'مدربونا', sub: 'مدربون ومدربات معتمدون في مراكز تدريب الاتحاد.', extra: aboutTabs('coaches') }) +
    `<section class="section" style="padding-top:40px"><div class="wrap">${filterBar(keys)}<div class="grid people" data-filterable>${cards}</div></div></section>`;
  return layout({ title: 'المدربون', active: 'about', body });
}

function partnersPage() {
  const clubs = partners.clubs.map((c) => `<article class="club"><div class="logo-box">${c.logo ? `<img src="${esc(c.logo)}" alt="${esc(c.name)}">` : ph}</div><h3>${esc(c.name)}</h3><p>أيام التدريب في ${centre(c.centre).name}: <strong>${esc(c.days)}</strong></p></article>`).join('');
  const prt = partners.partners.length
    ? `<div class="grid people sm">${partners.partners.map((p) => `<article class="club"><div class="logo-box">${p.logo ? `<img src="${esc(p.logo)}" alt="${esc(p.name)}">` : ph}</div><h3>${esc(p.name)}</h3><p>${esc(p.type)}</p></article>`).join('')}</div>`
    : `<div class="notice">تُضاف شعارات الشركاء والرعاة قريبًا.</div>`;
  const k = khobar.clubs_box;
  const body = pageHero({ crumbs: [['/about/team/', 'عن الاتحاد']], title: 'شركاؤنا في تطوير الجمباز', sub: 'الأندية المعتمدة والجهات الشريكة والرعاة الذين يدعمون رياضة الجمباز في المملكة.', extra: aboutTabs('partners') }) +
    `<section class="section tight"><div class="wrap"><div class="group-head"><h2>الأندية المعتمدة</h2><span></span></div><div class="grid">${clubs}</div></div></section>
<section class="section tight"><div class="wrap"><div class="group-head"><h2>الشركاء والرعاة</h2><span></span></div>${prt}</div></section>
<section class="section"><div class="wrap narrow"><div class="band center">
  <div class="band-text"><h2>ناديك يرغب في التدريب معنا؟</h2><p>${k.text}</p></div>
  <div class="band-acts"><a class="btn btn-accent" href="${wa(site.centres.khobar)}">تواصل عبر واتساب</a><a class="btn btn-ghost" href="/centres/khobar/">مركز تدريب الخبر</a></div>
</div></div></section>`;
  return layout({ title: 'الأندية والشركاء', active: 'about', body });
}

function eventsIndex() {
  const keys = [...new Set(events.map((e) => e.centre))].filter((k) => site.centres[k]);
  const up = events.filter((e) => (e.date_end || e.date) >= today).reverse();
  const past = events.filter((e) => !up.includes(e));
  const upHtml = up.length ? `<div class="grid" data-filterable>${up.map(eventCard).join('')}</div>` : `<div class="notice">لا توجد بطولات أو فعاليات قادمة معلنة حاليًا — تابعنا قريبًا.</div>`;
  const body = pageHero({ crumbs: [MEDIA], title: 'البطولات والفعاليات', sub: 'مواعيد البطولات والفعاليات في مراكز الاتحاد، ونتائجها وصورها.', extra: mediaTabs('events') }) +
    `<section class="section" style="padding-top:40px"><div class="wrap">${filterBar(keys)}
    <div class="group-head"><h2>القادمة</h2><span></span></div>${upHtml}
    <div class="group-head" style="margin-top:48px"><h2>السابقة</h2><span></span></div><div class="grid" data-filterable>${past.map(eventCard).join('')}</div>
    </div></section>`;
  return layout({ title: 'البطولات والفعاليات', active: 'media', body });
}

function mediaHub() {
  const up = events.filter((e) => (e.date_end || e.date) >= today).reverse();
  const past = events.filter((e) => !up.includes(e));
  const block = (title, href, all, cards) => `<section class="section tight"><div class="wrap"><div class="group-head"><h2>${title}</h2><span></span><a class="btn btn-soft" href="${href}">${all}</a></div>${cards}</div></section>`;
  const body = pageHero({ title: 'المركز الإعلامي', sub: 'كل ما يخص البطولات والفعاليات والأخبار وصور الاتحاد ومراكزه في مكان واحد.', extra: mediaTabs('hub') }) +
    block('البطولات والفعاليات القادمة', '/events/', 'كل البطولات', up.length ? `<div class="grid">${up.slice(0, 3).map(eventCard).join('')}</div>` : `<div class="notice">لا توجد فعاليات قادمة معلنة حاليًا.</div>`) +
    block('آخر الأخبار', '/news/', 'كل الأخبار', `<div class="grid">${news.slice(0, 3).map(newsCard).join('')}</div>`) +
    block('أحدث الألبومات', '/gallery/', 'معرض الصور', `<div class="grid">${albums.slice(0, 3).map(albumCard).join('')}</div>`) +
    block('بطولات سابقة', '/events/', 'الأرشيف', `<div class="grid">${past.slice(0, 3).map(eventCard).join('')}</div>`) +
    '<div style="height:60px"></div>';
  return layout({ title: 'المركز الإعلامي', active: 'media', body });
}

function eventPage(e) {
  const c = centre(e.centre);
  const album = albums.find((a) => a.slug === e.album);
  const links = [
    e.register_link && `<a class="btn btn-accent" href="${esc(e.register_link)}">سجّل في البطولة</a>`,
    album && `<a class="btn btn-primary" href="/gallery/${album.slug}/">ألبوم الصور (${album.photos.length})</a>`,
    e.video && `<a class="btn btn-soft" href="${esc(e.video)}" target="_blank" rel="noopener">فيديو البطولة</a>`,
    `<a class="btn btn-soft" href="/events/">كل البطولات</a>`,
  ].filter(Boolean).join('');
  const preview = album ? `<h2 style="font-size:20px;margin:28px 0 12px">من الصور</h2><div class="photos">${album.photos.slice(0, 6).map((p) => `<a href="/gallery/${album.slug}/" class="thumb"><img src="${album.photo_dir}${p}-sm.webp" alt="" loading="lazy"></a>`).join('')}</div>` : '';
  const body = pageHero({ crumbs: [MEDIA, ['/events/', 'البطولات والفعاليات']], title: e.title }) + `
<div class="wrap"><article class="article">
  ${e.cover ? `<div class="cover"><img src="${esc(e.cover)}" alt="${esc(e.title)}"></div>` : ''}
  <div class="content">
    <div class="facts"><div><span>التاريخ</span><strong>${esc(fmtRange(e))}</strong></div><div><span>المكان</span><strong>${esc(e.location)}</strong></div><div><span>المركز</span><strong>${c.page ? `<a href="/centres/${c.slug}/">${esc(c.name)}</a>` : esc(c.name)}</strong></div></div>
    ${e.details}
    <div class="links">${links}</div>
    ${preview}
  </div>
</article></div>`;
  return layout({ title: e.title, desc: e.summary, active: 'media', body });
}

function newsIndex() {
  const body = pageHero({ crumbs: [MEDIA], title: 'الأخبار', sub: 'آخر أخبار الاتحاد ومراكز التدريب.', extra: mediaTabs('news') }) + `<section class="section" style="padding-top:40px"><div class="wrap"><div class="grid">${news.map(newsCard).join('')}</div></div></section>`;
  return layout({ title: 'الأخبار', active: 'media', body });
}

function newsPage(n) {
  const links = (n.links || []).map((l) => `<a class="btn btn-soft" href="${esc(l.href)}">${esc(l.label)}</a>`).join('');
  const body = pageHero({ crumbs: [MEDIA, ['/news/', 'الأخبار']], title: n.title, sub: esc(fmtDate(n.date)) }) +
    `<div class="wrap"><article class="article">${n.cover ? `<div class="cover"><img src="${esc(n.cover)}" alt=""></div>` : ''}<div class="content">${n.body}<div class="links">${links}</div></div></article></div>`;
  return layout({ title: n.title, desc: n.summary, active: 'media', body });
}

function galleryIndex() {
  const keys = [...new Set(albums.map((a) => a.centre))].filter((k) => site.centres[k]);
  const body = pageHero({ crumbs: [MEDIA], title: 'معرض الصور', sub: 'صور البطولات والفعاليات في مراكز الاتحاد.', extra: mediaTabs('gallery') }) +
    `<section class="section" style="padding-top:40px"><div class="wrap">${keys.length > 1 ? filterBar(keys) : ''}<div class="grid" data-filterable>${albums.map(albumCard).join('')}</div></div></section>`;
  return layout({ title: 'معرض الصور', active: 'media', body });
}

function albumPage(a) {
  const ev = events.find((e) => e.slug === a.event);
  const photos = a.photos.map((p, i) => `<button type="button" data-full="${a.photo_dir}${p}.webp" aria-label="صورة ${i + 1} من ${a.photos.length}"><img src="${a.photo_dir}${p}-sm.webp" alt="" loading="lazy"></button>`).join('');
  const body = pageHero({ crumbs: [MEDIA, ['/gallery/', 'معرض الصور']], title: a.title, sub: esc(a.description) }) + `
<section class="section" style="padding-top:40px"><div class="wrap">
  <div class="chips"><span class="tag">🖼 ${a.photos.length} صورة</span><span class="tag">📅 ${esc(fmtDate(a.date))}</span>${ev ? `<a class="btn btn-soft" href="/events/${ev.slug}/">صفحة البطولة</a>` : ''}</div>
  <div class="photos" data-lightbox>${photos}</div>
</div></section>
<div class="lightbox" role="dialog" aria-modal="true" aria-label="عارض الصور"><img alt=""><button class="close" aria-label="إغلاق">✕</button><button class="prev" aria-label="السابقة">›</button><button class="next" aria-label="التالية">‹</button><span class="count"></span></div>`;
  return layout({ title: a.title, desc: a.description, active: 'media', body });
}


function heroOptions() {
  const dir = '/assets/img/gfa2026/';
  const btns = `<div class="actions"><a class="btn btn-accent" href="#">مراكز التدريب</a><a class="btn btn-ghost" href="#">جداول البطولات</a></div>`;
  const txt = `<h1>${esc(site.name)}</h1><p class="sub">${esc(site.tagline)}</p>${btns}`;
  const sparks = Array.from({ length: 14 }, (_, i) => `<span class="spark" style="left:${(i * 7 + 5) % 100}%;bottom:${(i * 13) % 40}%;animation-delay:-${(i * 0.45).toFixed(2)}s"></span>`).join('');
  const body = pageHero({ title: 'خيارات الواجهة الرئيسية', sub: 'أربعة تصاميم متحركة للقسم الأخضر أعلى الصفحة الرئيسية. اختر واحدًا (أ، ب، ج، د) أو اطلب دمج فكرتين.' }) + `
<div style="height:36px"></div>
<section class="hx hx-a"><span class="opt-label">الخيار أ — حلقات متحركة</span>${'<span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span><span class="ring r4"></span><span class="ring r5"></span>'}${sparks}<div class="inner">${txt}</div></section>
<p class="opt-desc"><strong>أ — حلقات الهوية المتحركة:</strong> حلقات بألوان شعار الاتحاد تطفو وتدور ببطء، مع نقاط ضوء صاعدة. هادئ وأنيق ويعكس الهوية.</p>

<section class="hx hx-b"><span class="opt-label">الخيار ب — صور البطولات</span><div class="slides">${['DSC01789', 'DSC00565', 'DSC01611', 'DSC01024'].map((p) => `<img src="${dir}${p}.webp" alt="" aria-hidden="true">`).join('')}</div><div class="inner">${txt}</div></section>
<p class="opt-desc"><strong>ب — عرض صور البطولات:</strong> صور حقيقية من البطولات تتبدّل بتكبير بطيء تحت طبقة خضراء. الأكثر حيوية وقربًا من اللاعبين والأهالي، ويمكن تحديث الصور من ألبومات Zoho.</p>

<section class="hx hx-c"><span class="opt-label">الخيار ج — شريط الجمباز الإيقاعي</span><svg viewBox="0 0 1440 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<path class="p1" d="M-40 420 C 200 180, 380 560, 620 330 S 980 80, 1180 300 S 1420 520, 1520 260"/>
<path class="p2" d="M-40 470 C 240 260, 420 600, 680 380 S 1020 140, 1220 360 S 1440 560, 1520 330"/>
<path class="p3" d="M-40 140 C 160 260, 360 40, 560 180 S 900 340, 1100 160 S 1380 40, 1520 120"/>
</svg><div class="inner">${txt}</div></section>
<p class="opt-desc"><strong>ج — شريط الجمباز الإيقاعي:</strong> أشرطة ملوّنة تُرسم وتتحرك كشريط الجمباز الإيقاعي فوق خلفية خضراء متدرجة متحركة. فني ومميز وخفيف على الجوال.</p>

<section class="hx hx-d"><span class="opt-label">الخيار د — نص وصور</span><div class="split"><div class="txt"><h1>${esc(site.name)}</h1><p class="sub">${esc(site.tagline)}</p><p class="lead">مراكز تدريب معتمدة في الخبر والرياض، وبطولات طوال العام للأطفال والسيدات.</p>${btns}</div>
<div class="mosaic">${['DSC00546', 'DSC00712', 'DSC01819', 'DSC01221', 'DSC01480', 'DSC00923'].map((p) => `<img src="${dir}${p}-sm.webp" alt="" aria-hidden="true">`).join('')}</div></div></section>
<p class="opt-desc"><strong>د — نص مع لوحة صور:</strong> العنوان على اليمين ولوحة صور متحركة بلطف على اليسار. عصري ويُظهر نشاط الاتحاد من أول نظرة.</p>`;
  return layout({ title: 'خيارات الواجهة', body, extraHead: '<link rel="stylesheet" href="/assets/css/heroes.css"><meta name="robots" content="noindex">' });
}

const notFound = () => layout({ title: 'الصفحة غير موجودة', body: pageHero({ title: 'الصفحة غير موجودة', sub: 'ربما نُقلت الصفحة أو تغيّر رابطها.', extra: '<p style="margin-top:20px"><a class="btn btn-accent" href="/">العودة للرئيسية</a></p>' }) });

// ---------- write ----------
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
const put = (p, html) => { const f = join(OUT, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, html); };
cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
put('index.html', home());
liveCentres.forEach((c) => put(`centres/${c.slug}/index.html`, centrePage(c)));
put('about/team/index.html', teamPage());
put('about/coaches/index.html', coachesPage());
put('about/partners/index.html', partnersPage());
put('events/index.html', eventsIndex());
events.forEach((e) => put(`events/${e.slug}/index.html`, eventPage(e)));
put('news/index.html', newsIndex());
put('media/index.html', mediaHub());
news.forEach((n) => put(`news/${n.slug}/index.html`, newsPage(n)));
put('gallery/index.html', galleryIndex());
albums.forEach((a) => put(`gallery/${a.slug}/index.html`, albumPage(a)));
put('hero-options/index.html', heroOptions());
put('404.html', notFound());
console.log(`Built: ${liveCentres.length} centres, ${events.length} events, ${news.length} news, ${albums.length} albums, team/coaches/partners → dist/`);
