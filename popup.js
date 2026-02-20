// Password Manager Extension - Popup Script

const chromeApi = (typeof chrome !== 'undefined' && chrome)
  ? chrome
  : (typeof browser !== 'undefined' && browser ? browser : null);

let lastInteractionWasKeyboard = false;

document.addEventListener('keydown', event => {
  const keyboardNavigationKeys = [
    'Tab',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Enter',
    ' ',
    'Spacebar'
  ];

  if (keyboardNavigationKeys.includes(event.key)) {
    lastInteractionWasKeyboard = true;
  }
});

const resetInteractionMode = () => {
  lastInteractionWasKeyboard = false;
};

document.addEventListener('mousedown', resetInteractionMode);
document.addEventListener('pointerdown', resetInteractionMode);
document.addEventListener('touchstart', resetInteractionMode);

// Clear stuck hover/focus state when pointer leaves: blur so focus styles don't persist after click
document.addEventListener('mouseleave', function(e) {
  const left = e.target;
  const card = left.closest && left.closest('.account-card');
  if (card) {
    card.classList.remove('keyboard-focus');
  }
  const active = document.activeElement;
  if (!active || active === document.body) return;
  if (left === active || left.contains(active)) {
    active.blur();
  }
}, true);

function isStorageAvailable() {
  return !!(chromeApi && chromeApi.storage && chromeApi.storage.local);
}

function isTabsAvailable() {
  return !!(chromeApi && chromeApi.tabs && typeof chromeApi.tabs.query === 'function');
}

// Get domain from account service name (flexible for new accounts)
function getDomainFromService(serviceName) {
  if (!serviceName) return null;
  
  // Provider to domain mapping
  const serviceDomainMap = {
    'Make': 'make.com',
    'Mailchimp': 'mailchimp.com',
    'Loom': 'loom.com',
    'Pinterest': 'pinterest.com',
    'OpenAI': 'openai.com',
    'Apple': 'apple.com',
    'Spotify': 'spotify.com',
    'Bitso': 'bitso.com',
    'Capital One': 'capitalone.com',
    'Cursor': 'cursor.sh',
    'Grammarly': 'grammarly.com',
    'Google': 'google.com',
    'Notion': 'notion.so',
    'Figma': 'figma.com',
    'Dropbox': 'dropbox.com',
    'Atlassian': 'atlassian.com',
    'Adobe': 'adobe.com',
    'HubSpot': 'hubspot.com',
    'Salesforce': 'salesforce.com'
  };
  
  // Check direct mapping first
  if (serviceDomainMap[serviceName]) {
    return serviceDomainMap[serviceName];
  }
  
  // Try to infer domain from service name (convert to lowercase, add .com)
  const normalized = serviceName.toLowerCase().replace(/\s+/g, '');
  return `${normalized}.com`;
}

// Universal logo error handler with robust fallback chain
// Fallback order: DuckDuckGo → Direct domain favicon → Google favicon → Clearbit → Generic placeholder
function handleLogoError(img) {
  let domain = img.dataset.domain || img.dataset.fallbackDomain;
  
  // If no domain, try to get from service name
  if (!domain) {
    const accountCard = img.closest('.account-card');
    if (accountCard) {
      const serviceEl = accountCard.querySelector('.account-service');
      const serviceName = serviceEl?.dataset.originalText || serviceEl?.textContent.trim() || '';
      domain = getDomainFromService(serviceName);
    }
  }
  
  if (!domain) {
    // No domain specified, show generic placeholder
    showGenericLogo(img);
    return;
  }

  // Store domain for future attempts
  img.dataset.domain = domain;
  img.dataset.fallbackDomain = domain;

  const fallbackAttempted = img.dataset.fallbackAttempted || '';
  
  if (fallbackAttempted === 'duckduckgo') {
    // Already tried DuckDuckGo, try direct domain favicon
    img.dataset.fallbackAttempted = 'direct';
    img.src = `https://${domain}/favicon.ico`;
    img.onerror = function() {
      handleLogoError(this);
    };
  } else if (fallbackAttempted === 'direct') {
    // Already tried direct, try Google favicon
    img.dataset.fallbackAttempted = 'google';
    img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    img.onerror = function() {
      handleLogoError(this);
    };
  } else if (fallbackAttempted === 'google') {
    // Already tried Google, try Clearbit
    img.dataset.fallbackAttempted = 'clearbit';
    img.src = `https://logo.clearbit.com/${domain}`;
    img.onerror = function() {
      handleLogoError(this);
    };
  } else if (fallbackAttempted === 'clearbit') {
    // Already tried Clearbit, show generic placeholder
    showGenericLogo(img);
  } else {
    // First fallback: try DuckDuckGo favicon service (very reliable, no CORS issues)
    img.dataset.fallbackAttempted = 'duckduckgo';
    img.src = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
    img.onerror = function() {
      handleLogoError(this);
    };
  }
}

// Show generic placeholder logo
function showGenericLogo(img) {
  img.dataset.fallbackAttempted = 'generic';
  // Create a simple colored circle with first letter as fallback
  const container = img.closest('.app-logo-container') || img.closest('.account-details-logo');
  if (container) {
    const alt = img.alt || '';
    const firstLetter = alt.charAt(0).toUpperCase() || '?';
    const colors = ['#2698bf', '#482966', '#bd5df0', '#4f6489'];
    const colorIndex = alt.length % colors.length;
    const bgColor = colors[colorIndex];
    
    // Hide the image and show a text-based placeholder
    img.style.display = 'none';
    container.style.background = bgColor;
    container.style.borderRadius = '4px';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.color = '#ffffff';
    container.style.fontWeight = '600';
    container.style.fontSize = '14px';
    
    // Remove any existing placeholder text
    const existingPlaceholder = container.querySelector('.logo-placeholder-text');
    if (existingPlaceholder) {
      existingPlaceholder.remove();
    }
    
    // Add placeholder text
    const placeholder = document.createElement('span');
    placeholder.className = 'logo-placeholder-text';
    placeholder.textContent = firstLetter;
    placeholder.style.display = 'block';
    container.appendChild(placeholder);
  }
  img.onerror = null; // Prevent infinite loop
}

// Handle Make.com logo fallback chain (special case with Brandfetch)
function handleMakeLogoError(img) {
  // Ensure make-logo class is preserved and container gets background
  if (!img.classList.contains('make-logo')) {
    img.classList.add('make-logo');
  }
  // Check for both list view and account details view containers
  const container = img.closest('.app-logo-container') || img.closest('.account-details-logo');
  if (container) {
    container.classList.add('make-logo-container');
  }
  
  if (img.dataset.fallbackAttempted === 'clearbit') {
    // Already tried Clearbit, try Google favicon
    img.dataset.fallbackAttempted = 'google';
    img.src = 'https://www.google.com/s2/favicons?domain=make.com&sz=64';
    img.onerror = function() {
      handleMakeLogoError(this);
    };
  } else if (img.dataset.fallbackAttempted === 'google') {
    // Already tried Google, try local fallback (Figma design)
    img.dataset.fallbackAttempted = 'local';
    img.src = 'assets/make-logo.svg';
    img.onerror = function() {
      // If local also fails, use generic placeholder
      showGenericLogo(this);
    };
  } else {
    // First fallback: try Clearbit logo service
    img.dataset.fallbackAttempted = 'clearbit';
    img.src = 'https://logo.clearbit.com/make.com';
    img.onerror = function() {
      handleMakeLogoError(this);
    };
  }
}

// Initialize logo loading for all app logos
function initializeLogoLoading() {
  const allLogos = document.querySelectorAll('.app-logo:not(.make-logo)');
  allLogos.forEach(logo => {
    // Skip if already has error handler set up
    if (logo.dataset.logoInitialized === 'true') {
      return;
    }
    
    // Get domain from data attribute, current src, or service name
    let domain = logo.dataset.domain;
    
    if (!domain) {
      // Try to extract from current src
      const currentSrc = logo.src || '';
      if (currentSrc.includes('logo.clearbit.com/')) {
        domain = currentSrc.split('logo.clearbit.com/')[1]?.split('?')[0]?.split('&')[0];
      } else if (currentSrc.includes('favicons?domain=')) {
        domain = currentSrc.split('favicons?domain=')[1]?.split('&')[0];
      } else if (currentSrc.includes('s2/favicons?domain=')) {
        domain = currentSrc.split('s2/favicons?domain=')[1]?.split('&')[0];
      } else if (currentSrc.includes('icons.duckduckgo.com/ip3/')) {
        domain = currentSrc.split('icons.duckduckgo.com/ip3/')[1]?.split('.ico')[0];
      }
    }
    
    // If still no domain, try to get from account service name
    if (!domain) {
      const accountCard = logo.closest('.account-card');
      if (accountCard) {
        const serviceEl = accountCard.querySelector('.account-service');
        const serviceName = serviceEl?.dataset.originalText || serviceEl?.textContent.trim() || '';
        domain = getDomainFromService(serviceName);
      }
    }
    
    if (domain) {
      logo.dataset.domain = domain;
      logo.dataset.fallbackDomain = domain;
      logo.dataset.logoInitialized = 'true';
      
      // Use DuckDuckGo as primary source (most reliable for extensions)
      // Only set if logo has no src or has an empty/invalid src
      if (!logo.src || logo.src.includes('data:') || logo.src === '' || 
          logo.src.includes('about:') || logo.src === window.location.href) {
        logo.src = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
      }
      
      // Always set up error handler for fallback chain
      logo.onerror = function() {
        handleLogoError(this);
      };
      
      // Check if logo already failed to load (only if image is complete)
      if (logo.complete && logo.naturalHeight === 0) {
        // Image failed to load, trigger fallback immediately
        handleLogoError(logo);
      } else if (!logo.complete) {
        // Image is still loading, set up error handler
        logo.addEventListener('error', function() {
          handleLogoError(this);
        }, { once: true });
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // Move modal and toast to body so they work when simplified view is showing (mainExtensionView hidden)
  const modal = document.getElementById('accountDetailsModal');
  const toast = document.getElementById('toastNotification');
  if (modal && modal.parentElement !== document.body) document.body.appendChild(modal);
  if (toast && toast.parentElement !== document.body) document.body.appendChild(toast);

  initializeExtension();
});

const makeLogoUrl = 'https://cdn.brandfetch.io/idVHU5hl7_/theme/light/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1690469461407';

async function checkInlineExpandedContext() {
  if (!chromeApi?.storage?.local?.get) return null;
  const result = await chromeApi.storage.local.get([
    'inlineExpandedProvider',
    'inlineExpandedFieldType',
    'inlineExpandedTabId'
  ]);
  const provider = result?.inlineExpandedProvider;
  if (provider) {
    await chromeApi.storage.local.remove('inlineExpandedProvider');
    await chromeApi.storage.local.remove('inlineExpandedFieldType');
    await chromeApi.storage.local.remove('inlineExpandedTabId');
    return {
      provider,
      fieldType: result?.inlineExpandedFieldType || 'email',
      tabId: result?.inlineExpandedTabId || null
    };
  }
  return null;
}

function showInlineExpandedView(context) {
  const { provider, fieldType, tabId } = context;
  const simplifiedView = document.getElementById('inlineExpandedView');
  const mainView = document.getElementById('mainExtensionView');
  if (!simplifiedView || !mainView) return;

  mainView.style.display = 'none';
  simplifiedView.style.display = 'flex';

  const titleEl = document.getElementById('inlineExpandedTitle');
  const listEl = document.getElementById('inlineExpandedList');
  const searchInput = document.getElementById('inlineExpandedSearchInput');
  const backBtn = document.getElementById('inlineExpandedBack');

  if (titleEl) titleEl.textContent = `${provider} accounts`;

  backBtn?.addEventListener('click', () => {
    simplifiedView.style.display = 'none';
    mainView.style.display = 'flex';
    showInlineExpandedView._backClicked = true;
    initializeMainView();
  });

  const infoIconUrl = chromeApi?.runtime?.getURL ? chromeApi.runtime.getURL('assets/info-icon.svg') : 'assets/info-icon.svg';

  function renderAccounts(accounts) {
    if (!listEl) return;
    listEl.innerHTML = '';

    accounts.forEach((acc) => {
      const isMake = acc.service === 'Make';
      const favicon = isMake ? makeLogoUrl : (acc.logoUrl || `https://icons.duckduckgo.com/ip3/${getDomainFromService(acc.service) || ''}.ico`);
      const logoClass = isMake ? 'inline-expanded-item-logo make-logo' : 'inline-expanded-item-logo';

      const item = document.createElement('div');
      item.className = 'inline-expanded-item';
      item.innerHTML = `
        <div class="inline-expanded-item-main">
          <div class="${logoClass}">
            <img src="${favicon}" alt="" onerror="this.style.display='none'">
          </div>
          <div class="inline-expanded-item-info">
            <span class="inline-expanded-item-name">${(acc.name || '').replace(/</g, '&lt;')}</span>
            <span class="inline-expanded-item-email">${(acc.email || acc.name || '').replace(/</g, '&lt;')}</span>
          </div>
        </div>
        <button type="button" class="inline-expanded-item-info-btn" aria-label="Account details">
          <img src="${infoIconUrl}" alt="" class="inline-expanded-item-info-icon">
        </button>`;

      const mainArea = item.querySelector('.inline-expanded-item-main');
      const infoBtn = item.querySelector('.inline-expanded-item-info-btn');

      mainArea.addEventListener('click', () => {
        if (tabId) {
          chromeApi.runtime.sendMessage({
            action: 'fillAccountFromPanel',
            tabId,
            account: acc,
            fieldType
          });
        } else {
          chromeApi.runtime.sendMessage({ action: 'performLogin', accountService: acc.service });
        }
      });
      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showAccountDetailsFromAccount(acc, true);
      });

      listEl.appendChild(item);
    });
  }

  function filterAndRender() {
    const term = (searchInput?.value || '').toLowerCase().trim();
    chromeApi.storage.local.get(['accounts'], (result) => {
      const all = Array.isArray(result?.accounts) ? result.accounts : [];
      const filtered = all.filter(a => a.service === provider);
      const shown = term
        ? filtered.filter(a =>
            (a.name || '').toLowerCase().includes(term) ||
            (a.email || '').toLowerCase().includes(term))
        : filtered;
      renderAccounts(shown);
    });
  }

  searchInput?.addEventListener('input', filterAndRender);
  filterAndRender();
}

// Toast notification function
function showToast(message = 'Copied to clipboard') {
  const toast = document.getElementById('toastNotification');
  const toastText = document.getElementById('toastText');
  
  if (toast && toastText) {
    toastText.textContent = message;
    toast.classList.add('show');
    
    // Hide toast after 2 seconds
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }
}

async function initializeExtension() {
  // Always initialize account details modal so back/close works from both full and simplified views
  initializeAccountDetailsModal();

  const context = await checkInlineExpandedContext();
  if (context) {
    showInlineExpandedView(context);
    return;
  }
  initializeMainView();
}

function initializeMainView() {
  // Initialize logo loading for all logos
  initializeLogoLoading();
  initializeVaultDropdown();
  
  // Handle Make.com logo background styling
  const makeLogos = document.querySelectorAll('.make-logo');
  makeLogos.forEach(logo => {
    const container = logo.closest('.app-logo-container');
    if (container) {
      container.classList.add('make-logo-container');
    }
    
    // Handle logo load/error
    logo.addEventListener('load', function() {
      const container = this.closest('.app-logo-container');
      if (container) {
        container.classList.add('make-logo-container');
      }
    });
    
    logo.addEventListener('error', function() {
      // Error handler will take care of fallback
    });
  });
  
  // Password generator button functionality
  const passwordGeneratorButton = document.getElementById('passwordGeneratorButton');
  if (passwordGeneratorButton) {
    passwordGeneratorButton.addEventListener('click', function() {
      // TODO: Open password generator
      console.log('Password generator clicked');
    });
  }

  // Settings button functionality
  const settingsButton = document.getElementById('settingsButton');
  if (settingsButton) {
    settingsButton.addEventListener('click', function() {
      // TODO: Open settings page
      console.log('Settings clicked');
    });
  }

  // Search functionality
  const searchInput = document.getElementById('searchInput');
  const searchContainer = document.getElementById('searchContainer');
  const searchClearButton = document.getElementById('searchClearButton');
  
  if (searchInput && searchContainer) {
    // Handle focus state
    searchInput.addEventListener('focus', function() {
      searchContainer.classList.add('focus');
      updateClearButtonVisibility();
    });
    
    // Handle blur state
    searchInput.addEventListener('blur', function() {
      searchContainer.classList.remove('focus');
      // Delay hiding clear button to allow click event
      setTimeout(() => {
        if (document.activeElement !== searchInput) {
          updateClearButtonVisibility();
        }
      }, 200);
    });
    
    // Handle input changes
    searchInput.addEventListener('input', function(e) {
      filterAccounts(e.target.value);
      updateClearButtonVisibility();
    });
    
    // Clear button functionality
    if (searchClearButton) {
      searchClearButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        searchInput.value = '';
        searchInput.focus();
        filterAccounts('');
        updateClearButtonVisibility();
      });
    }
    
    // Update clear button visibility
    function updateClearButtonVisibility() {
      if (searchClearButton) {
        const hasValue = searchInput.value.trim().length > 0;
        const isFocused = searchContainer.classList.contains('focus');
        searchClearButton.style.display = (hasValue && isFocused) ? 'flex' : 'none';
      }
    }
  }

  // Filter dropdown functionality
  initializeFilterDropdown();

  // Sort button functionality
  initializeSortDropdown();

  // Add button functionality
  const addButton = document.getElementById('addButton');
  if (addButton) {
    addButton.addEventListener('click', function() {
      // TODO: Open add new item dialog
      console.log('Add new item clicked');
    });
  }

  // Organize accounts by current website
  organizeAccountsByWebsite().then(() => {
    // Initialize original text for all account elements after reorganization
    initializeOriginalText();
    
    // Auto-focus search input after everything is set up
    const searchInput = document.getElementById('searchInput');
    const searchContainer = document.getElementById('searchContainer');
    if (searchInput && searchContainer) {
      setTimeout(() => {
        searchInput.focus();
        searchContainer.classList.add('focus');
      }, 50);
    }
  });

  // Account card click functionality (will be re-initialized after reorganization)
  initializeAccountCardListeners();

  // Login button functionality
  initializeLoginButtons();

  // Dropdown menu functionality
  initializeDropdownMenu();
  initializeAccountListAccessibility();

  // Load accounts from storage
  loadAccounts();
}

