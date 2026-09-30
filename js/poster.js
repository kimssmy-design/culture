/* =========================================================
 * B4 포스터 — 그리기, 화면 맞춤, 인쇄 (학생·교사 공용)
 * info: { grade, cls, num, name }
 * ========================================================= */
var Poster = (function () {
  var esc = Common.esc;

  function blank(text) {
    return text ? esc(text) : '<span class="p-blank"></span>';
  }

  function render(info, raw) {
    var d = Common.normalize(raw);
    var h = '';

    h += '<article class="poster">';

    // 머리
    h += '<header class="p-head">' +
      '<h1 class="p-country">' + (d.country ? esc(d.country) : '<span class="p-blank p-blank-wide"></span>') + '</h1>' +
      '<p class="p-who">' + esc(info.grade) + '학년 ' + esc(info.cls) + '반 ' + esc(info.num) + '번 <b>' + esc(info.name) + '</b></p>' +
      '</header>';

    // 기본 정보
    h += '<section class="p-box p-basic"><h2>기본 정보</h2><dl>';
    Common.BASIC_FIELDS.forEach(function (f) {
      h += '<div><dt>' + esc(f.label) + '</dt><dd>' + blank(d.basic[f.key]) + '</dd></div>';
    });
    h += '</dl></section>';

    // 여행 코스
    var days = d.trip.days;
    h += '<section class="p-box p-trip"><h2>여행 코스 <small>' + esc(Common.TRIP_LABELS[days]) + '</small></h2>' +
      '<div class="p-days p-days-' + days + '">';
    for (var i = 0; i < days; i++) {
      h += '<div class="p-day"><div class="p-day-no">' + (i + 1) + '일차</div><ol>';
      for (var j = 0; j < 3; j++) {
        var s = d.trip.plan[i][j];
        if (s.place || s.desc) {
          h += '<li><b>' + esc(s.place) + '</b>' + (s.desc ? ' <span>' + esc(s.desc) + '</span>' : '') + '</li>';
        } else {
          h += '<li><span class="p-blank"></span></li>';
        }
      }
      h += '</ol></div>';
    }
    h += '</div></section>';

    // 그림 칸 (음식, 전통의상)
    h += '<div class="p-draw-row">';
    [['음식', d.food], ['전통의상', d.costume]].forEach(function (pair) {
      var item = pair[1];
      h += '<section class="p-box p-draw"><h2>' + pair[0] + '</h2>' +
        '<p class="p-draw-cap"><b>' + blank(item.name) + '</b>' + (item.intro ? ' ' + esc(item.intro) : '') + '</p>' +
        '<div class="p-draw-area"></div></section>';
    });
    h += '</div>';

    // 여행 회화 + 우리나라와 다른 문화
    h += '<div class="p-bottom-row">';
    h += '<section class="p-box p-phrases"><h2>여행 회화</h2><ol>';
    d.phrases.forEach(function (ph, idx) {
      var has = ph.orig || ph.pron;
      if (!has && idx === 4) return; // 5번째 자유 문장은 비어 있으면 생략
      h += '<li>' +
        '<div class="p-ph-top">' + blank(ph.orig) + (ph.pron ? ' <span class="p-pron">[' + esc(ph.pron) + ']</span>' : '') + '</div>' +
        '<div class="p-ph-sub">' + esc(ph.mean) + (ph.situ ? ' <span class="p-situ">· ' + esc(ph.situ) + '</span>' : '') + '</div>' +
        '</li>';
    });
    h += '</ol></section>';

    h += '<section class="p-box p-diffs"><h2>우리나라와 다른 문화</h2><ol>';
    d.diffs.forEach(function (t) { h += '<li>' + blank(t) + '</li>'; });
    h += '</ol></section>';
    h += '</div>';

    // 느낀 점
    h += '<section class="p-box p-feel"><h2>느낀 점</h2><p>' + esc(d.feeling) + '</p></section>';

    h += '</article>';
    return h;
  }

  // 화면 폭에 맞게 포스터를 줄여서 보여줌
  function fit(box) {
    var p = box.querySelector('.poster');
    if (!p) return;
    p.style.transform = 'none';
    var scale = box.clientWidth / p.offsetWidth;
    p.style.transformOrigin = 'top left';
    p.style.transform = 'scale(' + scale + ')';
    box.style.height = Math.ceil(p.offsetHeight * scale) + 'px';
  }

  function showIn(box, info, data) {
    box.innerHTML = render(info, data);
    fit(box);
  }

  // items: [{ info, data }, ...] — 한 장에 한 명씩 인쇄
  function print(items) {
    var area = document.getElementById('printArea');
    if (!area || !items.length) return;
    area.innerHTML = items.map(function (it) { return render(it.info, it.data); }).join('');
    var go = function () { setTimeout(function () { window.print(); }, 150); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
  }

  window.addEventListener('afterprint', function () {
    var area = document.getElementById('printArea');
    if (area) area.innerHTML = '';
  });

  return { render: render, fit: fit, showIn: showIn, print: print };
})();
