// Mobile feature carousel: scrollable tabs + horizontally scrolling cards that auto-advance.
// On wider screens the cards stay a normal grid and this script does nothing visible.
(function () {
  const tabs = document.querySelector('.feature-tabs');
  const track = document.getElementById('feature-cards');
  if (!tabs || !track) return;

  const cards = Array.from(track.children);
  const mobile = window.matchMedia('(max-width: 720px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const INTERVAL = 3500;      // time on each card
  const RESUME_AFTER = 6000;  // idle time after a touch before auto-scroll resumes

  let active = -1;
  let timer = null;
  let resumeTimer = null;
  let paused = false;
  let inView = false;
  let lockTarget = null;     // while set, the script is scrolling to this position: don't sync tabs
  let lockTimer = null;

  // Build one tab per card, labelled with the card's heading.
  const buttons = cards.map((card, i) => {
    card.id = card.id || 'feature-' + i;
    card.setAttribute('role', 'tabpanel');
    const label = card.dataset.tab || card.querySelector('h3').textContent;
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', card.id);
    b.textContent = label;
    b.addEventListener('click', () => { userInteracted(); goTo(i); });
    tabs.appendChild(b);
    return b;
  });
  tabs.hidden = false;

  function step() {
    return cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth;
  }

  function goTo(i, smooth = true) {
    const left = cards[i].offsetLeft - cards[0].offsetLeft;
    lockTarget = left;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => { lockTarget = null; }, 2000); // safety net
    track.scrollTo({ left, behavior: smooth && !reducedMotion.matches ? 'smooth' : 'auto' });
    setActive(i);
  }

  function setActive(i) {
    if (i === active) return;
    active = i;
    buttons.forEach((b, n) => {
      const on = n === i;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    // Keep the active tab centred in the tab bar without scrolling the page.
    const b = buttons[i];
    tabs.scrollTo({
      left: b.offsetLeft - tabs.offsetLeft - (tabs.clientWidth - b.offsetWidth) / 2,
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
    });
    restartProgress();
  }

  // Sync the tabs while the user swipes the cards.
  let ticking = false;
  track.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (!mobile.matches) return;
      const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
      if (lockTarget !== null) {
        if (Math.abs(track.scrollLeft - lockTarget) > 2 && !atEnd) return;
        lockTarget = null; // arrived
      }
      const i = atEnd ? cards.length - 1 : Math.round(track.scrollLeft / step());
      setActive(Math.max(0, Math.min(cards.length - 1, i)));
    });
  }, { passive: true });

  // Arrow keys move between tabs.
  tabs.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    userInteracted();
    const next = (active + (e.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length;
    goTo(next);
    buttons[next].focus();
  });

  // Pause auto-scroll while the user is touching or dragging; resume after a quiet period.
  function userInteracted() {
    lockTarget = null;
    paused = true;
    tabs.classList.add('paused');
    clearTimeout(resumeTimer);
    restartProgress();
    resumeTimer = setTimeout(() => { paused = false; tabs.classList.remove('paused'); restartProgress(); }, RESUME_AFTER);
  }
  ['pointerdown', 'touchstart', 'wheel'].forEach((type) => {
    track.addEventListener(type, userInteracted, { passive: true });
    tabs.addEventListener(type, userInteracted, { passive: true });
  });

  function canAutoScroll() {
    return mobile.matches && !reducedMotion.matches && inView && !paused && !document.hidden;
  }

  // One timer per card drives both the auto-advance and the progress bar on the active tab.
  function restartProgress() {
    clearTimeout(timer);
    buttons.forEach((b) => b.classList.remove('run'));
    tabs.classList.toggle('auto', mobile.matches && !reducedMotion.matches);
    if (!canAutoScroll() || active < 0) return;
    void buttons[active].offsetWidth; // restart the CSS animation
    buttons[active].classList.add('run');
    timer = setTimeout(() => goTo((active + 1) % cards.length), INTERVAL);
  }

  // Only run while the section is on screen.
  new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
    restartProgress();
  }, { threshold: 0.4 }).observe(track);

  document.addEventListener('visibilitychange', restartProgress);
  mobile.addEventListener('change', () => { if (mobile.matches) goTo(Math.max(active, 0), false); restartProgress(); });
  reducedMotion.addEventListener('change', restartProgress);

  setActive(0);
})();
