(function () {
    'use strict';

    /* ================================================================
     *  Netflix Premium Style v8.0  —  Multi-screen, Custom UI
     *
     *  ✦ Logo Engine    → Lampa.TMDB.api() + Lampa.TMDB.key()
     *  ✦ Hero           → Clean backdrop, NO gradients, text-shadow only
     *  ✦ Sidebar        → Glassy blur, red left-border active item
     *  ✦ Cards          → No ghost masks, clean box-shadow, multi-scale
     *  ✦ GPU            → translate3d / scale3d everywhere (60fps optimized)
     *  ✦ Multi-screen   → Native support for Phones, Tablets, TVs, and 4K
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
        var logoH = Lampa.Storage.get('nfx_logo_height', '250px');
        img.style.display = 'block';
        img.style.maxWidth = '100%';
        img.style.maxHeight = logoH;
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

        // ── Suppress auto-focus scaling until user interacts ──
        function enableInteraction() {
            document.body.classList.add('nfx-user-interacted');
            document.removeEventListener('keydown', enableInteraction);
            document.removeEventListener('pointerdown', enableInteraction);
            document.removeEventListener('mousedown', enableInteraction);
        }
        document.addEventListener('keydown', enableInteraction, { once: true });
        document.addEventListener('pointerdown', enableInteraction, { once: true });
        document.addEventListener('mousedown', enableInteraction, { once: true });

        function tagEdges() {
            var rows = document.querySelectorAll('.scroll__body');
            for (var r = 0; r < rows.length; r++) {
                var cards = rows[r].querySelectorAll('.card');
                if (!cards.length) continue;
                for (var c = 0; c < cards.length; c++) {
                    cards[c].removeAttribute('data-nfx-edge');
                    cards[c].removeAttribute('data-nfx-single');
                }
                if (cards.length === 1) {
                    cards[0].setAttribute('data-nfx-single', 'true');
                } else {
                    cards[0].setAttribute('data-nfx-edge', 'first');
                    cards[cards.length - 1].setAttribute('data-nfx-edge', 'last');
                }
            }
        }

        // ── Dynamic rating badge colors ──
        function colorizeRatings() {
            var badges = document.querySelectorAll('.card__vote');
            for (var i = 0; i < badges.length; i++) {
                var el = badges[i];
                if (el.getAttribute('data-nfx-colored')) continue;
                var text = (el.textContent || el.innerText || '').replace(',', '.').trim();
                var val = parseFloat(text);
                if (isNaN(val)) continue;
                var color;
                if (val >= 7.5) color = '#2ecc71'; // green
                else if (val >= 6.5) color = '#f1c40f'; // yellow
                else if (val >= 5.0) color = '#e67e22'; // orange
                else color = 'var(--nfx-accent)'; // red
                el.style.setProperty('background', color, 'important');
                el.setAttribute('data-nfx-colored', '1');
            }
        }

        var timer = null;
        var obs = new MutationObserver(function () {
            clearTimeout(timer);
            timer = setTimeout(function () {
                tagEdges();
                colorizeRatings();
            }, 80);
        });
        obs.observe(document.body, { childList: true, subtree: true });
        tagEdges();
        colorizeRatings();
    }


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 5 — CSS  (template literal — zero-gradient minimalist)
    // ─────────────────────────────────────────────────────────────────

    function injectCSS() {
        var old = document.getElementById('nfx-premium-v8');
        if (old) old.remove();

        var accent = Lampa.Storage.get('nfx_accent_color', '#e50914');
        var fontFam = Lampa.Storage.get('nfx_font_family', 'Montserrat');
        var fontSb = Lampa.Storage.get('nfx_font_size_sidebar', '1.1em');
        var scale = Lampa.Storage.get('nfx_card_scale', '1.35');
        var shift = Lampa.Storage.get('nfx_edge_shift', '20px');
        var logoH = Lampa.Storage.get('nfx_logo_height', '250px');
        var blur = Lampa.Storage.get('nfx_backdrop_blur', '30px');

        function hexToRgb(h) {
            var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
            return r ? parseInt(r[1], 16) + ',' + parseInt(r[2], 16) + ',' + parseInt(r[3], 16) : '229, 9, 20';
        }
        var accentRgb = hexToRgb(accent);
        var fontImport = '@import url("https://fonts.googleapis.com/css2?family=' + fontFam.replace(/ /g, '+') + ':wght@400;500;600;700;800;900&display=swap");';

        var css = `
/* ================================================================
   Netflix Premium Style v8.0 — UI Customization
   ================================================================ */

${fontImport}

:root {
    --nfx-bg: #0a0d12;
    --nfx-accent: ${accent};
    --nfx-accent-rgb: ${accentRgb};
    --nfx-accent-gl: rgba(${accentRgb}, 0.5);
    --nfx-accent-bg: rgba(${accentRgb}, 0.7);
    --nfx-text: #f0f0f0;
    --nfx-font: '${fontFam}', 'Helvetica Neue', Arial, sans-serif;
    --nfx-sb-font-size: ${fontSb};
    --nfx-card-scale: ${scale};
    --nfx-shift: 25%;
    --nfx-edge-nudge: ${shift};
    --nfx-sb-blur: ${blur};
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

/* ── RATING BADGE — bottom-right, "leaf" shape, color set by JS ── */
.card__vote {
    display: block !important;
    position: absolute !important;
    bottom: 6px !important;
    right: 6px !important;
    top: auto !important;
    left: auto !important;
    z-index: 20 !important;
    background: rgba(120, 120, 120, 0.6) !important;
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
   3) CARD FOCUS — clean poster + red glow (NO overlays)
   ================================================================ */

/* ── Suppress auto-focus until user interaction ── */
body:not(.nfx-user-interacted) .card.focus,
body:not(.nfx-user-interacted) .card.hover {
    transform: translate3d(0, 0, 0) !important;
    z-index: 1 !important;
}

body:not(.nfx-user-interacted) .card.focus .card__view,
body:not(.nfx-user-interacted) .card.hover .card__view {
    border-color: transparent !important;
    box-shadow: none !important;
}

body:not(.nfx-user-interacted) .card.focus ~ .card,
body:not(.nfx-user-interacted) .card.hover ~ .card {
    transform: translate3d(0, 0, 0) !important;
}

/* All cards: center origin, uniform easing */
.card {
    transform-origin: center center !important;
}

.card.focus,
.card.hover,
.card:hover {
    z-index: 100 !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
}

/* Focused card — subtle red glow + clean shadow */
.card.focus .card__view,
.card.hover .card__view,
.card:hover .card__view {
    border-color: transparent !important;
    box-shadow: 0 0 20px var(--nfx-accent-gl),
               0 20px 40px rgba(0,0,0,0.6) !important;
}

/* ── NEIGHBOR SHIFTING (GPU translate3d) ── */
.card.focus ~ .card,
.card.hover ~ .card,
.card:hover ~ .card {
    transform: translate3d(var(--nfx-shift), 0, 0) !important;
    z-index: 1 !important;
}

/* ── EDGE CARDS: origin + translate3d offset to prevent clipping ── */

/* First card: left-origin scale + 20px rightward nudge (no clip) */
.card[data-nfx-edge="first"].focus,
.card[data-nfx-edge="first"].hover,
.card[data-nfx-edge="first"]:hover {
    transform-origin: left center !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1)
               translate3d(var(--nfx-edge-nudge), 0, 0) !important;
}

/* First card's neighbors: standard shift + extra 20px to compensate */
.card[data-nfx-edge="first"].focus ~ .card,
.card[data-nfx-edge="first"].hover ~ .card,
.card[data-nfx-edge="first"]:hover ~ .card {
    transform: translate3d(calc(var(--nfx-shift) + var(--nfx-edge-nudge)), 0, 0) !important;
}

/* Last card: right-origin scale + 20px leftward nudge (no clip) */
.card[data-nfx-edge="last"].focus,
.card[data-nfx-edge="last"].hover,
.card[data-nfx-edge="last"]:hover {
    transform-origin: right center !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1)
               translate3d(calc(var(--nfx-edge-nudge) * -1), 0, 0) !important;
}

/* Reduce shift for the last card when a non-edge sibling is focused */
.card.focus ~ .card[data-nfx-edge="last"],
.card.hover ~ .card[data-nfx-edge="last"],
.card:hover ~ .card[data-nfx-edge="last"] {
    transform: translate3d(calc(var(--nfx-shift) * 0.5), 0, 0) !important;
}

/* ── SINGLE CARD: use left-origin (no clip) but NO shift ── */
.card[data-nfx-single="true"].focus,
.card[data-nfx-single="true"].hover,
.card[data-nfx-single="true"]:hover {
    transform-origin: left center !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
}


/* ================================================================
   4) HERO — FULLSCREEN BACKDROP, ZERO OVERLAYS
   ================================================================ */

/* ── Backdrop: 100% fullscreen, no mask, no margins ── */
.full-start-new,
.full-start {
    position: relative !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
}

.full-start-new .full-start-new__background,
.full-start-new .full-start__background,
.full-start__background {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    mask-image: none !important;
    -webkit-mask-image: none !important;
}

.full-start-new .full-start-new__background img,
.full-start-new .full-start__background img,
.full-start__background img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    filter: none !important;
}

