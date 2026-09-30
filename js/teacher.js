/* =========================================================
 * 교사 대시보드 — 반별 현황, 포스터 보기·인쇄, 수정금지, 비밀번호 초기화
 * ========================================================= */
var Teacher = (function () {
  var esc = Common.esc;
  var tpw = '';
  var grade = CONFIG.GRADE;
  var classes = [];
  var current = null;

  function $(id) { return document.getElementById(id); }

  function getClass(cls) {
    return classes.filter(function (c) { return c.cls === cls; })[0];
  }

  function infoOf(cls, st) {
    return { grade: grade, cls: cls, num: st.num, name: st.name };
  }

  /* ---------- 로그인·불러오기 ---------- */
  async function load(btn) {
    Common.setBusy(btn, true, '불러오는 중');
    try {
      var res = await Api.call('tload', { tpw: tpw });
      if (!res.ok) {
        if (!$('dashView').hidden) Common.toast(res.msg, 'error');
        else $('tLoginMsg').textContent = res.msg;
        return false;
      }
      grade = res.grade || grade;
      classes = res.classes || [];
      if (!current || !getClass(current)) current = classes.length ? classes[0].cls : null;
      $('tLoginView').hidden = true;
      $('dashView').hidden = false;
      renderTabs();
      renderClass();
      return true;
    } catch (e) {
      var msg = '연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.';
      if (!$('dashView').hidden) Common.toast(msg, 'error'); else $('tLoginMsg').textContent = msg;
      return false;
    } finally {
      Common.setBusy(btn, false);
    }
  }

  function login() {
    tpw = $('tPw').value.trim();
    $('tLoginMsg').textContent = '';
    if (!tpw) { $('tLoginMsg').textContent = '교사 비밀번호를 적어 주세요.'; return; }
    load($('tLoginBtn'));
  }

  /* ---------- 반 탭 ---------- */
  function renderTabs() {
    $('classTabs').innerHTML = classes.map(function (c) {
      var started = c.students.filter(function (s) { return s.data; }).length;
      return '<button role="tab" data-cls="' + c.cls + '" aria-selected="' + (c.cls === current) + '">' +
        c.cls + '반 <small>' + started + '/' + c.students.length + '</small>' +
        (c.locked ? ' <i aria-label="수정금지">잠금</i>' : '') + '</button>';
    }).join('');
  }

  /* ---------- 반 화면 ---------- */
  function renderClass() {
    var c = getClass(current);
    if (!c) { $('classPanel').innerHTML = ''; return; }

    var withData = c.students.filter(function (s) { return s.data; });
    var avg = withData.length
      ? Math.round(withData.reduce(function (sum, s) { return sum + Common.progress(s.data); }, 0) / withData.length)
      : 0;

    // 나라별 선택 현황
    var byCountry = {};
    withData.forEach(function (s) {
      var ct = (s.data.country || '').trim();
      if (!ct) return;
      (byCountry[ct] = byCountry[ct] || []).push(s.name);
    });
    var countryHtml = Object.keys(byCountry).sort().map(function (ct) {
      return '<li><b>' + esc(ct) + '</b> ' + esc(byCountry[ct].join(', ')) + '</li>';
    }).join('') || '<li class="muted">아직 나라를 고른 학생이 없어요.</li>';

    var h = '';
    h += '<div class="class-head">' +
      '<h2>' + esc(grade) + '학년 ' + esc(c.cls) + '반</h2>' +
      '<span class="badge ' + (c.locked ? 'badge-lock' : 'badge-open') + '">' + (c.locked ? '수정 마감됨' : '작성 가능') + '</span>' +
      '<div class="class-actions">' +
      '<button data-act="lock" class="' + (c.locked ? '' : 'btn-danger') + '">' + (c.locked ? '수정금지 풀기' : '수정금지 걸기') + '</button>' +
      '<button data-act="printAll" class="btn-primary">이 반 포스터 모두 인쇄</button>' +
      '</div></div>';

    h += '<div class="stats">' +
      '<div class="stat"><span>작성 시작</span><b>' + withData.length + ' / ' + c.students.length + '명</b></div>' +
      '<div class="stat"><span>평균 진행률</span><b>' + avg + '%</b></div>' +
      '<div class="stat"><span>접속 전</span><b>' + c.students.filter(function (s) { return !s.hasPw; }).length + '명</b></div>' +
      '</div>';

    h += '<details class="country-box"><summary>나라별 선택 현황</summary><ul>' + countryHtml + '</ul></details>';

    h += '<div class="table-wrap"><table><thead><tr>' +
      '<th>번호</th><th>이름</th><th>나라</th><th>진행률</th><th>마지막 저장</th><th></th>' +
      '</tr></thead><tbody>';
    c.students.forEach(function (s) {
      var status;
      if (s.data) {
        var p = Common.progress(s.data);
        status = '<div class="mini-bar"><div style="width:' + p + '%"></div></div><span class="pct">' + p + '%</span>';
      } else if (s.hasPw) {
        status = '<span class="muted">작성 전</span>';
      } else {
        status = '<span class="muted">접속 전</span>';
      }
      h += '<tr>' +
        '<td>' + esc(s.num) + '</td>' +
        '<td>' + (s.name ? esc(s.name) : '<span class="muted">명단에 이름 없음</span>') + '</td>' +
        '<td>' + esc(s.data && s.data.country ? s.data.country : '') + '</td>' +
        '<td><div class="status">' + status + '</div></td>' +
        '<td class="muted">' + esc(s.savedAt) + '</td>' +
        '<td><div class="row-actions">' +
        (s.data ? '<button data-act="view" data-num="' + s.num + '">보기</button>' +
          '<button data-act="printOne" data-num="' + s.num + '">인쇄</button>' : '') +
        (s.hasPw ? '<button data-act="reset" data-num="' + s.num + '" class="btn-quiet">비밀번호 초기화</button>' : '') +
        '</div></td></tr>';
    });
    h += '</tbody></table></div>';

    $('classPanel').innerHTML = h;
  }

  /* ---------- 동작 ---------- */
  async function toggleLock(btn) {
    var c = getClass(current);
    var next = !c.locked;
    var q = next
      ? c.cls + '반 학생들이 더 이상 고칠 수 없게 할까요?'
      : c.cls + '반 수정금지를 풀까요? 학생들이 다시 고칠 수 있어요.';
    if (!confirm(q)) return;
    Common.setBusy(btn, true, '바꾸는 중');
    try {
      var res = await Api.call('tlock', { tpw: tpw, cls: c.cls, locked: next });
      if (res.ok) {
        c.locked = res.locked;
        Common.toast(c.cls + '반 ' + (c.locked ? '수정금지를 걸었어요' : '수정금지를 풀었어요'), 'ok');
        renderTabs();
        renderClass();
      } else {
        Common.toast(res.msg, 'error');
        Common.setBusy(btn, false);
      }
    } catch (e) {
      Common.toast('연결이 원활하지 않아요.', 'error');
      Common.setBusy(btn, false);
    }
  }

  async function resetPw(btn, num) {
    var c = getClass(current);
    var st = c.students.filter(function (s) { return s.num === num; })[0];
    if (!confirm(c.cls + '반 ' + num + '번 ' + st.name + ' 학생의 비밀번호를 초기화할까요?\n학생은 다음에 들어올 때 새 비밀번호를 만들어요. (작성한 내용은 그대로 있어요)')) return;
    Common.setBusy(btn, true, '초기화 중');
    try {
      var res = await Api.call('tresetpw', { tpw: tpw, cls: c.cls, num: num });
      if (res.ok) {
        st.hasPw = false;
        Common.toast(st.name + ' 학생 비밀번호를 초기화했어요', 'ok');
        renderClass();
      } else {
        Common.toast(res.msg, 'error');
        Common.setBusy(btn, false);
      }
    } catch (e) {
      Common.toast('연결이 원활하지 않아요.', 'error');
      Common.setBusy(btn, false);
    }
  }

  function viewOne(num) {
    var c = getClass(current);
    var st = c.students.filter(function (s) { return s.num === num; })[0];
    $('tPreviewTitle').textContent = c.cls + '반 ' + st.num + '번 ' + st.name;
    $('tPreviewPrint').dataset.num = num;
    $('previewOverlay').hidden = false;
    document.body.classList.add('no-scroll');
    Poster.showIn($('previewBox'), infoOf(c.cls, st), st.data);
  }

  function printOne(num) {
    var c = getClass(current);
    var st = c.students.filter(function (s) { return s.num === num; })[0];
    Poster.print([{ info: infoOf(c.cls, st), data: st.data }]);
  }

  function printAll() {
    var c = getClass(current);
    var items = c.students.filter(function (s) { return s.data; })
      .map(function (s) { return { info: infoOf(c.cls, s), data: s.data }; });
    if (!items.length) { Common.toast('인쇄할 포스터가 아직 없어요.', 'error'); return; }
    if (!confirm(c.cls + '반 포스터 ' + items.length + '장을 인쇄할까요?')) return;
    Poster.print(items);
  }

  function closePreview() {
    $('previewOverlay').hidden = true;
    document.body.classList.remove('no-scroll');
  }

  /* ---------- 시작 ---------- */
  function init() {
    if (!Api.isConfigured()) {
      $('tLoginMsg').textContent = 'config.js에 GAS 주소가 아직 없어요.';
      $('tLoginBtn').disabled = true;
      return;
    }
    Api.warmup();

    $('tLoginBtn').addEventListener('click', login);
    $('tPw').addEventListener('keydown', function (e) { if (e.key === 'Enter') login(); });
    $('refreshBtn').addEventListener('click', function (e) { load(e.currentTarget); });
    $('tLogoutBtn').addEventListener('click', function () { location.replace(location.pathname); });

    $('classTabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-cls]');
      if (!b) return;
      current = b.dataset.cls;
      renderTabs();
      renderClass();
    });

    $('classPanel').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]');
      if (!b) return;
      var act = b.dataset.act;
      if (act === 'lock') toggleLock(b);
      else if (act === 'printAll') printAll();
      else if (act === 'view') viewOne(b.dataset.num);
      else if (act === 'printOne') printOne(b.dataset.num);
      else if (act === 'reset') resetPw(b, b.dataset.num);
    });

    $('previewClose').addEventListener('click', closePreview);
    $('tPreviewPrint').addEventListener('click', function (e) { printOne(e.currentTarget.dataset.num); });
    window.addEventListener('resize', function () {
      if (!$('previewOverlay').hidden) Poster.fit($('previewBox'));
    });
  }

  return { init: init };
})();

document.addEventListener('DOMContentLoaded', Teacher.init);
