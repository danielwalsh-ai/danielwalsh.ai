// Margin vs Volume — profit lever calculator (/tools/margin-vs-volume)
(function () {
  const $ = id => document.getElementById(id);
  const gbp = n => '£' + Math.round(n).toLocaleString('en-GB');
  const pct = (n, d = 1) => (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('en-GB') + '%';
  let last = {};

  const els = {
    turnover: $('turnover'), margin: $('margin'), target: $('target'),
    currentProfit: $('currentProfit'), upliftNote: $('upliftNote'),
    marginNeeded: $('marginNeeded'), marginDelta: $('marginDelta'),
    volumeNeeded: $('volumeNeeded'), volumeDelta: $('volumeDelta'),
    insMargin: $('insMargin'), insVolume: $('insVolume'), chart: $('chart'),
    mSlider: $('mSlider'), mSliderVal: $('mSliderVal'), mProfit: $('mProfit'), mFill: $('mFill'), mStatus: $('mStatus'),
    vSlider: $('vSlider'), vSliderVal: $('vSliderVal'), vProfit: $('vProfit'), vFill: $('vFill'), vStatus: $('vStatus'),
  };

  function num(el, fallback) { const v = parseFloat(el.value); return isFinite(v) ? v : fallback; }

  function recalc() {
    const R0 = Math.max(0, num(els.turnover, 0));
    const m0 = Math.max(0.0001, num(els.margin, 8) / 100);
    const Pt = Math.max(0, num(els.target, 0));
    const P0 = R0 * m0;

    els.currentProfit.textContent = gbp(P0);
    if (P0 > 0 && Pt > 0) {
      const up = (Pt / P0 - 1) * 100;
      els.upliftNote.textContent = up >= 0 ? '(a ' + pct(up, 0) + ' uplift)' : '(a ' + pct(-up, 0) + ' drop)';
    } else { els.upliftNote.textContent = ''; }

    // Margin route: volume fixed
    const mNeeded = R0 > 0 ? Pt / R0 : Infinity;
    const pointsAdded = (mNeeded - m0) * 100;
    if (!isFinite(mNeeded)) {
      els.marginNeeded.textContent = '—';
      els.marginDelta.innerHTML = 'Add turnover first.';
    } else if (mNeeded > 1) {
      els.marginNeeded.textContent = pct(mNeeded * 100, 0);
      els.marginDelta.innerHTML = '<span class="warn">Over 100% margin</span> is impossible at this turnover. You cannot get there on margin alone.';
    } else {
      els.marginNeeded.textContent = pct(mNeeded * 100);
      els.marginDelta.innerHTML = 'That’s <strong>' + (pointsAdded >= 0 ? '+' : '') + pct(pointsAdded) + ' points</strong> on your current margin, turnover unchanged.';
    }

    // Volume route: margin fixed
    const Rneeded = m0 > 0 ? Pt / m0 : Infinity;
    const volPct = R0 > 0 ? (Rneeded / R0 - 1) * 100 : Infinity;
    const volAbs = Rneeded - R0;
    els.volumeNeeded.textContent = isFinite(Rneeded) ? gbp(Rneeded) : '—';
    els.volumeDelta.innerHTML = isFinite(volPct)
      ? 'That’s <strong>' + (volPct >= 0 ? '+' : '') + pct(volPct, 0) + '</strong> turnover (' + (volAbs >= 0 ? '+' : '−') + gbp(Math.abs(volAbs)) + '), margin unchanged.'
      : 'Set a turnover to compare.';

    // Trade-off insight: 1 point of margin = x% volume
    const volPerPoint = (0.01 / m0) * 100;
    els.insMargin.textContent = pct(m0 * 100);
    els.insVolume.textContent = pct(volPerPoint);

    // Chart: 1..5 margin points vs equivalent volume %
    els.chart.innerHTML = '';
    const points = [1, 2, 3, 4, 5];
    const vals = points.map(k => k * volPerPoint);
    const maxV = Math.max(...vals);
    points.forEach((k, i) => {
      const h = maxV > 0 ? Math.max(6, (vals[i] / maxV) * 130) : 6;
      const col = document.createElement('div');
      col.className = 'bar-col';
      col.innerHTML =
        '<div class="bar" style="height:' + h + 'px"><span class="val">+' + pct(vals[i], 0) + '</span></div>' +
        '<div class="bar-lbl">+' + k + ' pt</div>';
      els.chart.appendChild(col);
    });

    last = {
      turnover: R0, margin: +(m0 * 100).toFixed(2), target: Pt, currentProfit: Math.round(P0),
      marginNeededPct: (isFinite(mNeeded) && mNeeded <= 1) ? +(mNeeded * 100).toFixed(2) : null,
      turnoverNeeded: isFinite(Rneeded) ? Math.round(Rneeded) : null,
      volumeUpliftPct: isFinite(volPct) ? +volPct.toFixed(1) : null,
    };

    setupSlider(R0, m0, Pt);
  }

  function setupSlider(R0, m0, Pt) {
    const mNeeded = R0 > 0 ? (Pt / R0) * 100 : 0;
    const mMax = Math.max(30, m0 * 100 * 2, mNeeded * 1.3);
    els.mSlider.max = Math.round(mMax);
    if (parseFloat(els.mSlider.value) < m0 * 100) els.mSlider.value = (m0 * 100).toFixed(1);

    const Rneeded = m0 > 0 ? Pt / m0 : 0;
    const vMax = Math.max(R0 * 2, Rneeded * 1.3, 10000);
    els.vSlider.max = Math.round(vMax);
    if (parseFloat(els.vSlider.value) < R0) els.vSlider.value = Math.round(R0);

    updateMargin();
    updateVolume();
  }

  function updateMargin() {
    const R0 = Math.max(0, num(els.turnover, 0));
    const Pt = Math.max(0, num(els.target, 0));
    const m = parseFloat(els.mSlider.value) / 100;
    const p = R0 * m;
    els.mSliderVal.textContent = 'Margin: ' + pct(m * 100);
    els.mProfit.textContent = gbp(p);
    const prog = Pt > 0 ? Math.min(100, p / Pt * 100) : 0;
    els.mFill.style.width = prog + '%';
    if (Pt > 0 && p >= Pt) { els.mStatus.textContent = 'Target hit'; els.mStatus.className = 'status hit'; }
    else { els.mStatus.textContent = Pt > 0 ? gbp(Pt - p) + ' short of target' : ''; els.mStatus.className = 'status'; }
  }

  function updateVolume() {
    const m0 = Math.max(0.0001, num(els.margin, 8) / 100);
    const Pt = Math.max(0, num(els.target, 0));
    const R = parseFloat(els.vSlider.value);
    const p = R * m0;
    els.vSliderVal.textContent = 'Turnover: ' + gbp(R);
    els.vProfit.textContent = gbp(p);
    const prog = Pt > 0 ? Math.min(100, p / Pt * 100) : 0;
    els.vFill.style.width = prog + '%';
    els.vFill.style.background = '#3d5afe';
    if (Pt > 0 && p >= Pt) { els.vStatus.textContent = 'Target hit'; els.vStatus.className = 'status hit'; }
    else { els.vStatus.textContent = Pt > 0 ? gbp(Pt - p) + ' short of target' : ''; els.vStatus.className = 'status'; }
  }

  [els.turnover, els.margin, els.target].forEach(el => el.addEventListener('input', recalc));
  els.mSlider.addEventListener('input', updateMargin);
  els.vSlider.addEventListener('input', updateVolume);

  // Lead capture — proxied through the server (CSP blocks direct third-party calls)
  const capBtn = $('capBtn'), capMsg = $('capMsg');
  const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  capBtn.addEventListener('click', async () => {
    const name = $('capName').value.trim();
    const email = $('capEmail').value.trim();
    capMsg.className = 'cap-msg';
    if (!validEmail(email)) { capMsg.textContent = 'Please enter a valid email address.'; capMsg.className = 'cap-msg err'; return; }
    capBtn.disabled = true; capBtn.textContent = 'Sending...';
    try {
      const res = await fetch('/api/tools/margin-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, ...last }),
      });
      if (!res.ok) throw new Error('Request failed');
      capMsg.textContent = 'Done. Your numbers are on the way.'; capMsg.className = 'cap-msg ok';
      $('capName').value = ''; $('capEmail').value = '';
    } catch (err) {
      capMsg.textContent = 'Something went wrong. Try again in a moment.'; capMsg.className = 'cap-msg err';
    } finally {
      capBtn.disabled = false; capBtn.textContent = 'Send my numbers';
    }
  });

  recalc();
})();
