// ===== Mobile Navigation =====
(function () {
  const toggleNavContainer = document.querySelector(
    "[data-js-toggle-nav-container]"
  );
  const navButton = document.querySelector("[data-js-nav-button]");
  const navInput = document.querySelector("[data-js-nav-input]");
  const menuCollapsed = document.querySelector("[data-js-menu-collapsed]");
  const menuExpanded = document.querySelector("[data-js-menu-expanded]");
  const line = document.querySelector("[data-js-line]");
  const contact = document.querySelector("[data-js-contact]");

  if (!navButton || !navInput) return;

  const toggleNav = () => {
    const isChecked = navInput.checked;
    navButton.classList.toggle("btn-invisible", !isChecked);
    navButton.classList.toggle("btn-secondary", isChecked);
    if (menuCollapsed) {
      menuCollapsed.classList.toggle("d-flex", !isChecked);
      menuCollapsed.classList.toggle("d-none", isChecked);
    }
    if (menuExpanded) {
      menuExpanded.classList.toggle("d-none", !isChecked);
      menuExpanded.classList.toggle("d-flex", isChecked);
    }
    if (line) {
      line.classList.toggle("d-none", isChecked);
      line.classList.toggle("d-block", !isChecked);
    }
    if (contact) {
      contact.classList.toggle("d-none", isChecked);
      contact.classList.toggle("d-block", !isChecked);
    }
  };

  const handleResize = () => {
    if (window.innerWidth > 544) {
      navInput.checked = false;
      toggleNav();
    }
  };

  navButton.addEventListener("click", () => {
    navInput.checked = !navInput.checked;
    toggleNav();
  });

  document.addEventListener("click", (event) => {
    if (!toggleNavContainer.contains(event.target)) {
      navInput.checked = false;
      toggleNav();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      navInput.checked = false;
      toggleNav();
    }
  });

  window.addEventListener("resize", handleResize);
  handleResize();
})();

// ===== Dropdown =====
(function () {
  const dropdownTriggers = document.querySelectorAll(
    "[data-js-dropdown-trigger]"
  );
  const dropdownPanels = document.querySelectorAll("[data-js-dropdown-panel]");

  function closeOpenDropdowns() {
    dropdownPanels.forEach((menu) => {
      menu.classList.remove("-show");
    });
  }

  function sizeSubscribePanel(panel) {
    const header = document.querySelector("header");
    if (!header) return;
    const headerLeft = header.getBoundingClientRect().left;
    const panelRight = panel.getBoundingClientRect().right;
    panel.style.maxWidth = panelRight - headerLeft + "px";
  }

  window.addEventListener("resize", () => {
    const openPanel = document.querySelector(
      ".subscribe-panel.-show"
    );
    if (openPanel) sizeSubscribePanel(openPanel);
  });

  dropdownTriggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      const panel = trigger.nextElementSibling;
      const shouldOpen = !panel.classList.contains("-show");
      event.preventDefault();

      closeOpenDropdowns();
      if (shouldOpen) {
        panel.classList.add("-show");
        // Size subscribe panel to span from icon to content left edge
        if (panel.classList.contains("subscribe-panel")) {
          sizeSubscribePanel(panel);
        }
        // Hide tooltips
        document
          .querySelectorAll("[data-js-tooltip-text]")
          .forEach((tooltip) => {
            tooltip.setAttribute("data-visible", "false");
          });
      }
    });
  });

  dropdownPanels.forEach((panel) => {
    panel.addEventListener("click", (event) => {
      // Don't auto-close if clicking inside a form (e.g. subscribe popup)
      if (event.target.closest("form")) return;
      closeOpenDropdowns();
    });
  });

  window.addEventListener("click", (event) => {
    if (
      !event.target.closest("[data-js-dropdown-trigger]") &&
      !event.target.closest("[data-js-dropdown-panel]")
    ) {
      closeOpenDropdowns();
    }
  });

  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closeOpenDropdowns();
      }
    },
    true
  );
})();

