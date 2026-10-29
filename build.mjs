// Static site generator for the SGF website (no dependencies).
// Content comes from data/*.json. In the next phase these files are filled
// automatically from Zoho CRM (events, news, albums) before each build.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = dirname(new URL(import.meta.url).pathname);
const OUT = join(ROOT, 'dist');
const read = (f) => JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8'));

const site = read('site.json');
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
const today = new Date().toISOString().slice(0, 10);
const TYPE = { competition: 'بطولة', event: 'فعالية', news: 'خبر' };

const NAV = [
  ['/', 'الرئيسية', 'home'],
  ['/events/', 'البطولات والفعاليات', 'events'],
  ['/news/', 'الأخبار', 'news'],
  ['/gallery/', 'معرض الصور', 'gallery'],
  ['/#centres', 'مراكز التدريب', 'centres'],
  ['/#social', 'تابعنا', 'social'],
];

function layout({ title, desc = site.tagline, active = '', body }) {
  const nav = NAV.map(([href, label, key]) => `<a href="${href}"${key === active ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('');
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
<link rel="stylesheet" href="/assets/css/site.css">
</head>
<body>
<div class="preview-bar">نسخة معاينة أولية — المحتوى والتصميم قابلان للتحديث</div>
<header class="site-header">
  <div class="wrap">
    <a class="logo" href="/"><img src="/assets/img/sgf_logo_horizontal.png" alt="${esc(site.name)}" width="229" height="48"></a>
    <button class="menu-toggle" aria-expanded="false" aria-controls="nav">القائمة ☰</button>
    <nav id="nav" class="nav" aria-label="القائمة الرئيسية">${nav}<a class="lang" href="#" title="قريبًا">English</a></nav>
    <a class="btn btn-primary header-cta" href="${site.register_url}">سجّل الآن</a>
  </div>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="cols">
      <div class="col"><img src="/assets/img/sgf_logo_horizontal_white.png" alt="${esc(site.name)}"><p style="margin:0">نطوّر رياضة الجمباز في المملكة من المراكز إلى المنتخبات.</p></div>
      <div class="col"><p class="h">روابط</p><a href="/events/">البطولات والفعاليات</a><a href="/news/">الأخبار</a><a href="/gallery/">معرض الصور</a><a href="${site.register_url}">التسجيل</a></div>
      <div class="col"><p class="h">تواصل معنا</p>
        <span>واتساب الخبر: <a href="https://wa.me/${site.centres.khobar.whatsapp}"><bdi dir="ltr">${site.centres.khobar.whatsapp_label}</bdi></a></span>
        <span>واتساب الرياض: <a href="https://wa.me/${site.centres.riyadh.whatsapp}"><bdi dir="ltr">${site.centres.riyadh.whatsapp_label}</bdi></a></span>
        <span>إنستغرام: <a href="https://instagram.com/saudigymnastics"><bdi dir="ltr">@saudigymnastics</bdi></a> · <a href="https://instagram.com/saudigym.dmm"><bdi dir="ltr">@saudigym.dmm</bdi></a> · <a href="https://instagram.com/sgf.riyadh"><bdi dir="ltr">@sgf.riyadh</bdi></a></span>
      </div>
    </div>
    <p class="copy">© ${new Date().getFullYear()} ${esc(site.name)}</p>
  </div>
</footer>
<script src="/assets/js/site.js" defer></script>
</body>
</html>`;
}

const ph = `<img class="ph" src="/assets/img/sgf_emblem.png" alt="" aria-hidden="true">`;

function eventCard(e) {
  const c = centre(e.centre);
  const media = e.cover ? `<img src="${esc(e.cover)}" alt="" loading="lazy">` : ph;
  const upcoming = (e.date_end || e.date) >= today;
  return `<a class="card" href="/events/${e.slug}/" data-centre="${e.centre}" data-when="${upcoming ? 'upcoming' : 'past'}">
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
  return `<a class="card" href="/news/${n.slug}/">
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

const filterBar = (keys) => `<div class="filters" role="group" aria-label="تصفية حسب المركز">
  <button type="button" data-filter="all" aria-pressed="true">الكل</button>
  ${keys.map((k) => `<button type="button" data-filter="${k}" aria-pressed="false">${esc(site.centres[k].short)}</button>`).join('')}
</div>`;

function socialSection() {
  const s = site.social;
  const x = s.x
    ? `<a class="twitter-timeline" data-lang="ar" data-height="420" data-chrome="noheader nofooter" href="https://twitter.com/${esc(s.x)}">منشورات @${esc(s.x)}</a><script async src="https://platform.twitter.com/widgets.js"></script>`
    : `<div class="empty">تظهر هنا آخر منشورات حساب الاتحاد على X تلقائيًا<br>(بانتظار اسم الحساب)</div>`;
  const snap = s.snapchat
    ? `<blockquote class="snapchat-embed" data-snapchat-embed-url="https://www.snapchat.com/add/${esc(s.snapchat)}/embed" style="background:#C4C4C4;height:420px;width:100%;margin:0;border-radius:14px"></blockquote><script async src="https://www.snapchat.com/embed.js"></script>`
    : `<div class="empty">يظهر هنا الملف العام وقصص الاتحاد على سناب شات<br>(بانتظار اسم الحساب)</div>`;
  const ig = ['saudigymnastics', 'saudigym.dmm', 'sgf.riyadh'].map((h) => `<a class="btn btn-soft" href="https://instagram.com/${h}"><bdi dir="ltr">@${h}</bdi></a>`).join('');
  return `<section class="section" id="social"><div class="wrap">
  <div class="sec-head"><p class="eyebrow">تابعنا</p><h2>آخر ما نشرناه</h2></div>
  <div class="social">
    <div class="panel"><h3><span class="icon" style="background:#000">X</span>إكس (تويتر)</h3>${x}</div>
    <div class="panel"><h3><span class="icon" style="background:#FFFC00;color:#000">👻</span>سناب شات</h3>${snap}</div>
    <div class="panel"><h3><span class="icon" style="background:#C13584">IG</span>إنستغرام</h3><p style="margin:0;color:var(--muted);font-size:15px">حسابات الاتحاد والمراكز:</p><div style="display:flex;flex-wrap:wrap;gap:8px">${ig}</div><div class="empty">يمكن عرض آخر منشورات إنستغرام هنا تلقائيًا بعد ربط الحساب كحساب أعمال</div></div>
  </div>
</div></section>`;
}

function home() {
  const upcoming = events.filter((e) => (e.date_end || e.date) >= today);
  const latestEvents = [...upcoming.reverse(), ...events.filter((e) => !upcoming.includes(e))].slice(0, 3);
  const quick = [
    ['#EB0045', 'سجّل الآن', 'نموذج تسجيل سريع للاعبين الجدد من عمر 5 سنوات.', site.register_url, 'ابدأ التسجيل'],
    ['#FFA500', 'الباقات والأسعار', 'اشتراكات شهرية تبدأ من 800 ريال، بأوقات تناسب الجميع.', '#centres', 'عرض الباقات'],
    ['#0075C9', 'جداول البطولات', 'مواعيد البطولات والفعاليات القادمة في مراكز الاتحاد.', '/events/', 'عرض الجداول'],
    ['#0A5640', 'مراكز التدريب', 'اختر المركز الأقرب إليك: الخبر، الرياض، وقريبًا جدة.', '#centres', 'عرض المراكز'],
  ].map(([c, t, d, h, l]) => `<article style="--c:${c}"><h3>${t}</h3><p>${d}</p><a class="btn btn-soft" href="${h}">${l}</a></article>`).join('');
  const centreCard = (k) => { const c = site.centres[k]; return `<article class="centre" style="--c:${c.color}"><p class="city">${c.short}</p><h3>${c.name}</h3><p class="addr">${esc(c.address)}</p><p>الأوقات: ${c.hours}<br>${c.days}</p><div class="acts"><a class="btn btn-primary" style="padding:9px 20px;font-size:14px" href="#">صفحة المركز</a><a class="btn btn-soft" href="https://wa.me/${c.whatsapp}">واتساب المركز</a></div></article>`; };
  const body = `
<section class="hero"><img class="emblem" src="/assets/img/sgf_emblem.png" alt="" aria-hidden="true"><div class="inner">
  <h1>${esc(site.name)}</h1><p class="sub">${esc(site.tagline)}</p>
  <div class="actions"><a class="btn btn-accent" href="#centres">مراكز التدريب</a><a class="btn btn-ghost" href="/events/">جداول البطولات</a></div>
</div></section>
<div class="wrap"><div class="quick">${quick}</div></div>

<section class="section" id="events"><div class="wrap">
  <div class="sec-head"><p class="eyebrow">البطولات والفعاليات</p><h2>آخر البطولات والفعاليات</h2></div>
  <div class="grid">${latestEvents.map(eventCard).join('')}</div>
  <div class="sec-more"><a class="btn btn-primary" href="/events/">كل البطولات والفعاليات</a></div>
</div></section>

<section class="section"><div class="wrap">
  <div class="sec-head"><p class="eyebrow">الأخبار</p><h2>آخر الأخبار</h2></div>
  <div class="grid">${news.slice(0, 3).map(newsCard).join('')}</div>
  <div class="sec-more"><a class="btn btn-primary" href="/news/">كل الأخبار</a></div>
</div></section>

<section class="section"><div class="wrap">
  <div class="sec-head"><p class="eyebrow">معرض الصور</p><h2>لحظات من بطولاتنا</h2></div>
  <div class="grid">${albums.slice(0, 3).map(albumCard).join('')}</div>
  <div class="sec-more"><a class="btn btn-primary" href="/gallery/">معرض الصور</a></div>
</div></section>

<section class="section" id="centres"><div class="wrap">
  <div class="sec-head"><p class="eyebrow">مراكز التدريب</p><h2>اختر المركز الأقرب إليك</h2></div>
  <div class="grid">${centreCard('khobar')}${centreCard('riyadh')}<article class="centre soon"><p class="city" style="--c:var(--muted)">جدة</p><h3>مركز تدريب جدة</h3><p class="addr">التفاصيل قريبًا</p><span class="pill-muted">قريبًا</span></article></div>
</div></section>

${socialSection()}

<section class="section"><div class="wrap">
  <div class="sec-head"><p class="eyebrow">عن الاتحاد</p><h2>الفريق الذي يقف خلف الجمباز السعودي</h2></div>
  <div class="grid about">
    <a href="#"><span class="t">مجلس الإدارة والفريق</span><span class="d">أعضاء مجلس الإدارة، الجهاز الإداري، وإدارة المراكز.</span><span class="m">قريبًا</span></a>
    <a href="#"><span class="t">المدربون</span><span class="d">مدربون ومدربات معتمدون في الخبر والرياض.</span><span class="m">قريبًا</span></a>
    <a href="#"><span class="t">الأندية والشركاء</span><span class="d">الأندية المعتمدة والشركاء والرعاة.</span><span class="m">قريبًا</span></a>
  </div>
</div></section>`;
  return layout({ title: site.name, active: 'home', body });
}

function eventsIndex() {
  const keys = [...new Set(events.map((e) => e.centre))].filter((k) => site.centres[k]);
  const body = `<section class="page-hero"><h1>البطولات والفعاليات</h1><p>مواعيد البطولات والفعاليات في مراكز الاتحاد، ونتائجها وصورها.</p></section>
<section class="section" style="padding-top:40px"><div class="wrap">${filterBar(keys)}<div class="grid" data-filterable>${events.map(eventCard).join('')}</div></div></section>`;
  return layout({ title: 'البطولات والفعاليات', active: 'events', body });
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
  const preview = album ? `<h2 style="font-size:20px;margin:28px 0 12px">من الصور</h2><div class="photos">${album.photos.slice(0, 6).map((p) => `<a href="/gallery/${album.slug}/" style="border-radius:12px;overflow:hidden;aspect-ratio:4/3;display:block"><img src="${album.photo_dir}${p}-sm.webp" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"></a>`).join('')}</div>` : '';
  const body = `<section class="page-hero"><div class="crumbs"><a href="/">الرئيسية</a> › <a href="/events/">البطولات والفعاليات</a></div><h1>${esc(e.title)}</h1></section>
<div class="wrap"><article class="article">
  ${e.cover ? `<div class="cover"><img src="${esc(e.cover)}" alt="${esc(e.title)}"></div>` : ''}
  <div class="content">
    <div class="facts"><div><span>التاريخ</span><strong>${esc(fmtRange(e))}</strong></div><div><span>المكان</span><strong>${esc(e.location)}</strong></div><div><span>المركز</span><strong>${esc(c.name)}</strong></div></div>
    ${e.details}
    <div class="links">${links}</div>
    ${preview}
  </div>
</article></div>`;
  return layout({ title: e.title, desc: e.summary, active: 'events', body });
}

function newsIndex() {
  const body = `<section class="page-hero"><h1>الأخبار</h1><p>آخر أخبار الاتحاد ومراكز التدريب.</p></section>
<section class="section" style="padding-top:40px"><div class="wrap"><div class="grid">${news.map(newsCard).join('')}</div></div></section>`;
  return layout({ title: 'الأخبار', active: 'news', body });
}

function newsPage(n) {
  const links = (n.links || []).map((l) => `<a class="btn btn-soft" href="${esc(l.href)}">${esc(l.label)}</a>`).join('');
  const body = `<section class="page-hero"><div class="crumbs"><a href="/">الرئيسية</a> › <a href="/news/">الأخبار</a></div><h1>${esc(n.title)}</h1><p>${esc(fmtDate(n.date))}</p></section>
<div class="wrap"><article class="article">${n.cover ? `<div class="cover"><img src="${esc(n.cover)}" alt=""></div>` : ''}<div class="content">${n.body}<div class="links">${links}</div></div></article></div>`;
  return layout({ title: n.title, desc: n.summary, active: 'news', body });
}

function galleryIndex() {
  const keys = [...new Set(albums.map((a) => a.centre))].filter((k) => site.centres[k]);
  const body = `<section class="page-hero"><h1>معرض الصور</h1><p>صور البطولات والفعاليات في مراكز الاتحاد.</p></section>
<section class="section" style="padding-top:40px"><div class="wrap">${keys.length > 1 ? filterBar(keys) : ''}<div class="grid" data-filterable>${albums.map(albumCard).join('')}</div></div></section>`;
  return layout({ title: 'معرض الصور', active: 'gallery', body });
}

function albumPage(a) {
  const ev = events.find((e) => e.slug === a.event);
  const photos = a.photos.map((p, i) => `<button type="button" data-full="${a.photo_dir}${p}.webp" aria-label="صورة ${i + 1} من ${a.photos.length}"><img src="${a.photo_dir}${p}-sm.webp" alt="" loading="lazy"></button>`).join('');
  const body = `<section class="page-hero"><div class="crumbs"><a href="/">الرئيسية</a> › <a href="/gallery/">معرض الصور</a></div><h1>${esc(a.title)}</h1><p>${esc(a.description)}</p></section>
<section class="section" style="padding-top:40px"><div class="wrap">
  <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:24px"><span class="tag">🖼 ${a.photos.length} صورة</span><span class="tag">📅 ${esc(fmtDate(a.date))}</span>${ev ? `<a class="btn btn-soft" href="/events/${ev.slug}/">صفحة البطولة</a>` : ''}</div>
  <div class="photos" data-lightbox>${photos}</div>
</div></section>
<div class="lightbox" role="dialog" aria-modal="true" aria-label="عارض الصور"><img alt=""><button class="close" aria-label="إغلاق">✕</button><button class="prev" aria-label="السابقة">›</button><button class="next" aria-label="التالية">‹</button><span class="count"></span></div>`;
  return layout({ title: a.title, desc: a.description, active: 'gallery', body });
}

function notFound() {
  return layout({ title: 'الصفحة غير موجودة', body: `<section class="page-hero"><h1>الصفحة غير موجودة</h1><p>ربما نُقلت الصفحة أو تغيّر رابطها.</p><p style="margin-top:20px"><a class="btn btn-accent" href="/">العودة للرئيسية</a></p></section>` });
}

// ---- write ----
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
const put = (p, html) => { const f = join(OUT, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, html); };
cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
put('index.html', home());
put('events/index.html', eventsIndex());
events.forEach((e) => put(`events/${e.slug}/index.html`, eventPage(e)));
put('news/index.html', newsIndex());
news.forEach((n) => put(`news/${n.slug}/index.html`, newsPage(n)));
put('gallery/index.html', galleryIndex());
albums.forEach((a) => put(`gallery/${a.slug}/index.html`, albumPage(a)));
put('404.html', notFound());
console.log(`Built: ${events.length} events, ${news.length} news, ${albums.length} albums → dist/`);
