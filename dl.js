// Download page: a paid app downloads only with a valid download code (see tools/codes.mjs).
// The code makes a lookup id and an unlock key (PBKDF2); keys.json holds the app key locked with it.
(() => {
  const root = document.querySelector("[data-dl]"); if (!root) return;
  const ping = () => { try { fetch(root.dataset.counter, { mode: "no-cors", cache: "no-store" }).catch(() => {}); } catch (e) {} };   // download count
  const free = document.getElementById("freeDl"); if (free) free.addEventListener("click", ping);
  const form = document.getElementById("codeForm"); if (!form) return;
  const input = document.getElementById("code"), msg = document.getElementById("codeMsg"), btn = document.getElementById("codeBtn");
  const enc = s => new TextEncoder().encode(s), hex = b => Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const norm = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const show = n => n.length > 5 ? n.slice(0, 5) + "-" + n.slice(5, 10) : n;
  const say = (t, cls) => { msg.textContent = t; msg.className = "note " + (cls || ""); };
  const fromLink = new URLSearchParams(location.hash.slice(1)).get("code");
  if (fromLink) { input.value = show(norm(fromLink)); say("Your code is filled in. Tap Download."); }
  input.addEventListener("input", () => { const p = show(norm(input.value).slice(0, 10)); if (p !== input.value) input.value = p; });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const code = norm(input.value);
    if (code.length !== 10) return say("Enter the 10-character download code you received after paying.", "err");
    if (!window.crypto || !crypto.subtle) return say("This browser can't unlock the download. Open this page in Chrome.", "err");
    btn.disabled = true;
    try {
      say("Checking your code…");
      const keys = await (await fetch("keys.json?t=" + Date.now(), { cache: "no-store" })).json();
      const base = await crypto.subtle.importKey("raw", enc(code), "PBKDF2", false, ["deriveBits"]);
      const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc("reilab:" + root.dataset.app), iterations: keys.iter }, base, 384));
      const locked = keys.entries[hex(bits.slice(0, 16))];
      if (!locked) { say("That code isn't valid. Check it and try again, or text us your GCash Ref No.", "err"); return; }
      const unlock = await crypto.subtle.importKey("raw", bits.slice(16, 48), "AES-GCM", false, ["decrypt"]);
      const lb = b64(locked), raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: lb.slice(0, 12) }, unlock, lb.slice(12));
      const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
      say("Downloading…");
      const r = await fetch(keys.file); if (!r.ok) throw new Error("download failed (" + r.status + ")");
      const bin = new Uint8Array(await r.arrayBuffer());
      const apk = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bin.slice(0, 12) }, key, bin.slice(12));
      const url = URL.createObjectURL(new Blob([apk], { type: "application/vnd.android.package-archive" }));
      const a = document.createElement("a"); a.href = url; a.download = keys.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 120000);
      ping();
      say("Downloaded " + keys.name + ". Open it from your notifications or the Downloads folder to install.", "ok");
    } catch (err) { say("Something went wrong (" + err.message + "). Try again, or open this page in Chrome.", "err"); }
    finally { btn.disabled = false; }
  });
})();
