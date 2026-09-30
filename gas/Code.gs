/**
 * 세계 문화 탐구 포스터 (다문화 수행평가) — GAS 백엔드
 *
 * 시트 3개를 씁니다.
 *  - 학생명단 : 반 | 번호 | 이름 | 비밀번호(암호화)
 *  - 작성데이터 : 학생 1명당 1줄 (저장할 때마다 덮어씀)
 *  - 설정 : 교사비밀번호, 반별 수정금지 여부
 *
 * 처음 한 번은 편집기에서 setupSheets 함수를 직접 실행하세요.
 *
 * [안정화 규칙]
 *  - var 사용 (const/let 사용 안 함)
 *  - 함수 매개변수 구조분해 사용 안 함 (params.xxx 로 꺼냄)
 *  - LockService.getScriptLock() 사용
 *  - 저장 전 setNumberFormat('@') 로 텍스트 서식 고정 (앞자리 0 보존)
 */

var SHEET_ROSTER = '학생명단';
var SHEET_DATA = '작성데이터';
var SHEET_SETTING = '설정';

var GRADE = 2;
var CLASS_LIST = ['1', '2', '3', '4'];
var CLASS_SIZES = { '1': 25, '2': 25, '3': 24, '4': 24 };
var MAX_PER_COUNTRY = 2;
var DEFAULT_TEACHER_PW = '여기에교사비밀번호';
var MAX_JSON_LENGTH = 30000;
var TRIP_LABELS = { '2': '1박 2일', '3': '2박 3일', '4': '3박 4일' };

var DATA_HEADERS = [
  '반', '번호', '이름', '나라', '마지막 저장',
  '수도', '위치', '인구', '면적', '언어', '종교', '화폐', '국화',
  '음식', '음식 소개', '전통의상', '전통의상 소개',
  '여행 기간', '여행 코스', '여행 회화', '우리나라와 다른 문화', '느낀 점',
  '원본(JSON)'
];
var COL_COUNTRY = 4;   // 1부터 세는 열 번호
var COL_SAVED = 5;
var COL_JSON = DATA_HEADERS.length;

/* =========================================================
 * 처음 한 번 실행: 시트 자동 생성
 * ========================================================= */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1) 학생명단
  var roster = ss.getSheetByName(SHEET_ROSTER);
  if (!roster) {
    roster = ss.insertSheet(SHEET_ROSTER);
    var rows = [['반', '번호', '이름', '비밀번호(암호화)']];
    for (var c = 0; c < CLASS_LIST.length; c++) {
      var cls = CLASS_LIST[c];
      for (var n = 1; n <= CLASS_SIZES[cls]; n++) {
        rows.push([cls, String(n), '', '']);
      }
    }
    roster.getRange(1, 1, roster.getMaxRows(), 4).setNumberFormat('@');
    roster.getRange(1, 1, rows.length, 4).setValues(rows);
    roster.setFrozenRows(1);
  }

  // 2) 작성데이터
  getDataSheet_();

  // 3) 설정
  var setting = ss.getSheetByName(SHEET_SETTING);
  if (!setting) {
    setting = ss.insertSheet(SHEET_SETTING);
    var srows = [['항목', '값'], ['교사비밀번호', DEFAULT_TEACHER_PW]];
    for (var k = 0; k < CLASS_LIST.length; k++) {
      srows.push(['수정금지_' + CLASS_LIST[k] + '반', 'FALSE']);
    }
    setting.getRange(1, 1, setting.getMaxRows(), 2).setNumberFormat('@');
    setting.getRange(1, 1, srows.length, 2).setValues(srows);
    setting.setFrozenRows(1);
  }

  Logger.log('시트 준비 완료. 학생명단에 이름을 넣고, 설정 시트에서 교사 비밀번호를 바꿔 주세요.');
}

/* =========================================================
 * 라우터
 * ========================================================= */
function doGet(e) {
  return json_({ ok: true, msg: 'running' });
}

