(function () {
    'use strict';

    /* ================================================================
     *  Netflix Premium Style v7.1  —  Full Minimalist / Zero Gradient
     *
     *  ✦ Logo Engine    → Lampa.TMDB.api() + Lampa.TMDB.key()
     *  ✦ Hero           → Clean backdrop, NO gradients, text-shadow only
     *  ✦ Sidebar        → Glassy blur, red left-border active item
     *  ✦ Cards          → No ghost masks, clean box-shadow, 1.35x scale
     *  ✦ GPU            → translate3d / scale3d everywhere
     * ================================================================ */

    // ─────────────────────────────────────────────────────────────────
    //  SECTION 1 — ANIMATION HELPERS  (from logo.js reference)
    // ─────────────────────────────────────────────────────────────────

    var FADE_OUT_TEXT = 300;
    var MORPH_HEIGHT = 400;
    var FADE_IN_IMG = 400;
    var SAFE_DELAY = 200;

    function animateHeight(element, start, end, duration, callback) {
        var startTime = null;
        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = timestamp - startTime;
            var percent = Math.min(progress / duration, 1);
            var ease = 1 - Math.pow(1 - percent, 3);
            element.style.height = (start + (end - start) * ease) + 'px';
            if (progress < duration) {
                requestAnimationFrame(step);
            } else {
                if (callback) callback();
            }
        }
        requestAnimationFrame(step);
    }

    function animateOpacity(element, start, end, duration, callback) {
        var startTime = null;
        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = timestamp - startTime;
            var percent = Math.min(progress / duration, 1);
            var ease = 1 - Math.pow(1 - percent, 3);
            element.style.opacity = start + (end - start) * ease;
            if (progress < duration) {
                requestAnimationFrame(step);
            } else {
                if (callback) callback();
            }
        }
        requestAnimationFrame(step);
    }


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 2 — LOGO ENGINE  (NO hardcoded API keys)
    // ─────────────────────────────────────────────────────────────────

    var LogoEngine = {
        _cachePrefix: 'nfx_logo_v7_',

        _key: function (type, id, lang) {
            return this._cachePrefix + type + '_' + id + '_' + lang;
        },

        _getCached: function (key) {
            try {
                var s = sessionStorage.getItem(key);
                if (s) return s;
            } catch (e) { /* ignore */ }
            return Lampa.Storage.get(key, null);
        },

        _setCached: function (key, value) {
            var v = value || 'none';
            try { sessionStorage.setItem(key, v); } catch (e) { /* ignore */ }
            Lampa.Storage.set(key, v);
        },

        /**
         * Pick best logo: target_lang PNG → en PNG → any first.
         * SVGs converted to PNG via extension swap.
         */
        _pickBest: function (logos, targetLang) {
            if (!logos || !logos.length) return null;

            var sorted = logos.slice().sort(function (a, b) {
                var aS = (a.file_path || '').toLowerCase().endsWith('.svg');
                var bS = (b.file_path || '').toLowerCase().endsWith('.svg');
                return aS === bS ? 0 : (aS ? 1 : -1);
            });

            for (var i = 0; i < sorted.length; i++) {
                if (sorted[i].iso_639_1 === targetLang && sorted[i].file_path) return sorted[i].file_path;
            }
            for (var j = 0; j < sorted.length; j++) {
                if (sorted[j].iso_639_1 === 'en' && sorted[j].file_path) return sorted[j].file_path;
            }
            return sorted[0] && sorted[0].file_path ? sorted[0].file_path : null;
        },

        _getLang: function () {
            var u = Lampa.Storage.get('logo_lang', '');
            return u || Lampa.Storage.get('language', 'uk') || 'uk';
        },

        /**
         * Resolve logo — uses Lampa.TMDB.api() + Lampa.TMDB.key()
         */
        resolve: function (movie, done) {
            if (!movie || !movie.id) { done(null); return; }

            var type = movie.name ? 'tv' : 'movie';
            var lang = this._getLang();
            var cacheKey = this._key(type, movie.id, lang);

            var cached = this._getCached(cacheKey);
            if (cached === 'none') { done(null); return; }
            if (cached) { done(cached); return; }

            var url = Lampa.TMDB.api(
                type + '/' + movie.id + '/images?api_key=' + Lampa.TMDB.key() +
                '&include_image_language=' + lang + ',en,null'
            );

            var self = this;
            var size = Lampa.Storage.get('logo_size', 'original') || 'original';

            $.get(url, function (data_api) {
                var path = self._pickBest(data_api.logos, lang);
                if (path) {
                    var imgUrl = Lampa.TMDB.image('/t/p/' + size + path.replace('.svg', '.png'));
                    self._setCached(cacheKey, imgUrl);
                    done(imgUrl);
                } else {
                    self._setCached(cacheKey, 'none');
                    done(null);
                }
            }).fail(function () {
                done(null);
            });
        }
    };


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 3 — HERO PROCESSOR  (logo animation on full card page)
    // ─────────────────────────────────────────────────────────────────

    function applyLogoStyles(img) {
        img.style.display = 'block';
        img.style.maxWidth = '500px';
        img.style.maxHeight = '250px';
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.objectFit = 'contain';
        img.style.objectPosition = 'left bottom';
        img.style.boxSizing = 'border-box';
        img.style.paddingBottom = '0.2em';
        img.style.filter = 'drop-shadow(0 4px 20px rgba(0,0,0,0.85))';
    }

    /**
     * Smooth logo animation (logo.js pattern):
     *  1. Fade out text  2. Replace with <img>  3. Morph height  4. Fade in logo
     */
    function startLogoAnimation(imgUrl, titleElem, domTitle) {
        var img = new Image();
        img.src = imgUrl;

        var startTextHeight = 0;
        if (domTitle) startTextHeight = domTitle.getBoundingClientRect().height;

        applyLogoStyles(img);
        img.style.opacity = '0';

        img.onload = function () {
            setTimeout(function () {
                if (domTitle) startTextHeight = domTitle.getBoundingClientRect().height;

                // 1) Fade out
                titleElem.css({
                    transition: 'opacity ' + (FADE_OUT_TEXT / 1000) + 's ease',
                    opacity: '0'
                });

                setTimeout(function () {
                    // 2) Replace
                    titleElem.empty().append(img);
                    titleElem.css({ opacity: '1', transition: 'none' });

                    var targetHeight = domTitle.getBoundingClientRect().height;

                    domTitle.style.height = startTextHeight + 'px';
                    domTitle.style.display = 'block';
                    domTitle.style.overflow = 'hidden';
                    domTitle.style.boxSizing = 'border-box';

                    void domTitle.offsetHeight;

                    // 3) Morph
                    domTitle.style.transition = 'height ' + (MORPH_HEIGHT / 1000) + 's cubic-bezier(0.4, 0, 0.2, 1)';

                    requestAnimationFrame(function () {
                        domTitle.style.height = targetHeight + 'px';

                        // 4) Fade in
                        setTimeout(function () {
                            img.style.transition = 'opacity ' + (FADE_IN_IMG / 1000) + 's ease';
                            img.style.opacity = '1';
                        }, Math.max(0, MORPH_HEIGHT - 100));

                        // Cleanup
                        setTimeout(function () {
                            domTitle.style.height = '';
                            domTitle.style.overflow = '';
                            domTitle.style.transition = 'none';
                            applyLogoStyles(img);
                        }, MORPH_HEIGHT + FADE_IN_IMG + 50);
                    });
                }, FADE_OUT_TEXT);

            }, SAFE_DELAY);
        };

        img.onerror = function () {
            titleElem.css({ opacity: '1', transition: 'none' });
        };
    }

    function buildMeta(movie) {
        var parts = [];
        parts.push(movie.name ? 'Серіал' : 'Фільм');
        if (movie.genres && movie.genres.length) {
            for (var i = 0; i < Math.min(movie.genres.length, 3); i++) {
                if (movie.genres[i].name) parts.push(movie.genres[i].name);
            }
        }
        var year = '';
        if (movie.release_date) year = movie.release_date.substring(0, 4);
        else if (movie.first_air_date) year = movie.first_air_date.substring(0, 4);
        if (year) parts.push(year);
        return parts.join(' · ');
    }

    function initHeroProcessor() {
        if (window.__nfx_hero_bound) return;
        window.__nfx_hero_bound = true;

        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            var movie = e.data.movie;
            var type = movie.name ? 'tv' : 'movie';
            var render = e.object.activity.render();
            var titleElem = render.find('.full-start-new__title');
            var domTitle = titleElem[0];

            if (!titleElem.length) return;

            titleElem.css({ opacity: '1', transition: 'none' });

            var lang = LogoEngine._getLang();
            var cacheKey = LogoEngine._key(type, movie.id, lang);
            var cached = LogoEngine._getCached(cacheKey);

            if (cached && cached !== 'none') {
                var cachedImg = new Image();
                cachedImg.src = cached;
                if (cachedImg.complete) {
                    applyLogoStyles(cachedImg);
                    titleElem.empty().append(cachedImg);
                    titleElem.css({ opacity: '1', transition: 'none' });
                    return;
                } else {
                    startLogoAnimation(cached, titleElem, domTitle);
                    return;
                }
            }

            if (cached === 'none') return;

            LogoEngine.resolve(movie, function (logoUrl) {
                if (logoUrl) startLogoAnimation(logoUrl, titleElem, domTitle);
            });
        });
    }


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 4 — CARD EDGE TAGGER  (MutationObserver)
    // ─────────────────────────────────────────────────────────────────

    function initCardProcessor() {
        if (window.__nfx_cards_bound) return;
        window.__nfx_cards_bound = true;

        function tagEdges() {
            var rows = document.querySelectorAll('.scroll__body');
            for (var r = 0; r < rows.length; r++) {
                var cards = rows[r].querySelectorAll('.card');
                if (!cards.length) continue;
                for (var c = 0; c < cards.length; c++) cards[c].removeAttribute('data-nfx-edge');
                cards[0].setAttribute('data-nfx-edge', 'first');
                cards[cards.length - 1].setAttribute('data-nfx-edge', 'last');
            }
        }

        var timer = null;
        var obs = new MutationObserver(function () {
            clearTimeout(timer);
            timer = setTimeout(tagEdges, 80);
        });
        obs.observe(document.body, { childList: true, subtree: true });
        tagEdges();
    }


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 5 — CSS  (template literal — zero-gradient minimalist)
    // ─────────────────────────────────────────────────────────────────

    function injectCSS() {
        var old = document.getElementById('nfx-premium-v71');
        if (old) old.remove();

        var css = `
/* ================================================================
   Netflix Premium Style v7.1 — Zero Gradient / Full Minimalist
   ================================================================ */

@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');

:root {
    --nfx-bg: #0a0d12;
    --nfx-accent: #e50914;
    --nfx-accent-rgb: 229, 9, 20;
    --nfx-text: #f0f0f0;
    --nfx-font: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
    --nfx-card-scale: 1.35;
    --nfx-shift: 25%;
    --nfx-duration: 420ms;
    --nfx-ease: cubic-bezier(0.4, 0, 0.2, 1);
    --nfx-radius: 8px;
    --nfx-shadow-text: 0 2px 10px rgba(0,0,0,0.8);
}

body {
    background-color: var(--nfx-bg) !important;
    font-family: var(--nfx-font) !important;
    color: var(--nfx-text) !important;
}


/* ================================================================
   1) OVERFLOW — prevent clipping of scaled cards
   ================================================================ */

.items-line__body,
.items-cards,
.scroll,
.scroll--horizontal,
.scroll__content,
.scroll__body {
    overflow: visible !important;
}

.items-line {
    overflow: visible !important;
    position: relative !important;
    z-index: 1 !important;
    padding: 45px 0 !important;
}

/* Row with a focused card sits above everything */
.items-line:has(.card.focus),
.items-line:has(.card.hover),
.items-line:has(.card:hover) {
    z-index: 50 !important;
}

/* Category titles */
.items-line__title {
    font-family: var(--nfx-font) !important;
    font-weight: 700 !important;
    font-size: 1.3em !important;
    color: var(--nfx-text) !important;
    text-shadow: var(--nfx-shadow-text) !important;
    padding-left: 4% !important;
}


/* ================================================================
   2) CARD BASE — GPU-ready, clean view (NO ghost masks)
   ================================================================ */

.card {
    position: relative !important;
    transition: transform var(--nfx-duration) var(--nfx-ease),
                z-index 0s !important;
    z-index: 1 !important;
    will-change: transform !important;
    backface-visibility: hidden !important;
    -webkit-backface-visibility: hidden !important;
    transform: translate3d(0, 0, 0) !important;
}

.card__view {
    border-radius: var(--nfx-radius) !important;
    overflow: visible !important;
    position: relative !important;
    background: #16181d !important;
    border: 2px solid transparent !important;
    transition: border-color var(--nfx-duration) var(--nfx-ease),
                box-shadow var(--nfx-duration) var(--nfx-ease) !important;
}

/* ── KILL ALL GHOST MASKS / OVERLAYS (aggressive) ── */
.card__view::after,
.card__view::before {
    display: none !important;
    content: none !important;
    background: none !important;
    background-image: none !important;
    opacity: 0 !important;
    width: 0 !important;
    height: 0 !important;
    pointer-events: none !important;
}

.card__view-shadow,
.card .card__overlay,
.card .card__gradient,
.card .card__mask,
.card .card__blackout {
    display: none !important;
    background: none !important;
    background-image: none !important;
    opacity: 0 !important;
}

/* Also ensure no filter dimming on poster */
.card .card__img,
.card.focus .card__img,
.card.hover .card__img,
.card:hover .card__img {
    filter: none !important;
    -webkit-filter: none !important;
}

.card__img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    border-radius: var(--nfx-radius) !important;
    display: block !important;
}

/* Card title below */
.card__title {
    font-family: var(--nfx-font) !important;
    font-size: 0.85em !important;
    font-weight: 600 !important;
    color: var(--nfx-text) !important;
    padding: 8px 4px 2px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    text-shadow: 0 1px 4px rgba(0,0,0,0.5) !important;
}

/* ── QUALITY BADGE — bottom-left, green, always on top ── */
.card__quality {
    display: block !important;
    position: absolute !important;
    bottom: 6px !important;
    left: 6px !important;
    top: auto !important;
    right: auto !important;
    z-index: 20 !important;
    background: rgba(46, 204, 113, 0.88) !important;
    color: #fff !important;
    padding: 2px 8px !important;
    border-radius: 4px !important;
    font-size: 0.7em !important;
    font-weight: 700 !important;
    font-family: var(--nfx-font) !important;
    text-transform: uppercase !important;
    letter-spacing: 0.03em !important;
    line-height: 1.4 !important;
    pointer-events: none !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
}

/* ── RATING BADGE — bottom-right, "leaf" shape ── */
.card__vote {
    display: block !important;
    position: absolute !important;
    bottom: 6px !important;
    right: 6px !important;
    top: auto !important;
    left: auto !important;
    z-index: 20 !important;
    background: rgba(46, 204, 113, 0.9) !important;
    color: #fff !important;
    padding: 2px 8px !important;
    border-radius: 10px 0 10px 0 !important;
    font-size: 0.75em !important;
    font-weight: 800 !important;
    font-family: var(--nfx-font) !important;
    line-height: 1.4 !important;
    pointer-events: none !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
}

.card__age { display: none !important; }


/* ================================================================
   3) CARD FOCUS — clean poster + box-shadow only (NO red overlays)
   ================================================================ */

.card.focus,
.card.hover,
.card:hover {
    z-index: 100 !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
}

/* Clean high-quality shadow — NO colored border, NO red glow */
.card.focus .card__view,
.card.hover .card__view,
.card:hover .card__view {
    border-color: rgba(255,255,255,0.25) !important;
    box-shadow: 0 20px 40px rgba(0,0,0,0.6) !important;
}

/* ── NEIGHBOR SHIFTING (GPU translate3d) ── */
.card.focus ~ .card,
.card.hover ~ .card,
.card:hover ~ .card {
    transform: translate3d(var(--nfx-shift), 0, 0) !important;
    z-index: 1 !important;
}

/* ── EDGE PROTECTION ── */
.card[data-nfx-edge="first"].focus,
.card[data-nfx-edge="first"].hover,
.card[data-nfx-edge="first"]:hover,
.card:first-child.focus,
.card:first-child.hover,
.card:first-child:hover {
    transform-origin: left center !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
}

.card[data-nfx-edge="last"].focus,
.card[data-nfx-edge="last"].hover,
.card[data-nfx-edge="last"]:hover,
.card:last-child.focus,
.card:last-child.hover,
.card:last-child:hover {
    transform-origin: right center !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
}

.card.focus ~ .card[data-nfx-edge="last"],
.card.hover ~ .card[data-nfx-edge="last"],
.card:hover ~ .card[data-nfx-edge="last"],
.card.focus ~ .card:last-child,
.card.hover ~ .card:last-child,
.card:hover ~ .card:last-child {
    transform: translate3d(calc(var(--nfx-shift) * 0.5), 0, 0) !important;
}


/* ================================================================
   4) HERO — ZERO GRADIENT, 100% CLEAN BACKDROP
   ================================================================ */

/* Remove Lampa's default dark mask */
.full-start-new .full-start-new__background,
.full-start-new .full-start__background,
.full-start__background {
    mask-image: none !important;
    -webkit-mask-image: none !important;
}

/* Kill ALL overlays and gradients the app adds */
.full-start-new::before,
.full-start-new::after,
.full-start::before,
.full-start::after {
    display: none !important;
    content: none !important;
}

/* Kill the application overlay gradient */
.applecation__overlay,
.application__overlay {
    background: transparent !important;
    background-image: none !important;
    display: none !important;
}

/* Kill any leftover gradient layers */
.full-start-new__gradient,
.full-start__gradient,
.full-start-new__mask,
.full-start__mask {
    display: none !important;
    background: none !important;
}

/* Backdrop: fill viewport cleanly */
.full-start-new .full-start-new__background img,
.full-start-new .full-start__background img,
.full-start__background img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    filter: none !important;
}

/* Content: left-aligned with text-shadow for readability */
.full-start-new__body,
.full-start__body {
    position: relative !important;
    z-index: 2 !important;
    padding-left: 5% !important;
    display: flex !important;
    align-items: center !important;
}

.full-start-new__right,
.full-start__right {
    position: relative !important;
    z-index: 3 !important;
    max-width: 650px !important;
}

/* Hide default poster — we use full-bleed backdrop */
.full-start-new__left,
.full-start__left {
    display: none !important;
}

/* ── Hero Title / Logo ── */
.full-start-new__title,
.full-start__title {
    font-family: var(--nfx-font) !important;
    font-weight: 800 !important;
    font-size: 2.6em !important;
    line-height: 1.08 !important;
    color: #fff !important;
    text-shadow: var(--nfx-shadow-text),
                 0 4px 20px rgba(0,0,0,0.9) !important;
    margin-bottom: 12px !important;
}

/* ── Hero Meta ── */
.full-start-new__details,
.full-start__details {
    font-family: var(--nfx-font) !important;
    font-size: 1em !important;
    font-weight: 500 !important;
    color: rgba(255,255,255,0.85) !important;
    text-shadow: var(--nfx-shadow-text) !important;
}

.full-start-new__head,
.full-start__head {
    text-shadow: var(--nfx-shadow-text) !important;
}

.full-start-new__tagline,
.full-start__tagline {
    font-family: var(--nfx-font) !important;
    font-style: italic !important;
    color: rgba(255,255,255,0.7) !important;
    text-shadow: var(--nfx-shadow-text) !important;
}

/* ── Hero Description ── */
.full-start-new__text,
.full-start__text,
.full-start-new__description,
.full-start__description {
    font-family: var(--nfx-font) !important;
    color: rgba(255,255,255,0.8) !important;
    font-size: 0.95em !important;
    line-height: 1.55 !important;
    text-shadow: var(--nfx-shadow-text) !important;
    max-width: 550px !important;
}

/* ── Hero Rating ── */
.full-start-new__rate-line,
.full-start__rate-line {
    text-shadow: var(--nfx-shadow-text) !important;
}

/* ── Glassmorphism Buttons ── */
.full-start__button,
.full-start-new__button {
    font-family: var(--nfx-font) !important;
    font-weight: 600 !important;
    border-radius: 8px !important;
    border: 1px solid rgba(255,255,255,0.18) !important;
    background: rgba(255,255,255,0.1) !important;
    backdrop-filter: blur(15px) saturate(1.2) !important;
    -webkit-backdrop-filter: blur(15px) saturate(1.2) !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
    text-shadow: var(--nfx-shadow-text) !important;
    transition: background 300ms ease,
                transform 200ms ease,
                box-shadow 300ms ease !important;
}

.full-start__button.focus,
.full-start__button:hover,
.full-start-new__button.focus,
.full-start-new__button:hover {
    background: rgba(var(--nfx-accent-rgb), 0.85) !important;
    border-color: rgba(var(--nfx-accent-rgb), 0.9) !important;
    box-shadow: 0 8px 28px rgba(var(--nfx-accent-rgb), 0.35) !important;
    transform: scale(1.04) !important;
}


/* ================================================================
   5) SIDEBAR — Glassy blur, red left-border active item
   ================================================================ */

.menu {
    background: rgba(10, 13, 18, 0.4) !important;
    backdrop-filter: blur(25px) saturate(1.3) !important;
    -webkit-backdrop-filter: blur(25px) saturate(1.3) !important;
    border-right: 1px solid rgba(255,255,255,0.06) !important;
    border-left: none !important;
    border-top: none !important;
    border-bottom: none !important;
}

.menu__list {
    background: transparent !important;
}

/* All menu items: clean base */
.menu__item {
    border-radius: 0 !important;
    background: transparent !important;
    border-left: 4px solid transparent !important;
    transition: border-color 200ms ease, background 200ms ease !important;
}

/* Active / focused menu item: red left-border + white text */
.menu__item.focus,
.menu__item.hover,
.menu__item.traverse,
.menu__item.active {
    background: transparent !important;
    box-shadow: none !important;
    border-left: 4px solid var(--nfx-accent) !important;
}

.menu__item.focus .menu__text,
.menu__item.hover .menu__text,
.menu__item.traverse .menu__text,
.menu__item.active .menu__text {
    color: #ffffff !important;
}

.menu__text {
    font-family: var(--nfx-font) !important;
    font-weight: 500 !important;
    color: rgba(255,255,255,0.55) !important;
    transition: color 200ms ease !important;
}

.menu__ico svg {
    fill: currentColor !important;
}

/* Header bar */
.head {
    background: rgba(10, 13, 18, 0.4) !important;
    backdrop-filter: blur(25px) !important;
    -webkit-backdrop-filter: blur(25px) !important;
    border: none !important;
}


/* ================================================================
   6) SCROLLBAR — minimal
   ================================================================ */

::-webkit-scrollbar {
    width: 4px !important;
    height: 4px !important;
}
::-webkit-scrollbar-track { background: transparent !important; }
::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.1) !important;
    border-radius: 8px !important;
}
::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.22) !important;
}

.scroll__body {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
}
.scroll__body::-webkit-scrollbar { display: none !important; }


/* ================================================================
   7) RESPONSIVE
   ================================================================ */

@media (max-width: 768px) {
    .full-start-new__title, .full-start__title {
        font-size: 1.6em !important;
    }
    .full-start-new__right, .full-start__right {
        max-width: 90vw !important;
    }
    :root {
        --nfx-card-scale: 1.2;
        --nfx-shift: 14%;
    }
    .items-line {
        padding: 28px 0 !important;
    }
}
`;

        var style = document.createElement('style');
        style.id = 'nfx-premium-v71';
        style.textContent = css;
        document.head.appendChild(style);
    }


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 6 — BOOTSTRAP
    // ─────────────────────────────────────────────────────────────────

    function bootstrap() {
        if (window.__nfx_premium_v71) return;
        window.__nfx_premium_v71 = true;

        injectCSS();
        initHeroProcessor();
        initCardProcessor();

        console.log('[NFX Premium] v7.1 — Zero Gradient · Glass Sidebar · Clean Cards');
    }

    if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') bootstrap();
        });
        setTimeout(bootstrap, 800);
    } else {
        var poll = setInterval(function () {
            if (typeof Lampa !== 'undefined' && Lampa.Listener) {
                clearInterval(poll);
                Lampa.Listener.follow('app', function (e) {
                    if (e.type === 'ready') bootstrap();
                });
                setTimeout(bootstrap, 800);
            }
        }, 200);
    }

})();
