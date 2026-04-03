(() => {
  "use strict";

  const REPO = "sudoshi/Parthenon";
  const CURL_CMD = "curl -fsSL https://parthenon.acumenus.net/install.sh | sh";

  function detectPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) return "Windows (WSL)";
    if (ua.includes("mac")) return "macOS";
    return "Linux";
  }

  function setButtonLabel(platform, tag) {
    const btn = document.getElementById("download-btn");
    if (!btn) return;
    const label = `Download for ${platform}`;
    const tagSpan = tag ? `<span class="release-tag">${tag}</span>` : "";
    btn.innerHTML = label + tagSpan;
  }

  function setDownloadUrl(tag) {
    const btn = document.getElementById("download-btn");
    if (!btn) return;
    // Primary download always points to the install script / cosmo binary
    btn.href = tag
      ? `https://github.com/${REPO}/releases/download/${tag}/acropolis-install.com`
      : `https://github.com/${REPO}/releases/latest`;
  }

  function setFallbackLinks(tag) {
    const container = document.getElementById("fallback-links");
    if (!container || !tag) return;
    const base = `https://github.com/${REPO}/releases/download/${tag}`;
    container.innerHTML =
      `<a href="${base}/acropolis-install-linux-x64">Linux</a> · ` +
      `<a href="${base}/acropolis-install-macos-arm64">macOS</a> · ` +
      `<a href="${base}/acropolis-install-linux-x64">Windows (WSL)</a>`;
  }

  async function fetchLatestRelease() {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.tag_name || null;
    } catch {
      return null;
    }
  }

  function initCopyButton() {
    const btn = document.getElementById("copy-btn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(CURL_CMD);
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy"; }, 2000);
      } catch {
        // Fallback for non-HTTPS contexts
        const ta = document.createElement("textarea");
        ta.value = CURL_CMD;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy"; }, 2000);
      }
    });
  }

  async function init() {
    const platform = detectPlatform();
    const tag = await fetchLatestRelease();
    setButtonLabel(platform, tag);
    setDownloadUrl(tag);
    setFallbackLinks(tag);
    initCopyButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
