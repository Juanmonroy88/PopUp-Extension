// Inline extension content script for login/signup experiences (Chrome only)

const chromeApi = typeof chrome !== 'undefined' ? chrome :
  (typeof browser !== 'undefined' ? browser : null);

const SIGNUP_KEYWORDS = [
  'signup',
  'sign-up',
  'sign_up',
  'register',
  'create-account',
  'createaccount',
  'join-now',
  'joinnow'
];

const ELIGIBLE_INPUT_TYPES = ['email', 'text', 'search'];
const ELIGIBLE_PASSWORD_TYPES = ['password'];
const MODULE_ID = 'cerby-inline-module';
const MODULE_EMAIL_TEXT_ID = 'cerby-inline-module-email';
const MODULE_PASSWORD_TEXT_ID = 'cerby-inline-module-password';
const MODULE_OFFSET = 8;
const SAVE_ACCOUNT_MODAL_ID = 'cerby-save-account-modal';
const INLINE_ACCOUNT_DROPDOWN_ID = 'cerby-inline-account-dropdown';

/** Top-level document so the modal is centered on the full browser viewport with overlay. */
function getTopDocument() {
  try {
    if (typeof window !== 'undefined' && window.top && window.top.document) {
      return window.top.document;
    }
  } catch (e) {
    // Cross-origin: use current document
  }
  return document;
}

let workspaceEmail = 'workspace@example.com';
let moduleElement = null;
let currentInput = null;
let mutationObserver = null;
let pendingViewportUpdate = false;
let detachInputListener = null;
let moduleSaveButton = null;
let saveAccountModal = null;
let inlineAccountDropdown = null;

initializeInlineExtension();

async function initializeInlineExtension() {
  if (chromeApi?.storage?.onChanged) {
    chromeApi.storage.onChanged.addListener(handleStorageChanges);
  }

  if (!isSignupContext()) {
    // Some signup experiences render content dynamically; observe for later matches.
    observeDynamicContext();
  }

  workspaceEmail = await getWorkspaceEmail();

  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('mousedown', handleDismiss, true);
  document.addEventListener('keydown', handleKeydownDismiss, true);
  // Delegate Save in Cerby click so modal opens even if button listener doesn't fire (e.g. focus/stack)
  document.addEventListener('click', handleSaveInCerbyClick, true);
  window.addEventListener('blur', hideModule, true);
  window.addEventListener('scroll', handleViewportChange, true);
  window.addEventListener('resize', handleViewportChange, true);
  window.addEventListener('orientationchange', handleViewportChange, true);

  // Login suggestion modal: show when on a login page and user has accounts for this site
  tryShowLoginSuggestionModal();
}

function handleStorageChanges(changes, areaName) {
  if (areaName !== 'local' || !changes.workspaceEmail) {
    return;
  }

  const newEmail = changes.workspaceEmail.newValue;
  if (typeof newEmail === 'string' && newEmail.trim().length > 0) {
    workspaceEmail = newEmail.trim();
    updateModuleEmail(workspaceEmail);
  }
}

function isSignupContext() {
  const href = window.location.href.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  const title = document.title.toLowerCase();

  return SIGNUP_KEYWORDS.some(keyword =>
    href.includes(keyword) ||
    pathname.includes(keyword) ||
    title.includes(keyword)
  );
}

function observeDynamicContext() {
  if (mutationObserver) {
    return;
  }

  mutationObserver = new MutationObserver((mutations, observer) => {
    const hasRelevantText = SIGNUP_KEYWORDS.some(keyword =>
      document.body?.textContent?.toLowerCase().includes(keyword)
    );

    if (hasRelevantText) {
      observer.disconnect();
      mutationObserver = null;
    }
  });

  try {
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
  } catch (error) {
    // Ignore observer errors (e.g., if documentElement is unavailable)
  }
}

function handleFocusIn(event) {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    if (moduleElement && !moduleContainsTarget(target)) hideModule();
    if (inlineAccountDropdown && !inlineAccountDropdown.contains(target)) hideInlineAccountDropdown();
    return;
  }

  const isEmailField = isEligibleInput(target);
  const isPasswordField = isEligiblePasswordInput(target);
  const isLoginContext = isLoginPage();

  if (!isEmailField && !isPasswordField) {
    if (moduleElement && !moduleContainsTarget(target)) hideModule();
    if (inlineAccountDropdown && !inlineAccountDropdown.contains(target)) hideInlineAccountDropdown();
    return;
  }

  currentInput = target;

  if (isLoginContext) {
    hideModule();
    tryShowInlineAccountDropdown(target, isPasswordField ? 'password' : 'email');
  } else if (isSignupContext()) {
    hideInlineAccountDropdown();
    showModule(target, isPasswordField ? 'password' : 'email');
  } else {
    hideModule();
    hideInlineAccountDropdown();
  }
}

function moduleContainsTarget(target) {
  return moduleElement && moduleElement.contains(target);
}

function handleDismiss(event) {
  const target = event.target;
  const inModule = moduleElement && (moduleContainsTarget(target) || target === currentInput);
  const inDropdown = inlineAccountDropdown && (inlineAccountDropdown.contains(target) || target === currentInput);
  if (inModule || inDropdown) return;
  hideModule();
  hideInlineAccountDropdown();
}