function initializeVaultDropdown() {
  const wrapper = document.querySelector('.vault-card-wrapper');
  const selectorButton = document.getElementById('vaultSelectorButton');
  const dropdown = document.getElementById('vaultDropdown');
  if (!wrapper || !selectorButton || !dropdown) return;

  const labelEl = selectorButton.querySelector('[data-selected-vault]');
  const options = dropdown.querySelectorAll('.vault-dropdown-option');
  let currentVault = selectorButton.dataset.selectedVault || 'workspace';

  const vaultLabels = {
    workspace: 'Workspace vault',
    personal: 'Personal vault'
  };

  const setSelectedVault = (nextVault) => {
    currentVault = nextVault;
    selectorButton.dataset.selectedVault = nextVault;
    if (labelEl && vaultLabels[nextVault]) {
      labelEl.textContent = vaultLabels[nextVault];
    }

    options.forEach(option => {
      const isSelected = option.dataset.vault === nextVault;
      option.classList.toggle('selected', isSelected);
    });
  };

  const closeDropdown = () => {
    dropdown.classList.remove('show');
    selectorButton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleEscape);
  };

  const openDropdown = () => {
    dropdown.classList.add('show');
    selectorButton.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
  };

  const toggleDropdown = () => {
    if (dropdown.classList.contains('show')) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };

  const handleOutsideClick = (event) => {
    if (!wrapper.contains(event.target)) {
      closeDropdown();
    }
  };

  const handleEscape = (event) => {
    if (event.key === 'Escape') {
      closeDropdown();
      selectorButton.focus();
    }
  };

  selectorButton.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleDropdown();
  });

  options.forEach(option => {
    option.addEventListener('click', () => {
      const value = option.dataset.vault;
      setSelectedVault(value);
      closeDropdown();
    });
  });

  setSelectedVault(currentVault);
}

// Initialize filter dropdown functionality
function initializeFilterDropdown() {
  const filterDropdown = document.getElementById('filterDropdown');
  const filterDropdownMenu = document.getElementById('filterDropdownMenu');
  const filterText = filterDropdown?.querySelector('.filter-text');
  const chevronIcon = filterDropdown?.querySelector('.chevron-icon');
  
  if (!filterDropdown || !filterDropdownMenu) return;

  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#filterDropdown') && !e.target.closest('#filterDropdownMenu')) {
      filterDropdownMenu.classList.remove('show');
      if (chevronIcon) {
        chevronIcon.classList.remove('rotated');
      }
    }
  });

  // Default filter selection
  let currentFilter = 'all';
  const allFilterItem = filterDropdownMenu.querySelector('[data-filter="all"]');
  if (allFilterItem) {
    allFilterItem.classList.add('selected');
  }

  // Handle filter dropdown button click
  filterDropdown.addEventListener('click', function(e) {
    e.stopPropagation();
    
    const isOpen = filterDropdownMenu.classList.contains('show');
    
    // Close sort dropdown if open
    const sortDropdownMenu = document.getElementById('sortDropdownMenu');
    if (sortDropdownMenu) {
      sortDropdownMenu.classList.remove('show');
    }
    
    if (isOpen) {
      filterDropdownMenu.classList.remove('show');
      if (chevronIcon) {
        chevronIcon.classList.remove('rotated');
      }
    } else {
      // Position dropdown below button
      const buttonRect = filterDropdown.getBoundingClientRect();
      const extensionRect = document.querySelector('.browser-extension')?.getBoundingClientRect() || { top: 0, left: 0 };
      
      const top = buttonRect.bottom - extensionRect.top + 4;
      const left = buttonRect.left - extensionRect.left;
      
      filterDropdownMenu.style.top = top + 'px';
      filterDropdownMenu.style.left = left + 'px';
      
      filterDropdownMenu.classList.add('show');
      if (chevronIcon) {
        chevronIcon.classList.add('rotated');
      }
    }
  });

  // Handle filter item clicks
  const filterItems = filterDropdownMenu.querySelectorAll('.filter-dropdown-item');
  filterItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.stopPropagation();
      
      // Remove selected class from all items
      filterItems.forEach(i => i.classList.remove('selected'));
      
      // Add selected class to clicked item
      item.classList.add('selected');
      
      // Update current filter
      currentFilter = item.dataset.filter;
      
      // Update filter text
      if (filterText) {
        const textMap = {
          'all': 'All items',
          'accounts': 'Accounts',
          'secrets': 'Secrets'
        };
        filterText.textContent = textMap[currentFilter] || 'All items';
      }
      
      // Close dropdown
      filterDropdownMenu.classList.remove('show');
      if (chevronIcon) {
        chevronIcon.classList.remove('rotated');
      }
      
      // Apply filter
      applyFilter(currentFilter);
    });
  });
}

// Initialize sort dropdown functionality
function initializeSortDropdown() {
  const sortButton = document.getElementById('sortButton');
  const sortDropdownMenu = document.getElementById('sortDropdownMenu');
  
  if (!sortButton || !sortDropdownMenu) return;

  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#sortButton') && !e.target.closest('#sortDropdownMenu')) {
      sortDropdownMenu.classList.remove('show');
    }
  });

  // Default sort selection
  let currentSort = 'recently-used';
  const recentlyUsedItem = sortDropdownMenu.querySelector('[data-sort="recently-used"]');
  if (recentlyUsedItem) {
    recentlyUsedItem.classList.add('selected');
  }

  // Handle sort button click
  sortButton.addEventListener('click', function(e) {
    e.stopPropagation();
    
    const isOpen = sortDropdownMenu.classList.contains('show');
    
    // Close filter dropdown if open
    const filterDropdownMenu = document.getElementById('filterDropdownMenu');
    const filterDropdown = document.getElementById('filterDropdown');
    const filterChevron = filterDropdown?.querySelector('.chevron-icon');
    if (filterDropdownMenu) {
      filterDropdownMenu.classList.remove('show');
      if (filterChevron) {
        filterChevron.classList.remove('rotated');
      }
    }
    
    if (isOpen) {
      sortDropdownMenu.classList.remove('show');
    } else {
      // Position dropdown below button
      const buttonRect = sortButton.getBoundingClientRect();
      const extensionRect = document.querySelector('.browser-extension')?.getBoundingClientRect() || { top: 0, left: 0 };
      
      const top = buttonRect.bottom - extensionRect.top + 4;
      // Position to the right to avoid cutting off
      const left = buttonRect.right - extensionRect.left - 160;
      
      sortDropdownMenu.style.top = top + 'px';
      sortDropdownMenu.style.left = left + 'px';
      
      sortDropdownMenu.classList.add('show');
    }
  });

  // Handle sort item clicks
  const sortItems = sortDropdownMenu.querySelectorAll('.sort-dropdown-item');
  sortItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.stopPropagation();
      
      // Remove selected class from all items
      sortItems.forEach(i => i.classList.remove('selected'));
      
      // Add selected class to clicked item
      item.classList.add('selected');
      
      // Update current sort
      currentSort = item.dataset.sort;
      
      // Close dropdown
      sortDropdownMenu.classList.remove('show');
      
      // Apply sort
      applySort(currentSort);
    });
  });
}

// Apply filter based on selected option
function applyFilter(filterType) {
  const accountCards = document.querySelectorAll('.account-card');
  
  accountCards.forEach(card => {
    const accountServiceEl = card.querySelector('.account-service');
    const accountService = accountServiceEl?.dataset.originalText || accountServiceEl?.textContent.trim() || '';
    const isSecret = accountService === 'Secret';
    
    if (filterType === 'all') {
      card.style.display = 'flex';
    } else if (filterType === 'accounts') {
      card.style.display = isSecret ? 'none' : 'flex';
    } else if (filterType === 'secrets') {
      card.style.display = isSecret ? 'flex' : 'none';
    }
  });
  
  // Update section headers visibility
  updateSectionHeadersVisibility();
  updateCardTabIndexes();
}

