(() => {
  "use strict";

  const REPO = "sudoshi/Parthenon";
  const CURL_CMD = "curl -fsSL https://parthenon.acumenus.net/install.sh | sh";

  const BINARIES = {
    "linux": "acropolis-install-linux",
    "macos": "acropolis-install.com",
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

  const RUN_CMDS = {
    linux: "cd ~/Downloads && chmod +x acropolis-install-linux && ./acropolis-install-linux",
    macos: "cd ~/Downloads && chmod +x acropolis-install.com && ./acropolis-install.com",
    windows: "wsl -- bash -c 'chmod +x /mnt/c/Users/$USER/Downloads/acropolis-install-win.exe && /mnt/c/Users/$USER/Downloads/acropolis-install-win.exe'",
  };

  const POST_NOTES = {
    linux: "",
    macos: 'macOS may show a security warning. If blocked, run: <code class="inline-code">xattr -d com.apple.quarantine ~/Downloads/acropolis-install.com</code>',
    windows: "Open a WSL terminal first. The installer runs inside your WSL Linux environment.",
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
    const runCmd = document.getElementById("run-cmd");
    const postNote = document.getElementById("post-note");
    if (runCmd) runCmd.textContent = RUN_CMDS[platform] || RUN_CMDS.linux;
    if (postNote) postNote.innerHTML = POST_NOTES[platform] || "";
  }

  async function init() {
    const platform = detectPlatform();
    const tag = await fetchLatestRelease();
    setDownloadLinks(tag);
    highlightPlatform(platform);
    setPostDownload(platform);
    setupCopyButton("copy-btn", CURL_CMD);
    setupCopyButton("copy-run-btn", () => document.getElementById("run-cmd")?.textContent || "");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