/* ── Kill ALL overlays, gradients, masks ── */
.full-start-new::before,
.full-start-new::after,
.full-start::before,
.full-start::after {
    display: none !important;
    content: none !important;
}

/* The main culprit: applecation__overlay has a linear-gradient */
.applecation__overlay,
.application__overlay {
    background: none !important;
    background-color: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
}

.full-start-new__gradient,
.full-start__gradient,
.full-start-new__mask,
.full-start__mask {
    display: none !important;
    background: none !important;
}

/* ── Kill ALL rectangular masks behind logo / title / content ── */
.full-start-new__title,
.full-start__title,
.applecation__logo,
.applecation__left,
.applecation__right,
.applecation__content-wrapper,
.applecation__meta,
.applecation__ratings,
.full-start-new__head,
.full-start__head,
.full-start-new__details,
.full-start__details {
    background: none !important;
    background-color: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
}

/* Kill pseudo-elements on title / logo containers */
.full-start-new__title::before,
.full-start-new__title::after,
.full-start__title::before,
.full-start__title::after,
.applecation__logo::before,
.applecation__logo::after,
.applecation__left::before,
.applecation__left::after,
.applecation__content-wrapper::before,
.applecation__content-wrapper::after,
.full-start-new__right::before,
.full-start-new__right::after,
.full-start__right::before,
.full-start__right::after,
.full-start-new__body::before,
.full-start-new__body::after,
.full-start__body::before,
.full-start__body::after {
    display: none !important;
    content: none !important;
    background: none !important;
}