function handleKeydownDismiss(event) {
  if (event.key === 'Escape') {
    hideModule();
    hideInlineAccountDropdown();
    return;
  }

  if (event.key === 'Tab' && (moduleElement || inlineAccountDropdown)) {
    const root = inlineAccountDropdown || moduleElement;
    const focusableElements = getFocusableElements(root);
    if (!focusableElements.length) {
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

function getFocusableElements(root) {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')
  ).filter(el => !el.hasAttribute('disabled'));
}

async function getWorkspaceEmail() {
  if (!chromeApi || !chromeApi.storage) {
    return workspaceEmail;
  }

  return new Promise(resolve => {
    try {
      chromeApi.storage.local.get(['workspaceEmail'], result => {
        if (chromeApi.runtime && chromeApi.runtime.lastError) {
          resolve(workspaceEmail);
          return;
        }

        const storedEmail = result?.workspaceEmail;
        if (typeof storedEmail === 'string' && storedEmail.trim().length > 0) {
          resolve(storedEmail.trim());
        } else {
          resolve(workspaceEmail);
        }
      });
    } catch (error) {
      resolve(workspaceEmail);
    }
  });
}

function isEligibleInput(input) {
  const type = (input.getAttribute('type') || 'text').toLowerCase();
  if (!ELIGIBLE_INPUT_TYPES.includes(type)) {
    return false;
  }

  const datasetHint = input.dataset?.cerbyInlineTouched === 'true';
  const name = (input.getAttribute('name') || '').toLowerCase();
  const id = (input.getAttribute('id') || '').toLowerCase();
  const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
  const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();

  const hintMatches = [name, id, autocomplete, placeholder]
    .filter(Boolean)
    .some(value =>
      value.includes('email') ||
      value.includes('user') ||
      value.includes('login') ||
      value.includes('account')
    );

  return datasetHint || hintMatches;
}

function isEligiblePasswordInput(input) {
  const type = (input.getAttribute('type') || 'text').toLowerCase();
  if (!ELIGIBLE_PASSWORD_TYPES.includes(type)) {
    return false;
  }

  const datasetHint = input.dataset?.cerbyInlinePasswordTouched === 'true';
  const name = (input.getAttribute('name') || '').toLowerCase();
  const id = (input.getAttribute('id') || '').toLowerCase();
  const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
  const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();

  const hintMatches = [name, id, autocomplete, placeholder]
    .filter(Boolean)
    .some(value =>
      value.includes('password') ||
      value.includes('pass') ||
      value.includes('pwd')
    );

  return datasetHint || hintMatches;
}

function generatePassword() {
  const length = 20;
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const allChars = lowercase + uppercase + numbers + special;
  
  let password = '';
  
  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

function highlightPasswordChars(password) {
  // Highlight numbers and special characters in teal (#007da8)
  const parts = [];
  let currentPart = '';
  let currentColor = '#1f2f4d'; // Default dark color
  
  for (let i = 0; i < password.length; i++) {
    const char = password[i];
    const isNumber = /[0-9]/.test(char);
    const isSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(char);
    const shouldHighlight = isNumber || isSpecial;
    const charColor = shouldHighlight ? '#007da8' : '#1f2f4d';
    
    if (charColor !== currentColor && currentPart) {
      parts.push({ text: currentPart, color: currentColor });
      currentPart = '';
    }
    
    currentColor = charColor;
    currentPart += char;
  }
  
  if (currentPart) {
    parts.push({ text: currentPart, color: currentColor });
  }
  
  return parts;
}

function showModule(input, moduleType = 'email') {
  // Remove existing module if switching types
  if (moduleElement && moduleElement.dataset.moduleType !== moduleType) {
    if (moduleElement.isConnected) {
      moduleElement.remove();
    }
    moduleElement = null;
  }

  if (!moduleElement) {
    moduleElement = createModuleElement(moduleType);
  }

  if (!moduleElement.isConnected) {
    document.body.appendChild(moduleElement);
  }

  if (moduleType === 'password') {
    const password = generatePassword();
    updateModulePassword(password);
  } else {
    updateModuleEmail(workspaceEmail);
  }
  
  associateModuleWithInput(moduleElement, input, moduleType);

  // On signup with empty email, show "Save in Cerby" immediately so user can open the save modal without typing first
  if (isSignupContext() && moduleType === 'email' && (!input.value || !input.value.trim())) {
    setModuleState('save');
  }

  requestAnimationFrame(() => {
    const inputRect = input.getBoundingClientRect();
    if (inputRect.width === 0 && inputRect.height === 0) {
      // Input may be hidden; avoid showing module in that case.
      hideModule();
      return;
    }

    updateModulePosition();
    moduleElement.classList.add('cerby-inline-module--visible');
  });
}

function hideModule() {
  if (!moduleElement) {
    return;
  }
  if (detachInputListener) {
    detachInputListener();
    detachInputListener = null;
  }
  moduleElement.classList.remove('cerby-inline-module--visible');
  moduleElement.removeAttribute('data-for-input');
  delete moduleElement.dataset.cerbyFromLoginPage;
  setModuleState('suggestion');
  currentInput = null;
}

function createModuleElement(moduleType = 'email') {
  const container = document.createElement('div');
  container.id = MODULE_ID;
  container.className = 'cerby-inline-module';
  container.setAttribute('role', 'note');
  container.style.position = 'absolute';
  container.style.top = '0px';
  container.style.left = '0px';
  container.setAttribute('aria-label', 'Cerby password manager inline module');
  container.setAttribute('data-cerby-inline', 'true');
  container.dataset.state = 'suggestion';
  container.dataset.moduleType = moduleType;

  const suggestion = document.createElement('div');
  suggestion.className = 'cerby-inline-module__suggestion';
  container.appendChild(suggestion);
  
  // Make the entire suggestion area clickable
  suggestion.style.cursor = 'pointer';
  suggestion.style.userSelect = 'none';
  
  const handleSuggestionClick = function(e) {
    if (!e.target.closest('.cerby-inline-module__settings-button')) {
      if (moduleType === 'password') {
        handlePasswordSuggestionClick(e);
      } else {
        handleEmailSuggestionClick(e);
      }
    }
  };
  
  // Make the entire suggestion area clickable - handle clicks on any child element
  // Use both capture and bubble phases to ensure we catch all clicks
  const handleSuggestionAreaClick = function(e) {
    const settingsButton = e.target.closest('.cerby-inline-module__settings-button');
    if (settingsButton) return;
    if (moduleType === 'password') {
      handlePasswordSuggestionClick(e);
    } else {
      handleEmailSuggestionClick(e);
    }
  };
  
  // Add listener in capture phase to catch clicks early
  suggestion.addEventListener('click', handleSuggestionAreaClick, true);
  // Also add in bubble phase as backup
  suggestion.addEventListener('click', handleSuggestionAreaClick, false);
  
  // Use a simpler approach - trigger on mousedown and check on mouseup
  // Store state on window to persist across event handlers
  if (!window._cerbyClickState) {
    window._cerbyClickState = {};
  }
  
  suggestion.addEventListener('mousedown', function(e) {
    if (!e.target.closest('.cerby-inline-module__settings-button')) {
      const clickId = 'cerby_' + Date.now();
      window._cerbyClickState[clickId] = {
        element: suggestion,
        moduleType: moduleType,
        time: Date.now(),
        target: e.target
      };
      suggestion.dataset.cerbyClickId = clickId;
    }
  }, true);
  
  // Listen on document for mouseup - this will catch it even if it happens outside
  const handleGlobalMouseUp = function(e) {
    const settingsButton = e.target.closest('.cerby-inline-module__settings-button');
    if (settingsButton) return;
    const allSuggestions = document.querySelectorAll('.cerby-inline-module__suggestion[data-cerby-click-id]');
    for (const sugg of allSuggestions) {
      const clickId = sugg.dataset.cerbyClickId;
      
      if (clickId && window._cerbyClickState[clickId]) {
        const state = window._cerbyClickState[clickId];
        const timeDiff = Date.now() - state.time;
        const isInSuggestion = sugg.contains(e.target);
        // If mousedown happened in suggestion and mouseup is within reasonable time,
        // trigger the action. Since mousedown was in suggestion, we trust that the user
        // intended to click it, even if mouseup happens slightly outside (due to drag or event capture)
        // But don't trigger if mouseup is on settings button or if time is too long
        if (timeDiff < 500 && !settingsButton) {
          e.preventDefault();
          e.stopPropagation();
          if (state.moduleType === 'password') {
            setTimeout(() => {
              try {
                handlePasswordSuggestionClick(e);
              } catch (error) {
                console.error('Cerby: Error in handlePasswordSuggestionClick:', error);
                console.error(error.stack);
              }
            }, 10);
          } else {
            setTimeout(() => {
              handleEmailSuggestionClick(e);
            }, 10);
          }
          
          // Clean up
          delete window._cerbyClickState[clickId];
          delete sugg.dataset.cerbyClickId;
          break;
        }
        if (timeDiff >= 1000) {
          delete window._cerbyClickState[clickId];
          delete sugg.dataset.cerbyClickId;
        }
      }
    }

    // When no suggestion had a pending click (e.g. user clicked "Save in Cerby" or "Save new account"
    // but target was a LABEL), open modal if mouseup coordinates are inside our save UI
    if (allSuggestions.length === 0 && e.clientX != null && e.clientY != null) {
      const x = e.clientX;
      const y = e.clientY;
      const inRect = (el) => {
        if (!el || !el.getBoundingClientRect) return false;
        const r = el.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      };
      const saveButtonEl = document.querySelector('.cerby-inline-module__save-button');
      const moduleSaveEl = document.querySelector('.cerby-inline-module[data-state="save"]');
      const saveNewEl = document.querySelector('.cerby-inline-account-dropdown__save-new');
      if (saveButtonEl && inRect(saveButtonEl)) {
        e.preventDefault();
        e.stopPropagation();
        hideModule();
        hideInlineAccountDropdown();
        const password = moduleElement?.querySelector(`#${MODULE_PASSWORD_TEXT_ID}`)?.dataset?.plainPassword || '';
        openSaveAccountModal(password, saveButtonEl);
      } else if (moduleSaveEl && inRect(moduleSaveEl)) {
        e.preventDefault();
        e.stopPropagation();
        hideModule();
        hideInlineAccountDropdown();
        const password = moduleElement?.querySelector(`#${MODULE_PASSWORD_TEXT_ID}`)?.dataset?.plainPassword || '';
        openSaveAccountModal(password, moduleSaveEl);
      } else if (saveNewEl && inRect(saveNewEl)) {
        e.preventDefault();
        e.stopPropagation();
        hideInlineAccountDropdown();
        const passwordFromPage = document.querySelector('input[type="password"]')?.value || '';
        openSaveAccountModal(passwordFromPage, saveNewEl);
      }
    }
  };
  
  // Add global listener once
  if (!window._cerbyGlobalMouseUpListener) {
    document.addEventListener('mouseup', handleGlobalMouseUp, true);
    window._cerbyGlobalMouseUpListener = true;
  }
  
  // Add pointer events as well
  suggestion.addEventListener('pointerdown', function(e) {
  });
  

  const label = document.createElement('p');
  label.className = 'cerby-inline-module__label';
  label.style.cursor = 'pointer';
  label.style.userSelect = 'none';
  if (moduleType === 'password') {
    label.textContent = 'Use a Cerby-generated password';
  } else {
    label.textContent = 'Use your workspace email address';
  }
  suggestion.appendChild(label);

  const row = document.createElement('div');
  row.className = 'cerby-inline-module__row';
  row.style.cursor = 'pointer';
  row.style.userSelect = 'none';
  suggestion.appendChild(row);

  if (moduleType === 'password') {
    const passwordContainer = document.createElement('div');
    passwordContainer.className = 'cerby-inline-module__password-container';
    passwordContainer.style.cursor = 'pointer';
    passwordContainer.style.userSelect = 'none';
    
    const passwordValue = document.createElement('p');
    passwordValue.id = MODULE_PASSWORD_TEXT_ID;
    passwordValue.className = 'cerby-inline-module__password-value';
    passwordValue.style.cursor = 'pointer';
    passwordValue.style.userSelect = 'none';
    passwordValue.setAttribute('tabindex', '0');
    passwordValue.setAttribute('role', 'button');
    
    // Don't add separate click handlers - let clicks bubble up to suggestion area
    // Only add keyboard support for accessibility
    passwordValue.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        handlePasswordSuggestionClick(e);
      }
    });
    passwordContainer.appendChild(passwordValue);
    
    row.appendChild(passwordContainer);
  } else {
    const emailValue = document.createElement('span');
    emailValue.id = MODULE_EMAIL_TEXT_ID;
    emailValue.className = 'cerby-inline-module__email-value';
    emailValue.textContent = workspaceEmail;
    emailValue.style.cursor = 'pointer';
    row.appendChild(emailValue);
  }

  const settingsButton = document.createElement('button');
  settingsButton.type = 'button';
  settingsButton.className = 'cerby-inline-module__settings-button';
  settingsButton.setAttribute('aria-label', 'Open Cerby settings');
  settingsButton.addEventListener('click', handleSettingsClick);

  const settingsIcon = document.createElement('img');
  settingsIcon.className = 'cerby-inline-module__settings-icon';
  settingsIcon.alt = '';
  settingsIcon.src = chromeApi?.runtime?.getURL
    ? chromeApi.runtime.getURL('assets/inline-settings-icon.svg')
    : 'assets/inline-settings-icon.svg';

  settingsButton.appendChild(settingsIcon);
  row.appendChild(settingsButton);

  const saveContainer = document.createElement('div');
  saveContainer.className = 'cerby-inline-module__save-container';

  moduleSaveButton = document.createElement('button');
  moduleSaveButton.type = 'button';
  moduleSaveButton.className = 'cerby-inline-module__save-button';
  moduleSaveButton.textContent = 'Save in Cerby';
  const openSaveModalFromButton = function() {
    const password = moduleElement?.querySelector(`#${MODULE_PASSWORD_TEXT_ID}`)?.dataset?.plainPassword || '';
    hideModule();
    hideInlineAccountDropdown();
    openSaveAccountModal(password, moduleSaveButton);
  };
  // Mousedown fires first and is less likely to be retargeted to a label – use it so the modal always opens
  moduleSaveButton.addEventListener('mousedown', function(e) {
    e.preventDefault();
    e.stopPropagation();
    setTimeout(openSaveModalFromButton, 0);
  }, true);
  // Click as backup (e.g. keyboard Enter)
  moduleSaveButton.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    setTimeout(openSaveModalFromButton, 0);
  }, true);
  saveContainer.appendChild(moduleSaveButton);
  container.appendChild(saveContainer);

  container.tabIndex = -1;
  return container;
}

function updateModuleEmail(email) {
  const emailNode = moduleElement?.querySelector(`#${MODULE_EMAIL_TEXT_ID}`);
  if (!emailNode) {
    return;
  }

  emailNode.textContent = email;
}

function updateModulePassword(password) {
  const passwordNode = moduleElement?.querySelector(`#${MODULE_PASSWORD_TEXT_ID}`);
  if (!passwordNode) {
    return;
  }

  // Clear existing content
  passwordNode.innerHTML = '';
  
  // Create highlighted password display
  const parts = highlightPasswordChars(password);
  parts.forEach(part => {
    const span = document.createElement('span');
    span.textContent = part.text;
    span.style.color = part.color;
    passwordNode.appendChild(span);
  });
  
  // Store the plain password for filling
  passwordNode.dataset.plainPassword = password;
}