function doPost(e) {
  var params = {};
  try { params = JSON.parse(e.postData.contents); } catch (err) { params = {}; }
  var action = (e && e.parameter && e.parameter.action) || params.action;
  var result;

  try {
    if (action === 'login') result = handleLogin(params);
    else if (action === 'setpw') result = handleSetPw(params);
    else if (action === 'save') result = handleSave(params);
    else if (action === 'countries') result = handleCountries(params);
    else if (action === 'tload') result = handleTeacherLoad(params);
    else if (action === 'tlock') result = handleTeacherLock(params);
    else if (action === 'tresetpw') result = handleTeacherResetPw(params);
    else result = { ok: false, msg: '알 수 없는 요청이에요.' };
  } catch (err) {
    result = { ok: false, msg: '서버 오류: ' + err.message };
  }
  return json_(result);
}

/* =========================================================
 * 학생: 로그인 / 비밀번호 설정
 * ========================================================= */
function handleLogin(params) {
  var cls = numKey_(params.cls);
  var num = numKey_(params.num);
  var pw = String(params.pw == null ? '' : params.pw);

  var found = findStudent_(cls, num);
  if (!found.ok) return found;
  if (!found.hash) return { ok: false, status: 'no_pw' };
  if (found.hash !== hashPw_(cls, num, pw)) {
    return { ok: false, msg: '비밀번호가 맞지 않아요. 잊어버렸다면 선생님께 말씀드려요.' };
  }
  return studentPayload_(cls, num, found.name);
}

