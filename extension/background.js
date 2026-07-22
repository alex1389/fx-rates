const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-opus-4-8";

async function getSettings() {
  const stored = await chrome.storage.local.get([
    "apiKey",
    "model",
    "profile",
    "tone",
  ]);
  return {
    apiKey: stored.apiKey || "",
    model: stored.model || DEFAULT_MODEL,
    profile: stored.profile || "",
    tone: stored.tone || "confident and professional",
  };
}

function buildGeneratePrompt({ jobDescription, profile, tone, existingDraft }) {
  return [
    "You are helping a freelancer write a winning Upwork proposal (cover letter).",
    "",
    "FREELANCER PROFILE / BACKGROUND:",
    profile || "(no profile provided — write generically but competently)",
    "",
    "DESIRED TONE:",
    tone,
    "",
    "JOB POSTING:",
    jobDescription || "(no job description was captured — ask for the key requirements instead of guessing)",
    "",
    existingDraft
      ? `The freelancer already has a partial draft they want you to build on:\n${existingDraft}\n`
      : "",
    "Write a concise, specific Upwork cover letter (150-250 words) that:",
    "- Opens by directly addressing the client's specific need, not a generic greeting",
    "- References 1-2 concrete, relevant pieces of the freelancer's background",
    "- Proposes a brief, credible approach to the job",
    "- Ends with a clear, low-friction call to action",
    "- Avoids generic filler phrases like \"I am excited to apply\" or \"I am the perfect fit\"",
    "",
    "Return only the proposal text, no preamble or headers.",
  ].join("\n");
}

function buildReviewPrompt({ jobDescription, profile, draft }) {
  return [
    "You are reviewing a draft Upwork proposal (cover letter) before it's submitted.",
    "",
    "JOB POSTING:",
    jobDescription || "(not captured)",
    "",
    "FREELANCER PROFILE / BACKGROUND:",
    profile || "(none provided)",
    "",
    "DRAFT PROPOSAL:",
    draft,
    "",
    "Give feedback in this exact format:",
    "",
    "SCORE: <1-10, how likely this proposal is to get a reply>",
    "",
    "ISSUES:",
    "- <specific issue, if any — e.g. generic opening, no evidence of reading the job post, too long, missing call to action>",
    "",
    "REVISED VERSION:",
    "<a tightened, improved rewrite of the proposal, same length ballpark, ready to paste in>",
  ].join("\n");
}

async function callClaude({ prompt, apiKey, model }) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  const textBlock = (data.content || []).find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error("No text returned by the model.");
  }
  return textBlock.text.trim();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return undefined;

  if (message.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    return undefined;
  }

  if (message.type === "GENERATE_PROPOSAL" || message.type === "REVIEW_PROPOSAL") {
    (async () => {
      try {
        const settings = await getSettings();
        if (!settings.apiKey) {
          sendResponse({
            ok: false,
            error: "No Anthropic API key set. Open the extension options to add one.",
          });
          return;
        }

        const prompt =
          message.type === "GENERATE_PROPOSAL"
            ? buildGeneratePrompt({
                jobDescription: message.jobDescription,
                profile: settings.profile,
                tone: settings.tone,
                existingDraft: message.existingDraft,
              })
            : buildReviewPrompt({
                jobDescription: message.jobDescription,
                profile: settings.profile,
                draft: message.existingDraft,
              });

        const text = await callClaude({
          prompt,
          apiKey: settings.apiKey,
          model: settings.model,
        });

        sendResponse({ ok: true, text, mode: message.type });
      } catch (err) {
        sendResponse({ ok: false, error: err.message || String(err) });
      }
    })();
    return true; // keep the message channel open for async sendResponse
  }

  return undefined;
});
