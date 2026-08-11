/* =========================================================
   Angezha | أنجزها — PDF Engine
   All PDF tool logic, powered by pdf-lib + pdf.js (client-side only)
   ========================================================= */

var MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function checkPdfLibraries(extra) {
  var required = ["PDFLib", "pdfjsLib"].concat(extra || []);
  var ok = window.AngezhaCommon.checkLibraries(required);
  if (window.pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  return ok;
}

function ar() {
  return window.AngezhaCommon.isArabic();
}

function friendlyPdfError(error, fallbackAr, fallbackEn) {
  console.error(error);
  var isKnown =
    error && error.message && (error.message.indexOf("تعذّر") === 0 || error.message.indexOf("Couldn't") === 0);
  return isKnown ? error.message : ar() ? fallbackAr : fallbackEn;
}

async function loadPdfLibDoc(file) {
  var bytes = await file.arrayBuffer();
  try {
    return await PDFLib.PDFDocument.load(bytes);
  } catch (e) {
    throw new Error(
      ar()
        ? 'تعذّر فتح الملف "' + file.name + '". تأكد أنه PDF سليم وغير محمي بكلمة مرور.'
        : 'Couldn\'t open "' + file.name + '". Make sure it\'s a valid, non-password-protected PDF.'
    );
  }
}

async function loadPdfJsDoc(file) {
  var arrayBuffer = await file.arrayBuffer();
  try {
    return await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (e) {
    throw new Error(
      ar()
        ? "تعذّر فتح الملف. تأكد أنه PDF سليم وغير محمي بكلمة مرور."
        : "Couldn't open the file. Make sure it's a valid, non-password-protected PDF."
    );
  }
}

/* ========= 1. دمج PDF (Merge) ========= */
async function mergePDFs() {
  if (!checkPdfLibraries()) return;
  var input = document.getElementById("mergeFiles");
  var status = document.getElementById("mergeStatus");
  var button = document.getElementById("mergeBtn");
  var wrap = document.getElementById("mergeProgressWrap");
  var bar = document.getElementById("mergeProgressBar");
  var C = window.AngezhaCommon;
  var isAr = ar();

  if (!input.files.length) {
    C.setStatus(status, isAr ? "⚠️ اختر ملفين PDF أو أكثر أولًا." : "⚠️ Choose two or more PDF files first.", "warn");
    return;
  }
  if (input.files.length < 2) {
    C.setStatus(status, isAr ? "⚠️ اختر ملفين PDF على الأقل للدمج." : "⚠️ Choose at least two PDF files to merge.", "warn");
    return;
  }
  var invalidFile = Array.from(input.files).find(function (f) { return !C.isPdfFile(f); });
  if (invalidFile) {
    C.setStatus(status, isAr ? '⚠️ الملف "' + invalidFile.name + '" مش PDF صالح.' : '⚠️ "' + invalidFile.name + '" is not a valid PDF.', "warn");
    return;
  }
  var tooBig = Array.from(input.files).find(function (f) { return f.size > MAX_FILE_SIZE; });
  if (tooBig) {
    C.setStatus(status, isAr ? '⚠️ الملف "' + tooBig.name + '" أكبر من 50 ميجابايت.' : '⚠️ "' + tooBig.name + '" exceeds 50MB.', "warn");
    return;
  }

  button.disabled = true;
  C.setProgress(wrap, bar, 0);

  try {
    C.setStatus(status, isAr ? "⏳ جاري دمج الملفات..." : "⏳ Merging files...", null);
    var mergedPdf = await PDFLib.PDFDocument.create();
    var total = input.files.length;
    var done = 0;

    for (var file of input.files) {
      var pdf = await loadPdfLibDoc(file);
      var pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(function (page) { mergedPdf.addPage(page); });
      done++;
      C.setProgress(wrap, bar, Math.round((done / total) * 100));
      C.setStatus(status, isAr ? "⏳ جاري دمج الملفات... (" + done + " من " + total + ")" : "⏳ Merging files... (" + done + " of " + total + ")", null);
    }

    var result = await mergedPdf.save();
    var blob = new Blob([result], { type: "application/pdf" });
    C.downloadBlob(blob, "angezha-merged.pdf");
    C.setProgress(wrap, bar, null);
    C.setStatus(status, isAr ? "✅ تم دمج الملفات وتحميل الملف." : "✅ Files merged and downloaded.", "ok");
    input.value = "";
    var listEl = document.getElementById("mergeFileList");
    if (listEl) listEl.innerHTML = "";
  } catch (error) {
    C.setProgress(wrap, bar, null);
    C.setStatus(status, "❌ " + friendlyPdfError(error, "حصلت مشكلة أثناء دمج الملفات. تأكد أن ملفات PDF سليمة.", "Something went wrong while merging. Make sure your PDFs are valid."), "err");
  } finally {
    button.disabled = false;
  }
}

/* ========= 2. تقسيم PDF (Split) — إخراج ملف ZIP-less: يفصل كل صفحة أو مدى صفحات ========= */
async function splitPDF() {
  if (!checkPdfLibraries()) return;
  var input = document.getElementById("splitFile");
  var status = document.getElementById("splitStatus");
  var button = document.getElementById("splitBtn");
  var wrap = document.getElementById("splitProgressWrap");
  var bar = document.getElementById("splitProgressBar");
  var rangeInput = document.getElementById("splitRange");
  var C = window.AngezhaCommon;
  var isAr = ar();

  if (!input.files.length) {
    C.setStatus(status, isAr ? "⚠️ اختر ملف PDF أولًا." : "⚠️ Choose a PDF file first.", "warn");
    return;
  }
  var file = input.files[0];
  if (!C.isPdfFile(file)) {
    C.setStatus(status, isAr ? "⚠️ الملف المختار مش PDF صالح." : "⚠️ The selected file is not a valid PDF.", "warn");
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    C.setStatus(status, isAr ? "⚠️ الملف أكبر من 50 ميجابايت." : "⚠️ File exceeds 50MB.", "warn");
    return;
  }

  button.disabled = true;
  C.setProgress(wrap, bar, 0);

  try {
    C.setStatus(status, isAr ? "⏳ جاري تحليل الملف..." : "⏳ Reading the file...", null);
    var srcDoc = await loadPdfLibDoc(file);
    var totalPages = srcDoc.getPageCount();

    var ranges = parsePageRanges(rangeInput.value, totalPages);
    if (!ranges.length) {
      C.setProgress(wrap, bar, null);
      C.setStatus(status, isAr
        ? "⚠️ حدد نطاق صفحات صالح، مثال: 1-3, 5, 7-9"
        : "⚠️ Enter a valid page range, e.g. 1-3, 5, 7-9", "warn");
      button.disabled = false;
      return;
    }

    var done = 0;
    for (var r of ranges) {
      var newDoc = await PDFLib.PDFDocument.create();
      var indices = [];
      for (var p = r.start; p <= r.end; p++) indices.push(p - 1);
      var copied = await newDoc.copyPages(srcDoc, indices);
      copied.forEach(function (pg) { newDoc.addPage(pg); });
      var bytes = await newDoc.save();
      var blob = new Blob([bytes], { type: "application/pdf" });
      var suffix = r.start === r.end ? "p" + r.start : "p" + r.start + "-" + r.end;
      C.downloadBlob(blob, "angezha-split-" + suffix + ".pdf");
      done++;
      C.setProgress(wrap, bar, Math.round((done / ranges.length) * 100));
      // Small delay so the browser doesn't block multiple simultaneous downloads
      await new Promise(function (res) { setTimeout(res, 350); });
    }

    C.setProgress(wrap, bar, null);
    C.setStatus(status, isAr
      ? "✅ تم تقسيم الملف إلى " + ranges.length + " ملف/ملفات وتحميلهم."
      : "✅ Split into " + ranges.length + " file(s) and downloaded.", "ok");
  } catch (error) {
    C.setProgress(wrap, bar, null);
    C.setStatus(status, "❌ " + friendlyPdfError(error, "حصلت مشكلة أثناء تقسيم الملف.", "Something went wrong while splitting the file."), "err");
  } finally {
    button.disabled = false;
  }
}

function parsePageRanges(input, totalPages) {
  if (!input || !input.trim()) {
    // Default: split every page into its own file
    var all = [];
    for (var i = 1; i <= totalPages; i++) all.push({ start: i, end: i });
    return all;
  }
  var parts = input.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  var ranges = [];
  for (var part of parts) {
    var m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      var start = parseInt(m[1], 10);
      var end = parseInt(m[2], 10);
      if (start < 1 || end > totalPages || start > end) return [];
      ranges.push({ start: start, end: end });
    } else if (/^\d+$/.test(part)) {
      var n = parseInt(part, 10);
      if (n < 1 || n > totalPages) return [];
      ranges.push({ start: n, end: n });
    } else {
      return [];
    }
  }
  return ranges;
}

/* ========= 3. ضغط PDF (Compress) — إعادة عرض كل صفحة كصورة مضغوطة عبر Canvas ========= */
async function compressPDF() {
  if (!checkPdfLibraries()) return;
  var input = document.getElementById("compressFile");
  var status = document.getElementById("compressStatus");
  var button = document.getElementById("compressBtn");
  var wrap = document.getElementById("compressProgressWrap");
  var bar = document.getElementById("compressProgressBar");
  var qualitySlider = document.getElementById("compressQuality");
  var C = window.AngezhaCommon;
  var isAr = ar();

  if (!input.files.length) {
    C.setStatus(status, isAr ? "⚠️ اختر ملف PDF أولًا." : "⚠️ Choose a PDF file first.", "warn");
    return;
  }
  var file = input.files[0];
  if (!C.isPdfFile(file)) {
    C.setStatus(status, isAr ? "⚠️ الملف المختار مش PDF صالح." : "⚠️ The selected file is not a valid PDF.", "warn");
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    C.setStatus(status, isAr ? "⚠️ الملف أكبر من 50 ميجابايت." : "⚠️ File exceeds 50MB.", "warn");
    return;
  }

  var quality = qualitySlider ? parseInt(qualitySlider.value, 10) / 100 : 0.6;

  button.disabled = true;
  C.setProgress(wrap, bar, 0);

  try {
    C.setStatus(status, isAr ? "⏳ جاري ضغط الملف..." : "⏳ Compressing...", null);
    var pdf = await loadPdfJsDoc(file);
    var outDoc = await PDFLib.PDFDocument.create();

    for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      var page = await pdf.getPage(pageNum);
      var viewport = page.getViewport({ scale: 1.4 });
      var canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      var ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      var jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
      var jpegBytes = await (await fetch(jpegDataUrl)).arrayBuffer();
      var embeddedImg = await outDoc.embedJpg(jpegBytes);

      var newPage = outDoc.addPage([viewport.width, viewport.height]);
      newPage.drawImage(embeddedImg, { x: 0, y: 0, width: viewport.width, height: viewport.height });

      C.setProgress(wrap, bar, Math.round((pageNum / pdf.numPages) * 100));
      C.setStatus(status, isAr ? "⏳ جاري ضغط الصفحة " + pageNum + " من " + pdf.numPages : "⏳ Compressing page " + pageNum + " of " + pdf.numPages, null);
    }

    var resultBytes = await outDoc.save();
    var blob = new Blob([resultBytes], { type: "application/pdf" });
    var before = C.formatSize(file.size);
    var after = C.formatSize(blob.size);
    C.downloadBlob(blob, "angezha-compressed.pdf");
    C.setProgress(wrap, bar, null);
    C.setStatus(status, isAr
      ? "✅ تم ضغط الملف (" + before + " ← " + after + ") وتحميله."
      : "✅ Compressed (" + before + " → " + after + ") and downloaded.", "ok");
  } catch (error) {
    C.setProgress(wrap, bar, null);
    C.setStatus(status, "❌ " + friendlyPdfError(error, "حصلت مشكلة أثناء ضغط الملف.", "Something went wrong while compressing."), "err");
  } finally {
    button.disabled = false;
  }
}

