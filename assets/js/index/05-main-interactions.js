(() => {
  'use strict';

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --------------------------------------------------
     Utility UI: progress, mobile menu, toast
  -------------------------------------------------- */
  const progress = document.createElement('div');
  progress.className = 'scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  progress.innerHTML = '<span></span>';
  document.body.prepend(progress);
  const progressBar = $('span', progress);

  const toastStack = document.createElement('div');
  toastStack.className = 'toast-stack';
  toastStack.setAttribute('aria-live', 'polite');
  document.body.append(toastStack);

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = message;
    toastStack.append(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    window.setTimeout(() => {
      toast.classList.remove('show');
      window.setTimeout(() => toast.remove(), 320);
    }, 2300);
  }

  const header = $('.nav-wrap');
  const desktopNav = $('.nav-wrap nav');
  const menuButton = document.createElement('button');
  menuButton.className = 'mobile-menu-toggle';
  menuButton.type = 'button';
  menuButton.setAttribute('aria-label', 'Mở menu');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.innerHTML = '<span></span>';
  header.append(menuButton);

  const drawer = document.createElement('div');
  drawer.className = 'mobile-drawer';
  drawer.setAttribute('aria-hidden', 'true');
  drawer.innerHTML = `<nav aria-label="Menu mobile">${desktopNav.innerHTML}</nav>`;
  document.body.append(drawer);

  function setMenu(open) {
    drawer.classList.toggle('open', open);
    menuButton.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
    drawer.setAttribute('aria-hidden', String(!open));
  }

  menuButton.addEventListener('click', () => setMenu(!drawer.classList.contains('open')));
  $$('.mobile-drawer a').forEach(link => link.addEventListener('click', () => setMenu(false)));

  /* --------------------------------------------------
     Scroll states + active section
  -------------------------------------------------- */
  const navLinks = $$('.nav-wrap nav a[href^="#"]');
  const sections = navLinks
    .map(link => $(link.getAttribute('href')))
    .filter(Boolean);

  let ticking = false;
  function updateScrollUI() {
    const y = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    progressBar.style.transform = `scaleX(${Math.min(1, y / max)})`;
    header.classList.toggle('is-scrolled', y > 28);
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateScrollUI);
      ticking = true;
    }
  }, { passive: true });
  updateScrollUI();

  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
        });
      });
    }, { rootMargin: '-28% 0px -62% 0px', threshold: 0 });

    sections.forEach(section => sectionObserver.observe(section));
  }

  /* --------------------------------------------------
     Reveal animations
  -------------------------------------------------- */
  const reveals = $$('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('visible'));
  } else {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.11, rootMargin: '0px 0px -4% 0px' });
    reveals.forEach(el => revealObserver.observe(el));
  }

  /* --------------------------------------------------
     Animated hero counters
  -------------------------------------------------- */
  const statValues = $$('.hero-stats b');
  if (!reducedMotion && 'IntersectionObserver' in window) {
    const statObserver = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;

      statValues.forEach(el => {
        const original = el.textContent.trim();
        const number = parseFloat(original.replace(/[^0-9.]/g, ''));
        if (!Number.isFinite(number)) return;
        const isDecimal = original.includes('.');
        const suffix = original.replace(/[0-9.]/g, '');
        const duration = 950;
        const started = performance.now();

        function frame(now) {
          const p = Math.min(1, (now - started) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          const value = number * eased;
          el.textContent = `${isDecimal ? value.toFixed(1) : Math.round(value)}${suffix}`;
          if (p < 1) requestAnimationFrame(frame);
          else el.textContent = original;
        }
        requestAnimationFrame(frame);
      });
      statObserver.disconnect();
    }, { threshold: 0.55 });
    const stats = $('.hero-stats');
    if (stats) statObserver.observe(stats);
  }

  /* --------------------------------------------------
     Photographer filtering
  -------------------------------------------------- */
  const filters = $$('.filter');
  const cards = $$('.photographer-card');

  filters.forEach(button => {
    const value = button.dataset.filter;
    const count = value === 'all' ? cards.length : cards.filter(card => card.dataset.style === value).length;
    const badge = document.createElement('span');
    badge.className = 'filter-count';
    badge.textContent = count;
    button.append(badge);
  });

  let filterTimer;
  let filterGeneration = 0;
  function applyFilter(value) {
    clearTimeout(filterTimer);
    const generation = ++filterGeneration;
    cards.forEach(card => {
      card.getAnimations().forEach(animation => animation.cancel());
      card.classList.remove('is-leaving');
    });
    const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
    const query = normalize($('#photographerSearch').value.trim());
    const matches = card => (value==='all'||card.dataset.style===value) && normalize(card.querySelector('h3').textContent+' '+card.querySelector('.photographer-tags').textContent).includes(query);
    const hide = cards.filter(card => !matches(card));
    const show = cards.filter(matches);
    hide.forEach(card => { if (!card.classList.contains('hidden')) card.classList.add('is-leaving'); });
    filterTimer = setTimeout(() => {
      if (generation !== filterGeneration) return;
      hide.forEach(card => { card.classList.add('hidden'); card.classList.remove('is-leaving'); });
      $('#photographerResult').textContent = `${show.length} hồ sơ phù hợp`;
      const empty=$('.directory-empty'); if(empty) empty.hidden=show.length>0;
      $('.cheese-photographer-grid').scrollTo({left:0,behavior:'auto'});
      show.forEach((card, index) => {
        const wasHidden = card.classList.contains('hidden');
        card.classList.remove('hidden', 'is-leaving');
        card.classList.add('visible');
        if (wasHidden && !reducedMotion) card.animate([
          {opacity:0, transform:'translateY(12px)'},
          {opacity:1, transform:'translateY(0)'}
        ], {duration:380,delay:index*35,easing:'cubic-bezier(.2,.75,.2,1)'});
      });
    }, reducedMotion ? 0 : 150);
  }

  filters.forEach(button => button.addEventListener('click', () => {
    if (button.classList.contains('active')) return;
    filters.forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    applyFilter(button.dataset.filter);
  }));

  $('#photographerSearch').addEventListener('input',()=>applyFilter($('.filter.active').dataset.filter));
  $('#photographerSort').addEventListener('change',event=>{
    const list=[...cards];
    if(event.target.value==='name')list.sort((a,b)=>$('h3',a).textContent.localeCompare($('h3',b).textContent,'vi'));
    if(event.target.value==='price'){
      const price=c=>Number($('.price-block strong',c).textContent.replace(/[^0-9]/g,''))||Infinity;
      list.sort((a,b)=>price(a)-price(b));
    }
    list.forEach(card=>$('.cheese-photographer-grid').append(card));
    applyFilter($('.filter.active').dataset.filter);
  });
  /* --------------------------------------------------
     Favorites persisted in localStorage
  -------------------------------------------------- */
  const favoriteKey = 'cheese-graduation-favorites';
  let favorites = [];
  try {
    favorites = JSON.parse(localStorage.getItem(favoriteKey) || '[]');
  } catch (_) {
    favorites = [];
  }

  $$('.heart').forEach(button => {
    const card = button.closest('.photographer-card');
    const name = $('h3', card)?.textContent.trim() || 'Photographer';
    const liked = favorites.includes(name);
    button.classList.toggle('liked', liked);
    button.textContent = liked ? '♥' : '♡';
    button.setAttribute('aria-pressed', String(liked));

    button.addEventListener('click', event => {
      event.stopPropagation();
      const isLiked = button.classList.toggle('liked');
      button.textContent = isLiked ? '♥' : '♡';
      button.setAttribute('aria-pressed', String(isLiked));
      button.classList.remove('pop');
      void button.offsetWidth;
      button.classList.add('pop');

      favorites = isLiked
        ? [...new Set([...favorites, name])]
        : favorites.filter(item => item !== name);

      try {
        localStorage.setItem(favoriteKey, JSON.stringify(favorites));
      } catch (_) {}

      showToast(isLiked ? `Đã lưu <b>${name}</b> vào yêu thích ♥` : `Đã bỏ <b>${name}</b> khỏi yêu thích`);
    });
  });

  /* --------------------------------------------------
     Subtle desktop pointer lighting on cards
  -------------------------------------------------- */
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (finePointer && !reducedMotion) {
    cards.forEach(card => {
      card.addEventListener('pointermove', event => {
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mx', `${x}%`);
        card.style.setProperty('--my', `${y}%`);
      });
    });

    const heroVisual = $('.hero-visual');
    const heroPhoto = $('.main-photo');
    if (heroVisual && heroPhoto) {
      heroVisual.addEventListener('pointermove', event => {
        const rect = heroVisual.getBoundingClientRect();
        const nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const ny = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        heroPhoto.style.transform = `rotateY(${nx * 2.2}deg) rotateX(${ny * -2.2}deg)`;
      });
      heroVisual.addEventListener('pointerleave', () => {
        heroPhoto.style.transform = '';
      });
    }
  }

  /* Booking modal is handled by cheese-booking.js */

  /* --------------------------------------------------
     Smooth anchor offset + close menu
  -------------------------------------------------- */
  $$('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#') || href === '#') return;
      const target = $(href);
      if (!target) return;
      event.preventDefault();
      setMenu(false);
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', href);
    });
  });
})();



