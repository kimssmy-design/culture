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

  /* ---------- 글이 긴 칸은 글씨를 줄여서 맞춤 ---------- */
  // [넘치는지 볼 상자, 글씨를 줄일 대상] — 대상이 없으면 상자 자체
  var FIT_TARGETS = [
    ['.p-basic', 'dl'],
    ['.p-day', null],
    ['.p-draw-cap', null],
    ['.p-phrases', 'ol'],
    ['.p-diffs', 'ol'],
    ['.p-feel', 'p']
  ];
  var MIN_PX = 6.5 * 96 / 72; // 가장 작게 줄일 글씨 6.5pt

  function overflowing(el) {
    return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  }

  // 포스터 한 장을 맞추고, 그래도 넘치는 칸 수를 돌려줌
  function autoFit(poster) {
    var bad = 0;
    FIT_TARGETS.forEach(function (pair) {
      poster.querySelectorAll(pair[0]).forEach(function (box) {
        var target = pair[1] ? box.querySelector(pair[1]) : box;
        if (!target) return;
        target.style.fontSize = '';
        box.classList.remove('p-overflow');
        var px = parseFloat(getComputedStyle(target).fontSize);
        var guard = 0;
        while (overflowing(box) && px > MIN_PX && guard < 60) {
          px = Math.max(MIN_PX, px - 0.3);
          target.style.fontSize = px + 'px';
          guard++;
        }
        if (overflowing(box)) { box.classList.add('p-overflow'); bad++; }
      });
    });
    return bad;
  }

  function fitAll(root) {
    var bad = 0;
    root.querySelectorAll('.poster').forEach(function (p) {
      var t = p.style.transform;
      p.style.transform = 'none';
      bad += autoFit(p);
      p.style.transform = t;
    });
    return bad;
  }

  // 미리보기: 넘치는 칸이 있으면 그 개수를 돌려줌 (0이면 문제 없음)
  function showIn(box, info, data) {
    box.innerHTML = render(info, data);
    var bad = fitAll(box);
    fit(box);
    // 글꼴이 늦게 도착하면 한 번 더 맞춤
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (!box.querySelector('.poster')) return;
        fitAll(box);
        fit(box);
      });
    }
    return bad;
  }

  // items: [{ info, data }, ...] — 한 장에 한 명씩 인쇄
  function print(items) {
    var area = document.getElementById('printArea');
    if (!area || !items.length) return;
    area.innerHTML = items.map(function (it) { return render(it.info, it.data); }).join('');
    var go = function () {
      // 화면 밖에서 잠깐 펼쳐 글씨 크기를 맞춘 뒤 인쇄
      area.classList.add('measuring');
      fitAll(area);
      area.classList.remove('measuring');
      setTimeout(function () { window.print(); }, 150);
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
  }

  window.addEventListener('afterprint', function () {
    var area = document.getElementById('printArea');
    if (area) area.innerHTML = '';
  });

  return { render: render, fit: fit, showIn: showIn, print: print };
})();