function handlePasswordSuggestionClick(event) {
  event.preventDefault();
  event.stopPropagation();


  let input = null;
  if (moduleElement && moduleElement._cerbyInput) {
    input = moduleElement._cerbyInput;
  } else if (currentInput) {
    input = currentInput;
  } else if (moduleElement) {
    const inputId = moduleElement.getAttribute('data-for-input');
    if (inputId) {
      const allInputs = document.querySelectorAll('input');
      for (const inp of allInputs) {
        if (inp.dataset.cerbyInlineId === inputId) {
          input = inp;
          break;
        }
      }
    }
  }

  if (!input || !(input instanceof HTMLInputElement)) {
    console.warn('Cerby inline: Could not find password input element');
    return;
  }

  // Get the password from the module
  const passwordNode = moduleElement?.querySelector(`#${MODULE_PASSWORD_TEXT_ID}`);
  const password = passwordNode?.dataset?.plainPassword || '';
  
  if (!password) {
    console.warn('Cerby inline: Could not find password to fill');
    return;
  }


  input.focus();

  try {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(input, password);
    } else {
      input.value = password;
    }
  } catch (e) {
    input.value = password;
  }

  const inputEvent = new Event('input', { bubbles: true, cancelable: true });
  input.dispatchEvent(inputEvent);

  const changeEvent = new Event('change', { bubbles: true, cancelable: true });
  input.dispatchEvent(changeEvent);

  if (input.setSelectionRange) {
    try {
      input.setSelectionRange(password.length, password.length);
    } catch (e) {
      // Ignore errors
    }
  }

  // Open the save account modal immediately (use input so modal is in same document/frame as form)
  try {
    openSaveAccountModal(password, input);
  } catch (error) {
    console.error('Cerby: Error opening save account modal:', error);
    console.error(error.stack);
  }
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    // Remove www. prefix
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch (e) {
    return null;
  }
}

function getProviderLogoUrl(domain) {
  if (!domain) return '';
  
  // Try Clearbit first
  return `https://logo.clearbit.com/${domain}`;
}

function extractAccountName(email) {
  if (!email || typeof email !== 'string') {
    return 'new_account';
  }
  
  const emailParts = email.split('@');
  if (emailParts.length > 0 && emailParts[0].trim()) {
    return emailParts[0].trim();
  }
  
  return 'new_account';
}

function getEmailFromPage() {
  // Try to find email input field
  const emailInputs = document.querySelectorAll('input[type="email"], input[name*="email" i], input[id*="email" i]');
  for (const input of emailInputs) {
    if (input.value && input.value.includes('@')) {
      return input.value.trim();
    }
  }
  return workspaceEmail;
}

/** Email to show in Save account modal: prefer the field the user was in when they clicked Save in Cerby. */
function getEmailForSaveModal() {
  const fromInput = currentInput && currentInput.value && currentInput.value.trim();
  if (fromInput) return fromInput;
  const fromModule = moduleElement && moduleElement.querySelector(`#${MODULE_EMAIL_TEXT_ID}`);
  const moduleEmail = fromModule && fromModule.textContent && fromModule.textContent.trim();
  if (moduleEmail) return moduleEmail;
  return getEmailFromPage();
}

function createSaveAccountModal(targetDoc) {
  const doc = targetDoc || document;
  const existing = doc.getElementById(SAVE_ACCOUNT_MODAL_ID);
  if (existing && existing.isConnected) {
    saveAccountModal = existing;
    return existing;
  }

  if (saveAccountModal && saveAccountModal.ownerDocument !== doc) {
    saveAccountModal = null;
  }
  if (saveAccountModal && !saveAccountModal.isConnected) {
    saveAccountModal = null;
  }

  const modal = doc.createElement('div');
  modal.id = SAVE_ACCOUNT_MODAL_ID;
  modal.className = 'cerby-save-account-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-labelledby', 'cerby-modal-title');
  modal.setAttribute('aria-modal', 'true');
  modal.style.display = 'none';

  const container = doc.createElement('div');
  container.className = 'cerby-save-account-modal__container';

  // Header
  const header = doc.createElement('div');
  header.className = 'cerby-save-account-modal__header';

  const headerContent = doc.createElement('div');
  headerContent.className = 'cerby-save-account-modal__header-content';

  const logoContainer = doc.createElement('div');
  logoContainer.className = 'cerby-save-account-modal__logo-container';

  const cerbyLogo = doc.createElement('img');
  cerbyLogo.className = 'cerby-save-account-modal__cerby-logo';
  cerbyLogo.alt = 'Cerby';
  cerbyLogo.src = chromeApi?.runtime?.getURL
    ? chromeApi.runtime.getURL('assets/cerby-logo-modal.svg')
    : 'assets/cerby-logo-modal.svg';

  logoContainer.appendChild(cerbyLogo);

  const title = doc.createElement('p');
  title.id = 'cerby-modal-title';
  title.className = 'cerby-save-account-modal__title';
  title.textContent = 'Save account?';

  headerContent.appendChild(logoContainer);
  headerContent.appendChild(title);
  
  // Store reference for width constraint
  modal._headerContent = headerContent;

  const closeButton = doc.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'cerby-save-account-modal__close-button';
  closeButton.setAttribute('aria-label', 'Close modal');
  closeButton.addEventListener('click', closeSaveAccountModal);

  const closeIcon = doc.createElement('div');
  closeIcon.className = 'cerby-save-account-modal__close-icon';
  closeButton.appendChild(closeIcon);

  header.appendChild(headerContent);
  header.appendChild(closeButton);

  // Tabs (Figma: Save new account | Update existing account)
  const tabs = doc.createElement('div');
  tabs.className = 'cerby-save-account-modal__tabs';
  const tabSaveNew = doc.createElement('button');
  tabSaveNew.type = 'button';
  tabSaveNew.className = 'cerby-save-account-modal__tab cerby-save-account-modal__tab--active';
  tabSaveNew.textContent = 'Save new account';
  tabSaveNew.setAttribute('aria-pressed', 'true');
  const tabUpdate = doc.createElement('button');
  tabUpdate.type = 'button';
  tabUpdate.className = 'cerby-save-account-modal__tab';
  tabUpdate.textContent = 'Update existing account';
  tabUpdate.setAttribute('aria-pressed', 'false');
  tabs.appendChild(tabSaveNew);
  tabs.appendChild(tabUpdate);
  tabSaveNew.addEventListener('click', () => {
    tabSaveNew.classList.add('cerby-save-account-modal__tab--active');
    tabSaveNew.setAttribute('aria-pressed', 'true');
    tabUpdate.classList.remove('cerby-save-account-modal__tab--active');
    tabUpdate.setAttribute('aria-pressed', 'false');
  });
  tabUpdate.addEventListener('click', () => {
    tabUpdate.classList.add('cerby-save-account-modal__tab--active');
    tabUpdate.setAttribute('aria-pressed', 'true');
    tabSaveNew.classList.remove('cerby-save-account-modal__tab--active');
    tabSaveNew.setAttribute('aria-pressed', 'false');
  });

  // Content
  const content = doc.createElement('div');
  content.className = 'cerby-save-account-modal__content';

  const fieldsContainer = doc.createElement('div');
  fieldsContainer.className = 'cerby-save-account-modal__fields';

  const accountRow = doc.createElement('div');
  accountRow.className = 'cerby-save-account-modal__account-row';

  const providerLogoContainer = doc.createElement('div');
  providerLogoContainer.className = 'cerby-save-account-modal__provider-logo-container';

  const providerLogo = doc.createElement('img');
  providerLogo.className = 'cerby-save-account-modal__provider-logo';
  providerLogo.alt = '';
  providerLogo.style.display = 'none';

  providerLogoContainer.appendChild(providerLogo);

  const accountNameContainer = doc.createElement('div');
  accountNameContainer.className = 'cerby-save-account-modal__account-name-container';

  const accountNameDetail = doc.createElement('div');
  accountNameDetail.className = 'cerby-save-account-modal__account-name-detail';

  const accountNameLabel = doc.createElement('p');
  accountNameLabel.className = 'cerby-save-account-modal__account-name-label';
  accountNameLabel.textContent = 'Account name*';

  const accountNameTextWrapper = doc.createElement('div');
  accountNameTextWrapper.className = 'cerby-save-account-modal__account-name-text-wrapper';

  const accountNameText = doc.createElement('p');
  accountNameText.className = 'cerby-save-account-modal__account-name-text';
  accountNameText.textContent = 'new_account';

  accountNameTextWrapper.appendChild(accountNameText);
  accountNameDetail.appendChild(accountNameLabel);
  accountNameDetail.appendChild(accountNameTextWrapper);

  // Hidden input for editing (shown when edit button is clicked)
  const accountNameInput = doc.createElement('input');
  accountNameInput.type = 'text';
  accountNameInput.className = 'cerby-save-account-modal__account-name-input';
  accountNameInput.value = 'new_account';
  accountNameInput.style.display = 'none';
  accountNameInput.setAttribute('aria-label', 'Account name');

  const editButton = doc.createElement('button');
  editButton.type = 'button';
  editButton.className = 'cerby-save-account-modal__edit-button';
  editButton.setAttribute('aria-label', 'Edit account name');
  editButton.addEventListener('click', function() {
    // Switch to input mode
    accountNameText.style.display = 'none';
    accountNameInput.style.display = 'block';
    accountNameInput.value = accountNameText.textContent;
    accountNameInput.focus();
    accountNameInput.select();
    
    // Update text when input loses focus
    accountNameInput.addEventListener('blur', function() {
      if (accountNameInput.value.trim()) {
        accountNameText.textContent = accountNameInput.value.trim();
      }
      accountNameText.style.display = 'block';
      accountNameInput.style.display = 'none';
    }, { once: true });
    
    // Also update on Enter key
    accountNameInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        accountNameInput.blur();
      }
    }, { once: true });
  });

  const editIcon = doc.createElement('img');
  editIcon.className = 'cerby-save-account-modal__edit-icon';
  editIcon.alt = '';
  editIcon.src = chromeApi?.runtime?.getURL
    ? chromeApi.runtime.getURL('assets/edit-icon.svg')
    : 'assets/edit-icon.svg';

  editButton.appendChild(editIcon);
  
  const accountNameRow = doc.createElement('div');
  accountNameRow.className = 'cerby-save-account-modal__account-name-row';
  accountNameRow.appendChild(accountNameDetail);
  accountNameRow.appendChild(editButton);

  accountNameContainer.appendChild(accountNameRow);
  accountNameContainer.appendChild(accountNameInput);

  accountRow.appendChild(providerLogoContainer);
  accountRow.appendChild(accountNameContainer);

  fieldsContainer.appendChild(accountRow);

  // Username / email* (Figma)
  const usernameLabel = doc.createElement('label');
  usernameLabel.className = 'cerby-save-account-modal__field-label';
  usernameLabel.textContent = 'Username / email*';
  const usernameInput = doc.createElement('input');
  usernameInput.type = 'text';
  usernameInput.className = 'cerby-save-account-modal__field-input';
  usernameInput.setAttribute('aria-label', 'Username or email');
  usernameInput.placeholder = '';
  const usernameRow = doc.createElement('div');
  usernameRow.className = 'cerby-save-account-modal__field-row';
  usernameRow.appendChild(usernameLabel);
  usernameRow.appendChild(usernameInput);
  fieldsContainer.appendChild(usernameRow);

  // Password* with visibility toggle, strength, Generate password (Figma)
  const passwordLabel = doc.createElement('label');
  passwordLabel.className = 'cerby-save-account-modal__field-label';
  passwordLabel.textContent = 'Password*';
  const passwordWrap = doc.createElement('div');
  passwordWrap.className = 'cerby-save-account-modal__password-wrap';
  const passwordInput = doc.createElement('input');
  passwordInput.type = 'password';
  passwordInput.className = 'cerby-save-account-modal__field-input cerby-save-account-modal__password-input';
  passwordInput.setAttribute('aria-label', 'Password');
  const visibilityBtn = doc.createElement('button');
  visibilityBtn.type = 'button';
  visibilityBtn.className = 'cerby-save-account-modal__password-toggle';
  visibilityBtn.setAttribute('aria-label', 'Show password');
  const visibilityIconUrl = chromeApi?.runtime?.getURL ? chromeApi.runtime.getURL('assets/visibility-icon.svg') : '';
  const visibilityImg = doc.createElement('img');
  visibilityImg.src = visibilityIconUrl;
  visibilityImg.alt = '';
  visibilityImg.className = 'cerby-save-account-modal__password-toggle-icon';
  visibilityBtn.appendChild(visibilityImg);
  visibilityBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    visibilityBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  });
  passwordWrap.appendChild(passwordInput);
  passwordWrap.appendChild(visibilityBtn);
  const passwordMeta = doc.createElement('div');
  passwordMeta.className = 'cerby-save-account-modal__password-meta';
  const strengthText = doc.createElement('span');
  strengthText.className = 'cerby-save-account-modal__password-strength';
  strengthText.textContent = 'Weak password';
  strengthText.setAttribute('data-strength', 'weak');
  function getPasswordStrengthLevel(p) {
    if (!p || p.length === 0) return 'weak';
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^a-zA-Z0-9]/.test(p)) score++;
    if (score <= 1) return 'weak';
    if (score <= 3) return 'fair';
    return 'strong';
  }
  function updatePasswordStrength() {
    const p = (passwordInput && passwordInput.value) || '';
    const level = getPasswordStrengthLevel(p);
    strengthText.textContent = level === 'weak' ? 'Weak password' : level === 'fair' ? 'Fair password' : 'Strong password';
    strengthText.setAttribute('data-strength', level);
    strengthText.className = 'cerby-save-account-modal__password-strength cerby-save-account-modal__password-strength--' + level;
  }
  passwordInput.addEventListener('input', updatePasswordStrength);
  passwordInput.addEventListener('change', updatePasswordStrength);
  const generateLink = doc.createElement('button');
  generateLink.type = 'button';
  generateLink.className = 'cerby-save-account-modal__generate-link';
  generateLink.textContent = 'Generate password';
  passwordMeta.appendChild(strengthText);
  passwordMeta.appendChild(generateLink);
  const passwordRow = doc.createElement('div');
  passwordRow.className = 'cerby-save-account-modal__field-row';
  passwordRow.appendChild(passwordLabel);
  passwordRow.appendChild(passwordWrap);
  passwordRow.appendChild(passwordMeta);
  fieldsContainer.appendChild(passwordRow);

  // URL* (Figma)
  const urlLabel = doc.createElement('label');
  urlLabel.className = 'cerby-save-account-modal__field-label';
  urlLabel.textContent = 'URL*';
  const urlInput = doc.createElement('input');
  urlInput.type = 'url';
  urlInput.className = 'cerby-save-account-modal__field-input';
  urlInput.setAttribute('aria-label', 'URL');
  urlInput.placeholder = 'www.example.com';
  const urlRow = doc.createElement('div');
  urlRow.className = 'cerby-save-account-modal__field-row';
  urlRow.appendChild(urlLabel);
  urlRow.appendChild(urlInput);
  fieldsContainer.appendChild(urlRow);

  content.appendChild(fieldsContainer);

  // Footer (Figma: Not now | Save account)
  const footer = doc.createElement('div');
  footer.className = 'cerby-save-account-modal__footer';

  const footerContent = doc.createElement('div');
  footerContent.className = 'cerby-save-account-modal__footer-content';

  const notNowButton = doc.createElement('button');
  notNowButton.type = 'button';
  notNowButton.className = 'cerby-save-account-modal__not-now-button';
  notNowButton.textContent = 'Not now';
  notNowButton.addEventListener('click', closeSaveAccountModal);

  const vaultDropdown = doc.createElement('div');
  vaultDropdown.className = 'cerby-save-account-modal__vault-dropdown';

  const vaultInput = doc.createElement('div');
  vaultInput.className = 'cerby-save-account-modal__vault-input';
  vaultInput.setAttribute('role', 'button');
  vaultInput.setAttribute('tabindex', '0');
  vaultInput.setAttribute('aria-label', 'Select vault');

  const vaultText = doc.createElement('p');
  vaultText.className = 'cerby-save-account-modal__vault-text';
  vaultText.textContent = 'Personal Vault';

  const chevronIcon = doc.createElement('img');
  chevronIcon.className = 'cerby-save-account-modal__chevron-icon';
  chevronIcon.alt = '';
  chevronIcon.src = chromeApi?.runtime?.getURL
    ? chromeApi.runtime.getURL('assets/chevron-down-icon.svg')
    : 'assets/chevron-down-icon.svg';

  vaultInput.appendChild(vaultText);
  vaultInput.appendChild(chevronIcon);
  vaultDropdown.appendChild(vaultInput);

  const saveButton = doc.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'cerby-save-account-modal__save-button';
  saveButton.textContent = 'Save account';
  saveButton.addEventListener('click', handleSaveAccount);

  const footerActions = doc.createElement('div');
  footerActions.className = 'cerby-save-account-modal__footer-actions';
  footerActions.appendChild(vaultDropdown);
  footerActions.appendChild(saveButton);

  footerContent.appendChild(notNowButton);
  footerContent.appendChild(footerActions);
  footer.appendChild(footerContent);

  container.appendChild(header);
  container.appendChild(tabs);
  container.appendChild(content);
  container.appendChild(footer);
  modal.appendChild(container);

  // Store references for prefilling and save
  modal._providerLogo = providerLogo;
  modal._accountNameText = accountNameText;
  modal._accountNameInput = accountNameInput;
  modal._editButton = editButton;
  modal._usernameInput = usernameInput;
  modal._passwordInput = passwordInput;
  modal._urlInput = urlInput;
  modal._updatePasswordStrength = updatePasswordStrength;

  // Add backdrop click handler
  modal.addEventListener('click', function(e) {
    if (modal.style.display !== 'none') {
      const container = modal.querySelector('.cerby-save-account-modal__container');
      // Close if clicking on the backdrop (the modal itself but not the container)
      if (e.target === modal || !container.contains(e.target)) {
        closeSaveAccountModal();
      }
    }
  });

  // Append to body so modal is on top and centered on full viewport; fallback to documentElement
  const root = doc.body || doc.documentElement;
  if (!root) {
    console.error('Cerby: No body or documentElement');
    return null;
  }

  try {
    root.appendChild(modal);
    saveAccountModal = modal;
    return modal;
  } catch (error) {
    console.error('Cerby: Error appending modal:', error);
    return null;
  }
}

