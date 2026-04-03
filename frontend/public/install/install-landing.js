(() => {
  "use strict";

  const REPO = "sudoshi/Parthenon";
  const CURL_CMD = "curl -fsSL https://parthenon.acumenus.net/install.sh | sh";

  const BINARIES = {
    "linux": "acropolis-install-linux",
    "macos-arm64": "acropolis-install-macos-arm64",
    "macos-x64": "acropolis-install-macos-x64",
    "windows": "acropolis-install-win.exe",
  };

  function detectPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) return "windows";
    if (ua.includes("mac")) {
      // Detect Apple Silicon via GL renderer or platform
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl");
        const renderer = gl ? gl.getParameter(gl.RENDERER) : "";
        if (renderer.toLowerCase().includes("apple")) return "macos-arm64";
      } catch {}
      return "macos-arm64"; // Default to arm64 for modern Macs
    }
    return "linux";
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

  function setDownloadLinks(tag) {
    const fallback = `https://github.com/${REPO}/releases/latest`;
    for (const [platform, binary] of Object.entries(BINARIES)) {
      const btn = document.getElementById(`dl-${platform}`);
      if (btn) {
        btn.href = tag
          ? `https://github.com/${REPO}/releases/download/${tag}/${binary}`
          : fallback;
      }
    }
  }

  function highlightPlatform(platform) {
    for (const key of Object.keys(BINARIES)) {
      const btn = document.getElementById(`dl-${key}`);
      if (btn) {
        btn.classList.toggle("active", key === platform);
      }
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
    setDownloadLinks(tag);
    highlightPlatform(platform);
    initCopyButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