/* Ensure the background image container works in older templates */
.full-start__background.applecation__overlay {
    display: block !important;
    opacity: 1 !important;
}

/* ── HIDE REACTIONS (Pink zone) ── */
.full-start-new__reactions,
.full-start__reactions {
    display: none !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
}

/* ── Content: left-aligned, bottom-weighted ── */
.full-start-new__body,
.full-start__body {
    position: relative !important;
    z-index: 2 !important;
    padding-left: 5% !important;
    display: flex !important;
    align-items: flex-end !important;
    min-height: 80vh !important;
    padding-bottom: 2em !important;
    background: none !important;
}

.full-start-new__right,
.full-start__right {
    position: relative !important;
    z-index: 3 !important;
    max-width: 650px !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-start !important;
    justify-content: flex-end !important;
    gap: 0 !important;
    background: none !important;
}

/* Hide default poster — full-bleed backdrop instead */
.full-start-new__left,
.full-start__left {
    display: none !important;
}

/* ── Hero Title / Logo — NO background, only text-shadow ── */
.full-start-new__title,
.full-start__title {
    font-family: var(--nfx-font) !important;
    font-weight: 800 !important;
    font-size: 2.6em !important;
    line-height: 1.08 !important;
    color: #fff !important;
    text-shadow: 0 2px 10px rgba(0,0,0,0.7),
                 0 6px 24px rgba(0,0,0,0.8) !important;
    margin-bottom: 8px !important;
    background: none !important;
    background-color: transparent !important;
    box-shadow: none !important;
    max-width: 100% !important;
}

/* Logo images: drop-shadow for contrast, NO rectangular mask */
.full-start-new__title img,
.full-start__title img,
.applecation__logo img,
.new-interface-full-logo {
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5)) drop-shadow(0 2px 4px rgba(0,0,0,0.4)) !important;
    background: none !important;
    box-shadow: none !important;
    max-width: 100% !important;
}

/* ── Compact Metadata Block (moved from blue → pink zone) ── */