function handleSetPw(params) {
  var cls = numKey_(params.cls);
  var num = numKey_(params.num);
  var name = norm_(params.name);
  var pw = String(params.pw == null ? '' : params.pw);

  if (pw.length < 4) return { ok: false, msg: '비밀번호는 4자 이상으로 만들어 주세요.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); }
  catch (e) { return { ok: false, msg: '잠시 후 다시 시도해 주세요. (서버 혼잡)' }; }

  try {
    var found = findStudent_(cls, num);
    if (!found.ok) return found;
    if (found.hash) return { ok: false, msg: '이미 비밀번호가 있어요. 처음 화면에서 비밀번호로 들어가 주세요.' };
    if (removeSpaces_(found.name) !== removeSpaces_(name)) {
      return { ok: false, msg: '이름이 명단과 달라요. 반, 번호, 이름을 다시 확인해 주세요.' };
    }
    found.sheet.getRange(found.row, 4).setNumberFormat('@').setValue(hashPw_(cls, num, pw));
    SpreadsheetApp.flush();
    return studentPayload_(cls, num, found.name);
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
 * 학생: 저장 / 나라 현황
 * ========================================================= */
function handleSave(params) {
  var auth = authStudent_(params);
  if (!auth.ok) return auth;

  var d = params.data;
  if (!d || typeof d !== 'object') return { ok: false, msg: '저장할 내용이 없어요.' };
  var jsonText = JSON.stringify(d);
  if (jsonText.length > MAX_JSON_LENGTH) return { ok: false, msg: '내용이 너무 길어요. 조금 줄여 주세요.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); }
  catch (e) { return { ok: false, msg: '지금 많은 친구들이 동시에 저장하고 있어요. 잠시 후 다시 눌러 주세요.' }; }

  try {
    var settings = readSettings_();
    if (isLocked_(settings, auth.cls)) {
      return { ok: false, locked: true, msg: '선생님이 수정을 마감해서 더 이상 저장할 수 없어요.' };
    }

    var sh = getDataSheet_();
    var rows = sh.getDataRange().getValues();
    var country = norm_(d.country);
    var targetIndex = -1;
    var counts = {};

    for (var i = 1; i < rows.length; i++) {
      if (numKey_(rows[i][0]) !== auth.cls) continue;
      if (numKey_(rows[i][1]) === auth.num) { targetIndex = i; continue; }
      var ct = norm_(rows[i][COL_COUNTRY - 1]);
      if (ct) counts[ct] = (counts[ct] || 0) + 1;
    }

    if (country && (counts[country] || 0) >= MAX_PER_COUNTRY) {
      return {
        ok: false,
        counts: counts,
        msg: country + '은(는) 이미 ' + MAX_PER_COUNTRY + '명이 조사하고 있어요. 다른 나라를 골라 주세요.'
      };
    }

    var savedAt = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
    var row = buildRow_(auth.cls, auth.num, auth.name, savedAt, d, jsonText);
    var rowNumber = targetIndex > 0 ? targetIndex + 1 : sh.getLastRow() + 1;
    sh.getRange(rowNumber, 1, 1, row.length).setNumberFormat('@').setValues([row]);
    SpreadsheetApp.flush();

    return { ok: true, savedAt: savedAt, counts: counts };
  } finally {
    lock.releaseLock();
  }
}

function handleCountries(params) {
  var cls = numKey_(params.cls);
  var num = numKey_(params.num);
  return { ok: true, counts: countryCounts_(cls, num), maxPerCountry: MAX_PER_COUNTRY };
}

/* =========================================================
 * 교사
 * ========================================================= */
function handleTeacherLoad(params) {
  var t = checkTeacher_(params);
  if (!t.ok) return t;

  var classes = {};
  for (var c = 0; c < CLASS_LIST.length; c++) {
    classes[CLASS_LIST[c]] = { cls: CLASS_LIST[c], locked: isLocked_(t.settings, CLASS_LIST[c]), students: [] };
  }

  var roster = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ROSTER);
  if (!roster) return { ok: false, msg: '학생명단 시트가 없어요. setupSheets를 먼저 실행해 주세요.' };
  var rrows = roster.getDataRange().getValues();
  var index = {};
  for (var i = 1; i < rrows.length; i++) {
    var cls = numKey_(rrows[i][0]);
    var num = numKey_(rrows[i][1]);
    if (!classes[cls] || !num) continue;
    var st = { num: num, name: norm_(rrows[i][2]), hasPw: !!norm_(rrows[i][3]), savedAt: '', data: null };
    classes[cls].students.push(st);
    index[cls + '-' + num] = st;
  }

  var drows = getDataSheet_().getDataRange().getValues();
  for (var j = 1; j < drows.length; j++) {
    var key = numKey_(drows[j][0]) + '-' + numKey_(drows[j][1]);
    if (!index[key]) continue;
    index[key].savedAt = norm_(drows[j][COL_SAVED - 1]);
    index[key].data = parseJson_(drows[j][COL_JSON - 1]);
  }

  var list = [];
  for (var k = 0; k < CLASS_LIST.length; k++) {
    var item = classes[CLASS_LIST[k]];
    item.students.sort(function (a, b) { return Number(a.num) - Number(b.num); });
    list.push(item);
  }
  return { ok: true, grade: GRADE, maxPerCountry: MAX_PER_COUNTRY, classes: list };
}

function handleTeacherLock(params) {
  var t = checkTeacher_(params);
  if (!t.ok) return t;
  var cls = numKey_(params.cls);
  if (CLASS_LIST.indexOf(cls) < 0) return { ok: false, msg: '반 정보가 올바르지 않아요.' };
  var locked = params.locked === true || params.locked === 'true';

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); }
  catch (e) { return { ok: false, msg: '잠시 후 다시 시도해 주세요.' }; }
  try {
    writeSetting_('수정금지_' + cls + '반', locked ? 'TRUE' : 'FALSE');
    SpreadsheetApp.flush();
    return { ok: true, cls: cls, locked: locked };
  } finally {
    lock.releaseLock();
  }
}

function handleTeacherResetPw(params) {
  var t = checkTeacher_(params);
  if (!t.ok) return t;
  var cls = numKey_(params.cls);
  var num = numKey_(params.num);

  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); }
  catch (e) { return { ok: false, msg: '잠시 후 다시 시도해 주세요.' }; }
  try {
    var found = findStudent_(cls, num);
    if (!found.ok) return found;
    found.sheet.getRange(found.row, 4).setNumberFormat('@').setValue('');
    SpreadsheetApp.flush();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
 * 내부 도구
 * ========================================================= */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function norm_(v) {
  return String(v == null ? '' : v).trim();
}

// '1반', 1, ' 01 ' 모두 '1'로 맞춤
function numKey_(v) {
  var digits = String(v == null ? '' : v).replace(/[^0-9]/g, '');
  return digits ? String(Number(digits)) : '';
}

function removeSpaces_(s) {
  return String(s == null ? '' : s).replace(/\s+/g, '');
}

function hashPw_(cls, num, pw) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    'mc-poster|' + cls + '|' + num + '|' + pw,
    Utilities.Charset.UTF_8
  );
  var hex = '';
  for (var i = 0; i < raw.length; i++) {
    var b = (raw[i] + 256) % 256;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

function findStudent_(cls, num) {
  if (!cls || !num) return { ok: false, msg: '반과 번호를 골라 주세요.' };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ROSTER);
  if (!sheet) return { ok: false, msg: '학생명단 시트가 없어요. 선생님께 알려 주세요.' };
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (numKey_(rows[i][0]) === cls && numKey_(rows[i][1]) === num) {
      var name = norm_(rows[i][2]);
      if (!name) return { ok: false, msg: '명단에 이름이 아직 없어요. 선생님께 말씀드려 주세요.' };
      return { ok: true, sheet: sheet, row: i + 1, name: name, hash: norm_(rows[i][3]) };
    }
  }
  return { ok: false, msg: '명단에 없는 번호예요. 선생님께 확인해 주세요.' };
}

