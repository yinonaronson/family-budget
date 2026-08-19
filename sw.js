/* הכיס המשפחתי — Service Worker
   אסטרטגיה: רשת-תחילה עבור הקבצים שלנו, עם נפילה למטמון.
   כך האפליקציה תמיד מעודכנת כשיש רשת, ונפתחת כרגיל כשאין.
   בקשות ל-Supabase (מקור אחר) עוברות ישירות ולא נוגעות במטמון. */

const CACHE  = 'hakis-shell-v2';   /* גרסה 2 — מעבר לחשבונות ולשמירה בשרת */
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './supabase.js', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .catch(() => {})            // קובץ בודד שנכשל לא יפיל את ההתקנה
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // POST של סנכרון — לא נוגעים
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;        // רק הנכסים שלנו

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