/* ========= 4. تدوير PDF (Rotate) ========= */
async function rotatePDF() {
  if (!checkPdfLibraries()) return;
  var input = document.getElementById("rotateFile");
  var status = document.getElementById("rotateStatus");
  var button = document.getElementById("rotateBtn");
  var angleSelect = document.getElementById("rotateAngle");
  var C = window.AngezhaCommon;
  var isAr = ar();

  if (!input.files.length) {
    C.setStatus(status, isAr ? "⚠️ اختر ملف PDF أولًا." : "⚠️ Choose a PDF file first.", "warn");
    return;
  }
  var file = input.files[0];
  if (!C.isPdfFile(file)) {
    C.setStatus(status, isAr ? "⚠️ الملف المختار مش PDF صالح." : "⚠️ The selected file is not a valid PDF.", "warn");
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    C.setStatus(status, isAr ? "⚠️ الملف أكبر من 50 ميجابايت." : "⚠️ File exceeds 50MB.", "warn");
    return;
  }

  var angle = parseInt(angleSelect.value, 10) || 90;
  button.disabled = true;

  try {
    C.setStatus(status, isAr ? "⏳ جاري تدوير الصفحات..." : "⏳ Rotating pages...", null);
    var pdfDoc = await loadPdfLibDoc(file);
    var pages = pdfDoc.getPages();
    pages.forEach(function (page) {
      var current = page.getRotation().angle;
      page.setRotation(PDFLib.degrees((current + angle) % 360));
    });
    var bytes = await pdfDoc.save();
    var blob = new Blob([bytes], { type: "application/pdf" });
    C.downloadBlob(blob, "angezha-rotated.pdf");
    C.setStatus(status, isAr ? "✅ تم تدوير الصفحات وتحميل الملف." : "✅ Pages rotated and downloaded.", "ok");
  } catch (error) {
    C.setStatus(status, "❌ " + friendlyPdfError(error, "حصلت مشكلة أثناء تدوير الملف.", "Something went wrong while rotating."), "err");
  } finally {
    button.disabled = false;
  }
}

