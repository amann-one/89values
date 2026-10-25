(function () {
  'use strict';

  var WERTE = window.WERTE;
  var NAMES = WERTE.map(function (w) { return w.name; });
  var N = WERTE.length;

  var STORAGE_KEY = 'werte-duelle-v1';
  var DEFAULT_TARGET = 250;
  var REFINE_STEP = 50;
  var MIN_FOR_RESULT = 100;
  var PICK_DELAY_MS = 170;

  /* Je Bereich ein eigener Farbton. Die Reihenfolge ist so gemischt, dass benachbarte Bereiche weit auseinander liegen. */
  var BEREICHE = [];
  WERTE.forEach(function (w) { if (BEREICHE.indexOf(w.bereich) < 0) BEREICHE.push(w.bereich); });
  var BASE_HUES = [350, 20, 42, 75, 120, 160, 185, 205, 230, 255, 280, 305, 330];
  function hueOf(bereich) {
    return BASE_HUES[(BEREICHE.indexOf(bereich) * 5) % BASE_HUES.length];
  }
  function isLong(name) {
    return name.split(/s+/).some(function (w) { return w.length > 15; });
  }
  function colorize(el, bereich) {
    el.classList.add('cat');
    el.style.setProperty('--h', String(hueOf(bereich)));
  }

  var state = null;
  var busy = false;

  var $ = function (id) { return document.getElementById(id); };
  var views = { start: $('view-start'), duel: $('view-duel'), result: $('view-result') };

  /* Speicher: Zugriff kann scheitern (privater Modus), die App läuft dann ohne Speicherung */

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || s.v !== 1 || !Array.isArray(s.pre) || !Array.isArray(s.comps)) return null;
      if (s.pre.length !== N / 2) return null;
      return s;
    } catch (e) { return null; }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ohne Speicher weiter */ }
  }

  function clearState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignorieren */ }
  }

  function newState() {
    return {
      v: 1,
      pre: Ranking.buildPreRound(NAMES, Math.random),
      comps: [],
      target: DEFAULT_TARGET,
      current: null
    };
  }

  /* Ansichten */

  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    window.scrollTo(0, 0);
  }

  /* Duell */

  function computeCurrent() {
    var c = state.comps.length;
    var pair = c < state.pre.length
      ? state.pre[c].slice()
      : Ranking.nextAdaptivePair(NAMES, state.comps, Math.random);
    if (Math.random() < 0.5) pair.reverse();
    return pair;
  }

  function fillCard(el, wert) {
    colorize(el, wert.bereich);
    el.querySelector('.card-tag').textContent = wert.bereich;
    var nm = el.querySelector('.card-name');
    nm.textContent = wert.name;
    nm.classList.toggle('long', isLong(wert.name));
    el.querySelector('.card-text').textContent = wert.text;
    el.setAttribute('aria-label', wert.name + ': ' + wert.text);
    el.classList.remove('picked', 'dimmed');
  }

  function renderDuel() {
    var done = state.comps.length;
    if (done >= state.target) { showResult(); return; }
    if (!state.current) { state.current = computeCurrent(); saveState(); }

    fillCard($('card-0'), WERTE[state.current[0]]);
    fillCard($('card-1'), WERTE[state.current[1]]);

    $('progress-text').textContent = 'Duell ' + (done + 1) + ' von ' + state.target;
    var pct = Math.round(done / state.target * 100);
    $('progress-bar').style.width = pct + '%';
    document.querySelector('.progress').setAttribute('aria-valuenow', String(pct));
    $('btn-finish').hidden = done < MIN_FOR_RESULT;
    $('btn-undo').disabled = done === 0;
    busy = false;
    show('duel');
  }

  function choose(side) {
    if (busy || views.duel.hidden) return;
    busy = true;
    var winner = state.current[side];
    var loser = state.current[1 - side];
    $('card-' + side).classList.add('picked');
    $('card-' + (1 - side)).classList.add('dimmed');
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* ignorieren */ } }

    setTimeout(function () {
      state.comps.push([winner, loser]);
      state.current = null;
      saveState();
      renderDuel();
    }, PICK_DELAY_MS);
  }

  function undo() {
    if (busy || !state.comps.length) return;
    var last = state.comps.pop();
    state.current = [last[0], last[1]];
    if (Math.random() < 0.5) state.current.reverse();
    saveState();
    renderDuel();
  }

  /* Ergebnis */

  function rankItem(rank, wert) {
    var li = document.createElement('li');
    li.className = 'rank-item';
    colorize(li, wert.bereich);
    var no = document.createElement('span');
    no.className = 'rank-no';
    no.textContent = String(rank);
    var name = document.createElement('span');
    name.className = 'r-name';
    name.textContent = wert.name;
    if (isLong(wert.name)) name.classList.add('long');
    var tag = document.createElement('span');
    tag.className = 'r-tag';
    tag.textContent = wert.bereich;
    var text = document.createElement('span');
    text.className = 'r-text';
    text.textContent = wert.text;
    li.append(no, name, tag, text);
    return li;
  }

  function fillList(listEl, items) {
    listEl.replaceChildren.apply(listEl, items);
  }

  function showResult() {
    var ranked = Ranking.ranking(N, state.comps);
    var top = ranked.slice(0, 20).map(function (r) { return WERTE[r.index]; });

    $('result-count').textContent = String(state.comps.length);
    fillList($('podium'), top.slice(0, 3).map(function (w, i) { return rankItem(i + 1, w); }));
    fillList($('runners'), top.slice(3, 5).map(function (w, i) { return rankItem(i + 4, w); }));

    fillList($('more-list'), top.slice(5).map(function (w, i) {
      var li = document.createElement('li');
      colorize(li, w.bereich);
      var no = document.createElement('span'); no.className = 'm-no'; no.textContent = (i + 6) + '.';
      var nm = document.createElement('span'); nm.textContent = w.name;
      var tg = document.createElement('span'); tg.className = 'm-tag'; tg.textContent = w.bereich;
      li.append(no, nm, tg);
      return li;
    }));

    $('result-note').textContent = state.comps.length < state.target
      ? 'Vorzeitig ausgewertet. Die Reihenfolge der vorderen Plätze ist noch unsicher.'
      : 'Mit weiteren Duellen wird vor allem die Reihenfolge der ersten fünf Plätze sicherer.';
    $('copy-info').textContent = '';
    show('result');
    $('result-title').setAttribute('tabindex', '-1');
    $('result-title').focus();
  }

  function resultText() {
    var ranked = Ranking.ranking(N, state.comps).slice(0, 5);
    var lines = ['Meine wichtigsten Werte'];
    ranked.forEach(function (r, i) {
      var w = WERTE[r.index];
      lines.push((i + 1) + '. ' + w.name + ' (' + w.bereich + '): ' + w.text);
    });
    return lines.join('\n');
  }

  function copyResult() {
    var text = resultText();
    var info = $('copy-info');
    function ok() { info.textContent = 'Kopiert.'; }
    function fail() { info.textContent = 'Kopieren nicht möglich. Bitte den Text markieren und manuell kopieren.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, fail);
    } else {
      fail();
    }
  }

  /* Start und Steuerung */

  function updateStart() {
    var has = state && state.comps.length > 0;
    $('btn-resume').hidden = !has;
    $('resume-info').hidden = !has;
    $('btn-start').textContent = has ? 'Neu beginnen' : 'Start';
    $('btn-start').className = has ? 'btn btn-ghost' : 'btn btn-primary';
    $('btn-resume').className = 'btn btn-primary';
    if (has) {
      $('resume-info').textContent = state.comps.length + ' von ' + state.target + ' Duellen gespielt.';
    }
  }

  function startNew() {
    if (state && state.comps.length > 0 &&
        !window.confirm('Der gespeicherte Stand geht verloren. Neu beginnen?')) return;
    state = newState();
    saveState();
    renderDuel();
  }

  function resume() {
    renderDuel();
  }

  function pause() {
    updateStart();
    show('start');
  }

  function refine() {
    state.target = state.comps.length + REFINE_STEP;
    saveState();
    renderDuel();
  }

  function restart() {
    if (!window.confirm('Alle Duelle und das Ergebnis werden gelöscht. Neu beginnen?')) return;
    clearState();
    state = newState();
    saveState();
    renderDuel();
  }

  function bind() {
    $('btn-start').addEventListener('click', startNew);
    $('btn-resume').addEventListener('click', resume);
    $('card-0').addEventListener('click', function () { choose(0); });
    $('card-1').addEventListener('click', function () { choose(1); });
    $('btn-undo').addEventListener('click', undo);
    $('btn-pause').addEventListener('click', pause);
    $('btn-finish').addEventListener('click', showResult);
    $('btn-refine').addEventListener('click', refine);
    $('btn-copy').addEventListener('click', copyResult);
    $('btn-restart').addEventListener('click', restart);

    document.addEventListener('keydown', function (e) {
      if (views.duel.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === '1') { e.preventDefault(); choose(0); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === '2') { e.preventDefault(); choose(1); }
      else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
    });
  }

  function init() {
    bind();
    state = loadState();
    updateStart();
    show('start');
  }

  init();
})();