function openSaveAccountModal(password, sourceElement) {
  // Use the document where the content script runs so injected CSS applies to the modal
  const doc = document;
  try {
    const modal = createSaveAccountModal(doc);
    if (!modal) {
      console.error('Cerby: Failed to create save account modal - modal is null');
      return;
    }

    const root = doc.body || doc.documentElement;
    if (!root) {
      console.error('Cerby: No body or documentElement');
      return;
    }
    if (!root.contains(modal)) {
      root.appendChild(modal);
    }
    // Move to end of body so it's on top of other nodes
    if (doc.body && modal.parentNode !== doc.body) {
      doc.body.appendChild(modal);
    }

    // Prefill (don't let errors here block showing the modal)
    try {
      const currentDomain = extractDomain(window.location.href);
      const email = getEmailForSaveModal();
      const accountName = extractAccountName(email);
      if (modal._accountNameText) modal._accountNameText.textContent = accountName;
      if (modal._accountNameInput) modal._accountNameInput.value = accountName;
      if (modal._providerLogo && currentDomain) {
        const logoUrl = getProviderLogoUrl(currentDomain);
        modal._providerLogo.src = logoUrl;
        modal._providerLogo.style.display = 'block';
        modal._providerLogo.onerror = function() {
          this.src = `https://www.google.com/s2/favicons?domain=${currentDomain}&sz=64`;
          this.onerror = null;
        };
      }
      if (modal._usernameInput) modal._usernameInput.value = email || '';
      if (modal._passwordInput) modal._passwordInput.value = password || '';
      if (modal._urlInput) modal._urlInput.value = currentDomain ? (currentDomain.startsWith('www.') ? currentDomain : 'www.' + currentDomain) : '';
      if (typeof modal._updatePasswordStrength === 'function') modal._updatePasswordStrength();
    } catch (prefillErr) {
      console.warn('Cerby: Prefill error (modal will still show):', prefillErr);
    }

    // Show modal - inline styles so it's visible even if CSS fails to load
    const container = modal.querySelector('.cerby-save-account-modal__container');
    modal.classList.add('cerby-save-account-modal--visible');
    modal.style.cssText = 'display:flex!important;visibility:visible!important;opacity:1!important;z-index:2147483647!important;position:fixed!important;inset:0!important;align-items:center;justify-content:center;background:rgba(0,0,0,.6);pointer-events:auto;';
    if (container) {
      container.style.cssText = 'display:flex!important;visibility:visible!important;opacity:1!important;position:relative;flex-direction:column;width:436px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #e3e8ee;border-radius:12px;box-shadow:0 18px 32px rgba(0,0,0,.16),0 5px 12px rgba(0,0,0,.12);pointer-events:auto;';
    }
    if (doc.body) doc.body.style.overflow = 'hidden';

    void modal.offsetHeight;

    // Check if modal is actually in the DOM and visible
    const modalInDOM = doc.getElementById(SAVE_ACCOUNT_MODAL_ID);
    const computedStyle = doc.defaultView ? doc.defaultView.getComputedStyle(modal) : window.getComputedStyle(modal);
    // Double-check modal is visible
    if (computedStyle.display === 'none') {
      console.error('Cerby: Modal display is still none! Forcing display...');
      modal.style.display = 'flex';
      modal.style.visibility = 'visible';
      modal.style.opacity = '1';
    }

    // Don't auto-focus, let user click edit button if needed
  } catch (error) {
    console.error('Cerby: Error in openSaveAccountModal:', error);
    console.error(error.stack);
  }
}

function closeSaveAccountModal() {
  if (!saveAccountModal) return;

  const doc = saveAccountModal.ownerDocument;
  saveAccountModal.classList.remove('cerby-save-account-modal--visible');
  saveAccountModal.style.display = 'none';
  if (doc && doc.body) {
    doc.body.style.overflow = '';
  }
}

function positionModal() {
  if (!saveAccountModal) return;
  // Modal is centered via CSS; no positioning override needed.
}