/* ========= 5. حذف صفحات (Delete Pages) ========= */
async function deletePdfPages() {
  if (!checkPdfLibraries()) return;
  var input = document.getElementById("deleteFile");
  var status = document.getElementById("deleteStatus");
  var button = document.getElementById("deleteBtn");
  var pagesInput = document.getElementById("deletePages");
  var C = window.AngezhaCommon;
  var isAr = ar();

  if (!input.files.length) {
    C.setStatus(status, isAr ? "⚠️ اختر ملف PDF أولًا." : "⚠️ Choose a PDF file first.", "warn");
    return;
  }
  var file = input.files[0];
  if (!C.isPdfFile(file)) {
    C.setStatus(status, isAr ? "⚠️ الملف المختار مش PDF صالح." : "⚠️ The selected file is not a valid PDF.", "warn");
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    C.setStatus(status, isAr ? "⚠️ الملف أكبر من 50 ميجابايت." : "⚠️ File exceeds 50MB.", "warn");
    return;
  }

  button.disabled = true;

  try {
    C.setStatus(status, isAr ? "⏳ جاري حذف الصفحات..." : "⏳ Deleting pages...", null);
    var pdfDoc = await loadPdfLibDoc(file);
    var totalPages = pdfDoc.getPageCount();
    var ranges = parsePageRanges(pagesInput.value, totalPages);

    if (!pagesInput.value.trim() || !ranges.length) {
      C.setStatus(status, isAr
        ? "⚠️ حدد أرقام الصفحات المطلوب حذفها، مثال: 2, 4-5"
        : "⚠️ Enter the page numbers to delete, e.g. 2, 4-5", "warn");
      button.disabled = false;
      return;
    }

    var toDelete = new Set();
    ranges.forEach(function (r) {
      for (var p = r.start; p <= r.end; p++) toDelete.add(p - 1);
    });

    if (toDelete.size >= totalPages) {
      C.setStatus(status, isAr
        ? "⚠️ لا يمكن حذف كل الصفحات، لازم تسيب صفحة واحدة على الأقل."
        : "⚠️ You can't delete every page — at least one must remain.", "warn");
      button.disabled = false;
      return;
    }

    var indices = Array.from(toDelete).sort(function (a, b) { return b - a; });
    indices.forEach(function (idx) { pdfDoc.removePage(idx); });

    var bytes = await pdfDoc.save();
    var blob = new Blob([bytes], { type: "application/pdf" });
    C.downloadBlob(blob, "angezha-pages-deleted.pdf");
    C.setStatus(status, isAr ? "✅ تم حذف الصفحات المحددة وتحميل الملف." : "✅ Selected pages deleted and file downloaded.", "ok");
  } catch (error) {
    C.setStatus(status, "❌ " + friendlyPdfError(error, "حصلت مشكلة أثناء حذف الصفحات.", "Something went wrong while deleting pages."), "err");
  } finally {
    button.disabled = false;
  }
}