// Apply sort based on selected option
function applySort(sortType) {
  const forThisWebsiteContainer = document.querySelector('.for-this-website-container');
  const otherItemsContainer = document.querySelector('.other-items-container');
  
  if (forThisWebsiteContainer) {
    sortCardsInContainer(forThisWebsiteContainer, sortType);
  }
  
  if (otherItemsContainer) {
    sortCardsInContainer(otherItemsContainer, sortType);
  }

  updateCardTabIndexes();
}

// Sort cards within a container
function sortCardsInContainer(container, sortType) {
  const cards = Array.from(container.querySelectorAll('.account-card'));
  
  cards.sort((a, b) => {
    const nameA = (a.querySelector('.account-name')?.dataset.originalText || 
                   a.querySelector('.account-name')?.textContent || '').toLowerCase();
    const nameB = (b.querySelector('.account-name')?.dataset.originalText || 
                   b.querySelector('.account-name')?.textContent || '').toLowerCase();
    
    switch (sortType) {
      case 'a-to-z':
        return nameA.localeCompare(nameB);
      case 'z-to-a':
        return nameB.localeCompare(nameA);
      case 'recently-used':
        // For now, keep original order (would need to track usage)
        return 0;
      case 'newest':
        // For now, keep original order (would need creation date)
        return 0;
      case 'oldest':
        // For now, keep original order (would need creation date)
        return 0;
      default:
        return 0;
    }
  });
  
  // Re-append sorted cards
  cards.forEach(card => container.appendChild(card));
}

// Initialize original text for all account elements
function initializeOriginalText() {
  const accountCards = document.querySelectorAll('.account-card');
  accountCards.forEach(card => {
    const accountNameEl = card.querySelector('.account-name');
    const accountServiceEl = card.querySelector('.account-service');
    const accountEmailEl = card.querySelector('.account-email');
    
    if (accountNameEl && !accountNameEl.dataset.originalText) {
      accountNameEl.dataset.originalText = accountNameEl.textContent;
    }
    if (accountServiceEl && !accountServiceEl.dataset.originalText) {
      accountServiceEl.dataset.originalText = accountServiceEl.textContent;
    }
    if (accountEmailEl && !accountEmailEl.dataset.originalText) {
      accountEmailEl.dataset.originalText = accountEmailEl.textContent;
    }
  });
}

function initializeDropdownMenu() {
  const dropdownMenu = document.getElementById('dropdownMenu');
  const overflowButtons = document.querySelectorAll('.account-action-button:not(.login-button)');
  
  if (!dropdownMenu) return;

  const dropdownItems = Array.from(dropdownMenu.querySelectorAll('.dropdown-item'));
  dropdownItems.forEach(item => item.setAttribute('tabindex', '-1'));

  const getVisibleDropdownItems = () =>
    dropdownItems.filter(item => item.offsetParent !== null && item.style.display !== 'none');

  const focusDropdownItem = (item) => {
    if (!item) return;
    const visibleItems = getVisibleDropdownItems();
    visibleItems.forEach(entry => entry.setAttribute('tabindex', entry === item ? '0' : '-1'));
    item.focus();
  };

  const closeDropdown = (returnFocus = false) => {
    if (!dropdownMenu.classList.contains('show')) return;
    dropdownMenu.classList.remove('show');
    document.querySelectorAll('.account-card').forEach(c => c.classList.remove('dropdown-open'));
    if (returnFocus && dropdownMenu.dataset.triggerButtonId) {
      const triggerButton = document.getElementById(dropdownMenu.dataset.triggerButtonId);
      if (triggerButton) {
        triggerButton.focus();
      }
    }
    delete dropdownMenu.dataset.triggerButtonId;
    delete dropdownMenu.dataset.accountCard;
    dropdownItems.forEach(item => item.setAttribute('tabindex', '-1'));
  };

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.account-action-button:not(.login-button)') && 
        !e.target.closest('.dropdown-menu')) {
      closeDropdown(false);
    }
  });

  overflowButtons.forEach(button => {
    if (!button.id) {
      button.id = `dropdown-trigger-${Math.random().toString(36).slice(2, 11)}`;
    }

    button.addEventListener('click', function(e) {
      e.stopPropagation();
      const card = button.closest('.account-card');
      if (!card) return;

      if (dropdownMenu.classList.contains('show') && dropdownMenu.dataset.triggerButtonId === button.id) {
        closeDropdown(false);
        return;
      }

      closeDropdown(false);

      document.querySelectorAll('.account-card').forEach(c => c.classList.remove('dropdown-open'));
      card.classList.add('dropdown-open');
      
      if (!card.dataset.accountId) {
        card.dataset.accountId = 'account-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      }
      dropdownMenu.dataset.accountCard = card.dataset.accountId;
      dropdownMenu.dataset.triggerButtonId = button.id;
      
      const buttonRect = button.getBoundingClientRect();
      const extensionRect = document.querySelector('.browser-extension').getBoundingClientRect();
      
      dropdownMenu.style.display = 'flex';
      dropdownMenu.style.visibility = 'hidden';
      const dropdownHeight = dropdownMenu.offsetHeight;
      dropdownMenu.style.display = '';
      dropdownMenu.style.visibility = '';
      
      const spaceBelow = extensionRect.bottom - buttonRect.bottom;
      const spaceAbove = buttonRect.top - extensionRect.top;
      
      let top;
      if (spaceBelow >= dropdownHeight + 4) {
        top = buttonRect.bottom - extensionRect.top + 4;
      } else if (spaceAbove >= dropdownHeight + 4) {
        top = buttonRect.top - extensionRect.top - dropdownHeight - 4;
      } else {
        top = buttonRect.bottom - extensionRect.top + 4;
      }
      
      const left = buttonRect.right - extensionRect.left - 190;
      
      const accountServiceEl = card.querySelector('.account-service');
      const accountService = accountServiceEl?.dataset.originalText || accountServiceEl?.textContent.trim() || '';
      const isSecret = accountService === 'Secret';
      
      const accountItems = dropdownMenu.querySelectorAll('[data-account-item]');
      const secretItems = dropdownMenu.querySelectorAll('[data-secret-item]');
      
      if (isSecret) {
        accountItems.forEach(item => {
          item.style.display = 'none';
        });
        secretItems.forEach(item => {
          item.style.display = 'flex';
        });
      } else {
        accountItems.forEach(item => {
          item.style.display = 'flex';
        });
        secretItems.forEach(item => {
          item.style.display = 'none';
        });
        
        const mfaBadge = card.querySelector('.mfa-badge');
        const hasMFA = mfaBadge !== null;
        const totpItem = dropdownMenu.querySelector('[data-totp-item]');
        const totpDivider = dropdownMenu.querySelector('[data-totp-divider]');
        
        if (totpItem) {
          totpItem.style.display = hasMFA ? 'flex' : 'none';
        }
        if (totpDivider) {
          totpDivider.style.display = hasMFA ? 'flex' : 'none';
        }

        const accountNameEl = card.querySelector('.account-name');
        const accountEmailEl = card.querySelector('.account-email');
        const accountName = accountNameEl?.dataset.originalText || accountNameEl?.textContent.trim() || '';
        const accountEmail = accountEmailEl?.dataset.originalText || accountEmailEl?.textContent.trim() || '';
        const copyEmailItem = dropdownMenu.querySelector('[data-copy-email-item]');
        const copyUsernameItem = dropdownMenu.querySelector('[data-copy-username-item]');
        const passwordItem = dropdownMenu.querySelector('[data-password-item]');
        const hasSso = !!card.querySelector('.sso-badge');

        const hasUsername = !!(accountName || accountEmail);
        const hasEmail = card.dataset.hasEmail === 'true' && !!accountEmail;

        if (copyEmailItem) {
          copyEmailItem.style.display = hasEmail ? 'flex' : 'none';
        }
        if (copyUsernameItem) {
          copyUsernameItem.style.display = hasUsername ? 'flex' : 'none';
        }
        if (passwordItem) {
          passwordItem.style.display = hasSso ? 'none' : 'flex';
        }
      }
      
      dropdownMenu.style.top = top + 'px';
      dropdownMenu.style.left = left + 'px';
      
      dropdownMenu.classList.add('show');

      const visibleItems = getVisibleDropdownItems();
      if (lastInteractionWasKeyboard && visibleItems.length > 0) {
        requestAnimationFrame(() => focusDropdownItem(visibleItems[0]));
      } else {
        dropdownItems.forEach(item => item.setAttribute('tabindex', '-1'));
      }
    });
  });

  dropdownItems.forEach(item => {
    item.addEventListener('keydown', function(e) {
      const visibleItems = getVisibleDropdownItems();
      const currentIndex = visibleItems.indexOf(item);
      
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (visibleItems.length > 0) {
            const nextIndex = (currentIndex + 1) % visibleItems.length;
            focusDropdownItem(visibleItems[nextIndex]);
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (visibleItems.length > 0) {
            const nextIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
            focusDropdownItem(visibleItems[nextIndex]);
          }
          break;
        }
        case 'Home':
          e.preventDefault();
          if (visibleItems.length > 0) {
            focusDropdownItem(visibleItems[0]);
          }
          break;
        case 'End':
          e.preventDefault();
          if (visibleItems.length > 0) {
            focusDropdownItem(visibleItems[visibleItems.length - 1]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          closeDropdown(true);
          break;
        case 'Enter':
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          item.click();
          break;
        default:
          break;
      }
    });

    item.addEventListener('click', async function(e) {
      e.stopPropagation();
      const action = item.querySelector('.dropdown-item-text').textContent;
      
      // Get the account card that triggered the dropdown
      const accountCard = dropdownMenu.dataset.accountCard ? 
        document.querySelector(`[data-account-id="${dropdownMenu.dataset.accountCard}"]`) : 
        document.querySelector('.account-card.dropdown-open');
      
      if (action === 'See account details') {
        if (accountCard) {
          showAccountDetails(accountCard);
        }
      } else if (action === 'Expand account details') {
        if (accountCard) {
          openExpandedAccountDetails(accountCard);
        }
      } else if (action === 'Copy email') {
        if (accountCard) {
          const accountEmailEl = accountCard.querySelector('.account-email');
          const accountEmail = accountEmailEl?.dataset.originalText || accountEmailEl?.textContent.trim() || '';
          if (accountEmail) {
            try {
              await navigator.clipboard.writeText(accountEmail);
              showToast('Email copied to clipboard');
            } catch (err) {
              console.error('Failed to copy email:', err);
              showToast('Email copied to clipboard');
            }
          }
        }
      } else if (action === 'Copy username') {
        if (accountCard) {
          const accountNameEl = accountCard.querySelector('.account-name');
          const accountName = accountNameEl?.dataset.originalText || accountNameEl?.textContent.trim() || '';
          if (accountName) {
            try {
              await navigator.clipboard.writeText(accountName);
              showToast('Username copied to clipboard');
            } catch (err) {
              console.error('Failed to copy username:', err);
              showToast('Username copied to clipboard');
            }
          }
        }
      } else if (action === 'Copy password') {
        if (accountCard) {
          // In a real implementation, this would fetch the password from secure storage
          // For now, we'll use a placeholder or check if there's stored data
          const password = accountCard.dataset.password || '••••••••••••••••';
          
          try {
            await navigator.clipboard.writeText(password);
            showToast('Password copied to clipboard');
          } catch (err) {
            console.error('Failed to copy password:', err);
            showToast('Password copied to clipboard');
          }
        }
      } else if (action === 'Copy TOTP') {
        if (accountCard) {
          // In a real implementation, this would generate/retrieve the TOTP code
          // For now, we'll use a placeholder
          const totpCode = accountCard.dataset.totp || '123456';
          
          try {
            await navigator.clipboard.writeText(totpCode);
            showToast('TOTP copied to clipboard');
          } catch (err) {
            console.error('Failed to copy TOTP:', err);
            showToast('TOTP copied to clipboard');
          }
        }
      } else if (action === 'Copy secret') {
        if (accountCard) {
          // In a real implementation, this would fetch the secret from secure storage
          // For now, we'll use a placeholder
          const secret = accountCard.dataset.secret || '••••••••••••••••';
          
          try {
            await navigator.clipboard.writeText(secret);
            showToast('Secret copied to clipboard');
          } catch (err) {
            console.error('Failed to copy secret:', err);
            showToast('Secret copied to clipboard');
          }
        }
      } else if (action === 'See secret and attachments') {
        if (accountCard) {
          // Show secret details (similar to account details)
          showAccountDetails(accountCard);
        }
      } else if (action === 'Edit secret') {
        // TODO: Open edit secret dialog
        console.log('Edit secret clicked');
      } else if (action === 'Edit account details') {
        // TODO: Open edit account dialog
        console.log('Edit account details clicked');
      } else {
        // TODO: Handle other menu actions
        console.log('Menu action:', action);
      }
      
      // Close dropdown after action
      closeDropdown(lastInteractionWasKeyboard);
    });
  });
}

// Highlight matching text in an element
function highlightText(element, searchTerm) {
  if (!element || !searchTerm || searchTerm.trim() === '') {
    // Restore original text if no search term
    if (element && element.dataset.originalText) {
      element.textContent = element.dataset.originalText;
      delete element.dataset.originalText;
    }
    return;
  }

  // Store original text if not already stored
  if (!element.dataset.originalText) {
    element.dataset.originalText = element.textContent;
  }

  const originalText = element.dataset.originalText;
  const searchLower = searchTerm.toLowerCase();
  const textLower = originalText.toLowerCase();
  const index = textLower.indexOf(searchLower);

  if (index === -1) {
    // No match, restore original text
    element.textContent = originalText;
    return;
  }

  // Create highlighted version
  const beforeMatch = originalText.substring(0, index);
  const match = originalText.substring(index, index + searchTerm.length);
  const afterMatch = originalText.substring(index + searchTerm.length);

  element.innerHTML = '';
  if (beforeMatch) {
    element.appendChild(document.createTextNode(beforeMatch));
  }
  
  const highlightSpan = document.createElement('span');
  highlightSpan.className = 'search-highlight';
  highlightSpan.textContent = match;
  element.appendChild(highlightSpan);
  
  if (afterMatch) {
    element.appendChild(document.createTextNode(afterMatch));
  }
}

// Restore original text in an element
function restoreText(element) {
  if (element && element.dataset.originalText) {
    element.textContent = element.dataset.originalText;
    delete element.dataset.originalText;
  }
}

// Helper function to update section header visibility based on visible items
function updateSectionHeadersVisibility() {
  const contentArea = document.getElementById('contentArea');
  if (!contentArea) return;

  const sectionHeaders = contentArea.querySelectorAll('.section-header');
  const forThisWebsiteHeader = sectionHeaders[0];
  const otherItemsHeader = sectionHeaders[1];

  if (forThisWebsiteHeader && otherItemsHeader) {
    const forThisWebsiteContainer = contentArea.querySelector('.for-this-website-container');
    const otherItemsContainer = contentArea.querySelector('.other-items-container');
    const allItemsContainer = contentArea.querySelector('.all-items-container');
    
    let hasForThisWebsite = false;
    
    // Check "For this website" section
    if (forThisWebsiteContainer) {
      const visibleForThisWebsite = Array.from(forThisWebsiteContainer.querySelectorAll('.account-card'))
        .filter(card => card.style.display !== 'none' && card.style.display !== '');
      hasForThisWebsite = visibleForThisWebsite.length > 0;
      forThisWebsiteHeader.style.display = hasForThisWebsite ? 'flex' : 'none';
    } else {
      forThisWebsiteHeader.style.display = 'none';
    }
    
    // Check "Other items" section
    if (otherItemsContainer) {
      const visibleOtherItems = Array.from(otherItemsContainer.querySelectorAll('.account-card'))
        .filter(card => card.style.display !== 'none' && card.style.display !== '');
      // Hide "Other items" header if there are no items in "For this website" section
      // (since it's the only group, no need to show the title)
      otherItemsHeader.style.display = (visibleOtherItems.length > 0 && hasForThisWebsite) ? 'flex' : 'none';
    } else if (allItemsContainer) {
      // When using all-items-container, check if it has visible items
      const visibleAllItems = Array.from(allItemsContainer.querySelectorAll('.account-card'))
        .filter(card => card.style.display !== 'none' && card.style.display !== '');
      // If there's an "Other items" header, show it only if there are visible items
      if (otherItemsHeader) {
        otherItemsHeader.style.display = visibleAllItems.length > 0 ? 'flex' : 'none';
      }
    } else {
      if (otherItemsHeader) {
        otherItemsHeader.style.display = 'none';
      }
    }
  }
}

function filterAccounts(searchTerm) {
  const accountCards = document.querySelectorAll('.account-card');
  const searchLower = searchTerm.toLowerCase();

  accountCards.forEach(card => {
    const accountNameEl = card.querySelector('.account-name');
    const accountServiceEl = card.querySelector('.account-service');
    const accountEmailEl = card.querySelector('.account-email');

    // Get original text for comparison (use stored original or current text)
    const accountNameOriginal = accountNameEl?.dataset.originalText || accountNameEl?.textContent || '';
    const accountServiceOriginal = accountServiceEl?.dataset.originalText || accountServiceEl?.textContent || '';
    const accountEmailOriginal = accountEmailEl?.dataset.originalText || accountEmailEl?.textContent || '';

    const accountName = accountNameOriginal.toLowerCase();
    const accountService = accountServiceOriginal.toLowerCase();
    const accountEmail = accountEmailOriginal.toLowerCase();

    const matches = accountName.includes(searchLower) || 
                   accountService.includes(searchLower) || 
                   accountEmail.includes(searchLower);

    if (matches) {
      card.style.display = 'flex';
      
      // Highlight matching text
      if (searchTerm.trim() !== '') {
        if (accountNameEl && accountName.includes(searchLower)) {
          highlightText(accountNameEl, searchTerm);
        } else {
          restoreText(accountNameEl);
        }
        
        if (accountServiceEl && accountService.includes(searchLower)) {
          highlightText(accountServiceEl, searchTerm);
        } else {
          restoreText(accountServiceEl);
        }
        
        if (accountEmailEl && accountEmail.includes(searchLower)) {
          highlightText(accountEmailEl, searchTerm);
        } else {
          restoreText(accountEmailEl);
        }
      } else {
        // Restore original text when search is cleared
        restoreText(accountNameEl);
        restoreText(accountServiceEl);
        restoreText(accountEmailEl);
      }
    } else {
      card.style.display = 'none';
      // Restore text when hidden
      restoreText(accountNameEl);
      restoreText(accountServiceEl);
      restoreText(accountEmailEl);
    }
  });

  // Update section headers visibility based on visible items
  updateSectionHeadersVisibility();
  updateCardTabIndexes();
}

async function loadAccounts() {
  if (!isStorageAvailable()) {
    console.warn('Skipping account load; chrome.storage.local is unavailable in this context.');
    return;
  }

  try {
    // Load accounts from chrome.storage
    const result = await chromeApi.storage.local.get(['accounts']);
    if (result.accounts) {
      // TODO: Render accounts dynamically
      console.log('Accounts loaded:', result.accounts);
    }
    // Sync current DOM account cards to storage so content script (login suggestion modal) can read them
    syncAccountsToStorage();
  } catch (error) {
    console.error('Error loading accounts:', error);
  }
}

// Build accounts array from current account cards in DOM and save to storage (for login suggestion modal on pages)
function syncAccountsToStorage() {
  if (!isStorageAvailable()) return;
  const contentArea = document.getElementById('contentArea');
  if (!contentArea) return;
  const cards = contentArea.querySelectorAll('.account-card');
  const accounts = [];
  cards.forEach(card => {
    const accountServiceEl = card.querySelector('.account-service');
    const service = accountServiceEl?.dataset.originalText || accountServiceEl?.textContent.trim() || '';
    if (service === 'Secret') return;
    const accountNameEl = card.querySelector('.account-name');
    const accountEmailEl = card.querySelector('.account-email');
    const name = accountNameEl?.dataset.originalText || accountNameEl?.textContent.trim() || '';
    const email = accountEmailEl?.textContent.trim() || '';
    const hasSso = !!card.querySelector('.sso-badge');
    const hasMfa = !!card.querySelector('.mfa-badge');
    const hasBadCredentials = !!card.querySelector('.bad-credentials-badge');
    const logoImg = card.querySelector('.app-logo');
    const logoUrl = logoImg?.src || '';
    accounts.push({ service, name, email, hasSso, hasMfa, hasBadCredentials, logoUrl });
  });
  chromeApi.storage.local.set({ accounts }).catch(() => {});
}

async function saveAccounts(accounts) {
  if (!isStorageAvailable()) {
    console.warn('Skipping account save; chrome.storage.local is unavailable in this context.');
    return;
  }

  try {
    await chromeApi.storage.local.set({ accounts });
  } catch (error) {
    console.error('Error saving accounts:', error);
  }
}

// Get current tab URL for filtering "For this website" items
async function getCurrentTab() {
  if (!isTabsAvailable()) {
    console.warn('chrome.tabs.query is not available in this context.');
    return null;
  }

  return new Promise(resolve => {
    try {
      chromeApi.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (chromeApi.runtime && chromeApi.runtime.lastError) {
          console.warn('chrome.tabs.query error:', chromeApi.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null);
      });
    } catch (error) {
      console.error('Error getting current tab:', error);
      resolve(null);
    }
  });
}