function handleSaveAccount() {
  if (!saveAccountModal) return;

  // Get account name from text or input (whichever is visible)
  const accountNameText = saveAccountModal._accountNameText?.textContent || '';
  const accountNameInputVal = saveAccountModal._accountNameInput?.value || '';
  const accountName = accountNameInputVal || accountNameText || 'new_account';

  const vault = saveAccountModal.querySelector('.cerby-save-account-modal__vault-text')?.textContent || 'Personal Vault';
  const email = saveAccountModal._usernameInput?.value?.trim() || getEmailFromPage();
  const password = saveAccountModal._passwordInput?.value || moduleElement?.querySelector(`#${MODULE_PASSWORD_TEXT_ID}`)?.dataset?.plainPassword || '';
  const url = saveAccountModal._urlInput?.value?.trim() || '';

  // TODO: Send message to background script to save account
  // Close modal
  closeSaveAccountModal();
}

// Close modal on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && saveAccountModal && saveAccountModal.style.display !== 'none') {
    closeSaveAccountModal();
  }
});


function associateModuleWithInput(module, input, moduleType = 'email') {
  const identifier = getOrAssignInlineId(input);
  module.setAttribute('data-for-input', identifier);
  module.dataset.forInput = identifier;
  // Store direct reference to input on module for easy access
  module._cerbyInput = input;
  if (moduleType === 'password') {
    input.dataset.cerbyInlinePasswordTouched = 'true';
  } else {
    input.dataset.cerbyInlineTouched = 'true';
  }
  attachInputListener(input);
}

function getOrAssignInlineId(element) {
  if (element.dataset.cerbyInlineId) {
    return element.dataset.cerbyInlineId;
  }

  const uniqueId = `cerby-inline-input-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  element.dataset.cerbyInlineId = uniqueId;
  return uniqueId;
}

function handleSettingsClick(event) {
  event.preventDefault();
  event.stopPropagation();

  if (chromeApi?.runtime?.sendMessage) {
    chromeApi.runtime.sendMessage({ type: 'cerby-inline-open-settings' }, () => {
      const lastError = chromeApi.runtime?.lastError;
      if (lastError) {
        // eslint-disable-next-line no-console
        console.warn('Cerby inline settings dispatch failed:', lastError.message);
      }
    });
  }
}

function handleEmailSuggestionClick(event) {
  event.preventDefault();
  event.stopPropagation();

  // Get the input - try direct reference first, then currentInput, then module reference
  let input = null;
  
  if (moduleElement && moduleElement._cerbyInput) {
    input = moduleElement._cerbyInput;
  } else if (currentInput) {
    input = currentInput;
  } else if (moduleElement) {
    const inputId = moduleElement.getAttribute('data-for-input');
    if (inputId) {
      const allInputs = document.querySelectorAll('input');
      for (const inp of allInputs) {
        if (inp.dataset.cerbyInlineId === inputId) {
          input = inp;
          break;
        }
      }
    }
  }
  
  if (!input || !(input instanceof HTMLInputElement)) {
    return;
  }

  // Focus first to ensure the input is active
  input.focus();
  
  // Set the value using native setter to trigger React/Vue/etc listeners
  try {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(input, workspaceEmail);
    } else {
      input.value = workspaceEmail;
    }
  } catch (e) {
    // Fallback to direct assignment
    input.value = workspaceEmail;
  }
  
  // Create and dispatch input event
  const inputEvent = new Event('input', { bubbles: true, cancelable: true });
  input.dispatchEvent(inputEvent);
  
  // Also dispatch change event
  const changeEvent = new Event('change', { bubbles: true, cancelable: true });
  input.dispatchEvent(changeEvent);
  
  // Set cursor position
  if (input.setSelectionRange) {
    try {
      input.setSelectionRange(workspaceEmail.length, workspaceEmail.length);
    } catch (e) {
      // Ignore errors
    }
  }
}

function handleSaveInCerbyClick(event) {
  const target = event.target;
  // Match the Save in Cerby button, or any click on the module when it's in "save" state (only state where that button is visible)
  let saveBtn = target && target.closest && target.closest('.cerby-inline-module__save-button');
  let moduleInSaveState = target && target.closest && target.closest('.cerby-inline-module[data-state="save"]');
  // Also match "Save new account" row in the login dropdown (click may be retargeted to a LABEL or other element)
  const saveNewRow = target && target.closest && target.closest('.cerby-inline-account-dropdown__save-new');
  if (saveNewRow) {
    event.preventDefault();
    event.stopPropagation();
    hideInlineAccountDropdown();
    const passwordFromPage = document.querySelector('input[type="password"]')?.value || '';
    openSaveAccountModal(passwordFromPage, saveNewRow);
    return;
  }

  // Fallback: if target is something else (e.g. page LABEL), check if click coordinates are inside our UI
  if (!saveBtn && !moduleInSaveState && event.clientX != null && event.clientY != null) {
    const x = event.clientX;
    const y = event.clientY;
    const inRect = (el) => {
      if (!el || !el.getBoundingClientRect) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    const saveButtonEl = document.querySelector('.cerby-inline-module__save-button');
    const moduleSaveEl = document.querySelector('.cerby-inline-module[data-state="save"]');
    const saveNewEl = document.querySelector('.cerby-inline-account-dropdown__save-new');
    if (saveButtonEl && inRect(saveButtonEl)) saveBtn = saveButtonEl;
    else if (moduleSaveEl && inRect(moduleSaveEl)) moduleInSaveState = moduleSaveEl;
    else if (saveNewEl && inRect(saveNewEl)) {
      event.preventDefault();
      event.stopPropagation();
      hideInlineAccountDropdown();
      const passwordFromPage = document.querySelector('input[type="password"]')?.value || '';
      openSaveAccountModal(passwordFromPage, saveNewEl);
      return;
    }
  }

  if (!saveBtn && !moduleInSaveState) return;

  event.preventDefault();
  event.stopPropagation();

  hideModule();
  hideInlineAccountDropdown();
  const password = moduleElement?.querySelector(`#${MODULE_PASSWORD_TEXT_ID}`)?.dataset?.plainPassword || '';
  openSaveAccountModal(password, event.target);
}

function handleSaveClick(event) {
  event.preventDefault();
  event.stopPropagation();

  hideModule();
  hideInlineAccountDropdown();
  const password = moduleElement?.querySelector(`#${MODULE_PASSWORD_TEXT_ID}`)?.dataset?.plainPassword || '';
  openSaveAccountModal(password, moduleElement || event.target);
}

function handleViewportChange() {
  const moduleVisible = moduleElement && currentInput && moduleElement.classList.contains('cerby-inline-module--visible');
  const dropdownVisible = inlineAccountDropdown && currentInput && inlineAccountDropdown.classList.contains('cerby-inline-account-dropdown--visible');
  if (!moduleVisible && !dropdownVisible) return;
  if (pendingViewportUpdate) return;
  pendingViewportUpdate = true;
  requestAnimationFrame(() => {
    pendingViewportUpdate = false;
    updateModulePosition();
    if (dropdownVisible) updateInlineAccountDropdownPosition();
  });
}

function updateModulePosition() {
  if (!moduleElement || !currentInput) {
    return;
  }

  const rect = currentInput.getBoundingClientRect();
  if (!rect || rect.width === 0 && rect.height === 0) {
    hideModule();
    return;
  }

  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const viewportWidth = document.documentElement?.clientWidth || window.innerWidth || 0;

  const width = Math.min(rect.width, 360);
  moduleElement.style.width = `${width}px`;

  const viewportPadding = 8;
  let left = rect.left + scrollX;
  const rightEdge = scrollX + viewportWidth;

  if (left + width > rightEdge - viewportPadding) {
    left = Math.max(scrollX + viewportPadding, rightEdge - width - viewportPadding);
  } else {
    left = Math.max(scrollX + viewportPadding, left);
  }

  const top = rect.bottom + scrollY + MODULE_OFFSET;

  moduleElement.style.top = `${top}px`;
  moduleElement.style.left = `${left}px`;
}

// --- Inline Account Dropdown (login pages: pick account to fill email/password) ---
const inlineProviderDomainMap = {
  'Make': 'make.com', 'Mailchimp': 'mailchimp.com', 'Loom': 'loom.com', 'Pinterest': 'pinterest.com',
  'OpenAI': 'openai.com', 'Apple': 'apple.com', 'Spotify': 'spotify.com', 'Bitso': 'bitso.com',
  'Capital One': 'capitalone.com', 'Cursor': 'cursor.sh', 'Grammarly': 'grammarly.com', 'Google': 'google.com',
  'Notion': 'notion.so', 'Figma': 'figma.com', 'Atlassian': 'atlassian.com', 'Dropbox': 'dropbox.com',
  'Adobe': 'adobe.com', 'HubSpot': 'hubspot.com', 'Salesforce': 'salesforce.com'
};

function getDomainFromService(serviceName) {
  if (!serviceName) return null;
  if (inlineProviderDomainMap[serviceName]) return inlineProviderDomainMap[serviceName];
  return (serviceName.toLowerCase().replace(/\s+/g, '') || 'unknown') + '.com';
}

async function tryShowInlineAccountDropdown(input, fieldType) {
  if (!document.body || !chromeApi?.storage?.local) return;
  /* Do not show the inline menu over the provider accounts modal (it's not a login form context) */
  if (expandedAccountsModal) return;
  const currentDomain = extractDomain(window.location.href);
  if (!currentDomain) return;

  const result = await chromeApi.storage.local.get(['accounts']);
  const accounts = Array.isArray(result?.accounts) ? result.accounts : [];
  const matching = accounts.filter(acc => {
    const providerDomain = inlineProviderDomainMap[acc.service];
    return providerDomain && currentDomain === providerDomain;
  });
  if (matching.length === 0) return;

  hideInlineAccountDropdown();
  const dropdown = createInlineAccountDropdown(matching, input, fieldType);
  if (!dropdown) return;

  document.body.appendChild(dropdown);
  inlineAccountDropdown = dropdown;
  dropdown._cerbyInput = input;
  dropdown._fieldType = fieldType;
  currentInput = input;

  requestAnimationFrame(() => {
    updateInlineAccountDropdownPosition();
    dropdown.classList.add('cerby-inline-account-dropdown--visible');
  });
}

function hideInlineAccountDropdown() {
  if (inlineAccountDropdown) {
    const input = inlineAccountDropdown._cerbyInput;
    if (input && inlineAccountDropdown._cerbyInputFilterHandler) {
      input.removeEventListener('input', inlineAccountDropdown._cerbyInputFilterHandler);
    }
    inlineAccountDropdown.remove();
    inlineAccountDropdown = null;
  }
}

