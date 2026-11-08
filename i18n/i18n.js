/* ==================== שפות: עברית · English · العربية ====================
   האפליקציה כתובה בעברית, והעברית היא גם המפתח: מילון לכל שפה ממפה את
   המחרוזת העברית לתרגום. השכבה הזו מתרגמת את מה שמגיע למסך (טקסט, placeholder,
   title, aria-label, ודיאלוגים של הדפדפן) בלי לגעת בלוגיקה של האפליקציה.
   בעברית היא לא עושה כלום — אפס סיכון למה שעובד היום.

   סדר ניסיונות לכל מחרוזת:
   1. התאמה מדויקת במילון
   2. תבנית עם משתנים ("חרגתם ב-{0} מהתקציב") — ביטוי רגולרי
   3. פירוק לפי מפרידים ( · , — , שורה חדשה ) ותרגום כל חלק
   4. תרגום של כל רצף עברי בנפרד (שברי משפט שנבנו בשרשור)               */
(function () {
  var LANGS = { he: { dir: 'rtl', name: 'עברית' }, en: { dir: 'ltr', name: 'English' }, ar: { dir: 'rtl', name: 'العربية' } };
  var KEY = 'fp-lang';

  function pick() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q && LANGS[q]) { localStorage.setItem(KEY, q); return q; }
      var s = localStorage.getItem(KEY);
      if (s && LANGS[s]) return s;
    } catch (e) {}
    var n = ((navigator.languages && navigator.languages[0]) || navigator.language || 'he').slice(0, 2).toLowerCase();
    if (n === 'iw') n = 'he';
    return LANGS[n] ? n : 'he';
  }

  var LANG = pick();
  window.LANG = LANG;
  window.LANGS = LANGS;
  var html = document.documentElement;
  html.lang = LANG;
  html.dir = LANGS[LANG].dir;

  window.setLang = function (l) {
    if (!LANGS[l] || l === LANG) return;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    if (typeof window.onLangChange === 'function') { try { window.onLangChange(l); } catch (e) {} }
    location.reload();
  };

  /* כפתורי בחירת שפה — לא מתורגמים (כל שפה בשמה שלה) */
  window.langSwitcherHTML = function (cls) {
    return '<div class="langsw ' + (cls || '') + '" data-noi18n role="group" aria-label="Language">' +
      Object.keys(LANGS).map(function (k) {
        return '<button type="button" lang="' + k + '" aria-pressed="' + (k === LANG) + '" onclick="setLang(\'' + k + '\')">' + LANGS[k].name + '</button>';
      }).join('') + '</div>';
  };

  window.__t = function (s) { return s; };
  if (LANG === 'he') return;

  /* המילון נטען לפני הסקריפט הראשי, כדי שגם הציור הראשון כבר יהיה מתורגם */
  document.write('<script src="i18n/' + LANG + '.js"><\/script>');
})();