// Extract domain from URL
function extractDomain(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    // Remove www. prefix if present
    return hostname.replace(/^www\./, '').toLowerCase();
  } catch (error) {
    console.error('Error extracting domain:', error);
    return null;
  }
}

// Provider to domain mapping (for matching current website)
const providerDomainMap = {
  'Make': 'make.com',
  'Mailchimp': 'mailchimp.com',
  'Loom': 'loom.com',
  'Pinterest': 'pinterest.com',
  'OpenAI': 'openai.com',
  'Apple': 'apple.com',
  'Spotify': 'spotify.com',
  'Bitso': 'bitso.com',
  'Capital One': 'capitalone.com',
  'Cursor': 'cursor.sh',
  'Grammarly': 'grammarly.com',
  'Google': 'google.com',
  'Notion': 'notion.so',
  'Figma': 'figma.com',
  'Atlassian': 'atlassian.com',
  'Dropbox': 'dropbox.com',
  'Adobe': 'adobe.com',
  'HubSpot': 'hubspot.com',
  'Salesforce': 'salesforce.com'
};

// Provider to login URL mapping (actual login page URLs)
const providerLoginUrlMap = {
  'Make': 'https://www.make.com/en/login',
  'Mailchimp': 'https://login.mailchimp.com/',
  'Loom': 'https://www.loom.com/login',
  'Pinterest': 'https://www.pinterest.com/login/',
  'OpenAI': 'https://platform.openai.com/login',
  'Apple': 'https://appleid.apple.com/',
  'Spotify': 'https://accounts.spotify.com/en/login',
  'Bitso': 'https://bitso.com/login',
  'Capital One': 'https://www.capitalone.com/sign-in',
  'Cursor': 'https://cursor.sh/login',
  'Grammarly': 'https://www.grammarly.com/signin',
  'Google': 'https://accounts.google.com/signin',
  'Notion': 'https://www.notion.so/login',
  'Figma': 'https://www.figma.com/login',
  'Atlassian': 'https://id.atlassian.com/login',
  'Dropbox': 'https://www.dropbox.com/login',
  'Adobe': 'https://account.adobe.com/',
  'HubSpot': 'https://app.hubspot.com/login',
  'Salesforce': 'https://login.salesforce.com/'
};

// Organize accounts into "For this website" and "Other items" sections
async function organizeAccountsByWebsite() {
  const contentArea = document.getElementById('contentArea');
  if (!contentArea) return;

  // Get current tab
  const tab = await getCurrentTab();
  const currentDomain = extractDomain(tab?.url);

  // Get all account cards and section headers BEFORE clearing
  const allCards = Array.from(contentArea.querySelectorAll('.account-card'));
  const sectionHeaders = contentArea.querySelectorAll('.section-header');
  
  // Clone section headers to preserve them
  let forThisWebsiteHeader = null;
  let otherItemsHeader = null;
  
  if (sectionHeaders.length > 0) {
    forThisWebsiteHeader = sectionHeaders[0].cloneNode(true);
    if (sectionHeaders.length > 1) {
      otherItemsHeader = sectionHeaders[1].cloneNode(true);
    } else {
      // Create other items header if it doesn't exist
      otherItemsHeader = document.createElement('div');
      otherItemsHeader.className = 'section-header';
      const title = document.createElement('p');
      title.className = 'section-title';
      title.textContent = 'Other items:';
      otherItemsHeader.appendChild(title);
    }
  } else {
    // Create section headers if they don't exist
    forThisWebsiteHeader = document.createElement('div');
    forThisWebsiteHeader.className = 'section-header';
    const title1 = document.createElement('p');
    title1.className = 'section-title';
    title1.textContent = 'For this website:';
    forThisWebsiteHeader.appendChild(title1);
    
    otherItemsHeader = document.createElement('div');
    otherItemsHeader.className = 'section-header';
    const title2 = document.createElement('p');
    title2.className = 'section-title';
    title2.textContent = 'Other items:';
    otherItemsHeader.appendChild(title2);
  }

  const matchingAccounts = [];
  const otherItems = [];

  allCards.forEach(card => {
    const accountServiceEl = card.querySelector('.account-service');
    const accountService = accountServiceEl?.dataset.originalText || accountServiceEl?.textContent.trim() || '';
    const isSecret = accountService === 'Secret';
    const providerDomain = providerDomainMap[accountService];
    
    if (!isSecret && currentDomain && providerDomain && currentDomain === providerDomain) {
      matchingAccounts.push(card);
    } else {
      otherItems.push(card);
    }
  });

  // Create containers
  const forThisWebsiteContainer = document.createElement('div');
  forThisWebsiteContainer.className = 'for-this-website-container';
  forThisWebsiteContainer.style.display = 'flex';
  forThisWebsiteContainer.style.flexDirection = 'column';

  const otherItemsContainer = document.createElement('div');
  otherItemsContainer.className = 'other-items-container';
  otherItemsContainer.style.display = 'flex';
  otherItemsContainer.style.flexDirection = 'column';

  // Add matching accounts to "For this website"
  matchingAccounts.forEach(card => {
    card.style.display = 'flex'; // Ensure cards are visible
    forThisWebsiteContainer.appendChild(card);
  });

  // Add remaining items (accounts and secrets) to "Other items" preserving original order
  otherItems.forEach(card => {
    card.style.display = 'flex'; // Ensure cards are visible
    otherItemsContainer.appendChild(card);
  });

  // Rebuild the content area structure
  contentArea.innerHTML = '';

  // Always append both sections, but control visibility based on whether they have items
  // Append "For this website" section
  contentArea.appendChild(forThisWebsiteHeader);
  contentArea.appendChild(forThisWebsiteContainer);
  
  // Append "Other items" section
  contentArea.appendChild(otherItemsHeader);
  contentArea.appendChild(otherItemsContainer);

  // Re-initialize event listeners after DOM reorganization
  initializeAccountCardListeners();
  initializeLoginButtons();
  initializeDropdownMenu();
  initializeAccountListAccessibility();
  
  // Re-initialize logo loading for any new logos
  initializeLogoLoading();
  
  // Initialize original text for highlighting
  initializeOriginalText();
  
  // Update section headers visibility after organization
  updateSectionHeadersVisibility();

  // Sync account list to storage for login suggestion modal on login pages
  syncAccountsToStorage();
  
  // Ensure filter is applied with empty search to show all items initially
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    const currentSearchTerm = searchInput.value || '';
    filterAccounts(currentSearchTerm);
  }
}

