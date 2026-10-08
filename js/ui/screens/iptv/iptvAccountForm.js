// "TV login" form: server, username, masked password (+ show/hide), save.
// Plain native inputs (webOS/Tizen open their own on-screen keyboard on OK).
// The password lives only in its input element; it is never logged, routed or
// echoed in messages, and inputs are never cleared by an error.

function field(id, label, type, placeholder) {
  return `
    <label class="iptv-form-label" for="${id}">${label}</label>
    <input id="${id}" class="iptv-form-input" type="${type}" autocomplete="off"
           autocapitalize="off" spellcheck="false" placeholder="${placeholder}" data-iptv-form="1" />`;
}

function escapeAttr(value) {
  return String(value ?? "").replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[c]);
}

// English fallbacks keep the form working until the screen passes the i18n labels.
const adultLabel = (labels, on) => `${labels.showAdult || "Show adult content"}: ${on ? labels.on || "On" : labels.off || "Off"}`;

export function renderAccountFormMarkup(labels) {
  return `
    <section class="iptv-form" aria-labelledby="iptvFormTitle">
      <h1 class="iptv-form-title" id="iptvFormTitle">${escapeAttr(labels.title)}</h1>
      <p class="iptv-form-hint">${escapeAttr(labels.hint)}</p>
      ${field("iptvServer", escapeAttr(labels.server), "text", "http://example.com:8080")}
      ${field("iptvUsername", escapeAttr(labels.username), "text", "")}
      ${field("iptvPassword", escapeAttr(labels.password), "password", "")}
      <button type="button" class="iptv-btn" data-iptv-form="1" data-action="togglePassword" aria-pressed="false">${escapeAttr(labels.show)}</button>
      <button type="button" class="iptv-btn" data-iptv-form="1" data-action="toggleAdult" aria-pressed="false">${escapeAttr(adultLabel(labels, false))}</button>
      <div class="iptv-form-error" role="alert" aria-live="polite"></div>
      <div class="iptv-form-actions">
        <button type="button" class="iptv-btn iptv-btn-primary" data-iptv-form="1" data-action="saveAccount">${escapeAttr(labels.save)}</button>
        ${labels.cancel ? `<button type="button" class="iptv-btn" data-iptv-form="1" data-action="cancelAccount">${escapeAttr(labels.cancel)}</button>` : ""}
      </div>
    </section>`;
}

// Controller over the rendered markup: vertical focus order + state helpers.
export function createAccountForm(root, labels) {
  const nodes = Array.from(root.querySelectorAll("[data-iptv-form]"));
  const [server, username, password, toggle, adultToggle] = nodes;
  const errorNode = root.querySelector(".iptv-form-error");
  let focusIndex = 0;
  let busy = false;
  let showAdult = false;
  const paintAdult = () => {
    adultToggle.textContent = adultLabel(labels, showAdult);
    adultToggle.setAttribute("aria-pressed", String(showAdult));
  };

  const paint = () => nodes.forEach((node, i) => node.classList.toggle("focused", i === focusIndex));

  return {
    nodes,
    setValues(values = {}) {
      server.value = values.server || "";
      username.value = values.username || "";
      password.value = values.password || "";
      showAdult = values.showAdult === true;
      paintAdult();
    },
    getValues: () => ({ server: server.value, username: username.value, password: password.value, showAdult }),
    toggleAdult() {
      showAdult = !showAdult;
      paintAdult();
    },
    focus(index = focusIndex) {
      focusIndex = Math.max(0, Math.min(nodes.length - 1, index));
      paint();
      try {
        nodes[focusIndex].focus({ preventScroll: true });
      } catch (_) {
        nodes[focusIndex].focus();
      }
    },
    move(delta) {
      const next = Math.max(0, Math.min(nodes.length - 1, focusIndex + delta));
      if (next !== focusIndex) this.focus(next);
    },
    setFocusIndexFromNode(node) {
      const i = nodes.indexOf(node);
      if (i >= 0) focusIndex = i;
      paint();
    },
    current: () => nodes[focusIndex],
    isTextInput: (node) => node === server || node === username || node === password,
    togglePasswordVisibility() {
      const visible = password.type === "password";
      password.type = visible ? "text" : "password";
      toggle.textContent = visible ? labels.hide : labels.show;
      toggle.setAttribute("aria-pressed", String(visible));
    },
    setError(message) {
      errorNode.textContent = message || "";
    },
    // Double submit guard lives in the screen; busy only mirrors it in the UI.
    setBusy(value, savingLabel) {
      busy = Boolean(value);
      const save = nodes.find((node) => node.dataset.action === "saveAccount");
      save.disabled = busy;
      save.textContent = busy ? savingLabel : labels.save;
    },
    isBusy: () => busy
  };
}