function __i18nInit(dict) {
  var HEB = /[֐-׿]/;
  var D = Object.create(null), PATS = [];
  Object.keys(dict).forEach(function (k) {
    var v = dict[k];
    if (/\{\d+\}/.test(k)) {
      var parts = k.split(/(\{\d+\})/), idx = [], re = '';
      parts.forEach(function (p) {
        var m = /^\{(\d+)\}$/.exec(p);
        if (m) { idx.push(+m[1]); re += '([\\s\\S]*?)'; }
        else re += p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
      });
      PATS.push({ re: new RegExp('^' + re + '$'), idx: idx, out: v, lit: k.replace(/\{\d+\}/g, '').length });
    } else D[k] = v;
  });
  /* אינדקס למילוי חמדני: מילה ראשונה → מפתחות, הארוך קודם */
  var BYW = Object.create(null);
  Object.keys(D).forEach(function (k) {
    var w = k.split(' ')[0]; (BYW[w] = BYW[w] || []).push(k);
  });
  Object.keys(BYW).forEach(function (w) { BYW[w].sort(function (a, b) { return b.length - a.length; }); });

  function greedy(t) {
    var out = [], i = 0, n = t.length, hit = false;
    while (i < n) {
      while (i < n && t[i] === ' ') { out.push(' '); i++; }
      if (i >= n) break;
      var j = t.indexOf(' ', i); if (j < 0) j = n;
      var w = t.slice(i, j), cands = BYW[w], done = false;
      if (cands && HEB.test(w)) {
        for (var c = 0; c < cands.length; c++) {
          var k = cands[c];
          if (t.substr(i, k.length) === k && (i + k.length === n || /[\s.,:;!?)]/.test(t[i + k.length]) || !HEB.test(t[i + k.length]))) {
            out.push(D[k]); i += k.length; done = hit = true; break;
          }
        }
      }
      if (!done) {
        // מילה עם סימן פיסוק צמוד
        var core = w.replace(/[.,:;!?)"]+$/, ''), tail = w.slice(core.length);
        if (core !== w && D[core] !== undefined) { out.push(D[core] + tail); hit = true; }
        else out.push(w);
        i = j;
      }
    }
    return hit ? out.join('') : null;
  }
  PATS.sort(function (a, b) { return b.lit - a.lit; });
  var cache = Object.create(null);

  function core(t) {
    if (D[t] !== undefined) return D[t];
    for (var i = 0; i < PATS.length; i++) {
      var p = PATS[i], m = p.re.exec(t);
      if (m) {
        var o = p.out;
        p.idx.forEach(function (n, j) { o = o.split('{' + n + '}').join(tr(m[j + 1])); });
        return o;
      }
    }
    // משפט שנבנה משרשור של כמה מחרוזות — רק אם כולו מכוסה
    var g = greedy(t);
    if (g !== null && !HEB.test(g)) return g;
    // מפרידים טבעיים, ואז גבולות משפט
    var seps = [/(\n)/, /([.!?]\s+)/, /(\s·\s)/, /(\s—\s)/, /(\s\|\s)/, /(\s•\s)/];
    for (var s = 0; s < seps.length; s++) {
      if (seps[s].test(t)) {
        var bits = t.split(seps[s]);
        if (bits.length > 1) return bits.map(function (b) { return HEB.test(b) ? tr(b) : b; }).join('');
      }
    }
    // רצף עברי שלם שמופיע במילון (למשל מילה אחת ליד מספר)
    return t.replace(/[\u0590-\u05FF][^0-9₪%$€<>()[\]{}|•·\n]*[\u0590-\u05FF׳״"'.!?:]|[\u0590-\u05FF]/g, function (run) {
      var r = run.trim();
      if (D[r] !== undefined) return run.replace(r, D[r]);
      var noP = r.replace(/[.!?:]+$/, '');
      if (noP !== r && D[noP] !== undefined) return run.replace(noP, D[noP]);
      return run;
    });
  }

  function tr(s) {
    if (!s || !HEB.test(s)) return s;
    if (cache[s] !== undefined) return cache[s];
    var lead = /^\s*/.exec(s)[0], trail = /\s*$/.exec(s)[0];
    var t = s.slice(lead.length, s.length - trail.length).replace(/\s+/g, ' ');
    var r = lead + core(t) + trail;
    cache[s] = r;
    return r;
  }
  window.__t = tr;

  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'data-tip'];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };

  function skip(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) {
      if (SKIP[e.tagName] || e.hasAttribute('data-noi18n') || e.isContentEditable) return true;
    }
    return false;
  }
  function doText(n) {
    var v = n.nodeValue;
    if (!v || !HEB.test(v) || skip(n.parentNode)) return;
    var r = tr(v);
    if (r !== v) n.nodeValue = r;
  }
  function doEl(el) {
    if (skip(el)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute(ATTRS[i]);
      if (a && HEB.test(a)) { var r = tr(a); if (r !== a) el.setAttribute(ATTRS[i], r); }
    }
    if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && HEB.test(el.value)) el.value = tr(el.value);
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) doEl(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n;
    while ((n = w.nextNode())) n.nodeType === 3 ? doText(n) : doEl(n);
  }
  window.__i18nWalk = walk;

  new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (m.type === 'childList') for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      else if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doEl(m.target);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  // דיאלוגים של הדפדפן
  var _c = window.confirm, _a = window.alert, _p = window.prompt;
  window.confirm = function (m) { return _c.call(window, tr(String(m))); };
  window.alert = function (m) { return _a.call(window, tr(String(m))); };
  window.prompt = function (m, d) { return _p.call(window, tr(String(m)), d); };

  document.addEventListener('DOMContentLoaded', function () { walk(document.documentElement); });
}