// Initialize account card click listeners
function initializeAccountCardListeners() {
  const accountCards = document.querySelectorAll('.account-card');
  accountCards.forEach(card => {
    // Remove existing listeners by cloning
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);
    
    // Add new listener
    newCard.addEventListener('click', function(e) {
      // Don't trigger card click if clicking on action buttons or dropdown
      if (e.target.closest('.account-action-button') || e.target.closest('.dropdown-menu')) {
        return;
      }
      const accountServiceEl = newCard.querySelector('.account-service');
      const accountService = accountServiceEl?.dataset.originalText || accountServiceEl?.textContent.trim() || '';
      // Secret cards open account details; account cards trigger auto-login
      if (accountService === 'Secret') {
        showAccountDetails(newCard);
      } else {
        triggerAutoLogin(newCard);
      }
    });
  });
}

function initializeAccountListAccessibility() {
  const contentArea = document.getElementById('contentArea');
  if (!contentArea) return;

  contentArea.setAttribute('role', 'list');

  const accountCards = Array.from(contentArea.querySelectorAll('.account-card'));
  accountCards.forEach(card => {
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '-1');

    card.removeEventListener('focusin', handleAccountCardFocus);
    card.removeEventListener('focusout', handleAccountCardFocusOut);
    card.removeEventListener('keydown', handleAccountCardKeyDown);

    card.addEventListener('focusin', handleAccountCardFocus);
    card.addEventListener('focusout', handleAccountCardFocusOut);
    card.addEventListener('keydown', handleAccountCardKeyDown);

    const actionButtons = Array.from(card.querySelectorAll('.account-actions button'));
    actionButtons.forEach(button => {
      button.removeEventListener('keydown', handleAccountActionKeyDown);
      button.addEventListener('keydown', handleAccountActionKeyDown);
    });
  });

  updateCardTabIndexes();
}

function getVisibleAccountCards() {
  const contentArea = document.getElementById('contentArea');
  if (!contentArea) return [];

  return Array.from(contentArea.querySelectorAll('.account-card'))
    .filter(card => card.offsetParent !== null);
}

function updateCardTabIndexes(preferredCard) {
  const visibleCards = getVisibleAccountCards();
  if (!visibleCards.length) return;

  let activeCard = preferredCard && visibleCards.includes(preferredCard)
    ? preferredCard
    : visibleCards.find(card => card === document.activeElement);

  if (!activeCard) {
    activeCard = visibleCards[0];
  }

  visibleCards.forEach(card => {
    card.setAttribute('tabindex', card === activeCard ? '0' : '-1');
  });
}

function focusAccountCard(card) {
  if (!card) return;
  updateCardTabIndexes(card);
  card.focus();
}

function focusAdjacentCard(currentCard, direction) {
  const visibleCards = getVisibleAccountCards();
  const currentIndex = visibleCards.indexOf(currentCard);
  if (currentIndex === -1) return;

  const nextIndex = currentIndex + direction;
  if (nextIndex >= 0 && nextIndex < visibleCards.length) {
    focusAccountCard(visibleCards[nextIndex]);
  }
}

function handleAccountCardFocus(event) {
  const card = event.currentTarget;
  updateCardTabIndexes(card);
  card.classList.add('keyboard-focus');
}

function handleAccountCardFocusOut(event) {
  const card = event.currentTarget;
  if (!card.contains(event.relatedTarget)) {
    card.classList.remove('keyboard-focus');
  }
}

function handleAccountCardKeyDown(event) {
  if (event.target !== event.currentTarget) {
    return;
  }

  const card = event.currentTarget;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      focusAdjacentCard(card, 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      focusAdjacentCard(card, -1);
      break;
    case 'ArrowRight':
      if (focusCardAction(card, false)) {
        event.preventDefault();
      }
      break;
    case 'ArrowLeft':
      if (focusCardAction(card, true)) {
        event.preventDefault();
      }
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      const accountServiceEl = card.querySelector('.account-service');
      const accountService = accountServiceEl?.dataset.originalText || accountServiceEl?.textContent.trim() || '';
      if (accountService === 'Secret') {
        showAccountDetails(card);
      } else {
        triggerAutoLogin(card);
      }
      break;
    default:
      break;
  }
}

function handleAccountActionKeyDown(event) {
  const button = event.currentTarget;
  const card = button.closest('.account-card');
  if (!card) return;

  const actionButtons = Array.from(card.querySelectorAll('.account-actions button'));
  const currentIndex = actionButtons.indexOf(button);

  switch (event.key) {
    case 'ArrowRight':
      event.preventDefault();
      if (currentIndex < actionButtons.length - 1) {
        actionButtons[currentIndex + 1].focus();
      } else {
        focusAccountCard(card);
      }
      break;
    case 'ArrowLeft':
      event.preventDefault();
      if (currentIndex > 0) {
        actionButtons[currentIndex - 1].focus();
      } else {
        focusAccountCard(card);
      }
      break;
    case 'ArrowDown':
      event.preventDefault();
      focusAdjacentCard(card, 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      focusAdjacentCard(card, -1);
      break;
    default:
      break;
  }
}

function focusCardAction(card, focusLast = false) {
  const actionButtons = Array.from(card.querySelectorAll('.account-actions button'));
  if (!actionButtons.length) return false;

  const target = focusLast ? actionButtons[actionButtons.length - 1] : actionButtons[0];
  target.focus();
  return true;
}

// Build logo URL for an account (used by modal and expanded window)
function getAccountLogoUrl(accountService, logoImg) {
  const providerDomain = providerDomainMap[accountService];
  let domain = providerDomain;
  if (!domain && logoImg) {
    domain = logoImg.dataset?.domain || logoImg.dataset?.fallbackDomain;
    if (!domain && logoImg.src) {
      const src = logoImg.src;
      if (src.includes('favicons?domain=')) domain = src.split('favicons?domain=')[1]?.split('&')[0];
      else if (src.includes('logo.clearbit.com/')) domain = src.split('logo.clearbit.com/')[1]?.split('?')[0]?.split('&')[0];
    }
  }
  if (accountService === 'Make') return 'https://cdn.brandfetch.io/idVHU5hl7_/theme/light/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1690469461407';
  if (domain) return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  return (logoImg?.src || '').trim() || '';
}

// Open account details in a new small browser window (headless/popup window)
function openExpandedAccountDetails(accountCard) {
  const accountServiceEl = accountCard.querySelector('.account-service');
  const accountNameEl = accountCard.querySelector('.account-name');
  const accountEmailEl = accountCard.querySelector('.account-email');
  const logoImg = accountCard.querySelector('.app-logo');
  const ssoBadge = accountCard.querySelector('.account-badge.sso-badge');
  const ssoBadgeTextEl = ssoBadge?.querySelector('.badge-text');

  const accountService = accountServiceEl?.dataset.originalText || accountServiceEl?.textContent.trim() || '';
  const accountName = accountNameEl?.dataset.originalText || accountNameEl?.textContent.trim() || '';
  const accountEmail = accountEmailEl?.dataset.originalText || accountEmailEl?.textContent.trim() || '';
  const isSecret = accountService === 'Secret';
  const ssoBadgeText = ssoBadgeTextEl?.textContent.trim().toLowerCase() || '';
  const hasGoogleSso = !!(ssoBadge && ssoBadgeText.includes('sso'));
  const loginUrl = providerLoginUrlMap[accountService] || '';
  const logoUrl = getAccountLogoUrl(accountService, logoImg);
  const hasAlertBadge = !!accountCard.querySelector('.account-logo-alert-icon');
  const hasMFA = !!accountCard.querySelector('.mfa-badge');

  const usernameDisplay = accountEmail || accountName || '';
  const displayUrl = loginUrl.length > 35 ? loginUrl.substring(0, 35) + '...' : loginUrl;

  const payload = {
    accountService,
    accountName,
    accountEmail: usernameDisplay,
    loginUrl,
    displayUrl,
    logoUrl,
    hasAlertBadge,
    hasGoogleSso,
    isSecret,
    hasMFA,
    password: '••••••••••••••••',
    phone: accountCard.dataset.phone || '',
    totp: '123456'
  };

  const chromeApi = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);
  if (!chromeApi?.storage?.local?.set || !chromeApi?.runtime?.sendMessage) return;
  chromeApi.storage.local.set({ cerbyExpandedAccountDetails: payload }, () => {
    chromeApi.runtime.sendMessage({ action: 'openExpandedAccountDetailsWindow' });
  });
}

// Build a synthetic account card from an account object (for simplified view)
function createSyntheticAccountCard(account) {
  const card = document.createElement('div');
  card.className = 'account-card';
  const service = account.service || '';
  const name = account.name || '';
  const email = account.email || account.name || '';
  const hasSso = !!account.hasSso;
  const hasMfa = !!account.hasMfa;
  const hasBadCredentials = !!account.hasBadCredentials;
  const domain = providerDomainMap[service] || getDomainFromService(service);
  const logoUrl = account.logoUrl || (domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : '');
  card.innerHTML = `
    <div class="account-logo-container">
      <div class="app-logo-container">
        <img class="app-logo" src="${logoUrl}" alt="" data-domain="${domain || ''}" data-fallback-domain="${domain || ''}">
        ${hasBadCredentials ? '<div class="account-logo-alert-icon"></div>' : ''}
      </div>
    </div>
    <div class="account-info">
      <p class="account-service" data-original-text="${(service || '').replace(/"/g, '&quot;')}">${(service || '').replace(/</g, '&lt;')}</p>
      <p class="account-name" data-original-text="${(name || '').replace(/"/g, '&quot;')}">${(name || '').replace(/</g, '&lt;')}</p>
      <p class="account-email" data-original-text="${(email || '').replace(/"/g, '&quot;')}">${(email || '').replace(/</g, '&lt;')}</p>
      ${hasSso ? '<span class="account-badge sso-badge"><span class="badge-text">SSO</span></span>' : ''}
      ${hasMfa ? '<span class="mfa-badge"></span>' : ''}
    </div>`;
  return card;
}

// Show account details from an account object (used by simplified view)
function showAccountDetailsFromAccount(account, openedFromSimplifiedView = false) {
  const syntheticCard = createSyntheticAccountCard(account);
  if (openedFromSimplifiedView) {
    document.body.dataset.accountDetailsFromSimplifiedView = '1';
  }
  showAccountDetails(syntheticCard);
}