/* ========= 6. استخراج صفحات (Extract Pages) ========= */
async function extractPdfPages() {
  if (!checkPdfLibraries()) return;
  var input = document.getElementById("extractFile");
  var status = document.getElementById("extractStatus");
  var button = document.getElementById("extractBtn");
  var pagesInput = document.getElementById("extractPages");
  var C = window.AngezhaCommon;
  var isAr = ar();

  if (!input.files.length) {
    C.setStatus(status, isAr ? "⚠️ اختر ملف PDF أولًا." : "⚠️ Choose a PDF file first.", "warn");
    return;
  }
  var file = input.files[0];
  if (!C.isPdfFile(file)) {
    C.setStatus(status, isAr ? "⚠️ الملف المختار مش PDF صالح." : "⚠️ The selected file is not a valid PDF.", "warn");
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    C.setStatus(status, isAr ? "⚠️ الملف أكبر من 50 ميجابايت." : "⚠️ File exceeds 50MB.", "warn");
    return;
  }

  button.disabled = true;

  try {
    C.setStatus(status, isAr ? "⏳ جاري استخراج الصفحات..." : "⏳ Extracting pages...", null);
    var srcDoc = await loadPdfLibDoc(file);
    var totalPages = srcDoc.getPageCount();
    var ranges = parsePageRanges(pagesInput.value, totalPages);

    if (!pagesInput.value.trim() || !ranges.length) {
      C.setStatus(status, isAr
        ? "⚠️ حدد أرقام الصفحات المطلوب استخراجها، مثال: 1-3, 6"
        : "⚠️ Enter the page numbers to extract, e.g. 1-3, 6", "warn");
      button.disabled = false;
      return;
    }

    var indices = [];
    ranges.forEach(function (r) {
      for (var p = r.start; p <= r.end; p++) indices.push(p - 1);
    });
    indices = Array.from(new Set(indices)).sort(function (a, b) { return a - b; });

    var newDoc = await PDFLib.PDFDocument.create();
    var copied = await newDoc.copyPages(srcDoc, indices);
    copied.forEach(function (pg) { newDoc.addPage(pg); });

    var bytes = await newDoc.save();
    var blob = new Blob([bytes], { type: "application/pdf" });
    C.downloadBlob(blob, "angezha-extracted.pdf");
    C.setStatus(status, isAr ? "✅ تم استخراج الصفحات وتحميل الملف الجديد." : "✅ Pages extracted and new file downloaded.", "ok");
  } catch (error) {
    C.setStatus(status, "❌ " + friendlyPdfError(error, "حصلت مشكلة أثناء استخراج الصفحات.", "Something went wrong while extracting pages."), "err");
  } finally {
    button.disabled = false;
  }
}

