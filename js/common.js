/* =========================================================
 * 공용 도구 — 데이터 모양, 진행률, 글자 처리, 알림
 * (학생 페이지와 교사 페이지가 함께 씀)
 * ========================================================= */
var Common = (function () {
  var TRIP_LABELS = { 2: '1박 2일', 3: '2박 3일', 4: '3박 4일' };
  var DEFAULT_MEANS = ['안녕하세요', '감사합니다', '죄송합니다', '잘 먹겠습니다', ''];

  var BASIC_FIELDS = [
    { key: 'capital', label: '수도', ph: '수도 이름' },
    { key: 'location', label: '위치', ph: '어느 대륙, 어느 쪽?' },
    { key: 'population', label: '인구', ph: '약 ○○만 명' },
    { key: 'area', label: '면적', ph: '한국의 약 ○배' },
    { key: 'language', label: '언어', ph: '쓰는 말' },
    { key: 'religion', label: '종교', ph: '주로 믿는 종교' },
    { key: 'currency', label: '화폐', ph: '돈의 단위' },
    { key: 'flower', label: '국화', ph: '나라꽃' }
  ];

  // 입력 칸 글자 수 제한 (포스터 칸에 맞춘 값)
  var LIMITS = {
    basic: 20, foodName: 15, foodIntro: 40,
    place: 12, desc: 22,
    orig: 20, pron: 16, mean: 15, situ: 18,
    diff: 50, feeling: 240
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function str(v) { return typeof v === 'string' ? v : (v == null ? '' : String(v)); }

  function makeSlots() {
    return [{ place: '', desc: '' }, { place: '', desc: '' }, { place: '', desc: '' }];
  }

  function emptyData() {
    var basic = {};
    BASIC_FIELDS.forEach(function (f) { basic[f.key] = ''; });
    var plan = [];
    for (var i = 0; i < 4; i++) plan.push(makeSlots());
    return {
      country: '',
      basic: basic,
      food: { name: '', intro: '' },
      costume: { name: '', intro: '' },
      trip: { days: 4, plan: plan },
      phrases: DEFAULT_MEANS.map(function (m) { return { orig: '', pron: '', mean: m, situ: '' }; }),
      diffs: ['', '', ''],
      feeling: ''
    };
  }

  // 저장된 데이터가 어떤 모양이든 항상 같은 모양으로 맞춤
  function normalize(d) {
    var base = emptyData();
    if (!d || typeof d !== 'object') return base;

    base.country = str(d.country);
    var b = d.basic || {};
    BASIC_FIELDS.forEach(function (f) { base.basic[f.key] = str(b[f.key]); });
    ['food', 'costume'].forEach(function (k) {
      var src = d[k] || {};
      base[k] = { name: str(src.name), intro: str(src.intro) };
    });

    var t = d.trip || {};
    var days = parseInt(t.days, 10);
    base.trip.days = (days >= 2 && days <= 4) ? days : 4;
    var plan = Array.isArray(t.plan) ? t.plan : [];
    for (var i = 0; i < 4; i++) {
      var slots = Array.isArray(plan[i]) ? plan[i] : [];
      for (var j = 0; j < 3; j++) {
        var s = slots[j] || {};
        base.trip.plan[i][j] = { place: str(s.place), desc: str(s.desc) };
      }
    }

    if (Array.isArray(d.phrases)) {
      for (var p = 0; p < 5; p++) {
        var ph = d.phrases[p];
        if (!ph) continue;
        base.phrases[p] = { orig: str(ph.orig), pron: str(ph.pron), mean: str(ph.mean), situ: str(ph.situ) };
      }
    }
    if (Array.isArray(d.diffs)) {
      for (var q = 0; q < 3; q++) base.diffs[q] = str(d.diffs[q]);
    }
    base.feeling = str(d.feeling);
    return base;
  }

  // 진행률: 꼭 채워야 하는 칸 중 몇 %를 채웠는지
  function progress(raw) {
    var d = normalize(raw);
    var total = 0;
    var filled = 0;
    function check(v) { total++; if (str(v).trim()) filled++; }

    check(d.country);
    BASIC_FIELDS.forEach(function (f) { check(d.basic[f.key]); });
    check(d.food.name); check(d.food.intro);
    check(d.costume.name); check(d.costume.intro);
    for (var i = 0; i < d.trip.days; i++) {
      for (var j = 0; j < 3; j++) { check(d.trip.plan[i][j].place); check(d.trip.plan[i][j].desc); }
    }
    for (var p = 0; p < 4; p++) {
      check(d.phrases[p].orig); check(d.phrases[p].pron); check(d.phrases[p].mean); check(d.phrases[p].situ);
    }
    d.diffs.forEach(check);
    check(d.feeling);
    return Math.round((filled / total) * 100);
  }

  // 받침에 따라 조사 고르기: josa('베트남','은','는') → '베트남은'
  function josa(word, withBatchim, without) {
    var w = str(word);
    var code = w.charCodeAt(w.length - 1);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      return w + (((code - 0xAC00) % 28) ? withBatchim : without);
    }
    return w + withBatchim + '(' + without + ')';
  }

  function toast(msg, type) {
    var box = document.getElementById('toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast';
      box.setAttribute('role', 'status');
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.className = 'toast show ' + (type || '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { box.className = 'toast'; }, 3200);
  }

  function setBusy(btn, busy, busyText) {
    if (!btn) return;
    if (busy) {
      if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + esc(busyText || '잠시만요');
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
      delete btn.dataset.label;
    }
  }

  // 요청이 오래 걸리면 안내 문구를 단계별로 보여줌. 끝나면 돌려받은 함수를 부르면 사라짐
  function slowHint(el) {
    if (!el) return function () {};
    var t1 = setTimeout(function () {
      el.textContent = '서버를 깨우는 중이에요. 잠시만 기다려 주세요.';
      el.hidden = false;
    }, 5000);
    var t2 = setTimeout(function () {
      el.textContent = '조금 더 걸리고 있어요. 창을 닫지 말고 기다려 주세요.';
    }, 15000);
    return function () {
      clearTimeout(t1);
      clearTimeout(t2);
      el.hidden = true;
      el.textContent = '';
    };
  }

  return {
    slowHint: slowHint,
    TRIP_LABELS: TRIP_LABELS,
    DEFAULT_MEANS: DEFAULT_MEANS,
    BASIC_FIELDS: BASIC_FIELDS,
    LIMITS: LIMITS,
    esc: esc,
    emptyData: emptyData,
    normalize: normalize,
    progress: progress,
    josa: josa,
    toast: toast,
    setBusy: setBusy
  };
})();
