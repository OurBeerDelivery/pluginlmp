(function () {
    'use strict';

    /* =============================================================
     * Netflix Premium Style v6.0.0
     * Minimalist halo look, glass + red accents, logo-first hero.
     * ============================================================= */

    /* ========================= 1. SETTINGS ======================== */
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

    var CARD_HEIGHTS = {
        small: '170px',
        medium: '220px',
        large: '272px',
        xlarge: '340px'
    };

    /* ===================== 2. LOGO MANAGER ======================== */
    var LogoManager = (function () {
        var waiters = {};
        var queue = [];
        var busy = false;
        var DISABLE_CACHE = false;

        function movieKey(movie) {
            if (!movie || !movie.id) return '';
            return (movie.name ? 'tv:' : 'movie:') + movie.id;
        }

        function targetLang() {
            return Lampa.Storage.get('logo_lang', Lampa.Storage.get('language', 'en')) || 'en';
        }

        function getCached(key) {
            try {
                var raw = sessionStorage.getItem(key);
                if (raw === 'none') return '';
                if (raw) return raw;
            } catch (e) { /* ignore */ }
            if (!DISABLE_CACHE) {
                var alt = Lampa.Storage.get(key, null);
                if (alt === 'none') return '';
                if (alt) return alt;
            }
            return '';
        }

        function setCached(key, value) {
            try { sessionStorage.setItem(key, value || 'none'); } catch (e) { /* ignore */ }
            if (!DISABLE_CACHE) Lampa.Storage.set(key, value || 'none');
        }

        function normalizeLogoCandidate(value) {
            if (!value) return '';
            if (typeof value === 'object') value = value.url || value.file_path || value.logo || value.path || '';
            if (typeof value !== 'string') return '';
            if (value.indexOf('data:image') === 0) return value;
            if (/^https?:\/\//i.test(value)) return value;
            if (value.charAt(0) === '/') return 'https://image.tmdb.org/t/p/w500' + value;
            return '';
        }

        function directLogo(movie) {
            if (!movie || typeof movie !== 'object') return '';
            var direct = [
                movie.direct_logo_url,
                movie.logo,
                movie.logo_path,
                movie.clearlogo,
                movie.clear_logo,
                movie.img_logo,
                movie.image_logo
            ];
            for (var i = 0; i < direct.length; i++) {
                var found = normalizeLogoCandidate(direct[i]);
                if (found) return found;
            }

            var nested = [];
            if (movie.images) {
                nested.push(movie.images.logo, movie.images.clearlogo, movie.images.clear_logo);
                if (Array.isArray(movie.images.logos) && movie.images.logos.length) nested.push(movie.images.logos[0]);
            }
            if (Array.isArray(movie.logos) && movie.logos.length) nested.push(movie.logos[0]);

            for (var j = 0; j < nested.length; j++) {
                var nestedFound = normalizeLogoCandidate(nested[j]);
                if (nestedFound) return nestedFound;
            }

            return '';
        }

        function pickLogoPath(dataApi, lang) {
            if (!dataApi || !Array.isArray(dataApi.logos) || !dataApi.logos.length) return '';
            for (var i = 0; i < dataApi.logos.length; i++) {
                var l = dataApi.logos[i];
                if (l && l.iso_639_1 === lang && l.file_path) return l.file_path;
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
            if (busy) return;
            if (!queue.length) return;
            busy = true;

            var job = queue.shift();
            var apiUrl = Lampa.TMDB.api(job.type + '/' + job.id + '/images?api_key=' + Lampa.TMDB.key() + '&include_image_language=' + job.lang + ',en,null');

            $.get(apiUrl, function (dataApi) {
                var logoPath = pickLogoPath(dataApi, job.lang);
                var finalUrl = logoPath ? Lampa.TMDB.image('/t/p/original' + logoPath.replace('.svg', '.png')) : '';
                setCached(job.cacheKey, finalUrl || 'none');
                flush(job.requestKey, finalUrl);
                setTimeout(function () { busy = false; processQueue(); }, 120);
            }).fail(function () {
                setCached(job.cacheKey, 'none');
                flush(job.requestKey, '');
                setTimeout(function () { busy = false; processQueue(); }, 120);
            });
        }

        function resolve(movie, done) {
            if (!movie || !movie.id || !Lampa.TMDB || typeof $ === 'undefined' || typeof $.get !== 'function') {
                done('');
                return;
            }

            var direct = directLogo(movie);
            if (direct) {
                done(direct);
                return;
            }

            var type = movie.name ? 'tv' : 'movie';
            var lang = targetLang();
            var cacheKey = 'nfx_logo_' + type + '_' + movie.id + '_' + lang;
            var requestKey = cacheKey;

            var cached = getCached(cacheKey);
            if (cached) {
                done(cached);
                return;
            }

            if (waiters[requestKey]) {
                waiters[requestKey].push(done);
                return;
            }

            waiters[requestKey] = [done];
            queue.push({ type: type, id: movie.id, lang: lang, cacheKey: cacheKey, requestKey: requestKey });
            processQueue();
        }

        return {
            resolve: resolve,
            direct: directLogo,
            movieKey: movieKey
        };
    })();

    /* ===================== 3. DOM PROCESSOR ======================= */
    var DomProcessor = (function () {
        var observer = null;
        var rowScrollState = new WeakMap();
        var lastMovie = null;
        var lastMovieKey = '';

        function cleanTitle(text) {
            return String(text || '').replace(/\s+/g, ' ').trim();
        }

        function getMovieTitle(movie, fallback) {
            return cleanTitle((movie && (movie.title || movie.name || movie.original_title || movie.original_name)) || fallback || '');
        }

        function getCardData(card) {
            return card.card_data || card.data || card.movie || card._data || (card.onnoderemove && card.onnoderemove.data) || null;
        }

        function applyBackdrop(card, data) {
            if (!settings.useBackdrops || !data || !data.backdrop_path) return;
            var img = card.querySelector('.card__img');
            if (!img) return;

            var url = 'https://image.tmdb.org/t/p/w1280' + data.backdrop_path;
            if (img.dataset.nfxBackdrop === url) return;

            var preload = new Image();
            preload.onload = function () {
                img.src = url;
                img.dataset.nfxBackdrop = url;
                card.classList.add('nfx-has-backdrop');
            };
            preload.src = url;
        }

        function processCard(card) {
            if (!settings.enabled || !card || !card.classList) return;
            if (card.dataset.nfxProcessed === 'true') return;

            card.dataset.nfxProcessed = 'true';
            var data = getCardData(card);
            applyBackdrop(card, data);
        }

        function clamp(num, min, max) {
            return Math.max(min, Math.min(max, num));
        }

        function animateLineScroll(line, state) {
            state.current += (state.target - state.current) * 0.18;
            line.scrollLeft = state.current;

            if (Math.abs(state.target - state.current) < 0.5) {
                line.scrollLeft = state.target;
                state.current = state.target;
                state.raf = 0;
                return;
            }

            state.raf = requestAnimationFrame(function () {
                animateLineScroll(line, state);
            });
        }

        function enableSmoothRowScroll(line) {
            if (!line || !line.classList || !line.classList.contains('items-line')) return;
            if (line.dataset.nfxSmoothBound === 'true') return;

            line.dataset.nfxSmoothBound = 'true';
            var state = { target: line.scrollLeft || 0, current: line.scrollLeft || 0, raf: 0 };
            rowScrollState.set(line, state);

            line.addEventListener('wheel', function (event) {
                if (!settings.enabled || !settings.smoothScroll) return;

                var mostlyVertical = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
                if (!mostlyVertical) return;

                var maxScroll = Math.max(0, line.scrollWidth - line.clientWidth);
                if (!maxScroll) return;

                event.preventDefault();
                var delta = (event.deltaY + event.deltaX) * 0.95;

                state.target = clamp(state.target + delta, 0, maxScroll);
                if (!state.raf) state.raf = requestAnimationFrame(function () { animateLineScroll(line, state); });
            }, { passive: false });
        }

        function restoreOriginalTitle(node) {
            if (!node || !node.dataset) return;
            if (!node.dataset.nfxOriginalHtml) return;
            node.innerHTML = node.dataset.nfxOriginalHtml;
            node.classList.remove('nfx-hero-logo-wrap', 'nfx-hero-text');
        }

        function applyHeroLogo(movie) {
            if (!settings.enabled) return;
            var titleNodes = document.querySelectorAll('.full-start-new__title, .full-start__title');
            if (!titleNodes.length) return;

            var key = LogoManager.movieKey(movie);
            lastMovieKey = key;

            for (var i = 0; i < titleNodes.length; i++) {
                var node = titleNodes[i];
                if (!node.dataset.nfxOriginalHtml) node.dataset.nfxOriginalHtml = node.innerHTML;
                var fallbackText = node.dataset.nfxOriginalTitle || cleanTitle(node.textContent || '');
                if (!node.dataset.nfxOriginalTitle) node.dataset.nfxOriginalTitle = fallbackText;

                if (!settings.showLogos) {
                    restoreOriginalTitle(node);
                    continue;
                }

                var textTitle = getMovieTitle(movie, fallbackText);
                node.innerHTML = '';
                node.classList.add('nfx-hero-text');
                node.setAttribute('aria-label', textTitle);

                var direct = LogoManager.direct(movie);
                if (direct) {
                    renderLogo(node, direct, textTitle, key);
                    continue;
                }

                node.textContent = textTitle;
                (function (titleNode, titleText, movieKey) {
                    LogoManager.resolve(movie, function (url) {
                        if (!url) return;
                        if (movieKey && lastMovieKey && movieKey !== lastMovieKey) return;
                        renderLogo(titleNode, url, titleText, movieKey);
                    });
                })(node, textTitle, key);
            }
        }

        function renderLogo(node, url, titleText, movieKey) {
            if (!node) return;
            node.innerHTML = '';
            node.classList.remove('nfx-hero-text');
            node.classList.add('nfx-hero-logo-wrap');
            node.dataset.nfxMovieKey = movieKey || '';

            var holder = document.createElement('div');
            holder.className = 'nfx-hero-logo-holder';

            var img = document.createElement('img');
            img.className = 'nfx-hero-logo';
            img.alt = titleText;
            img.loading = 'eager';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
            img.src = url;

            holder.appendChild(img);
            node.appendChild(holder);
        }

        function scanNode(node) {
            if (!node || node.nodeType !== 1) return;

            if (node.classList.contains('card')) processCard(node);
            if (node.classList.contains('items-line')) enableSmoothRowScroll(node);
            if (node.classList.contains('full-start__title') || node.classList.contains('full-start-new__title')) applyHeroLogo(lastMovie);

            var cards = node.querySelectorAll('.card');
            for (var i = 0; i < cards.length; i++) processCard(cards[i]);

            var rows = node.querySelectorAll('.items-line');
            for (var j = 0; j < rows.length; j++) enableSmoothRowScroll(rows[j]);

            if (node.querySelector('.full-start__title, .full-start-new__title')) applyHeroLogo(lastMovie);
        }

        function startObserver() {
            if (observer || !document.body) return;

            observer = new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    var added = mutations[i].addedNodes;
                    for (var j = 0; j < added.length; j++) scanNode(added[j]);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
            scanNode(document.body);
        }

        function bindFullListener() {
            if (window.__netflix_full_bound) return;
            window.__netflix_full_bound = true;

            if (!Lampa.Listener || !Lampa.Listener.follow) return;

            Lampa.Listener.follow('full', function (event) {
                if (!settings.enabled) return;
                if (event && event.type && event.type !== 'complite') return;

                if (event && event.data && event.data.movie) {
                    lastMovie = event.data.movie;
                    lastMovieKey = LogoManager.movieKey(lastMovie);
                }

                var delays = [0, 140, 320, 640];
                for (var i = 0; i < delays.length; i++) {
                    (function (d) { setTimeout(function () { applyHeroLogo(lastMovie); }, d); })(delays[i]);
                }
            });
        }

        function refreshCards() {
            var cards = document.querySelectorAll('.card');
            for (var i = 0; i < cards.length; i++) {
                delete cards[i].dataset.nfxProcessed;
                processCard(cards[i]);
            }
        }

        function restoreTitles() {
            var nodes = document.querySelectorAll('.nfx-hero-logo-wrap, .nfx-hero-text');
            for (var i = 0; i < nodes.length; i++) restoreOriginalTitle(nodes[i]);
        }

        return {
            start: startObserver,
            bindFull: bindFullListener,
            refreshCards: refreshCards,
            applyHeroLogo: applyHeroLogo,
            restoreTitles: restoreTitles
        };
    })();

    /* ===================== 4. CSS INJECTOR ======================== */
    var CssInjector = (function () {
        function inject() {
            var old = document.getElementById('netflix_premium_styles');
            if (old) old.remove();

            if (!settings.enabled) {
                DomProcessor.restoreTitles();
                return;
            }

            var h = CARD_HEIGHTS[settings.cardHeight] || CARD_HEIGHTS.medium;
            var radius = settings.roundCorners ? '14px' : '6px';

            var css = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&display=swap');

:root {
  --nfx-bg: #0a0d12;
  --nfx-bg-soft: #111723;
  --nfx-red: #e50914;
  --nfx-red-deep: #b20710;
  --nfx-text: #f6f6f6;
  --nfx-muted: #b8beca;
  --nfx-glass: rgba(14, 18, 24, 0.6);
  --nfx-glass-strong: rgba(9, 12, 17, 0.72);
  --nfx-blur: 16px;
  --nfx-card-radius: ${radius};
  --nfx-card-height: ${h};
  --nfx-card-width: calc(var(--nfx-card-height) * 16 / 9);
}

body {
  background:
    radial-gradient(860px 420px at 12% 0%, rgba(229, 9, 20, 0.22), transparent 52%),
    radial-gradient(960px 520px at 82% 10%, rgba(255, 255, 255, 0.08), transparent 70%),
    linear-gradient(180deg, #06080c 0%, #0b1018 42%, #0f1723 100%) !important;
  color: var(--nfx-text) !important;
  font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif !important;
}

/* ----- Rows ----- */
.items-line {
  display: flex !important;
  gap: 18px !important;
  padding: 56px 4% 72px !important;
  overflow-y: visible !important;
  overflow-x: auto !important;
  scroll-snap-type: x proximity !important;
  scroll-padding-left: 4% !important;
  scroll-padding-right: 4% !important;
  -webkit-overflow-scrolling: touch !important;
}
.items-line::-webkit-scrollbar { height: 0 !important; width: 0 !important; }

/* ----- Cards ----- */
.card {
  position: relative !important;
  flex: 0 0 var(--nfx-card-width) !important;
  width: var(--nfx-card-width) !important;
  height: var(--nfx-card-height) !important;
  margin: 0 !important;
  overflow: visible !important;
  transform-origin: center center !important;
  transition: transform 500ms ease, z-index 0s !important;
}
.card__view {
  position: relative !important;
  width: 100% !important;
  height: 100% !important;
  overflow: hidden !important;
  border-radius: var(--nfx-card-radius) !important;
  background: linear-gradient(150deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)) !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  box-shadow: 0 12px 32px rgba(0,0,0,0.48) !important;
  transition: transform 500ms ease, box-shadow 350ms ease, border-color 350ms ease !important;
}
.card__view::after {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  background: linear-gradient(180deg, rgba(0,0,0,0) 20%, rgba(0,0,0,0.6) 100%) !important;
  z-index: 1 !important;
}
.card__view::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  background: radial-gradient(140% 120% at 12% 8%, rgba(229,9,20,0.16), transparent 42%) !important;
  opacity: 0 !important;
  transition: opacity 260ms ease !important;
  z-index: 1 !important;
  pointer-events: none !important;
}
.card__img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  transform: scale(1.02) !important;
  transition: transform 500ms ease !important;
}
.card__title {
  position: absolute !important;
  left: 12px !important;
  right: 12px !important;
  bottom: 12px !important;
  z-index: 2 !important;
  color: #fff !important;
  font-weight: 700 !important;
  font-size: 14px !important;
  line-height: 1.2 !important;
  text-shadow: 0 10px 26px rgba(0,0,0,0.65) !important;
  display: -webkit-box !important;
  -webkit-box-orient: vertical !important;
  -webkit-line-clamp: 2 !important;
  overflow: hidden !important;
}
.card__age, .card__vote, .card__quality { display: none !important; }

/* Netflix Flow neighbour shifting */
.items-line:hover .card,
.items-line:focus-within .card { transform: translateX(-22%) !important; }
.card:hover ~ .card,
.card.focus ~ .card,
.card.hover ~ .card { transform: translateX(22%) !important; }
.card:hover,
.card.focus,
.card.hover {
  transform: translateX(0) scale(1.5) !important;
  z-index: 8 !important;
}
.card:hover .card__view,
.card.focus .card__view,
.card.hover .card__view {
  box-shadow: 0 22px 50px rgba(0,0,0,0.72), 0 0 0 1px rgba(229,9,20,0.42) !important;
  border-color: rgba(229,9,20,0.6) !important;
  transform: scale(1.01) !important;
}
.card:hover .card__view::before,
.card.focus .card__view::before,
.card.hover .card__view::before { opacity: 1 !important; }
.card:hover .card__img,
.card.focus .card__img,
.card.hover .card__img { transform: scale(1.05) !important; }

/* ----- Panels & chrome ----- */
.menu, .menu__list, .head, .head__split, .settings__content, .settings-input__content,
.selectbox__content, .modal__content, .full-start, .full-start-new {
  background: linear-gradient(135deg, rgba(14,18,24,0.7), rgba(10,13,20,0.5)) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  backdrop-filter: blur(var(--nfx-blur)) saturate(128%) !important;
  -webkit-backdrop-filter: blur(var(--nfx-blur)) saturate(128%) !important;
}
.menu { overflow: visible !important; min-height: 100vh !important; }
.menu__list { overflow: visible !important; padding-bottom: 12px !important; }

/* ----- Inputs / focusables ----- */
.settings-folder, .settings-param, .selectbox-item, .full-start__button, .full-descr__tag,
.player-panel.button, .simple-button, .custom-online-btn, .custom-torrent-btn,
.main2-more-btn, .button, .torrent-item, .files__item {
  border-radius: 12px !important;
  border: 1px solid rgba(255,255,255,0.12) !important;
  background: rgba(255,255,255,0.04) !important;
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease !important;
}
.settings-folder.focus, .settings-param.focus, .selectbox-item.focus, .full-start__button.focus,
.full-descr__tag.focus, .player-panel.button.focus, .simple-button.focus, .custom-online-btn.focus,
.custom-torrent-btn.focus, .main2-more-btn.focus, .button.focus, .torrent-item.focus, .files__item.focus {
  background: linear-gradient(96deg, rgba(229,9,20,0.96), var(--nfx-red-deep)) !important;
  border-color: rgba(229,9,20,0.92) !important;
  box-shadow: 0 0 0 1px rgba(229,9,20,0.9), 0 12px 28px rgba(229,9,20,0.32) !important;
  color: #fff !important;
  transform: translateY(-1px) !important;
}

/* ----- Hero / full card ----- */
.full-start, .full-start-new {
  position: relative !important;
  overflow: hidden !important;
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
}
.full-start::before, .full-start-new::before { display: none !important; }
.full-start::after, .full-start-new::after { display: none !important; }
.full-start__background {
  height: 100vh !important;
  top: 0 !important;
  filter: saturate(1.05) contrast(1.04) brightness(0.98) !important;
  transform: scale(1.01) !important;
}
.full-start__body, .full-start-new__body {
  position: relative !important;
  z-index: 2 !important;
  min-height: 82vh !important;
  padding: clamp(82px, 8vh, 118px) 4% clamp(32px, 4vh, 64px) !important;
  display: flex !important;
  align-items: flex-end !important;
}
.full-start__body::before, .full-start-new__body::before { display: none !important; }
.full-start__right, .full-start-new__right {
  width: min(64vw, 980px) !important;
  max-width: 94vw !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 8px !important;
  align-items: flex-start !important;
  z-index: 1 !important;
}
.full-start__title, .full-start-new__title {
  margin: 0 !important;
  min-height: clamp(140px, 18vh, 260px) !important;
  display: flex !important;
  align-items: flex-end !important;
  width: 100% !important;
}
.full-start__tagline, .full-start-new__tagline, .ifx-original-title {
  margin-top: 6px !important;
  color: rgba(255,255,255,0.9) !important;
  font-size: clamp(15px, 1.2vw, 20px) !important;
  font-weight: 500 !important;
  text-shadow: 0 2px 6px rgba(0,0,0,0.4) !important;
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
}
.full-start__details, .full-start-new__details {
  color: rgba(255,255,255,0.9) !important;
  margin-top: 4px !important;
  text-shadow: 0 2px 6px rgba(0,0,0,0.35) !important;
  background: transparent !important;
}
.nfx-hero-logo-holder {
  display: inline-flex !important;
  align-items: flex-end !important;
  min-height: clamp(120px, 16vh, 240px) !important;
  max-width: min(840px, 90vw) !important;
}
.nfx-hero-logo {
  max-width: min(840px, 70vw) !important;
  max-height: clamp(140px, 20vh, 260px) !important;
  object-fit: contain !important;
  filter: drop-shadow(0 16px 32px rgba(0,0,0,0.7)) drop-shadow(0 0 26px rgba(229,9,20,0.22)) !important;
}
.nfx-hero-text {
  font-family: 'Montserrat', sans-serif !important;
  font-size: clamp(40px, 5vw, 70px) !important;
  font-weight: 700 !important;
  letter-spacing: -0.01em !important;
  color: #fff !important;
  text-shadow: 0 16px 38px rgba(0,0,0,0.7) !important;
  margin: 0 !important;
  padding: 0 0 12px 0 !important;
}
.full-start__tagline, .full-start-new__tagline, .ifx-original-title {
  margin-top: 6px !important;
  color: rgba(255,255,255,0.78) !important;
  font-size: clamp(14px, 1.1vw, 18px) !important;
  font-weight: 500 !important;
  text-shadow: 0 2px 6px rgba(0,0,0,0.6) !important;
  background: transparent !important;
  border: none !important;
}
.full-start__details, .full-start-new__details {
  color: rgba(255,255,255,0.86) !important;
  margin-top: 2px !important;
  text-shadow: 0 2px 6px rgba(0,0,0,0.6) !important;
}
.full-start__buttons, .full-start-new__buttons {
  margin-top: 12px !important;
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 10px !important;
}
.full-start__button {
  border-radius: 12px !important;
  border: 1px solid rgba(255,255,255,0.16) !important;
  padding: 12px 18px !important;
  background: rgba(255,255,255,0.08) !important;
  box-shadow: 0 10px 24px rgba(0,0,0,0.34) !important;
}
.full-start__button.button--play, .full-start-new__button.button--play {
  background: linear-gradient(102deg, rgba(229,9,20,0.98), var(--nfx-red-deep)) !important;
  border-color: rgba(229,9,20,0.94) !important;
  box-shadow: 0 0 0 1px rgba(229,9,20,0.86), 0 16px 32px rgba(229,9,20,0.32) !important;
}

@media (max-width: 1180px) {
  .items-line { padding-top: 44px !important; }
  .full-start__right, .full-start-new__right { width: min(92vw, 760px) !important; }
  .nfx-hero-logo-holder { min-height: clamp(104px, 14vh, 200px) !important; }
  .nfx-hero-logo { max-height: clamp(120px, 16vh, 220px) !important; }
}
@media (max-width: 820px) {
  .items-line { gap: 12px !important; padding: 36px 4% 52px !important; }
  .card { flex-basis: calc(var(--nfx-card-width) * 0.9) !important; }
  .card:hover, .card.focus, .card.hover { transform: translateX(0) scale(1.25) !important; }
  .items-line:hover .card, .items-line:focus-within .card { transform: translateX(-12%) !important; }
  .card:hover ~ .card, .card.focus ~ .card, .card.hover ~ .card { transform: translateX(12%) !important; }
}

::selection { background: rgba(229,9,20,0.32) !important; }
::-webkit-scrollbar { width: 8px !important; height: 8px !important; }
::-webkit-scrollbar-thumb { background: #2c2c2c !important; border-radius: 8px !important; }
::-webkit-scrollbar-thumb:hover { background: var(--nfx-red) !important; }
`;

            var style = document.createElement('style');
            style.id = 'netflix_premium_styles';
            style.textContent = css;
            document.head.appendChild(style);
        }

        return { inject: inject };
    })();

    /* ====================== 5. SETTINGS UI ======================== */
    Lampa.Lang.add({
        netflix_premium_title: { en: 'Netflix Premium Style', uk: 'Netflix Преміум Стиль' },
        netflix_enable: { en: 'Enable Netflix Premium style', uk: 'Увімкнути Netflix Преміум стиль' },
        netflix_use_backdrops: { en: 'Use backdrops (landscape)', uk: 'Використовувати backdrops (горизонтальні)' },
        netflix_show_logos: { en: 'Replace hero title with logo', uk: 'Заміняти заголовок на лого' },
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

        Lampa.SettingsApi.addParam({
            component: component,
            param: { name: 'netflix_premium_enabled', type: 'trigger', default: true },
            field: { name: Lampa.Lang.translate('netflix_enable') }
        });

        Lampa.SettingsApi.addParam({
            component: component,
            param: { name: 'netflix_use_backdrops', type: 'trigger', default: true },
            field: { name: Lampa.Lang.translate('netflix_use_backdrops') }
        });

        Lampa.SettingsApi.addParam({
            component: component,
            param: { name: 'netflix_show_logos', type: 'trigger', default: true },
            field: { name: Lampa.Lang.translate('netflix_show_logos') }
        });

        Lampa.SettingsApi.addParam({
            component: component,
            param: { name: 'netflix_smooth_scroll', type: 'trigger', default: true },
            field: { name: Lampa.Lang.translate('netflix_smooth_scroll') }
        });

        Lampa.SettingsApi.addParam({
            component: component,
            param: { name: 'netflix_round_corners', type: 'trigger', default: true },
            field: { name: Lampa.Lang.translate('netflix_round_corners') }
        });

        Lampa.SettingsApi.addParam({
            component: component,
            param: {
                name: 'netflix_card_height',
                type: 'select',
                values: { small: 'Small (170px)', medium: 'Medium (220px)', large: 'Large (272px)', xlarge: 'True 4K (340px)' },
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

        CssInjector.inject();

        if (!settings.enabled) {
            DomProcessor.restoreTitles();
            return;
        }

        DomProcessor.refreshCards();
        DomProcessor.applyHeroLogo(null);
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

    /* ========================= 6. INIT ============================ */
    function init() {
        if (window.netflix_premium_initialized) return;
        window.netflix_premium_initialized = true;

        initSettingsUI();
        patchStorage();
        CssInjector.inject();
        DomProcessor.start();
        DomProcessor.bindFull();
        DomProcessor.refreshCards();

        if (Lampa.Plugin) {
            Lampa.Plugin.display({
                name: 'Netflix Premium Style',
                version: '6.0.0',
                description: 'Minimalist Netflix halo UI with logo hero & flow cards',
                type: 'style',
                author: 'Lampac Agent',
                onstart: init
            });
        }

        console.log('[Netflix Premium] v6 ready');
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