// Show account details modal
function showAccountDetails(accountCard) {
  const modal = document.getElementById('accountDetailsModal');
  if (!modal) return;
  
  // Extract account data from the card
  const accountServiceEl = accountCard.querySelector('.account-service');
  const accountNameEl = accountCard.querySelector('.account-name');
  const accountEmailEl = accountCard.querySelector('.account-email');
  const logoImg = accountCard.querySelector('.app-logo');
  const secretIcon = accountCard.querySelector('.secret-icon');
  const ssoBadge = accountCard.querySelector('.account-badge.sso-badge');
  const ssoBadgeTextEl = ssoBadge?.querySelector('.badge-text');
  
  const accountService = accountServiceEl?.dataset.originalText || accountServiceEl?.textContent.trim() || '';
  const accountName = accountNameEl?.dataset.originalText || accountNameEl?.textContent.trim() || '';
  const accountEmail = accountEmailEl?.dataset.originalText || accountEmailEl?.textContent.trim() || '';
  const isSecret = accountService === 'Secret';
  const ssoBadgeText = ssoBadgeTextEl?.textContent.trim().toLowerCase() || '';
  const hasGoogleSso = !!(ssoBadge && ssoBadgeText.includes('sso'));
  
  // Get provider login URL
  const loginUrl = providerLoginUrlMap[accountService] || '';
  
  // Populate modal with account data
  const providerEl = document.getElementById('accountDetailsProvider');
  const nameEl = document.getElementById('accountDetailsName');
  const emailEl = document.getElementById('accountDetailsEmail');
  const urlEl = document.getElementById('accountDetailsUrl');
  const logoImgEl = document.getElementById('accountDetailsLogoImg');
  const logoEl = document.getElementById('accountDetailsLogo');
  const alertBanner = document.getElementById('accountDetailsAlertBanner');
  const ssoBanner = document.getElementById('accountDetailsSsoBanner');
 
  if (providerEl) providerEl.textContent = accountService || 'Unknown';
  if (nameEl) nameEl.textContent = accountName || '';

  if (alertBanner) {
    const hasAlertBadge = !!accountCard.querySelector('.account-logo-alert-icon');
    alertBanner.style.display = (!isSecret && hasAlertBadge) ? 'flex' : 'none';
  }
  
  if (ssoBanner) {
    ssoBanner.style.display = (!isSecret && hasGoogleSso) ? 'flex' : 'none';
  }
  
  // Set logo - for secrets, use the secret icon with proper styling
  if (isSecret) {
    // For secret cards, create a secret icon container similar to the card
    if (logoEl) {
      // Hide the default logo image first
      if (logoImgEl) {
        logoImgEl.style.display = 'none';
      }
      
      // Clear and set up the logo container
      logoEl.innerHTML = '';
      logoEl.style.background = 'var(--primitive-purple-700)';
      logoEl.style.borderRadius = '3.2px';
      logoEl.style.position = 'absolute';
      logoEl.style.inset = '0';
      logoEl.style.overflow = 'hidden';
      logoEl.style.display = 'block';
      
      // Create the secret icon container structure (matching list view)
      const secretIconContainer = document.createElement('div');
      secretIconContainer.className = 'secret-icon-container';
      secretIconContainer.style.width = '100%';
      secretIconContainer.style.height = '100%';
      secretIconContainer.style.position = 'relative';
      
      // Create wrapper with 20% margins (matching list view)
      const secretIconWrapper = document.createElement('div');
      secretIconWrapper.className = 'secret-icon-wrapper';
      secretIconWrapper.style.position = 'absolute';
      secretIconWrapper.style.top = '20%';
      secretIconWrapper.style.left = '20%';
      secretIconWrapper.style.right = '20%';
      secretIconWrapper.style.bottom = '20%';
      secretIconWrapper.style.display = 'flex';
      secretIconWrapper.style.alignItems = 'center';
      secretIconWrapper.style.justifyContent = 'center';
      
      // Create rotated container (matching list view structure)
      const secretIconRotated = document.createElement('div');
      secretIconRotated.className = 'secret-icon-rotated';
      secretIconRotated.style.flex = 'none';
      secretIconRotated.style.width = '19.2px';
      secretIconRotated.style.height = '19.2px';
      secretIconRotated.style.transform = 'rotate(90deg)';
      secretIconRotated.style.overflow = 'hidden';
      secretIconRotated.style.position = 'relative';
      
      // Create the actual icon image
      const secretIconImg = document.createElement('img');
      secretIconImg.src = 'assets/secret-icon.svg';
      secretIconImg.alt = 'Secret';
      secretIconImg.className = 'secret-icon-img';
      secretIconImg.style.width = '15.36px';
      secretIconImg.style.height = '15.36px';
      secretIconImg.style.display = 'block';
      secretIconImg.style.maxWidth = 'none';
      secretIconImg.style.position = 'absolute';
      secretIconImg.style.left = '1.92px';
      secretIconImg.style.top = '1.92px';
      secretIconImg.style.transform = 'rotate(270deg)';
      
      secretIconRotated.appendChild(secretIconImg);
      secretIconWrapper.appendChild(secretIconRotated);
      secretIconContainer.appendChild(secretIconWrapper);
      logoEl.appendChild(secretIconContainer);
    }
  } else {
    // For regular accounts, reset logo container and use the app logo
    if (logoEl) {
      logoEl.innerHTML = '<img src="" alt="" class="account-details-logo-img" id="accountDetailsLogoImg">';
      logoEl.style.background = '';
      logoEl.style.borderRadius = '';
      logoEl.style.padding = '';
      logoEl.style.display = '';
      logoEl.style.alignItems = '';
      logoEl.style.justifyContent = '';
    }
    const logoImgElRestored = document.getElementById('accountDetailsLogoImg');
    if (logoImgElRestored) {
      // Get domain from provider domain map or from logo element
      const providerDomain = providerDomainMap[accountService];
      let domain = providerDomain;
      
      // Try to get domain from logo element if available
      if (!domain && logoImg) {
        domain = logoImg.dataset.domain || logoImg.dataset.fallbackDomain;
        if (!domain) {
          // Try to extract from src
          const currentSrc = logoImg.src || '';
          if (currentSrc.includes('favicons?domain=')) {
            domain = currentSrc.split('favicons?domain=')[1]?.split('&')[0];
          } else if (currentSrc.includes('logo.clearbit.com/')) {
            domain = currentSrc.split('logo.clearbit.com/')[1]?.split('?')[0]?.split('&')[0];
          }
        }
      }
      
      // For Make.com, use Brandfetch logo
      if (accountService === 'Make') {
        logoImgElRestored.src = 'https://cdn.brandfetch.io/idVHU5hl7_/theme/light/symbol.svg?c=1bxid64Mup7aczewSAYMX&t=1690469461407';
        logoImgElRestored.classList.add('make-logo');
        logoImgElRestored.dataset.domain = 'make.com';
        if (logoEl) {
          logoEl.classList.add('make-logo-container');
        }
        logoImgElRestored.onerror = function() {
          handleMakeLogoError(this);
        };
      } else if (domain) {
        // Use DuckDuckGo as primary source (most reliable for extensions)
        logoImgElRestored.src = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
        logoImgElRestored.dataset.domain = domain;
        logoImgElRestored.dataset.fallbackDomain = domain;
        logoImgElRestored.classList.remove('make-logo');
        if (logoEl) {
          logoEl.classList.remove('make-logo-container');
        }
        logoImgElRestored.onerror = function() {
          handleLogoError(this);
        };
      } else {
        // No domain found, try to use existing logo src
        const logoSrc = logoImg?.src || '';
        if (logoSrc) {
          logoImgElRestored.src = logoSrc;
          logoImgElRestored.onerror = function() {
            handleLogoError(this);
          };
        } else {
          logoImgElRestored.style.display = 'none';
        }
      }
      
      logoImgElRestored.alt = accountService || '';
      logoImgElRestored.style.display = 'block';
      logoImgElRestored.classList.add('app-logo');
      
      // Ensure container gets background class when logo loads (for Make.com)
      if (accountService === 'Make') {
        logoImgElRestored.addEventListener('load', function() {
          if (logoEl) {
            logoEl.classList.add('make-logo-container');
          }
        });
      }
    }
  }
  
  // Hide login button for secrets
  const openButton = document.getElementById('accountDetailsOpenButton');
  if (openButton) {
    openButton.style.display = isSecret ? 'none' : 'flex';
  }
  
  // Store URL for the open button
  modal.dataset.accountUrl = loginUrl;
  
  // Get all field elements
  const secretNoteField = document.getElementById('accountDetailsSecretNoteField');
  const emailField = document.getElementById('accountDetailsEmailField');
  const passwordField = document.getElementById('accountDetailsPasswordField');
  const totpField = document.getElementById('accountDetailsTotpField');
  const phoneField = document.getElementById('accountDetailsPhoneField');
  const urlField = document.getElementById('accountDetailsUrlField');
  const attachmentsSection = document.getElementById('accountDetailsAttachments');
  
  if (isSecret) {
    // Hide all regular account fields, show secret note field
    if (emailField) emailField.style.display = 'none';
    if (passwordField) passwordField.style.display = 'none';
    if (totpField) totpField.style.display = 'none';
    if (phoneField) phoneField.style.display = 'none';
    if (urlField) urlField.style.display = 'none';
    if (secretNoteField) secretNoteField.style.display = 'flex';
    // Initialize secret note field with hidden state
    initializeSecretNoteField(accountCard);
    populateAttachmentsSection(accountCard);
    
    // Stop TOTP counter if running
    stopTotpCounter();
  } else {
    // Show regular account fields, hide secret note field
    if (emailField) emailField.style.display = 'flex';
    if (passwordField) passwordField.style.display = hasGoogleSso ? 'none' : 'flex';
    if (phoneField) phoneField.style.display = hasGoogleSso ? 'none' : 'flex';
    if (urlField) urlField.style.display = 'flex';
    if (secretNoteField) secretNoteField.style.display = 'none';
    
    populateAttachmentsSection();
    
    // Populate email field with email if available, otherwise use username (extracted from email or account name)
    if (emailEl) {
      if (accountEmail) {
        emailEl.textContent = accountEmail;
      } else {
        // Extract username from account name if no email
        let username = accountName || '';
        emailEl.textContent = username;
      }
    }
    
    if (urlEl) {
      // Truncate URL if too long
      const displayUrl = loginUrl.length > 35 ? loginUrl.substring(0, 35) + '...' : loginUrl;
      urlEl.textContent = displayUrl || '';
    }
    
    // Check if account has MFA badge
    const mfaBadge = accountCard.querySelector('.mfa-badge');
    const hasMFA = mfaBadge !== null;
    
    // Show/hide TOTP field based on MFA badge
    if (totpField) {
      if (hasMFA) {
        totpField.style.display = hasGoogleSso ? 'none' : 'flex';
        // Initialize TOTP code and counter
        if (!hasGoogleSso) {
          initializeTotpField();
        } else {
          stopTotpCounter();
        }
      } else {
        totpField.style.display = 'none';
        // Stop TOTP counter if running
        stopTotpCounter();
      }
    }
  }
  

  // Show modal
  modal.classList.add('show');
  
  // Hide main extension content (header, search, content area, footer)
  const header = document.querySelector('.header');
  const searchSection = document.querySelector('.search-section');
  const contentArea = document.getElementById('contentArea');
  const footer = document.querySelector('.footer');
  
  if (header) header.style.display = 'none';
  if (searchSection) searchSection.style.display = 'none';
  if (contentArea) contentArea.style.display = 'none';
  if (footer) footer.style.display = 'none';
}

// TOTP counter interval
let totpCounterInterval = null;

// Initialize TOTP field with code and counter
function initializeTotpField() {
  // Stop any existing counter
  stopTotpCounter();
  
  // Generate TOTP code (placeholder - in real implementation, this would use a TOTP library)
  const totpValue = generateTotpCode();
  const totpValueEl = document.getElementById('accountDetailsTotpValue');
  if (totpValueEl) {
    totpValueEl.textContent = totpValue;
  }
  
  // Start counter
  startTotpCounter();
}

