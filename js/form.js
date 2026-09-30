/* =========================================================
 * 학생 입력 화면 — 칸 만들기, 입력 기억, 저장, 나라 중복 경고
 * ========================================================= */
var Form = (function () {
  var esc = Common.esc;
  var L = Common.LIMITS;

  var state = null;     // 지금 입력 중인 내용
  var cred = null;      // { cls, num, pw, name, grade }
  var counts = {};      // 우리 반 다른 친구들의 나라 선택 수
  var maxPer = 2;
  var dirty = false;
  var locked = false;
  var saving = false;

  function $(id) { return document.getElementById(id); }

  /* ---------- 경로로 값 읽고 쓰기 ('trip.plan.0.1.place') ---------- */
  function setPath(obj, path, value) {
    var keys = path.split('.');
    var o = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      o = o[keys[i]];
      if (o == null) return;
    }
    o[keys[keys.length - 1]] = value;
  }

  function input(path, value, max, placeholder, extraClass) {
    return '<input type="text" data-k="' + path + '" value="' + esc(value) + '" maxlength="' + max + '"' +
      ' placeholder="' + esc(placeholder || '') + '"' + (extraClass ? ' class="' + extraClass + '"' : '') + '>';
  }

  /* ---------- 시작 ---------- */
  function start(credential, payload) {
    cred = credential;
    state = Common.normalize(payload.data);
    counts = payload.counts || {};
    maxPer = payload.maxPerCountry || CONFIG.MAX_PER_COUNTRY;
    locked = !!payload.locked;
    dirty = false;

    $('whoName').textContent = cred.name;
    $('whoInfo').textContent = cred.grade + '학년 ' + cred.cls + '반 ' + cred.num + '번';

    renderAll();
    bindOnce();
    setSaveState(payload.savedAt ? 'saved' : 'never', payload.savedAt);
    applyLock(locked);
  }

  function renderAll() {
    renderCountry();
    renderBasic();
    renderDraw();
    renderTrip();
    renderPhrases();
    renderDiffs();
    renderFeeling();
    updateProgress();
  }

  /* ---------- 1. 나라 ---------- */
  function renderCountry() {
    var h = '<option value="">나라를 골라 주세요</option>';
    var known = false;
    CONFIG.COUNTRIES.forEach(function (g) {
      h += '<optgroup label="' + esc(g.group) + '">';
      g.list.forEach(function (name) {
        var c = counts[name] || 0;
        var mine = name === state.country;
        if (mine) known = true;
        var full = c >= maxPer && !mine;
        var label = name + (full ? ' (마감)' : (c ? ' (' + c + '명 조사 중)' : ''));
        h += '<option value="' + esc(name) + '"' + (full ? ' disabled' : '') + (mine ? ' selected' : '') + '>' + esc(label) + '</option>';
      });
      h += '</optgroup>';
    });
    // 목록에서 빠진 나라를 이미 저장해 둔 경우에도 보이게
    if (state.country && !known) {
      h += '<option value="' + esc(state.country) + '" selected>' + esc(state.country) + '</option>';
    }
    $('country').innerHTML = h;
    updateCountryMsg();
  }

  function showCountryMsg(type, text) {
    var box = $('countryMsg');
    if (!text) { box.hidden = true; return; }
    box.hidden = false;
    box.className = 'banner ' + (type === 'error' ? 'banner-error' : 'banner-warn');
    box.textContent = text;
  }

  function updateCountryMsg() {
    var c = counts[state.country] || 0;
    if (state.country && c > 0) {
      showCountryMsg('warn', '우리 반에서 이미 ' + c + '명이 ' + Common.josa(state.country, '을', '를') +
        ' 조사하고 있어요. 한 나라는 ' + maxPer + '명까지 고를 수 있어요.');
    } else {
      showCountryMsg('', '');
    }
  }

  async function onCountryChange() {
    var sel = $('country');
    var picked = sel.value;
    sel.disabled = true;
    try {
      var res = await Api.call('countries', { cls: cred.cls, num: cred.num });
      if (res && res.ok) counts = res.counts || {};
    } catch (e) { /* 현황을 못 받아도 저장할 때 서버가 한 번 더 확인함 */ }
    sel.disabled = locked;

    if (picked && (counts[picked] || 0) >= maxPer) {
      renderCountry(); // 원래 고른 나라로 되돌림
      showCountryMsg('error', Common.josa(picked, '은', '는') + ' 이미 ' + maxPer + '명이 조사하고 있어요. 다른 나라를 골라 주세요.');
      return;
    }
    state.country = picked;
    markDirty();
    renderCountry();
    updateProgress();
  }

  /* ---------- 2. 기본 정보 ---------- */
  function renderBasic() {
    var h = '';
    Common.BASIC_FIELDS.forEach(function (f) {
      h += '<label class="field"><span>' + esc(f.label) + '</span>' +
        input('basic.' + f.key, state.basic[f.key], L.basic, f.ph) + '</label>';
    });
    $('basicGrid').innerHTML = h;
  }

  /* ---------- 3. 음식·전통의상 ---------- */
  function renderDraw() {
    var h = '';
    [['food', '음식', '예) 대표 음식 이름'], ['costume', '전통의상', '예) 전통의상 이름']].forEach(function (x) {
      var item = state[x[0]];
      h += '<div class="sub-card"><h3>' + x[1] + '</h3>' +
        '<label class="field"><span>이름</span>' + input(x[0] + '.name', item.name, L.foodName, x[2]) + '</label>' +
        '<label class="field"><span>한 줄 소개</span>' + input(x[0] + '.intro', item.intro, L.foodIntro, '어떤 특징이 있나요?') + '</label>' +
        '</div>';
    });
    $('drawGrid').innerHTML = h;
  }

  /* ---------- 4. 여행 코스 ---------- */
  function renderTrip() {
    $('tripDaysSel').value = String(state.trip.days);
    var h = '';
    for (var i = 0; i < state.trip.days; i++) {
      h += '<div class="day"><div class="day-label">' + (i + 1) + '일차</div><div class="day-slots">';
      for (var j = 0; j < 3; j++) {
        var s = state.trip.plan[i][j];
        var base = 'trip.plan.' + i + '.' + j;
        h += '<div class="slot"><span class="slot-no">' + (j + 1) + '</span>' +
          input(base + '.place', s.place, L.place, '장소', 'slot-place') +
          input(base + '.desc', s.desc, L.desc, '무엇을 하나요? 간단히', 'slot-desc') +
          '</div>';
      }
      h += '</div></div>';
    }
    $('tripDays').innerHTML = h;
    if (locked) disableInside($('tripDays'));
  }

  /* ---------- 5. 여행 회화 ---------- */
  function renderPhrases() {
    var h = '';
    state.phrases.forEach(function (ph, i) {
      var base = 'phrases.' + i;
      h += '<div class="phrase">' +
        '<div class="phrase-head">문장 ' + (i + 1) + (i === 4 ? ' <em>선택</em>' : '') + '</div>' +
        '<div class="phrase-grid">' +
        '<label class="field"><span>원어</span>' + input(base + '.orig', ph.orig, L.orig, '그 나라 말로') + '</label>' +
        '<label class="field"><span>한국어 발음</span>' + input(base + '.pron', ph.pron, L.pron, '소리 나는 대로') + '</label>' +
        '<label class="field"><span>뜻</span>' + input(base + '.mean', ph.mean, L.mean, '우리말 뜻') + '</label>' +
        '<label class="field"><span>쓰는 상황</span>' + input(base + '.situ', ph.situ, L.situ, '언제 쓰나요?') + '</label>' +
        '</div></div>';
    });
    $('phraseList').innerHTML = h;
  }

  /* ---------- 6. 다른 문화 ---------- */
  function renderDiffs() {
    var h = '';
    state.diffs.forEach(function (t, i) {
      h += '<label class="field field-row"><span class="num-dot">' + (i + 1) + '</span>' +
        input('diffs.' + i, t, L.diff, '우리나라와 어떻게 다른가요?') + '</label>';
    });
    $('diffList').innerHTML = h;
  }

  /* ---------- 7. 느낀 점 ---------- */
  function renderFeeling() {
    var ta = $('feeling');
    ta.maxLength = L.feeling;
    ta.value = state.feeling;
    updateCounter();
  }

  function updateCounter() {
    $('feelingCount').textContent = state.feeling.length + ' / ' + L.feeling;
  }

  /* ---------- 진행률 ---------- */
  function updateProgress() {
    var p = Common.progress(state);
    $('progressFill').style.width = p + '%';
    $('progressText').textContent = p + '%';
  }

  /* ---------- 저장 상태 ---------- */
  function markDirty() {
    if (locked) return;
    dirty = true;
    setSaveState('dirty');
  }

  function setSaveState(kind, when) {
    var el = $('saveState');
    el.className = 'save-state ' + kind;
    if (kind === 'saved') el.textContent = '저장됨 ' + shortTime(when);
    else if (kind === 'dirty') el.textContent = '저장하지 않은 내용이 있어요';
    else if (kind === 'never') el.textContent = '아직 저장하지 않았어요';
    else if (kind === 'locked') el.textContent = '수정 마감';
  }

  function shortTime(s) {
    // '2026-09-29 14:05' → '9/29 14:05'
    var m = String(s || '').match(/^\d{4}-(\d{2})-(\d{2}) (\d{2}:\d{2})/);
    return m ? Number(m[1]) + '/' + Number(m[2]) + ' ' + m[3] : String(s || '');
  }

  async function save() {
    if (locked || saving) return;
    saving = true;
    var btn = $('saveBtn');
    Common.setBusy(btn, true, '저장 중');
    try {
      var res = await Api.call('save', { cls: cred.cls, num: cred.num, pw: cred.pw, data: state });
      if (res.counts) counts = res.counts;
      if (res.ok) {
        dirty = false;
        setSaveState('saved', res.savedAt);
        Common.toast('저장했어요', 'ok');
        renderCountry();
      } else {
        if (res.locked) { applyLock(true); }
        if (res.counts) renderCountry();
        Common.toast(res.msg || '저장하지 못했어요. 다시 눌러 주세요.', 'error');
      }
    } catch (e) {
      Common.toast('인터넷 연결을 확인하고 다시 저장해 주세요.', 'error');
    } finally {
      saving = false;
      Common.setBusy(btn, false);
    }
  }

  /* ---------- 수정 마감 ---------- */
  function disableInside(root) {
    root.querySelectorAll('input, select, textarea').forEach(function (x) { x.disabled = true; });
  }

  function applyLock(on) {
    locked = on;
    $('lockBanner').hidden = !on;
    $('saveBtn').hidden = on;
    if (on) {
      disableInside($('formRoot'));
      dirty = false;
      setSaveState('locked');
    }
  }

  /* ---------- 미리보기 ---------- */
  function openPreview() {
    $('previewOverlay').hidden = false;
    document.body.classList.add('no-scroll');
    Poster.showIn($('previewBox'), cred, state);
  }

  function closePreview() {
    $('previewOverlay').hidden = true;
    document.body.classList.remove('no-scroll');
  }

  /* ---------- 이벤트 (한 번만 연결) ---------- */
  var bound = false;
  function bindOnce() {
    if (bound) return;
    bound = true;

    $('formRoot').addEventListener('input', function (e) {
      var k = e.target.dataset && e.target.dataset.k;
      if (!k || locked) return;
      setPath(state, k, e.target.value);
      if (k === 'feeling') updateCounter();
      markDirty();
      updateProgress();
    });

    $('country').addEventListener('change', onCountryChange);

    $('tripDaysSel').addEventListener('change', function (e) {
      state.trip.days = parseInt(e.target.value, 10) || 4;
      renderTrip();
      markDirty();
      updateProgress();
    });

    $('saveBtn').addEventListener('click', save);
    $('previewBtn').addEventListener('click', openPreview);
    $('previewClose').addEventListener('click', closePreview);
    window.addEventListener('resize', function () {
      if (!$('previewOverlay').hidden) Poster.fit($('previewBox'));
    });

    window.addEventListener('beforeunload', function (e) {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  function isDirty() { return dirty; }
  function discard() { dirty = false; }

  return { start: start, isDirty: isDirty, discard: discard };
})();
