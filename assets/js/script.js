"use strict";

(() => {
  const config = window.DREAM4ACT_CONFIG || {};
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Accept relative assets and HTTP(S) URLs; do not turn config into executable HTML.
  function safeUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    const candidate = value.trim();
    if (/^(?:https?:\/\/|[^\s:?#]+(?:[?#].*)?$)/i.test(candidate) && !candidate.startsWith("//")) return candidate;
    return "";
  }

  document.querySelectorAll("[data-resource]").forEach((original) => {
    const kind = original.dataset.resource;
    const href = safeUrl(config.links?.[kind]);
    if (!href) return;
    let link = original;
    if (original.tagName !== "A") {
      link = document.createElement("a");
      link.className = original.className;
      link.dataset.resource = kind;
      while (original.firstChild) link.append(original.firstChild);
      original.replaceWith(link);
    }
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.classList.remove("unavailable");
    const label = link.querySelector("[data-resource-label]");
    const note = link.querySelector("[data-resource-note]");
    if (label) label.textContent = { paper: "Paper", arxiv: "arXiv" }[kind];
    if (note) note.textContent = { paper: "Read the full paper", arxiv: "View the preprint" }[kind];
  });

  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#main-nav");
  function closeMenu() {
    menuButton.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
  }
  menuButton.addEventListener("click", () => {
    const expanded = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(expanded));
    nav.classList.toggle("is-open", expanded);
  });
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
      closeMenu();
      menuButton.focus();
    }
  });

  document.querySelectorAll("[data-tabs]").forEach((group) => {
    const tabs = [...group.querySelectorAll('[role="tab"]')];
    function select(tab) {
      tabs.forEach((item) => {
        const active = item === tab;
        item.setAttribute("aria-selected", String(active));
        item.tabIndex = active ? 0 : -1;
        document.getElementById(item.getAttribute("aria-controls")).hidden = !active;
      });
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => select(tab));
      tab.addEventListener("keydown", (event) => {
        let target;
        if (event.key === "ArrowRight") target = (index + 1) % tabs.length;
        if (event.key === "ArrowLeft") target = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "Home") target = 0;
        if (event.key === "End") target = tabs.length - 1;
        if (target === undefined) return;
        event.preventDefault();
        select(tabs[target]);
        tabs[target].focus();
      });
    });
  });

  function showPlaceholder(slot, title, status = "Video coming soon") {
    const placeholder = document.createElement("div");
    placeholder.className = "video-placeholder";
    const icon = document.createElement("span");
    icon.className = "film-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "▤";
    const heading = document.createElement("p");
    heading.textContent = title;
    const description = document.createElement("span");
    description.textContent = status;
    placeholder.append(icon, heading, description);
    slot.replaceChildren(placeholder);
  }

  function setVideo(slot, value, title, options = {}) {
    const current = slot.querySelector("video");
    if (current) current.pause();
    const src = safeUrl(value);
    if (!src) {
      showPlaceholder(slot, title);
      return;
    }
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = options.preload || "metadata";
    const poster = safeUrl(options.poster);
    if (poster) video.poster = poster;
    video.setAttribute("aria-label", title);
    video.src = src;
    video.addEventListener("error", () => showPlaceholder(slot, title, "Video unavailable. Please try again later."), { once: true });
    slot.replaceChildren(video);
  }

  const overviewYouTubeId = config.videos?.overviewYouTubeId;
  if (typeof overviewYouTubeId === "string" && /^[A-Za-z0-9_-]{11}$/.test(overviewYouTubeId)) {
    const frame = document.querySelector("#overview-media iframe");
    const src = `https://www.youtube.com/embed/${overviewYouTubeId}`;
    if (frame && frame.getAttribute("src") !== src) frame.src = src;
  }

  function enableMouseDrag(strip) {
    let gesture = null;
    let suppressClick = false;

    function endDrag() {
      if (!gesture) return;
      const { pointerId, dragging } = gesture;
      gesture = null;
      suppressClick = dragging;
      strip.classList.remove("is-dragging");
      if (strip.hasPointerCapture(pointerId)) strip.releasePointerCapture(pointerId);
    }

    strip.addEventListener("pointerdown", (event) => {
      suppressClick = false;
      if (event.pointerType !== "mouse" || event.button !== 0 || strip.scrollWidth <= strip.clientWidth + 2) return;
      if (event.target.closest("a, button, input, select, textarea, [contenteditable]")) return;
      const video = event.target.closest("video");
      // Native video controls live in a closed shadow tree. Reserve their bottom
      // control bar, and leave ordinary clicks untouched until a drag is detected.
      if (video && event.clientY >= video.getBoundingClientRect().bottom - 64) return;
      const bounds = strip.getBoundingClientRect();
      if (event.clientY >= bounds.top + strip.clientHeight) return; // Native scrollbar.
      gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: strip.scrollLeft, dragging: false };
    });

    window.addEventListener("pointermove", (event) => {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      if (!(event.buttons & 1)) { endDrag(); return; }
      const distance = event.clientX - gesture.x;
      if (!gesture.dragging) {
        if (Math.abs(distance) < 8 || Math.abs(distance) < Math.abs(event.clientY - gesture.y)) return;
        gesture.dragging = true;
        strip.classList.add("is-dragging");
        strip.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      strip.scrollLeft = gesture.left - distance;
    }, { passive: false });

    for (const type of ["pointerup", "pointercancel"]) {
      window.addEventListener(type, (event) => {
        if (gesture?.pointerId === event.pointerId) endDrag();
      });
    }
    strip.addEventListener("lostpointercapture", endDrag);
    window.addEventListener("blur", endDrag);
    strip.addEventListener("dragstart", (event) => event.preventDefault());
    strip.addEventListener("click", (event) => {
      if (!suppressClick || event.detail === 0) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }, true);
  }

  // Curated clips: no requirement to supply a video for every robot or task.
  function mountGallery(prefix, entries) {
    const strip = document.getElementById(`${prefix}-strip`);
    const gallery = strip.closest(".demo-gallery");
    const previousDemo = document.getElementById(`${prefix}-prev`);
    const nextDemo = document.getElementById(`${prefix}-next`);
    const configuredDemos = Array.isArray(entries) ? entries : [];
    const demos = configuredDemos.filter((demo) => demo && safeUrl(demo.src));
    if (demos.length) {
      const cards = demos.map((demo, index) => {
        const title = typeof demo.title === "string" && demo.title.trim() ? demo.title.trim() : "Real-world demonstration";
        const robot = typeof demo.robot === "string" ? demo.robot.trim() : "";
        const card = document.createElement("li");
        card.className = "demo-card";
        if (Number.isFinite(demo.width) && demo.width > 0 && Number.isFinite(demo.height) && demo.height > 0) {
          card.style.setProperty("--video-aspect", demo.width / demo.height);
        }
        const slot = document.createElement("div");
        slot.className = "video-slot";
        setVideo(slot, demo.src, robot ? `${title} · ${robot}` : title, { poster: demo.poster });
        const caption = document.createElement("div");
        caption.className = "demo-caption";
        const number = document.createElement("span");
        number.className = "demo-number";
        number.textContent = String(index + 1).padStart(2, "0");
        const heading = document.createElement("h3");
        heading.textContent = title;
        caption.append(number, heading);
        if (robot || demo.setting) {
          const platform = document.createElement("p");
          platform.className = "demo-platform";
          platform.textContent = [robot, demo.setting].filter(Boolean).join(" · ");
          caption.append(platform);
        }
        if (typeof demo.playback === "string" && demo.playback.trim()) {
          const speed = document.createElement("span");
          speed.className = "demo-playback";
          speed.textContent = demo.playback;
          speed.title = demo.playbackDescription || "Playback speed relative to the provided video";
          speed.setAttribute("aria-label", `${demo.playback} playback speed`);
          caption.append(speed);
        }
        if (typeof demo.note === "string" && demo.note) {
          const note = document.createElement("p");
          note.className = "demo-note";
          note.textContent = demo.note;
          caption.append(note);
        }
        card.append(slot, caption);
        return card;
      });
      strip.replaceChildren(...cards);
    }

    function updateGalleryControls() {
      const max = Math.max(0, strip.scrollWidth - strip.clientWidth);
      strip.classList.toggle("is-draggable", max > 2);
      previousDemo.disabled = strip.scrollLeft <= 2;
      nextDemo.disabled = strip.scrollLeft >= max - 2;
      gallery.querySelector(".gallery-controls").hidden = max <= 2;
    }
    function scrollDemos(direction) {
      const left = strip.scrollLeft;
      const origin = strip.getBoundingClientRect().left;
      const max = Math.max(0, strip.scrollWidth - strip.clientWidth);
      const positions = [...strip.querySelectorAll(".demo-card")].map((card) =>
        Math.min(max, card.getBoundingClientRect().left - origin + left));
      const target = direction > 0
        ? positions.find((position) => position > left + 2) ?? max
        : positions.reverse().find((position) => position < left - 2) ?? 0;
      strip.scrollTo({ left: target, behavior: reduceMotion.matches ? "instant" : "smooth" });
    }
    previousDemo.addEventListener("click", () => scrollDemos(-1));
    nextDemo.addEventListener("click", () => scrollDemos(1));
    enableMouseDrag(strip);
    strip.addEventListener("scroll", updateGalleryControls, { passive: true });
    strip.addEventListener("keydown", (event) => {
      // Leave video controls' own seeking and volume shortcuts intact.
      if (event.target !== strip) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        scrollDemos(event.key === "ArrowRight" ? 1 : -1);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        strip.scrollTo({ left: event.key === "Home" ? 0 : strip.scrollWidth, behavior: reduceMotion.matches ? "instant" : "smooth" });
      }
    });
    new ResizeObserver(updateGalleryControls).observe(strip);
    updateGalleryControls();
  }
  mountGallery("demo", config.videos?.experiments);
  mountGallery("sim", config.videos?.simulation);

  document.querySelector("main").addEventListener("play", (event) => {
    document.querySelectorAll("main video").forEach((video) => { if (video !== event.target) video.pause(); });
  }, true);

  const heroVideo = document.getElementById("hero-video");
  const heroSrc = safeUrl(config.videos?.hero);
  if (heroSrc) {
    heroVideo.src = heroSrc;
    const poster = safeUrl(config.videos?.heroPoster);
    if (poster) heroVideo.poster = poster;
    heroVideo.hidden = false;
    heroVideo.addEventListener("error", () => { heroVideo.hidden = true; });
    if (!reduceMotion.matches) heroVideo.play().catch(() => {});
    reduceMotion.addEventListener("change", () => { if (reduceMotion.matches) heroVideo.pause(); });
  }

  const dialog = document.getElementById("figure-dialog");
  const expandedImage = document.getElementById("expanded-figure");
  document.querySelectorAll("[data-zoom]").forEach((button) => button.addEventListener("click", () => {
    expandedImage.src = button.dataset.zoom;
    expandedImage.alt = button.querySelector("img").alt;
    dialog.showModal();
  }));
  document.getElementById("close-figure").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

  const bibtex = document.getElementById("bibtex");
  if (typeof config.bibtex === "string" && config.bibtex.trim()) bibtex.textContent = config.bibtex.trim();
  document.getElementById("copy-citation").addEventListener("click", async () => {
    const status = document.getElementById("copy-status");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(bibtex.textContent);
      status.textContent = "BibTeX copied.";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(bibtex);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = "Citation selected. Press Ctrl+C (or ⌘C on Mac) to copy.";
    }
  });
})();
