(function () {
  'use strict';

  // Theme toggle is handled by the shared theme-toggle.js (loaded before this
  // script). Everything below is animation logic specific to /about.

  // ---- Reveal animation ----
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rows = Array.prototype.slice.call(document.querySelectorAll('[data-row]'));
  var total = document.querySelector('[data-total]');
  var monthly = document.querySelector('[data-monthly]');
  var progress = document.querySelector('[data-progress]');
  var replay = document.querySelector('[data-replay]');
  var hero = document.querySelector('[data-hero]');
  var yearCard = document.querySelector('[data-year-card]');
  var savingPanel = document.querySelector('[data-saving-panel]');
  var savingAmount = document.querySelector('[data-saving-amount]');
  var SAVING_TARGET = savingAmount
    ? parseFloat(savingAmount.getAttribute('data-value') || '0')
    : 0;

  var FINAL_TOTAL = rows.reduce(function (sum, el) {
    return sum + parseFloat(el.getAttribute('data-yearly') || '0');
  }, 0);
  // Budget sized so the final fill lands near ~70% — reads as "getting scary".
  var BUDGET = 1100;
  var FINAL_PCT = Math.min(100, (FINAL_TOTAL / BUDGET) * 100);

  function formatMoney(value) {
    return '$' + value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatSaving(value) {
    return '+ ' + formatMoney(value);
  }

  // Independent rAF loop for the saving-panel amount (separate from the
  // hero total's count-up). Runs once when the panel enters and isn't
  // re-triggered unless play() resets it.
  var savingRaf = null;
  function animateSaving(target, duration) {
    if (!savingAmount) return;
    if (savingRaf !== null) { cancelAnimationFrame(savingRaf); savingRaf = null; }
    var t0 = performance.now();
    function tick(now) {
      if (document.hidden) { savingRaf = requestAnimationFrame(tick); return; }
      var p = Math.min(1, (now - t0) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      savingAmount.textContent = formatSaving(target * eased);
      if (p < 1) {
        savingRaf = requestAnimationFrame(tick);
      } else {
        savingRaf = null;
      }
    }
    savingRaf = requestAnimationFrame(tick);
  }

  function setFinalState() {
    rows.forEach(function (r) { r.classList.add('is-visible'); });
    if (total) {
      total.textContent = formatMoney(FINAL_TOTAL);
      total.classList.add('is-alarm');
    }
    if (monthly) monthly.textContent = formatMoney(FINAL_TOTAL / 12);
    if (progress) progress.style.width = FINAL_PCT + '%';
    if (replay) replay.classList.add('is-visible');
    if (savingPanel) savingPanel.classList.add('is-visible');
    if (savingAmount) savingAmount.textContent = formatSaving(SAVING_TARGET);
  }

  function resetState() {
    rows.forEach(function (r) {
      r.classList.remove('is-visible');
      r.style.willChange = '';
    });
    if (total) {
      total.textContent = '$0.00';
      total.classList.remove('is-alarm');
    }
    if (monthly) monthly.textContent = '$0.00';
    if (progress) progress.style.width = '0%';
    // Saving panel has its own independent trigger — never reset on replay.
    // Keep replay visible once it has appeared; just disable during an active run.
  }

  var activeRaf = null;
  var timeouts = [];
  var running = false;

  function cancelAll() {
    if (activeRaf !== null) { cancelAnimationFrame(activeRaf); activeRaf = null; }
    if (savingRaf !== null) { cancelAnimationFrame(savingRaf); savingRaf = null; }
    timeouts.forEach(function (t) { clearTimeout(t); });
    timeouts = [];
  }

  function countUpTo(target, duration) {
    if (!total) return;
    // Cancel any in-flight count-up so consecutive calls don't fight over
    // total.textContent (new row drops can overlap previous count-ups).
    if (activeRaf !== null) {
      cancelAnimationFrame(activeRaf);
      activeRaf = null;
    }
    var start = parseFloat(total.textContent.replace(/[^0-9.\-]/g, '')) || 0;
    var delta = target - start;
    var t0 = performance.now();
    function tick(now) {
      if (document.hidden) {
        activeRaf = requestAnimationFrame(tick);
        return;
      }
      var p = Math.min(1, (now - t0) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      var value = start + delta * eased;
      total.textContent = formatMoney(value);
      if (monthly) monthly.textContent = formatMoney(value / 12);
      if (p < 1) {
        activeRaf = requestAnimationFrame(tick);
      } else {
        activeRaf = null;
      }
    }
    activeRaf = requestAnimationFrame(tick);
  }

  // Row-drop offsets: long initial pause, big gap after the first drops
  // ("just $9.99..."), then gaps shrink non-linearly toward the end so the
  // cascade feels like things are piling up. ease-in on the gaps.
  function computeRowOffsets(n, isMobile) {
    var startDelay = 900;
    var maxGap = isMobile ? 820 : 950;
    var minGap = isMobile ? 340 : 380;
    var offsets = [startDelay];
    for (var i = 1; i < n; i++) {
      var p = (i - 1) / Math.max(1, n - 2);
      var eased = Math.pow(p, 1.5);
      var gap = maxGap - (maxGap - minGap) * eased;
      offsets.push(offsets[i - 1] + gap);
    }
    return offsets;
  }

  function play() {
    if (running || reduceMotion) return;
    running = true;
    resetState();
    if (replay) replay.setAttribute('disabled', '');

    var isMobile = window.matchMedia('(max-width: 480px)').matches;
    var offsets = computeRowOffsets(rows.length, isMobile);
    // Count-ups run longer at the start (slow, deliberate) and snap faster
    // toward the end (cascading). Reinforces the "ramping up" feel.
    var countDurations = offsets.map(function (_, i) {
      var p = i / Math.max(1, rows.length - 1);
      return Math.round(1400 - 500 * Math.pow(p, 1.5));
    });
    var runningTotal = 0;

    rows.forEach(function (row, i) {
      var t = offsets[i];
      timeouts.push(setTimeout(function () {
        row.style.willChange = 'transform, opacity';
        row.classList.add('is-visible');
        var yearly = parseFloat(row.getAttribute('data-yearly') || '0');
        runningTotal += yearly;
        countUpTo(runningTotal, countDurations[i]);
        if (progress) {
          var pct = Math.min(100, (runningTotal / BUDGET) * 100);
          progress.style.width = pct + '%';
        }
        row.addEventListener('transitionend', function onEnd() {
          row.style.willChange = '';
          row.removeEventListener('transitionend', onEnd);
        });
      }, t));
    });

    var lastRowTime = offsets[offsets.length - 1];
    var lastCount = countDurations[countDurations.length - 1];
    // Alarm starts slightly before the final count-up fully resolves so the
    // flash rides out of the number's arrival (feels punchy, not detached).
    var alarmAt = lastRowTime + lastCount - 150;
    var finaleAt = alarmAt + 1500;

    timeouts.push(setTimeout(function () {
      if (total) total.classList.add('is-alarm');
    }, alarmAt));

    // Hero finale: reveal button + mark run complete. Saving panel is
    // decoupled into its own section now — triggers on its own scroll.
    timeouts.push(setTimeout(function () {
      if (replay) {
        replay.classList.add('is-visible');
        replay.removeAttribute('disabled');
      }
      running = false;
    }, finaleAt));
  }

  // ---- IntersectionObserver gates first play ----
  if (reduceMotion) {
    setFinalState();
  } else if (hero && 'IntersectionObserver' in window) {
    var played = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !played) {
          played = true;
          play();
          io.disconnect();
        }
      });
    }, { threshold: 0.35 });
    io.observe(hero);
  } else {
    // no IO / very old browser — just play
    play();
  }

  // ---- Beat 2 (saving): independent scroll trigger ----
  // Does not wait for the hero reveal; plays when the panel itself
  // enters the viewport. Count-up starts after the strike + SAVED pill
  // CSS animations so the sequence reads as an unfolding action.
  function revealSavingPanel() {
    if (!savingPanel) return;
    savingPanel.classList.add('is-visible');
    if (savingAmount) {
      if (reduceMotion) {
        savingAmount.textContent = formatSaving(SAVING_TARGET);
      } else {
        setTimeout(function () { animateSaving(SAVING_TARGET, 1300); }, 1000);
      }
    }
  }

  if (savingPanel && 'IntersectionObserver' in window) {
    var savingIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          revealSavingPanel();
          savingIo.disconnect();
        }
      });
    }, { threshold: 0.3 });
    savingIo.observe(savingPanel);
  } else if (savingPanel) {
    revealSavingPanel();
  }

  // ---- Beat 3 (year): independent scroll trigger + monthly-stash count-up ----
  var monthlyStash = document.querySelector('[data-monthly-stash]');

  function countUpEl(el, target, duration) {
    var t0 = performance.now();
    var raf;
    function tick(now) {
      if (document.hidden) { raf = requestAnimationFrame(tick); return; }
      var p = Math.min(1, (now - t0) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      var value = target * eased;
      el.textContent = '$' + Math.round(value).toLocaleString('en-US');
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  }

  function revealYearCard() {
    if (!yearCard) return;
    yearCard.classList.add('is-visible');
    if (monthlyStash && !reduceMotion) {
      var target = parseFloat(monthlyStash.getAttribute('data-value') || '0');
      // Small delay so it follows the card's entrance and the ÷12 chip pop-in.
      setTimeout(function () { countUpEl(monthlyStash, target, 1500); }, 600);
    } else if (monthlyStash) {
      var finalVal = parseFloat(monthlyStash.getAttribute('data-value') || '0');
      monthlyStash.textContent = '$' + Math.round(finalVal).toLocaleString('en-US');
    }
  }

  if (yearCard && !reduceMotion && 'IntersectionObserver' in window) {
    var yearIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          revealYearCard();
          yearIo.disconnect();
        }
      });
    }, { threshold: 0.25 });
    yearIo.observe(yearCard);
  } else if (yearCard) {
    revealYearCard();
  }

  // ---- Replay click ----
  if (replay) {
    replay.addEventListener('click', function () {
      if (running) return;
      cancelAll();
      play();
    });
  }

  // ---- Pause on tab hide (rAF loop already checks document.hidden) ----
})();