function authStudent_(params) {
  var cls = numKey_(params.cls);
  var num = numKey_(params.num);
  var pw = String(params.pw == null ? '' : params.pw);
  var found = findStudent_(cls, num);
  if (!found.ok) return found;
  if (!found.hash || found.hash !== hashPw_(cls, num, pw)) {
    return { ok: false, relogin: true, msg: '로그인 정보가 맞지 않아요. 나갔다가 다시 들어와 주세요.' };
  }
  return { ok: true, cls: cls, num: num, name: found.name };
}

function studentPayload_(cls, num, name) {
  var settings = readSettings_();
  var rows = getDataSheet_().getDataRange().getValues();
  var data = null;
  var savedAt = '';
  var counts = {};
  for (var i = 1; i < rows.length; i++) {
    if (numKey_(rows[i][0]) !== cls) continue;
    if (numKey_(rows[i][1]) === num) {
      data = parseJson_(rows[i][COL_JSON - 1]);
      savedAt = norm_(rows[i][COL_SAVED - 1]);
    } else {
      var ct = norm_(rows[i][COL_COUNTRY - 1]);
      if (ct) counts[ct] = (counts[ct] || 0) + 1;
    }
  }
  return {
    ok: true,
    grade: GRADE,
    name: name,
    data: data,
    savedAt: savedAt,
    locked: isLocked_(settings, cls),
    counts: counts,
    maxPerCountry: MAX_PER_COUNTRY
  };
}

function countryCounts_(cls, num) {
  var rows = getDataSheet_().getDataRange().getValues();
  var counts = {};
  for (var i = 1; i < rows.length; i++) {
    if (numKey_(rows[i][0]) !== cls) continue;
    if (numKey_(rows[i][1]) === num) continue;
    var ct = norm_(rows[i][COL_COUNTRY - 1]);
    if (ct) counts[ct] = (counts[ct] || 0) + 1;
  }
  return counts;
}

function getDataSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_DATA);
  if (!sh) {
    sh = ss.insertSheet(SHEET_DATA);
    sh.getRange(1, 1, sh.getMaxRows(), DATA_HEADERS.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, DATA_HEADERS.length).setValues([DATA_HEADERS]);
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, DATA_HEADERS.length).setNumberFormat('@').setValues([DATA_HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readSettings_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTING);
  var map = {};
  if (!sh) return map;
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    map[norm_(rows[i][0])] = norm_(rows[i][1]);
  }
  return map;
}

