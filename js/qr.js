/* =========================================================
 * QR코드 팝업 열기·닫기 (QR 그림은 index.html 안에 SVG로 들어 있음)
 * ========================================================= */
(function () {
  var overlay = document.getElementById('qr-overlay');
  var openBtn = document.getElementById('qr-open-btn');
  var closeBtn = document.getElementById('qr-close-btn');
  if (!overlay || !openBtn || !closeBtn) return;

  function open() {
    overlay.hidden = false;
    document.body.classList.add('no-scroll');
    closeBtn.focus();
  }
  function close() {
    overlay.hidden = true;
    document.body.classList.remove('no-scroll');
    openBtn.focus();
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.hidden) close(); });
})();
