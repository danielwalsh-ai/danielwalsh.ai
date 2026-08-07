// Compound Interest — growth projector (/tools/compound-interest)
(function () {
  const $ = id => document.getElementById(id);
  const gbp = n => '£' + Math.round(n).toLocaleString('en-GB');
  const pct = (n, d = 1) => (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('en-GB') + '%';
  let last = {};

  const els = {
    startPot: $('startPot'), monthly: $('monthly'), rate: $('rate'), years: $('years'),
    paidInLine: $('paidInLine'), doubleNote: $('doubleNote'),
    finalPot: $('finalPot'), finalDelta: $('finalDelta'),
    growthAmt: $('growthAmt'), splitDelta: $('splitDelta'),
    crossLine: $('crossLine'), chart: $('chart'),
    rSlider: $('rSlider'), rSliderVal: $('rSliderVal'), rPot: $('rPot'), rNote: $('rNote'),
    wSlider: $('wSlider'), wSliderVal: $('wSliderVal'), wPot: $('wPot'), wNote: $('wNote'),
  };

  function num(el, fallback) { const v = parseFloat(el.value); return isFinite(v) ? v : fallback; }

  // Month-by-month simulation: pot compounds monthly, contribution lands at month end.
  // Returns { final, paidIn, yearly: [{year, pot, paidIn}], crossoverYear }
  function simulate(P0, C, annualPct, years) {
    const i = annualPct / 100 / 12;
    const months = Math.round(years * 12);
    let pot = P0, paidIn = P0, crossoverYear = null;
    const yearly = [];
    let yearGrowth = 0;
    for (let m = 1; m <= months; m++) {
      const growth = pot * i;
      pot += growth + C;
      paidIn += C;
      yearGrowth += growth;
      if (m % 12 === 0) {
        const year = m / 12;
        yearly.push({ year, pot, paidIn });
        if (crossoverYear === null && yearGrowth > C * 12 && C > 0) crossoverYear = year;
        yearGrowth = 0;
      }
    }
    if (months % 12 !== 0) yearly.push({ year: years, pot, paidIn });
    return { final: pot, paidIn, yearly, crossoverYear };
  }

  function recalc() {
    const P0 = Math.max(0, num(els.startPot, 0));
    const C = Math.max(0, num(els.monthly, 0));
    const r = Math.max(0, num(els.rate, 7));
    const Y = Math.min(50, Math.max(1, Math.round(num(els.years, 20))));

    const sim = simulate(P0, C, r, Y);
    const growth = sim.final - sim.paidIn;

    els.paidInLine.textContent = gbp(sim.paidIn);
    els.doubleNote.textContent = r > 0 ? '(money doubles roughly every ' + Math.round(72 / r) + ' years at ' + pct(r) + ')' : '';

    els.finalPot.textContent = gbp(sim.final);
    els.finalDelta.innerHTML = sim.paidIn > 0
      ? 'That’s <strong>' + (sim.final / sim.paidIn).toFixed(1) + '×</strong> what you paid in.'
      : 'Add a starting pot or a monthly amount.';

    els.growthAmt.textContent = growth > 0 ? gbp(growth) : '£0';
    els.splitDelta.innerHTML = 'is pure growth, on top of the <strong>' + gbp(sim.paidIn) + '</strong> you put in.';

    if (sim.crossoverYear) {
      els.crossLine.innerHTML = 'From year <b>' + sim.crossoverYear + '</b>, the pot earns more each year than you pay into it.';
    } else if (C === 0 && P0 > 0 && r > 0) {
      els.crossLine.innerHTML = 'No monthly additions: the pot is <b>all compounding</b> from day one.';
    } else if (r === 0) {
      els.crossLine.innerHTML = 'At <b>0%</b> growth there is no compounding: the pot is only ever what you put in.';
    } else {
      els.crossLine.innerHTML = 'Within this horizon, <b>your contributions</b> are still doing most of the work — stretch the years and watch that flip.';
    }

    // Chart: 5 evenly spaced milestones, stacked paid-in (blue) + growth (amber)
    els.chart.innerHTML = '';
    const marks = [];
    for (let k = 1; k <= 5; k++) marks.push(Math.max(1, Math.round(Y * k / 5)));
    const uniq = [...new Set(marks)];
    const maxPot = Math.max(...uniq.map(y => (sim.yearly[y - 1] || sim.yearly[sim.yearly.length - 1]).pot), 1);
    uniq.forEach(y => {
      const row = sim.yearly[y - 1] || sim.yearly[sim.yearly.length - 1];
      const g = Math.max(0, row.pot - row.paidIn);
      const hTotal = Math.max(8, (row.pot / maxPot) * 140);
      const hGrowth = row.pot > 0 ? hTotal * (g / row.pot) : 0;
      const col = document.createElement('div');
      col.className = 'bar-col';
      col.innerHTML =
        '<div class="stack' + (hGrowth < 1 ? ' no-growth' : '') + '" style="height:' + hTotal + 'px">' +
          '<span class="val">' + gbp(row.pot) + '</span>' +
          '<div class="seg-growth" style="height:' + hGrowth + 'px"></div>' +
          '<div class="seg-paid" style="height:' + (hTotal - hGrowth) + 'px"></div>' +
        '</div>' +
        '<div class="bar-lbl">yr ' + row.year + '</div>';
      els.chart.appendChild(col);
    });

    last = {
      startPot: P0, monthly: C, ratePct: r, years: Y,
      finalPot: Math.round(sim.final), paidIn: Math.round(sim.paidIn),
      growth: Math.round(growth), crossoverYear: sim.crossoverYear,
    };

    updateRate();
    updateWait();
  }

  function updateRate() {
    const P0 = Math.max(0, num(els.startPot, 0));
    const C = Math.max(0, num(els.monthly, 0));
    const Y = Math.min(50, Math.max(1, Math.round(num(els.years, 20))));
    const r = parseFloat(els.rSlider.value);
    const sim = simulate(P0, C, r, Y);
    els.rSliderVal.textContent = 'Rate: ' + pct(r);
    els.rPot.textContent = gbp(sim.final);
    const base = simulate(P0, C, Math.max(0, num(els.rate, 7)), Y).final;
    const diff = sim.final - base;
    els.rNote.innerHTML = Math.abs(diff) < 1
      ? 'Your current assumption.'
      : (diff > 0 ? '<strong>+' + gbp(diff) + '</strong> vs your assumption.' : gbp(diff).replace('£', '−£').replace('−£-', '−£') + ' vs your assumption.');
  }

  function updateWait() {
    const P0 = Math.max(0, num(els.startPot, 0));
    const C = Math.max(0, num(els.monthly, 0));
    const r = Math.max(0, num(els.rate, 7));
    const Y = Math.min(50, Math.max(1, Math.round(num(els.years, 20))));
    const w = Math.min(parseInt(els.wSlider.value, 10) || 0, Math.max(0, Y - 1));
    const now = simulate(P0, C, r, Y);
    const late = simulate(P0, C, r, Y - w);
    els.wSliderVal.textContent = w === 0 ? 'Start in: now' : 'Start in: ' + w + ' year' + (w > 1 ? 's' : '');
    els.wPot.textContent = gbp(late.final);
    const cost = now.final - late.final;
    els.wNote.innerHTML = w === 0
      ? 'Starting now: the full ' + gbp(now.final) + '.'
      : 'Waiting costs <strong>' + gbp(cost) + '</strong> by the same end date, having paid in only ' + gbp(now.paidIn - late.paidIn) + ' less.';
  }

  [els.startPot, els.monthly, els.rate, els.years].forEach(el => el.addEventListener('input', recalc));
  els.rSlider.addEventListener('input', updateRate);
  els.wSlider.addEventListener('input', updateWait);

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
      const res = await fetch('/api/tools/compound-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, ...last }),
      });
      if (!res.ok) throw new Error('Request failed');
      capMsg.textContent = 'Done. Your projection is on the way.'; capMsg.className = 'cap-msg ok';
      $('capName').value = ''; $('capEmail').value = '';
    } catch (err) {
      capMsg.textContent = 'Something went wrong. Try again in a moment.'; capMsg.className = 'cap-msg err';
    } finally {
      capBtn.disabled = false; capBtn.textContent = 'Send my projection';
    }
  });

  recalc();
})();