// ===== Newsletter Form =====
(function () {
  // Double opt-in has two real states, so we track two flags instead of one:
  //   newsletter-pending   = the email we sent a confirm link to (set on submit)
  //   newsletter-confirmed = "true" once the user actually confirmed on the
  //                          /vestkopa/confirmed page, or was already on the list.
  // confirmed wins over pending, keeping the UI honest: "check your email" until
  // confirmed, "you're subscribed" only after. (confirmed.astro also sets these.)
  const PENDING_KEY = "newsletter-pending";
  const CONFIRMED_KEY = "newsletter-confirmed";

  const getFlag = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const setFlag = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  };
  const clearFlag = (k) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  };

  // Migrate the old single "newsletter-subscribed" flag so visitors who subscribed
  // under the previous version aren't re-prompted.
  if (getFlag("newsletter-subscribed") && !getFlag(CONFIRMED_KEY)) {
    setFlag(CONFIRMED_KEY, "true");
    clearFlag("newsletter-subscribed");
  }

  const fillEmail = (tmpl, email) => tmpl.replace("{email}", email || "");

  // Settle a [data-js-hide-when-subscribed] form into its sibling done panel: hide
  // the form, then reveal the confirmed panel (wins) or the pending panel (filled
  // with the stored email). Standalone forms have no panels — they just get hidden.
  // Returns true when a panel was actually shown.
  const applyState = (section) => {
    const confirmed = getFlag(CONFIRMED_KEY);
    const pendingEmail = getFlag(PENDING_KEY);
    if (!confirmed && !pendingEmail) return false;

    const wrap = section.parentElement;
    const doneEl = wrap && wrap.querySelector("[data-js-subscribe-done]");
    const pendingEl = wrap && wrap.querySelector("[data-js-subscribe-pending]");

    section.hidden = true;
    if (confirmed) {
      if (pendingEl) pendingEl.style.display = "none";
      if (doneEl) doneEl.style.display = "";
    } else if (pendingEl) {
      if (doneEl) doneEl.style.display = "none";
      const textEl = pendingEl.querySelector("[data-js-pending-text]");
      if (textEl)
        textEl.textContent = fillEmail(section.dataset.msgPending || "", pendingEmail);
      pendingEl.style.display = "";
    }
    return Boolean(doneEl || pendingEl);
  };

  // On load, settle every "hide when subscribed" form into its panel / hidden state.
  document
    .querySelectorAll('[data-js-hide-when-subscribed="true"]')
    .forEach((section) => applyState(section));

  document
    .querySelectorAll("[data-js-newsletter-submit]")
    .forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const section = form.closest("[data-js-newsletter-form]");
        const emailInput = form.querySelector("[data-js-newsletter-email]");
        const btn = form.querySelector("[data-js-newsletter-btn]");
        const status = section.querySelector("[data-js-newsletter-status]");
        const email = emailInput.value.trim();

        if (!email) return;

        // Copy comes from site.config via data-* attributes (single source of truth).
        const msgPending = section.dataset.msgPending || "";
        const msgAlready = section.dataset.msgAlready || msgPending;
        const msgError = section.dataset.msgError || "";
        const msgRateLimit = section.dataset.msgRatelimit || msgError;
        const originalBtnText = btn.textContent;

        // Cloudflare Turnstile token, if the widget is rendered in this form.
        const turnstileWidget = form.querySelector(".cf-turnstile");
        const tokenInput = form.querySelector('[name="cf-turnstile-response"]');
        const turnstileToken = tokenInput ? tokenInput.value : "";
        const resetTurnstile = () => {
          if (window.turnstile && turnstileWidget) {
            try {
              window.turnstile.reset(turnstileWidget);
            } catch {}
          }
        };

        // Submitting state: lock the button width so it can't jump, keep a real
        // label (not a bare "..."), and mark it busy for assistive tech.
        const submittingLabel = btn.dataset.labelSubmitting || originalBtnText;
        btn.style.minWidth = btn.offsetWidth + "px";
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
        btn.textContent = submittingLabel;
        emailInput.disabled = true;
        status.textContent = "";
        status.classList.remove("is-error");

        // Re-enable the form and show a message, resetting Turnstile so a fresh,
        // single-use token is issued for the retry.
        const fail = (message) => {
          btn.disabled = false;
          btn.removeAttribute("aria-busy");
          btn.style.minWidth = "";
          btn.textContent = originalBtnText;
          emailInput.disabled = false;
          status.textContent = message;
          status.classList.add("is-error");
          resetTurnstile();
        };

        // Double opt-in: this only stages the address + sends a confirm email.
        // The mailing list isn't joined until the user clicks that link.
        try {
          const res = await fetch("/api/newsletter/subscribe", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, turnstileToken }),
          });
          const data = await res.json().catch(() => ({}));

          // 429 = rate limited (just wait and retry); anything else is a generic error.
          if (!res.ok) {
            fail(res.status === 429 ? msgRateLimit : msgError);
            return;
          }

          // Persist the real two-step state: "already" means they confirmed before;
          // a fresh sign-up is only pending until they click the emailed link.
          if (data.status === "already") {
            setFlag(CONFIRMED_KEY, "true");
            clearFlag(PENDING_KEY);
          } else {
            setFlag(PENDING_KEY, email);
          }

          // Show the result in place (no refresh). Forms with a done/pending panel
          // (the header popup) swap to it; standalone forms get an inline message.
          const wrap = section.parentElement;
          const hasPanels =
            wrap &&
            wrap.querySelector("[data-js-subscribe-pending], [data-js-subscribe-done]");
          if (hasPanels) {
            applyState(section);
          } else {
            form.style.display = "none";
            status.textContent =
              data.status === "already" ? msgAlready : fillEmail(msgPending, email);
          }
        } catch {
          fail(msgError); // network / unexpected failure
        }
      });
    });
})();

// ===== Tooltips =====
(function () {
  const tooltipContainers = document.querySelectorAll(
    "[data-js-tooltip-container]"
  );
  const minWidthSm = window.matchMedia("(min-width: 544px)");

  tooltipContainers.forEach((container) => {
    const tooltipText = container.querySelector("[data-js-tooltip-text]");
    if (!tooltipText) return;

    const showTooltip = () => {
      if (!minWidthSm.matches) return;
      document.querySelectorAll(".tooltip").forEach((t) => {
        t.setAttribute("data-visible", "false");
      });
      tooltipText.setAttribute("data-visible", "true");
    };

    const hideTooltip = () => {
      tooltipText.setAttribute("data-visible", "false");
    };

    container.addEventListener("mouseenter", showTooltip);
    container.addEventListener("mouseleave", hideTooltip);

    const focusables = container.querySelectorAll(
      "a, button, input, textarea, select, [tabindex]"
    );
    focusables.forEach((el) => {
      el.addEventListener("focus", showTooltip);
      el.addEventListener("blur", hideTooltip);
    });
  });
})();