/* Head line (year, country) */
.full-start-new__head,
.full-start__head {
    font-family: var(--nfx-font) !important;
    font-weight: 500 !important;
    font-size: 0.85em !important;
    line-height: 1.3 !important;
    color: rgba(255,255,255,0.75) !important;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
    margin: 0 0 2px 0 !important;
}

/* Tagline (quote) */
.full-start-new__tagline,
.full-start__tagline {
    font-family: var(--nfx-font) !important;
    font-weight: 500 !important;
    font-style: italic !important;
    font-size: 0.88em !important;
    line-height: 1.3 !important;
    color: rgba(255,255,255,0.65) !important;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
    margin: 0 0 4px 0 !important;
    padding: 0 !important;
}

/* Ratings (TMDB / KP) */
.full-start-new__rate-line,
.full-start__rate-line {
    font-family: var(--nfx-font) !important;
    font-weight: 500 !important;
    font-size: 0.82em !important;
    line-height: 1.3 !important;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
    margin: 0 0 2px 0 !important;
}

/* Details (genres, quality, etc.) */
.full-start-new__details,
.full-start__details {
    font-family: var(--nfx-font) !important;
    font-weight: 500 !important;
    font-size: 0.82em !important;
    line-height: 1.3 !important;
    color: rgba(255,255,255,0.72) !important;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
    margin: 0 0 2px 0 !important;
}

/* Description text */
.full-start-new__text,
.full-start__text,
.full-start-new__description,
.full-start__description {
    font-family: var(--nfx-font) !important;
    font-weight: 500 !important;
    color: rgba(255,255,255,0.72) !important;
    font-size: 0.85em !important;
    line-height: 1.4 !important;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
    max-width: 520px !important;
    margin: 0 0 6px 0 !important;
}

/* ── Premium Buttons ── */

/* Inactive buttons: grayish semi-transparent glass */
.full-start__button,
.full-start-new__button {
    font-family: var(--nfx-font) !important;
    font-weight: 600 !important;
    border-radius: 8px !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    background: rgba(120, 120, 120, 0.2) !important;
    backdrop-filter: blur(10px) !important;
    -webkit-backdrop-filter: blur(10px) !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3) !important;
    color: rgba(255,255,255,0.8) !important;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
    transition: background 300ms ease,
                transform 200ms ease,
                box-shadow 300ms ease,
                border-color 300ms ease !important;
}

/* Active/focused button: tinted red glass, pure white text */
.full-start__button.focus,
.full-start__button:hover,
.full-start-new__button.focus,
.full-start-new__button:hover {
    background: var(--nfx-accent-bg) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border: 1px solid rgba(255,255,255,0.3) !important;
    color: #ffffff !important;
    box-shadow: 0 0 20px var(--nfx-accent-gl),
               0 8px 28px rgba(0,0,0,0.4) !important;
    transform: scale(1.04) !important;
}

/* Ensure button text/icons are always white when focused */
.full-start__button.focus *,
.full-start__button:hover *,
.full-start-new__button.focus *,
.full-start-new__button:hover * {
    color: #ffffff !important;
    fill: #ffffff !important;
}


/* ================================================================
   5) SIDEBAR — Dark gloss glassmorphism, optimized for long text
   ================================================================ */

/* Container: dark glossy glass, full-height coverage */
.menu {
    background: rgba(10, 13, 18, 0.45) !important;
    backdrop-filter: blur(var(--nfx-sb-blur)) saturate(150%) !important;
    -webkit-backdrop-filter: blur(var(--nfx-sb-blur)) saturate(150%) !important;
    border-right: 1px solid rgba(255,255,255,0.08) !important;
    border-left: none !important;
    border-top: none !important;
    border-bottom: none !important;
    min-width: 14em !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
}

.menu__list {
    background: transparent !important;
    padding: 0 !important;
}

/* ── Menu Items: geometry & text fit ── */
.menu__item {
    border-radius: 0 !important;
    background: rgba(255, 255, 255, 0.04) !important;
    border-left: 3px solid transparent !important;
    padding: 0.55em 1.4em 0.55em 1em !important;
    margin: 0 !important;
    transition: border-color 200ms ease,
                background 200ms ease !important;
    display: flex !important;
    align-items: center !important;
    gap: 0.7em !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
}

