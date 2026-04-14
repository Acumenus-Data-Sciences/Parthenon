(() => {
  "use strict";

  function markCopied(btn) {
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = "Copy"; }, 2000);
  }

  function fallbackCopy(text, btn) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    markCopied(btn);
  }

  function copyToClipboard(text, btn) {
    if (!navigator.clipboard) {
      fallbackCopy(text, btn);
      return;
    }

    navigator.clipboard.writeText(text)
      .then(() => { markCopied(btn); })
      .catch(() => { fallbackCopy(text, btn); });
  }

  function init() {
    document.querySelectorAll(".copy-btn[data-copy]").forEach((btn) => {
      btn.addEventListener("click", () => {
        copyToClipboard(btn.dataset.copy, btn);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