// Generate TOTP code (placeholder implementation)
function generateTotpCode() {
  // In a real implementation, this would use a TOTP library like otplib
  // For now, generate a random 6-digit code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Start TOTP counter
function startTotpCounter() {
  const counterText = document.getElementById('totpCounterText');
  const counterCircle = document.getElementById('totpCounterCircle');
  
  if (!counterText || !counterCircle) return;
  
  // Calculate time remaining in current 30-second period
  const now = Date.now();
  const currentPeriod = Math.floor(now / 30000);
  const periodStart = currentPeriod * 30000;
  const periodEnd = periodStart + 30000;
  let timeRemaining = Math.ceil((periodEnd - now) / 1000);
  
  // Update counter immediately
  updateTotpCounter(counterText, counterCircle, timeRemaining);
  
  // Update counter every second
  totpCounterInterval = setInterval(() => {
    const now = Date.now();
    const currentPeriod = Math.floor(now / 30000);
    const periodStart = currentPeriod * 30000;
    const periodEnd = periodStart + 30000;
    timeRemaining = Math.ceil((periodEnd - now) / 1000);
    
    if (timeRemaining <= 0) {
      // Period expired, regenerate code and reset counter
      const totpValue = generateTotpCode();
      const totpValueEl = document.getElementById('accountDetailsTotpValue');
      if (totpValueEl) {
        totpValueEl.textContent = totpValue;
      }
      timeRemaining = 30;
    }
    
    // Re-get elements in case DOM changed
    const currentCounterText = document.getElementById('totpCounterText');
    const currentCounterCircle = document.getElementById('totpCounterCircle');
    if (currentCounterText && currentCounterCircle) {
      updateTotpCounter(currentCounterText, currentCounterCircle, timeRemaining);
    }
  }, 1000);
}

// Update TOTP counter display
function updateTotpCounter(counterText, counterCircle, seconds) {
  if (counterText) {
    counterText.textContent = seconds;
  }
  
  if (counterCircle) {
    const progressCircle = counterCircle.querySelector('.totp-counter-progress');
    if (progressCircle) {
      // Calculate progress (0 to 1)
      const progress = (30 - seconds) / 30;
      // Update stroke-dashoffset for circular progress
      // Circumference = 2 * π * r = 2 * π * 10 ≈ 62.83
      const circumference = 2 * Math.PI * 10;
      const offset = circumference - (progress * circumference);
      progressCircle.style.strokeDashoffset = offset;
    }
  }
}

// Stop TOTP counter
function stopTotpCounter() {
  if (totpCounterInterval) {
    clearInterval(totpCounterInterval);
    totpCounterInterval = null;
  }
}

// Secret note reveal state
let secretNoteRevealed = false; // Default to hidden (not revealed)

// Initialize secret note field
function initializeSecretNoteField(accountCard) {
  const secretNoteTextarea = document.getElementById('accountDetailsSecretNote');
  const revealButton = document.getElementById('secretNoteRevealButton');
  const copyButton = document.getElementById('secretNoteCopyButton');
  const visibilityIcon = document.getElementById('secretNoteVisibilityIcon');
  
  if (!secretNoteTextarea) return;
  
  // Get the actual secret note text (in a real implementation, this would come from secure storage)
  // For now, use a placeholder or get from card data
  const actualSecretNote = accountCard.dataset.secretNote || 'This is a secret key that should be kept secure. It contains sensitive information that must not be shared with unauthorized parties.';
  
  // Store the actual secret note in the textarea's dataset
  secretNoteTextarea.dataset.actualSecret = actualSecretNote;
  
  // Set initial state to hidden (show only 8 obfuscated dots)
  secretNoteRevealed = false;
  secretNoteTextarea.value = '••••••••';
  
  // Set initial height to single line
  secretNoteTextarea.style.height = '20px';
  
  // Set initial field size to single line
  const secretNoteField = document.getElementById('accountDetailsSecretNoteField');
  if (secretNoteField) {
    secretNoteField.style.minHeight = '61px';
  }
  
  // Note: Icon will remain as visibility-icon.svg (same as password field)
  // The state is tracked in secretNoteRevealed variable
  
  // Remove existing event listeners by cloning and replacing
  if (revealButton) {
    const newRevealButton = revealButton.cloneNode(true);
    revealButton.parentNode.replaceChild(newRevealButton, revealButton);
    
    // Get the updated button reference
    const updatedRevealButton = document.getElementById('secretNoteRevealButton');
    const updatedVisibilityIcon = document.getElementById('secretNoteVisibilityIcon');
    
    // Add new reveal button handler
    if (updatedRevealButton) {
      updatedRevealButton.addEventListener('click', function(e) {
        e.stopPropagation();
        
        secretNoteRevealed = !secretNoteRevealed;
        const secretNoteField = document.getElementById('accountDetailsSecretNoteField');
        
        if (secretNoteRevealed) {
          // Show actual secret note
          secretNoteTextarea.value = actualSecretNote;
          
          // Expand field to fit content
          // Reset height to auto to calculate new height
          secretNoteTextarea.style.height = 'auto';
          // Set height based on scrollHeight to fit all content
          secretNoteTextarea.style.height = secretNoteTextarea.scrollHeight + 'px';
          
          // Update field min-height to accommodate expanded content
          if (secretNoteField) {
            const headerHeight = 40; // Approximate header height
            const padding = 20; // Top and bottom padding
            const newMinHeight = secretNoteTextarea.scrollHeight + headerHeight + padding;
            secretNoteField.style.minHeight = newMinHeight + 'px';
          }
        } else {
          // Hide secret note with 8 obfuscated dots
          secretNoteTextarea.value = '••••••••';
          
          // Reset to single line height
          secretNoteTextarea.style.height = '20px';
          
          // Reset field to single line size
          if (secretNoteField) {
            secretNoteField.style.minHeight = '61px';
          }
        }
      });
    }
  }
  
  // Remove existing event listeners by cloning and replacing
  if (copyButton) {
    const newCopyButton = copyButton.cloneNode(true);
    copyButton.parentNode.replaceChild(newCopyButton, copyButton);
    
    // Get the updated button reference
    const updatedCopyButton = document.getElementById('secretNoteCopyButton');
    
    // Add new copy button handler
    if (updatedCopyButton) {
      updatedCopyButton.addEventListener('click', async function(e) {
        e.stopPropagation();
        
        try {
          await navigator.clipboard.writeText(actualSecretNote);
          showToast('Secret copied to clipboard');
        } catch (err) {
          console.error('Failed to copy secret:', err);
          showToast('Secret copied to clipboard');
        }
      });
    }
  }
}

function populateAttachmentsSection(accountCard = null) {
  const attachmentsSection = document.getElementById('accountDetailsAttachments');
  if (!attachmentsSection) return;

  const attachmentsTitle = attachmentsSection.querySelector('.account-details-attachments-title');
  const attachmentsList = attachmentsSection.querySelector('.account-details-attachments-list');

  if (!attachmentsTitle || !attachmentsList) return;

  attachmentsList.innerHTML = '';
  attachmentsSection.style.display = 'none';
  attachmentsTitle.textContent = 'Attachments';

  if (!accountCard) {
    return;
  }

  const rawAttachments = accountCard.dataset.attachments;
  if (!rawAttachments || !rawAttachments.trim()) {
    return;
  }

  let attachments;
  try {
    attachments = JSON.parse(rawAttachments);
  } catch (err) {
    console.warn('Failed to parse attachments data:', err);
    return;
  }

  if (!Array.isArray(attachments) || attachments.length === 0) {
    return;
  }

  attachmentsSection.style.display = 'flex';
  attachmentsTitle.textContent = `Attachments (${attachments.length})`;

  attachments.forEach(attachment => {
    const item = document.createElement('div');
    item.className = 'account-details-attachment-item';

    const icon = document.createElement('div');
    icon.className = 'account-details-attachment-icon';
    icon.innerHTML = `
      <div class="attachment-icon-inner">
        <div class="attachment-icon-wrapper">
          <img src="assets/attachment-icon.svg" alt="Attachment" class="attachment-icon-img">
        </div>
      </div>
    `;
    item.appendChild(icon);

    const nameEl = document.createElement('span');
    nameEl.className = 'account-details-attachment-name';
    nameEl.textContent = attachment?.name || 'Attachment';
    item.appendChild(nameEl);

    if (attachment && attachment.type) {
      const typeEl = document.createElement('span');
      typeEl.className = 'account-details-attachment-type';
      typeEl.textContent = String(attachment.type).toUpperCase();
      item.appendChild(typeEl);
    }

    attachmentsList.appendChild(item);
  });
}

// Initialize account details modal
function initializeAccountDetailsModal() {
  const modal = document.getElementById('accountDetailsModal');
  const closeButton = document.getElementById('accountDetailsCloseButton');
  const editButton = document.getElementById('accountDetailsEditButton');
  const openButton = document.getElementById('accountDetailsOpenButton');
  
  // Close button handler
  if (closeButton) {
    closeButton.addEventListener('click', function() {
      if (modal) {
        modal.classList.remove('show');
      }
      // Stop TOTP counter when modal closes
      stopTotpCounter();
      // Restore correct view: if opened from simplified view, keep it; otherwise show main content
      const fromSimplified = document.body.dataset.accountDetailsFromSimplifiedView === '1';
      delete document.body.dataset.accountDetailsFromSimplifiedView;
      if (!fromSimplified) {
        const header = document.querySelector('.header');
        const searchSection = document.querySelector('.search-section');
        const contentArea = document.getElementById('contentArea');
        const footer = document.querySelector('.footer');
        if (header) header.style.display = '';
        if (searchSection) searchSection.style.display = '';
        if (contentArea) contentArea.style.display = '';
        if (footer) footer.style.display = '';
      }
    });
  }
  
  // Edit button handler
  if (editButton) {
    editButton.addEventListener('click', function() {
      // TODO: Open edit in Cerby
      console.log('Edit in Cerby clicked');
    });
  }
  
  // Open in new tab button handler
  if (openButton) {
    openButton.addEventListener('click', async function() {
      const url = modal?.dataset.accountUrl;
      if (!url) return;

      if (!isTabsAvailable()) {
        console.warn('chrome.tabs APIs are unavailable; cannot open login URL.');
        return;
      }

      chromeApi.tabs.create({ url: url });
    });
  }
  
  // Email field copy handler (now handles username or email)
  const emailField = document.getElementById('accountDetailsEmailField');
  if (emailField) {
    emailField.addEventListener('click', async function() {
      const emailEl = document.getElementById('accountDetailsEmail');
      const email = emailEl?.textContent.trim() || '';
      
      if (email) {
        try {
          await navigator.clipboard.writeText(email);
          showToast('Email copied to clipboard');
        } catch (err) {
          console.error('Failed to copy email:', err);
        }
      }
    });
  }
  
  // Phone field copy handler
  const phoneField = document.getElementById('accountDetailsPhoneField');
  if (phoneField) {
    phoneField.addEventListener('click', async function() {
      const phoneEl = document.getElementById('accountDetailsPhone');
      const phone = phoneEl?.textContent.trim() || '';
      
      if (phone) {
        try {
          await navigator.clipboard.writeText(phone);
          showToast('Phone copied to clipboard');
        } catch (err) {
          console.error('Failed to copy phone:', err);
        }
      }
    });
  }
  
  // Password field handlers
  const passwordField = document.getElementById('accountDetailsPasswordField');
  const passwordValueEl = document.getElementById('accountDetailsPasswordValue');
  const passwordCopyButton = document.getElementById('passwordCopyButton');
  const passwordRevealButton = document.getElementById('passwordRevealButton');
  let passwordRevealed = false;
  let actualPassword = ''; // Store actual password when revealed
  
  // Handle hover states for password field sections
  if (passwordField) {
    const passwordFieldLeft = passwordField.querySelector('.password-field-left');
    const passwordFieldRight = passwordField.querySelector('.password-field-right');
    
    if (!passwordField.dataset.keyboardFocusInit) {
      const handleFocusIn = () => {
        if (lastInteractionWasKeyboard) {
          passwordField.classList.add('keyboard-focus-ring');
        }
      };
      const handleFocusOut = (e) => {
        if (!passwordField.contains(e.relatedTarget)) {
          passwordField.classList.remove('keyboard-focus-ring');
        }
      };

      passwordField.addEventListener('focusin', handleFocusIn);
      passwordField.addEventListener('focusout', handleFocusOut);
      passwordField.dataset.keyboardFocusInit = 'true';
    }
    
    if (passwordFieldRight && !passwordFieldRight.dataset.keyboardInteractionInit) {
      const addRightHoverState = () => {
        if (passwordFieldLeft) {
          passwordFieldLeft.classList.add('right-section-hovered');
        }
      };
      const removeRightHoverState = () => {
        if (passwordFieldLeft) {
          passwordFieldLeft.classList.remove('right-section-hovered');
        }
      };

      passwordFieldRight.addEventListener('mouseenter', addRightHoverState);
      passwordFieldRight.addEventListener('mouseleave', removeRightHoverState);
      passwordFieldRight.addEventListener('focus', () => {
        addRightHoverState();
        if (lastInteractionWasKeyboard) {
          passwordField.classList.add('keyboard-focus-ring');
        }
      });
      passwordFieldRight.addEventListener('blur', removeRightHoverState);
      passwordFieldRight.dataset.keyboardInteractionInit = 'true';
    }
  }
  
  // Copy password handler
  if (passwordCopyButton) {
    passwordCopyButton.addEventListener('click', async function(e) {
      e.stopPropagation();
      
        try {
          if (passwordRevealed && actualPassword) {
            await navigator.clipboard.writeText(actualPassword);
            showToast('Password copied to clipboard');
          } else {
            // If password not revealed, we still allow clicking but password needs to be revealed first
            // In a real implementation, this might fetch the password from secure storage
            // Show toast to indicate action was attempted
            showToast('Password copied to clipboard');
            console.log('Password hidden - reveal to copy');
          }
        } catch (err) {
          console.error('Failed to copy password:', err);
          // Still show toast even on error
          showToast('Password copied to clipboard');
        }
    });
  }
  
  // Reveal password handler
  if (passwordRevealButton && passwordValueEl) {
    passwordRevealButton.addEventListener('click', async function(e) {
      e.stopPropagation();
      
      if (!passwordRevealed) {
        // Reveal password - in a real app, this would fetch from secure storage
        // For now, we'll use a placeholder
        actualPassword = 'actualPassword123!'; // This should come from secure storage
        passwordValueEl.textContent = actualPassword;
        passwordRevealed = true;
        // TODO: Change icon to "visibility-off" when password is revealed
      } else {
        // Hide password
        passwordValueEl.textContent = '••••••••••••••••••';
        passwordRevealed = false;
        actualPassword = '';
      }
    });
  }
  
  // URL field handlers
  const urlField = document.getElementById('accountDetailsUrlField');
  const urlValueEl = document.getElementById('accountDetailsUrl');
  const urlCopyButton = document.getElementById('urlCopyButton');
  const urlOpenButton = document.getElementById('urlOpenButton');
  
  // Handle hover states for URL field sections
  if (urlField) {
    const urlFieldLeft = urlField.querySelector('.url-field-left');
    const urlFieldRight = urlField.querySelector('.url-field-right');
    
    if (!urlField.dataset.keyboardFocusInit) {
      const handleFocusIn = () => {
        if (lastInteractionWasKeyboard) {
          urlField.classList.add('keyboard-focus-ring');
        }
      };
      const handleFocusOut = (e) => {
        if (!urlField.contains(e.relatedTarget)) {
          urlField.classList.remove('keyboard-focus-ring');
        }
      };

      urlField.addEventListener('focusin', handleFocusIn);
      urlField.addEventListener('focusout', handleFocusOut);
      urlField.dataset.keyboardFocusInit = 'true';
    }

    if (urlFieldRight && !urlFieldRight.dataset.keyboardInteractionInit) {
      const addRightHoverState = () => {
        if (urlFieldLeft) {
          urlFieldLeft.classList.add('right-section-hovered');
        }
      };
      const removeRightHoverState = () => {
        if (urlFieldLeft) {
          urlFieldLeft.classList.remove('right-section-hovered');
        }
      };

      urlFieldRight.addEventListener('mouseenter', addRightHoverState);
      urlFieldRight.addEventListener('mouseleave', removeRightHoverState);
      urlFieldRight.addEventListener('focus', () => {
        addRightHoverState();
        if (lastInteractionWasKeyboard) {
          urlField.classList.add('keyboard-focus-ring');
        }
      });
      urlFieldRight.addEventListener('blur', removeRightHoverState);
      urlFieldRight.dataset.keyboardInteractionInit = 'true';
    }
  }
  
  // Copy URL handler
  if (urlCopyButton && urlValueEl) {
    urlCopyButton.addEventListener('click', async function(e) {
      e.stopPropagation();
      
      // Get full URL from the modal's dataset (stored when showing account details)
      const modal = document.getElementById('accountDetailsModal');
      const fullUrl = modal?.dataset.accountUrl || urlValueEl.textContent.trim();
      
      try {
        await navigator.clipboard.writeText(fullUrl);
        showToast('URL copied to clipboard');
      } catch (err) {
        console.error('Failed to copy URL:', err);
      }
    });
  }
  
  // Open URL in new tab handler
  if (urlOpenButton) {
    urlOpenButton.addEventListener('click', async function(e) {
      e.stopPropagation();
      
      const modal = document.getElementById('accountDetailsModal');
      const url = modal?.dataset.accountUrl;
      
      if (!url) {
        return;
      }

      if (!isTabsAvailable()) {
        console.warn('chrome.tabs APIs are unavailable; cannot open URL field link.');
        return;
      }

      chromeApi.tabs.create({ url: url });
    });
  }
  
  // TOTP copy button handler
  const totpCopyButton = document.getElementById('totpCopyButton');
  const totpValueEl = document.getElementById('accountDetailsTotpValue');
  const totpCounter = document.getElementById('totpCounter');
  
  // Function to copy TOTP code
  const copyTotpCode = async function(e) {
    if (e) e.stopPropagation();
    
    if (!totpValueEl) return;
    const totpCode = totpValueEl.textContent.trim();
    
    try {
      await navigator.clipboard.writeText(totpCode);
      showToast('TOTP copied to clipboard');
    } catch (err) {
      console.error('Failed to copy TOTP:', err);
      showToast('TOTP copied to clipboard');
    }
  };
  
  if (totpCopyButton) {
    totpCopyButton.addEventListener('click', copyTotpCode);
  }
  
  // Allow clicking on counter to copy as well
  if (totpCounter) {
    totpCounter.style.cursor = 'pointer';
    totpCounter.addEventListener('click', copyTotpCode);
  }

}

// Trigger auto-login for an account card (used when clicking the card)
function triggerAutoLogin(card) {
  if (!card) return;
  const accountServiceEl = card.querySelector('.account-service');
  const accountService = accountServiceEl?.dataset.originalText || accountServiceEl?.textContent.trim() || '';
  if (accountService === 'Secret') return;
  const hasBadCredentials = card.querySelector('.account-logo-alert-icon') !== null ||
    card.querySelector('.bad-credentials-badge') !== null;
  proceedWithLogin(accountService, hasBadCredentials);
}

// Initialize login button functionality (no-op since login buttons were removed; card click handles auto-login)
function initializeLoginButtons() {
  // Login buttons removed - auto-login is triggered by clicking the whole card
}


// Proceed with login (opens login URL)
async function proceedWithLogin(accountService, showWarning = false) {
  // Get provider login URL
  const loginUrl = providerLoginUrlMap[accountService];
  if (!loginUrl) {
    console.log('No login URL mapping found for:', accountService);
    return;
  }
  
  // Get provider domain for matching current website
  const providerDomain = providerDomainMap[accountService];
  
  // Get current tab
  const currentTab = await getCurrentTab();
  const currentDomain = extractDomain(currentTab?.url);
  
  // Check if current domain matches provider domain
  if (!isTabsAvailable()) {
    console.warn('chrome.tabs APIs are unavailable; cannot open login URL.');
    return;
  }

  // Store flag for bad credentials warning if needed
  if (showWarning) {
    const tabId = currentDomain && providerDomain && currentDomain === providerDomain 
      ? currentTab?.id 
      : null; // Will be set after tab creation
    
    // Store in storage for content script to pick up
    chromeApi.storage.local.set({
      [`badCredentialsWarning_${accountService}`]: {
        accountService: accountService,
        timestamp: Date.now()
      }
    });
  }

  if (currentDomain && providerDomain && currentDomain === providerDomain) {
    // Same domain - navigate to login page in the same tab
    if (currentTab?.id) {
      chromeApi.tabs.update(currentTab.id, { url: loginUrl });
      // Inject script after navigation
      if (showWarning) {
        chromeApi.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === currentTab.id && changeInfo.status === 'complete') {
            chromeApi.tabs.onUpdated.removeListener(listener);
            // Wait a bit for content script to be ready, then send message with retry
            setTimeout(() => {
              sendBadCredentialsWarningWithRetry(currentTab.id, accountService);
            }, 500);
          }
        });
      }
    }
  } else {
    // Different domain - open new tab to login page
    chromeApi.tabs.create({ url: loginUrl }, (tab) => {
      if (showWarning && tab?.id) {
        // Wait for tab to load, then inject warning
        chromeApi.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chromeApi.tabs.onUpdated.removeListener(listener);
            // Wait a bit for content script to be ready, then send message with retry
            setTimeout(() => {
              sendBadCredentialsWarningWithRetry(tab.id, accountService);
            }, 500);
          }
        });
      }
    });
  }
}

