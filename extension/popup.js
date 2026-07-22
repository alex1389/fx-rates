document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.local.get(["apiKey"], (stored) => {
  const el = document.getElementById("status");
  if (stored.apiKey) {
    el.textContent = "API key configured.";
    el.className = "ok";
  } else {
    el.textContent = "No API key set yet — open settings to add one.";
    el.className = "warn";
  }
});