/* ==================================================
   INLINE EXPERIENCE FX — interaction enhancements
   ================================================== */
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(pointer: fine)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // Intro: disappear as soon as the page is ready; no artificial long wait.
  const loader = $('.fx-loader');
  const dismissLoader = () => {
    if (!loader || loader.classList.contains('is-done')) return;
    requestAnimationFrame(() => loader.classList.add('is-done'));
    window.setTimeout(() => loader.remove(), reduced ? 0 : 760);
  };
  if (document.readyState === 'complete') dismissLoader();
  else window.addEventListener('load', dismissLoader, { once: true });
  window.setTimeout(dismissLoader, 1400);

  // Desktop pointer aura.
  if (fine && !reduced) {
    const aura = document.createElement('div');
    aura.className = 'fx-pointer-aura';
    aura.setAttribute('aria-hidden', 'true');
    document.body.append(aura);
    let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, raf = 0;
    const render = () => {
      x += (tx - x) * .16;
      y += (ty - y) * .16;
      aura.style.left = `${x}px`;
      aura.style.top = `${y}px`;
      raf = requestAnimationFrame(render);
    };
    document.addEventListener('pointermove', e => {
      tx = e.clientX; ty = e.clientY; aura.classList.add('show');
      if (!raf) raf = requestAnimationFrame(render);
    }, { passive: true });
    document.addEventListener('pointerleave', () => aura.classList.remove('show'));
  }

  // Magnetic movement kept intentionally subtle.
  if (fine && !reduced) {
    $$('.btn, .nav-cta, .book-btn').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * .09;
        const dy = (e.clientY - (r.top + r.height / 2)) * .12;
        el.style.translate = `${dx}px ${dy}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    });
  }

  // Click ripple for primary interactive controls.
  $$('.btn, .nav-cta, .book-btn, .filter').forEach(el => {
    el.addEventListener('click', e => {
      const r = el.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'fx-ripple';
      ripple.style.left = `${e.clientX - r.left}px`;
      ripple.style.top = `${e.clientY - r.top}px`;
      el.append(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });
  });

  // Gallery lightbox.
  const figures = $$('.masonry figure');
  if (figures.length) {
    const box = document.createElement('div');
    box.className = 'fx-lightbox';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = `
      <button class="fx-lightbox-close" type="button" aria-label="Đóng ảnh">×</button>
      <div class="fx-lightbox-stage"><img alt=""></div>
      <div class="fx-lightbox-meta"><span class="fx-lightbox-caption"></span><span>ESC · đóng</span></div>`;
    document.body.append(box);
    const boxImg = $('img', box);
    const caption = $('.fx-lightbox-caption', box);
    const close = () => {
      box.classList.remove('open');
      box.setAttribute('aria-hidden', 'true');
      document.body.style.removeProperty('overflow');
    };
    const open = figure => {
      const source = $('img', figure);
      if (!source) return;
      boxImg.src = source.currentSrc || source.src;
      boxImg.alt = source.alt || '';
      caption.textContent = $('figcaption', figure)?.textContent || source.alt || 'Cheese.graduation';
      box.classList.add('open');
      box.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      $('.fx-lightbox-close', box).focus();
    };
    figures.forEach(figure => figure.addEventListener('click', () => open(figure)));
    $('.fx-lightbox-close', box).addEventListener('click', close);
    box.addEventListener('click', e => { if (e.target === box || e.target.classList.contains('fx-lightbox-stage')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('open')) close(); });
  }

  // Mark visible sections for a one-time ambient glow.
  if (!reduced && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('fx-section-live');
        observer.unobserve(entry.target);
      });
    }, { threshold: .26 });
    $$('main > section').forEach(section => observer.observe(section));
  }
})();
