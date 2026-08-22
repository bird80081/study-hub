/* 離線快取：安裝時抓核心檔與題庫，之後網路優先、失敗用快取（公車斷網也能考） */
const CACHE = "studyhub-v35";
const CORE = ["./", "index.html", "style.css", "app.js", "manifest.json", "exams/index.json", "data/vocab.json", "data/notes.json", "notes.html", "data/notes-long.json"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(async c => {
      await c.addAll(CORE);
      try {
        const idx = await (await fetch("exams/index.json")).json();
        await c.addAll(idx.map(x => "exams/" + x.file));
        const pi = await (await fetch("pools/index.json")).json();
        await c.addAll(["pools/index.json"].concat(pi.map(x => "pools/" + x.file)));
      } catch {}
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  // 只快取 GET 的成功回應。2026-08-14 修：原本不看狀態碼一律 put，
  // 部署空窗期拿到的 404 會被當成正常回應存起來，之後網路一不順就再拿出來，
  // 等於把一次暫時性失敗變成永久的壞連結（notes.html 上線當天即發生）。
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then(res => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(e.request))
        || new Response("離線且無快取", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }))
  );
});
