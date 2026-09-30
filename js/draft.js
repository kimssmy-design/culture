/* =========================================================
 * 저장 안전장치
 *  - Draft : 입력할 때마다 태블릿(localStorage)에 임시 보관
 *            서버 저장에 성공하면 임시 보관은 비움
 *  - SaveReminder : 저장하지 않은 채 10분이 지나면 알림
 * ========================================================= */
var Draft = (function () {
  var PREFIX = 'mcposter-draft-';
  var key = null;
  var timer = null;
  var pending = null;

  // 사생활 보호 모드 등에서 저장소를 못 쓰면 조용히 꺼짐
  var usable = (function () {
    try {
      localStorage.setItem('__mc_test', '1');
      localStorage.removeItem('__mc_test');
      return true;
    } catch (e) { return false; }
  })();

  function init(cred) {
    key = PREFIX + cred.cls + '-' + cred.num;
  }

  function read() {
    if (!usable || !key) return null;
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v && v.data && v.ts ? v : null;
    } catch (e) { return null; }
  }

  function flush() {
    clearTimeout(timer);
    if (!usable || !key || !pending) return;
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: pending })); } catch (e) {}
    pending = null;
  }

  // 입력이 멈추고 0.6초 뒤에 한 번만 기록 (타자 칠 때마다 쓰지 않음)
  function write(data) {
    if (!usable || !key) return;
    pending = JSON.parse(JSON.stringify(data));
    clearTimeout(timer);
    timer = setTimeout(flush, 600);
  }

  function clear() {
    clearTimeout(timer);
    pending = null;
    if (!usable || !key) return;
    try { localStorage.removeItem(key); } catch (e) {}
  }

  // 화면을 닫거나 다른 앱으로 넘어갈 때 바로 기록
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });

  return { init: init, read: read, write: write, clear: clear };
})();

var SaveReminder = (function () {
  var LIMIT_MS = 10 * 60 * 1000;
  var dirtySince = null;
  var ticker = null;
  var onChange = function () {};

  function check() {
    var on = dirtySince !== null && (Date.now() - dirtySince) >= LIMIT_MS;
    onChange(on);
  }

  function start(callback) {
    onChange = callback || onChange;
    if (!ticker) ticker = setInterval(check, 30000);
  }

  // 저장 안 한 첫 수정 시각부터 10분을 셈
  function markDirty() {
    if (dirtySince === null) dirtySince = Date.now();
  }

  function markSaved() {
    dirtySince = null;
    onChange(false);
  }

  function stop() {
    clearInterval(ticker);
    ticker = null;
    dirtySince = null;
    onChange(false);
  }

  return { start: start, markDirty: markDirty, markSaved: markSaved, stop: stop };
})();