function createInlineAccountDropdown(accounts, input, fieldType) {
  const getUrl = (path) => (chromeApi?.runtime?.getURL ? chromeApi.runtime.getURL(path) : path);
  const searchUrl = getUrl('assets/search-icon.svg');
  const settingsUrl = getUrl('assets/inline-settings-icon.svg');
  const openNewUrl = getUrl('assets/open-new-icon.svg');
  const infoIconUrl = getUrl('assets/info-icon.svg');
  const makeLogoUrl = 'https://cdn.brandfetch.io/idVHU5hl7_/theme/light/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1690469461407';

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  const dropdown = document.createElement('div');
  dropdown.id = INLINE_ACCOUNT_DROPDOWN_ID;
  dropdown.className = 'cerby-inline-account-dropdown';
  dropdown.setAttribute('role', 'listbox');
  dropdown.setAttribute('aria-label', 'Cerby accounts');

  const header = document.createElement('div');
  header.className = 'cerby-inline-account-dropdown__header';
  header.innerHTML = `
    <button type="button" class="cerby-inline-account-dropdown__search-btn" aria-label="Search">
      <img src="${escapeHtml(searchUrl)}" alt="" class="cerby-inline-account-dropdown__icon">
    </button>
    <div class="cerby-inline-account-dropdown__header-right">
      <button type="button" class="cerby-inline-account-dropdown__settings-btn" aria-label="Settings">
        <img src="${escapeHtml(settingsUrl)}" alt="" class="cerby-inline-account-dropdown__icon">
      </button>
      <button type="button" class="cerby-inline-account-dropdown__expand-btn" aria-label="Open in Cerby">
        <img src="${escapeHtml(openNewUrl)}" alt="" class="cerby-inline-account-dropdown__icon">
      </button>
    </div>`;
  dropdown.appendChild(header);

  header.querySelector('.cerby-inline-account-dropdown__settings-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (chromeApi?.runtime?.sendMessage) {
      chromeApi.runtime.sendMessage({ type: 'cerby-inline-open-settings' });
    }
  });
  const expandBtn = header.querySelector('.cerby-inline-account-dropdown__expand-btn');
  expandBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const accounts = dropdown._cerbyAccounts || [];
    const input = dropdown._cerbyInput;
    const fieldType = dropdown._cerbyFieldType || 'email';
    hideInlineAccountDropdown();
    if (accounts.length && input) {
      showExpandedAccountsModal(accounts, input, fieldType);
    }
  });

  const list = document.createElement('div');
  list.className = 'cerby-inline-account-dropdown__list';

  function appendAccountItem(acc) {
    const isMake = acc.service === 'Make';
    const favicon = isMake ? makeLogoUrl : (acc.logoUrl || `https://icons.duckduckgo.com/ip3/${getDomainFromService(acc.service) || ''}.ico`);
    const placeholderClass = isMake ? 'cerby-inline-account-dropdown__logo cerby-inline-account-dropdown__logo--make' : 'cerby-inline-account-dropdown__logo';

    const item = document.createElement('div');
    item.className = 'cerby-inline-account-dropdown__item';
    item.setAttribute('role', 'option');
    item.dataset.service = acc.service || '';
    item.dataset.name = acc.name || '';
    item.dataset.email = acc.email || '';
    item.innerHTML = `
      <div class="cerby-inline-account-dropdown__item-main">
        <div class="${placeholderClass}">
          <img src="${escapeHtml(favicon)}" alt="${escapeHtml(acc.service)}" class="cerby-inline-account-dropdown__app-logo" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
          <span class="cerby-inline-account-dropdown__logo-fallback" style="display:none;">${(acc.service || '?').charAt(0)}</span>
        </div>
        <div class="cerby-inline-account-dropdown__item-info">
          <span class="cerby-inline-account-dropdown__item-name">${escapeHtml(acc.name || '')}</span>
          <span class="cerby-inline-account-dropdown__item-email">${escapeHtml(acc.email || acc.name || '')}</span>
        </div>
      </div>
      <button type="button" class="cerby-inline-account-dropdown__item-info-btn" aria-label="Account details">
        <img src="${escapeHtml(infoIconUrl)}" alt="" class="cerby-inline-account-dropdown__item-info-icon">
      </button>`;

    const mainArea = item.querySelector('.cerby-inline-account-dropdown__item-main');
    const infoBtn = item.querySelector('.cerby-inline-account-dropdown__item-info-btn');

    mainArea.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleInlineAccountSelect(acc, input, fieldType);
      hideInlineAccountDropdown();
    });
    infoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (chromeApi?.runtime?.sendMessage) {
        chromeApi.runtime.sendMessage({ type: 'cerby-inline-open-panel' });
      }
    });

    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (e.target === infoBtn) return;
        handleInlineAccountSelect(acc, input, fieldType);
        hideInlineAccountDropdown();
      }
    });
    list.appendChild(item);
  }

  // "Save new account" row (shown on login): open save account modal
  const saveNewRow = document.createElement('button');
  saveNewRow.type = 'button';
  saveNewRow.className = 'cerby-inline-account-dropdown__item cerby-inline-account-dropdown__save-new';
  saveNewRow.setAttribute('role', 'option');
  saveNewRow.innerHTML = `
    <div class="cerby-inline-account-dropdown__item-main">
      <div class="cerby-inline-account-dropdown__logo cerby-inline-account-dropdown__logo--save-new">
        <img src="${escapeHtml(getUrl('assets/cerby-logo-modal.svg'))}" alt="Cerby" class="cerby-inline-account-dropdown__app-logo">
      </div>
      <div class="cerby-inline-account-dropdown__item-info">
        <span class="cerby-inline-account-dropdown__item-name">Save new account</span>
        <span class="cerby-inline-account-dropdown__item-email">Save in Cerby</span>
      </div>
    </div>`;
  saveNewRow.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideInlineAccountDropdown();
    const passwordFromPage = document.querySelector('input[type="password"]')?.value || '';
    openSaveAccountModal(passwordFromPage, e.target);
  });
  saveNewRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      hideInlineAccountDropdown();
      const passwordFromPage = document.querySelector('input[type="password"]')?.value || '';
      openSaveAccountModal(passwordFromPage, e.target);
    }
  });

  function filterAndRender(term) {
    const lower = (term || '').toLowerCase().trim();
    const toShow = lower
      ? accounts.filter(acc =>
          (acc.name || '').toLowerCase().includes(lower) ||
          (acc.email || '').toLowerCase().includes(lower) ||
          (acc.service || '').toLowerCase().includes(lower))
      : accounts;

    if (toShow.length === 0 && lower.length > 0) {
      hideInlineAccountDropdown();
      showModule(input, fieldType);
      setModuleState('save');
      moduleElement.dataset.cerbyFromLoginPage = '1';
      return;
    }

    list.innerHTML = '';
    toShow.forEach(appendAccountItem);
    list.appendChild(saveNewRow);
  }

  filterAndRender(input?.value?.trim() || '');

  dropdown._cerbyAccounts = accounts;
  dropdown._cerbyFieldType = fieldType;
  dropdown._cerbyInputFilterHandler = () => {
    if (!inlineAccountDropdown || inlineAccountDropdown !== dropdown) return;
    filterAndRender(input?.value?.trim() || '');
  };
  input?.addEventListener('input', dropdown._cerbyInputFilterHandler);

  dropdown.appendChild(list);

  // Scroll-to-hide header: hide when scrolling down (browsing), show when scrolling up (searching)
  const SCROLL_DOWN_THRESHOLD = 24;
  const SCROLL_UP_THRESHOLD = 150; // ~3 cards: show header as soon as user scrolls up this much
  let lastScrollTop = 0;
  list.addEventListener('scroll', () => {
    const st = list.scrollTop;
    if (st > SCROLL_DOWN_THRESHOLD) {
      dropdown.classList.add('cerby-inline-account-dropdown--header-hidden');
      // Show header as soon as user scrolls up by ~3 cards, don't wait for top
      if (lastScrollTop - st > SCROLL_UP_THRESHOLD) {
        dropdown.classList.remove('cerby-inline-account-dropdown--header-hidden');
      }
    } else {
      dropdown.classList.remove('cerby-inline-account-dropdown--header-hidden');
    }
    lastScrollTop = st;
  });

  return dropdown;
}

async function handleInlineAccountSelect(account, input, fieldType) {
  if (!input || !(input instanceof HTMLInputElement)) return;

  const value = fieldType === 'email' ? (account.email || account.name || '') : '';

  if (fieldType === 'email') {
    fillInputValue(input, value);
    return;
  }

  if (fieldType === 'password') {
    const service = account.service;
    const email = account.email || account.name || '';
    return new Promise(resolve => {
      chromeApi.runtime.sendMessage(
        { action: 'getAccountCredentials', service, email },
        (response) => {
          const creds = response || {};
          const password = creds.password || '';
          if (password) fillInputValue(input, password);
          resolve();
        }
      );
    });
  }
}

function fillInputValue(input, value) {
  input.focus();
  try {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }
  } catch (e) {
    input.value = value;
  }
  const inputEvent = new Event('input', { bubbles: true, cancelable: true });
  input.dispatchEvent(inputEvent);
  const changeEvent = new Event('change', { bubbles: true, cancelable: true });
  input.dispatchEvent(changeEvent);
  if (input.setSelectionRange) {
    try {
      input.setSelectionRange(value.length, value.length);
    } catch (e) {}
  }
}

function updateInlineAccountDropdownPosition() {
  if (!inlineAccountDropdown) return;
  const input = currentInput || inlineAccountDropdown._cerbyInput;
  if (!input) return;

  const rect = input.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    hideInlineAccountDropdown();
    return;
  }

  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const viewportWidth = document.documentElement?.clientWidth || window.innerWidth || 0;
  const width = 320;
  const viewportPadding = 8;

  let left = rect.left + scrollX;
  if (left + width > scrollX + viewportWidth - viewportPadding) {
    left = Math.max(scrollX + viewportPadding, scrollX + viewportWidth - width - viewportPadding);
  }
  left = Math.max(scrollX + viewportPadding, Math.min(left, scrollX + viewportWidth - width - viewportPadding));

  const top = rect.bottom + scrollY + MODULE_OFFSET;

  inlineAccountDropdown.style.top = `${top}px`;
  inlineAccountDropdown.style.left = `${left}px`;
  inlineAccountDropdown.style.width = `${width}px`;
}

function attachInputListener(input) {
  if (detachInputListener) {
    detachInputListener();
    detachInputListener = null;
  }

  const handleInputChange = () => {
    updateModuleStateForValue(input.value);
  };

  input.addEventListener('input', handleInputChange);
  detachInputListener = () => {
    input.removeEventListener('input', handleInputChange);
    detachInputListener = null;
  };

  updateModuleStateForValue(input.value);
}

