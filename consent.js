/*!
 * Angezha - Cookie / Consent Mode banner
 * يدير موافقة الزائر على الكوكيز وربطها بـ Google Consent Mode
 */
(function () {
  var STORAGE_KEY = "angezha_consent";

  function gtagUpdate(status) {
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag("consent", "update", {
      ad_storage: status,
      ad_user_data: status,
      ad_personalization: status,
      analytics_storage: status,
    });
  }

  function saveChoice(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {}
  }

  function getChoice() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function removeBanner(banner) {
    if (banner && banner.parentNode) {
      banner.parentNode.removeChild(banner);
    }
  }

  function buildBanner() {
    var wrap = document.createElement("div");
    wrap.setAttribute("id", "angezha-consent-banner");
    wrap.setAttribute("dir", "rtl");
    wrap.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:99999;" +
      "background:#111827;color:#f3f4f6;padding:16px 20px;" +
      "box-shadow:0 -2px 12px rgba(0,0,0,0.25);" +
      "font-family:inherit;font-size:14px;line-height:1.7;" +
      "display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;";

    var text = document.createElement("div");
    text.style.cssText = "flex:1 1 260px;min-width:200px;";
    text.innerHTML =
      'نستخدم ملفات تعريف الارتباط (الكوكيز) لتحسين تجربتك وقياس الزيارات وعرض إعلانات مناسبة. ' +
      'يمكنك قبول ذلك أو رفضه. لمزيد من التفاصيل راجع ' +
      '<a href="/Angezha/privacy.html" style="color:#93c5fd;text-decoration:underline;">سياسة الخصوصية</a>.';

    var actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:10px;flex-shrink:0;";

    var rejectBtn = document.createElement("button");
    rejectBtn.type = "button";
    rejectBtn.textContent = "رفض";
    rejectBtn.style.cssText =
      "cursor:pointer;padding:9px 18px;border-radius:8px;border:1px solid #4b5563;" +
      "background:transparent;color:#e5e7eb;font-size:14px;";

    var acceptBtn = document.createElement("button");
    acceptBtn.type = "button";
    acceptBtn.textContent = "قبول الكل";
    acceptBtn.style.cssText =
      "cursor:pointer;padding:9px 18px;border-radius:8px;border:none;" +
      "background:#2563eb;color:#fff;font-size:14px;font-weight:600;";

    acceptBtn.addEventListener("click", function () {
      gtagUpdate("granted");
      saveChoice("accepted");
      removeBanner(wrap);
    });

    rejectBtn.addEventListener("click", function () {
      gtagUpdate("denied");
      saveChoice("rejected");
      removeBanner(wrap);
    });

    actions.appendChild(rejectBtn);
    actions.appendChild(acceptBtn);
    wrap.appendChild(text);
    wrap.appendChild(actions);
    return wrap;
  }

  function init() {
    var choice = getChoice();
    if (choice === "accepted") {
      gtagUpdate("granted");
      return;
    }
    if (choice === "rejected") {
      // يبقى مرفوض (الوضع الافتراضي أصلاً)، مفيش داعي نعمل حاجة
      return;
    }
    // لسه محددش اختيار: اعرض البانر
    var banner = buildBanner();
    document.body.appendChild(banner);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
