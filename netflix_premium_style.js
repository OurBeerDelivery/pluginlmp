(function () {
    'use strict';

    /* ============================================================
     * Netflix Premium Style v6.0.1 (clean rewrite)
     * Minimal halo UI, neighbor shifting, logo-first hero
     * ============================================================ */

    /* ======================= SETTINGS ========================== */
    function getBool(key, def) {
        var v = Lampa.Storage.get(key, def);
        if (typeof v === 'string') v = v.trim().toLowerCase();
        return v === true || v === 'true' || v === 1 || v === '1';
    }

    var settings = {
        enabled: getBool('netflix_premium_enabled', true),
        useBackdrops: getBool('netflix_use_backdrops', true),
        showLogos: getBool('netflix_show_logos', true),
        smoothScroll: getBool('netflix_smooth_scroll', true),
        roundCorners: getBool('netflix_round_corners', true),
        cardHeight: Lampa.Storage.get('netflix_card_height', 'medium') || 'medium'
    };

    var CARD_HEIGHTS = { small: '170px', medium: '220px', large: '272px' };

    /* ======================= LOGO ENGINE ======================= */
    var LogoEngine = (function () {
        var queue = [];
        var waiters = {};
        var busy = false;

        function movieKey(movie) {
            if (!movie || !movie.id) return '';
            return (movie.name ? 'tv:' : 'movie:') + movie.id;
        }

        function normalize(value) {
            if (!value) return '';
            if (typeof value === 'object') value = value.url || value.file_path || value.logo || value.path || '';
            if (typeof value !== 'string') return '';
            if (/^https?:\/\//i.test(value)) return value;
            if (value.indexOf('data:image') === 0) return value;
            if (value.charAt(0) === '/') return 'https://image.tmdb.org/t/p/original' + value;
            return '';
        }

        function direct(movie) {
            var list = [
                movie && movie.direct_logo_url,
                movie && movie.logo,
                movie && movie.logo_path,
                movie && movie.clearlogo,
                movie && movie.clear_logo,
                movie && movie.img_logo,
                movie && movie.image_logo
            ];
            for (var i = 0; i < list.length; i++) {
                var found = normalize(list[i]);
                if (found) return found;
            }

            if (movie && movie.images) {
                var nested = [movie.images.logo, movie.images.clearlogo, movie.images.clear_logo];
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
            return 'nfpl_logo_' + type + '_' + id + '_' + lang;
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
            // prefer transparent png (non-svg)
            var logos = dataApi.logos.slice().sort(function (a, b) {
                var aSvg = (a.file_path || '').endsWith('.svg');
                var bSvg = (b.file_path || '').endsWith('.svg');
                return (aSvg === bSvg) ? 0 : (aSvg ? 1 : -1);
            });

            for (var i = 0; i < logos.length; i++) {
                var l = logos[i];
                if (l && l.iso_639_1 === lang && l.file_path) return l.file_path;
            }
            for (var j = 0; j < logos.length; j++) {
                var en = logos[j];
                if (en && en.iso_639_1 === 'en' && en.file_path) return en.file_path;
            }
            return logos[0].file_path || '';
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

            var attempt = job.attempt || 0;
            var delay = Math.pow(2, attempt) * 150; // exponential backoff

            var apiUrl = Lampa.TMDB.api(
                job.type + '/' + job.id + '/images?api_key=' + Lampa.TMDB.key() + '&include_image_language=' + job.lang + ',en,null'
            );

            $.get(apiUrl, function (dataApi) {
                var path = pickLogo(dataApi, job.lang);
                var finalUrl = path ? Lampa.TMDB.image('/t/p/original' + path.replace('.svg', '.png')) : '';
                setCached(job.cacheKey, finalUrl || 'none');
                flush(job.reqKey, finalUrl);
                busy = false;
                processQueue();
            }).fail(function () {
                if (attempt < 2) {
                    job.attempt = attempt + 1;
                    setTimeout(function () { queue.unshift(job); busy = false; processQueue(); }, delay);
                } else {
                    setCached(job.cacheKey, 'none');
                    flush(job.reqKey, '');
                    busy = false;
                    processQueue();
                }
            });
        }

        function resolve(movie, done) {
            if (!movie || !movie.id || !Lampa.TMDB || typeof $ === 'undefined' || typeof $.get !== 'function') {
                done('');
                return;
            }

            var d = direct(movie);
            if (d) {
                done(d);
                return;
            }

            var type = movie.name ? 'tv' : 'movie';
            var lang = Lampa.Storage.get('logo_lang', Lampa.Storage.get('language', 'en')) || 'en';
            var key = cacheKey(type, movie.id, lang);
            var reqKey = key;

            var cached = getCached(key);
            if (cached) {
                done(cached);
                return;
            }

            if (waiters[reqKey]) {
                waiters[reqKey].push(done);
                return;
            }
            waiters[reqKey] = [done];

            queue.push({ type: type, id: movie.id, lang: lang, cacheKey: key, reqKey: reqKey, attempt: 0 });
            processQueue();
        }

        return { resolve: resolve, direct: direct, movieKey: movieKey };
    })();

    /* ===================== DOM PROCESSOR ======================== */
    var Dom = (function () {
        var observer = null;
        var smooth = new WeakMap();
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
            if (img.dataset.nfpBackdrop === url) return;
            var preload = new Image();
            preload.onload = function () {
                img.src = url;
                img.dataset.nfpBackdrop = url;
            };
            preload.src = url;
        }

        function processCard(card) {
            if (!settings.enabled || !card || !card.classList) return;
            if (card.dataset.nfpDone === '1') return;
            card.dataset.nfpDone = '1';
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
            if (line.dataset.nfpSmooth === '1') return;
            line.dataset.nfpSmooth = '1';
            var state = { target: line.scrollLeft || 0, current: line.scrollLeft || 0, raf: 0 };
            smooth.set(line, state);

            line.addEventListener('wheel', function (e) {
                if (!settings.enabled || !settings.smoothScroll) return;
                if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
                var max = Math.max(0, line.scrollWidth - line.clientWidth);
                if (!max) return;
                e.preventDefault();
                state.target = clamp(state.target + (e.deltaY + e.deltaX) * 0.95, 0, max);
                if (!state.raf) state.raf = requestAnimationFrame(function () { animateScroll(line, state); });
            }, { passive: false });

            line.addEventListener('mouseenter', function () { line.classList.add('nfp-hovering'); });
            line.addEventListener('mouseleave', function () { line.classList.remove('nfp-hovering'); });
        }

        function renderLogo(node, url, title, key) {
            node.innerHTML = '';
            node.classList.remove('nfp-hero-text');
            node.classList.add('nfp-hero-logo-wrap');
            node.dataset.nfpKey = key || '';
            var holder = document.createElement('div');
            holder.className = 'nfp-hero-logo-holder';
            var img = document.createElement('img');
            img.className = 'nfp-hero-logo';
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

            var key = LogoEngine.movieKey(movie);
            lastKey = key;

            for (var i = 0; i < titleNodes.length; i++) {
                var node = titleNodes[i];
                if (!node.dataset.nfpOrig) node.dataset.nfpOrig = node.innerHTML;
                var fallback = node.dataset.nfpTitle || clean(node.textContent || '');
                if (!node.dataset.nfpTitle) node.dataset.nfpTitle = fallback;

                if (!settings.showLogos) {
                    node.innerHTML = node.dataset.nfpOrig;
                    node.classList.remove('nfp-hero-logo-wrap', 'nfp-hero-text');
                    continue;
                }

                var title = getTitle(movie, fallback);
                node.innerHTML = '';
                node.classList.add('nfp-hero-text');
                node.textContent = title;

                (function (n, t, k) {
                    var d = LogoEngine.direct(movie);
                    if (d) {
                        renderLogo(n, d, t, k);
                        return;
                    }
                    LogoEngine.resolve(movie, function (url) {
                        if (!url) return;
                        if (k && lastKey && k !== lastKey) return;
                        renderLogo(n, url, t, k);
                    });
                })(node, title, key);
            }
        }

        function hidePoster() {
            var left = document.querySelector('.full-start__poster, .full-start-new__poster');
            if (left) left.style.display = 'none';
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
            if (window.__nfp_full) return;
            window.__nfp_full = true;
            if (!Lampa.Listener || !Lampa.Listener.follow) return;
            Lampa.Listener.follow('full', function (event) {
                if (!settings.enabled) return;
                if (event && event.type && event.type !== 'complite') return;
                if (event && event.data && event.data.movie) {
                    lastMovie = event.data.movie;
                    lastKey = LogoEngine.movieKey(lastMovie);
                }
                [0, 120, 360, 720].forEach(function (d) {
                    setTimeout(function () {
                        applyHero(lastMovie);
                        hidePoster();
                    }, d);
                });
            });
        }

        function refreshCards() {
            document.querySelectorAll('.card').forEach(function (c) {
                c.dataset.nfpDone = '';
                processCard(c);
            });
        }

        function restoreHero() {
            document.querySelectorAll('.nfp-hero-logo-wrap, .nfp-hero-text').forEach(function (n) {
                if (n.dataset.nfpOrig) n.innerHTML = n.dataset.nfpOrig;
            });
        }

        return { start: start, bindFull: bindFull, refreshCards: refreshCards, applyHero: applyHero, restoreHero: restoreHero };
    })();

    /* ======================= CSS INJECTOR ======================= */
    var Css = (function () {
        function inject() {
            var old = document.getElementById('netflix_premium_styles');
            if (old) old.remove();
            if (!settings.enabled) {
                Dom.restoreHero();
                return;
            }

            var h = CARD_HEIGHTS[settings.cardHeight] || CARD_HEIGHTS.medium;
            var radius = settings.roundCorners ? '14px' : '6px';

            var css = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&display=swap');

:root {
  --nfp-bg: #0a0d12;
  --nfp-accent: #e50914;
  --nfp-accent-2: #b20710;
  --nfp-text: #f6f6f6;
  --nfp-muted: #c1c4cb;
  --nfp-card-h: ${h};
  --nfp-card-w: calc(var(--nfp-card-h) * 16 / 9);
  --nfp-radius: ${radius};
  --nfp-glass: rgba(255, 255, 255, 0.05);
}

body {
  background:
    radial-gradient(1200px 520px at 16% -6%, rgba(229,9,20,0.16), transparent 60%),
    radial-gradient(960px 520px at 78% 0%, rgba(255,255,255,0.08), transparent 62%),
    linear-gradient(180deg, #070a10 0%, #0b1018 42%, #111a24 100%) !important;
  color: var(--nfp-text) !important;
  font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif !important;
}

/* ─── OVERFLOW FIX: all parent containers must be visible ─── */
.items-line__body,
.items-cards,
.scroll,
.scroll--horizontal,
.scroll__content,
.scroll__body {
  overflow: visible !important;
}

/* Rows */
.items-line {
  display: flex !important;
  gap: 16px !important;
  padding: 40px 4% 44px !important;   /* vertical room for 1.5x scale */
  overflow: visible !important;        /* NO clipping! */
  scroll-snap-type: x proximity !important;
  scroll-padding-left: 4% !important;
  scroll-padding-right: 4% !important;
  -webkit-overflow-scrolling: touch !important;
  position: relative !important;
  z-index: 1 !important;
}
.items-line::-webkit-scrollbar { height: 0 !important; width: 0 !important; }

/* Row with a focused card sits above other rows */
.items-line:has(.card.focus),
.items-line:has(.card.hover),
.items-line:has(.card:hover) {
  z-index: 50 !important;
}

/* ─── CARDS ─── */
.card {
  position: relative !important;
  flex: 0 0 var(--nfp-card-w) !important;
  width: var(--nfp-card-w) !important;
  height: var(--nfp-card-h) !important;
  margin: 0 !important;
  transform-origin: center center !important;
  transition: transform 500ms cubic-bezier(0.4, 0, 0.2, 1), z-index 0s !important;
  will-change: transform;
  z-index: 1 !important;
}
.card__view {
  position: relative !important;
  width: 100% !important;
  height: 100% !important;
  overflow: visible !important;        /* badges must NOT clip */
  border-radius: var(--nfp-radius) !important;
  background: linear-gradient(140deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  box-shadow: 0 12px 28px rgba(0,0,0,0.36) !important;
  transition: box-shadow 320ms ease, border-color 320ms ease !important;
}
.card__view::after {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: var(--nfp-radius) !important;
  background: linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%) !important;
  z-index: 1 !important;
  pointer-events: none !important;
}
.card__view::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: var(--nfp-radius) !important;
  background: radial-gradient(120% 120% at 12% 12%, rgba(229,9,20,0.18), transparent 48%) !important;
  opacity: 0 !important;
  transition: opacity 240ms ease !important;
  z-index: 1 !important;
  pointer-events: none !important;
}
.card__img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  border-radius: var(--nfp-radius) !important;
  transform: scale(1.01) !important;
  transition: transform 500ms cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.card__title {
  position: absolute !important;
  left: 12px !important;
  right: 12px !important;
  bottom: 10px !important;
  z-index: 3 !important;
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

/* ─── BADGES: Quality & Vote visible, Age hidden ─── */
.card__quality {
  display: block !important;
  position: absolute !important;
  top: 8px !important;
  right: 8px !important;
  z-index: 4 !important;
  background: rgba(229, 9, 20, 0.88) !important;
  color: #fff !important;
  padding: 2px 7px !important;
  border-radius: 4px !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  font-family: 'Montserrat', sans-serif !important;
  letter-spacing: 0.04em !important;
  line-height: 1.4 !important;
  text-transform: uppercase !important;
  pointer-events: none !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
}
.card__vote {
  display: block !important;
  position: absolute !important;
  top: 8px !important;
  left: 8px !important;
  z-index: 4 !important;
  background: rgba(0, 0, 0, 0.7) !important;
  color: #ffd700 !important;
  padding: 2px 7px !important;
  border-radius: 4px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  font-family: 'Montserrat', sans-serif !important;
  line-height: 1.4 !important;
  pointer-events: none !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
}
.card__age {
  display: none !important;
}

/* ─── NEIGHBOR SHIFTING (translate3d → GPU) ─── */
.items-line.nfp-hovering .card { transform: translate3d(-22%, 0, 0) !important; }
.items-line.nfp-hovering .card:first-child { transform: translate3d(-10%, 0, 0) !important; }
.items-line.nfp-hovering .card:last-child { transform: translate3d(-14%, 0, 0) !important; }

.card:hover ~ .card,
.card.hover ~ .card,
.card.focus ~ .card {
  transform: translate3d(22%, 0, 0) !important;
  z-index: 1 !important;
}
.items-line .card:last-child:hover ~ .card { transform: translate3d(0,0,0) !important; }

/* Focused card: scale + HIGH z-index → floats above other rows */
.card:hover,
.card.hover,
.card.focus {
  transform: translate3d(0,0,0) scale(1.5) !important;
  z-index: 100 !important;
}

/* Edge protection: first card → grow rightward */
.card:first-child:hover,
.card:first-child.hover,
.card:first-child.focus {
  transform-origin: left center !important;
}
/* Edge protection: last card → grow leftward */
.card:last-child:hover,
.card:last-child.hover,
.card:last-child.focus {
  transform-origin: right center !important;
}

/* Focused card glow */
.card:hover .card__view,
.card.hover .card__view,
.card.focus .card__view {
  border-color: rgba(229,9,20,0.6) !important;
  box-shadow: 0 24px 48px rgba(0,0,0,0.62), 0 0 0 1px rgba(229,9,20,0.32) !important;
}
.card:hover .card__view::before,
.card.hover .card__view::before,
.card.focus .card__view::before { opacity: 1 !important; }
.card:hover .card__img,
.card.hover .card__img,
.card.focus .card__img { transform: scale(1.06) !important; }

/* ─── FULL HERO ─── */
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
.full-start__poster, .full-start-new__poster,
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
  width: 58% !important;
  background: linear-gradient(90deg, #0a0d12 15%, rgba(10,13,18,0.82) 38%, rgba(10,13,18,0.28) 64%, transparent 100%) !important;
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
.nfp-hero-logo-holder {
  display: inline-flex !important;
  align-items: flex-end !important;
  min-height: clamp(120px, 16vh, 240px) !important;
  max-width: min(880px, 92vw) !important;
}
.nfp-hero-logo {
  max-width: min(880px, 72vw) !important;
  max-height: clamp(140px, 20vh, 260px) !important;
  object-fit: contain !important;
  filter: drop-shadow(0 18px 32px rgba(0,0,0,0.7)) drop-shadow(0 0 26px rgba(229,9,20,0.22)) !important;
}
.nfp-hero-text {
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
  background: linear-gradient(102deg, rgba(229,9,20,0.98), var(--nfp-accent-2)) !important;
  border-color: rgba(229,9,20,0.94) !important;
  box-shadow: 0 0 0 1px rgba(229,9,20,0.86), 0 16px 32px rgba(229,9,20,0.32) !important;
}

/* ─── MENU / HEADER GLASS ─── */
.menu, .menu__list, .head {
  background: linear-gradient(135deg, rgba(12,15,22,0.82), rgba(9,12,18,0.64)) !important;
  border: 1px solid rgba(255,255,255,0.06) !important;
  backdrop-filter: blur(18px) saturate(124%) !important;
  -webkit-backdrop-filter: blur(18px) saturate(124%) !important;
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

::selection { background: rgba(229,9,20,0.28) !important; }
::-webkit-scrollbar { width: 8px !important; height: 8px !important; }
::-webkit-scrollbar-thumb { background: #2e2e2e !important; border-radius: 8px !important; }
::-webkit-scrollbar-thumb:hover { background: var(--nfp-accent) !important; }

/* ─── RESPONSIVE ─── */
@media (max-width: 1180px) {
  .items-line { padding: 32px 4% 38px !important; }
  .full-start__right, .full-start-new__right { width: min(92vw, 760px) !important; }
  .nfp-hero-logo-holder { min-height: clamp(104px, 14vh, 200px) !important; }
  .nfp-hero-logo { max-height: clamp(120px, 16vh, 220px) !important; }
}
@media (max-width: 820px) {
  .items-line { gap: 12px !important; padding: 32px 4% 38px !important; }
  .card { flex-basis: calc(var(--nfp-card-w) * 0.9) !important; }
  .card:hover, .card.focus, .card.hover {
    transform: translate3d(0,0,0) scale(1.3) !important;
    z-index: 100 !important;
  }
  .items-line.nfp-hovering .card { transform: translate3d(-12%,0,0) !important; }
  .card:hover ~ .card, .card.focus ~ .card, .card.hover ~ .card { transform: translate3d(12%,0,0) !important; }
}
`;

            var style = document.createElement('style');
            style.id = 'netflix_premium_styles';
            style.textContent = css;
            document.head.appendChild(style);
        }

        return { inject: inject };
    })();

    /* ========================= SETTINGS UI ====================== */
    Lampa.Lang.add({
        netflix_premium_title: { en: 'Netflix Premium Style', uk: 'Netflix Преміум Стиль' },
        netflix_enable: { en: 'Enable Netflix Premium style', uk: 'Увімкнути Netflix Преміум стиль' },
        netflix_use_backdrops: { en: 'Use backdrops (landscape)', uk: 'Використовувати backdrops (горизонтальні)' },
        netflix_show_logos: { en: 'Replace full-card title with logo', uk: 'Заміняти заголовок картки на лого' },
        netflix_smooth_scroll: { en: 'Extra smooth row scrolling', uk: 'Дуже плавний скрол рядів' },
        netflix_round_corners: { en: 'Rounded corners', uk: 'Заокруглені кути' },
        netflix_card_height: { en: 'Card height', uk: 'Висота карток' }
    });

    function initSettingsUI() {
        if (window.__netflix_settings_ready) return;
        window.__netflix_settings_ready = true;

        var component = 'netflix_premium';

        Lampa.SettingsApi.addComponent({
            component: component,
            name: Lampa.Lang.translate('netflix_premium_title'),
            icon: '<svg viewBox="0 0 512 512" fill="currentColor"><path d="M363.3 48h-60v340l-140-340h-76v416h60v-340l140 340h76v-416z"/></svg>'
        });

        Lampa.SettingsApi.addParam({ component: component, param: { name: 'netflix_premium_enabled', type: 'trigger', default: true }, field: { name: Lampa.Lang.translate('netflix_enable') } });
        Lampa.SettingsApi.addParam({ component: component, param: { name: 'netflix_use_backdrops', type: 'trigger', default: true }, field: { name: Lampa.Lang.translate('netflix_use_backdrops') } });
        Lampa.SettingsApi.addParam({ component: component, param: { name: 'netflix_show_logos', type: 'trigger', default: true }, field: { name: Lampa.Lang.translate('netflix_show_logos') } });
        Lampa.SettingsApi.addParam({ component: component, param: { name: 'netflix_smooth_scroll', type: 'trigger', default: true }, field: { name: Lampa.Lang.translate('netflix_smooth_scroll') } });
        Lampa.SettingsApi.addParam({ component: component, param: { name: 'netflix_round_corners', type: 'trigger', default: true }, field: { name: Lampa.Lang.translate('netflix_round_corners') } });
        Lampa.SettingsApi.addParam({
            component: component,
            param: {
                name: 'netflix_card_height',
                type: 'select',
                values: { small: 'Small (170px)', medium: 'Medium (220px)', large: 'Large (272px)' },
                default: 'medium'
            },
            field: { name: Lampa.Lang.translate('netflix_card_height') }
        });
    }

    function applySetting(key) {
        if (key === 'netflix_premium_enabled') settings.enabled = getBool(key, true);
        if (key === 'netflix_use_backdrops') settings.useBackdrops = getBool(key, true);
        if (key === 'netflix_show_logos') settings.showLogos = getBool(key, true);
        if (key === 'netflix_smooth_scroll') settings.smoothScroll = getBool(key, true);
        if (key === 'netflix_round_corners') settings.roundCorners = getBool(key, true);
        if (key === 'netflix_card_height') settings.cardHeight = Lampa.Storage.get('netflix_card_height', 'medium');

        Css.inject();
        if (!settings.enabled) {
            Dom.restoreHero();
            return;
        }
        Dom.refreshCards();
        Dom.applyHero(null);
    }

    function patchStorage() {
        if (window.__netflix_storage_patched) return;
        window.__netflix_storage_patched = true;
        var originalSet = Lampa.Storage.set;
        Lampa.Storage.set = function (key, val) {
            var res = originalSet.apply(this, arguments);
            if (key.indexOf('netflix_') === 0) applySetting(key, val);
            return res;
        };
    }

    /* =========================== INIT =========================== */
    function init() {
        if (window.netflix_premium_initialized) return;
        window.netflix_premium_initialized = true;

        initSettingsUI();
        patchStorage();
        Css.inject();
        Dom.start();
        Dom.bindFull();
        Dom.refreshCards();

        if (Lampa.Plugin) {
            Lampa.Plugin.display({
                name: 'Netflix Premium Style',
                version: '6.0.1',
                description: 'Halo Netflix UI with logo hero & neighbor shift',
                type: 'style',
                author: 'Lampac Agent',
                onstart: init
            });
        }

        console.log('[Netflix Premium] v6.0.1 ready — overflow/badge/z-index fixes');
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
