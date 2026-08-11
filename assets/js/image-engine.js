/* =========================================================
   Angezha | أنجزها — Image Engine
   All image tool logic, powered by the browser's Canvas API only
   (no external libraries needed)
   ========================================================= */

function arImg() {
  return window.AngezhaCommon.isArabic();
}

function loadImageFromFile(file) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("load-error"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise(function (resolve) {
    canvas.toBlob(resolve, mime, quality);
  });
}

function baseName(filename) {
  var idx = filename.lastIndexOf(".");
  return idx === -1 ? filename : filename.substring(0, idx);
}

/* ========= ضغط الصور (Compress) ========= */
async function compressImage() {
  var input = document.getElementById("compressImgFile");
  var status = document.getElementById("compressImgStatus");
  var button = document.getElementById("compressImgBtn");
  var qualitySlider = document.getElementById("compressImgQuality");
  var C = window.AngezhaCommon;
  var isAr = arImg();

  if (!input.files.length) {
    C.setStatus(status, isAr ? "⚠️ اختر صورة أولًا." : "⚠️ Choose an image first.", "warn");
    return;
  }
  var file = input.files[0];
  if (!C.isImageFile(file, [".jpg", ".jpeg", ".png", ".webp"])) {
    C.setStatus(status, isAr ? "⚠️ الملف المختار مش صورة مدعومة." : "⚠️ The selected file is not a supported image.", "warn");
    return;
  }

  var quality = qualitySlider ? parseInt(qualitySlider.value, 10) / 100 : 0.7;
  button.disabled = true;

  try {
    C.setStatus(status, isAr ? "⏳ جاري ضغط الصورة..." : "⏳ Compressing image...", null);
    var img = await loadImageFromFile(file);
    var canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    var isPng = file.name.toLowerCase().endsWith(".png");
    var mime = isPng ? "image/png" : "image/jpeg";
    var blob = await canvasToBlob(canvas, mime, isPng ? undefined : quality);

    var before = C.formatSize(file.size);
    var after = C.formatSize(blob.size);
    var ext = isPng ? "png" : "jpg";
    C.downloadBlob(blob, "angezha-compressed-" + baseName(file.name) + "." + ext);
    C.setStatus(status, isAr
      ? "✅ تم ضغط الصورة (" + before + " ← " + after + ") وتحميلها."
      : "✅ Compressed (" + before + " → " + after + ") and downloaded.", "ok");
  } catch (error) {
    console.error(error);
    C.setStatus(status, isAr ? "❌ حصلت مشكلة أثناء ضغط الصورة." : "❌ Something went wrong while compressing.", "err");
  } finally {
    button.disabled = false;
  }
}

/* ========= تغيير الحجم (Resize) ========= */
async function resizeImage() {
  var input = document.getElementById("resizeImgFile");
  var status = document.getElementById("resizeImgStatus");
  var button = document.getElementById("resizeImgBtn");
  var widthInput = document.getElementById("resizeWidth");
  var heightInput = document.getElementById("resizeHeight");
  var keepRatio = document.getElementById("resizeKeepRatio");
  var C = window.AngezhaCommon;
  var isAr = arImg();

  if (!input.files.length) {
    C.setStatus(status, isAr ? "⚠️ اختر صورة أولًا." : "⚠️ Choose an image first.", "warn");
    return;
  }
  var file = input.files[0];
  if (!C.isImageFile(file, [".jpg", ".jpeg", ".png", ".webp"])) {
    C.setStatus(status, isAr ? "⚠️ الملف المختار مش صورة مدعومة." : "⚠️ The selected file is not a supported image.", "warn");
    return;
  }

  var targetW = parseInt(widthInput.value, 10);
  var targetH = parseInt(heightInput.value, 10);
  if (!targetW && !targetH) {
    C.setStatus(status, isAr ? "⚠️ أدخل العرض أو الارتفاع المطلوب." : "⚠️ Enter a target width or height.", "warn");
    return;
  }

  button.disabled = true;

  try {
    C.setStatus(status, isAr ? "⏳ جاري تغيير الحجم..." : "⏳ Resizing...", null);
    var img = await loadImageFromFile(file);
    var ratio = img.naturalWidth / img.naturalHeight;
    var finalW = targetW;
    var finalH = targetH;

    if (keepRatio && keepRatio.checked) {
      if (targetW && !targetH) finalH = Math.round(targetW / ratio);
      else if (targetH && !targetW) finalW = Math.round(targetH * ratio);
      else if (targetW && targetH) finalH = Math.round(targetW / ratio); // width takes priority
    } else {
      finalW = targetW || img.naturalWidth;
      finalH = targetH || img.naturalHeight;
    }

    var canvas = document.createElement("canvas");
    canvas.width = finalW;
    canvas.height = finalH;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, finalW, finalH);

    var isPng = file.name.toLowerCase().endsWith(".png");
    var mime = isPng ? "image/png" : "image/jpeg";
    var blob = await canvasToBlob(canvas, mime, isPng ? undefined : 0.92);
    var ext = isPng ? "png" : "jpg";

    C.downloadBlob(blob, "angezha-resized-" + baseName(file.name) + "." + ext);
    C.setStatus(status, isAr
      ? "✅ تم تغيير الحجم إلى " + finalW + "×" + finalH + " وتحميل الصورة."
      : "✅ Resized to " + finalW + "×" + finalH + " and downloaded.", "ok");
  } catch (error) {
    console.error(error);
    C.setStatus(status, isAr ? "❌ حصلت مشكلة أثناء تغيير الحجم." : "❌ Something went wrong while resizing.", "err");
  } finally {
    button.disabled = false;
  }
}

