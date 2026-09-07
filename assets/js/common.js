/* =========================================================
   Angezha | أنجزها — Common JS
   Shared across all pages: language toggle, mobile menu,
   generic helpers, tool search (home page only)
   ========================================================= */

(function () {
  "use strict";

  /* ---------- Language toggle ---------- */
  function applyLanguage(lang) {
    var root = document.getElementById("htmlRoot");
    if (!root) return;
    root.setAttribute("lang", lang);
    root.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    document.querySelectorAll("[data-ar][data-en]").forEach(function (el) {
      var val = lang === "ar" ? el.getAttribute("data-ar") : el.getAttribute("data-en");
      // Use textContent unless the element explicitly opts into HTML via data-html
      if (el.hasAttribute("data-html")) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    });
    document.querySelectorAll("[data-ar-placeholder][data-en-placeholder]").forEach(function (el) {
      el.setAttribute(
        "placeholder",
        lang === "ar" ? el.getAttribute("data-ar-placeholder") : el.getAttribute("data-en-placeholder")
      );
    });
    document.querySelectorAll("[data-ar-aria][data-en-aria]").forEach(function (el) {
      el.setAttribute(
        "aria-label",
        lang === "ar" ? el.getAttribute("data-ar-aria") : el.getAttribute("data-en-aria")
      );
    });
    try {
      localStorage.setItem("angezha-lang", lang);
    } catch (e) {
      /* localStorage may be unavailable (private mode) — safe to ignore */
    }
    window.dispatchEvent(new CustomEvent("angezha:langchange", { detail: { lang: lang } }));
  }

  function toggleLanguage() {
    var root = document.getElementById("htmlRoot");
    var current = root ? root.getAttribute("lang") : "ar";
    applyLanguage(current === "ar" ? "en" : "ar");
  }

  function initLanguage() {
    var saved = null;
    try {
      saved = localStorage.getItem("angezha-lang");
    } catch (e) {}
    if (saved === "ar" || saved === "en") {
      applyLanguage(saved);
    }
    var btn = document.getElementById("langToggle");
    if (btn) btn.addEventListener("click", toggleLanguage);
  }

  /* ---------- Mobile menu ---------- */
  function initMobileMenu() {
    var toggle = document.getElementById("menuToggle");
    var links = document.getElementById("navLinks");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      var isOpen = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Generic helpers (used by tool pages) ---------- */
  window.AngezhaCommon = {
    isArabic: function () {
      var root = document.getElementById("htmlRoot");
      return !root || root.getAttribute("lang") === "ar";
    },
    downloadBlob: function (blob, filename) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);
    },
    formatSize: function (bytes) {
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    },
    setStatus: function (el, text, kind) {
      if (!el) return;
      el.textContent = text;
      el.className = "status" + (kind ? " " + kind : "");
      el.setAttribute("role", kind === "err" ? "alert" : "status");
    },
    setProgress: function (wrapEl, barEl, percent) {
      if (!wrapEl || !barEl) return;
      if (percent === null) {
        wrapEl.style.display = "none";
        return;
      }
      wrapEl.style.display = "block";
      barEl.style.width = percent + "%";
      wrapEl.setAttribute("aria-valuenow", String(percent));
    },
    renderFileList: function (listEl, files) {
      if (!listEl) return;
      listEl.innerHTML = "";
      Array.prototype.forEach.call(files, function (f) {
        var li = document.createElement("li");
        var name = document.createElement("span");
        name.textContent = f.name;
        var sz = document.createElement("span");
        sz.className = "sz";
        sz.textContent = window.AngezhaCommon.formatSize(f.size);
        li.appendChild(name);
        li.appendChild(sz);
        listEl.appendChild(li);
      });
    },
    isPdfFile: function (file) {
      return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    },
    isImageFile: function (file, exts) {
      var name = file.name.toLowerCase();
      return exts.some(function (ext) {
        return name.endsWith(ext);
      });
    }
  };

  /* ---------- Tool search (home page) ---------- */
  function initToolSearch() {
    var input = document.getElementById("toolSearch");
    if (!input) return;
    var cards = Array.prototype.slice.call(document.querySelectorAll(".tool-card"));
    var emptyState = document.getElementById("toolSearchEmpty");
    var sections = Array.prototype.slice.call(document.querySelectorAll("[data-tool-section]"));

    function normalize(str) {
      return (str || "").toLowerCase().trim();
    }

    function runFilter() {
      var q = normalize(input.value);
      var anyVisible = false;

      cards.forEach(function (card) {
        var ar = normalize(card.getAttribute("data-search-ar"));
        var en = normalize(card.getAttribute("data-search-en"));
        var match = !q || ar.indexOf(q) !== -1 || en.indexOf(q) !== -1;
        card.style.display = match ? "" : "none";
        if (match) anyVisible = true;
      });

      // Hide whole sections if no card within them matches
      sections.forEach(function (section) {
        var visibleCards = section.querySelectorAll(".tool-card:not([style*='display: none'])");
        var header = document.getElementById(section.getAttribute("data-tool-section"));
        var show = !q || visibleCards.length > 0;
        section.style.display = show ? "" : "none";
        if (header) header.style.display = show ? "" : "none";
      });

      if (emptyState) emptyState.style.display = q && !anyVisible ? "block" : "none";
    }

    input.addEventListener("input", runFilter);
  }

  /* ---------- Library load check (shows a banner if a CDN script failed) ---------- */
  window.AngezhaCommon.checkLibraries = function (required) {
    var missing = [];
    required.forEach(function (lib) {
      if (!window[lib]) missing.push(lib);
    });
    var warningBox = document.getElementById("libWarning");
    if (missing.length) {
      if (warningBox) warningBox.style.display = "block";
      document.querySelectorAll("button.action[data-requires-lib]").forEach(function (btn) {
        btn.disabled = true;
      });
      console.error("Angezha: failed to load libraries:", missing.join(", "));
      return false;
    }
    return true;
  };

  document.addEventListener("DOMContentLoaded", function () {
    initLanguage();
    initMobileMenu();
    initToolSearch();
  });
})();
