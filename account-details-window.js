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

  function startTotpCounterMfa() {
    const counterText = document.getElementById('mfaCerbyAuthCounterText');
    const counterCircle = document.getElementById('mfaCerbyAuthCounterCircle');
    const totpValueEl = document.getElementById('mfaCerbyAuthTotpValue');
    if (!counterText || !counterCircle || !totpValueEl) return;

    function tick() {
      const now = Date.now();
      const periodStart = Math.floor(now / 30000) * 30000;
      const periodEnd = periodStart + 30000;
      let timeRemaining = Math.ceil((periodEnd - now) / 1000);
      if (timeRemaining <= 0) {
        totpValueEl.textContent = generateTotpCode();
        timeRemaining = 30;
      }
      const ct = document.getElementById('mfaCerbyAuthCounterText');
      const cc = document.getElementById('mfaCerbyAuthCounterCircle');
      if (ct && cc) updateTotpCounter(ct, cc, timeRemaining);
    }

    const now = Date.now();
    const periodStart = Math.floor(now / 30000) * 30000;
    const periodEnd = periodStart + 30000;
    let initial = Math.ceil((periodEnd - now) / 1000);
    updateTotpCounter(counterText, counterCircle, initial);
    totpCounterInterval = setInterval(tick, 1000);
  }

  function formatOtpWithSpace(code) {
    const s = (code || '').toString().replace(/\D/g, '');
    return s.length >= 6 ? s.slice(0, 3) + ' ' + s.slice(3, 6) : s || '—';
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

    function copyMfaCerbyAuth() {
      const el = document.getElementById('mfaCerbyAuthTotpValue');
      const code = el?.textContent.trim() || '';
      if (code) {
        navigator.clipboard.writeText(code).then(function() {
          showToast('TOTP copied to clipboard');
        }).catch(function() {});
      }
    }
    document.getElementById('mfaCerbyAuthCopyButton')?.addEventListener('click', function(e) {
      e.stopPropagation();
      copyMfaCerbyAuth();
    });
    const mfaCerbyAuthCounter = document.getElementById('mfaCerbyAuthCounter');
    if (mfaCerbyAuthCounter) {
      mfaCerbyAuthCounter.style.cursor = 'pointer';
      mfaCerbyAuthCounter.addEventListener('click', function(e) {
        e.stopPropagation();
        copyMfaCerbyAuth();
      });
    }

    function setupMfaCerbyCopy(el, copyText) {
      if (!el) return;
      el.addEventListener('click', async function(e) {
        if (e.target.closest('.mfa-cerby-managed-refresh')) return;
        e.stopPropagation();
        const text = (typeof copyText === 'string' ? copyText : copyText()) || '';
        if (text) {
          try {
            await navigator.clipboard.writeText(text.replace(/\s/g, ''));
            showToast('OTP copied to clipboard');
          } catch (err) {}
        }
      });
    }
    document.getElementById('mfaCerbyEmailRefreshButton')?.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      const codeEl = document.getElementById('mfaCerbyEmailOtpCode');
      const timeEl = document.getElementById('mfaCerbyEmailOtpTime');
      if (codeEl) codeEl.textContent = formatOtpWithSpace(generateTotpCode());
      if (timeEl) timeEl.textContent = 'Just now';
      showToast('New OTP requested');
    });
    document.getElementById('mfaCerbyPhoneRefreshButton')?.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      const codeEl = document.getElementById('mfaCerbyPhoneOtpCode');
      const timeEl = document.getElementById('mfaCerbyPhoneOtpTime');
      if (codeEl) codeEl.textContent = formatOtpWithSpace(generateTotpCode());
      if (timeEl) timeEl.textContent = 'Just now';
      showToast('New OTP requested');
    });
    setupMfaCerbyCopy(document.getElementById('mfaCerbyEmailCopyButton'), function() {
      return document.getElementById('mfaCerbyEmailOtpCode')?.textContent || '';
    });
    setupMfaCerbyCopy(document.getElementById('mfaCerbyPhoneCopyButton'), function() {
      return document.getElementById('mfaCerbyPhoneOtpCode')?.textContent || '';
    });

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

    const mfaSection = document.getElementById('accountDetailsMfaCodesSection');
    const totpField = document.getElementById('accountDetailsTotpField');
    const phoneField = document.getElementById('accountDetailsPhoneField');
    const mfaCodeCardEmail = document.getElementById('mfaCodeCardEmail');
    const mfaCodeCardPhone = document.getElementById('mfaCodeCardPhone');

    if (p.mfaCodesGrouped) {
      setDisplay('accountDetailsMfaCodesSection', true);
      setDisplay('accountDetailsTotpField', false);
      setDisplay('accountDetailsPhoneField', false);

      setText('mfaCerbyAuthTotpValue', p.totp || generateTotpCode());
      if (mfaSection) mfaSection.style.display = 'flex';
      if (totpField) totpField.style.display = 'none';
      if (phoneField) phoneField.style.display = 'none';

      if (p.cerbyManagedEmail) {
        setText('mfaCerbyEmailValue', p.cerbyManagedEmail);
        setText('mfaCerbyEmailOtpCode', formatOtpWithSpace(p.cerbyManagedEmailOtp));
        setText('mfaCerbyEmailOtpTime', p.cerbyManagedEmailOtpTime || '—');
        if (mfaCodeCardEmail) mfaCodeCardEmail.style.display = 'flex';
      } else if (mfaCodeCardEmail) {
        mfaCodeCardEmail.style.display = 'none';
      }
      if (p.cerbyManagedPhone) {
        setText('mfaCerbyPhoneValue', p.cerbyManagedPhone);
        setText('mfaCerbyPhoneOtpCode', formatOtpWithSpace(p.cerbyManagedPhoneOtp));
        setText('mfaCerbyPhoneOtpTime', p.cerbyManagedPhoneOtpTime || '—');
        if (mfaCodeCardPhone) mfaCodeCardPhone.style.display = 'flex';
      } else if (mfaCodeCardPhone) {
        mfaCodeCardPhone.style.display = 'none';
      }

      startTotpCounterMfa();
    } else {
      if (mfaSection) mfaSection.style.display = 'none';
      setDisplay('accountDetailsTotpField', !p.isSecret && !p.hasGoogleSso && p.hasMFA);
      setDisplay('accountDetailsPhoneField', !p.isSecret && !p.hasGoogleSso && !!p.phone);
      if (!p.isSecret && !p.hasGoogleSso && p.hasMFA) {
        startTotpCounter();
      }
    }

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
