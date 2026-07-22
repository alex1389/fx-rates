const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const toneEl = document.getElementById("tone");
const profileEl = document.getElementById("profile");
const saveBtn = document.getElementById("save");
const savedEl = document.getElementById("saved");

async function load() {
  const stored = await chrome.storage.local.get(["apiKey", "model", "tone", "profile"]);
  if (stored.apiKey) apiKeyEl.value = stored.apiKey;
  if (stored.model) modelEl.value = stored.model;
  if (stored.tone) toneEl.value = stored.tone;
  if (stored.profile) profileEl.value = stored.profile;
}

saveBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({
    apiKey: apiKeyEl.value.trim(),
    model: modelEl.value,
    tone: toneEl.value,
    profile: profileEl.value.trim(),
  });
  savedEl.hidden = false;
  setTimeout(() => (savedEl.hidden = true), 2000);
});

load();