/* ========= 7. إعادة ترتيب الصفحات (Reorder) ========= */
var reorderPagesData = []; // array of {index, thumbUrl}

async function loadReorderPreview() {
  if (!checkPdfLibraries()) return;
  var input = document.getElementById("reorderFile");
  var status = document.getElementById("reorderStatus");
  var listEl = document.getElementById("reorderList");
  var C = window.AngezhaCommon;
  var isAr = ar();

  if (!input.files.length) return;
  var file = input.files[0];
  if (!C.isPdfFile(file)) {
    C.setStatus(status, isAr ? "⚠️ الملف المختار مش PDF صالح." : "⚠️ The selected file is not a valid PDF.", "warn");
    return;
  }

  C.setStatus(status, isAr ? "⏳ جاري تجهيز معاينة الصفحات..." : "⏳ Preparing page previews...", null);
  listEl.innerHTML = "";
  reorderPagesData = [];

  try {
    var pdf = await loadPdfJsDoc(file);
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var viewport = page.getViewport({ scale: 0.3 });
      var canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      var ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      reorderPagesData.push({ index: i - 1, thumbUrl: canvas.toDataURL("image/jpeg", 0.7) });
    }
    renderReorderList();
    C.setStatus(status, isAr
      ? "✅ اسحب وأفلت الصفحات لإعادة ترتيبها، ثم اضغط تحميل."
      : "✅ Drag and drop pages to reorder, then click download.", "ok");
  } catch (error) {
    C.setStatus(status, "❌ " + friendlyPdfError(error, "حصلت مشكلة أثناء تحميل المعاينة.", "Something went wrong loading the preview."), "err");
  }
}

function renderReorderList() {
  var listEl = document.getElementById("reorderList");
  if (!listEl) return;
  listEl.innerHTML = "";
  reorderPagesData.forEach(function (p, displayIdx) {
    var item = document.createElement("div");
    item.className = "reorder-item";
    item.setAttribute("draggable", "true");
    item.setAttribute("data-idx", String(displayIdx));
    item.setAttribute("tabindex", "0");
    item.innerHTML =
      '<img src="' + p.thumbUrl + '" alt="Page ' + (p.index + 1) + '">' +
      '<span class="reorder-num">' + (displayIdx + 1) + "</span>";
    item.addEventListener("dragstart", function (e) {
      e.dataTransfer.setData("text/plain", String(displayIdx));
    });
    item.addEventListener("dragover", function (e) { e.preventDefault(); });
    item.addEventListener("drop", function (e) {
      e.preventDefault();
      var fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
      var toIdx = displayIdx;
      var moved = reorderPagesData.splice(fromIdx, 1)[0];
      reorderPagesData.splice(toIdx, 0, moved);
      renderReorderList();
    });
    listEl.appendChild(item);
  });
}

async function downloadReorderedPDF() {
  if (!checkPdfLibraries()) return;
  var input = document.getElementById("reorderFile");
  var status = document.getElementById("reorderStatus");
  var C = window.AngezhaCommon;
  var isAr = ar();

  if (!input.files.length || !reorderPagesData.length) {
    C.setStatus(status, isAr ? "⚠️ حمّل ملف PDF أولًا." : "⚠️ Load a PDF file first.", "warn");
    return;
  }
  var file = input.files[0];

  try {
    C.setStatus(status, isAr ? "⏳ جاري إنشاء الملف الجديد..." : "⏳ Building the new file...", null);
    var srcDoc = await loadPdfLibDoc(file);
    var newDoc = await PDFLib.PDFDocument.create();
    var order = reorderPagesData.map(function (p) { return p.index; });
    var copied = await newDoc.copyPages(srcDoc, order);
    copied.forEach(function (pg) { newDoc.addPage(pg); });
    var bytes = await newDoc.save();
    var blob = new Blob([bytes], { type: "application/pdf" });
    C.downloadBlob(blob, "angezha-reordered.pdf");
    C.setStatus(status, isAr ? "✅ تم إعادة الترتيب وتحميل الملف." : "✅ Reordered and downloaded.", "ok");
  } catch (error) {
    C.setStatus(status, "❌ " + friendlyPdfError(error, "حصلت مشكلة أثناء إنشاء الملف.", "Something went wrong building the file."), "err");
  }
}

