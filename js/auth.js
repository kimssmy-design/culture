/* =========================================================
 * 학생 로그인 — 반·번호·비밀번호, 처음이면 이름 확인 후 비밀번호 만들기
 * ========================================================= */
var Auth = (function () {
  function $(id) { return document.getElementById(id); }

  function showMsg(text) { $('loginMsg').textContent = text || ''; }

  function fillClasses() {
    $('loginCls').innerHTML = CONFIG.CLASSES.map(function (c) {
      return '<option value="' + c.cls + '">' + c.cls + '반</option>';
    }).join('');
    fillNums();
  }

  function fillNums() {
    var cls = $('loginCls').value;
    var info = CONFIG.CLASSES.filter(function (c) { return c.cls === cls; })[0];
    var h = '';
    for (var n = 1; n <= (info ? info.count : 0); n++) h += '<option value="' + n + '">' + n + '번</option>';
    $('loginNum').innerHTML = h;
  }

  function showSetup(on) {
    $('loginForm').hidden = on;
    $('setupForm').hidden = !on;
    showMsg('');
    if (on) {
      $('setupWho').textContent = $('loginCls').value + '반 ' + $('loginNum').value + '번';
      $('setupName').focus();
    }
  }

  function enter(cls, num, pw, res) {
    $('loginView').hidden = true;
    $('editView').hidden = false;
    window.scrollTo(0, 0);
    Form.start({ grade: res.grade || CONFIG.GRADE, cls: cls, num: num, pw: pw, name: res.name }, res);
  }

  async function login() {
    var cls = $('loginCls').value;
    var num = $('loginNum').value;
    var pw = $('loginPw').value;
    var btn = $('loginBtn');
    showMsg('');
    Common.setBusy(btn, true, '확인 중');
    try {
      var res = await Api.call('login', { cls: cls, num: num, pw: pw });
      if (res.ok) {
        enter(cls, num, pw, res);
      } else if (res.status === 'no_pw') {
        showSetup(true);
      } else {
        showMsg(res.msg || '들어가지 못했어요.');
      }
    } catch (e) {
      showMsg('연결이 원활하지 않아요. 잠시 후 다시 눌러 주세요.');
    } finally {
      Common.setBusy(btn, false);
    }
  }

  async function setup() {
    var cls = $('loginCls').value;
    var num = $('loginNum').value;
    var name = $('setupName').value.trim();
    var pw = $('setupPw').value;
    var pw2 = $('setupPw2').value;

    if (!name) return showMsg('이름을 적어 주세요.');
    if (pw.length < 4) return showMsg('비밀번호는 4자 이상으로 만들어 주세요.');
    if (pw !== pw2) return showMsg('두 비밀번호가 서로 달라요.');

    var btn = $('setupBtn');
    showMsg('');
    Common.setBusy(btn, true, '만드는 중');
    try {
      var res = await Api.call('setpw', { cls: cls, num: num, name: name, pw: pw });
      if (res.ok) enter(cls, num, pw, res);
      else showMsg(res.msg || '비밀번호를 만들지 못했어요.');
    } catch (e) {
      showMsg('연결이 원활하지 않아요. 잠시 후 다시 눌러 주세요.');
    } finally {
      Common.setBusy(btn, false);
    }
  }

  function logout() {
    if (Form.isDirty() && !confirm('저장하지 않은 내용이 있어요. 그래도 나갈까요?')) return;
    // 새로고침으로 기억하던 비밀번호까지 모두 지움
    Form.discard();
    location.replace(location.pathname);
  }

  function init() {
    fillClasses();
    $('loginCls').addEventListener('change', fillNums);
    $('loginBtn').addEventListener('click', login);
    $('loginPw').addEventListener('keydown', function (e) { if (e.key === 'Enter') login(); });
    $('setupBtn').addEventListener('click', setup);
    $('setupPw2').addEventListener('keydown', function (e) { if (e.key === 'Enter') setup(); });
    $('setupBack').addEventListener('click', function () { showSetup(false); });
    $('logoutBtn').addEventListener('click', logout);

    if (!Api.isConfigured()) {
      showMsg('아직 준비 중이에요. (config.js에 GAS 주소가 없어요) 선생님께 알려 주세요.');
      $('loginBtn').disabled = true;
      return;
    }
    Api.warmup();
  }

  return { init: init };
})();

document.addEventListener('DOMContentLoaded', Auth.init);