function updateModuleStateForValue(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  const moduleType = moduleElement?.dataset?.moduleType || 'email';
  
  if (moduleType === 'password') {
    const passwordNode = moduleElement?.querySelector(`#${MODULE_PASSWORD_TEXT_ID}`);
    const generatedPassword = passwordNode?.dataset?.plainPassword || '';
    if (!trimmed || trimmed === generatedPassword) {
      if (moduleElement.dataset.cerbyFromLoginPage === '1') {
        delete moduleElement.dataset.cerbyFromLoginPage;
        const inp = moduleElement._cerbyInput;
        const modType = moduleElement.dataset.moduleType || 'email';
        hideModule();
        if (inp) tryShowInlineAccountDropdown(inp, modType);
        return;
      }
      setModuleState('suggestion');
    } else {
      setModuleState('save');
    }
  } else {
    // For email fields, check if value matches workspace email
    const emailLower = workspaceEmail?.trim().toLowerCase() || '';
    const valueLower = trimmed.toLowerCase();

    if (!trimmed || valueLower === emailLower) {
      if (moduleElement.dataset.cerbyFromLoginPage === '1') {
        delete moduleElement.dataset.cerbyFromLoginPage;
        const inp = moduleElement._cerbyInput;
        const modType = moduleElement.dataset.moduleType || 'email';
        hideModule();
        if (inp) tryShowInlineAccountDropdown(inp, modType);
        return;
      }
      setModuleState('suggestion');
    } else {
      setModuleState('save');
    }
  }
}

function setModuleState(state) {
  if (!moduleElement) {
    return;
  }
  const normalized = state === 'save' ? 'save' : 'suggestion';
  moduleElement.dataset.state = normalized;
}

// Bad Credentials Warning Overlay
const BAD_CREDENTIALS_OVERLAY_ID = 'cerby-bad-credentials-overlay';
let badCredentialsOverlay = null;

// Listen for messages from popup - set up early
if (chromeApi?.runtime?.onMessage) {
  chromeApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showBadCredentialsWarning') {
      showBadCredentialsWarning(message.accountService);
      sendResponse({ success: true });
    } else if (message.action === 'dismissBadCredentialsWarning') {
      hideBadCredentialsWarning();
      sendResponse({ success: true });
    } else if (message.action === 'fillAccountFromPanel') {
      const { account, fieldType } = message;
      if (account && currentInput) {
        handleInlineAccountSelect(account, currentInput, fieldType || 'email');
        hideInlineAccountDropdown();
      }
      sendResponse({ success: true });
    }
    return true; // Keep channel open for async response
  });
}

function showBadCredentialsWarning(accountService) {
  
  if (badCredentialsOverlay) {
    return; // Already showing
  }

  // Ensure body exists
  if (!document.body) {
    setTimeout(() => showBadCredentialsWarning(accountService), 100);
    return;
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = BAD_CREDENTIALS_OVERLAY_ID;
  overlay.className = 'cerby-bad-credentials-overlay';
  
  const iconUrl = chromeApi.runtime.getURL('assets/bad-credentials-icon.svg');
  
  overlay.innerHTML = `
    <div class="cerby-bad-credentials-overlay-content">
      <div class="cerby-bad-credentials-overlay-icon-container">
        <div class="cerby-bad-credentials-overlay-spinner">
          <div class="cerby-bad-credentials-overlay-icon-wrapper">
            <img src="${iconUrl}" alt="Warning" class="cerby-bad-credentials-overlay-icon">
          </div>
        </div>
      </div>
      <div class="cerby-bad-credentials-overlay-body">
        <div class="cerby-bad-credentials-overlay-text-section">
          <h2 class="cerby-bad-credentials-overlay-heading">Review your account configuration</h2>
          <div class="cerby-bad-credentials-overlay-description">
            <p class="cerby-bad-credentials-overlay-text">
              <span>We've detected multiple unsuccessful login attempts for this account because </span>
              <strong>the login credentials are incorrect.</strong>
              <br><br>
              <span>Please update the credentials in Cerby to log in and prevent further failures.</span>
            </p>
            <p class="cerby-bad-credentials-overlay-last-login">
              <strong>Last successful login:</strong> <span>2 days ago</span>
            </p>
          </div>
        </div>
        <div class="cerby-bad-credentials-overlay-actions">
          <button class="cerby-bad-credentials-overlay-button cerby-bad-credentials-overlay-button-secondary" id="cerbyBadCredentialsTryAnyway">
            Try anyway
          </button>
          <button class="cerby-bad-credentials-overlay-button cerby-bad-credentials-overlay-button-primary" id="cerbyBadCredentialsReview">
            Review account
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  badCredentialsOverlay = overlay;
  
  // Add button handlers
  const tryAnywayBtn = overlay.querySelector('#cerbyBadCredentialsTryAnyway');
  const reviewBtn = overlay.querySelector('#cerbyBadCredentialsReview');
  
  if (tryAnywayBtn) {
    tryAnywayBtn.addEventListener('click', () => {
      showLoggingInState(overlay);
    });
  }
  
  if (reviewBtn) {
    reviewBtn.addEventListener('click', () => {
      hideBadCredentialsWarning();
      // Open extension popup - this will need to be handled by the extension
      if (chromeApi?.runtime?.sendMessage) {
        chromeApi.runtime.sendMessage({ action: 'openAccountDetails', accountService });
      }
    });
  }
}

function showLoggingInState(overlay) {
  
  const logoUrl = chromeApi.runtime.getURL('assets/cerby-logo-modal.svg');
  const spinnerUrl = chromeApi.runtime.getURL('assets/spinner-base.svg');
  
  // Update overlay content to loading state
  const content = overlay.querySelector('.cerby-bad-credentials-overlay-content');
  if (!content) return;
  
  content.innerHTML = `
    <div class="cerby-bad-credentials-overlay-icon-container">
      <div class="cerby-bad-credentials-overlay-spinner">
        <div class="cerby-bad-credentials-overlay-spinner-base">
          <img src="${spinnerUrl}" alt="Spinner" />
        </div>
        <div class="cerby-bad-credentials-overlay-logo">
          <img src="${logoUrl}" alt="Cerby" />
        </div>
      </div>
    </div>
    <div class="cerby-bad-credentials-overlay-body">
      <div class="cerby-bad-credentials-overlay-text-section">
        <h2 class="cerby-bad-credentials-overlay-heading">Logging you in...</h2>
        <div class="cerby-bad-credentials-overlay-description">
          <p class="cerby-bad-credentials-overlay-text">
            We are launching your login...
          </p>
        </div>
      </div>
    </div>
  `;
  
  // Add loading class to overlay
  overlay.classList.add('loading');
  
  // Remove overlay after 4 seconds
  setTimeout(() => {
    hideBadCredentialsWarning();
  }, 4000);
}

function hideBadCredentialsWarning() {
  if (badCredentialsOverlay) {
    badCredentialsOverlay.remove();
    badCredentialsOverlay = null;
  }
}

// --- Expanded accounts modal (top-right, same style as login suggestion - opened from inline dropdown expand) ---
const CERBY_EXPANDED_ACCOUNTS_MODAL_ID = 'cerby-expanded-accounts-modal';
let expandedAccountsModal = null;

function showExpandedAccountsModal(accounts, input, fieldType) {
  if (!document.body || !accounts.length) return;
  hideExpandedAccountsModal();
  hideLoginSuggestionModal();

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  const cerbyLogoUrl = chromeApi?.runtime?.getURL ? chromeApi.runtime.getURL('assets/cerby-logo-modal.svg') : '';
  const ssoIconUrl = chromeApi?.runtime?.getURL ? chromeApi.runtime.getURL('assets/sso-icon.svg') : '';
  const closeIconUrl = chromeApi?.runtime?.getURL ? chromeApi.runtime.getURL('assets/clear-icon.svg') : '';
  const loginIconUrl = chromeApi?.runtime?.getURL ? chromeApi.runtime.getURL('assets/login-icon.svg') : '';
  const makeLogoUrl = 'https://cdn.brandfetch.io/idVHU5hl7_/theme/light/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1690469461407';
  const domainForFavicon = (service) => {
    const d = getDomainFromService(service);
    return d ? `https://icons.duckduckgo.com/ip3/${d}.ico` : '';
  };

  const provider = accounts[0]?.service || 'Accounts';
  const cardsHtml = accounts.map((acc, i) => {
    const isMake = acc.service === 'Make';
    const favicon = isMake ? makeLogoUrl : (acc.logoUrl || domainForFavicon(acc.service));
    const placeholderClass = isMake
      ? 'cerby-login-suggestion-logo-placeholder cerby-login-suggestion-make-logo'
      : 'cerby-login-suggestion-logo-placeholder';
    const imgClass = isMake
      ? 'cerby-login-suggestion-app-logo cerby-login-suggestion-app-logo-make'
      : 'cerby-login-suggestion-app-logo';
    const ssoChip = acc.hasSso
      ? `<div class="cerby-login-suggestion-card-badge cerby-login-suggestion-sso"><img src="${ssoIconUrl}" alt="" class="cerby-login-suggestion-sso-icon"><span class="cerby-login-suggestion-sso-text">SSO</span></div>`
      : '';
    return `
      <button type="button" class="cerby-login-suggestion-card" data-service="${escapeHtml(acc.service)}" data-name="${escapeHtml(acc.name || '')}" data-email="${escapeHtml(acc.email || '')}" data-index="${i}">
        <div class="cerby-login-suggestion-card-logo">
          <div class="${placeholderClass}">
            <img src="${escapeHtml(favicon)}" alt="${escapeHtml(acc.service)}" class="${imgClass}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
            <span class="cerby-login-suggestion-logo-fallback" style="display:none;">${(acc.service || '?').charAt(0)}</span>
          </div>
        </div>
        <div class="cerby-login-suggestion-card-info">
          <p class="cerby-login-suggestion-name">${escapeHtml(acc.name || '')}</p>
          <p class="cerby-login-suggestion-email">${escapeHtml(acc.email || '')}</p>
        </div>
        <div class="cerby-login-suggestion-card-right">
          ${ssoChip}
          <span class="cerby-login-suggestion-auto-login">
            <img src="${loginIconUrl}" alt="" class="cerby-login-suggestion-login-icon">
            <span class="cerby-login-suggestion-auto-login-text">Auto-login</span>
          </span>
        </div>
      </button>`;
  }).join('');

  const searchIconUrl = chromeApi?.runtime?.getURL ? chromeApi.runtime.getURL('assets/search-icon.svg') : '';

  const modal = document.createElement('div');
  modal.id = CERBY_EXPANDED_ACCOUNTS_MODAL_ID;
  modal.className = 'cerby-login-suggestion-modal cerby-expanded-accounts-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', provider + ' accounts');

  modal.innerHTML = `
    <div class="cerby-login-suggestion-modal-inner">
      <div class="cerby-login-suggestion-header">
        <div class="cerby-login-suggestion-header-left">
          <img src="${cerbyLogoUrl}" alt="Cerby" class="cerby-login-suggestion-cerby-logo">
          <h2 class="cerby-login-suggestion-heading">${escapeHtml(provider)} accounts</h2>
        </div>
        <button type="button" class="cerby-login-suggestion-close" id="cerbyExpandedAccountsClose" aria-label="Close">
          <img src="${closeIconUrl}" alt="" class="cerby-login-suggestion-close-icon">
        </button>
      </div>
      <div class="cerby-expanded-accounts-modal__search">
        <img src="${searchIconUrl}" alt="" class="cerby-expanded-accounts-modal__search-icon" aria-hidden="true">
        <input type="text" class="cerby-expanded-accounts-modal__search-input" placeholder="Search accounts" aria-label="Search accounts" autocomplete="off">
      </div>
      <div class="cerby-login-suggestion-list" id="cerbyExpandedAccountsList">
        ${cardsHtml}
      </div>
    </div>`;

  document.body.appendChild(modal);
  expandedAccountsModal = modal;

  requestAnimationFrame(() => {
    if (expandedAccountsModal === modal) {
      modal.classList.add('cerby-login-suggestion-modal-visible');
    }
  });

  const listEl = modal.querySelector('#cerbyExpandedAccountsList');
  const searchInput = modal.querySelector('.cerby-expanded-accounts-modal__search-input');
  function filterExpandedAccounts() {
    const term = (searchInput?.value || '').toLowerCase().trim();
    modal.querySelectorAll('.cerby-login-suggestion-card').forEach((btn) => {
      const name = (btn.dataset.name || '').toLowerCase();
      const email = (btn.dataset.email || '').toLowerCase();
      const service = (btn.dataset.service || '').toLowerCase();
      const match = !term || name.includes(term) || email.includes(term) || service.includes(term);
      btn.style.display = match ? '' : 'none';
    });
  }
  searchInput?.addEventListener('input', filterExpandedAccounts);
  searchInput?.addEventListener('keydown', (e) => e.stopPropagation());

  modal.querySelector('#cerbyExpandedAccountsClose')?.addEventListener('click', () => hideExpandedAccountsModal());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hideExpandedAccountsModal();
  });
  modal.querySelectorAll('.cerby-login-suggestion-card').forEach((btn, i) => {
    const acc = accounts[i];
    if (!acc) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleInlineAccountSelect(acc, input, fieldType);
      hideExpandedAccountsModal();
    });
  });
}