/* ========= 8. إضافة نص إلى PDF (Add Text) ========= */
async function addTextToPDF() {
  if (!checkPdfLibraries()) return;
  var input = document.getElementById("addTextFile");
  var status = document.getElementById("addTextStatus");
  var button = document.getElementById("addTextBtn");
  var textInput = document.getElementById("addTextValue");
  var pageInput = document.getElementById("addTextPage");
  var xInput = document.getElementById("addTextX");
  var yInput = document.getElementById("addTextY");
  var sizeInput = document.getElementById("addTextSize");
  var C = window.AngezhaCommon;
  var isAr = ar();

  if (!input.files.length) {
    C.setStatus(status, isAr ? "⚠️ اختر ملف PDF أولًا." : "⚠️ Choose a PDF file first.", "warn");
    return;
  }
  var file = input.files[0];
  if (!C.isPdfFile(file)) {
    C.setStatus(status, isAr ? "⚠️ الملف المختار مش PDF صالح." : "⚠️ The selected file is not a valid PDF.", "warn");
    return;
  }
  if (!textInput.value.trim()) {
    C.setStatus(status, isAr ? "⚠️ اكتب النص المطلوب إضافته." : "⚠️ Enter the text to add.", "warn");
    return;
  }

  button.disabled = true;

  try {
    C.setStatus(status, isAr ? "⏳ جاري إضافة النص..." : "⏳ Adding text...", null);
    var pdfDoc = await loadPdfLibDoc(file);
    var pages = pdfDoc.getPages();
    var pageNum = Math.min(Math.max(parseInt(pageInput.value, 10) || 1, 1), pages.length);
    var page = pages[pageNum - 1];
    var font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    var fontSize = parseInt(sizeInput.value, 10) || 24;
    var x = parseInt(xInput.value, 10) || 50;
    var y = parseInt(yInput.value, 10) || 50;

    page.drawText(textInput.value, {
      x: x,
      y: y,
      size: fontSize,
      font: font,
      color: PDFLib.rgb(0.1, 0.1, 0.2)
    });

    var bytes = await pdfDoc.save();
    var blob = new Blob([bytes], { type: "application/pdf" });
    C.downloadBlob(blob, "angezha-text-added.pdf");
    C.setStatus(status, isAr ? "✅ تمت إضافة النص وتحميل الملف." : "✅ Text added and file downloaded.", "ok");
  } catch (error) {
    C.setStatus(status, "❌ " + friendlyPdfError(error, "حصلت مشكلة أثناء إضافة النص. ملحوظة: النص يدعم الحروف اللاتينية فقط حاليًا.", "Something went wrong while adding text."), "err");
  } finally {
    button.disabled = false;
  }
}

/* ========= 9. علامة مائية (Watermark) ========= */
async function watermarkPDF() {
  if (!checkPdfLibraries()) return;
  var input = document.getElementById("watermarkFile");
  var status = document.getElementById("watermarkStatus");
  var button = document.getElementById("watermarkBtn");
  var textInput = document.getElementById("watermarkText");
  var opacityInput = document.getElementById("watermarkOpacity");
  var C = window.AngezhaCommon;
  var isAr = ar();

  if (!input.files.length) {
    C.setStatus(status, isAr ? "⚠️ اختر ملف PDF أولًا." : "⚠️ Choose a PDF file first.", "warn");
    return;
  }
  var file = input.files[0];
  if (!C.isPdfFile(file)) {
    C.setStatus(status, isAr ? "⚠️ الملف المختار مش PDF صالح." : "⚠️ The selected file is not a valid PDF.", "warn");
    return;
  }
  if (!textInput.value.trim()) {
    C.setStatus(status, isAr ? "⚠️ اكتب نص العلامة المائية." : "⚠️ Enter the watermark text.", "warn");
    return;
  }

  button.disabled = true;

  try {
    C.setStatus(status, isAr ? "⏳ جاري إضافة العلامة المائية..." : "⏳ Adding watermark...", null);
    var pdfDoc = await loadPdfLibDoc(file);
    var font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    var opacity = opacityInput ? parseInt(opacityInput.value, 10) / 100 : 0.25;
    var text = textInput.value;

    pdfDoc.getPages().forEach(function (page) {
      var { width, height } = page.getSize();
      var fontSize = Math.min(width, height) / 8;
      page.drawText(text, {
        x: width / 2 - (text.length * fontSize) / 4,
        y: height / 2,
        size: fontSize,
        font: font,
        color: PDFLib.rgb(0.4, 0.4, 0.4),
        opacity: opacity,
        rotate: PDFLib.degrees(45)
      });
    });

    var bytes = await pdfDoc.save();
    var blob = new Blob([bytes], { type: "application/pdf" });
    C.downloadBlob(blob, "angezha-watermarked.pdf");
    C.setStatus(status, isAr ? "✅ تمت إضافة العلامة المائية وتحميل الملف." : "✅ Watermark added and file downloaded.", "ok");
  } catch (error) {
    C.setStatus(status, "❌ " + friendlyPdfError(error, "حصلت مشكلة أثناء إضافة العلامة المائية. ملحوظة: النص يدعم الحروف اللاتينية فقط حاليًا.", "Something went wrong while adding the watermark."), "err");
  } finally {
    button.disabled = false;
  }
}

