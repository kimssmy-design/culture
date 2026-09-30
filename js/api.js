/* =========================================================
 * GAS 통신 — 실패하면 최대 3번까지 자동으로 다시 시도해요.
 * ========================================================= */
var Api = (function () {
  function isConfigured() {
    return typeof CONFIG !== 'undefined' &&
      String(CONFIG.GAS_URL || '').indexOf('https://script.google.com/') === 0;
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function call(action, data, retries) {
    if (!isConfigured()) {
      throw new Error('config.js에 GAS 주소가 아직 들어 있지 않아요.');
    }
    var tries = retries || 3;
    var url = CONFIG.GAS_URL + '?action=' + encodeURIComponent(action);
    var body = JSON.stringify(Object.assign({}, data || {}, { action: action }));

    for (var i = 1; i <= tries; i++) {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 40000);
      try {
        var res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: body,
          signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (err) {
        clearTimeout(timer);
        if (i === tries) throw err;
        await wait(i * 1000);
      }
    }
  }

  // 페이지를 열자마자 GAS를 깨워서 첫 로그인을 빠르게
  function warmup() {
    if (!isConfigured()) return;
    fetch(CONFIG.GAS_URL, { method: 'GET' }).catch(function () {});
  }

  return { call: call, warmup: warmup, isConfigured: isConfigured };
})();