function hideExpandedAccountsModal() {
  if (expandedAccountsModal) {
    expandedAccountsModal.remove();
    expandedAccountsModal = null;
  }
}

// --- Login Suggestion Modal (floating top-right, like Google "Sign in with Gmail") ---
const CERBY_LOGIN_SUGGESTION_MODAL_ID = 'cerby-login-suggestion-modal';
const providerDomainMap = {
  'Make': 'make.com', 'Mailchimp': 'mailchimp.com', 'Loom': 'loom.com', 'Pinterest': 'pinterest.com',
  'OpenAI': 'openai.com', 'Apple': 'apple.com', 'Spotify': 'spotify.com', 'Bitso': 'bitso.com',
  'Capital One': 'capitalone.com', 'Cursor': 'cursor.sh', 'Grammarly': 'grammarly.com', 'Google': 'google.com',
  'Notion': 'notion.so', 'Figma': 'figma.com', 'Atlassian': 'atlassian.com', 'Dropbox': 'dropbox.com',
  'Adobe': 'adobe.com', 'HubSpot': 'hubspot.com', 'Salesforce': 'salesforce.com'
};

function extractDomainFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {
    return null;
  }
}

function getDomainFromServiceName(serviceName) {
  if (!serviceName) return null;
  if (providerDomainMap[serviceName]) return providerDomainMap[serviceName];
  const n = serviceName.toLowerCase().replace(/\s+/g, '');
  return n + '.com';
}

function isLoginPage() {
  const path = (window.location.pathname || '').toLowerCase();
  const search = (window.location.search || '').toLowerCase();
  return /\/login|\/signin|\/sign-in|\/log-in|\/auth/.test(path) || search.includes('login') || search.includes('signin');
}

let loginSuggestionModal = null;

async function tryShowLoginSuggestionModal() {
  if (!document.body || !chromeApi?.storage?.local) return;
  if (loginSuggestionModal) return;
  if (!isLoginPage()) return;

  const currentDomain = extractDomainFromUrl(window.location.href);
  if (!currentDomain) return;

  const result = await chromeApi.storage.local.get(['accounts']);
  const accounts = Array.isArray(result?.accounts) ? result.accounts : [];
  const matching = accounts.filter(acc => {
    const providerDomain = providerDomainMap[acc.service];
    return providerDomain && currentDomain === providerDomain;
  });
  if (matching.length === 0) return;

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  const cerbyLogoUrl = chromeApi.runtime.getURL('assets/cerby-logo-modal.svg');
  const ssoIconUrl = chromeApi.runtime.getURL('assets/sso-icon.svg');
  const closeIconUrl = chromeApi.runtime.getURL('assets/clear-icon.svg');
  const loginIconUrl = chromeApi.runtime.getURL('assets/login-icon.svg');
  const makeLogoUrl = 'https://cdn.brandfetch.io/idVHU5hl7_/theme/light/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1690469461407';
  const domainForFavicon = (service) => {
    const d = getDomainFromServiceName(service);
    return d ? `https://icons.duckduckgo.com/ip3/${d}.ico` : '';
  };

  const modal = document.createElement('div');
  modal.id = CERBY_LOGIN_SUGGESTION_MODAL_ID;
  modal.className = 'cerby-login-suggestion-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'Sign in with Cerby');

  const cardsHtml = matching.map((acc, i) => {
    const isMake = acc.service === 'Make';
    const favicon = isMake ? makeLogoUrl : (acc.logoUrl || domainForFavicon(acc.service));
    const placeholderClass = isMake
      ? 'cerby-login-suggestion-logo-placeholder cerby-login-suggestion-make-logo'
      : 'cerby-login-suggestion-logo-placeholder';
    const imgClass = isMake
      ? 'cerby-login-suggestion-app-logo cerby-login-suggestion-app-logo-make'
      : 'cerby-login-suggestion-app-logo';
    const ssoChip = acc.hasSso
      ? `<div class="cerby-login-suggestion-card-badge cerby-login-suggestion-sso"><img src="${ssoIconUrl}" alt="" class="cerby-login-suggestion-sso-icon"><span class="cerby-login-suggestion-sso-text">SSO</span></div>`
      : '';
    return `
      <button type="button" class="cerby-login-suggestion-card" data-service="${escapeHtml(acc.service)}" data-name="${escapeHtml(acc.name || '')}" data-email="${escapeHtml(acc.email || '')}" data-index="${i}">
        <div class="cerby-login-suggestion-card-logo">
          <div class="${placeholderClass}">
            <img src="${escapeHtml(favicon)}" alt="${escapeHtml(acc.service)}" class="${imgClass}" data-domain="${escapeHtml(getDomainFromServiceName(acc.service) || '')}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
            <span class="cerby-login-suggestion-logo-fallback" style="display:none;">${(acc.service || '?').charAt(0)}</span>
          </div>
        </div>
        <div class="cerby-login-suggestion-card-info">
          <p class="cerby-login-suggestion-name">${escapeHtml(acc.name || '')}</p>
          <p class="cerby-login-suggestion-email">${escapeHtml(acc.email || '')}</p>
        </div>
        <div class="cerby-login-suggestion-card-right">
          ${ssoChip}
          <span class="cerby-login-suggestion-auto-login">
            <img src="${loginIconUrl}" alt="" class="cerby-login-suggestion-login-icon">
            <span class="cerby-login-suggestion-auto-login-text">Auto-login</span>
          </span>
        </div>
      </button>`;
  }).join('');

  const SEARCH_BAR_MIN_ACCOUNTS = 5;
  const showSearch = matching.length >= SEARCH_BAR_MIN_ACCOUNTS;
  const searchIconUrl = showSearch && chromeApi?.runtime?.getURL ? chromeApi.runtime.getURL('assets/search-icon.svg') : '';
  const searchBlockHtml = showSearch
    ? `<div class="cerby-login-suggestion-modal__search cerby-expanded-accounts-modal__search">
        <img src="${searchIconUrl}" alt="" class="cerby-expanded-accounts-modal__search-icon" aria-hidden="true">
        <input type="text" class="cerby-expanded-accounts-modal__search-input" placeholder="Search accounts" aria-label="Search accounts" autocomplete="off">
      </div>`
    : '';

  if (showSearch) modal.className = 'cerby-login-suggestion-modal cerby-login-suggestion-modal-with-search';

  modal.innerHTML = `
    <div class="cerby-login-suggestion-modal-inner">
      <div class="cerby-login-suggestion-header">
        <div class="cerby-login-suggestion-header-left">
          <img src="${cerbyLogoUrl}" alt="Cerby" class="cerby-login-suggestion-cerby-logo">
          <h2 class="cerby-login-suggestion-heading">Sign in with Cerby</h2>
        </div>
        <button type="button" class="cerby-login-suggestion-close" id="cerbyLoginSuggestionClose" aria-label="Close">
          <img src="${closeIconUrl}" alt="" class="cerby-login-suggestion-close-icon">
        </button>
      </div>
      ${searchBlockHtml}
      <div class="cerby-login-suggestion-list" id="cerbyLoginSuggestionList">
        ${cardsHtml}
      </div>
    </div>`;

  document.body.appendChild(modal);
  loginSuggestionModal = modal;

  if (showSearch) {
    const listEl = modal.querySelector('#cerbyLoginSuggestionList');
    const searchInput = modal.querySelector('.cerby-expanded-accounts-modal__search-input');
    function filterLoginSuggestionAccounts() {
      const term = (searchInput?.value || '').toLowerCase().trim();
      modal.querySelectorAll('.cerby-login-suggestion-card').forEach((btn) => {
        const name = (btn.dataset.name || '').toLowerCase();
        const email = (btn.dataset.email || '').toLowerCase();
        const service = (btn.dataset.service || '').toLowerCase();
        const match = !term || name.includes(term) || email.includes(term) || service.includes(term);
        btn.style.display = match ? '' : 'none';
      });
    }
    searchInput?.addEventListener('input', filterLoginSuggestionAccounts);
    searchInput?.addEventListener('keydown', (e) => e.stopPropagation());
  }

  setTimeout(() => {
    if (loginSuggestionModal === modal) {
      modal.classList.add('cerby-login-suggestion-modal-visible');
    }
  }, 500);

  modal.querySelector('#cerbyLoginSuggestionClose')?.addEventListener('click', () => hideLoginSuggestionModal());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hideLoginSuggestionModal();
  });
  modal.querySelectorAll('.cerby-login-suggestion-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideLoginSuggestionModal();
    });
  });
}

function hideLoginSuggestionModal() {
  if (loginSuggestionModal) {
    loginSuggestionModal.remove();
    loginSuggestionModal = null;
  }
}

