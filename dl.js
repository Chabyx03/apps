// Download page. A paid app downloads only for a GCash Ref No. that the seller has confirmed in the dashboard:
// the Ref No. makes a lookup id and an unlock key (PBKDF2); keys.json lists the app key locked with the key
// of every confirmed Ref No. Until it's confirmed the page keeps checking and downloads by itself when it is.
(() => {
  const root = document.querySelector("[data-dl]"); if (!root) return;
  const ping = () => { try { fetch(root.dataset.counter, { mode: "no-cors", cache: "no-store" }).catch(() => {}); } catch (e) {} };   // download count
  const free = document.getElementById("freeDl"); if (free) free.addEventListener("click", ping);
  const form = document.getElementById("codeForm"); if (!form) return;
  const input = document.getElementById("code"), msg = document.getElementById("codeMsg"), btn = document.getElementById("codeBtn");
  const app = root.dataset.app, SAVE = "reilab-ref-" + app, CHECK_EVERY = 20000, GIVE_UP = 45 * 60000;
  const enc = s => new TextEncoder().encode(s), hex = b => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const digits = c => String(c || "").replace(/\D/g, "");
  const say = (t, cls) => { msg.textContent = t; msg.className = "note " + (cls || ""); };
  const store = { get: () => { try { return JSON.parse(localStorage.getItem(SAVE) || "null"); } catch (e) { return null; } },
    set: v => { try { v ? localStorage.setItem(SAVE, JSON.stringify(v)) : localStorage.removeItem(SAVE); } catch (e) {} } };
  let timer = null, bits = null, bitsFor = "", apkUrl = null, apkName = "";

  async function derive(ref) {
    if (bitsFor === ref) return bits;
    const base = await crypto.subtle.importKey("raw", enc(ref), "PBKDF2", false, ["deriveBits"]);
    bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc("reilab:" + app), iterations: 200000 }, base, 384));
    bitsFor = ref; return bits;
  }
  function save() { const a = document.createElement("a"); a.href = apkUrl; a.download = apkName; document.body.appendChild(a); a.click(); a.remove(); }
  async function unlock(keys, b, locked) {
    const unlockKey = await crypto.subtle.importKey("raw", b.slice(16, 48), "AES-GCM", false, ["decrypt"]);
    const lb = b64(locked), raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: lb.slice(0, 12) }, unlockKey, lb.slice(12));
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    say("Payment confirmed. Downloading…", "ok");
    const r = await fetch(keys.file); if (!r.ok) throw new Error("download failed (" + r.status + ")");
    const bin = new Uint8Array(await r.arrayBuffer());
    const apk = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bin.slice(0, 12) }, key, bin.slice(12));
    apkUrl = URL.createObjectURL(new Blob([apk], { type: "application/vnd.android.package-archive" })); apkName = keys.name;
    save(); ping(); store.set(null);
    say("Payment confirmed. " + keys.name + " is downloaded: open it from your notifications or Downloads to install. Not downloading? Tap the button again.", "ok");
    btn.textContent = "Download again"; btn.disabled = false; btn.onclick = e => { e.preventDefault(); save(); };
  }
  async function check(saved) {
    clearTimeout(timer);
    try {
      const keys = await (await fetch("keys.json?t=" + Date.now(), { cache: "no-store" })).json();
      const b = await derive(saved.ref), locked = keys.entries[hex(b.slice(0, 16))];
      if (locked) return await unlock(keys, b, locked);
      if (Date.now() - saved.since > GIVE_UP) {
        store.set(null); btn.disabled = false;
        return say(`Your payment hasn't been confirmed yet. Check the Ref No. (${saved.ref}) and that you sent the right amount${form.dataset.contact ? ", or text " + form.dataset.contact : ""}. Then tap Download to check again.`, "err");
      }
      say(`Waiting for your payment (Ref No. ${saved.ref}) to be confirmed. This usually takes a few minutes; keep this page open and the download starts by itself.`);
    } catch (err) { say("Can't check right now (" + err.message + "). Trying again…", "err"); }
    timer = setTimeout(() => check(saved), CHECK_EVERY);
  }
  form.addEventListener("submit", e => {
    e.preventDefault(); if (apkUrl) return save();
    const ref = digits(input.value);
    if (ref.length < 10 || ref.length > 16) return say("Enter the Ref No. from your GCash receipt (13 digits).", "err");
    if (!window.crypto || !crypto.subtle) return say("This browser can't do the download. Open this page in Chrome.", "err");
    const saved = { ref, since: Date.now() }; store.set(saved); btn.disabled = true; say("Checking your payment…"); check(saved);
  });
  const resume = store.get();   // came back to the page while waiting
  if (resume && resume.ref) { input.value = resume.ref; btn.disabled = true; say("Checking your payment…"); check(resume); }
})();
