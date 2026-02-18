(function () {
    'use strict';

    // ============================================================
    //  BLOCK 1: SETTINGS
    // ============================================================
    var NFX = {
        version: '3.1.0',
        pluginName: 'Netflix Premium Style',
        debug: false,

        // --- Design Tokens ---
        colors: {
            bg: '#0a0d12',
            bgCard: '#16181d',
            surface: '#1a1c22',
            accent: '#e50914',      // Netflix red
            accentRGB: '229, 9, 20',
            text: '#e5e5e5',
            textMuted: '#808080',
            glass: 'rgba(22, 24, 29, 0.65)',
            gradientL: 'linear-gradient(90deg, #0a0d12 0%, #0a0d12 28%, transparent 70%)',
            gradientB: 'linear-gradient(0deg, #0a0d12 0%, transparent 60%)',
        },

        // --- Animation ---
        anim: {
            cardScale: 1.5,
            neighborShift: '25%',
            duration: '500ms',
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        },

        // --- Fonts ---
        fonts: {
            family: "'Montserrat', 'Helvetica Neue', Arial, sans-serif",
            logoWeight: 500,  // Medium
        },

        // --- TMDB ---
        tmdb: {
            apiKey: 'b86e03fe3535e93e01b4b0e9fc345794',
            imgBase: 'https://image.tmdb.org/t/p/',
            logoSize: 'w500',
            backdropSize: 'w1280',
            lang: 'uk-UA',
            fallbackLang: 'en-US',
            cachePrefix: 'nfx_logo_',
            maxRetries: 3,
            baseDelay: 1000, // ms — base for exponential backoff (1s, 2s, 4s)
        },

        log: function () {
            if (NFX.debug) {
                console.log.apply(console, ['[NFX]'].concat(Array.prototype.slice.call(arguments)));
            }
        },
    };


    // ============================================================
    //  BLOCK 2: LOGO MANAGER  (with exponential backoff & PNG priority)
    // ============================================================
    var LogoManager = {
        _queue: [],
        _processing: false,
        _rateLimit: 250, // ms between TMDB requests

        /**
         * Get logo URL for a movie/show. Returns cached value or fetches from TMDB.
         * @param {number|string} tmdbId
         * @param {string} mediaType – 'movie' or 'tv'
         * @param {function} callback – fn(logoUrl|null)
         */
        getLogo: function (tmdbId, mediaType, callback) {
            if (!tmdbId) { callback(null); return; }

            var cacheKey = NFX.tmdb.cachePrefix + tmdbId;
            var cached = sessionStorage.getItem(cacheKey);
            if (cached !== null) {
                callback(cached === '' ? null : cached);
                return;
            }

            this._queue.push({
                id: tmdbId,
                type: mediaType || 'movie',
                cb: callback,
                attempt: 0,
            });
            this._processQueue();
        },

        _processQueue: function () {
            if (this._processing || this._queue.length === 0) return;
            this._processing = true;

            var self = this;
            var item = this._queue.shift();

            this._fetchWithRetry(item, function (logo) {
                var cacheKey = NFX.tmdb.cachePrefix + item.id;
                sessionStorage.setItem(cacheKey, logo || '');
                item.cb(logo);

                self._processing = false;
                setTimeout(function () { self._processQueue(); }, self._rateLimit);
            });
        },

        /**
         * Fetch logo from TMDB with exponential backoff retry.
         * @param {object} item – queue item {id, type, cb, attempt}
         * @param {function} done – fn(logoUrl|null)
         */
        _fetchWithRetry: function (item, done) {
            var self = this;
            var url = 'https://api.themoviedb.org/3/' + item.type + '/' + item.id
                + '/images?api_key=' + NFX.tmdb.apiKey
                + '&include_image_language=uk,en,null';

            NFX.log('TMDB fetch attempt', item.attempt + 1, 'for', item.type, item.id);

            fetch(url)
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error('HTTP ' + response.status);
                    }
                    return response.json();
                })
                .then(function (data) {
                    var logo = self._pickBestLogo(data.logos || []);
                    done(logo);
                })
                .catch(function (err) {
                    NFX.log('TMDB fetch error:', err.message, '| attempt', item.attempt + 1);
                    item.attempt++;

                    if (item.attempt < NFX.tmdb.maxRetries) {
                        // Exponential backoff: 1s, 2s, 4s
                        var delay = NFX.tmdb.baseDelay * Math.pow(2, item.attempt - 1);
                        NFX.log('Retrying in', delay, 'ms...');
                        setTimeout(function () {
                            self._fetchWithRetry(item, done);
                        }, delay);
                    } else {
                        NFX.log('All retries exhausted for', item.type, item.id);
                        done(null);
                    }
                });
        },

        /**
         * Pick the best logo from a TMDB logos array.
         * Priority: (1) Ukrainian PNG, (2) Ukrainian any, (3) English PNG,
         *           (4) English any, (5) any PNG, (6) any logo.
         * PNG is prioritized because it's transparent (no background).
         * @param {Array} logos
         * @returns {string|null} full URL or null
         */
        _pickBestLogo: function (logos) {
            if (!logos || logos.length === 0) return null;

            // Score each logo: higher = better
            var scored = logos.map(function (l) {
                var score = 0;
                var lang = l.iso_639_1;
                var isPng = l.file_path && l.file_path.toLowerCase().endsWith('.png');

                // Language bonus
                if (lang === 'uk') score += 100;
                else if (lang === 'en') score += 50;
                else if (lang === null || lang === undefined) score += 10;

                // Format bonus: PNG = transparent logo (what we want)
                if (isPng) score += 30;

                // Higher vote_average = better quality
                if (l.vote_average) score += l.vote_average;

                // Wider logos are generally better for display
                if (l.aspect_ratio && l.aspect_ratio > 1) score += 5;

                return { logo: l, score: score };
            });

            // Sort descending by score
            scored.sort(function (a, b) { return b.score - a.score; });

            var best = scored[0].logo;
            if (best && best.file_path) {
                return NFX.tmdb.imgBase + NFX.tmdb.logoSize + best.file_path;
            }
            return null;
        },

        /**
         * Detect media type from a Lampa card object.
         * Series have 'name' + 'first_air_date', movies have 'title' + 'release_date'.
         * @param {object} card – Lampa card data
         * @returns {string} 'movie' or 'tv'
         */
        detectType: function (card) {
            if (!card) return 'movie';
            // Explicit check: if card has 'name' field → it's a TV show
            // Movies use 'title', TV uses 'name'
            if (card.name && !card.title) return 'tv';
            if (card.first_air_date) return 'tv';
            if (card.media_type === 'tv') return 'tv';
            if (card.number_of_seasons) return 'tv';
            return 'movie';
        },

        /**
         * Build a DOM element: either an <img> logo or a Montserrat text fallback.
         * @param {string|null} logoUrl
         * @param {string} title – the movie/show title for fallback
         * @returns {HTMLElement}
         */
        createLogoElement: function (logoUrl, title) {
            if (logoUrl) {
                var img = document.createElement('img');
                img.className = 'nfx-logo-img';
                img.src = logoUrl;
                img.alt = title || '';
                img.loading = 'lazy';
                img.onerror = function () {
                    // Replace with text fallback on error
                    var parent = img.parentElement;
                    if (parent) {
                        var text = LogoManager.createTextFallback(title);
                        parent.replaceChild(text, img);
                    }
                };
                return img;
            }
            return this.createTextFallback(title);
        },

        createTextFallback: function (title) {
            var el = document.createElement('span');
            el.className = 'nfx-logo-text';
            el.textContent = title || '';
            return el;
        },
    };


    // ============================================================
    //  BLOCK 3: DOM PROCESSOR  (MutationObserver + edge-card tagging)
    // ============================================================
    var DOMProcessor = {
        _observer: null,
        _cardDebounce: null,
        _heroDebounce: null,

        init: function () {
            this._observer = new MutationObserver(this._onMutations.bind(this));
            this._observer.observe(document.body, {
                childList: true,
                subtree: true,
            });
            // Process already-existing content
            this.processCards();
            this.processFullStart();
        },

        _onMutations: function (mutations) {
            var dominated = false;
            var fullStartChanged = false;

            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                for (var j = 0; j < m.addedNodes.length; j++) {
                    var node = m.addedNodes[j];
                    if (node.nodeType !== 1) continue;

                    if (node.classList && (
                        node.classList.contains('card') ||
                        node.classList.contains('items-line') ||
                        node.classList.contains('scroll__body')
                    )) {
                        dominated = true;
                    }

                    if (node.classList && (
                        node.classList.contains('full-start-new') ||
                        node.classList.contains('full-start__background') ||
                        node.classList.contains('activity')
                    )) {
                        fullStartChanged = true;
                    }

                    // Check children too
                    if (node.querySelector) {
                        if (node.querySelector('.card')) dominated = true;
                        if (node.querySelector('.full-start-new')) fullStartChanged = true;
                    }
                }
            }

            // Debounce to avoid rapid-fire processing during DOM churn
            var self = this;
            if (dominated) {
                clearTimeout(this._cardDebounce);
                this._cardDebounce = setTimeout(function () { self.processCards(); }, 50);
            }
            if (fullStartChanged) {
                clearTimeout(this._heroDebounce);
                this._heroDebounce = setTimeout(function () { self.processFullStart(); }, 100);
            }
        },

        /**
         * Process cards: mark processed, tag first/last cards in each row
         * for edge-card protection in CSS.
         */
        processCards: function () {
            // Mark unprocessed cards
            var cards = document.querySelectorAll('.card:not(.nfx-processed)');
            cards.forEach(function (card) {
                card.classList.add('nfx-processed');
            });

            // Tag first/last cards in each scroll row for edge-card protection
            var rows = document.querySelectorAll('.scroll__body.mapping--line');
            rows.forEach(function (row) {
                var rowCards = row.querySelectorAll('.card');
                if (rowCards.length === 0) return;

                // Reset all edge attributes in this row
                rowCards.forEach(function (c) { c.removeAttribute('data-nfx-edge'); });

                // Tag first and last
                rowCards[0].setAttribute('data-nfx-edge', 'first');
                rowCards[rowCards.length - 1].setAttribute('data-nfx-edge', 'last');
            });
        },

        /**
         * Process the Full Card Hero (movie detail page).
         * - Inject logo into the title area (using LogoManager.detectType)
         * - Remove dark overlay mask
         */
        processFullStart: function () {
            var fullStarts = document.querySelectorAll('.full-start-new:not(.nfx-hero-processed)');
            fullStarts.forEach(function (section) {
                section.classList.add('nfx-hero-processed');

                // --- Get TMDB ID and media type from the current Lampa activity ---
                var tmdbId = null;
                var mediaType = 'movie';
                var cardData = null;
                try {
                    var activity = Lampa.Activity.active();
                    if (activity && activity.card) {
                        cardData = activity.card;
                        tmdbId = cardData.id;
                        mediaType = LogoManager.detectType(cardData);
                    }
                } catch (e) {
                    NFX.log('Could not get activity card:', e);
                }

                // --- Inject logo ---
                var titleEl = section.querySelector('.full-start-new__title');
                var logoContainer = section.querySelector('.applecation__logo');
                var title = '';

                // Get title from card data first (more reliable), fallback to DOM
                if (cardData) {
                    title = cardData.title || cardData.name || '';
                }
                if (!title && titleEl) {
                    title = titleEl.textContent.trim();
                }

                if (tmdbId) {
                    LogoManager.getLogo(tmdbId, mediaType, function (logoUrl) {
                        // Place logo in applecation__logo container, or create one
                        var target = logoContainer || titleEl;
                        if (!target) return;

                        var logoEl = LogoManager.createLogoElement(logoUrl, title);

                        if (logoContainer) {
                            // Clear existing content and replace
                            logoContainer.innerHTML = '';
                            logoContainer.appendChild(logoEl);
                            logoContainer.classList.add('loaded', 'nfx-logo-injected');
                            // Hide the title since we have a logo
                            if (titleEl && logoUrl) titleEl.style.display = 'none';
                        } else if (titleEl) {
                            // Wrap title with our logo
                            titleEl.innerHTML = '';
                            titleEl.appendChild(logoEl);
                            titleEl.style.display = '';
                        }
                    });
                }
            });
        },
    };


    // ============================================================
    //  BLOCK 4: CSS INJECTOR
    // ============================================================
    var CSSInjector = {
        _styleId: 'nfx-premium-style',

        inject: function () {
            // Remove old style if exists
            var old = document.getElementById(this._styleId);
            if (old) old.remove();

            var style = document.createElement('style');
            style.id = this._styleId;
            style.textContent = this._buildCSS();
            document.head.appendChild(style);

            NFX.log('CSS injected v' + NFX.version);
        },

        _buildCSS: function () {
            var c = NFX.colors;
            var a = NFX.anim;
            var f = NFX.fonts;

            return `
/* =============================================================
   Netflix Premium Style v${NFX.version}
   Clean rewrite — template literal CSS
   ============================================================= */

/* --- Google Font: Montserrat --- */
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap');

/* ─── GLOBAL TOKENS ─── */
:root {
    --nfx-bg: ${c.bg};
    --nfx-bg-card: ${c.bgCard};
    --nfx-surface: ${c.surface};
    --nfx-accent: ${c.accent};
    --nfx-accent-rgb: ${c.accentRGB};
    --nfx-text: ${c.text};
    --nfx-text-muted: ${c.textMuted};

    --nfx-card-scale: ${a.cardScale};
    --nfx-shift: ${a.neighborShift};
    --nfx-dur: ${a.duration};
    --nfx-ease: ${a.easing};

    --nfx-font: ${f.family};
}

/* ─── BASE OVERRIDES ─── */
body {
    background-color: var(--nfx-bg) !important;
    font-family: var(--nfx-font) !important;
    color: var(--nfx-text) !important;
}

/* ─── CATEGORY ROW TITLES ─── */
.items-line__title {
    font-family: var(--nfx-font) !important;
    font-weight: 700 !important;
    font-size: 1.45em !important;
    color: var(--nfx-text) !important;
    letter-spacing: 0.01em !important;
    text-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
}

/* ─── HORIZONTAL ROW LAYOUT ─── */
.items-line {
    display: flex !important;
    flex-direction: column !important;
    margin-bottom: 0 !important;
}

.items-line__body {
    overflow: visible !important;
}

.items-line__body > .scroll.scroll--horizontal,
.items-line__body .scroll.scroll--horizontal {
    overflow: visible !important;
}

.scroll__body.mapping--line {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    gap: 4px !important;
    padding: 28px 4% 36px !important;
    overflow-x: auto !important;
    overflow-y: visible !important;
    scroll-snap-type: x proximity !important;
    -webkit-overflow-scrolling: touch !important;
}


/* =============================================================
   CARD BASE STYLES  (GPU-accelerated with translate3d)
   ============================================================= */
.card {
    flex-shrink: 0 !important;
    position: relative !important;
    transition: transform var(--nfx-dur) var(--nfx-ease),
                z-index 0s 0s !important;
    z-index: 1 !important;
    scroll-snap-align: start !important;
    will-change: transform !important;
    -webkit-backface-visibility: hidden !important;
    backface-visibility: hidden !important;
    transform: translate3d(0, 0, 0) !important;
}

.card__view {
    border-radius: 6px !important;
    overflow: hidden !important;
    position: relative !important;
    background: var(--nfx-bg-card) !important;
    border: 2px solid transparent !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
    transition: border-color var(--nfx-dur) var(--nfx-ease),
                box-shadow var(--nfx-dur) var(--nfx-ease) !important;
}

.card__view::after {
    content: '' !important;
    position: absolute !important;
    inset: 0 !important;
    border-radius: 6px !important;
    box-shadow: inset 0 0 0 0 transparent !important;
    transition: box-shadow var(--nfx-dur) var(--nfx-ease) !important;
    pointer-events: none !important;
    z-index: 2 !important;
}

.card__img {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    display: block !important;
}

/* Hide vote & age badges — clean look */
.card__vote,
.card__age,
.card__type,
.card__status {
    display: none !important;
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


/* =============================================================
   NEIGHBOR SHIFTING — THE NETFLIX FLOW  (GPU: translate3d)

   When a card gets focus, it scales up to 1.5x.
   All siblings AFTER the focused card shift RIGHT (+25%).
   Edge cards (first/last) are protected from shifting off-screen.

   We use translate3d() and scale3d() to ensure the browser
   promotes these elements to GPU-composited layers.
   ============================================================= */

/* Focused card: scale up, bring to front (GPU) */
.card.focus,
.card.hover,
.card:hover {
    z-index: 120 !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
}

/* Focused card border glow */
.card.focus .card__view,
.card.hover .card__view,
.card:hover .card__view {
    border-color: rgba(var(--nfx-accent-rgb), 0.85) !important;
    box-shadow: 0 16px 34px rgba(0,0,0,0.72) !important;
}

.card.focus .card__view::after,
.card.hover .card__view::after,
.card:hover .card__view::after {
    box-shadow: 0 0 0 2px rgba(var(--nfx-accent-rgb), 0.7),
                0 0 24px rgba(var(--nfx-accent-rgb), 0.4) !important;
}

/*
 * Neighbor Shifting via general sibling combinator (~):
 * .card.focus ~ .card  → all siblings AFTER focused card shift RIGHT.
 * translate3d triggers GPU compositing for smooth 60fps animation.
 */

/* All cards after the focused one → shift RIGHT (GPU) */
.card.focus ~ .card,
.card.hover ~ .card,
.card:hover ~ .card {
    transform: translate3d(var(--nfx-shift), 0, 0) !important;
    z-index: 1 !important;
}

/* Override: a focused card among shifted siblings keeps its scale */
.card.focus ~ .card.focus,
.card.hover ~ .card.hover {
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
    z-index: 120 !important;
}

/* ─── EDGE CARD PROTECTION ───
   First card: when focused, don't let LEFT neighbors shift further left
   (there are none, but the card itself shouldn't translate off the left edge).
   Last card: when it's a sibling-after, reduce shift to prevent overflow. */

/* First card in row: no left shift when focused */
.card[data-nfx-edge="first"].focus,
.card[data-nfx-edge="first"].hover,
.card[data-nfx-edge="first"]:hover {
    transform-origin: left center !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
}

/* Last card in row: when shifted by a focused sibling, use reduced shift */
.card.focus ~ .card[data-nfx-edge="last"],
.card.hover ~ .card[data-nfx-edge="last"],
.card:hover ~ .card[data-nfx-edge="last"] {
    transform: translate3d(calc(var(--nfx-shift) * 0.5), 0, 0) !important;
}

/* Last card in row: when IT is focused, grow toward the left */
.card[data-nfx-edge="last"].focus,
.card[data-nfx-edge="last"].hover,
.card[data-nfx-edge="last"]:hover {
    transform-origin: right center !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
}


/* =============================================================
   FULL CARD HERO — MOVIE DETAIL PAGE
   Full-screen backdrop, no dark mask, gradient on the left,
   large logo (or Montserrat text).
   ============================================================= */

/* Full-bleed background */
.full-start__background {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    z-index: 0 !important;
}

/* REMOVE the dark overlay mask */
.full-start__background.applecation__overlay {
    background: transparent !important;
    opacity: 0 !important;
}

/* Left gradient for text readability */
.full-start-new::before,
.full-start-new.applecation::before {
    content: '' !important;
    position: absolute !important;
    inset: 0 !important;
    background: ${c.gradientL} !important;
    pointer-events: none !important;
    z-index: 1 !important;
}

/* Bottom gradient */
.full-start-new::after,
.full-start-new.applecation::after {
    content: '' !important;
    position: absolute !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    height: 40% !important;
    background: ${c.gradientB} !important;
    pointer-events: none !important;
    z-index: 1 !important;
}

/* Content wrapper — sits above gradients */
.full-start-new__body {
    position: relative !important;
    z-index: 2 !important;
}

.full-start-new__right {
    position: relative !important;
    z-index: 3 !important;
}

/* Hide poster in the detail view — use full-bleed backdrop only */
.full-start-new__left {
    display: none !important;
}

/* ─── Logo in Hero ─── */
.applecation__logo {
    max-width: 380px !important;
    max-height: 160px !important;
    margin-bottom: 16px !important;
    position: relative !important;
    z-index: 4 !important;
}

.applecation__logo img,
.nfx-logo-img {
    max-width: 100% !important;
    max-height: 140px !important;
    object-fit: contain !important;
    object-position: left bottom !important;
    filter: drop-shadow(0 4px 24px rgba(0,0,0,0.7)) !important;
}

.nfx-logo-text {
    font-family: var(--nfx-font) !important;
    font-weight: ${f.logoWeight} !important;
    font-size: 2.8em !important;
    color: #ffffff !important;
    text-shadow: 0 4px 24px rgba(0,0,0,0.7),
                 0 2px 8px rgba(0,0,0,0.5) !important;
    line-height: 1.1 !important;
    display: block !important;
    max-width: 500px !important;
}

/* Full-start title (used when logo replaces it) */
.full-start-new__title {
    font-family: var(--nfx-font) !important;
    font-weight: 700 !important;
    font-size: 2.6em !important;
    line-height: 1.1 !important;
    color: #ffffff !important;
    text-shadow: 0 4px 24px rgba(0,0,0,0.7) !important;
}

.full-start-new__title .new-interface-full-logo {
    max-width: 380px !important;
    max-height: 140px !important;
    object-fit: contain !important;
    object-position: left bottom !important;
    filter: drop-shadow(0 4px 24px rgba(0,0,0,0.7)) !important;
}

/* Meta text */
.applecation__meta-text,
.full-start-new__details {
    font-family: var(--nfx-font) !important;
    font-size: 1em !important;
    font-weight: 500 !important;
    color: rgba(255,255,255,0.75) !important;
    letter-spacing: 0.03em !important;
    text-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
}

/* Buttons on movie page */
.full-start__button {
    font-family: var(--nfx-font) !important;
    font-weight: 600 !important;
    border-radius: 4px !important;
    transition: background var(--nfx-dur) var(--nfx-ease),
                transform 200ms var(--nfx-ease) !important;
}

.full-start__button.focus,
.full-start__button:hover {
    transform: scale(1.05) !important;
}

/* Description */
.full-start-new__text,
.full-start-new__tagline {
    font-family: var(--nfx-font) !important;
    color: rgba(255,255,255,0.72) !important;
    font-size: 0.95em !important;
    line-height: 1.5 !important;
    text-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
    max-width: 550px !important;
}

/* Rate line */
.full-start-new__rate-line {
    font-family: var(--nfx-font) !important;
}


/* =============================================================
   GLASSMORPHISM — MENUS & POPUPS
   ============================================================= */
.settings__content,
.selectbox-item,
.modal__content {
    background: var(--nfx-surface) !important;
    backdrop-filter: blur(16px) saturate(1.4) !important;
    -webkit-backdrop-filter: blur(16px) saturate(1.4) !important;
    border: 1px solid rgba(255,255,255,0.06) !important;
    border-radius: 12px !important;
}


/* =============================================================
   SCROLLBAR — THIN & DARK
   ============================================================= */
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
    background: rgba(255,255,255,0.22) !important;
}


/* =============================================================
   SMOOTH SCROLL HIDE
   ============================================================= */
.scroll__body.mapping--line {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
}
.scroll__body.mapping--line::-webkit-scrollbar {
    display: none !important;
}


/* =============================================================
   RESPONSIVE ADJUSTMENTS
   ============================================================= */
@media (max-width: 768px) {
    .nfx-logo-text {
        font-size: 1.8em !important;
    }
    .applecation__logo {
        max-width: 250px !important;
    }
    .full-start-new__title {
        font-size: 1.8em !important;
    }
}
`;
        },
    };


    // ============================================================
    //  BOOTSTRAP — wait for Lampa to be ready, then init
    // ============================================================
    function bootstrap() {
        NFX.log('Bootstrapping', NFX.pluginName, 'v' + NFX.version);
        CSSInjector.inject();
        DOMProcessor.init();
        NFX.log('Initialized successfully.');
    }

    // Lampa fires 'start' when the app is ready
    if (window.Lampa) {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') bootstrap();
        });
    } else {
        // Fallback: wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bootstrap);
        } else {
            setTimeout(bootstrap, 500);
        }
    }

})();
