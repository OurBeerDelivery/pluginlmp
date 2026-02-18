(function () {
    'use strict';

    /* ===========================================================
     * Netflix_2 Style – minimal halo, red gradients, logo-first hero
     * =========================================================== */

    /* ---------- Helpers & settings ---------- */
    function getBool(key, def) {
        var v = Lampa.Storage.get(key, def);
        if (typeof v === 'string') v = v.trim().toLowerCase();
        return v === true || v === 'true' || v === 1 || v === '1';
    }

    var settings = {
        enabled: getBool('netflix2_enabled', true),
        useBackdrops: getBool('netflix2_backdrops', true),
        showLogos: getBool('netflix2_show_logos', true),
        smoothScroll: getBool('netflix2_smooth', true),
        cardHeight: Lampa.Storage.get('netflix2_card_height', 'medium') || 'medium',
        round: getBool('netflix2_round', true)
    };

    var CARD_HEIGHTS = {
        small: '180px',
        medium: '220px',
        large: '260px'
    };

    /* ---------- Logo Manager ---------- */
    var LogoManager = (function () {
        var queue = [];
        var waiters = {};
        var busy = false;

        function normalize(value) {
            if (!value) return '';
            if (typeof value === 'object') value = value.url || value.file_path || value.logo || value.path || '';
            if (typeof value !== 'string') return '';
            if (/^https?:\/\//i.test(value)) return value;
            if (value.indexOf('data:image') === 0) return value;
            if (value.charAt(0) === '/') return 'https://image.tmdb.org/t/p/w500' + value;
            return '';
        }

        function direct(movie) {
            var directKeys = [
                movie && movie.direct_logo_url,
                movie && movie.logo,
                movie && movie.logo_path,
                movie && movie.clearlogo,
                movie && movie.clear_logo,
                movie && movie.img_logo,
                movie && movie.image_logo
            ];
            for (var i = 0; i < directKeys.length; i++) {
                var found = normalize(directKeys[i]);
                if (found) return found;
            }

            if (movie && movie.images) {
                var nested = [
                    movie.images.logo,
                    movie.images.clearlogo,
                    movie.images.clear_logo
                ];
                if (Array.isArray(movie.images.logos) && movie.images.logos.length) nested.push(movie.images.logos[0]);
                for (var j = 0; j < nested.length; j++) {
                    var n = normalize(nested[j]);
                    if (n) return n;
                }
            }
            if (Array.isArray(movie && movie.logos) && movie.logos.length) {
                var n2 = normalize(movie.logos[0]);
                if (n2) return n2;
            }
            return '';
        }

        function cacheKey(type, id, lang) {
            return 'nf2_logo_' + type + '_' + id + '_' + lang;
        }

        function getCached(key) {
            try {
                var s = sessionStorage.getItem(key);
                if (s === 'none') return '';
                if (s) return s;
            } catch (e) { /* ignore */ }
            var l = Lampa.Storage.get(key, null);
            if (l === 'none') return '';
            return l || '';
        }

        function setCached(key, val) {
            try { sessionStorage.setItem(key, val || 'none'); } catch (e) { /* ignore */ }
            Lampa.Storage.set(key, val || 'none');
        }

        function pickLogo(dataApi, lang) {
            if (!dataApi || !Array.isArray(dataApi.logos) || !dataApi.logos.length) return '';
            for (var i = 0; i < dataApi.logos.length; i++) {
                var item = dataApi.logos[i];
                if (item && item.iso_639_1 === lang && item.file_path) return item.file_path;
            }
            for (var j = 0; j < dataApi.logos.length; j++) {
                var en = dataApi.logos[j];
                if (en && en.iso_639_1 === 'en' && en.file_path) return en.file_path;
            }
            return dataApi.logos[0].file_path || '';
        }

        function flush(key, url) {
            var list = waiters[key] || [];
            delete waiters[key];
            for (var i = 0; i < list.length; i++) list[i](url || '');
        }

        function processQueue() {
            if (busy || !queue.length) return;
            busy = true;
            var job = queue.shift();
            var apiUrl = Lampa.TMDB.api(job.type + '/' + job.id + '/images?api_key=' + Lampa.TMDB.key() + '&include_image_language=' + job.lang + ',en,null');

            $.get(apiUrl, function (dataApi) {
                var path = pickLogo(dataApi, job.lang);
                var finalUrl = path ? Lampa.TMDB.image('/t/p/original' + path.replace('.svg', '.png')) : '';
                setCached(job.cacheKey, finalUrl || 'none');
                flush(job.reqKey, finalUrl);
                setTimeout(function () { busy = false; processQueue(); }, 120);
            }).fail(function () {
                setCached(job.cacheKey, 'none');
                flush(job.reqKey, '');
                setTimeout(function () { busy = false; processQueue(); }, 120);
            });
        }

        function resolve(movie, done) {
            if (!movie || !movie.id || !Lampa.TMDB || typeof $ === 'undefined' || typeof $.get !== 'function') {
                done('');
                return;
            }

            var directLogo = direct(movie);
            if (directLogo) {
                done(directLogo);
                return;
            }

            var type = movie.name ? 'tv' : 'movie';
            var lang = Lampa.Storage.get('logo_lang', Lampa.Storage.get('language', 'en')) || 'en';
            var key = cacheKey(type, movie.id, lang);

            var cached = getCached(key);
            if (cached) {
                done(cached);
                return;
            }

            var reqKey = key;
            if (waiters[reqKey]) {
                waiters[reqKey].push(done);
                return;
            }
            waiters[reqKey] = [done];

            queue.push({ type: type, id: movie.id, lang: lang, cacheKey: key, reqKey: reqKey });
            processQueue();
        }

        function movieKey(movie) {
            if (!movie || !movie.id) return '';
            return (movie.name ? 'tv:' : 'movie:') + movie.id;
        }

        return { resolve: resolve, direct: direct, movieKey: movieKey };
    })();

    /* ---------- DOM processor ---------- */
    var Dom = (function () {
        var observer = null;
        var smoothMap = new WeakMap();
        var lastMovie = null;
        var lastKey = '';

        function clean(text) {
            return String(text || '').replace(/\s+/g, ' ').trim();
        }

        function getTitle(movie, fallback) {
            return clean((movie && (movie.title || movie.name || movie.original_title || movie.original_name)) || fallback || '');
        }

        function getCardData(card) {
            return card.card_data || card.data || card.movie || card._data || (card.onnoderemove && card.onnoderemove.data) || null;
        }

        function applyBackdrop(card, data) {
            if (!settings.useBackdrops || !data || !data.backdrop_path) return;
            var img = card.querySelector('.card__img');
            if (!img) return;
            var url = 'https://image.tmdb.org/t/p/w1280' + data.backdrop_path;
            if (img.dataset.nf2Backdrop === url) return;
            var preload = new Image();
            preload.onload = function () {
                img.src = url;
                img.dataset.nf2Backdrop = url;
            };
            preload.src = url;
        }

        function processCard(card) {
            if (!settings.enabled || !card || !card.classList) return;
            if (card.dataset.nf2 === '1') return;
            card.dataset.nf2 = '1';
            var data = getCardData(card);
            applyBackdrop(card, data);
        }

        function clamp(n, mi, ma) { return Math.max(mi, Math.min(ma, n)); }

        function animateScroll(line, state) {
            state.current += (state.target - state.current) * 0.18;
            line.scrollLeft = state.current;
            if (Math.abs(state.target - state.current) < 0.5) {
                line.scrollLeft = state.target;
                state.current = state.target;
                state.raf = 0;
                return;
            }
            state.raf = requestAnimationFrame(function () { animateScroll(line, state); });
        }

        function bindSmooth(line) {
            if (!line || !line.classList || !line.classList.contains('items-line')) return;
            if (line.dataset.nf2Smooth === '1') return;
            line.dataset.nf2Smooth = '1';
            var state = { target: line.scrollLeft || 0, current: line.scrollLeft || 0, raf: 0 };
            smoothMap.set(line, state);
            line.addEventListener('wheel', function (e) {
                if (!settings.enabled || !settings.smoothScroll) return;
                if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
                var max = Math.max(0, line.scrollWidth - line.clientWidth);
                if (!max) return;
                e.preventDefault();
                state.target = clamp(state.target + (e.deltaY + e.deltaX) * 0.95, 0, max);
                if (!state.raf) state.raf = requestAnimationFrame(function () { animateScroll(line, state); });
            }, { passive: false });
        }

        function renderHeroLogo(node, url, title, key) {
            node.innerHTML = '';
            node.classList.remove('nf2-hero-text');
            node.classList.add('nf2-hero-logo-wrap');
            node.dataset.nf2key = key || '';
            var holder = document.createElement('div');
            holder.className = 'nf2-hero-logo-holder';
            var img = document.createElement('img');
            img.className = 'nf2-hero-logo';
            img.alt = title;
            img.loading = 'eager';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
            img.src = url;
            holder.appendChild(img);
            node.appendChild(holder);
        }

        function applyHero(movie) {
            if (!settings.enabled) return;
            var titleNodes = document.querySelectorAll('.full-start__title, .full-start-new__title');
            if (!titleNodes.length) return;

            var key = LogoManager.movieKey(movie);
            lastKey = key;

            for (var i = 0; i < titleNodes.length; i++) {
                var node = titleNodes[i];
                if (!node.dataset.nf2orig) node.dataset.nf2orig = node.innerHTML;
                var fallbackText = node.dataset.nf2title || clean(node.textContent || '');
                if (!node.dataset.nf2title) node.dataset.nf2title = fallbackText;

                if (!settings.showLogos) {
                    node.innerHTML = node.dataset.nf2orig;
                    node.classList.remove('nf2-hero-logo-wrap', 'nf2-hero-text');
                    continue;
                }

                var title = getTitle(movie, fallbackText);
                node.innerHTML = '';
                node.classList.add('nf2-hero-text');
                node.textContent = title;

                (function (n, t, k) {
                    var direct = LogoManager.direct(movie);
                    if (direct) {
                        renderHeroLogo(n, direct, t, k);
                        return;
                    }
                    LogoManager.resolve(movie, function (url) {
                        if (!url) return;
                        if (k && lastKey && k !== lastKey) return;
                        renderHeroLogo(n, url, t, k);
                    });
                })(node, title, key);
            }
        }

        function hidePoster() {
            var poster = document.querySelector('.full-start__poster, .full-start-new__poster');
            if (poster) poster.style.display = 'none';
        }

        function scan(node) {
            if (!node || node.nodeType !== 1) return;
            if (node.classList.contains('card')) processCard(node);
            if (node.classList.contains('items-line')) bindSmooth(node);
            if (node.querySelector('.card')) node.querySelectorAll('.card').forEach(processCard);
            if (node.querySelector('.items-line')) node.querySelectorAll('.items-line').forEach(bindSmooth);
            if (node.querySelector('.full-start__title, .full-start-new__title')) {
                applyHero(lastMovie);
                hidePoster();
            }
        }

        function start() {
            if (observer || !document.body) return;
            observer = new MutationObserver(function (mut) {
                for (var i = 0; i < mut.length; i++) {
                    var added = mut[i].addedNodes;
                    for (var j = 0; j < added.length; j++) scan(added[j]);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            scan(document.body);
        }

        function bindFull() {
            if (window.__nf2_full) return;
            window.__nf2_full = true;
            if (!Lampa.Listener || !Lampa.Listener.follow) return;
            Lampa.Listener.follow('full', function (event) {
                if (!settings.enabled) return;
                if (event && event.type && event.type !== 'complite') return;
                if (event && event.data && event.data.movie) {
                    lastMovie = event.data.movie;
                    lastKey = LogoManager.movieKey(lastMovie);
                }
                var delays = [0, 150, 400, 800];
                delays.forEach(function (d) { setTimeout(function () { applyHero(lastMovie); hidePoster(); }, d); });
            });
        }

        function refreshCards() {
            document.querySelectorAll('.card').forEach(function (c) {
                c.dataset.nf2 = '';
                processCard(c);
            });
        }

        function restoreHero() {
            document.querySelectorAll('.nf2-hero-logo-wrap, .nf2-hero-text').forEach(function (n) {
                if (n.dataset.nf2orig) n.innerHTML = n.dataset.nf2orig;
            });
        }

        return { start: start, bindFull: bindFull, refreshCards: refreshCards, applyHero: applyHero, restoreHero: restoreHero };
    })();

    /* ---------- CSS injector ---------- */
    var Css = (function () {
        function inject() {
            var old = document.getElementById('netflix_2_styles');
            if (old) old.remove();
            if (!settings.enabled) {
                Dom.restoreHero();
                return;
            }

            var h = CARD_HEIGHTS[settings.cardHeight] || CARD_HEIGHTS.medium;
            var radius = settings.round ? '16px' : '6px';

            var css = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&display=swap');

:root {
  --nf2-bg-1: #05070c;
  --nf2-bg-2: #0c111a;
  --nf2-accent: #e50914;
  --nf2-accent-2: #b20710;
  --nf2-text: #f4f5f7;
  --nf2-muted: #c1c4cb;
  --nf2-card-h: ${h};
  --nf2-card-w: calc(var(--nf2-card-h) * 16 / 9);
  --nf2-radius: ${radius};
  --nf2-blur: 14px;
}

body {
  background:
    radial-gradient(900px 520px at 18% 10%, rgba(229,9,20,0.12), transparent 58%),
    radial-gradient(1100px 540px at 78% -8%, rgba(255,255,255,0.08), transparent 60%),
    linear-gradient(180deg, #05070c 0%, #0a0f17 38%, #0f1723 100%) !important;
  color: var(--nf2-text) !important;
  font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif !important;
}

/* Rows */
.items-line {
  display: flex !important;
  gap: 14px !important;
  padding: 40px 4% 56px !important;
  overflow-x: auto !important;
  overflow-y: visible !important;
  scroll-snap-type: x proximity !important;
  scroll-padding-left: 4% !important;
  scroll-padding-right: 4% !important;
  -webkit-overflow-scrolling: touch !important;
}
.items-line::-webkit-scrollbar { height: 0 !important; width: 0 !important; }

/* Cards */
.card {
  position: relative !important;
  flex: 0 0 var(--nf2-card-w) !important;
  width: var(--nf2-card-w) !important;
  height: var(--nf2-card-h) !important;
  margin: 0 !important;
  transform-origin: center center !important;
  transition: transform 360ms ease, z-index 0s !important;
}
.card__view {
  position: relative !important;
  width: 100% !important;
  height: 100% !important;
  overflow: hidden !important;
  border-radius: var(--nf2-radius) !important;
  background: #0f141d !important;
  border: 1px solid rgba(255,255,255,0.10) !important;
  box-shadow: 0 12px 26px rgba(0,0,0,0.32) !important;
  transition: transform 360ms ease, box-shadow 280ms ease, border-color 280ms ease !important;
}
.card__view::after {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  background: linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%) !important;
  z-index: 1 !important;
}
.card__view::before { display: none !important; }
.card__img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  transform: scale(1.01) !important;
  transition: transform 420ms ease !important;
}
.card__title {
  position: absolute !important;
  left: 12px !important;
  right: 12px !important;
  bottom: 10px !important;
  z-index: 2 !important;
  color: #fff !important;
  font-family: 'Montserrat', sans-serif !important;
  font-weight: 700 !important;
  font-size: 13px !important;
  line-height: 1.2 !important;
  text-shadow: 0 8px 18px rgba(0,0,0,0.6) !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}
.card__age, .card__vote {
  font-family: 'Montserrat', sans-serif !important;
  font-weight: 700 !important;
}
.card__vote {
  background: rgba(0,0,0,0.76) !important;
  color: #fff !important;
  border-radius: 999px !important;
  padding: 2px 8px !important;
  top: auto !important;
  bottom: 10px !important;
  right: 10px !important;
  border: 1px solid rgba(255,255,255,0.25) !important;
}

/* Netflix-like neighbor shift */
.items-line:hover .card,
.items-line:focus-within .card { transform: translateX(-10%) !important; }
.card:hover ~ .card,
.card.hover ~ .card,
.card.focus ~ .card { transform: translateX(10%) !important; }
.card:hover,
.card.hover,
.card.focus {
  transform: translateX(0) scale(1.12) !important;
  z-index: 8 !important;
}
.card:hover .card__view,
.card.hover .card__view,
.card.focus .card__view {
  border-color: rgba(255,255,255,0.35) !important;
  box-shadow: 0 16px 34px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.25) !important;
  transform: scale(1.01) !important;
}
.card:hover .card__img,
.card.hover .card__img,
.card.focus .card__img { transform: scale(1.04) !important; }

/* Hero / full card */
.full-start, .full-start-new {
  position: relative !important;
  overflow: hidden !important;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
}
.full-start::before, .full-start-new::before,
.full-start::after, .full-start-new::after { display: none !important; }
.full-start__background {
  height: 100vh !important;
  top: 0 !important;
  filter: saturate(1.05) contrast(1.04) brightness(0.98) !important;
  transform: scale(1.01) !important;
}
.full-start__poster, .full-start-new__poster { display: none !important; }
.full-start__left, .full-start-new__left { display: none !important; }
.full-start__body, .full-start-new__body {
  position: relative !important;
  z-index: 2 !important;
  min-height: 82vh !important;
  padding: clamp(82px, 8vh, 118px) 4% clamp(48px, 6vh, 78px) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
}
.full-start__body::after, .full-start-new__body::after {
  content: '' !important;
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  bottom: 0 !important;
  width: 60% !important;
  background: linear-gradient(90deg, rgba(7,9,12,0.86) 0%, rgba(7,9,12,0.62) 32%, rgba(7,9,12,0.18) 64%, transparent 100%) !important;
  pointer-events: none !important;
  z-index: 0 !important;
}
.full-start__right, .full-start-new__right {
  width: min(56vw, 920px) !important;
  max-width: 94vw !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
  align-items: flex-start !important;
  z-index: 1 !important;
}
.full-start__title, .full-start-new__title {
  margin: 0 !important;
  min-height: clamp(120px, 16vh, 240px) !important;
  display: flex !important;
  align-items: flex-end !important;
  width: 100% !important;
}
.nf2-hero-logo-holder {
  display: inline-flex !important;
  align-items: flex-end !important;
  min-height: clamp(120px, 16vh, 240px) !important;
  max-width: min(880px, 92vw) !important;
}
.nf2-hero-logo {
  max-width: min(880px, 72vw) !important;
  max-height: clamp(140px, 20vh, 260px) !important;
  object-fit: contain !important;
  filter: drop-shadow(0 18px 32px rgba(0,0,0,0.7)) drop-shadow(0 0 26px rgba(229,9,20,0.22)) !important;
}
.nf2-hero-text {
  font-family: 'Montserrat', sans-serif !important;
  font-size: clamp(46px, 5.8vw, 86px) !important;
  font-weight: 800 !important;
  letter-spacing: -0.01em !important;
  color: #fff !important;
  text-shadow: 0 16px 38px rgba(0,0,0,0.65) !important;
  margin: 0 !important;
  padding: 0 0 8px 0 !important;
}
.full-start__tagline, .full-start-new__tagline, .ifx-original-title {
  margin-top: 4px !important;
  color: rgba(255,255,255,0.82) !important;
  font-size: clamp(14px, 1.05vw, 18px) !important;
  font-weight: 600 !important;
  letter-spacing: 0.02em !important;
  text-transform: uppercase !important;
  text-shadow: 0 2px 6px rgba(0,0,0,0.42) !important;
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
}
.full-start__details, .full-start-new__details {
  color: rgba(255,255,255,0.9) !important;
  margin-top: 2px !important;
  text-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
  background: transparent !important;
}
.full-start__description, .full-start-new__description {
  max-width: 640px !important;
  color: rgba(255,255,255,0.88) !important;
  font-size: clamp(15px, 1vw, 18px) !important;
  line-height: 1.5 !important;
  text-shadow: 0 2px 6px rgba(0,0,0,0.28) !important;
}
.full-start__buttons, .full-start-new__buttons {
  margin-top: 12px !important;
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 10px !important;
}
.full-start__button {
  border-radius: 12px !important;
  border: 1px solid rgba(255,255,255,0.14) !important;
  padding: 12px 18px !important;
  background: rgba(255,255,255,0.06) !important;
  box-shadow: 0 10px 24px rgba(0,0,0,0.34) !important;
}
.full-start__button.button--play, .full-start-new__button.button--play {
  background: linear-gradient(102deg, rgba(229,9,20,0.98), var(--nf2-accent-2)) !important;
  border-color: rgba(229,9,20,0.94) !important;
  box-shadow: 0 0 0 1px rgba(229,9,20,0.86), 0 16px 32px rgba(229,9,20,0.32) !important;
}

/* Menu & header */
.menu, .menu__list, .head {
  background: linear-gradient(135deg, rgba(12,15,22,0.82), rgba(9,12,18,0.64)) !important;
  border: 1px solid rgba(255,255,255,0.06) !important;
  backdrop-filter: blur(var(--nf2-blur)) saturate(124%) !important;
  -webkit-backdrop-filter: blur(var(--nf2-blur)) saturate(124%) !important;
}
.menu { overflow: visible !important; min-height: 100vh !important; }
.menu__list { overflow: visible !important; padding-bottom: 12px !important; }
.menu__item {
  border-radius: 12px !important;
  transition: all 200ms ease !important;
}
.menu__item.focus, .menu__item.hover, .menu__item.traverse {
  background: linear-gradient(110deg, rgba(229,9,20,0.32), rgba(229,9,20,0.12)) !important;
  border-color: transparent !important;
  box-shadow: 0 0 0 1px rgba(229,9,20,0.38) !important;
}
.head__button, .head .button {
  transition: background 200ms ease, box-shadow 200ms ease !important;
  border-radius: 12px !important;
}
.head__button:hover, .head .button:hover,
.head__button.focus, .head .button.focus {
  background: linear-gradient(120deg, rgba(229,9,20,0.42), rgba(229,9,20,0.18)) !important;
  box-shadow: 0 6px 18px rgba(0,0,0,0.35) !important;
}

/* Misc */
::selection { background: rgba(229,9,20,0.28) !important; }
::-webkit-scrollbar { width: 8px !important; height: 8px !important; }
::-webkit-scrollbar-thumb { background: #2e2e2e !important; border-radius: 8px !important; }
::-webkit-scrollbar-thumb:hover { background: var(--nf2-accent) !important; }

@media (max-width: 1180px) {
  .items-line { padding-top: 36px !important; }
  .full-start__right, .full-start-new__right { width: min(92vw, 760px) !important; }
  .nf2-hero-logo-holder { min-height: clamp(104px, 14vh, 200px) !important; }
  .nf2-hero-logo { max-height: clamp(120px, 16vh, 220px) !important; }
}
@media (max-width: 820px) {
  .items-line { gap: 12px !important; padding: 32px 4% 48px !important; }
  .card { flex-basis: calc(var(--nf2-card-w) * 0.9) !important; }
  .card:hover, .card.focus, .card.hover { transform: translateX(0) scale(1.12) !important; }
  .items-line:hover .card, .items-line:focus-within .card { transform: translateX(-10%) !important; }
  .card:hover ~ .card, .card.focus ~ .card, .card.hover ~ .card { transform: translateX(10%) !important; }
}
`;

            var style = document.createElement('style');
            style.id = 'netflix_2_styles';
            style.textContent = css;
            document.head.appendChild(style);
        }

        return { inject: inject };
    })();

    /* ---------- Settings UI ---------- */
    Lampa.Lang.add({
        netflix2_title: { en: 'Netflix 2 Style', uk: 'Netflix 2 Стиль' },
        netflix2_enable: { en: 'Enable style', uk: 'Увімкнути стиль' },
        netflix2_backdrops: { en: 'Use backdrops for cards', uk: 'Використовувати backdrop для карток' },
        netflix2_show_logos: { en: 'Logo on hero title', uk: 'Лого замість заголовка' },
        netflix2_smooth: { en: 'Smooth row scroll', uk: 'Плавний скрол рядів' },
        netflix2_round: { en: 'Rounded corners', uk: 'Заокруглені краї' },
        netflix2_card_height: { en: 'Card height', uk: 'Висота карток' }
    });

    function initSettingsUI() {
        if (window.__netflix2_settings) return;
        window.__netflix2_settings = true;
        var comp = 'netflix_2';

        Lampa.SettingsApi.addComponent({
            component: comp,
            name: Lampa.Lang.translate('netflix2_title'),
            icon: '<svg viewBox="0 0 512 512" fill="currentColor"><path d="M363.3 48h-60v340l-140-340h-76v416h60v-340l140 340h76v-416z"/></svg>'
        });

        Lampa.SettingsApi.addParam({ component: comp, param: { name: 'netflix2_enabled', type: 'trigger', default: true }, field: { name: Lampa.Lang.translate('netflix2_enable') } });
        Lampa.SettingsApi.addParam({ component: comp, param: { name: 'netflix2_backdrops', type: 'trigger', default: true }, field: { name: Lampa.Lang.translate('netflix2_backdrops') } });
        Lampa.SettingsApi.addParam({ component: comp, param: { name: 'netflix2_show_logos', type: 'trigger', default: true }, field: { name: Lampa.Lang.translate('netflix2_show_logos') } });
        Lampa.SettingsApi.addParam({ component: comp, param: { name: 'netflix2_smooth', type: 'trigger', default: true }, field: { name: Lampa.Lang.translate('netflix2_smooth') } });
        Lampa.SettingsApi.addParam({ component: comp, param: { name: 'netflix2_round', type: 'trigger', default: true }, field: { name: Lampa.Lang.translate('netflix2_round') } });
        Lampa.SettingsApi.addParam({
            component: comp,
            param: {
                name: 'netflix2_card_height',
                type: 'select',
                values: { small: 'Small (180px)', medium: 'Medium (220px)', large: 'Large (260px)' },
                default: 'medium'
            },
            field: { name: Lampa.Lang.translate('netflix2_card_height') }
        });
    }

    function applySetting(key) {
        if (key === 'netflix2_enabled') settings.enabled = getBool(key, true);
        if (key === 'netflix2_backdrops') settings.useBackdrops = getBool(key, true);
        if (key === 'netflix2_show_logos') settings.showLogos = getBool(key, true);
        if (key === 'netflix2_smooth') settings.smoothScroll = getBool(key, true);
        if (key === 'netflix2_round') settings.round = getBool(key, true);
        if (key === 'netflix2_card_height') settings.cardHeight = Lampa.Storage.get('netflix2_card_height', 'medium');

        Css.inject();
        if (!settings.enabled) {
            Dom.restoreHero();
            return;
        }
        Dom.refreshCards();
        Dom.applyHero(null);
    }

    function patchStorage() {
        if (window.__netflix2_storage) return;
        window.__netflix2_storage = true;
        var orig = Lampa.Storage.set;
        Lampa.Storage.set = function (key, val) {
            var r = orig.apply(this, arguments);
            if (key.indexOf('netflix2_') === 0) applySetting(key, val);
            return r;
        };
    }

    /* ---------- Init ---------- */
    function init() {
        if (window.netflix_2_ready) return;
        window.netflix_2_ready = true;

        initSettingsUI();
        patchStorage();
        Css.inject();
        Dom.start();
        Dom.bindFull();
        Dom.refreshCards();

        if (Lampa.Plugin) {
            Lampa.Plugin.display({
                name: 'Netflix 2 Style',
                version: '1.0.0',
                description: 'Halo Netflix look: red gradients, backdrop cards, logo hero',
                type: 'style',
                author: 'Lampac Agent',
                onstart: init
            });
        }

        console.log('[Netflix_2] ready');
    }

    if (window.Lampa) init();
    else {
        var timer = setInterval(function () {
            if (typeof Lampa !== 'undefined') {
                clearInterval(timer);
                init();
            }
        }, 200);
    }
})();
