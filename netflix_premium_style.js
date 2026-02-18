(function () {
    'use strict';

    /*
       NETFLIX PREMIUM STYLE v7.2 (Ultimate Build)
       ----------------------------------------------------
       • Architecture: Zero-Gradient / Minimalist / GPU-Optimized
       • Performance:  will-change, contain:layout, debounced observers
       • Layout:       Fullscreen Backdrop, Glass Sidebar, Dynamic Badges
       • Fixes:        Single card clipping, First card edge shift, scale origin
    */

    // ─────────────────────────────────────────────────────────────────
    //  SECTION 1 — SETTINGS & UTILS
    // ─────────────────────────────────────────────────────────────────

    var NFX = {
        version: '7.2.0',
        cardScale: 1.35,
        shift: '25%', // desktop
        shiftMobile: '14%',
        animDuration: '300ms',
        animEase: 'cubic-bezier(0.4, 0, 0.2, 1)', // Smooth refined bezier
        tmdb_api: 'https://api.themoviedb.org/3'
    };

    // Load Montserrat font (Premium feel)
    var fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    // ─────────────────────────────────────────────────────────────────
    //  SECTION 2 — HERO PROCESSOR (Logo & Backdrop)
    // ─────────────────────────────────────────────────────────────────

    function initHeroProcessor() {
        if (window.__nfx_hero_bound) return;
        window.__nfx_hero_bound = true;

        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.addedNodes.length) {
                    var heroDetails = document.querySelector('.full-start-new__details');
                    var heroTitle = document.querySelector('.full-start-new__title'); // or title img

                    // Move "Head" (year/country) into Details for compact layout
                    var headBlock = document.querySelector('.full-start-new__head');
                    if (heroDetails && headBlock && !heroDetails.contains(headBlock)) {
                        // Prepend head block to details
                        heroDetails.insertBefore(headBlock, heroDetails.firstChild);
                    }

                    // Ensure high-res logo if using img
                    if (heroTitle) {
                        var img = heroTitle.querySelector('img');
                        if (img && img.src && img.src.indexOf('w500') > -1) {
                            img.src = img.src.replace('w500', 'original');
                        }
                    }
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ─────────────────────────────────────────────────────────────────
    //  SECTION 3 — CARD PROCESSOR (Edges, Ratings, Focus Logic)
    // ─────────────────────────────────────────────────────────────────

    function initCardProcessor() {
        if (window.__nfx_cards_bound) return;
        window.__nfx_cards_bound = true;

        // ── 1. Suppress auto-focus scaling until user interacts ──
        // This prevents the "First Card" from popping out on page load
        function enableInteraction() {
            document.body.classList.add('nfx-user-interacted');
            // Remove listeners once triggered
            ['keydown', 'pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach(function (evt) {
                document.removeEventListener(evt, enableInteraction);
            });
        }
        ['keydown', 'pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach(function (evt) {
            document.addEventListener(evt, enableInteraction, { once: true });
        });

        // ── 2. Tag Edge Cards & Single Cards ──
        function tagEdges() {
            // "contain: layout" optimization is applied in CSS to .items-line
            var rows = document.querySelectorAll('.scroll__body');

            for (var r = 0; r < rows.length; r++) {
                var cards = rows[r].querySelectorAll('.card');
                if (!cards.length) continue;

                // Reset attributes
                for (var c = 0; c < cards.length; c++) {
                    cards[c].removeAttribute('data-nfx-edge');
                    cards[c].removeAttribute('data-nfx-single');
                }

                // Logic: Single OR First/Last
                if (cards.length === 1) {
                    cards[0].setAttribute('data-nfx-single', 'true');
                } else {
                    cards[0].setAttribute('data-nfx-edge', 'first');
                    cards[cards.length - 1].setAttribute('data-nfx-edge', 'last');
                }
            }
        }

        // ── 3. Dynamic Rating Colors (Leaf Badge) ──
        function colorizeRatings() {
            var badges = document.querySelectorAll('.card__vote');
            for (var i = 0; i < badges.length; i++) {
                var el = badges[i];
                // Optimization: skip if already colored
                if (el.hasAttribute('data-nfx-colored')) continue;

                var text = (el.textContent || el.innerText || '').replace(',', '.').trim();
                var val = parseFloat(text);

                if (isNaN(val)) continue;

                var color = '#e50914'; // default red (<5)
                if (val >= 7.5) color = '#2ecc71'; // Green (High)
                else if (val >= 6.5) color = '#f1c40f'; // Yellow (Good)
                else if (val >= 5.0) color = '#e67e22'; // Orange (Mid)

                el.style.setProperty('background', color, 'important');
                el.setAttribute('data-nfx-colored', 'true');
            }
        }

        // ── 4. Debounced Mutation Observer (Performance) ──
        var timer = null;
        var obs = new MutationObserver(function () {
            if (timer) clearTimeout(timer);
            // 30ms debounce for high performance responsiveness
            timer = setTimeout(function () {
                tagEdges();
                colorizeRatings();
            }, 30);
        });

        // Observe only childList/subtree to catch new rows/cards
        obs.observe(document.body, { childList: true, subtree: true });

        // Initial run
        tagEdges();
        colorizeRatings();
    }


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 4 — CSS INJECTION (Variables & Styles)
    // ─────────────────────────────────────────────────────────────────

    function injectCSS() {
        var styleId = 'nfx-premium-style-v72';
        var old = document.getElementById(styleId);
        if (old) old.remove();

        var css = `
/* ================================================================
   Netflix Premium Style v7.2 — Ultimate Build
   ================================================================ */

:root {
    --nfx-card-scale: ${NFX.cardScale};
    --nfx-duration: ${NFX.animDuration};
    --nfx-ease: ${NFX.animEase};
    --nfx-shift: ${NFX.shift};
    --nfx-font: 'Montserrat', sans-serif;
    --nfx-shadow-text: 0 2px 4px rgba(0,0,0,0.5);
}

@media screen and (max-width: 768px) {
    :root { --nfx-shift: ${NFX.shiftMobile}; }
}

/* Performance: Contain Layout to prevent reflows */
.items-line {
    contain: layout style;
}

/* ================================================================
   1) SIDEBAR — Dark Gloss Glass, 1.1em Font
   ================================================================ */

.menu {
    background: rgba(10, 13, 18, 0.45) !important;
    backdrop-filter: blur(30px) saturate(150%) !important;
    -webkit-backdrop-filter: blur(30px) saturate(150%) !important;
    border-right: 1px solid rgba(255,255,255,0.08) !important;
    min-width: 15em !important; /* increased for comfort */
    overflow-x: hidden !important;
}

.menu__item {
    border-radius: 0 !important;
    background: rgba(255, 255, 255, 0.04) !important;
    border-left: 3px solid transparent !important;
    padding: 0.6em 1.4em 0.6em 1.1em !important;
    margin: 1px 0 !important;
    transition: border-color 200ms ease, background 200ms ease !important;
    display: flex !important;
    align-items: center !important;
    gap: 0.8em !important;
    will-change: transform, background;
}

/* Active State: 3px Red Line + White Glow */
.menu__item.focus,
.menu__item.hover,
.menu__item.active {
    background: rgba(255, 255, 255, 0.1) !important;
    border-left: 3px solid #e50914 !important;
}

/* Text Sizing & Shadow */
.menu__text {
    font-family: var(--nfx-font) !important;
    font-weight: 500 !important;
    font-size: 1.1em !important;
    color: rgba(255,255,255,0.5) !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5) !important;
    white-space: nowrap !important;
    transition: color 200ms ease !important;
}

.menu__item.focus .menu__text, 
.menu__item.hover .menu__text, 
.menu__item.active .menu__text {
    color: #ffffff !important;
    text-shadow: 0 1px 4px rgba(0,0,0,0.8) !important;
}

/* Icons */
.menu__ico { 
    width: 1.1em; height: 1.1em; 
    color: rgba(255,255,255,0.5) !important; 
}
.menu__item.focus .menu__ico, 
.menu__item.active .menu__ico { 
    color: #ffffff !important; 
}
.menu__ico svg { width: 100%; height: 100%; fill: currentColor !important; }


/* ================================================================
   2) CARD STYLES — GPU Optimized, Dynamic Scaling
   ================================================================ */

.card {
    transform-origin: center center !important;
    transition: transform var(--nfx-duration) var(--nfx-ease),
                z-index 0s !important;
    z-index: 1 !important;
    will-change: transform !important;
    backface-visibility: hidden !important;
    perspective: 1000px !important;
}

/* View Container (Poster) — Clean, NO overlays */
.card__view {
    border-radius: 8px !important;
    overflow: visible !important;
    background: #16181d !important;
    border: 2px solid transparent !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
    transition: box-shadow var(--nfx-duration) var(--nfx-ease) !important;
}

/* Kill all Ghost Elements */
.card__view::after, .card__view::before,
.card__view-shadow, .card__overlay,
.card__img::after, .card__img::before {
    display: none !important;
    content: none !important;
    background: none !important;
}

/* ── SUPPRESS AUTO-FOCUS ON PAGE LOAD ── */
/* Until user interacts, focused cards look normal (no scale) */
body:not(.nfx-user-interacted) .card.focus, 
body:not(.nfx-user-interacted) .card.hover {
    transform: translate3d(0, 0, 0) !important;
    z-index: 1 !important;
}
body:not(.nfx-user-interacted) .card.focus .card__view {
    box-shadow: none !important;
    border-color: transparent !important;
}
body:not(.nfx-user-interacted) .card.focus ~ .card {
    transform: translate3d(0, 0, 0) !important;
}

/* ── NORMAL INTERACTIVE FOCUS ── */

/* Focused state: Scale 1.35x */
.card.focus,
.card.hover,
.card:hover {
    z-index: 100 !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
}

/* Glow Shadow */
.card.focus .card__view,
.card.hover .card__view {
    border-color: transparent !important;
    box-shadow: 0 0 20px rgba(229, 9, 20, 0.5), /* Red Tint Glow */
                0 20px 40px rgba(0,0,0,0.7) !important;
}

/* Neighbor Shift (Netflix Flow) */
.card.focus ~ .card,
.card.hover ~ .card {
    transform: translate3d(var(--nfx-shift), 0, 0) !important;
    z-index: 1 !important;
}

/* ── EDGE LOGIC: FIRST CARD ── */
/* Scale from LEFT edge + Translate RIGHT 20px to avoid clipping */
.card[data-nfx-edge="first"].focus,
.card[data-nfx-edge="first"].hover {
    transform-origin: left center !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) 
               translate3d(20px, 0, 0) !important;
}
/* Neighbors of first card need extra shift to compensate */
.card[data-nfx-edge="first"].focus ~ .card {
    transform: translate3d(calc(var(--nfx-shift) + 20px), 0, 0) !important;
}

/* ── EDGE LOGIC: LAST CARD ── */
/* Scale from RIGHT edge + Translate LEFT 20px */
.card[data-nfx-edge="last"].focus,
.card[data-nfx-edge="last"].hover {
    transform-origin: right center !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) 
               translate3d(-20px, 0, 0) !important;
}
/* Reduced shift for last card if sibling focuses it */
.card.focus ~ .card[data-nfx-edge="last"] {
    transform: translate3d(calc(var(--nfx-shift) * 0.5), 0, 0) !important;
}

/* ── SINGLE CARD (row length = 1) ── */
/* Grow rightward (safe) but NO translate shift */
.card[data-nfx-single="true"].focus,
.card[data-nfx-single="true"].hover {
    transform-origin: left center !important;
    transform: scale3d(var(--nfx-card-scale), var(--nfx-card-scale), 1) !important;
}


/* ================================================================
   3) BADGES — Leaf Shape, Dynamic Color
   ================================================================ */
.card__vote {
    position: absolute !important;
    right: 6px !important; bottom: 6px !important; left: auto !important; top: auto !important;
    z-index: 20 !important;
    padding: 2px 8px !important;
    border-radius: 10px 0 10px 0 !important; /* Leaf shape */
    font-size: 0.75em !important;
    font-weight: 800 !important;
    font-family: var(--nfx-font) !important;
    color: #fff !important;
    box-shadow: 0 2px 6px rgba(0,0,0,0.5) !important;
    /* Background color set by JS colorizeRatings(), fallback gray */
    background: rgba(120,120,120,0.6); 
    will-change: background;
}
.card__age { display: none !important; }


/* ================================================================
   4) HERO — Fullscreen, Transparent, No Masks
   ================================================================ */

/* Backdrop Container */
.full-start-new, .full-start {
    position: relative !important; margin: 0 !important; padding: 0 !important;
    overflow: hidden !important;
}
.full-start-new .full-start-new__background, 
.full-start__background {
    position: absolute !important; top: 0; left: 0; width: 100%; height: 100%;
    mask-image: none !important; -webkit-mask-image: none !important;
}
.full-start-new__background img, 
.full-start__background img {
    width: 100% !important; height: 100% !important;
    object-fit: cover !important;
}

/* Kill Gradient Overlays */
.full-start-new::before, .full-start-new::after,
.applecation__overlay, .application__overlay,
.full-start-new__gradient, .full-start-new__mask {
    display: none !important; background: none !important;
}

/* Remove Rectangular Masks on Text/Logo */
.full-start-new__title, .applecation__logo, 
.applecation__content-wrapper, .full-start-new__body {
    background: none !important;
    box-shadow: none !important;
}
/* Revert any pseudo-bg injection */
.full-start-new__title::before, .full-start-new__title::after { 
    display: none !important; 
}

/* Layout: Bottom-Left Alignment */
.full-start-new__body {
    position: relative !important; z-index: 2 !important;
    padding-left: 5% !important; padding-bottom: 2em !important;
    min-height: 80vh !important;
    display: flex !important; align-items: flex-end !important;
}
.full-start-new__left { display: none !important; } /* Hide poster */

/* Title / Logo Logic */
.full-start-new__title {
    font-family: var(--nfx-font) !important;
    font-weight: 800 !important;
    font-size: 2.8em !important;
    color: #fff !important;
    text-shadow: 0 2px 10px rgba(0,0,0,0.7) !important;
    margin-bottom: 12px !important;
}
.full-start-new__title img, .applecation__logo img {
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.6)) !important;
}

/* Hide Reactions (Pink Zone) */
.full-start-new__reactions { display: none !important; }

/* Metadata (Compact) */
.full-start-new__details, .full-start-new__head,
.full-start-new__tagline, .full-start-new__text {
    font-family: var(--nfx-font) !important;
    text-shadow: 0 1px 3px rgba(0,0,0,0.8) !important;
    color: rgba(255,255,255,0.9) !important;
    max-width: 600px !important;
}

/* Header (Transparent) */
.head {
    background: transparent !important;
    backdrop-filter: none !important;
    box-shadow: none !important;
    border: none !important;
}


/* ================================================================
   5) BUTTONS — Glassmorphism
   ================================================================ */
.full-start__button, .full-start-new__button {
    font-family: var(--nfx-font) !important;
    border-radius: 8px !important;
    background: rgba(120, 120, 120, 0.2) !important;
    backdrop-filter: blur(10px) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    color: #fff !important;
    will-change: transform, background;
    transition: transform 0.2s, background 0.3s !important;
}
.full-start__button.focus, .full-start__button:hover,
.full-start-new__button.focus, .full-start-new__button:hover {
    background: rgba(229, 9, 20, 0.75) !important;
    border: 1px solid rgba(255,255,255,0.4) !important;
    transform: scale(1.05) !important;
    box-shadow: 0 8px 25px rgba(229, 9, 20, 0.4) !important;
}

`;

        var style = document.createElement('style');
        style.id = styleId;
        style.type = 'text/css';
        style.innerHTML = css;
        document.head.appendChild(style);
    }


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 5 — BOOTSTRAP (Loader)
    // ─────────────────────────────────────────────────────────────────

    function bootstrap() {
        if (window.__nfx_premium_v72) return;
        window.__nfx_premium_v72 = true;

        injectCSS();
        initHeroProcessor();
        initCardProcessor();

        console.log('[NFX Premium] v7.2 — Ultimate Build Loaded');
    }

    if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') bootstrap();
        });
        setTimeout(bootstrap, 500); // Fast load
    } else {
        // Fallback polling for Lampa object
        var poll = setInterval(function () {
            if (typeof Lampa !== 'undefined' && Lampa.Listener) {
                clearInterval(poll);
                bootstrap();
            }
        }, 100);
    }

})();
