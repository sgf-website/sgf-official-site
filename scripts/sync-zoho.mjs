// Pulls website content from Zoho CRM into data/*.json (+ downloads photos).
// Runs in GitHub Actions. Secrets: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET,
// ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNTS_URL (e.g. https://accounts.zoho.com),
// ZOHO_API_URL (e.g. https://www.zohoapis.com), optional GOOGLE_API_KEY (Drive albums).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import sharp from 'sharp';

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..');
const env = (k, d) => process.env[k] || d;
const ACC = env('ZOHO_ACCOUNTS_URL', 'https://accounts.zoho.com');
const API = env('ZOHO_API_URL', 'https://www.zohoapis.com');
const GKEY = env('GOOGLE_API_KEY', '');

const readJson = (f, d) => { try { return JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8')); } catch { return d; } };
const writeJson = (f, v) => writeFileSync(join(ROOT, 'data', f), JSON.stringify(v, null, 2) + '\n');

async function token() {
  const u = new URL(`${ACC}/oauth/v2/token`);
  u.search = new URLSearchParams({ grant_type: 'refresh_token', client_id: env('ZOHO_CLIENT_ID'), client_secret: env('ZOHO_CLIENT_SECRET'), refresh_token: env('ZOHO_REFRESH_TOKEN') });
  const r = await fetch(u, { method: 'POST' }).then((x) => x.json());
  if (!r.access_token) throw new Error('Zoho token error: ' + JSON.stringify(r));
  return r.access_token;
}

let TOKEN;
const H = () => ({ Authorization: `Zoho-oauthtoken ${TOKEN}` });
async function coql(q) {
  const out = [];
  for (let off = 0; ; off += 200) {
    const r = await fetch(`${API}/crm/v8/coql`, { method: 'POST', headers: { ...H(), 'Content-Type': 'application/json' }, body: JSON.stringify({ select_query: `${q} limit ${off}, 200` }) });
    if (r.status === 204) break;
    const j = await r.json();
    if (!j.data) throw new Error('COQL error: ' + JSON.stringify(j));
    out.push(...j.data);
    if (!j.info?.more_records) break;
  }
  return out;
}
async function getRecord(module, id) {
  const j = await fetch(`${API}/crm/v8/${module}/${id}`, { headers: H() }).then((x) => x.json());
  return j.data?.[0] || {};
}

const slugify = (r) => (r.Website_Slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || String(r.id);
const centreKey = (b) => ({ Khobar: 'khobar', Riyadh: 'riyadh', Jeddah: 'jeddah', Federation: 'federation' }[b] || 'federation');

async function saveImage(buf, dir, name) {
  const abs = join(ROOT, 'assets', dir);
  mkdirSync(abs, { recursive: true });
  await sharp(buf).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(join(abs, `${name}.webp`));
  await sharp(buf).rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toFile(join(abs, `${name}-sm.webp`));
  return `/assets/${dir}/${name}.webp`;
}

// Download an image-upload field (first image) — returns site path or ''.
async function zohoImage(module, rec, field, dir, name) {
  const full = await getRecord(module, rec.id);
  const img = (full[field] || [])[0];
  if (!img) return '';
  const fid = img.File_Id__s || img.file_Id || img.id;
  const r = await fetch(`${API}/crm/v8/${module}/${rec.id}/actions/download_fields_attachment?fields_attachment_id=${img.Attachment_Id__s || fid}`, { headers: H() });
  if (!r.ok) { console.warn(`image download failed ${module}/${rec.id}: ${r.status}`); return ''; }
  return saveImage(Buffer.from(await r.arrayBuffer()), dir, name);
}

const folderId = (url = '') => (url.match(/folders\/([A-Za-z0-9_-]+)/) || [])[1];
async function driveImages(folder) {
  if (!GKEY || !folder) return [];
  const q = encodeURIComponent(`'${folder}' in parents and mimeType contains 'image/' and trashed = false`);
  const j = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&orderBy=name&pageSize=500&key=${GKEY}`).then((x) => x.json());
  return j.files || [];
}

async function main() {
  if (!process.env.ZOHO_REFRESH_TOKEN) { console.log('Zoho secrets not set yet — skipping sync.'); return; }
  TOKEN = await token();
  const prevEvents = Object.fromEntries(readJson('events.json', []).map((e) => [e.slug, e]));
  const prevAlbums = Object.fromEntries(readJson('albums.json', []).map((a) => [a.slug, a]));
  const prevNews = Object.fromEntries(readJson('news.json', []).map((n) => [n.slug, n]));

  const evRows = await coql("select Name, Website_Slug, Event_Date, End_Date, Event_Type, Branch, Location, Website_Summary, Website_Details, Registration_Link, Video_Link, Modified_Time from Center_Events where Show_on_Website = true");
  const alRows = await coql("select Name, Website_Slug, Branch, Album_Date, Description, Drive_Folder_Link, Related_Event, Modified_Time from Website_Albums where Show_on_Website = true");
  const nwRows = await coql("select Name, Website_Slug, Branch, News_Date, Summary, News_Body, Related_Event, Related_Album, Modified_Time from Website_News where Show_on_Website = true");

  const evSlug = Object.fromEntries(evRows.map((r) => [r.id, slugify(r)]));
  const alSlug = Object.fromEntries(alRows.map((r) => [r.id, slugify(r)]));

  // Albums
  const albums = [];
  for (const r of alRows) {
    const slug = alSlug[r.id]; const prev = prevAlbums[slug] || {};
    const folder = folderId(r.Drive_Folder_Link);
    let { photos = [], photo_dir = `/assets/img/albums/${slug}/`, cover = '' } = prev;
    if (folder && (prev.drive_folder !== folder || !photos.length) && GKEY) {
      photos = []; photo_dir = `/assets/img/albums/${slug}/`;
      for (const f of await driveImages(folder)) {
        const name = f.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '_');
        const buf = Buffer.from(await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${GKEY}`).then((x) => x.arrayBuffer()));
        await saveImage(buf, `img/albums/${slug}`, name); photos.push(name);
      }
    }
    const unchanged = prev.zoho_modified === r.Modified_Time;
    const zCover = unchanged ? '' : await zohoImage('Website_Albums', r, 'Cover_Photo', `img/albums/${slug}`, 'cover');
    if (zCover) cover = 'cover'; else if (!cover && photos.length) cover = photos[0];
    if (cover === 'cover' && !photos.length) photos = ['cover'];
    albums.push({ slug, status: 'published', title: r.Name, date: r.Album_Date || '', centre: centreKey(r.Branch), description: r.Description || '', cover, event: r.Related_Event ? evSlug[r.Related_Event.id] || '' : '', photo_dir, photos, drive_folder: folder || prev.drive_folder || '', zoho_modified: r.Modified_Time });
  }

  // Events
  const events = [];
  for (const r of evRows) {
    const slug = evSlug[r.id]; const prev = prevEvents[slug] || {};
    const cover = (prev.zoho_modified === r.Modified_Time ? '' : await zohoImage('Center_Events', r, 'Cover_Photo', 'img/events', slug)) || prev.cover || '';
    const album = albums.find((a) => a.event === slug);
    const year = (r.Name.match(/(20\d\d)/) || [])[1];
    events.push({ slug, type: r.Event_Type === 'Competition' ? 'competition' : 'event', status: 'published', title: r.Name, date: r.Event_Date || (year ? `${year}-01-01` : ''), ...(r.Event_Date ? {} : year ? { date_label: year } : {}), date_end: r.End_Date || '', centre: centreKey(r.Branch), location: r.Location || '', summary: r.Website_Summary || '', details: r.Website_Details || '', cover, album: album ? album.slug : '', video: r.Video_Link || '', register_link: r.Registration_Link || '', zoho_modified: r.Modified_Time });
  }

  // News
  const news = [];
  for (const r of nwRows) {
    const slug = slugify(r); const prev = prevNews[slug] || {};
    const cover = (prev.zoho_modified === r.Modified_Time ? '' : await zohoImage('Website_News', r, 'Cover_Photo', 'img/news', slug)) || prev.cover || '';
    const links = [];
    if (r.Related_Album && alSlug[r.Related_Album.id]) links.push({ label: 'ألبوم الصور', href: `/gallery/${alSlug[r.Related_Album.id]}/` });
    if (r.Related_Event && evSlug[r.Related_Event.id]) links.push({ label: 'صفحة البطولة', href: `/events/${evSlug[r.Related_Event.id]}/` });
    news.push({ slug, status: 'published', title: r.Name, date: r.News_Date || '', centre: centreKey(r.Branch), summary: r.Summary || '', body: r.News_Body || '', cover, links, zoho_modified: r.Modified_Time });
  }

  writeJson('events.json', events);
  writeJson('albums.json', albums);
  writeJson('news.json', news);
  console.log(`Synced from Zoho: ${events.length} events, ${albums.length} albums, ${news.length} news`);
}

main().catch((e) => {
  const msg = String(e && e.message || e).replace(/[\r\n]+/g, ' ').slice(0, 600);
  console.error(e);
  console.log(`::error title=Zoho sync failed::${msg}`);
  process.exit(1);
});
