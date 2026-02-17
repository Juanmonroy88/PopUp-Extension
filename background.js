// Background service worker for Cerby Chrome extension (popup build).
// Handles messaging (performLogin, fillAccountFromPanel, open settings/panel, expanded account window).

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

function extractDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {
    return null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'cerby-inline-open-settings') {
    chrome.action.openPopup().catch(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    });
    return false;
  }
  if (message.type === 'cerby-inline-open-panel') {
    const provider = message.provider || '';
    const fieldType = message.fieldType || 'email';
    const tabId = sender?.tab?.id;
    chrome.storage.local.set({
      inlineExpandedProvider: provider,
      inlineExpandedFieldType: fieldType,
      inlineExpandedTabId: tabId || null
    });
    chrome.action.openPopup().catch(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    });
    return false;
  }
  if (message.action === 'fillAccountFromPanel') {
    const { tabId, account, fieldType } = message;
    if (tabId && account) {
      chrome.tabs.sendMessage(tabId, { action: 'fillAccountFromPanel', account, fieldType: fieldType || 'email' });
    }
    return false;
  }
  if (message.action === 'getAccountCredentials') {
    const { service, email } = message;
    chrome.storage.local.get(['accountCredentials'], (result) => {
      const creds = result?.accountCredentials || {};
      const key = `${service}|${email}`;
      sendResponse(creds[key] || { email: message.email || null, password: null });
    });
    return true;
  }
  if (message.action === 'performLogin') {
    const accountService = message.accountService;
    const loginUrl = providerLoginUrlMap[accountService];
    if (!loginUrl) {
      sendResponse({ success: false, error: 'No login URL for ' + accountService });
      return true;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null;
      if (!tab?.id) {
        sendResponse({ success: false, error: 'No active tab' });
        return;
      }
      const currentDomain = extractDomain(tab.url);
      const providerDomain = providerDomainMap[accountService];
      if (currentDomain && providerDomain && currentDomain === providerDomain) {
        chrome.tabs.update(tab.id, { url: loginUrl }, () => {
          sendResponse({ success: true });
        });
      } else {
        chrome.tabs.create({ url: loginUrl }, () => {
          sendResponse({ success: true });
        });
      }
    });
    return true; // keep channel open for async sendResponse
  }
  if (message.action === 'openExpandedAccountDetailsWindow') {
    const url = chrome.runtime.getURL('account-details-window.html');
    chrome.windows.create({
      url,
      type: 'popup',
      width: 420,
      height: 640,
      focused: true
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