/* ========= 10/11. صور (JPG/PNG) إلى PDF ========= */
async function imagesToPDF(inputId, statusId, buttonId, listId) {
  if (!checkPdfLibraries()) return;
  var input = document.getElementById(inputId);
  var status = document.getElementById(statusId);
  var button = document.getElementById(buttonId);
  var C = window.AngezhaCommon;
  var isAr = ar();

  if (!input.files.length) {
    C.setStatus(status, isAr ? "⚠️ اختر صورة واحدة أو أكثر أولًا." : "⚠️ Choose one or more images first.", "warn");
    return;
  }

  button.disabled = true;

  try {
    C.setStatus(status, isAr ? "⏳ جاري تحويل الصور..." : "⏳ Converting images...", null);
    var pdfDoc = await PDFLib.PDFDocument.create();

    for (var file of input.files) {
      var bytes = await file.arrayBuffer();
      var img;
      var lower = file.name.toLowerCase();
      if (lower.endsWith(".png")) {
        img = await pdfDoc.embedPng(bytes);
      } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
        img = await pdfDoc.embedJpg(bytes);
      } else {
        throw new Error(isAr ? 'تعذّر معالجة "' + file.name + '" — الصيغة غير مدعومة.' : 'Couldn\'t process "' + file.name + '" — unsupported format.');
      }
      var page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }

    var resultBytes = await pdfDoc.save();
    var blob = new Blob([resultBytes], { type: "application/pdf" });
    C.downloadBlob(blob, "angezha-images.pdf");
    C.setStatus(status, isAr ? "✅ تم تحويل الصور إلى PDF وتحميل الملف." : "✅ Images converted to PDF and downloaded.", "ok");
    input.value = "";
    var listEl = document.getElementById(listId);
    if (listEl) listEl.innerHTML = "";
  } catch (error) {
    C.setStatus(status, "❌ " + friendlyPdfError(error, "حصلت مشكلة أثناء تحويل الصور.", "Something went wrong while converting images."), "err");
  } finally {
    button.disabled = false;
  }
}

/* ========= 12/13. PDF إلى صور (JPG/PNG) ========= */
async function pdfToImages(format) {
  if (!checkPdfLibraries()) return;
  var idPrefix = format === "png" ? "pdfToPng" : "pdfToJpg";
  var input = document.getElementById(idPrefix + "File");
  var status = document.getElementById(idPrefix + "Status");
  var button = document.getElementById(idPrefix + "Btn");
  var wrap = document.getElementById(idPrefix + "ProgressWrap");
  var bar = document.getElementById(idPrefix + "ProgressBar");
  var C = window.AngezhaCommon;
  var isAr = ar();

  if (!input.files.length) {
    C.setStatus(status, isAr ? "⚠️ اختر ملف PDF أولًا." : "⚠️ Choose a PDF file first.", "warn");
    return;
  }
  var file = input.files[0];
  if (!C.isPdfFile(file)) {
    C.setStatus(status, isAr ? "⚠️ الملف المختار مش PDF صالح." : "⚠️ The selected file is not a valid PDF.", "warn");
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    C.setStatus(status, isAr ? "⚠️ الملف أكبر من 50 ميجابايت." : "⚠️ File exceeds 50MB.", "warn");
    return;
  }

  button.disabled = true;
  C.setProgress(wrap, bar, 0);

  try {
    C.setStatus(status, isAr ? "⏳ جاري تحويل الصفحات..." : "⏳ Converting pages...", null);
    var pdf = await loadPdfJsDoc(file);
    var mime = format === "png" ? "image/png" : "image/jpeg";
    var ext = format === "png" ? "png" : "jpg";

    for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      var page = await pdf.getPage(pageNum);
      var viewport = page.getViewport({ scale: 2 });
      var canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      var ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      var dataUrl = canvas.toDataURL(mime, 0.92);
      var blob = await (await fetch(dataUrl)).blob();
      C.downloadBlob(blob, "angezha-page-" + pageNum + "." + ext);

      C.setProgress(wrap, bar, Math.round((pageNum / pdf.numPages) * 100));
      C.setStatus(status, isAr ? "⏳ جاري تحويل الصفحة " + pageNum + " من " + pdf.numPages : "⏳ Converting page " + pageNum + " of " + pdf.numPages, null);
      await new Promise(function (res) { setTimeout(res, 300); });
    }

    C.setProgress(wrap, bar, null);
    C.setStatus(status, isAr ? "✅ تم تحويل جميع الصفحات وتحميلها." : "✅ All pages converted and downloaded.", "ok");
  } catch (error) {
    C.setProgress(wrap, bar, null);
    C.setStatus(status, "❌ " + friendlyPdfError(error, "حصلت مشكلة أثناء التحويل.", "Something went wrong during conversion."), "err");
  } finally {
    button.disabled = false;
  }
}

