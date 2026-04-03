(() => {
  "use strict";

  const REPO = "sudoshi/Parthenon";
  const CURL_CMD = "curl -fsSL https://parthenon.acumenus.net/install.sh | sh";

  const BINARIES = {
    "linux": "acropolis-install-linux.tar.gz",
    "macos": "acropolis-install-macos.zip",
    "windows": "acropolis-install-win.exe",
  };

  function detectPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("win")) return "windows";
    if (ua.includes("mac")) return "macos";
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

  const POST_INSTRUCTIONS = {
    linux: 'Extract the archive and double-click <strong>acropolis-install</strong>, or run it from Terminal.',
    macos: 'Unzip the download and double-click <strong>"Install Parthenon"</strong>. It opens Terminal and runs the installer automatically.',
    windows: 'Double-click <strong>acropolis-install-win.exe</strong>. It will detect WSL and launch the installer inside your Linux environment.',
  };

  function setupCopyButton(btnId, textFn) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const text = typeof textFn === "function" ? textFn() : textFn;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy"; }, 2000);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
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

  function setPostDownload(platform) {
    const el = document.getElementById("post-instructions");
    if (el) el.innerHTML = POST_INSTRUCTIONS[platform] || POST_INSTRUCTIONS.linux;
  }

  async function init() {
    const platform = detectPlatform();
    const tag = await fetchLatestRelease();
    setDownloadLinks(tag);
    highlightPlatform(platform);
    setPostDownload(platform);
    setupCopyButton("copy-btn", CURL_CMD);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
