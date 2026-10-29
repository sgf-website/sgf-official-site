// Static site generator for the SGF website (no dependencies). Arabic at /, English at /en/.
// Events, news and albums come from Zoho CRM (scripts/sync-zoho.mjs writes data/*.json).
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = dirname(new URL(import.meta.url).pathname);
const OUT = join(ROOT, 'dist');
const read = (f) => JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8'));

const site = read('site.json');
const khobarData = read('khobar.json');
const people = read('people.json');
const coaches = read('coaches.json');
const partners = read('partners.json');
const published = (a) => a.filter((x) => x.status === 'published');
const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '');
const events = published(read('events.json')).sort(byDateDesc);
const albums = published(read('albums.json')).sort(byDateDesc);
const news = published(read('news.json')).sort(byDateDesc);

// ---------- i18n ----------
let LANG = 'ar';
const EN = () => LANG === 'en';
const t = (ar, en) => (EN() ? en : ar);
const f = (o, k) => (EN() && o[`${k}_en`] ? o[`${k}_en`] : o[k] || '');      // field in current language
const u = (p) => (EN() ? (p.startsWith('/') ? '/en' + p : p) : p);            // localised URL
const altUrl = (p) => (EN() ? p : '/en' + p);                                  // same page, other language

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = { ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'], en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] };
const M = () => MONTHS[LANG];
const fmtDate = (d) => { if (!d) return ''; const [y, m, day] = d.split('-').map(Number); return `${day} ${M()[m - 1]} ${y}`; };
const fmtRange = (e) => {
  if (e.date_label) return e.date_label;
  if (!e.date_end) return fmtDate(e.date);
  const [y1, m1, d1] = e.date.split('-').map(Number); const [y2, m2, d2] = e.date_end.split('-').map(Number);
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${M()[m1 - 1]} ${y1}`;
  return `${fmtDate(e.date)} – ${fmtDate(e.date_end)}`;
};
const centre = (k) => site.centres[k] || site.centres.federation;
const liveCentres = Object.values(site.centres).filter((c) => c.page);
const today = new Date().toISOString().slice(0, 10);
const TYPE = () => ({ competition: t('بطولة', 'Competition'), event: t('فعالية', 'Event') });
const wa = (c) => `https://wa.me/${c.whatsapp}`;
const ARROW = () => t('←', '→');
const NAME = () => f(site, 'name');
const khobar = () => (EN() ? khobarData.en : khobarData);

// ---------- layout ----------
function nav() {
  return [
    { href: '/', label: t('الرئيسية', 'Home'), key: 'home' },
    { label: t('عن الاتحاد', 'About'), key: 'about', children: [['/about/team/', t('مجلس الإدارة والفريق', 'Board & Team')], ['/about/coaches/', t('المدربون', 'Coaches')], ['/about/partners/', t('الأندية والشركاء', 'Clubs & Partners')]] },
    { label: t('مراكز التدريب', 'Training Centres'), key: 'centres', children: ['riyadh', 'khobar', 'jeddah'].map((k) => site.centres[k]).map((c) => [`/centres/${c.slug}/`, f(c, 'name') + (c.soon ? ` <span class="soon-badge">${t('قريبًا', 'Soon')}</span>` : '')]) },
    { label: t('المركز الإعلامي', 'Media Centre'), key: 'media', children: [['/events/', t('البطولات والفعاليات', 'Competitions & Events')], ['/news/', t('الأخبار', 'News')], ['/gallery/', t('معرض الصور', 'Photo Gallery')], ['/media/', t('كل المحتوى الإعلامي', 'All media')]] },
  ];
}

function navHtml(active) {
  return nav().map((n) => {
    const cls = n.key === active ? ' class="active" aria-current="page"' : '';
    if (!n.children) return `<a href="${u(n.href)}"${cls}>${n.label}</a>`;
    const items = n.children.map(([h, l]) => `<a href="${u(h)}">${l}</a>`).join('');
    return `<div class="dd"><button type="button" class="dd-btn${n.key === active ? ' active' : ''}" aria-expanded="false">${n.label} <span aria-hidden="true">▾</span></button><div class="dd-menu">${items}</div></div>`;
  }).join('');
}

function layout({ path, title, desc = f(site, 'tagline'), active = '', body, extraHead = '' }) {
  const portal = site.portal;
  const otherLang = `<a class="lang" href="${altUrl(path)}" hreflang="${t('en', 'ar')}" lang="${t('en', 'ar')}">${t('English', 'العربية')}</a>`;
  return `<!doctype html>
<html lang="${LANG}" dir="${t('rtl', 'ltr')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}${title === NAME() ? '' : ' | ' + esc(NAME())}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<link rel="alternate" hreflang="ar" href="${path}"><link rel="alternate" hreflang="en" href="/en${path}">
<link rel="icon" href="/assets/img/sgf_emblem.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@600;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Montserrat:wght@600;800&display=swap">
<link rel="stylesheet" href="/assets/css/site.css">${extraHead}
</head>
<body>
<div class="preview-bar">${t('نسخة معاينة أولية — المحتوى والتصميم قابلان للتحديث', 'Preview version — content and design may change')}</div>
<header class="site-header">
  <div class="wrap">
    <a class="logo" href="${u('/')}"><img src="/assets/img/sgf_logo_horizontal.png" alt="${esc(NAME())}" width="229" height="48"></a>
    <button class="menu-toggle" aria-expanded="false" aria-controls="nav">${t('القائمة', 'Menu')} ☰</button>
    <nav id="nav" class="nav" aria-label="${t('القائمة الرئيسية', 'Main menu')}">${navHtml(active)}<a class="nav-portal" href="${portal.url}">${f(portal, 'label')}</a>${otherLang}</nav>
    <div class="header-cta">
      <a class="btn btn-outline" href="${portal.url}" title="${esc(f(portal, 'note'))}">🔐 ${f(portal, 'label')}</a>
      <a class="btn btn-primary" href="${site.register_url}">${t('سجّل الآن', 'Register')}</a>
    </div>
  </div>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="cols">
      <div class="col"><img src="/assets/img/sgf_logo_horizontal_white.png" alt="${esc(NAME())}"><p style="margin:0">${t('نطوّر رياضة الجمباز في المملكة من المراكز إلى المنتخبات.', 'Developing gymnastics in the Kingdom, from training centres to national teams.')}</p></div>
      <div class="col"><p class="h">${t('عن الاتحاد', 'About')}</p><a href="${u('/about/team/')}">${t('مجلس الإدارة والفريق', 'Board & Team')}</a><a href="${u('/about/coaches/')}">${t('المدربون', 'Coaches')}</a><a href="${u('/about/partners/')}">${t('الأندية والشركاء', 'Clubs & Partners')}</a></div>
      <div class="col"><p class="h">${t('المركز الإعلامي', 'Media Centre')}</p><a href="${u('/events/')}">${t('البطولات والفعاليات', 'Competitions & Events')}</a><a href="${u('/news/')}">${t('الأخبار', 'News')}</a><a href="${u('/gallery/')}">${t('معرض الصور', 'Photo Gallery')}</a><a href="${site.register_url}">${t('التسجيل', 'Registration')}</a><a href="${portal.url}">${f(portal, 'label')}</a></div>
      <div class="col"><p class="h">${t('تواصل معنا', 'Contact us')}</p>
        ${liveCentres.map((c) => `<span>${f(c, 'name')}: <a href="${wa(c)}"><bdi dir="ltr">${c.whatsapp_label}</bdi></a></span>`).join('')}
      </div>
    </div>
    <p class="copy">© ${new Date().getFullYear()} ${esc(NAME())}</p>
  </div>
</footer>
<script src="/assets/js/site.js" defer></script>
</body>
</html>`;
}

// ---------- components ----------
const ph = `<img class="ph" src="/assets/img/sgf_emblem.png" alt="" aria-hidden="true">`;
const secHead = (eyebrow, title, sub = '') => `<div class="sec-head"><p class="eyebrow">${eyebrow}</p><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>`;
const pageHero = ({ crumbs = [], title, sub = '', extra = '' }) => `<section class="page-hero">${crumbs.length ? `<div class="crumbs">${[['/', t('الرئيسية', 'Home')], ...crumbs].map(([h, l]) => `<a href="${u(h)}">${l}</a>`).join(' › ')}</div>` : ''}<h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}${extra}</section>`;
const tabs = (label, items, active) => `<nav class="tabs" aria-label="${label}">${items.map(([k, h, l]) => `<a href="${u(h)}"${k === active ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
const mediaTabs = (active) => tabs(t('أقسام المركز الإعلامي', 'Media sections'), [['hub', '/media/', t('الكل', 'All')], ['events', '/events/', t('البطولات والفعاليات', 'Competitions & Events')], ['news', '/news/', t('الأخبار', 'News')], ['gallery', '/gallery/', t('معرض الصور', 'Photo Gallery')]], active);
const aboutTabs = (active) => tabs(t('أقسام عن الاتحاد', 'About sections'), [['team', '/about/team/', t('مجلس الإدارة والفريق', 'Board & Team')], ['coaches', '/about/coaches/', t('المدربون', 'Coaches')], ['partners', '/about/partners/', t('الأندية والشركاء', 'Clubs & Partners')]], active);
const MEDIA = () => ['/media/', t('المركز الإعلامي', 'Media Centre')];
const ABOUT = () => ['/about/team/', t('عن الاتحاد', 'About')];

function eventCard(e) {
  const c = centre(e.centre);
  const media = e.cover ? `<img src="${esc(e.cover)}" alt="" loading="lazy">` : ph;
  const upcoming = (e.date_end || e.date) >= today;
  return `<a class="card" href="${u(`/events/${e.slug}/`)}" data-centre="${e.centre}">
  <div class="media">${media}</div>
  <div class="body">
    <div class="meta"><span class="tag" style="--tc:${c.color}">${esc(f(c, 'short'))}</span><span>${esc(TYPE()[e.type] || TYPE().event)}</span>${upcoming ? `<span class="tag" style="--tc:#B36B00">${t('قادمة', 'Upcoming')}</span>` : ''}</div>
    <h3>${esc(f(e, 'title'))}</h3>
    <div class="meta"><span>📅 ${esc(fmtRange(e))}</span><span>📍 ${esc(f(e, 'location'))}</span></div>
    <p>${esc(f(e, 'summary'))}</p>
    <span class="more">${t('التفاصيل', 'Details')} ${ARROW()}</span>
  </div>
</a>`;
}

function newsCard(n) {
  const c = centre(n.centre);
  const media = n.cover ? `<img src="${esc(n.cover)}" alt="" loading="lazy">` : ph;
  return `<a class="card" href="${u(`/news/${n.slug}/`)}" data-centre="${n.centre}">
  <div class="media">${media}</div>
  <div class="body">
    <div class="meta"><span class="tag" style="--tc:${c.color}">${esc(f(c, 'short'))}</span><span>${esc(fmtDate(n.date))}</span></div>
    <h3>${esc(f(n, 'title'))}</h3>
    <p>${esc(f(n, 'summary'))}</p>
    <span class="more">${t('اقرأ الخبر', 'Read more')} ${ARROW()}</span>
  </div>
</a>`;
}

function albumCard(a) {
  const c = centre(a.centre);
  return `<a class="card" href="${u(`/gallery/${a.slug}/`)}" data-centre="${a.centre}">
  <div class="media"><img src="${a.photo_dir}${a.cover}-sm.webp" alt="" loading="lazy"></div>
  <div class="body">
    <div class="meta"><span class="tag" style="--tc:${c.color}">${esc(f(c, 'short'))}</span><span>${esc(fmtDate(a.date))}</span><span>🖼 ${a.photos.length} ${t('صورة', 'photos')}</span></div>
    <h3>${esc(f(a, 'title'))}</h3>
    <span class="more">${t('عرض الألبوم', 'View album')} ${ARROW()}</span>
  </div>
</a>`;
}

const personCard = (p, sub = '') => `<article class="person"><div class="photo">${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(f(p, 'name'))}" loading="lazy">` : ph}</div><h3>${esc(f(p, 'name'))}</h3><p class="role">${esc(f(p, 'role'))}</p>${sub ? `<p class="sub">${sub}</p>` : ''}</article>`;

const filterBar = (keys) => `<div class="filters" role="group" aria-label="${t('تصفية حسب المركز', 'Filter by centre')}">
  <button type="button" data-filter="all" aria-pressed="true">${t('الكل', 'All')}</button>
  ${keys.map((k) => `<button type="button" data-filter="${k}" aria-pressed="false">${esc(f(site.centres[k], 'short'))}</button>`).join('')}
</div>`;

function centreCard(c) {
  if (c.soon) return `<article class="centre soon"><p class="city" style="--c:var(--muted)">${f(c, 'short')}</p><h3>${f(c, 'name')}</h3><p class="addr">${t('التفاصيل قريبًا', 'Details coming soon')}</p><span class="pill-muted">${t('قريبًا', 'Coming soon')}</span></article>`;
  return `<article class="centre" style="--c:${c.color}"><p class="city">${f(c, 'short')}</p><h3>${f(c, 'name')}</h3><p class="addr">${esc(f(c, 'address'))}</p><p>${t('الأوقات', 'Hours')}: ${f(c, 'hours')}<br>${f(c, 'days')}</p><div class="acts"><a class="btn btn-primary btn-sm" href="${u(`/centres/${c.slug}/`)}">${t('صفحة المركز', 'Centre page')}</a><a class="btn btn-soft" href="${wa(c)}">${t('واتساب المركز', 'WhatsApp')}</a></div></article>`;
}

function portalBand() {
  return `<section class="section"><div class="wrap"><div class="band">
  <div class="band-text"><p class="eyebrow-light">${t('لأولياء الأمور واللاعبين', 'For parents and players')}</p><h2>${f(site.portal, 'label')}</h2>
  <p>${t('تابع اشتراك طفلك وحضوره وتقييماته، وارفع إيصال التحويل، وتواصل مع المركز — من مكان واحد.', "Follow your child's subscription, attendance and assessments, upload transfer receipts and contact the centre — all in one place.")}</p>
  <p class="small">💻 ${esc(f(site.portal, 'note'))}</p></div>
  <div class="band-acts"><a class="btn btn-accent" href="${site.portal.url}">${t('الدخول إلى البوابة', 'Go to the portal')}</a><a class="btn btn-ghost" href="${site.register_url}">${t('تسجيل لاعب جديد', 'Register a new player')}</a></div>
</div></div></section>`;
}

const upcomingFirst = () => { const up = events.filter((e) => (e.date_end || e.date) >= today); return [up.reverse(), events.filter((e) => !up.includes(e))]; };

// ---------- pages ----------
function home() {
  const [up, past] = upcomingFirst();
  const latestEvents = [...up, ...past].slice(0, 3);
  const quick = [
    ['#EB0045', t('سجّل الآن', 'Register now'), t('نموذج تسجيل سريع للاعبين الجدد من عمر 5 سنوات.', 'A quick registration form for new players aged 5 and up.'), site.register_url, t('ابدأ التسجيل', 'Start registration')],
    ['#FFA500', t('الباقات والأسعار', 'Packages & prices'), t('اشتراكات شهرية تبدأ من 800 ريال، بأوقات تناسب الجميع.', 'Monthly subscriptions from SAR 800, at times that suit everyone.'), u('/centres/khobar/#packages'), t('عرض الباقات', 'View packages')],
    ['#0075C9', t('جداول البطولات', 'Competition calendar'), t('مواعيد البطولات والفعاليات القادمة في مراكز الاتحاد.', "Dates of upcoming competitions and events at the federation's centres."), u('/events/'), t('عرض الجداول', 'View calendar')],
    ['#0A5640', t('مراكز التدريب', 'Training centres'), t('اختر المركز الأقرب إليك: الخبر، الرياض، وقريبًا جدة.', 'Choose your nearest centre: Khobar, Riyadh, and soon Jeddah.'), '#centres', t('عرض المراكز', 'View centres')],
  ].map(([c, ti, d, h, l]) => `<article style="--c:${c}"><h3>${ti}</h3><p>${d}</p><a class="btn btn-soft" href="${h}">${l}</a></article>`).join('');
  const body = `
<section class="hx hx-b home-hero"><div class="slides">${['DSC01789', 'DSC00565', 'DSC01611', 'DSC01024'].map((p, i) => `<img src="/assets/img/gfa2026/${p}.webp" alt="" aria-hidden="true"${i ? ' loading="lazy"' : ' fetchpriority="high"'}>`).join('')}</div><div class="inner">
  <h1>${esc(NAME())}</h1><p class="sub">${esc(f(site, 'tagline'))}</p>
  <div class="actions"><a class="btn btn-accent" href="#centres">${t('مراكز التدريب', 'Training centres')}</a><a class="btn btn-ghost" href="${u('/events/')}">${t('جداول البطولات', 'Competition calendar')}</a></div>
</div></section>
<div class="wrap"><div class="quick">${quick}</div></div>

<section class="section" id="events"><div class="wrap">
  ${secHead(t('البطولات والفعاليات', 'Competitions & Events'), t('آخر البطولات والفعاليات', 'Latest competitions and events'))}
  <div class="grid">${latestEvents.map(eventCard).join('')}</div>
  <div class="sec-more"><a class="btn btn-primary" href="${u('/events/')}">${t('كل البطولات والفعاليات', 'All competitions & events')}</a></div>
</div></section>

<section class="section"><div class="wrap">
  ${secHead(t('الأخبار', 'News'), t('آخر الأخبار', 'Latest news'))}
  <div class="grid">${news.slice(0, 3).map(newsCard).join('')}</div>
  <div class="sec-more"><a class="btn btn-primary" href="${u('/news/')}">${t('كل الأخبار', 'All news')}</a></div>
</div></section>

<section class="section"><div class="wrap">
  ${secHead(t('معرض الصور', 'Photo Gallery'), t('لحظات من بطولاتنا', 'Moments from our competitions'))}
  <div class="grid">${albums.slice(0, 3).map(albumCard).join('')}</div>
  <div class="sec-more"><a class="btn btn-primary" href="${u('/gallery/')}">${t('معرض الصور', 'Photo gallery')}</a></div>
</div></section>

<section class="section" id="centres"><div class="wrap">
  ${secHead(t('مراكز التدريب', 'Training Centres'), t('اختر المركز الأقرب إليك', 'Choose your nearest centre'))}
  <div class="grid">${Object.values(site.centres).filter((c) => c.slug).map(centreCard).join('')}</div>
</div></section>

${portalBand()}

<section class="section"><div class="wrap">
  ${secHead(t('عن الاتحاد', 'About'), t('الفريق الذي يقف خلف الجمباز السعودي', 'The team behind Saudi gymnastics'))}
  <div class="grid about">
    <a href="${u('/about/team/')}"><span class="t">${t('مجلس الإدارة والفريق', 'Board & Team')}</span><span class="d">${t('أعضاء مجلس الإدارة، الجهاز الإداري، وإدارة المراكز.', 'Board members, administrative staff and centre management.')}</span><span class="m">${t('تعرّف على الفريق', 'Meet the team')} ${ARROW()}</span></a>
    <a href="${u('/about/coaches/')}"><span class="t">${t('المدربون', 'Coaches')}</span><span class="d">${t('مدربون ومدربات معتمدون في الخبر والرياض.', 'Certified coaches in Khobar and Riyadh.')}</span><span class="m">${t('عرض المدربين', 'View coaches')} ${ARROW()}</span></a>
    <a href="${u('/about/partners/')}"><span class="t">${t('الأندية والشركاء', 'Clubs & Partners')}</span><span class="d">${t('الأندية المعتمدة والشركاء والرعاة.', 'Approved clubs, partners and sponsors.')}</span><span class="m">${t('عرض الشركاء', 'View partners')} ${ARROW()}</span></a>
  </div>
</div></section>`;
  return layout({ path: '/', title: NAME(), active: 'home', body, extraHead: '<link rel="stylesheet" href="/assets/css/heroes.css"><link rel="preload" as="image" href="/assets/img/gfa2026/DSC01789.webp">' });
}


function homeV2() {
  const [up, past] = upcomingFirst();
  const items = [
    ...[...up, ...past].map((e) => ({ kind: 'event', date: e.date, o: e })),
    ...news.map((n) => ({ kind: 'news', date: n.date, o: n })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const feat = up[0] ? { kind: 'event', o: up[0] } : items[0];
  const rest = items.filter((x) => x.o !== feat.o).slice(0, 4);
  const href = (x) => u(`/${x.kind === 'event' ? 'events' : 'news'}/${x.o.slug}/`);
  const kindLabel = (x) => (x.kind === 'news' ? t('خبر', 'News') : (TYPE()[x.o.type] || TYPE().event));
  const when = (x) => (x.kind === 'news' ? fmtDate(x.o.date) : fmtRange(x.o));
  const fc = centre(feat.o.centre);
  const featured = `<a class="feat" href="${href(feat)}">
    <div class="feat-img">${feat.o.cover ? `<img src="${esc(feat.o.cover)}" alt="">` : ph}</div>
    <div class="feat-body"><div class="meta"><span class="tag" style="--tc:${fc.color}">${esc(f(fc, 'short'))}</span><span>${esc(kindLabel(feat))}</span><span>📅 ${esc(when(feat))}</span></div>
    <h3>${esc(f(feat.o, 'title'))}</h3><p>${esc(f(feat.o, 'summary'))}</p><span class="more">${t('التفاصيل', 'Details')} ${ARROW()}</span></div></a>`;
  const list = rest.map((x) => { const c = centre(x.o.centre); return `<a class="mini" href="${href(x)}"><div class="mini-img">${x.o.cover ? `<img src="${esc(x.o.cover)}" alt="" loading="lazy">` : ph}</div><div><div class="meta"><span class="tag" style="--tc:${c.color}">${esc(f(c, 'short'))}</span><span>${esc(kindLabel(x))}</span></div><h4>${esc(f(x.o, 'title'))}</h4><span class="date">${esc(when(x))}</span></div></a>`; }).join('');
  const album = albums[0];
  const strip = album ? `<section class="section"><div class="wrap">
    <div class="split-head"><div>${secHead(t('معرض الصور', 'Photo Gallery'), esc(f(album, 'title')))}</div><a class="btn btn-primary" href="${u(`/gallery/${album.slug}/`)}">${t('عرض الألبوم كاملًا', 'View full album')} (${album.photos.length})</a></div>
    <div class="strip">${album.photos.slice(0, 7).map((p, i) => `<a href="${u(`/gallery/${album.slug}/`)}" class="s${i}"><img src="${album.photo_dir}${p}-sm.webp" alt="" loading="lazy"></a>`).join('')}</div>
    <div class="sec-more"><a class="btn btn-soft" href="${u('/gallery/')}">${t('كل الألبومات', 'All albums')}</a></div>
  </div></section>` : '';
  const stats = [
    [liveCentres.length, t('مراكز تدريب', 'training centres'), t('وقريبًا جدة', 'Jeddah coming soon')],
    [coaches.length, t('مدربًا ومدربة', 'certified coaches'), t('في الخبر والرياض', 'in Khobar and Riyadh')],
    ['+5', t('سنوات', 'years'), t('العمر الأدنى للتسجيل', 'minimum age to join')],
    [events.length, t('بطولات وفعاليات', 'competitions & events'), t('في أرشيف الموقع', 'in our archive')],
  ].map(([n, l, s]) => `<div><span class="n">${n}</span><span class="l">${l}</span><span class="s">${s}</span></div>`).join('');
  const quick = [
    ['#EB0045', '📝', t('سجّل الآن', 'Register now'), t('نموذج تسجيل سريع للاعبين الجدد من عمر 5 سنوات.', 'A quick registration form for new players aged 5 and up.'), site.register_url],
    ['#FFA500', '💳', t('الباقات والأسعار', 'Packages & prices'), t('اشتراكات شهرية تبدأ من 800 ريال.', 'Monthly subscriptions from SAR 800.'), u('/centres/khobar/#packages')],
    ['#0075C9', '🏆', t('جداول البطولات', 'Competition calendar'), t('مواعيد البطولات والفعاليات القادمة.', 'Upcoming competitions and events.'), u('/events/')],
    ['#0A5640', '📍', t('مراكز التدريب', 'Training centres'), t('الخبر، الرياض، وقريبًا جدة.', 'Khobar, Riyadh, and soon Jeddah.'), '#centres'],
  ].map(([c, i, ti, d, h]) => `<a class="qk" href="${h}" style="--c:${c}"><span class="qi">${i}</span><span class="qt">${ti}</span><span class="qd">${d}</span><span class="qa">${ARROW()}</span></a>`).join('');
  const body = `
<section class="hx hx-b home-hero"><div class="slides">${['DSC01789', 'DSC00565', 'DSC01611', 'DSC01024'].map((p, i) => `<img src="/assets/img/gfa2026/${p}.webp" alt="" aria-hidden="true"${i ? ' loading="lazy"' : ' fetchpriority="high"'}>`).join('')}</div><div class="inner">
  <h1>${esc(NAME())}</h1><p class="sub">${esc(f(site, 'tagline'))}</p>
  <div class="actions"><a class="btn btn-accent" href="${site.register_url}">${t('سجّل طفلك الآن', 'Register your child')}</a><a class="btn btn-ghost" href="#centres">${t('مراكز التدريب', 'Training centres')}</a></div>
</div></section>
<div class="wrap"><div class="quick2">${quick}</div></div>

<section class="section" id="centres"><div class="wrap">
  ${secHead(t('مراكز التدريب', 'Training Centres'), t('اختر المركز الأقرب إليك', 'Choose your nearest centre'))}
  <div class="grid">${Object.values(site.centres).filter((c) => c.slug).map(centreCard).join('')}</div>
</div></section>

<section class="stats-band"><div class="wrap"><div class="stats2">${stats}</div></div></section>

<section class="section"><div class="wrap">
  <div class="split-head"><div>${secHead(t('المركز الإعلامي', 'Media Centre'), t('آخر الأخبار والبطولات', 'Latest news & competitions'))}</div><a class="btn btn-primary" href="${u('/media/')}">${t('كل المحتوى الإعلامي', 'All media')}</a></div>
  <div class="feat-grid">${featured}<div class="mini-list">${list}</div></div>
</div></section>

${strip}
${portalBand()}

<section class="section"><div class="wrap">
  ${secHead(t('عن الاتحاد', 'About'), t('الفريق الذي يقف خلف الجمباز السعودي', 'The team behind Saudi gymnastics'))}
  <div class="grid about">
    <a href="${u('/about/team/')}"><span class="t">${t('مجلس الإدارة والفريق', 'Board & Team')}</span><span class="d">${t('أعضاء مجلس الإدارة، الجهاز الإداري، وإدارة المراكز.', 'Board members, administrative staff and centre management.')}</span><span class="m">${t('تعرّف على الفريق', 'Meet the team')} ${ARROW()}</span></a>
    <a href="${u('/about/coaches/')}"><span class="t">${t('المدربون', 'Coaches')}</span><span class="d">${t('مدربون ومدربات معتمدون في الخبر والرياض.', 'Certified coaches in Khobar and Riyadh.')}</span><span class="m">${t('عرض المدربين', 'View coaches')} ${ARROW()}</span></a>
    <a href="${u('/about/partners/')}"><span class="t">${t('الأندية والشركاء', 'Clubs & Partners')}</span><span class="d">${t('الأندية المعتمدة والشركاء والرعاة.', 'Approved clubs, partners and sponsors.')}</span><span class="m">${t('عرض الشركاء', 'View partners')} ${ARROW()}</span></a>
  </div>
</div></section>`;
  return layout({ path: '/home-v2/', title: NAME(), active: 'home', body, extraHead: '<link rel="stylesheet" href="/assets/css/heroes.css"><meta name="robots" content="noindex">' });
}

function centrePage(c) {
  const isKhobar = c.slug === 'khobar';
  const k = khobar();
  const cCoaches = coaches.filter((x) => x.centre === c.slug);
  const cEvents = events.filter((e) => e.centre === c.slug).slice(0, 3);
  const cAlbums = albums.filter((a) => a.centre === c.slug).slice(0, 3);
  const cNews = news.filter((n) => n.centre === c.slug).slice(0, 3);

  const hero = `<section class="hero centre-hero" style="--c:${c.color}"><img class="emblem" src="/assets/img/sgf_emblem.png" alt="" aria-hidden="true"><span class="ring r1"></span><span class="ring r2"></span><div class="inner">
  <div class="crumbs"><a href="${u('/')}">${t('الرئيسية', 'Home')}</a> › <a href="${u('/#centres')}">${t('مراكز التدريب', 'Training Centres')}</a></div>
  <h1>${f(c, 'name')}</h1><p class="sub">${isKhobar ? k.hero_sub : t('تدريب الجمباز بإشراف مدربي الاتحاد', 'Gymnastics training with federation coaches')}</p>
  <p class="place">${esc(f(c, 'address'))}${isKhobar ? ' · ' + k.founded : ''}</p>
  <div class="actions">${isKhobar ? `<a class="btn btn-accent" href="#packages">${t('الباقات والأسعار', 'Packages & prices')}</a>` : `<a class="btn btn-accent" href="${site.register_url}">${t('سجّل الآن', 'Register now')}</a>`}<a class="btn btn-ghost" href="${wa(c)}">${t('تواصل عبر واتساب', 'Chat on WhatsApp')}</a></div>
</div></section>`;

  const stats = isKhobar ? `<div class="wrap"><div class="stats">${k.stats.map((s) => `<div><span class="n">${s.n}</span><span class="l">${s.l}</span></div>`).join('')}</div></div>` : '';

  const packages = isKhobar ? `<section class="section" id="packages"><div class="wrap">
  ${secHead(t('الباقات', 'Packages'), t('اختر الباقة المناسبة', 'Choose your package'), k.packages_note)}
  <div class="grid pk">${k.packages.map((p, i) => `<article class="package" style="--c:${p.color}"><p class="ptag">${p.tag}</p><h3>${p.title}</h3><p class="price">${p.price} <span>${p.unit}</span></p><ul>${p.points.map((x) => `<li>${x}</li>`).join('')}</ul><a class="btn btn-primary" href="${i === 2 ? wa(c) : site.register_url}">${p.cta}</a></article>`).join('')}</div>
</div></section>
<section class="section tight"><div class="wrap"><div class="grid two">
  <article class="info" style="--c:#0075C9"><p class="ptag">${t('للأندية', 'For clubs')}</p><h3>${k.clubs_box.title}</h3><p>${k.clubs_box.text}</p><p>${k.clubs_box.clubs}</p><a class="btn btn-soft" href="${u('/about/partners/')}">${t('التفاصيل والاشتراطات', 'Details & requirements')}</a></article>
  <article class="info" style="--c:#EB0045"><p class="ptag">${t('قبل التسجيل', 'Before you register')}</p><h3>${t('شروط التسجيل', 'Registration requirements')}</h3><ul>${k.conditions.map((x) => `<li>${x}</li>`).join('')}</ul></article>
</div></div></section>
<section class="section"><div class="wrap narrow">
  ${secHead(t('الجدول', 'Timetable'), t('أيام وأوقات الحصص', 'Class days and times'), k.schedule.note)}
  <div class="table-wrap"><table><thead><tr><th class="start">${t('الأيام', 'Days')}</th>${k.schedule.slots.map((s) => `<th>${s}</th>`).join('')}</tr></thead><tbody>${k.schedule.rows.map((r) => `<tr><td class="start"><strong>${r.days}</strong></td>${r.cells.map((x) => `<td>${x === '✓' ? '<span class="ok">✓</span>' : `<span class="pill-warn">${x}</span>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
</div></section>` : `<section class="section"><div class="wrap narrow"><div class="notice">${t('الباقات والأسعار وجدول الحصص لمركز الرياض تُضاف قريبًا. للاستفسار تواصل مع المركز عبر', 'Packages, prices and the class timetable for the Riyadh centre are coming soon. For enquiries, contact the centre on')} <a href="${wa(c)}">${t('واتساب', 'WhatsApp')}</a>.</div></div></section>`;

  const coachSec = cCoaches.length ? `<section class="section"><div class="wrap">
  ${secHead(t('الجهاز الفني', 'Technical staff'), t(`مدربو ${c.name}`, `${c.name_en} coaches`))}
  <div class="grid people sm">${cCoaches.map((p) => personCard(p)).join('')}</div>
  <div class="sec-more"><a class="btn btn-soft" href="${u('/about/coaches/')}">${t('كل المدربين', 'All coaches')}</a></div>
</div></section>` : '';

  const evSec = (cEvents.length || cAlbums.length || cNews.length) ? `<section class="section"><div class="wrap">
  ${secHead(t('من المركز', 'From the centre'), t('بطولات وأخبار وصور المركز', 'Competitions, news and photos'))}
  <div class="grid">${[...cEvents.map(eventCard), ...cNews.map(newsCard), ...cAlbums.map(albumCard)].slice(0, 6).join('')}</div>
  <div class="sec-more"><a class="btn btn-soft" href="${u('/events/')}">${t('كل البطولات', 'All competitions')}</a> <a class="btn btn-soft" href="${u('/gallery/')}">${t('معرض الصور', 'Photo gallery')}</a></div>
</div></section>` : '';

  const visit = `<section class="section"><div class="wrap narrow"><div class="band visit">
  <div class="band-text"><h2>${t('زرنا في الصالة', 'Visit us')}</h2><p>${esc(f(c, 'address'))}</p><p>${f(c, 'days')} · ${f(c, 'hours')}</p><p>${t('واتساب', 'WhatsApp')}: <bdi dir="ltr" class="hl">${c.whatsapp_label}</bdi> · ${t('البريد', 'Email')}: <a class="hl" href="mailto:${c.email}">${c.email}</a></p></div>
  <div class="band-acts"><a class="btn btn-accent" href="${c.map}" target="_blank" rel="noopener">${t('الموقع على الخريطة', 'View on map')}</a><a class="btn btn-ghost" href="${wa(c)}">${t('راسلنا على واتساب', 'Message us on WhatsApp')}</a></div>
</div></div></section>`;

  const body = hero + stats + packages + coachSec + evSec + portalBand() + visit;
  return layout({ path: `/centres/${c.slug}/`, title: f(c, 'name'), desc: `${f(c, 'name')} — ${f(c, 'address')}`, active: 'centres', body });
}


function soonCentrePage(c) {
  const body = `<section class="hero centre-hero" style="--c:${c.color}"><img class="emblem" src="/assets/img/sgf_emblem.png" alt="" aria-hidden="true"><span class="ring r1"></span><span class="ring r2"></span><div class="inner">
  <div class="crumbs"><a href="${u('/')}">${t('الرئيسية', 'Home')}</a> › <a href="${u('/#centres')}">${t('مراكز التدريب', 'Training Centres')}</a></div>
  <h1>${f(c, 'name')}</h1><p class="sub">${t('قريبًا', 'Coming soon')}</p>
  <p class="place">${t('نعمل على افتتاح مركز تدريب الاتحاد في جدة. تابعنا لمعرفة موعد الافتتاح والتسجيل.', "We are preparing to open the federation's training centre in Jeddah. Follow us for the opening date and registration.")}</p>
  <div class="actions">${liveCentres.map((x) => `<a class="btn btn-ghost" href="${u(`/centres/${x.slug}/`)}">${f(x, 'name')}</a>`).join('')}</div>
</div></section><div style="height:40px"></div>`;
  return layout({ path: `/centres/${c.slug}/`, title: f(c, 'name'), active: 'centres', body });
}

function teamPage() {
  const groups = people.map((g) => `<section class="section tight"><div class="wrap"><div class="group-head"><h2>${f(g, 'group')}</h2><span></span></div><div class="grid people">${g.people.map((p) => personCard(p)).join('')}</div></div></section>`).join('');
  const body = pageHero({ crumbs: [ABOUT()], title: t('مجلس الإدارة والفريق الإداري', 'Board of Directors & Staff'), sub: t('القيادات والفريق الذي يعمل على تطوير رياضة الجمباز في المملكة.', 'The leadership and team developing gymnastics in the Kingdom.'), extra: aboutTabs('team') }) + groups;
  return layout({ path: '/about/team/', title: t('مجلس الإدارة والفريق', 'Board & Team'), active: 'about', body });
}

function coachesPage() {
  const keys = [...new Set(coaches.map((c) => c.centre))];
  const cards = coaches.map((p) => `<div data-centre="${p.centre}">${personCard(p, f(centre(p.centre), 'name'))}</div>`).join('');
  const body = pageHero({ crumbs: [ABOUT()], title: t('مدربونا', 'Our coaches'), sub: t('مدربون ومدربات معتمدون في مراكز تدريب الاتحاد.', "Certified coaches at the federation's training centres."), extra: aboutTabs('coaches') }) +
    `<section class="section" style="padding-top:40px"><div class="wrap">${filterBar(keys)}<div class="grid people" data-filterable>${cards}</div></div></section>`;
  return layout({ path: '/about/coaches/', title: t('المدربون', 'Coaches'), active: 'about', body });
}

function partnersPage() {
  const clubs = partners.clubs.map((c) => `<article class="club"><div class="logo-box">${c.logo ? `<img src="${esc(c.logo)}" alt="${esc(f(c, 'name'))}">` : ph}</div><h3>${esc(f(c, 'name'))}</h3><p>${t(`أيام التدريب في ${centre(c.centre).name}`, `Training days at the ${centre(c.centre).name_en}`)}: <strong>${esc(f(c, 'days'))}</strong></p></article>`).join('');
  const prt = partners.partners.length
    ? `<div class="grid people sm">${partners.partners.map((p) => `<article class="club"><div class="logo-box">${p.logo ? `<img src="${esc(p.logo)}" alt="${esc(f(p, 'name'))}">` : ph}</div><h3>${esc(f(p, 'name'))}</h3><p>${esc(f(p, 'type'))}</p></article>`).join('')}</div>`
    : `<div class="notice">${t('تُضاف شعارات الشركاء والرعاة قريبًا.', 'Partner and sponsor logos are coming soon.')}</div>`;
  const k = khobar().clubs_box;
  const body = pageHero({ crumbs: [ABOUT()], title: t('شركاؤنا في تطوير الجمباز', 'Our partners in gymnastics'), sub: t('الأندية المعتمدة والجهات الشريكة والرعاة الذين يدعمون رياضة الجمباز في المملكة.', 'The approved clubs, partner organisations and sponsors supporting gymnastics in the Kingdom.'), extra: aboutTabs('partners') }) +
    `<section class="section tight"><div class="wrap"><div class="group-head"><h2>${t('الأندية المعتمدة', 'Approved clubs')}</h2><span></span></div><div class="grid">${clubs}</div></div></section>
<section class="section tight"><div class="wrap"><div class="group-head"><h2>${t('الشركاء والرعاة', 'Partners & sponsors')}</h2><span></span></div>${prt}</div></section>
<section class="section"><div class="wrap narrow"><div class="band center">
  <div class="band-text"><h2>${t('ناديك يرغب في التدريب معنا؟', 'Would your club like to train with us?')}</h2><p>${k.text}</p></div>
  <div class="band-acts"><a class="btn btn-accent" href="${wa(site.centres.khobar)}">${t('تواصل عبر واتساب', 'Chat on WhatsApp')}</a><a class="btn btn-ghost" href="${u('/centres/khobar/')}">${f(site.centres.khobar, 'name')}</a></div>
</div></div></section>`;
  return layout({ path: '/about/partners/', title: t('الأندية والشركاء', 'Clubs & Partners'), active: 'about', body });
}

function eventsIndex() {
  const keys = [...new Set(events.map((e) => e.centre))].filter((k) => site.centres[k]);
  const [up, past] = upcomingFirst();
  const upHtml = up.length ? `<div class="grid" data-filterable>${up.map(eventCard).join('')}</div>` : `<div class="notice">${t('لا توجد بطولات أو فعاليات قادمة معلنة حاليًا — تابعنا قريبًا.', 'No upcoming competitions or events have been announced yet — check back soon.')}</div>`;
  const body = pageHero({ crumbs: [MEDIA()], title: t('البطولات والفعاليات', 'Competitions & Events'), sub: t('مواعيد البطولات والفعاليات في مراكز الاتحاد، ونتائجها وصورها.', "Dates, results and photos of competitions and events at the federation's centres."), extra: mediaTabs('events') }) +
    `<section class="section" style="padding-top:40px"><div class="wrap">${filterBar(keys)}
    <div class="group-head"><h2>${t('القادمة', 'Upcoming')}</h2><span></span></div>${upHtml}
    <div class="group-head" style="margin-top:48px"><h2>${t('السابقة', 'Past')}</h2><span></span></div><div class="grid" data-filterable>${past.map(eventCard).join('')}</div>
    </div></section>`;
  return layout({ path: '/events/', title: t('البطولات والفعاليات', 'Competitions & Events'), active: 'media', body });
}

function mediaHub() {
  const [up, past] = upcomingFirst();
  const block = (title, href, all, cards) => `<section class="section tight"><div class="wrap"><div class="group-head"><h2>${title}</h2><span></span><a class="btn btn-soft" href="${u(href)}">${all}</a></div>${cards}</div></section>`;
  const body = pageHero({ title: t('المركز الإعلامي', 'Media Centre'), sub: t('كل ما يخص البطولات والفعاليات والأخبار وصور الاتحاد ومراكزه في مكان واحد.', "Competitions, events, news and photos from the federation and its centres, all in one place."), extra: mediaTabs('hub') }) +
    block(t('البطولات والفعاليات القادمة', 'Upcoming competitions & events'), '/events/', t('كل البطولات', 'All competitions'), up.length ? `<div class="grid">${up.slice(0, 3).map(eventCard).join('')}</div>` : `<div class="notice">${t('لا توجد فعاليات قادمة معلنة حاليًا.', 'No upcoming events announced yet.')}</div>`) +
    block(t('آخر الأخبار', 'Latest news'), '/news/', t('كل الأخبار', 'All news'), `<div class="grid">${news.slice(0, 3).map(newsCard).join('')}</div>`) +
    block(t('أحدث الألبومات', 'Latest albums'), '/gallery/', t('معرض الصور', 'Photo gallery'), `<div class="grid">${albums.slice(0, 3).map(albumCard).join('')}</div>`) +
    block(t('بطولات سابقة', 'Past competitions'), '/events/', t('الأرشيف', 'Archive'), `<div class="grid">${past.slice(0, 3).map(eventCard).join('')}</div>`) +
    '<div style="height:60px"></div>';
  return layout({ path: '/media/', title: t('المركز الإعلامي', 'Media Centre'), active: 'media', body });
}

function eventPage(e) {
  const c = centre(e.centre);
  const album = albums.find((a) => a.slug === e.album);
  const links = [
    e.register_link && `<a class="btn btn-accent" href="${esc(e.register_link)}">${t('سجّل في البطولة', 'Register for this event')}</a>`,
    album && `<a class="btn btn-primary" href="${u(`/gallery/${album.slug}/`)}">${t('ألبوم الصور', 'Photo album')} (${album.photos.length})</a>`,
    e.video && `<a class="btn btn-soft" href="${esc(e.video)}" target="_blank" rel="noopener">${t('فيديو البطولة', 'Event video')}</a>`,
    `<a class="btn btn-soft" href="${u('/events/')}">${t('كل البطولات', 'All competitions')}</a>`,
  ].filter(Boolean).join('');
  const preview = album ? `<h2 style="font-size:20px;margin:28px 0 12px">${t('من الصور', 'Photos')}</h2><div class="photos">${album.photos.slice(0, 6).map((p) => `<a href="${u(`/gallery/${album.slug}/`)}" class="thumb"><img src="${album.photo_dir}${p}-sm.webp" alt="" loading="lazy"></a>`).join('')}</div>` : '';
  const body = pageHero({ crumbs: [MEDIA(), ['/events/', t('البطولات والفعاليات', 'Competitions & Events')]], title: f(e, 'title') }) + `
<div class="wrap"><article class="article">
  ${e.cover ? `<div class="cover"><img src="${esc(e.cover)}" alt="${esc(f(e, 'title'))}"></div>` : ''}
  <div class="content">
    <div class="facts"><div><span>${t('التاريخ', 'Date')}</span><strong>${esc(fmtRange(e))}</strong></div><div><span>${t('المكان', 'Venue')}</span><strong>${esc(f(e, 'location'))}</strong></div><div><span>${t('المركز', 'Centre')}</span><strong>${c.page ? `<a href="${u(`/centres/${c.slug}/`)}">${esc(f(c, 'name'))}</a>` : esc(f(c, 'name'))}</strong></div></div>
    ${f(e, 'details')}
    <div class="links">${links}</div>
    ${preview}
  </div>
</article></div>`;
  return layout({ path: `/events/${e.slug}/`, title: f(e, 'title'), desc: f(e, 'summary'), active: 'media', body });
}

function newsIndex() {
  const body = pageHero({ crumbs: [MEDIA()], title: t('الأخبار', 'News'), sub: t('آخر أخبار الاتحاد ومراكز التدريب.', 'The latest news from the federation and its training centres.'), extra: mediaTabs('news') }) + `<section class="section" style="padding-top:40px"><div class="wrap"><div class="grid">${news.map(newsCard).join('')}</div></div></section>`;
  return layout({ path: '/news/', title: t('الأخبار', 'News'), active: 'media', body });
}

function newsPage(n) {
  const links = (n.links || []).map((l) => `<a class="btn btn-soft" href="${u(l.href)}">${esc(f(l, 'label'))}</a>`).join('');
  const body = pageHero({ crumbs: [MEDIA(), ['/news/', t('الأخبار', 'News')]], title: f(n, 'title'), sub: esc(fmtDate(n.date)) }) +
    `<div class="wrap"><article class="article">${n.cover ? `<div class="cover"><img src="${esc(n.cover)}" alt=""></div>` : ''}<div class="content">${f(n, 'body')}<div class="links">${links}</div></div></article></div>`;
  return layout({ path: `/news/${n.slug}/`, title: f(n, 'title'), desc: f(n, 'summary'), active: 'media', body });
}

function galleryIndex() {
  const keys = [...new Set(albums.map((a) => a.centre))].filter((k) => site.centres[k]);
  const body = pageHero({ crumbs: [MEDIA()], title: t('معرض الصور', 'Photo Gallery'), sub: t('صور البطولات والفعاليات في مراكز الاتحاد.', "Photos from competitions and events at the federation's centres."), extra: mediaTabs('gallery') }) +
    `<section class="section" style="padding-top:40px"><div class="wrap">${keys.length > 1 ? filterBar(keys) : ''}<div class="grid" data-filterable>${albums.map(albumCard).join('')}</div></div></section>`;
  return layout({ path: '/gallery/', title: t('معرض الصور', 'Photo Gallery'), active: 'media', body });
}

function albumPage(a) {
  const ev = events.find((e) => e.slug === a.event);
  const n = a.photos.length;
  const photos = a.photos.map((p, i) => `<button type="button" data-full="${a.photo_dir}${p}.webp" aria-label="${t(`صورة ${i + 1} من ${n}`, `Photo ${i + 1} of ${n}`)}"><img src="${a.photo_dir}${p}-sm.webp" alt="" loading="lazy"></button>`).join('');
  const body = pageHero({ crumbs: [MEDIA(), ['/gallery/', t('معرض الصور', 'Photo Gallery')]], title: f(a, 'title'), sub: esc(f(a, 'description')) }) + `
<section class="section" style="padding-top:40px"><div class="wrap">
  <div class="chips"><span class="tag">🖼 ${n} ${t('صورة', 'photos')}</span><span class="tag">📅 ${esc(fmtDate(a.date))}</span>${ev ? `<a class="btn btn-soft" href="${u(`/events/${ev.slug}/`)}">${t('صفحة البطولة', 'Event page')}</a>` : ''}</div>
  <div class="photos" data-lightbox>${photos}</div>
</div></section>
<div class="lightbox" role="dialog" aria-modal="true" aria-label="${t('عارض الصور', 'Photo viewer')}"><img alt=""><button class="close" aria-label="${t('إغلاق', 'Close')}">✕</button><button class="prev" aria-label="${t('السابقة', 'Previous')}">${t('›', '‹')}</button><button class="next" aria-label="${t('التالية', 'Next')}">${t('‹', '›')}</button><span class="count"></span></div>`;
  return layout({ path: `/gallery/${a.slug}/`, title: f(a, 'title'), desc: f(a, 'description'), active: 'media', body });
}

function heroOptions() {
  const dir = '/assets/img/gfa2026/';
  const btns = `<div class="actions"><a class="btn btn-accent" href="#">مراكز التدريب</a><a class="btn btn-ghost" href="#">جداول البطولات</a></div>`;
  const txt = `<h1>${esc(site.name)}</h1><p class="sub">${esc(site.tagline)}</p>${btns}`;
  const sparks = Array.from({ length: 14 }, (_, i) => `<span class="spark" style="left:${(i * 7 + 5) % 100}%;bottom:${(i * 13) % 40}%;animation-delay:-${(i * 0.45).toFixed(2)}s"></span>`).join('');
  const body = pageHero({ title: 'خيارات الواجهة الرئيسية', sub: 'أربعة تصاميم متحركة للقسم الأخضر أعلى الصفحة الرئيسية.' }) + `
<div style="height:36px"></div>
<section class="hx hx-a"><span class="opt-label">الخيار أ — حلقات متحركة</span><span class="ring r1"></span><span class="ring r2"></span><span class="ring r3"></span><span class="ring r4"></span><span class="ring r5"></span>${sparks}<div class="inner">${txt}</div></section>
<p class="opt-desc"><strong>أ — حلقات الهوية المتحركة</strong></p>
<section class="hx hx-b"><span class="opt-label">الخيار ب — صور البطولات</span><div class="slides">${['DSC01789', 'DSC00565', 'DSC01611', 'DSC01024'].map((p) => `<img src="${dir}${p}.webp" alt="" aria-hidden="true">`).join('')}</div><div class="inner">${txt}</div></section>
<p class="opt-desc"><strong>ب — عرض صور البطولات (المعتمد)</strong></p>
<section class="hx hx-c"><span class="opt-label">الخيار ج — شريط الجمباز الإيقاعي</span><svg viewBox="0 0 1440 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<path class="p1" d="M-40 420 C 200 180, 380 560, 620 330 S 980 80, 1180 300 S 1420 520, 1520 260"/>
<path class="p2" d="M-40 470 C 240 260, 420 600, 680 380 S 1020 140, 1220 360 S 1440 560, 1520 330"/>
<path class="p3" d="M-40 140 C 160 260, 360 40, 560 180 S 900 340, 1100 160 S 1380 40, 1520 120"/>
</svg><div class="inner">${txt}</div></section>
<p class="opt-desc"><strong>ج — شريط الجمباز الإيقاعي</strong></p>
<section class="hx hx-d"><span class="opt-label">الخيار د — نص وصور</span><div class="split"><div class="txt"><h1>${esc(site.name)}</h1><p class="sub">${esc(site.tagline)}</p>${btns}</div>
<div class="mosaic">${['DSC00546', 'DSC00712', 'DSC01819', 'DSC01221', 'DSC01480', 'DSC00923'].map((p) => `<img src="${dir}${p}-sm.webp" alt="" aria-hidden="true">`).join('')}</div></div></section>
<p class="opt-desc"><strong>د — نص مع لوحة صور</strong></p>`;
  return layout({ path: '/hero-options/', title: 'خيارات الواجهة', body, extraHead: '<link rel="stylesheet" href="/assets/css/heroes.css"><meta name="robots" content="noindex">' });
}

const notFound = () => layout({ path: '/', title: t('الصفحة غير موجودة', 'Page not found'), body: pageHero({ title: t('الصفحة غير موجودة', 'Page not found'), sub: t('ربما نُقلت الصفحة أو تغيّر رابطها.', 'The page may have moved or its link changed.'), extra: `<p style="margin-top:20px"><a class="btn btn-accent" href="${u('/')}">${t('العودة للرئيسية', 'Back to home')}</a></p>` }) });

// ---------- write ----------
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
let pages = 0;
for (const lang of ['ar', 'en']) {
  LANG = lang;
  const base = lang === 'en' ? 'en/' : '';
  const put = (p, html) => { const file = join(OUT, base + p); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, html); pages++; };
  put('index.html', home());
  put('home-v2/index.html', homeV2());
  liveCentres.forEach((c) => put(`centres/${c.slug}/index.html`, centrePage(c)));
  Object.values(site.centres).filter((c) => c.soon && c.slug).forEach((c) => put(`centres/${c.slug}/index.html`, soonCentrePage(c)));
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
  if (lang === 'ar') { put('hero-options/index.html', heroOptions()); put('404.html', notFound()); }
}
console.log(`Built ${pages} pages (Arabic + English) → dist/`);