/* ========= 14. PDF إلى Word ========= */
async function pdfToWord() {
  if (!checkPdfLibraries(["docx"])) return;
  var input = document.getElementById("wordFile");
  var status = document.getElementById("wordStatus");
  var button = document.getElementById("wordBtn");
  var wrap = document.getElementById("wordProgressWrap");
  var bar = document.getElementById("wordProgressBar");
  var C = window.AngezhaCommon;
  var isAr = ar();

  if (!input.files.length) {
    C.setStatus(status, isAr ? "⚠️ اختر ملف PDF أولًا." : "⚠️ Choose a PDF file first.", "warn");
    return;
  }
  var file = input.files[0];
  if (!C.isPdfFile(file)) {
    C.setStatus(status, isAr ? "⚠️ الملف المختار مش PDF صالح." : "⚠️ The selected file is not a valid PDF.", "warn");
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    C.setStatus(status, isAr ? "⚠️ الملف أكبر من 50 ميجابايت." : "⚠️ File exceeds 50MB.", "warn");
    return;
  }

  button.disabled = true;
  C.setProgress(wrap, bar, 0);

  try {
    C.setStatus(status, isAr ? "⏳ جاري قراءة ملف PDF..." : "⏳ Reading the PDF...", null);
    var pdf = await loadPdfJsDoc(file);
    var fullText = "";

    for (var pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      C.setProgress(wrap, bar, Math.round((pageNumber / pdf.numPages) * 100));
      C.setStatus(status, isAr ? "⏳ جاري معالجة الصفحة " + pageNumber + " من " + pdf.numPages : "⏳ Processing page " + pageNumber + " of " + pdf.numPages, null);
      try {
        var page = await pdf.getPage(pageNumber);
        var content = await page.getTextContent();
        var text = content.items.map(function (item) { return item.str; }).join(" ");
        fullText += text + "\n\n";
      } catch (pageError) {
        console.error("Page error " + pageNumber, pageError);
      }
    }

    if (!fullText.trim()) {
      C.setProgress(wrap, bar, null);
      C.setStatus(status, isAr
        ? "⚠️ لم نتمكن من استخراج نص من هذا الملف. قد يكون PDF عبارة عن صور."
        : "⚠️ Couldn't extract any text. The PDF might be a scanned image.", "warn");
      button.disabled = false;
      return;
    }

    var paragraphs = fullText.split("\n").map(function (line) {
      return new docx.Paragraph({ children: [new docx.TextRun(line)] });
    });
    var wordDoc = new docx.Document({ sections: [{ properties: {}, children: paragraphs }] });
    var blob = await docx.Packer.toBlob(wordDoc);

    C.downloadBlob(blob, "angezha-converted.docx");
    C.setProgress(wrap, bar, null);
    C.setStatus(status, isAr ? "✅ تم تحويل الملف وتحميل Word." : "✅ File converted and Word doc downloaded.", "ok");
  } catch (error) {
    C.setProgress(wrap, bar, null);
    C.setStatus(status, "❌ " + friendlyPdfError(error, "حصلت مشكلة أثناء تحويل الملف.", "Something went wrong while converting."), "err");
  } finally {
    button.disabled = false;
  }
}

/* ---------- Wire up file input change listeners generically on tool pages ---------- */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("input[type=file][data-filelist]").forEach(function (input) {
    var listEl = document.getElementById(input.getAttribute("data-filelist"));
    input.addEventListener("change", function () {
      window.AngezhaCommon.renderFileList(listEl, this.files);
    });
  });
});