// Send bad credentials warning message with retry logic
function sendBadCredentialsWarningWithRetry(tabId, accountService, retries = 5) {
  chromeApi.tabs.sendMessage(tabId, { action: 'showBadCredentialsWarning', accountService }, (response) => {
    if (chromeApi.runtime.lastError) {
      // Content script might not be ready yet, retry
      if (retries > 0) {
        setTimeout(() => {
          sendBadCredentialsWarningWithRetry(tabId, accountService, retries - 1);
        }, 500);
      } else {
        console.error('Failed to send bad credentials warning:', chromeApi.runtime.lastError);
        // Fallback: try to inject script directly using files
        chromeApi.scripting.executeScript({
          target: { tabId: tabId },
          files: ['inline.js']
        }).then(() => {
          // Wait a bit then send message again
          setTimeout(() => {
            chromeApi.tabs.sendMessage(tabId, { action: 'showBadCredentialsWarning', accountService }, (response) => {
              if (chromeApi.runtime.lastError) {
                console.error('Failed to show warning after script injection:', chromeApi.runtime.lastError);
              }
            });
          }, 500);
        }).catch(err => {
          console.error('Failed to inject script:', err);
          // Last resort: inject CSS and HTML directly
          injectBadCredentialsWarningDirectly(tabId, accountService);
        });
      }
    } else if (response && response.success) {
      console.log('Bad credentials warning shown successfully');
    }
  });
}

// Last resort: inject CSS and HTML directly
function injectBadCredentialsWarningDirectly(tabId, accountService) {
  const iconUrl = chromeApi.runtime.getURL('assets/bad-credentials-icon.svg');
  
  // Inject CSS
  chromeApi.scripting.insertCSS({
    target: { tabId: tabId },
    files: ['inline.css']
  }).catch(err => console.error('Failed to inject CSS:', err));
  
  // Inject the overlay HTML and script
  chromeApi.scripting.executeScript({
    target: { tabId: tabId },
    func: function(iconUrl) {
      const BAD_CREDENTIALS_OVERLAY_ID = 'cerby-bad-credentials-overlay';
      
      if (document.getElementById(BAD_CREDENTIALS_OVERLAY_ID)) {
        return;
      }
      
      const overlay = document.createElement('div');
      overlay.id = BAD_CREDENTIALS_OVERLAY_ID;
      overlay.className = 'cerby-bad-credentials-overlay';
      
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
      
      function showLoggingInState(overlayEl) {
        console.log('[Cerby] Showing logging in state');
        
        const logoUrl = chrome.runtime.getURL('assets/cerby-logo-modal.svg');
        const spinnerUrl = chrome.runtime.getURL('assets/spinner-base.svg');
        
        // Update overlay content to loading state
        const content = overlayEl.querySelector('.cerby-bad-credentials-overlay-content');
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
        overlayEl.classList.add('loading');
        
        // Remove overlay after 4 seconds
        setTimeout(() => {
          overlayEl.remove();
        }, 4000);
      }
      
      if (document.body) {
        document.body.appendChild(overlay);
        
        const tryAnywayBtn = overlay.querySelector('#cerbyBadCredentialsTryAnyway');
        const reviewBtn = overlay.querySelector('#cerbyBadCredentialsReview');
        
        if (tryAnywayBtn) {
          tryAnywayBtn.addEventListener('click', () => showLoggingInState(overlay));
        }
        
        if (reviewBtn) {
          reviewBtn.addEventListener('click', () => overlay.remove());
        }
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          document.body.appendChild(overlay);
          
          const tryAnywayBtn = overlay.querySelector('#cerbyBadCredentialsTryAnyway');
          const reviewBtn = overlay.querySelector('#cerbyBadCredentialsReview');
          
          if (tryAnywayBtn) {
            tryAnywayBtn.addEventListener('click', () => showLoggingInState(overlay));
          }
          
          if (reviewBtn) {
            reviewBtn.addEventListener('click', () => overlay.remove());
          }
        });
      }
    },
    args: [iconUrl]
  }).catch(err => console.error('Failed to inject overlay:', err));
}


function syncBadCredentialsAutoLoginTooltip(button) {
  if (!button) return;

  const card = button.closest('.account-card');
  if (!card) return;

  const hasBadCredentials = card.querySelector('.account-logo-alert-icon') !== null ||
                            card.querySelector('.bad-credentials-badge') !== null;
  const existingCustomTooltip = button.querySelector('.loom-warning-tooltip-content');

  if (hasBadCredentials) {
    button.classList.add('loom-warning-tooltip');
    button.removeAttribute('data-tooltip');

    if (!existingCustomTooltip) {
      button.appendChild(createBadCredentialsTooltip());
    }
  } else {
    button.classList.remove('loom-warning-tooltip');

    if (existingCustomTooltip) {
      existingCustomTooltip.remove();
    }

    if (!button.hasAttribute('data-tooltip')) {
      button.setAttribute('data-tooltip', 'Auto-login');
    }
  }
}

function createBadCredentialsTooltip() {
  const tooltip = document.createElement('div');
  tooltip.className = 'custom-tooltip loom-warning-tooltip-content';

  const tooltipContent = document.createElement('div');
  tooltipContent.className = 'custom-tooltip-content';

  const iconContainer = document.createElement('div');
  iconContainer.className = 'custom-tooltip-icon';

  const iconImage = document.createElement('img');
  iconImage.src = 'assets/bad-credentials-icon.svg';
  iconImage.alt = 'Warning';
  iconImage.className = 'warning-icon-img';

  iconContainer.appendChild(iconImage);

  const text = document.createElement('p');
  text.className = 'custom-tooltip-text';

  const descriptionSpan = document.createElement('span');
  descriptionSpan.textContent = 'This account\'s credentials might be incorrect, and could affect login. ';

  const boldSpan = document.createElement('span');
  boldSpan.className = 'custom-tooltip-text-bold';
  boldSpan.textContent = 'Please update the credentials in Cerby.';

  text.appendChild(descriptionSpan);
  text.appendChild(boldSpan);

  tooltipContent.appendChild(iconContainer);
  tooltipContent.appendChild(text);

  tooltip.appendChild(tooltipContent);

  return tooltip;
}

