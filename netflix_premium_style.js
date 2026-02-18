(function () {
    'use strict';

    /* ================================================================
     *  Netflix Premium Style v7.0  —  Clean Rewrite
     *
     *  ✦ Logo Engine    → Lampa.TMDB.api() + Lampa.TMDB.key()
     *  ✦ Animation      → GPU scale3d / translate3d neighbor shifting
     *  ✦ Hero Layout    → Full-bleed backdrop, gradient overlay, large logo
     *  ✦ Glassmorphism  → Buttons with backdrop-filter blur
     *  ✦ Font           → Montserrat everywhere
     * ================================================================ */

    // ─────────────────────────────────────────────────────────────────
    //  SECTION 1 — ANIMATION HELPERS  (from logo.js reference)
    // ─────────────────────────────────────────────────────────────────

    var FADE_OUT_TEXT = 300;   // ms — title text fades out
    var MORPH_HEIGHT = 400;   // ms — container morphs to logo height
    var FADE_IN_IMG = 400;   // ms — logo image fades in
    var SAFE_DELAY = 200;   // ms — wait before measuring DOM

    /**
     * Animate an element's height from `start` to `end` over `duration` ms.
     * Uses requestAnimationFrame with cubic ease-out.
     */
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

    /**
     * Animate an element's opacity from `start` to `end` over `duration` ms.
     */
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
    //  SECTION 2 — LOGO ENGINE  (Lampa.TMDB.api — NO hardcoded keys)
    // ─────────────────────────────────────────────────────────────────

    var LogoEngine = {
        _cachePrefix: 'nfx_logo_v7_',

        /**
         * Build a cache key for sessionStorage / Lampa.Storage.
         */
        _key: function (type, id, lang) {
            return this._cachePrefix + type + '_' + id + '_' + lang;
        },

        /**
         * Read cached logo URL.  Returns:
         *   string URL  → cached logo exists
         *   'none'      → we already know there's no logo
         *   null        → not yet cached
         */
        _getCached: function (key) {
            try {
                var s = sessionStorage.getItem(key);
                if (s) return s;
            } catch (e) { /* ignore */ }
            return Lampa.Storage.get(key, null);
        },

        /**
         * Write to both sessionStorage and Lampa.Storage.
         */
        _setCached: function (key, value) {
            var v = value || 'none';
            try { sessionStorage.setItem(key, v); } catch (e) { /* ignore */ }
            Lampa.Storage.set(key, v);
        },

        /**
         * Pick the best logo from TMDB response.
         * Priority: target_lang PNG → target_lang any → 'en' PNG → 'en' any → first PNG → first any.
         * SVGs are converted to PNG by replacing the extension.
         */
        _pickBest: function (logos, targetLang) {
            if (!logos || !logos.length) return null;

            // Sort: PNGs first (SVGs last)
            var sorted = logos.slice().sort(function (a, b) {
                var aIsSvg = (a.file_path || '').toLowerCase().endsWith('.svg');
                var bIsSvg = (b.file_path || '').toLowerCase().endsWith('.svg');
                if (aIsSvg === bIsSvg) return 0;
                return aIsSvg ? 1 : -1;
            });

            // Pass 1: target language
            for (var i = 0; i < sorted.length; i++) {
                if (sorted[i].iso_639_1 === targetLang && sorted[i].file_path) {
                    return sorted[i].file_path;
                }
            }
            // Pass 2: English
            for (var j = 0; j < sorted.length; j++) {
                if (sorted[j].iso_639_1 === 'en' && sorted[j].file_path) {
                    return sorted[j].file_path;
                }
            }
            // Pass 3: any
            if (sorted[0] && sorted[0].file_path) return sorted[0].file_path;

            return null;
        },

        /**
         * Get the user's preferred logo language (falls back to Lampa language).
         */
        _getLang: function () {
            var userLang = Lampa.Storage.get('logo_lang', '');
            return userLang || Lampa.Storage.get('language', 'uk') || 'uk';
        },

        /**
         * Resolve a logo URL for a movie/show.
         * Uses Lampa.TMDB.api() + Lampa.TMDB.key() — NO hardcoded API key.
         *
         * @param {object} movie   — Lampa movie/card data (must have .id)
         * @param {function} done  — callback(logoUrl) or callback(null)
         */
        resolve: function (movie, done) {
            if (!movie || !movie.id) { done(null); return; }

            var type = movie.name ? 'tv' : 'movie';
            var lang = this._getLang();
            var cacheKey = this._key(type, movie.id, lang);

            // 1) Check cache
            var cached = this._getCached(cacheKey);
            if (cached === 'none') { done(null); return; }
            if (cached) { done(cached); return; }

            // 2) Build TMDB URL using Lampa internal API (NO hardcoded key!)
            var url = Lampa.TMDB.api(
                type + '/' + movie.id + '/images?api_key=' + Lampa.TMDB.key() +
                '&include_image_language=' + lang + ',en,null'
            );

            var self = this;
            var size = Lampa.Storage.get('logo_size', 'original') || 'original';

            // 3) Fetch
            $.get(url, function (data_api) {
                var path = self._pickBest(data_api.logos, lang);
                if (path) {
                    // Convert SVG → PNG, build full image URL via Lampa
                    var imgUrl = Lampa.TMDB.image('/t/p/' + size + path.replace('.svg', '.png'));
                    self._setCached(cacheKey, imgUrl);
                    done(imgUrl);
                } else {
                    self._setCached(cacheKey, 'none');
                    done(null);
                }
            }).fail(function () {
                // Network error — don't cache, just fail gracefully
                done(null);
            });
        }
    };


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 3 — HERO PROCESSOR  (Full Card page — logo + layout)
    // ─────────────────────────────────────────────────────────────────

    /**
     * Apply final positioning styles to a logo <img> element.
     */
    function applyLogoStyles(img) {
        img.style.display = 'block';
        img.style.maxWidth = '500px';
        img.style.maxHeight = '250px';
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.objectFit = 'contain';
        img.style.objectPosition = 'left bottom';
        img.style.filter = 'drop-shadow(0 8px 32px rgba(0,0,0,0.7))';
        img.style.boxSizing = 'border-box';
        img.style.paddingBottom = '0.2em';
    }

    /**
     * Smooth logo animation:
     *  1. Fade out the text title
     *  2. Replace text with an <img>
     *  3. Morph container height to the image's natural height
     *  4. Fade in the logo image
     *
     * Follows the exact pattern from logo.js.
     */
    function startLogoAnimation(imgUrl, titleElem, domTitle, cacheKey) {
        var img = new Image();
        img.src = imgUrl;

        var startTextHeight = 0;
        if (domTitle) startTextHeight = domTitle.getBoundingClientRect().height;

        applyLogoStyles(img);
        img.style.opacity = '0';

        img.onload = function () {
            setTimeout(function () {
                if (domTitle) startTextHeight = domTitle.getBoundingClientRect().height;

                // Step 1: Fade out the text
                titleElem.css({
                    transition: 'opacity ' + (FADE_OUT_TEXT / 1000) + 's ease',
                    opacity: '0'
                });

                setTimeout(function () {
                    // Step 2: Replace text with logo image
                    titleElem.empty().append(img);
                    titleElem.css({ opacity: '1', transition: 'none' });

                    var targetHeight = domTitle.getBoundingClientRect().height;

                    domTitle.style.height = startTextHeight + 'px';
                    domTitle.style.display = 'block';
                    domTitle.style.overflow = 'hidden';
                    domTitle.style.boxSizing = 'border-box';

                    void domTitle.offsetHeight; // force reflow

                    // Step 3: Morph height
                    domTitle.style.transition = 'height ' + (MORPH_HEIGHT / 1000) + 's cubic-bezier(0.4, 0, 0.2, 1)';

                    requestAnimationFrame(function () {
                        domTitle.style.height = targetHeight + 'px';

                        // Step 4: Fade in the logo
                        setTimeout(function () {
                            img.style.transition = 'opacity ' + (FADE_IN_IMG / 1000) + 's ease';
                            img.style.opacity = '1';
                        }, Math.max(0, MORPH_HEIGHT - 100));

                        // Step 5: Clean up — restore natural height
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
            // Logo failed to load — keep the original text
            titleElem.css({ opacity: '1', transition: 'none' });
        };
    }

    /**
     * Build a clean metadata string: "Фільм · Драма · Трилер"
     */
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

    /**
     * Listen for Lampa's "full" event and inject the logo into the hero page.
     */
    function initHeroProcessor() {
        if (window.__nfx_hero_bound) return;
        window.__nfx_hero_bound = true;

        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            var movie = e.data.movie;
            var type = movie.name ? 'tv' : 'movie';

            // Get DOM elements from the rendered activity
            var render = e.object.activity.render();
            var titleElem = render.find('.full-start-new__title');
            var headElem = render.find('.full-start-new__head');
            var detailsElem = render.find('.full-start-new__details');
            var taglineElem = render.find('.full-start-new__tagline');
            var domTitle = titleElem[0];

            if (!titleElem.length) return;

            // ── Inject clean metadata ──
            if (detailsElem.length && !detailsElem.find('.nfx-meta').length) {
                var metaStr = buildMeta(movie);
                if (metaStr) {
                    var metaEl = $('<span class="nfx-meta">' + metaStr + '</span>');
                    metaEl.css({
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: '500',
                        fontSize: '1em',
                        color: 'rgba(255,255,255,0.72)',
                        letterSpacing: '0.04em'
                    });

                    // Move head info into details line (like logo.js does)
                    if (headElem.length && !detailsElem.find('.nfx-moved-head').length) {
                        var headContent = headElem.html();
                        if (headContent) {
                            headElem.css({ opacity: '0', transition: 'none' });
                            if (detailsElem.children().length > 0) {
                                detailsElem.append($('<span class="full-start-new__split nfx-moved-sep">●</span>'));
                            }
                            detailsElem.append($('<span class="nfx-moved-head">' + headContent + '</span>'));
                        }
                    }
                }
            }

            // ── Resolve and animate the logo ──
            titleElem.css({ opacity: '1', transition: 'none' });

            var lang = LogoEngine._getLang();
            var cacheKey = LogoEngine._key(type, movie.id, lang);
            var cached = LogoEngine._getCached(cacheKey);

            // Fast path: already cached
            if (cached && cached !== 'none') {
                var cachedImg = new Image();
                cachedImg.src = cached;

                if (cachedImg.complete) {
                    // Instant replacement (no animation needed)
                    applyLogoStyles(cachedImg);
                    titleElem.empty().append(cachedImg);
                    titleElem.css({ opacity: '1', transition: 'none' });
                    return;
                } else {
                    startLogoAnimation(cached, titleElem, domTitle, cacheKey);
                    return;
                }
            }

            // Already known: no logo available
            if (cached === 'none') return;

            // Fetch from TMDB
            LogoEngine.resolve(movie, function (logoUrl) {
                if (logoUrl) {
                    startLogoAnimation(logoUrl, titleElem, domTitle, cacheKey);
                }
            });
        });
    }


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 4 — CARD PROCESSOR  (edge tagging for CSS)
    // ─────────────────────────────────────────────────────────────────

    function initCardProcessor() {
        if (window.__nfx_cards_bound) return;
        window.__nfx_cards_bound = true;

        function tagEdgeCards() {
            var rows = document.querySelectorAll('.scroll__body');
            for (var r = 0; r < rows.length; r++) {
                var cards = rows[r].querySelectorAll('.card');
                if (cards.length === 0) continue;

                for (var c = 0; c < cards.length; c++) {
                    cards[c].removeAttribute('data-nfx-edge');
                }
                cards[0].setAttribute('data-nfx-edge', 'first');
                cards[cards.length - 1].setAttribute('data-nfx-edge', 'last');
            }
        }

        // Run on DOM changes
        var debounceTimer = null;
        var observer = new MutationObserver(function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(tagEdgeCards, 80);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Initial pass
        tagEdgeCards();
    }


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 5 — CSS INJECTOR  (template literals — zero whitespace bugs)
    // ─────────────────────────────────────────────────────────────────

    function injectCSS() {
        var old = document.getElementById('nfx-premium-v7');
        if (old) old.remove();

        var css = `
/* ================================================================
   Netflix Premium Style v7.0 — Template Literal CSS
   ================================================================ */

/* ── Google Font: Montserrat ── */
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');

/* ── Global Tokens ── */
:root {
    --nfx-bg: #0a0d12;
    --nfx-accent: #e50914;
    --nfx-accent-rgb: 229, 9, 20;
    --nfx-text: #f0f0f0;
    --nfx-font: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
    --nfx-card-scale: 1.45;
    --nfx-shift: 25%;
    --nfx-duration: 500ms;
    --nfx-ease: cubic-bezier(0.4, 0, 0.2, 1);
    --nfx-radius: 8px;
}

body {
    background-color: var(--nfx-bg) !important;
    font-family: var(--nfx-font) !important;
    color: var(--nfx-text) !important;
}


/* ================================================================
   ROW LAYOUT — overflow fix for scaled cards
   ================================================================ */

/* All parent containers: MUST be visible for scale to work */
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
}

/* Vertical padding so 1.45x scaled cards don't clip top/bottom */
.scroll__body {
    padding: 36px 0 !important;
}

/* Row with a focused card rises above other rows */
.items-line:has(.card.focus),
.items-line:has(.card.hover),
.items-line:has(.card:hover) {
    z-index: 50 !important;
}

/* Category titles */
.items-line__title {
    font-family: var(--nfx-font) !important;
    font-weight: 700 !important;
    font-size: 1.4em !important;
    color: var(--nfx-text) !important;
    letter-spacing: 0.01em !important;
    text-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
    padding-left: 4% !important;
}


/* ================================================================
   CARD BASE — GPU-ready with will-change
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
    box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
    transition: border-color var(--nfx-duration) var(--nfx-ease),
                box-shadow var(--nfx-duration) var(--nfx-ease) !important;
}

.card__img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    border-radius: var(--nfx-radius) !important;
    display: block !important;
}

/* Card title */
.card__title {
    font-family: var(--nfx-font) !important;
    font-size: 0.85em !important;
    font-weight: 600 !important;
    color: var(--nfx-text) !important;
    padding: 8px 4px 2px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    text-shadow: 0 2px 8px rgba(0,0,0,0.6) !important;
}

/* Badges: quality visible, age hidden */
.card__quality {
    display: block !important;
    position: absolute !important;
    top: 6px !important;
    right: 6px !important;
    z-index: 4 !important;
    background: rgba(var(--nfx-accent-rgb), 0.9) !important;
    color: #fff !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
    font-size: 0.7em !important;
    font-weight: 700 !important;
    font-family: var(--nfx-font) !important;
    text-transform: uppercase !important;
    letter-spacing: 0.04em !important;
    pointer-events: none !important;
    box-shadow: 0 2px 6px rgba(0,0,0,0.5) !important;
}

.card__vote {
    display: block !important;
    position: absolute !important;
    top: 6px !important;
    left: 6px !important;
    z-index: 4 !important;
    background: rgba(0,0,0,0.72) !important;
    color: #ffd700 !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
    font-size: 0.72em !important;
    font-weight: 700 !important;
    font-family: var(--nfx-font) !important;
    pointer-events: none !important;
    box-shadow: 0 2px 6px rgba(0,0,0,0.5) !important;
}

.card__age {
    display: none !important;
}


/* ================================================================
   NEIGHBOR SHIFTING — GPU translate3d + scale3d
   ================================================================ */

/* Focused card: scale up */
.card.focus,
.card.hover,
.card:hover {
    z-index: 100 !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
}

/* Focused card — glow border */
.card.focus .card__view,
.card.hover .card__view,
.card:hover .card__view {
    border-color: rgba(var(--nfx-accent-rgb), 0.75) !important;
    box-shadow: 0 16px 40px rgba(0,0,0,0.65),
                0 0 0 1px rgba(var(--nfx-accent-rgb), 0.4) !important;
}

/* Sibling cards AFTER focused → shift RIGHT */
.card.focus ~ .card,
.card.hover ~ .card,
.card:hover ~ .card {
    transform: translate3d(var(--nfx-shift), 0, 0) !important;
    z-index: 1 !important;
}

/* If a shifted sibling itself is focused, keep its scale */
.card.focus ~ .card.focus,
.card.hover ~ .card.hover {
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
    z-index: 100 !important;
}

/* ── EDGE PROTECTION ── */

/* First card: grow rightward, don't shift off-screen */
.card[data-nfx-edge="first"].focus,
.card[data-nfx-edge="first"].hover,
.card[data-nfx-edge="first"]:hover,
.card:first-child.focus,
.card:first-child.hover,
.card:first-child:hover {
    transform-origin: left center !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
}

/* Last card: grow leftward */
.card[data-nfx-edge="last"].focus,
.card[data-nfx-edge="last"].hover,
.card[data-nfx-edge="last"]:hover,
.card:last-child.focus,
.card:last-child.hover,
.card:last-child:hover {
    transform-origin: right center !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
}

/* Last card as neighbor: reduced shift to prevent overflow */
.card.focus ~ .card[data-nfx-edge="last"],
.card.hover ~ .card[data-nfx-edge="last"],
.card:hover ~ .card[data-nfx-edge="last"],
.card.focus ~ .card:last-child,
.card.hover ~ .card:last-child,
.card:hover ~ .card:last-child {
    transform: translate3d(calc(var(--nfx-shift) * 0.5), 0, 0) !important;
}


/* ================================================================
   FULL CARD HERO — Movie Detail Page
   Premium "Housemaid" layout: full-bleed backdrop + gradient + logo
   ================================================================ */

/* Remove default Lampa dark mask */
.full-start-new .full-start-new__background,
.full-start-new .full-start__background {
    mask-image: none !important;
    -webkit-mask-image: none !important;
}

/* Premium gradient overlay (left → transparent) */
.full-start-new::before {
    content: '' !important;
    position: absolute !important;
    inset: 0 !important;
    background: linear-gradient(to right,
        rgba(10,13,18,0.98) 0%,
        rgba(10,13,18,0.4) 40%,
        transparent 85%) !important;
    pointer-events: none !important;
    z-index: 1 !important;
}

/* Bottom gradient for blend into background */
.full-start-new::after {
    content: '' !important;
    position: absolute !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    height: 35% !important;
    background: linear-gradient(0deg, var(--nfx-bg) 0%, transparent 100%) !important;
    pointer-events: none !important;
    z-index: 1 !important;
}

/* Content block above gradients — left-aligned */
.full-start-new__body {
    position: relative !important;
    z-index: 2 !important;
    padding-left: 5% !important;
    display: flex !important;
    align-items: center !important;
}

.full-start-new__right {
    position: relative !important;
    z-index: 3 !important;
    max-width: 650px !important;
}

/* Hide left poster area — using full-bleed backdrop */
.full-start-new__left {
    display: none !important;
}

/* Background fills the whole viewport */
.full-start-new .full-start-new__background img,
.full-start-new .full-start__background img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
}

/* ── Hero Title / Logo ── */
.full-start-new__title {
    font-family: var(--nfx-font) !important;
    font-weight: 800 !important;
    font-size: 2.8em !important;
    line-height: 1.08 !important;
    color: #fff !important;
    text-shadow: 0 4px 24px rgba(0,0,0,0.7) !important;
    margin-bottom: 12px !important;
}

/* Title styling when text fallback is used */
.full-start-new__title .nfx-text-logo {
    font-family: var(--nfx-font) !important;
    font-weight: 700 !important;
    font-size: 1em !important;
    line-height: 1.08 !important;
    color: #ffffff !important;
    text-shadow: 0 4px 24px rgba(0,0,0,0.7),
                 0 2px 8px rgba(0,0,0,0.5) !important;
}

/* ── Hero Meta ── */
.full-start-new__details {
    font-family: var(--nfx-font) !important;
    font-size: 1em !important;
    font-weight: 500 !important;
    color: rgba(255,255,255,0.72) !important;
    letter-spacing: 0.03em !important;
    text-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
}

.full-start-new__tagline {
    font-family: var(--nfx-font) !important;
    font-style: italic !important;
    color: rgba(255,255,255,0.58) !important;
    font-size: 0.95em !important;
    text-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
}

/* ── Hero Description ── */
.full-start-new__text {
    font-family: var(--nfx-font) !important;
    color: rgba(255,255,255,0.72) !important;
    font-size: 0.95em !important;
    line-height: 1.55 !important;
    text-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
    max-width: 550px !important;
}

/* ── Hero Rate ── */
.full-start-new__rate-line {
    font-family: var(--nfx-font) !important;
}

/* ── Glassmorphism Buttons ── */
.full-start__button,
.full-start-new__button {
    font-family: var(--nfx-font) !important;
    font-weight: 600 !important;
    border-radius: 8px !important;
    border: 1px solid rgba(255,255,255,0.15) !important;
    background: rgba(255,255,255,0.08) !important;
    backdrop-filter: blur(15px) saturate(1.2) !important;
    -webkit-backdrop-filter: blur(15px) saturate(1.2) !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
    transition: background 300ms ease, transform 200ms ease, box-shadow 300ms ease !important;
}

.full-start__button.focus,
.full-start__button:hover,
.full-start-new__button.focus,
.full-start-new__button:hover {
    background: rgba(var(--nfx-accent-rgb), 0.85) !important;
    border-color: rgba(var(--nfx-accent-rgb), 0.9) !important;
    box-shadow: 0 0 0 1px rgba(var(--nfx-accent-rgb), 0.6),
                0 12px 32px rgba(var(--nfx-accent-rgb), 0.3) !important;
    transform: scale(1.04) !important;
}


/* ================================================================
   GLASSMORPHISM — Menus, Popups, Settings
   ================================================================ */

.settings__content,
.selectbox-item,
.modal__content {
    background: rgba(22, 24, 29, 0.75) !important;
    backdrop-filter: blur(16px) saturate(1.4) !important;
    -webkit-backdrop-filter: blur(16px) saturate(1.4) !important;
    border: 1px solid rgba(255,255,255,0.06) !important;
    border-radius: 12px !important;
}

.menu, .menu__list, .head {
    background: linear-gradient(135deg, rgba(12,15,22,0.82), rgba(9,12,18,0.64)) !important;
    border: 1px solid rgba(255,255,255,0.06) !important;
    backdrop-filter: blur(18px) saturate(1.2) !important;
    -webkit-backdrop-filter: blur(18px) saturate(1.2) !important;
}

.menu__item.focus,
.menu__item.hover,
.menu__item.traverse {
    background: linear-gradient(110deg, rgba(var(--nfx-accent-rgb),0.3), rgba(var(--nfx-accent-rgb),0.1)) !important;
    box-shadow: 0 0 0 1px rgba(var(--nfx-accent-rgb), 0.35) !important;
    border-radius: 10px !important;
}


/* ================================================================
   SCROLLBAR — thin & dark
   ================================================================ */

::-webkit-scrollbar {
    width: 5px !important;
    height: 5px !important;
}
::-webkit-scrollbar-track {
    background: transparent !important;
}
::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.12) !important;
    border-radius: 10px !important;
}
::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.25) !important;
}

/* Hide scrollbar in card rows */
.scroll__body {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
}
.scroll__body::-webkit-scrollbar {
    display: none !important;
}


/* ================================================================
   RESPONSIVE
   ================================================================ */

@media (max-width: 768px) {
    .full-start-new__title {
        font-size: 1.8em !important;
    }
    .full-start-new__right {
        max-width: 90vw !important;
    }
    :root {
        --nfx-card-scale: 1.25;
        --nfx-shift: 15%;
    }
}
`;

        var style = document.createElement('style');
        style.id = 'nfx-premium-v7';
        style.textContent = css;
        document.head.appendChild(style);
    }


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 6 — BOOTSTRAP
    // ─────────────────────────────────────────────────────────────────

    function bootstrap() {
        if (window.__nfx_premium_v7) return;
        window.__nfx_premium_v7 = true;

        injectCSS();
        initHeroProcessor();
        initCardProcessor();

        console.log('[NFX Premium] v7.0 — Montserrat · Lampa TMDB · GPU Animations');
    }

    // Wait for Lampa to be ready
    if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') bootstrap();
        });
        // Also try immediately in case 'ready' already fired
        setTimeout(bootstrap, 800);
    } else {
        // Fallback: poll for Lampa
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
