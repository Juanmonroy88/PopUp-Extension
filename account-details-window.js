(function() {
  const chromeApi = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);
  if (!chromeApi?.storage?.local?.get) return;

  // Clear stuck hover/focus state when pointer leaves
  document.addEventListener('mouseleave', function(e) {
    const left = e.target;
    const active = document.activeElement;
    if (!active || active === document.body) return;
    if (left === active || left.contains(active)) {
      active.blur();
    }
  }, true);

  let payload = null;
  let passwordRevealed = false;
  let actualPassword = '';
  let totpCounterInterval = null;

  function showToast(message) {
    const toast = document.getElementById('toastNotification');
    const text = document.getElementById('toastText');
    if (!toast || !text) return;
    text.textContent = message || 'Copied to clipboard';
    toast.classList.add('show');
    setTimeout(function() {
      toast.classList.remove('show');
    }, 2000);
  }

  function generateTotpCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  function updateTotpCounter(counterText, counterCircle, seconds) {
    if (counterText) counterText.textContent = seconds;
    if (counterCircle) {
      const progressCircle = counterCircle.querySelector('.totp-counter-progress');
      if (progressCircle) {
        const progress = (30 - seconds) / 30;
        const circumference = 2 * Math.PI * 10;
        progressCircle.style.strokeDashoffset = circumference - (progress * circumference);
      }
    }
  }

  function startTotpCounter() {
    const counterText = document.getElementById('totpCounterText');
    const counterCircle = document.getElementById('totpCounterCircle');
    const totpValueEl = document.getElementById('accountDetailsTotpValue');
    if (!counterText || !counterCircle || !totpValueEl) return;

    function tick() {
      const now = Date.now();
      const currentPeriod = Math.floor(now / 30000);
      const periodStart = currentPeriod * 30000;
      const periodEnd = periodStart + 30000;
      let timeRemaining = Math.ceil((periodEnd - now) / 1000);
      if (timeRemaining <= 0) {
        totpValueEl.textContent = generateTotpCode();
        timeRemaining = 30;
      }
      updateTotpCounter(counterText, counterCircle, timeRemaining);
    }

    const now = Date.now();
    const periodStart = Math.floor(now / 30000) * 30000;
    const periodEnd = periodStart + 30000;
    let initial = Math.ceil((periodEnd - now) / 1000);
    updateTotpCounter(counterText, counterCircle, initial);
    totpCounterInterval = setInterval(tick, 1000);
  }

  function stopTotpCounter() {
    if (totpCounterInterval) {
      clearInterval(totpCounterInterval);
      totpCounterInterval = null;
    }
  }

  function setupHoverStates() {
    const passwordField = document.getElementById('accountDetailsPasswordField');
    const urlField = document.getElementById('accountDetailsUrlField');

    if (passwordField) {
      const left = passwordField.querySelector('.password-field-left');
      const right = passwordField.querySelector('.password-field-right');
      if (right && left) {
        right.addEventListener('mouseenter', function() { left.classList.add('right-section-hovered'); });
        right.addEventListener('mouseleave', function() { left.classList.remove('right-section-hovered'); });
        right.addEventListener('focus', function() { left.classList.add('right-section-hovered'); });
        right.addEventListener('blur', function() { left.classList.remove('right-section-hovered'); });
      }
    }
    if (urlField) {
      const left = urlField.querySelector('.url-field-left');
      const right = urlField.querySelector('.url-field-right');
      if (right && left) {
        right.addEventListener('mouseenter', function() { left.classList.add('right-section-hovered'); });
        right.addEventListener('mouseleave', function() { left.classList.remove('right-section-hovered'); });
        right.addEventListener('focus', function() { left.classList.add('right-section-hovered'); });
        right.addEventListener('blur', function() { left.classList.remove('right-section-hovered'); });
      }
    }
  }

  function attachHandlers() {
    const loginUrl = payload?.loginUrl || '';

    document.getElementById('accountDetailsEmailField')?.addEventListener('click', async function() {
      const el = document.getElementById('accountDetailsEmail');
      const text = el?.textContent.trim() || '';
      if (text && text !== '—') {
        try {
          await navigator.clipboard.writeText(text);
          showToast('Email copied to clipboard');
        } catch (e) {}
      }
    });

    const passwordValueEl = document.getElementById('accountDetailsPasswordValue');
    const passwordCopyBtn = document.getElementById('passwordCopyButton');
    const passwordRevealBtn = document.getElementById('passwordRevealButton');
    if (passwordCopyBtn) {
      passwordCopyBtn.addEventListener('click', async function(e) {
        e.stopPropagation();
        try {
          if (passwordRevealed && actualPassword) {
            await navigator.clipboard.writeText(actualPassword);
          }
          showToast('Password copied to clipboard');
        } catch (e) {}
      });
    }
    if (passwordRevealBtn && passwordValueEl) {
      passwordRevealBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!passwordRevealed) {
          actualPassword = payload?.passwordPlain || 'actualPassword123!';
          passwordValueEl.textContent = actualPassword;
          passwordRevealed = true;
        } else {
          passwordValueEl.textContent = payload?.password || '••••••••••••••••••';
          passwordRevealed = false;
          actualPassword = '';
        }
      });
    }

    const totpCopyBtn = document.getElementById('totpCopyButton');
    const totpValueEl = document.getElementById('accountDetailsTotpValue');
    const totpCounter = document.getElementById('totpCounter');
    function copyTotp(e) {
      if (e) e.stopPropagation();
      const code = totpValueEl?.textContent.trim() || '';
      if (code) {
        navigator.clipboard.writeText(code).then(function() {
          showToast('TOTP copied to clipboard');
        }).catch(function() {});
      }
    }
    if (totpCopyBtn) totpCopyBtn.addEventListener('click', copyTotp);
    if (totpCounter) {
      totpCounter.style.cursor = 'pointer';
      totpCounter.addEventListener('click', copyTotp);
    }

    document.getElementById('accountDetailsPhoneField')?.addEventListener('click', async function() {
      const el = document.getElementById('accountDetailsPhone');
      const text = el?.textContent.trim() || '';
      if (text && text !== '—') {
        try {
          await navigator.clipboard.writeText(text);
          showToast('Phone copied to clipboard');
        } catch (e) {}
      }
    });

    const urlCopyBtn = document.getElementById('urlCopyButton');
    const urlValueEl = document.getElementById('accountDetailsUrl');
    if (urlCopyBtn) {
      urlCopyBtn.addEventListener('click', async function(e) {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(loginUrl || urlValueEl?.textContent.trim() || '');
          showToast('URL copied to clipboard');
        } catch (e) {}
      });
    }
    document.getElementById('urlOpenButton')?.addEventListener('click', function(e) {
      e.stopPropagation();
      if (loginUrl && chromeApi?.tabs?.create) {
        chromeApi.tabs.create({ url: loginUrl });
      }
    });
  }

  chromeApi.storage.local.get('cerbyExpandedAccountDetails', function(data) {
    const p = data?.cerbyExpandedAccountDetails;
    if (!p) return;
    payload = p;
    chromeApi.storage.local.remove('cerbyExpandedAccountDetails');

    function setText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text || '—';
    }
    function setDisplay(id, show) {
      const el = document.getElementById(id);
      if (el) el.style.display = show ? 'flex' : 'none';
    }

    setText('accountDetailsProvider', p.accountService || 'Unknown');
    setText('accountDetailsName', p.accountName);
    setText('accountDetailsEmail', p.accountEmail);
    setText('accountDetailsPasswordValue', p.password || '••••••••••••••••••');
    setText('accountDetailsTotpValue', p.totp || generateTotpCode());
    setText('accountDetailsPhone', p.phone);
    setText('accountDetailsUrl', p.displayUrl || p.loginUrl || '');

    setDisplay('accountDetailsAlertBanner', !p.isSecret && p.hasAlertBadge);
    setDisplay('accountDetailsSsoBanner', !p.isSecret && p.hasGoogleSso);
    setDisplay('accountDetailsPasswordField', !p.isSecret && !p.hasGoogleSso);
    setDisplay('accountDetailsTotpField', !p.isSecret && !p.hasGoogleSso && p.hasMFA);
    setDisplay('accountDetailsPhoneField', !p.isSecret && !p.hasGoogleSso && !!p.phone);

    const logoEl = document.getElementById('accountDetailsLogo');
    const logoImg = document.getElementById('accountDetailsLogoImg');
    if (logoImg && p.logoUrl) {
      logoImg.src = p.logoUrl;
      logoImg.alt = p.accountService || '';
      logoImg.style.display = 'block';
      if (p.accountService === 'Make') {
        logoImg.classList.add('make-logo');
        if (logoEl) logoEl.classList.add('make-logo-container');
      }
    }

    setupHoverStates();
    attachHandlers();

    if (!p.isSecret && !p.hasGoogleSso && p.hasMFA) {
      startTotpCounter();
    }
  });

  window.addEventListener('beforeunload', stopTotpCounter);
})();
