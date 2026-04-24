(function () {
  'use strict';

  var storageKey = 'forgettie-theme';
  var root = document.documentElement;

  try {
    var stored = localStorage.getItem(storageKey);
    if (stored === 'dark' || stored === 'light') {
      root.setAttribute('data-theme', stored);
    }
  } catch (e) { /* storage unavailable — fall back to system */ }

  var toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = root.getAttribute('data-theme');
      var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var effective = current || (systemDark ? 'dark' : 'light');
      var next = effective === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(storageKey, next); } catch (e) {}
    });
  }
})();
