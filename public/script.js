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
  const SUBSCRIBED_KEY = "newsletter-subscribed";

  // Hide forms marked with hideWhenSubscribed if already subscribed
  if (localStorage.getItem(SUBSCRIBED_KEY)) {
    document
      .querySelectorAll('[data-js-hide-when-subscribed="true"]')
      .forEach((section) => {
        section.hidden = true;
        // Show the "subscribed" fallback if present (subscribe popup)
        const doneEl = section.parentElement?.querySelector(
          "[data-js-subscribe-done]"
        );
        if (doneEl) doneEl.style.display = "";
      });
  }

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

        // Submitting state
        btn.disabled = true;
        btn.textContent = "\u2026";
        emailInput.disabled = true;
        status.textContent = "";
        status.classList.remove("is-error");

        // Re-enable the form and show a message, resetting Turnstile so a fresh,
        // single-use token is issued for the retry.
        const fail = (message) => {
          btn.disabled = false;
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

          // Success (pending confirmation, or already subscribed) \u2014 stop nagging.
          try {
            localStorage.setItem(SUBSCRIBED_KEY, "true");
          } catch {}
          form.style.display = "none";
          status.textContent = data.status === "already" ? msgAlready : msgPending;
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