/* ========= تحويل الصيغ (Format conversion) ========= */
async function convertImageFormat(inputId, statusId, buttonId, targetMime, targetExt) {
  var input = document.getElementById(inputId);
  var status = document.getElementById(statusId);
  var button = document.getElementById(buttonId);
  var C = window.AngezhaCommon;
  var isAr = arImg();

  if (!input.files.length) {
    C.setStatus(status, isAr ? "⚠️ اختر صورة أولًا." : "⚠️ Choose an image first.", "warn");
    return;
  }
  var file = input.files[0];

  button.disabled = true;

  try {
    C.setStatus(status, isAr ? "⏳ جاري التحويل..." : "⏳ Converting...", null);
    var img = await loadImageFromFile(file);
    var canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    var ctx = canvas.getContext("2d");

    // Fill white background for formats without transparency (e.g. converting to JPG)
    if (targetMime === "image/jpeg") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0);

    var blob = await canvasToBlob(canvas, targetMime, targetMime === "image/png" ? undefined : 0.92);
    if (!blob) throw new Error("convert-error");

    C.downloadBlob(blob, "angezha-" + baseName(file.name) + "." + targetExt);
    C.setStatus(status, isAr ? "✅ تم التحويل وتحميل الصورة." : "✅ Converted and downloaded.", "ok");
  } catch (error) {
    console.error(error);
    C.setStatus(status, isAr
      ? "❌ حصلت مشكلة أثناء التحويل. ملحوظة: بعض المتصفحات القديمة لا تدعم WebP بالكامل."
      : "❌ Something went wrong while converting. Note: some older browsers have limited WebP support.", "err");
  } finally {
    button.disabled = false;
  }
}

/* ---------- Wire up file input change listeners generically on tool pages ---------- */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("input[type=file][data-filelist]").forEach(function (input) {
    var listEl = document.getElementById(input.getAttribute("data-filelist"));
    if (!listEl) return;
    input.addEventListener("change", function () {
      window.AngezhaCommon.renderFileList(listEl, this.files);
    });
  });

  // Live preview for image tools showing current dimensions
  document.querySelectorAll("input[type=file][data-dim-preview]").forEach(function (input) {
    var targetEl = document.getElementById(input.getAttribute("data-dim-preview"));
    if (!targetEl) return;
    input.addEventListener("change", function () {
      if (!this.files.length) { targetEl.textContent = ""; return; }
      loadImageFromFile(this.files[0]).then(function (img) {
        var isAr = arImg();
        targetEl.textContent = (isAr ? "الأبعاد الحالية: " : "Current size: ") + img.naturalWidth + "×" + img.naturalHeight;
      }).catch(function () {});
    });
  });
});