/* ── Active / focused: 3px red line + subtle white glass ── */
.menu__item.focus,
.menu__item.hover,
.menu__item.traverse,
.menu__item.active {
    background: rgba(255, 255, 255, 0.1) !important;
    box-shadow: none !important;
    border-left: 3px solid var(--nfx-accent) !important;
}

/* Active text: pure white */
.menu__item.focus .menu__text,
.menu__item.hover .menu__text,
.menu__item.traverse .menu__text,
.menu__item.active .menu__text {
    color: #ffffff !important;
    text-shadow: 0 1px 3px rgba(0,0,0,0.6) !important;
}

/* Active icons: pure white */
.menu__item.focus .menu__ico,
.menu__item.hover .menu__ico,
.menu__item.traverse .menu__ico,
.menu__item.active .menu__ico {
    color: #ffffff !important;
}

.menu__item.focus .menu__ico svg,
.menu__item.hover .menu__ico svg,
.menu__item.traverse .menu__ico svg,
.menu__item.active .menu__ico svg {
    fill: #ffffff !important;
}

/* ── Inactive text: muted with subtle shadow ── */
.menu__text {
    font-family: var(--nfx-font) !important;
    font-weight: 500 !important;
    font-size: var(--nfx-sb-font-size) !important;
    color: rgba(255,255,255,0.5) !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5) !important;
    transition: color 200ms ease !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    line-height: 1.3 !important;
}

/* ── Icons: slightly smaller ── */
.menu__ico {
    color: rgba(255,255,255,0.5) !important;
    transition: color 200ms ease !important;
    flex-shrink: 0 !important;
    width: 1.1em !important;
    height: 1.1em !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
}

.menu__ico svg {
    fill: rgba(255,255,255,0.5) !important;
    transition: fill 200ms ease !important;
    width: 1.1em !important;
    height: 1.1em !important;
}

/* Header bar — 100% transparent */
.head {
    background: transparent !important;
    background-color: transparent !important;
    background-image: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border: none !important;
    box-shadow: none !important;
}

.head__actions {
    text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
}

.head__button,
.head .button {
    text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
}


/* ================================================================
   6) SCROLLING & GPU HARDWARE ACCELERATION
   ================================================================ */

/* Hardware acceleration for ultra smooth scrolling on TV/Mobile */
.scroll__body, .scroll__content, .items-line__body, .menu__list {
    will-change: transform, scroll-position !important;
    -webkit-backface-visibility: hidden !important;
    backface-visibility: hidden !important;
    -webkit-perspective: 1000 !important;
    perspective: 1000 !important;
    transform-style: preserve-3d !important;
    scroll-behavior: smooth !important;
    -webkit-overflow-scrolling: touch !important;
}

::-webkit-scrollbar {
    width: 4px !important;
    height: 4px !important;
}
::-webkit-scrollbar-track { background: transparent !important; }
::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15) !important;
    border-radius: 8px !important;
}
::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.3) !important;
}

.scroll__body {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
}
.scroll__body::-webkit-scrollbar { display: none !important; }


/* ================================================================
   7) RESPONSIVE & MULTI-SCREEN
   ================================================================ */

/* MOBILE (Phones: up to 576px) */
@media (max-width: 576px) {
    .full-start-new__title, .full-start__title {
        font-size: 1.5em !important;
        margin-bottom: 4px !important;
    }
    .full-start-new__title img, .full-start__title img, .applecation__logo img {
        max-height: 130px !important;
        max-width: 100% !important;
    }
    .full-start-new__right, .full-start__right {
        max-width: 94vw !important;
        padding-bottom: 0.5em !important;
    }
    .full-start-new__body, .full-start__body {
        min-height: 65vh !important;
        padding-left: 2% !important;
    }
    :root {
        --nfx-card-scale: 1.1;
        --nfx-shift: 8%;
        --nfx-duration: 300ms;
    }
    .items-line {
        padding: 16px 0 !important;
    }
    .menu {
        min-width: 12em !important;
    }
}

/* TABLET & SMALL TV (577px to 1024px) */
@media (min-width: 577px) and (max-width: 1024px) {
    .full-start-new__title, .full-start__title {
        font-size: 1.9em !important;
    }
    .full-start-new__right, .full-start__right {
        max-width: 85vw !important;
    }
    :root {
        --nfx-card-scale: 1.25;
        --nfx-shift: 18%;
        --nfx-duration: 350ms;
    }
    .items-line {
        padding: 30px 0 !important;
    }
}

