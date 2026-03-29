/**
 * Drunk Walker Extension - Background Script
 * Handles extension lifecycle and message routing
 */

// Listen for extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Drunk Walker extension installed');
  } else if (details.reason === 'update') {
    console.log('Drunk Walker extension updated to version', chrome.runtime.getManifest().version);
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'inject') {
    // Inject content script into the specified tab
    if (sender.tab) {
      injectDrunkWalker(sender.tab.id);
    } else if (message.tabId) {
      injectDrunkWalker(message.tabId);
    }
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open for async response
});

/**
 * Inject Drunk Walker bundle into a tab
 * @param {number} tabId - The tab ID to inject into
 */
async function injectDrunkWalker(tabId) {
  try {
    // Execute the content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    
    console.log('Drunk Walker injected into tab', tabId);
  } catch (error) {
    console.error('Failed to inject Drunk Walker:', error);
  }
}

// Handle keyboard shortcuts (optional future feature)
chrome.commands?.onCommand?.addListener(async (command) => {
  if (command === 'toggle-drunk-walker') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
      } catch (error) {
        console.log('Drunk Walker not active in this tab');
      }
    }
  }
});