function writeSetting_(key, value) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_SETTING);
  if (!sh) {
    sh = ss.insertSheet(SHEET_SETTING);
    sh.getRange(1, 1, 1, 2).setNumberFormat('@').setValues([['항목', '값']]);
  }
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (norm_(rows[i][0]) === key) {
      sh.getRange(i + 1, 2).setNumberFormat('@').setValue(String(value));
      return;
    }
  }
  sh.getRange(sh.getLastRow() + 1, 1, 1, 2).setNumberFormat('@').setValues([[key, String(value)]]);
}

function isLocked_(settings, cls) {
  return String(settings['수정금지_' + cls + '반'] || '').toUpperCase() === 'TRUE';
}

function checkTeacher_(params) {
  var settings = readSettings_();
  var tp = settings['교사비밀번호'];
  if (!tp || tp === DEFAULT_TEACHER_PW) {
    return { ok: false, msg: '설정 시트에서 교사 비밀번호를 먼저 바꿔 주세요.' };
  }
  if (norm_(params.tpw) !== tp) return { ok: false, msg: '교사 비밀번호가 맞지 않아요.' };
  return { ok: true, settings: settings };
}

function parseJson_(v) {
  var s = norm_(v);
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

// '='로 시작하면 수식으로 바뀌지 않도록 막음
function safeCell_(v) {
  var s = String(v == null ? '' : v);
  if (s.charAt(0) === '=') s = "'" + s;
  return s;
}

function buildRow_(cls, num, name, savedAt, d, jsonText) {
  var b = d.basic || {};
  var food = d.food || {};
  var costume = d.costume || {};
  var trip = d.trip || {};

  var days = parseInt(trip.days, 10);
  if (!(days >= 2 && days <= 4)) days = 4;
  var plan = Array.isArray(trip.plan) ? trip.plan : [];
  var tripLines = [];
  for (var i = 0; i < days; i++) {
    var slots = Array.isArray(plan[i]) ? plan[i] : [];
    var parts = [];
    for (var j = 0; j < slots.length && j < 3; j++) {
      var s = slots[j] || {};
      var place = norm_(s.place);
      if (!place) continue;
      var desc = norm_(s.desc);
      parts.push(desc ? place + '(' + desc + ')' : place);
    }
    tripLines.push((i + 1) + '일차: ' + parts.join(' → '));
  }

  var phrases = Array.isArray(d.phrases) ? d.phrases : [];
  var phraseLines = [];
  for (var p = 0; p < phrases.length && p < 5; p++) {
    var ph = phrases[p] || {};
    var orig = norm_(ph.orig);
    var pron = norm_(ph.pron);
    if (!orig && !pron) continue;
    phraseLines.push(orig + ' [' + pron + '] ' + norm_(ph.mean) + ' - ' + norm_(ph.situ));
  }

  var diffs = Array.isArray(d.diffs) ? d.diffs : [];
  var diffLines = [];
  for (var q = 0; q < diffs.length && q < 3; q++) {
    if (norm_(diffs[q])) diffLines.push((q + 1) + '. ' + norm_(diffs[q]));
  }

  var row = [
    cls, num, name, norm_(d.country), savedAt,
    norm_(b.capital), norm_(b.location), norm_(b.population), norm_(b.area),
    norm_(b.language), norm_(b.religion), norm_(b.currency), norm_(b.flower),
    norm_(food.name), norm_(food.intro), norm_(costume.name), norm_(costume.intro),
    TRIP_LABELS[String(days)], tripLines.join('\n'), phraseLines.join('\n'),
    diffLines.join('\n'), norm_(d.feeling),
    jsonText
  ];
  for (var r = 0; r < row.length; r++) row[r] = safeCell_(row[r]);
  return row;
}

/* =========================================================
 * 편집기에서 직접 돌려보는 테스트
 * (실행 후 작성데이터 시트에 생긴 테스트 줄은 지워 주세요)
 * ========================================================= */
function testLogin() {
  Logger.log(JSON.stringify(handleLogin({ cls: '1', num: '1', pw: '0123' })));
}
function testSetPw() {
  Logger.log(JSON.stringify(handleSetPw({ cls: '1', num: '1', name: '홍길동', pw: '0123' })));
}