/* TV & DESKTOP (1025px and up) */
/* Default :root uses 1.35x and 25% shift for this range */
@media (min-width: 1025px) {
    .full-start-new__title, .full-start__title {
        font-size: 2.8em !important;
        margin-bottom: 12px !important;
    }
    .full-start-new__right, .full-start__right {
        max-width: 650px !important;
    }
    .items-line {
        padding: 45px 0 !important;
    }
}

/* 4K TV (1920px and up) */
@media (min-width: 1920px) {
    .full-start-new__title, .full-start__title {
        font-size: 3.8em !important;
    }
    .full-start-new__right, .full-start__right {
        max-width: 1000px !important;
    }
    :root {
        --nfx-card-scale: 1.45;
        --nfx-shift: 30%;
        --nfx-duration: 450ms;
    }
    .items-line {
        padding: 60px 0 !important;
    }
    .card__view {
        border-radius: calc(var(--nfx-radius) * 1.5) !important;
    }
}
`;

        var style = document.createElement('style');
        style.id = 'nfx-premium-v8';
        style.textContent = css;
        document.head.appendChild(style);
    }


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 6 — SETTINGS & BOOTSTRAP
    // ─────────────────────────────────────────────────────────────────

    function initSettings() {
        if (!window.Lampa || !Lampa.SettingsApi) return;

        Lampa.SettingsApi.addComponent({
            component: 'nfx_premium',
            name: 'Premium Style',
            icon: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>'
        });

        var prm = [
            { name: 'nfx_accent_color', type: 'select', values: { '#e50914': 'Netflix Red', '#2ecc71': 'Green', '#3498db': 'Blue', '#e67e22': 'Orange', '#9b59b6': 'Purple', '#e91e63': 'Pink' }, default: '#e50914', title: 'Accent Color' },
            { name: 'nfx_font_family', type: 'select', values: { 'Montserrat': 'Montserrat', 'Roboto': 'Roboto', 'Open Sans': 'Open Sans', 'Inter': 'Inter' }, default: 'Montserrat', title: 'Font Family' },
            { name: 'nfx_font_size_sidebar', type: 'select', values: { '0.9em': 'Small', '1.0em': 'Normal', '1.1em': 'Large', '1.2em': 'Extra Large' }, default: '1.1em', title: 'Sidebar Font Size' },
            { name: 'nfx_card_scale', type: 'select', values: { '1.1': '1.10x', '1.25': '1.25x', '1.35': '1.35x (Default)', '1.45': '1.45x' }, default: '1.35', title: 'Card Focus Scale Factor' },
            { name: 'nfx_edge_shift', type: 'select', values: { '10px': '10px', '20px': '20px', '30px': '30px' }, default: '20px', title: 'Edge Shift Nudge (px)' },
            { name: 'nfx_logo_height', type: 'select', values: { '150px': 'Small', '200px': 'Medium', '250px': 'Large' }, default: '250px', title: 'Logo Max-Height' },
            { name: 'nfx_backdrop_blur', type: 'select', values: { '10px': 'Light', '30px': 'Premium', '50px': 'Heavy' }, default: '30px', title: 'Sidebar Backdrop Blur' }
        ];

        prm.forEach(function (p) {
            var paramConfig = { name: p.name, type: p.type, default: p.default };
            if (p.values) paramConfig.values = p.values;

            Lampa.SettingsApi.addParam({
                component: 'nfx_premium',
                param: paramConfig,
                field: { name: p.title },
                onChange: function () { injectCSS(); }
            });
        });
    }

    function bootstrap() {
        if (window.__nfx_premium_v8) return;
        window.__nfx_premium_v8 = true;

        initSettings();
        injectCSS();
        initHeroProcessor();
        initCardProcessor();

        if (window.Lampa && Lampa.Storage && Lampa.Storage.listener) {
            Lampa.Storage.listener.follow('change', function (e) {
                if (e.name && e.name.indexOf('nfx_') === 0) {
                    injectCSS();
                }
            });
        }

        console.log('[NFX Premium] v8.0 — Multi-screen · Custom UI · Clean Cards');
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
