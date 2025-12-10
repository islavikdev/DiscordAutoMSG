chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getToken") {
        chrome.storage.local.get(['userToken'], (result) => {
            sendResponse({token: result.userToken});
        });
        return true;
    }

    if (request.action === "saveToken") {
        chrome.storage.local.set({ userToken: request.token }, () => {
            sendResponse({success: true});
        });
        return true;
    }
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ sources: [] });
});