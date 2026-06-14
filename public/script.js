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
      // Don't auto-close if clicking inside a form (e.g. subscribe popup) or the
      // newsletter success toast (let its own timer / close logic run).
      if (event.target.closest("form")) return;
      if (event.target.closest("[data-js-newsletter-toast]")) return;
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
  // Double opt-in: a submit only *stages* the address and emails a confirm link;
  // the list isn't joined until that link is clicked. We deliberately keep NO client
  // state. After a submit the form swaps for a short, auto-dismissing toast ("go
  // confirm via email") with a draining timer bar, then reverts to the input. This
  // avoids the cross-device dead end of a persisted "pending" flag (you might confirm
  // on a different device) and never leaves the form fixated — reopening always offers
  // the input. Abuse is bounded server-side (per-IP rate limit + the idempotent
  // "already on the list" check, which sends no second email).
  const TOAST_MS = 6000; // how long the success message stays before reverting
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)");

  const fillEmail = (tmpl, email) => tmpl.replace("{email}", email || "");

  document
    .querySelectorAll("[data-js-newsletter-submit]")
    .forEach((form) => {
      const section = form.closest("[data-js-newsletter-form]");
      const emailInput = form.querySelector("[data-js-newsletter-email]");
      const btn = form.querySelector("[data-js-newsletter-btn]");
      const status = section.querySelector("[data-js-newsletter-status]");
      const toast = section.querySelector("[data-js-newsletter-toast]");
      const toastText = toast && toast.querySelector("[data-js-toast-text]");
      const toastHint = toast && toast.querySelector("[data-js-toast-hint]");
      // Non-null only for the header pop-up (it lives in a dropdown panel). The
      // standalone page form has no panel, so "close at the end" no-ops there.
      const panel = section.closest("[data-js-dropdown-panel]");
      const originalBtnText = btn.textContent;

      // Cloudflare Turnstile widget for THIS form, if rendered. Reset issues a fresh,
      // single-use token for the next submit.
      const turnstileWidget = form.querySelector(".cf-turnstile");
      const resetTurnstile = () => {
        if (window.turnstile && turnstileWidget) {
          try {
            window.turnstile.reset(turnstileWidget);
          } catch {}
        }
      };

      // Cancel any running timer and hide the toast. Idempotent.
      const clearToast = () => {
        if (section._nlTimer) {
          clearTimeout(section._nlTimer);
          section._nlTimer = null;
        }
        if (toast) {
          toast.hidden = true;
          toast.classList.remove("is-running");
        }
      };

      // Return the form to a fresh, usable state. closeDropdown closes the header
      // pop-up (the end-of-timer behavior); the page form reverts in place and
      // re-focuses the input if focus was still inside the toast.
      const revert = ({ closeDropdown }) => {
        clearToast();
        emailInput.value = "";
        emailInput.disabled = false;
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
        btn.style.minWidth = "";
        btn.textContent = originalBtnText;
        status.textContent = "";
        status.classList.remove("is-error");
        resetTurnstile();
        // The form carries `d-flex` (display:flex !important), so it's hidden by
        // toggling `d-none` (also !important, defined later → wins), not [hidden].
        form.classList.remove("d-none");
        if (closeDropdown && panel) {
          panel.classList.remove("-show");
        } else if (toast && toast.contains(document.activeElement)) {
          emailInput.focus({ preventScroll: true });
        }
      };

      // Swap the form for the toast, run the decorative timer bar, and schedule the
      // revert. setTimeout is the source of truth; the CSS bar is fed the same
      // duration via --toast-ms so the two can't drift.
      const showToast = (text, hint) => {
        if (!toast) {
          // No toast element (shouldn't happen) — degrade to an inline message.
          form.classList.add("d-none");
          status.textContent = hint ? text + " " + hint : text;
          return;
        }
        clearToast(); // guard against a re-submit stacking timers
        toastText.textContent = text;
        toastHint.textContent = hint || ""; // empty for "already"; :empty hides it
        form.classList.add("d-none"); // see revert(): d-none beats the form's d-flex
        toast.hidden = false;
        toast.style.setProperty("--toast-ms", TOAST_MS + "ms");
        if (!REDUCED.matches) {
          toast.classList.remove("is-running");
          void toast.offsetWidth; // reflow so the keyframe restarts cleanly
          toast.classList.add("is-running");
        }
        toast.focus({ preventScroll: true });
        section._nlTimer = setTimeout(() => revert({ closeDropdown: true }), TOAST_MS);
      };

      // For the pop-up, mirror the dropdown's own close triggers (outside-click and
      // capture-phase Escape) so dismissing it mid-toast cancels the timer and resets
      // state — no orphaned timer, and the next open shows a clean input.
      if (panel) {
        window.addEventListener(
          "keydown",
          (event) => {
            if (event.key === "Escape" && toast && !toast.hidden) {
              revert({ closeDropdown: false });
            }
          },
          true,
        );
        window.addEventListener("click", (event) => {
          if (!toast || toast.hidden) return;
          const insideThis =
            event.target.closest("[data-js-dropdown-panel]") === panel ||
            event.target.closest("[data-js-dropdown-trigger]");
          if (!insideThis) revert({ closeDropdown: false });
        });
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = emailInput.value.trim();
        if (!email) return;

        // Copy comes from site.config via data-* attributes (single source of truth).
        const msgPending = section.dataset.msgPending || "";
        const msgHint = section.dataset.msgHint || "";
        const msgAlready = section.dataset.msgAlready || msgPending;
        const msgError = section.dataset.msgError || "";
        const msgRateLimit = section.dataset.msgRatelimit || msgError;

        const tokenInput = form.querySelector('[name="cf-turnstile-response"]');
        const turnstileToken = tokenInput ? tokenInput.value : "";

        // Submitting state: lock the button width so it can't jump, keep a real label
        // (not a bare "..."), and mark it busy for assistive tech.
        const submittingLabel = btn.dataset.labelSubmitting || originalBtnText;
        btn.style.minWidth = btn.offsetWidth + "px";
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
        btn.textContent = submittingLabel;
        emailInput.disabled = true;
        status.textContent = "";
        status.classList.remove("is-error");

        // Re-enable the form and show an inline error (the form stays put so the user
        // can act/retry); reset Turnstile so a fresh token is issued. Errors never use
        // the auto-dismissing toast — only the two success outcomes do.
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

          // Success: show the auto-dismissing toast in place. "already" means they were
          // already on the list (no email sent) — so no spam-folder hint is shown.
          if (data.status === "already") {
            showToast(msgAlready, "");
          } else {
            showToast(fillEmail(msgPending, email), msgHint);
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
