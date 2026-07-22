(() => {
  let jobDescriptionEl = null;
  let proposalEl = null;
  let pickMode = null; // "job" | "proposal" | null
  let pickOverlayEl = null;
  let lastReview = null;

  // ---------- element pick mode (works even if Upwork's DOM changes) ----------

  function highlight(el, on) {
    if (!el) return;
    el.style.outline = on ? "3px solid #148a5a" : "";
    el.style.outlineOffset = on ? "2px" : "";
  }

  function startPickMode(kind) {
    pickMode = kind;
    document.body.style.cursor = "crosshair";
    document.addEventListener("mousemove", onPickMouseMove, true);
    document.addEventListener("click", onPickClick, true);
    setStatus(`Click the ${kind === "job" ? "job description" : "proposal / cover letter box"} on the page…`);
  }

  function stopPickMode() {
    pickMode = null;
    document.body.style.cursor = "";
    document.removeEventListener("mousemove", onPickMouseMove, true);
    document.removeEventListener("click", onPickClick, true);
    if (pickOverlayEl) highlight(pickOverlayEl, false);
    pickOverlayEl = null;
  }

  function onPickMouseMove(e) {
    if (pickOverlayEl) highlight(pickOverlayEl, false);
    pickOverlayEl = e.target;
    highlight(pickOverlayEl, true);
  }

  function onPickClick(e) {
    if (!pickMode) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    if (pickMode === "job") {
      jobDescriptionEl = el;
      setStatus("Job description set.");
    } else if (pickMode === "proposal") {
      proposalEl = el;
      setStatus("Proposal box set.");
    }
    stopPickMode();
    updateButtons();
  }

  // ---------- auto-detect heuristics ----------

  const JOB_DESC_SELECTORS = [
    '[data-test="job-description-text"]',
    '[data-test="Description"]',
    '[data-qa="job-description"]',
    ".job-description",
    "section.description",
  ];

  const PROPOSAL_SELECTORS = [
    'textarea[name="coverLetter"]',
    'textarea[data-test="cover-letter"]',
    'textarea[data-qa="cover-letter"]',
    'textarea[aria-label*="cover letter" i]',
    'textarea[placeholder*="cover letter" i]',
    '[contenteditable="true"][aria-label*="cover letter" i]',
  ];

  function firstVisible(selectors) {
    for (const sel of selectors) {
      const found = document.querySelectorAll(sel);
      for (const el of found) {
        if (el.offsetParent !== null) return el;
      }
    }
    return null;
  }

  function findJobDescriptionByHeading() {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, strong"));
    const heading = headings.find((h) => /job description/i.test(h.textContent || ""));
    if (!heading) return null;
    let node = heading.nextElementSibling;
    while (node) {
      if (node.textContent && node.textContent.trim().length > 40) return node;
      node = node.nextElementSibling;
    }
    return heading.parentElement;
  }

  function autoDetect() {
    if (!jobDescriptionEl || !document.contains(jobDescriptionEl)) {
      jobDescriptionEl = firstVisible(JOB_DESC_SELECTORS) || findJobDescriptionByHeading();
    }
    if (!proposalEl || !document.contains(proposalEl)) {
      proposalEl = firstVisible(PROPOSAL_SELECTORS);
    }
    updateButtons();
  }

  // ---------- reading / writing the proposal box ----------

  function getText(el) {
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value || "";
    return el.innerText || el.textContent || "";
  }

  function setNativeValue(el, value) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      el.focus();
      el.innerText = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // ---------- floating panel UI ----------

  let panel, statusEl, resultEl, generateBtn, reviewBtn, useRevisedBtn;

  function buildPanel() {
    panel = document.createElement("div");
    panel.id = "upa-panel";
    panel.innerHTML = `
      <div id="upa-header">
        <span>Proposal Assistant</span>
        <button id="upa-collapse" title="Collapse">&minus;</button>
      </div>
      <div id="upa-body">
        <div id="upa-targets">
          <button data-action="pick-job" class="upa-btn upa-btn-secondary">Set job description</button>
          <button data-action="pick-proposal" class="upa-btn upa-btn-secondary">Set proposal box</button>
        </div>
        <div id="upa-status">Scanning page…</div>
        <div id="upa-actions">
          <button data-action="generate" class="upa-btn upa-btn-primary" disabled>Generate draft</button>
          <button data-action="review" class="upa-btn upa-btn-primary" disabled>Review draft</button>
        </div>
        <div id="upa-result" hidden></div>
        <button data-action="use-revised" id="upa-use-revised" hidden class="upa-btn upa-btn-primary">Use this version</button>
        <div id="upa-footer">
          <a href="#" data-action="open-options">Settings</a>
        </div>
      </div>
    `;
    document.documentElement.appendChild(panel);

    statusEl = panel.querySelector("#upa-status");
    resultEl = panel.querySelector("#upa-result");
    generateBtn = panel.querySelector('[data-action="generate"]');
    reviewBtn = panel.querySelector('[data-action="review"]');
    useRevisedBtn = panel.querySelector("#upa-use-revised");

    panel.addEventListener("click", onPanelClick);
  }

  function onPanelClick(e) {
    const action = e.target.getAttribute("data-action");
    if (!action) return;
    e.preventDefault();

    if (action === "pick-job") startPickMode("job");
    else if (action === "pick-proposal") startPickMode("proposal");
    else if (action === "generate") handleGenerate();
    else if (action === "review") handleReview();
    else if (action === "use-revised") handleUseRevised();
    else if (action === "open-options") chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
    else if (action === "collapse" || e.target.id === "upa-collapse") {
      panel.classList.toggle("upa-collapsed");
    }
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function updateButtons() {
    const hasJob = !!jobDescriptionEl;
    const hasProposal = !!proposalEl;
    if (generateBtn) generateBtn.disabled = !hasProposal;
    if (reviewBtn) reviewBtn.disabled = !hasProposal;
    if (!pickMode) {
      setStatus(
        `Job description: ${hasJob ? "found" : "not set"} · Proposal box: ${hasProposal ? "found" : "not set"}`
      );
    }
  }

  function showResult(text) {
    resultEl.hidden = false;
    resultEl.textContent = text;
  }

  async function handleGenerate() {
    if (!proposalEl) return;
    setStatus("Generating…");
    generateBtn.disabled = true;
    reviewBtn.disabled = true;
    resultEl.hidden = true;
    useRevisedBtn.hidden = true;

    const jobDescription = getText(jobDescriptionEl);
    const existingDraft = getText(proposalEl);

    chrome.runtime.sendMessage(
      { type: "GENERATE_PROPOSAL", jobDescription, existingDraft },
      (response) => {
        updateButtons();
        if (!response) {
          setStatus("No response from extension background — try reloading the page.");
          return;
        }
        if (!response.ok) {
          setStatus(`Error: ${response.error}`);
          return;
        }
        setNativeValue(proposalEl, response.text);
        setStatus("Draft inserted into the proposal box.");
      }
    );
  }

  async function handleReview() {
    if (!proposalEl) return;
    const existingDraft = getText(proposalEl);
    if (!existingDraft.trim()) {
      setStatus("Proposal box is empty — nothing to review.");
      return;
    }
    setStatus("Reviewing…");
    generateBtn.disabled = true;
    reviewBtn.disabled = true;
    resultEl.hidden = true;
    useRevisedBtn.hidden = true;

    const jobDescription = getText(jobDescriptionEl);

    chrome.runtime.sendMessage(
      { type: "REVIEW_PROPOSAL", jobDescription, existingDraft },
      (response) => {
        updateButtons();
        if (!response) {
          setStatus("No response from extension background — try reloading the page.");
          return;
        }
        if (!response.ok) {
          setStatus(`Error: ${response.error}`);
          return;
        }
        lastReview = response.text;
        showResult(response.text);
        const match = response.text.match(/REVISED VERSION:\s*([\s\S]*)/i);
        if (match) {
          useRevisedBtn.hidden = false;
        }
        setStatus("Review complete.");
      }
    );
  }

  function handleUseRevised() {
    if (!lastReview || !proposalEl) return;
    const match = lastReview.match(/REVISED VERSION:\s*([\s\S]*)/i);
    if (!match) return;
    setNativeValue(proposalEl, match[1].trim());
    setStatus("Revised version inserted.");
    useRevisedBtn.hidden = true;
  }

  // ---------- init ----------

  function init() {
    buildPanel();
    autoDetect();
    const observer = new MutationObserver(() => {
      if (!pickMode) autoDetect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(() => {
      if (!pickMode) autoDetect();
    }, 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
