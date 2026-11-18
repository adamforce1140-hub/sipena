// Uji perbandingan: GET biasa vs stream dengan cookie sama.
import { CookieJar } from "tough-cookie";
const base = "http://localhost:3000";

const csrfRes = await fetch(`${base}/api/auth/csrf`);
const csrf = await csrfRes.json();
const jar = new CookieJar();
for (const c of csrfRes.headers.getSetCookie()) await jar.setCookie(c, base);
const login = await fetch(`${base}/api/auth/callback/credentials`, {
  method: "POST",
  redirect: "manual",
  headers: { cookie: await jar.getCookieString(base) },
  body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: "staff@npf.local", password: "password123", json: "true" }),
});
for (const c of login.headers.getSetCookie()) await jar.setCookie(c, base);
const cookie = await jar.getCookieString(base);
console.log("login:", login.status, "lokasi:", login.headers.get("location")?.slice(0, 60));

const plain = await fetch(`${base}/api/notifications`, { headers: { cookie } });
console.log("GET /api/notifications:", plain.status, (await plain.text()).slice(0, 80));

const stream = await fetch(`${base}/api/notifications/stream`, { headers: { cookie } });
console.log("GET /api/notifications/stream:", stream.status, stream.headers.get("content-type"));
const reader = stream.body.getReader();
const decoder = new TextDecoder();
let seen = "";
setTimeout(() => { console.log("--- 6s stream ---"); console.log(seen || "(kosong)"); process.exit(0); }, 6000);
try {
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    seen += decoder.decode(value, { stream: true });
    console.log("chunk:", decoder.decode(value));
  }
} catch (e) { console.log("baca berakhir:", String(e).slice(0, 120)); }
