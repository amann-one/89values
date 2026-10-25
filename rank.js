/*
 * Rangliste aus Duellen: Paarbildung und Wertung.
 *
 * Wertung: Bradley-Terry-Modell. Jeder Wert bekommt eine Stärke, die Wahrscheinlichkeit
 * "A schlägt B" ist s(A) / (s(A) + s(B)). Die Stärken werden aus allen bisherigen Duellen
 * neu geschätzt (MM-Verfahren). Ein kleiner Vorwert (je ein Sieg und eine Niederlage gegen
 * einen Durchschnittswert) verhindert unendliche Stärken bei 0 oder lauter Siegen.
 *
 * Paarbildung:
 *  1. Vorrunde: Jeder Wert tritt genau einmal gegen einen zufälligen anderen an.
 *  2. Danach: Es spielen nur noch Werte, die nach aktuellem Stand noch unter die Top 5
 *     kommen könnten (Stärke plus 0,5 Standardabweichungen reicht an Platz 5 heran).
 *     Gewählt wird zufällig unter den unsichersten Kandidaten, der Gegner zufällig unter
 *     den fünf ähnlichsten Kandidaten. Bereits gespielte Paarungen werden gemieden.
 */
(function (root) {
  'use strict';

  var TOP_K = 5;
  var Z = 0.5;
  var UNCERTAIN_SHARE = 0.4;
  var OPPONENT_WINDOW = 5;

  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** Vorrunde: Liste von Paaren, in der jeder Wert genau einmal vorkommt. Gleichnamige Werte treffen nicht aufeinander. */
  function buildPreRound(names, rnd) {
    var n = names.length;
    var idx = [];
    for (var i = 0; i < n; i++) idx.push(i);
    for (var attempt = 0; attempt < 500; attempt++) {
      var p = shuffle(idx, rnd);
      var ok = true;
      for (var k = 0; k + 1 < n; k += 2) {
        if (names[p[k]] === names[p[k + 1]]) { ok = false; break; }
      }
      if (ok) {
        var pairs = [];
        for (var m = 0; m + 1 < n; m += 2) pairs.push([p[m], p[m + 1]]);
        return pairs;
      }
    }
    throw new Error('Keine gültige Vorrunde gefunden');
  }

  /** Schätzt Stärken (log-Skala) und Unsicherheit aus den Duellen. comps: [[Sieger, Verlierer], ...] */
  function fit(n, comps) {
    var s = new Float64Array(n).fill(1);
    var wins = new Float64Array(n).fill(1);
    var played = [];
    for (var i = 0; i < n; i++) played.push(new Map());
    comps.forEach(function (c) {
      var a = c[0], b = c[1];
      wins[a] += 1;
      played[a].set(b, (played[a].get(b) || 0) + 1);
      played[b].set(a, (played[b].get(a) || 0) + 1);
    });
    for (var it = 0; it < 40; it++) {
      for (var x = 0; x < n; x++) {
        var d = 2 / (s[x] + 1);
        played[x].forEach(function (cnt, y) { d += cnt / (s[x] + s[y]); });
        s[x] = wins[x] / d;
      }
      var g = 0;
      for (var y = 0; y < n; y++) g += Math.log(s[y]);
      g = Math.exp(g / n);
      for (var z = 0; z < n; z++) s[z] /= g;
    }
    var score = new Array(n), sd = new Array(n);
    for (var q = 0; q < n; q++) score[q] = Math.log(s[q]);
    for (var r = 0; r < n; r++) {
      var info = 0.5;
      played[r].forEach(function (cnt, o) {
        var p = 1 / (1 + Math.exp(-(score[r] - score[o])));
        info += cnt * p * (1 - p);
      });
      sd[r] = 1 / Math.sqrt(info);
    }
    var order = [];
    for (var u = 0; u < n; u++) order.push(u);
    order.sort(function (a, b) { return score[b] - score[a]; });
    return { score: score, sd: sd, played: played, order: order };
  }

  /** Nächstes Paar nach der Vorrunde. */
  function nextAdaptivePair(names, comps, rnd) {
    var n = names.length;
    var f = fit(n, comps);
    var threshold = f.score[f.order[TOP_K - 1]];
    var cand = f.order.filter(function (i) { return f.score[i] + Z * f.sd[i] >= threshold; });
    if (cand.length < 2) cand = f.order.slice(0, 10);

    var byUncertainty = cand.slice().sort(function (a, b) { return f.sd[b] - f.sd[a]; });
    var pool = byUncertainty.slice(0, Math.max(1, Math.ceil(byUncertainty.length * UNCERTAIN_SHARE)));
    var a = pool[Math.floor(rnd() * pool.length)];

    function cost(j) { return Math.abs(f.score[j] - f.score[a]) + (f.played[a].has(j) ? 0.5 : 0); }
    var opp = cand.filter(function (j) { return j !== a && names[j] !== names[a]; })
      .sort(function (x, y) { return cost(x) - cost(y); });
    if (!opp.length) {
      opp = f.order.filter(function (j) { return j !== a && names[j] !== names[a]; });
    }
    var b = opp[Math.floor(rnd() * Math.min(OPPONENT_WINDOW, opp.length))];
    return [a, b];
  }

  /** Rangliste (Indizes, beste zuerst) samt Stärke. */
  function ranking(n, comps) {
    var f = fit(n, comps);
    return f.order.map(function (i) { return { index: i, score: f.score[i], sd: f.sd[i] }; });
  }

  var api = {
    TOP_K: TOP_K,
    buildPreRound: buildPreRound,
    nextAdaptivePair: nextAdaptivePair,
    ranking: ranking
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ranking = api;
})(typeof window !== 'undefined' ? window : globalThis);
