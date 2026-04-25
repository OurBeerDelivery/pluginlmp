(function () {
    'use strict';

    var isExoticOS = /Vidaa|Web0S|Tizen|SmartTV|Metrological|NetCast/i.test(navigator.userAgent);

    /* ================================================================
     *  NTFLX Premium Style v9.0  —  Cinematic, Ultra-Premium UI
     *
     *  ✦ Logo Engine    → Lampa.TMDB.api() + Lampa.TMDB.key()
     *  ✦ Hero           → Deep fog, glassmorphic buttons, 900-weight typography
     *  ✦ Sidebar        → Sliding active indicator, deep saturation glass
     *  ✦ Cards          → Modern pill-badges, refined scale transitions
     *  ✦ GPU            → optimized for 120Hz (ProMotion / Fluid)
     *  ✦ Compatibility  → Full support for Android TV, WebOS, Tizen, Mobile
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
        _cachePrefix: 'ntflx_logo_v7_',

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

            // 1. Direct match
            for (var i = 0; i < sorted.length; i++) {
                if (sorted[i].iso_639_1 === targetLang && sorted[i].file_path) return sorted[i].file_path;
            }

            // 2. Ukrainian Fallback -> Russian
            if (targetLang === 'uk' || targetLang === 'ua') {
                for (var r = 0; r < sorted.length; r++) {
                    if (sorted[r].iso_639_1 === 'ru' && sorted[r].file_path) return sorted[r].file_path;
                }
            }

            // 3. Fallback -> English
            for (var j = 0; j < sorted.length; j++) {
                if (sorted[j].iso_639_1 === 'en' && sorted[j].file_path) return sorted[j].file_path;
            }

            // 4. Any
            return sorted[0] && sorted[0].file_path ? sorted[0].file_path : null;
        },

        _getLang: function () {
            var manual = Lampa.Storage.get('ntflx_logo_lang', 'auto');
            if (manual && manual !== 'auto') return manual;
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
                '&include_image_language=' + lang + ',ru,en,null'
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
        var logoH = Lampa.Storage.get('ntflx_logo_height', '200px');
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
        if (window.__ntflx_hero_bound) return;
        window.__ntflx_hero_bound = true;

        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            var movie = e.data.movie;
            var type = movie.name ? 'tv' : 'movie';
            var render = e.object.activity.render();
            var titleElem = render.find('.full-start-new__title');
            var domTitle = titleElem[0];

            if (!titleElem.length) return;

            titleElem.css({ opacity: '1', transition: 'none' });

            // ── Mobile Hero Background (CSS Variable) ──
            var bgUrl = '';
            if (movie.backdrop_path) {
                bgUrl = Lampa.TMDB.image('t/p/original' + movie.backdrop_path);
            } else if (movie.poster_path) {
                bgUrl = Lampa.TMDB.image('t/p/w780' + movie.poster_path);
            } else if (movie.img) {
                bgUrl = movie.img;
            } else {
                var fallbackImg = render.find('.full-start-new__left img, .full-start__left img');
                if (fallbackImg.length) bgUrl = fallbackImg.attr('src');
            }

            if (bgUrl && domTitle) {
                render[0].style.setProperty('--ntflx-mobile-bg', 'url(' + bgUrl + ')');
            }

            // ── Inject "About" Button for Description ──
            var btnsParams = render.find('.full-start-new__buttons, .full-start__buttons');
            if (btnsParams.length && !render.find('.ntflx-desc-btn').length) {
                var langUi = Lampa.Storage.get('language') || 'uk';
                var i18n = {
                    'uk': {
                        about_movie: 'Про фільм', about_tv: 'Про серіал',
                        details: 'Детальна Інформація', desc_empty: 'Опис відсутній',
                        release: 'Дата релізу', rating: 'Рейтинг', genres: 'Жанри',
                        countries: 'Країни', cast: 'У ролях', loading: 'Завантаження...',
                        duration: 'Тривалість', min: 'хв.', state: 'Статус',
                        orig_lang: 'Мова оригіналу', budget: 'Бюджет', revenue: 'Касові збори',
                        studio: 'Студія', director: 'Режисер', keywords: 'Теги'
                    },
                    'ru': {
                        about_movie: 'О фильме', about_tv: 'О сериале',
                        details: 'Подробная Информация', desc_empty: 'Описание отсутствует',
                        release: 'Дата релиза', rating: 'Рейтинг', genres: 'Жанры',
                        countries: 'Страны', cast: 'В ролях', loading: 'Загрузка...',
                        duration: 'Продолжительность', min: 'мин.', state: 'Статус',
                        orig_lang: 'Язык оригинала', budget: 'Бюджет', revenue: 'Кассовые сборы',
                        studio: 'Студия', director: 'Режиссёр', keywords: 'Теги'
                    },
                    'en': {
                        about_movie: 'About Movie', about_tv: 'About Show',
                        details: 'Detailed Information', desc_empty: 'No description',
                        release: 'Release Date', rating: 'Rating', genres: 'Genres',
                        countries: 'Countries', cast: 'Top Cast', loading: 'Loading...',
                        duration: 'Duration', min: 'min.', state: 'Status',
                        orig_lang: 'Original Language', budget: 'Budget', revenue: 'Revenue',
                        studio: 'Studio', director: 'Director', keywords: 'Keywords'
                    }
                };
                var t = i18n[langUi] || i18n['uk'];

                var btnText = type === 'tv' ? t.about_tv : t.about_movie;
                var btnSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>';
                var descBtn = $('<div class="full-start__button selector ntflx-desc-btn" style="display:inline-flex; align-items:center;">' + btnSvg + '<div>' + btnText + '</div></div>');
                
                descBtn.css({'margin-left': '0.5em'});

                var _overlayOpen = false;
                descBtn.on('click hover:enter', function(e) {
                    if (_overlayOpen) return;
                    _overlayOpen = true;
                    e.stopPropagation && e.stopPropagation();
                    var overlay = $('<div class="ntflx-overlay" style="position:fixed; top:0; left:0; right:0; bottom:0; z-index:100; background: rgba(7,9,12,0.98); backdrop-filter: blur(50px); -webkit-backdrop-filter: blur(50px); overflow-y: auto; overflow-x: hidden; padding: 5vh 5vw; display:flex; flex-direction:column; align-items:center; scroll-behavior: smooth;"></div>');
                    
                    var closeBtn = $('<div class="selector" style="position:absolute; top: 5vh; right: 5vw; cursor:pointer; color:#fff; padding:12px; border-radius:50%; transition: all 0.3s;"><svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></div>');
                    var isClosing = false;
                    var closeUI = function(e) {
                        if (isClosing) return;
                        isClosing = true;
                        if (e && e.stopPropagation) e.stopPropagation();
                        
                        overlay.remove();
                        _overlayOpen = false;
                        
                        // Clean up controller
                        if (Lampa.Controller.remove) Lampa.Controller.remove('ntflx_details');
                        else if (Lampa.Controller.controllers) delete Lampa.Controller.controllers['ntflx_details'];
                        
                        // Return focus to the details page
                        setTimeout(function() {
                            Lampa.Controller.toggle('full');
                        }, 50);
                    };
                    closeBtn.on('hover:enter click', closeUI);
                    
                    var container = $('<div style="max-width: 1000px; width: 100%; display:flex; flex-direction:column; gap: 3em; padding-top: 2em;"></div>');
                    var headerBlock = $('<div style="text-align:center; min-height:140px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:0.8em; margin-bottom: 1em;"></div>');
                    var logoWrap = $('<div style="display:flex; justify-content:center; align-items:flex-end; max-height:160px; width:100%;"></div>');
                    var titleFallback = $('<h2 style="font-size: clamp(2.5em, 6vw, 4.5em); font-weight:900; line-height:0.95; margin:0; letter-spacing:-0.04em; text-transform:uppercase; max-width: 800px;">' + (movie.title || movie.name) + '</h2>');
                    logoWrap.append(titleFallback);
                    var detailsLabel = $('<div style="color:var(--ntflx-accent); font-size:13px; font-weight:900; text-transform:uppercase; letter-spacing:0.25em; opacity: 0.9;">' + t.details + '</div>');
                    headerBlock.append(logoWrap).append(detailsLabel);
                    container.append(headerBlock);

                    // Fetch logo
                    var logoLang = langUi === 'uk' ? 'uk' : (langUi === 'ru' ? 'ru' : 'en');
                    var imagesUrl = Lampa.TMDB.api(type + '/' + movie.id + '/images?api_key=' + Lampa.TMDB.key() + '&include_image_language=' + logoLang + ',ru,en,null');
                    $.get(imagesUrl, function(imgData) {
                        var logos = imgData.logos || [];
                        logos.sort(function(a, b) {
                            var la = (a.iso_639_1 === logoLang) ? 2 : (a.iso_639_1 === 'en') ? 1 : 0;
                            var lb = (b.iso_639_1 === logoLang) ? 2 : (b.iso_639_1 === 'en') ? 1 : 0;
                            return lb !== la ? lb - la : (b.vote_average || 0) - (a.vote_average || 0);
                        });
                        if (logos.length) {
                            var imgUrl = Lampa.TMDB.image('t/p/w500' + logos[0].file_path.replace('.svg', '.png'));
                            var logoImg = $('<img>').attr('src', imgUrl).css({ maxHeight: '130px', maxWidth: '100%', objectFit: 'contain', filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.5))', opacity: 0, transition: 'opacity 0.4s' });
                            logoImg.on('load', function() { titleFallback.remove(); logoImg.css('opacity', 1); });
                            logoWrap.empty().append(logoImg);
                        }
                    });

                    var grid = $('<div style="display:flex; gap: 4em; flex-wrap: wrap;"></div>');
                    var leftCol = $('<div style="flex: 2; min-width: 320px; display:flex; flex-direction:column; gap: 2.5em;"></div>');
                    if (movie.overview) leftCol.append($('<div>').css({fontSize:'1.2em', fontWeight:400, lineHeight:1.7, color:'rgba(255,255,255,0.8)'}).text(movie.overview));
                    
                    var metaGrid = $('<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 2em;"></div>');
                    var addMeta = function(label, val, isHtml) {
                        if (!val) return;
                        var wrap = $('<div></div>');
                        wrap.append($('<div>').css({fontSize:'0.65em', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:'0.5em', fontWeight:900}).text(label));
                        var valEl = $('<div>').css({fontSize:'1.1em', fontWeight:600, color:'#fff'});
                        if (isHtml) valEl.html(val); else valEl.text(val);
                        wrap.append(valEl);
                        metaGrid.append(wrap);
                    };

                    addMeta(t.release, movie.release_date || movie.first_air_date);
                    if (movie.vote_average) {
                        var val = movie.vote_average.toFixed(1);
                        var stars = '';
                        var filled = Math.round(movie.vote_average / 2);
                        for (var s = 0; s < 5; s++) {
                            if (s < filled) stars += '★';
                            else stars += '<span style="opacity: 0.25;">★</span>';
                        }
                        addMeta(t.rating, '<span style="font-weight:900; color:var(--ntflx-accent); font-size: 1.2em;">' + val + '</span> <span style="color:#e5b109; margin-left:10px; letter-spacing: 2px;">' + stars + '</span>', true);
                    }
                    addMeta(t.duration, movie.runtime ? movie.runtime + ' ' + t.min : '');
                    addMeta(t.genres, movie.genres ? movie.genres.map(function(g){return g.name;}).join(', ') : '');
                    leftCol.append(metaGrid);

                    var rightCol = $('<div style="flex: 1; min-width: 250px; display:flex; flex-direction:column; gap: 1.5em;"></div>');
                    rightCol.append($('<div>').css({fontSize:'0.65em', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.15em', fontWeight:900}).text(t.cast));
                    var castWrap = $('<div style="display:flex; flex-direction:column; gap: 1em;"></div>');
                    rightCol.append(castWrap);

                    var creditsUrl = Lampa.TMDB.api(type + '/' + movie.id + '/credits?api_key=' + Lampa.TMDB.key() + '&language=' + langUi);
                    $.get(creditsUrl, function(data) {
                        if (data.cast) data.cast.slice(0, 6).forEach(function(actor) {
                            var row = $('<div style="display:flex; align-items:center; gap:1em;"></div>');
                            var img = $('<div style="width:44px; height:44px; border-radius:50%; background:#222; overflow:hidden; flex-shrink:0; border:1px solid rgba(255,255,255,0.1);"></div>');
                            if (actor.profile_path) img.append($('<img>').attr('src', Lampa.TMDB.image('t/p/w185' + actor.profile_path)).css({width:'100%', height:'100%', objectFit:'cover'}));
                            row.append(img).append($('<div>').append($('<div style="font-weight:600; font-size:0.95em;">' + actor.name + '</div>')).append($('<div style="font-size:0.75em; color:rgba(255,255,255,0.5);">' + (actor.character || '') + '</div>')));
                            castWrap.append(row);
                        });
                    });

                    grid.append(leftCol).append(rightCol);
                    container.append(grid);
                    overlay.append(closeBtn).append(container);
                    $('body').append(overlay);

                    // TV Remote Spatial Navigation logic
                    Lampa.Controller.add('ntflx_details', {
                        toggle: function () { Lampa.Controller.collectionSet(overlay); Lampa.Controller.collectionFocus(closeBtn[0], overlay); },
                        up: function() { 
                            var currentScroll = overlay.scrollTop();
                            if (currentScroll > 50) {
                                overlay[0].scrollBy({ top: -300, behavior: 'smooth' });
                            } else {
                                overlay[0].scrollTo({ top: 0, behavior: 'smooth' });
                                Lampa.Controller.collectionFocus(closeBtn[0], overlay);
                            }
                        },
                        down: function() {
                            var currentScroll = overlay.scrollTop();
                            var maxScroll = overlay[0].scrollHeight - overlay.height();
                            if (currentScroll < maxScroll - 10) {
                                overlay[0].scrollBy({ top: 300, behavior: 'smooth' });
                            }
                        },
                        right: function() { /* Trap focus */ },
                        left: function() { /* Trap focus */ },
                        back: closeUI
                    });
                    Lampa.Controller.toggle('ntflx_details');
                });
                btnsParams.append(descBtn);
            }

            // ── DOM Cleanup Logic ──
            var ntflxCleanDOM = function() {
                var unwanted = [
                    '.full-start-new__details', '.full-start__details',
                    '.full-start-new__reactions', '.full-start__reactions',
                    '.full-start-new__text', '.full-start__text',
                    '.full-start-new__description', '.full-start__description',
                    '.full-start-new__tagline', '.full-start__tagline',
                    '.full-start-new__rate-line', '.full-start__rate-line'
                ];
                render.find(unwanted.join(', ')).remove();
            };
            ntflxCleanDOM();
            var observer = new MutationObserver(ntflxCleanDOM);
            observer.observe(render[0], { childList: true, subtree: true });

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
            LogoEngine.resolve(movie, function (logoUrl) { if (logoUrl) startLogoAnimation(logoUrl, titleElem, domTitle); });
        });
    }


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 4 — CARD EDGE TAGGER  (MutationObserver)
    // ─────────────────────────────────────────────────────────────────

    function initCardProcessor() {
        if (window.__ntflx_cards_bound) return;
        window.__ntflx_cards_bound = true;

        // ── Suppress auto-focus scaling until user interacts ──
        // (Supports D-pad, Magic Remote, and standard mouse)
        function enableInteraction() {
            document.body.classList.add('ntflx-user-interacted');
            document.removeEventListener('keydown', enableInteraction);
            document.removeEventListener('pointerdown', enableInteraction);
            document.removeEventListener('mousedown', enableInteraction);
            document.removeEventListener('mousemove', enableInteraction);
            document.removeEventListener('wheel', enableInteraction);
        }
        document.addEventListener('keydown', enableInteraction, { once: true });
        document.addEventListener('pointerdown', enableInteraction, { once: true });
        document.addEventListener('mousedown', enableInteraction, { once: true });
        document.addEventListener('mousemove', enableInteraction, { once: true });
        document.addEventListener('wheel', enableInteraction, { once: true });

        function tagEdges() {
            var rows = document.querySelectorAll('.scroll__body');
            for (var r = 0; r < rows.length; r++) {
                var cards = rows[r].querySelectorAll('.card');
                if (!cards.length) continue;
                for (var c = 0; c < cards.length; c++) {
                    cards[c].removeAttribute('data-ntflx-edge');
                    cards[c].removeAttribute('data-ntflx-single');
                }
                if (cards.length === 1) {
                    cards[0].setAttribute('data-ntflx-single', 'true');
                } else {
                    cards[0].setAttribute('data-ntflx-edge', 'first');
                    cards[cards.length - 1].setAttribute('data-ntflx-edge', 'last');
                }
            }
        }

        // ── Dynamic rating badge colors ──
        function colorizeRatings() {
            var badges = document.querySelectorAll('.card__vote');
            for (var i = 0; i < badges.length; i++) {
                var el = badges[i];
                if (el.getAttribute('data-ntflx-colored')) continue;
                var text = (el.textContent || el.innerText || '').replace(',', '.').trim();
                var val = parseFloat(text);
                if (isNaN(val)) continue;
                var color;
                if (val >= 7.5) color = '#2ecc71'; // emerald green
                else if (val >= 6.5) color = '#f1c40f'; // sunflower yellow
                else if (val >= 5.0) color = '#e67e22'; // carrot orange
                else color = '#e74c3c'; // alizarin red
                el.style.setProperty('background', color, 'important');
                el.style.setProperty('color', (val >= 6.5 ? '#000' : '#fff'), 'important'); // Dark text on light backgrounds
                el.setAttribute('data-ntflx-colored', '1');
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
        var old = document.getElementById('ntflx-premium-v8');
        if (old) old.remove();

        var accent = Lampa.Storage.get('ntflx_accent_color', '#e50914');
        var fontFam = Lampa.Storage.get('ntflx_font_family', 'Montserrat');
        var fontSb = Lampa.Storage.get('ntflx_font_size_sidebar', '1.1em');
        var scale = Lampa.Storage.get('ntflx_card_scale', '1.08');
        var shift = Lampa.Storage.get('ntflx_edge_shift', '20px');
        var logoH = Lampa.Storage.get('ntflx_logo_height', '200px');
        var blur = Lampa.Storage.get('ntflx_backdrop_blur', '30px');
        var sbWidth = Lampa.Storage.get('ntflx_sidebar_width', '280px');
        var sbOpacity = Lampa.Storage.get('ntflx_sidebar_opacity', '0.45');

        // AUTO LITE-MODE FOR LOW-END TVS
        if (isExoticOS) {
            sbWidth = 'native'; // Let Lampa's native engine handle width to prevent layout breaks
            sbOpacity = '0.98'; // Force near-solid background because blur is disabled
            blur = '0px';       // Kill GPU-heavy glass effect completely
        }

        function getBorderColor(val) {
            if (val === 'accent') return 'var(--ntflx-accent)';
            if (val === 'white') return '#ffffff';
            if (val === 'black') return '#000000';
            return 'transparent';
        }

        var bFocus = getBorderColor(Lampa.Storage.get('ntflx_card_border_focus', 'accent'));
        var bIdle = getBorderColor(Lampa.Storage.get('ntflx_card_border_idle', 'transparent'));
        var cardRad = Lampa.Storage.get('ntflx_card_radius', '8px');

        var menuCustomCSS = '';
        if (sbOpacity !== 'native') {
            menuCustomCSS += 'background: rgba(10, 13, 18, ' + sbOpacity + ') !important; ';
        }
        if (sbWidth !== 'native') {
            menuCustomCSS += 'min-width: ' + sbWidth + ' !important; ';
        }

        var menuTextCustomCSS = '';
        if (fontSb !== 'native') {
            menuTextCustomCSS += 'font-size: ' + fontSb + ' !important; ';
        }

        function hexToRgb(h) {
            var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
            return r ? parseInt(r[1], 16) + ',' + parseInt(r[2], 16) + ',' + parseInt(r[3], 16) : '229, 9, 20';
        }

        var ratingSet = Lampa.Storage.get('ntflx_rating_set', 'no_kp');
        var ratingCSS = '';

        if (ratingSet === 'no_kp') {
            ratingCSS = '.rate--kp { display: none !important; }';
        } else if (ratingSet === 'west') {
            ratingCSS = '.rate--kp, .rate--cub, .rate--rotten { display: none !important; }';
        } else if (ratingSet === 'tmdb') {
            ratingCSS = '.rate--kp, .rate--imdb, .rate--cub, .rate--rotten { display: none !important; }';
        } else if (ratingSet === 'none') {
            ratingCSS = '.full-start-new__rate-line, .full-start__rate-line { display: none !important; }';
        }

        var accentRgb = hexToRgb(accent);
        var fontImport = '@import url("https://fonts.googleapis.com/css2?family=' + fontFam.replace(/ /g, '+') + ':wght@400;500;600;700;800;900&display=swap");';

        var css = `
/* ================================================================
   NTFLX Premium Style v8.0 — UI Customization
   ================================================================ */

${fontImport}

:root {
    --ntflx-bg: #000000; /* Pure black for maximum contrast */
    --ntflx-accent: ${accent};
    --ntflx-accent-rgb: ${accentRgb};
    --ntflx-accent-gl: rgba(${accentRgb}, 0.6);
    --ntflx-accent-bg: rgba(${accentRgb}, 0.9);
    --ntflx-text: #ffffff;
    --ntflx-font: '${fontFam}', 'Inter', system-ui, -apple-system, sans-serif;
    --ntflx-card-scale: 1.1; /* Slightly more noticeable but still safe */
    --ntflx-shift: 15%;
    --ntflx-duration: 450ms;
    --ntflx-ease: cubic-bezier(0.4, 0, 0.2, 1);
    --ntflx-radius: ${cardRad};
    --ntflx-card-border-focus: ${bFocus};
    --ntflx-card-border-idle: rgba(255,255,255,0.08);
    --ntflx-glass: rgba(255, 255, 255, 0.03);
    --ntflx-glass-border: rgba(255, 255, 255, 0.12);
}

body {
    background-color: var(--ntflx-bg) !important;
    font-family: var(--ntflx-font) !important;
    color: var(--ntflx-text) !important;
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
    padding: 45px 0 !important;
}

/* Row with a focused card sits above everything gently */
.items-line:has(.card.focus),
.items-line:has(.card.hover),
.items-line:has(.card:hover) {
    /* Rely on native Lampa z-index */
}

/* Category titles */
.items-line__title {
    font-family: var(--ntflx-font) !important;
    font-weight: 700 !important;
    font-size: 1.3em !important;
    color: var(--ntflx-text) !important;
    text-shadow: var(--ntflx-shadow-text) !important;
    padding-left: 4% !important;
}


/* ================================================================
   2) CARD BASE — GPU-ready, clean view (NO ghost masks)
   ================================================================ */

.card {
    position: relative !important;
    transition: transform var(--ntflx-duration) var(--ntflx-ease) !important;
    will-change: transform !important;
    backface-visibility: hidden !important;
    -webkit-backface-visibility: hidden !important;
    transform: translate3d(0, 0, 0) !important;
    margin-bottom: 35px !important; /* Fix overlapping grids */
    padding-bottom: 5px !important;
}

.card__view {
    border-radius: var(--ntflx-radius) !important;
    overflow: visible !important;
    position: relative !important;
    background: #16181d !important;
    border: 3px solid var(--ntflx-card-border-idle) !important;
    transition: border-color var(--ntflx-duration) var(--ntflx-ease) !important;
}

/* Hardware-accelerated Glow Layer */
.card__view::before {
    content: "" !important;
    display: block !important;
    position: absolute !important;
    top: 0; left: 0; right: 0; bottom: 0;
    border-radius: inherit !important;
    /* Draw the heavy shadow once */
    box-shadow: 0 0 20px var(--ntflx-accent-gl), 0 20px 40px rgba(0,0,0,0.6) !important;
    opacity: 0 !important; /* Hidden by default */
    z-index: -1 !important; /* Sit behind the poster */
    pointer-events: none !important;
    transition: opacity var(--ntflx-duration) var(--ntflx-ease) !important;
    will-change: opacity !important;
}

/* ── KILL ALL GHOST MASKS / OVERLAYS (aggressive) ── */
.card__view::after {
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
    border-radius: var(--ntflx-radius) !important;
    display: block !important;
}

/* ── CARD TITLE ── */
.card__title {
    position: relative !important;
    font-family: var(--ntflx-font) !important;
    font-size: 0.75em !important;
    font-weight: 800 !important;
    color: rgba(255,255,255,0.6) !important;
    padding: 10px 4px 0px !important;
    line-height: 1.2 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    text-align: center !important;
    text-transform: uppercase !important;
    letter-spacing: 0.05em !important;
    transition: all 0.3s var(--ntflx-ease) !important;
}

/* Make title pop when card is focused */
.card.focus .card__title,
.card.hover .card__title,
.card:hover .card__title {
    color: #fff !important;
    transform: translateY(2px) !important;
    text-shadow: 0 0 10px rgba(255,255,255,0.3) !important;
}

/* ── PREMIUM LEAF RATING ── */
.card__vote {
    position: absolute !important;
    top: 8px !important;
    right: 8px !important;
    bottom: auto !important;
    left: auto !important;
    background: var(--ntflx-accent) !important;
    color: #fff !important;
    font-size: 0.7em !important;
    font-weight: 900 !important;
    padding: 3px 8px !important;
    border-radius: 12px 2px 12px 12px !important; /* Modern Leaf Shape */
    box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
    z-index: 5 !important;
    transform: scale(0.9) !important;
    transition: transform 0.3s ease !important;
}

.card.focus .card__vote {
    transform: scale(1.1) !important;
}

.card__quality {
    position: absolute !important;
    top: 8px !important;
    left: 8px !important;
    bottom: auto !important;
    right: auto !important;
    background: rgba(255,255,255,0.15) !important;
    backdrop-filter: blur(4px);
    color: #fff !important;
    font-size: 0.6em !important;
    font-weight: 900 !important;
    padding: 2px 6px !important;
    border-radius: 4px !important;
    z-index: 5 !important;
    text-transform: uppercase !important;
}


/* ================================================================
   3) CARD FOCUS — clean poster + red glow (NO overlays)
   ================================================================ */

/* ── Suppress auto-focus until user interaction ── */
body:not(.ntflx-user-interacted) .card.focus,
body:not(.ntflx-user-interacted) .card.hover,
body:not(.ntflx-user-interacted) .card:has(~ .card.focus),
body:not(.ntflx-user-interacted) .card:has(~ .card.hover),
body:not(.ntflx-user-interacted) .card.focus ~ .card,
body:not(.ntflx-user-interacted) .card.hover ~ .card {
    transform: translate3d(0, 0, 0) !important;
}

body:not(.ntflx-user-interacted) .card.focus .card__view,
body:not(.ntflx-user-interacted) .card.hover .card__view {
    border-color: var(--ntflx-card-border-idle) !important;
}

body:not(.ntflx-user-interacted) .card.focus .card__view::before,
body:not(.ntflx-user-interacted) .card.hover .card__view::before {
    opacity: 0 !important;
}

/* All cards: center origin, uniform easing */
.card {
    position: relative !important;
    transform-origin: center center !important;
}

.card.focus,
.card.hover,
.card:hover {
    transform: scale3d(var(--ntflx-card-scale), var(--ntflx-card-scale), 1) !important;
    z-index: 10 !important; /* Ensure focused card pops over neighbors */
}

/* Focused card — Bloom + 3D Shadow */
.card.focus .card__view,
.card.hover .card__view,
.card:hover .card__view {
    border-color: var(--ntflx-card-border-focus) !important;
    box-shadow: 
        0 20px 40px rgba(0,0,0,0.9), 
        0 0 0 1px rgba(255,255,255,0.1),
        0 0 25px var(--ntflx-accent-gl) !important;
    transform: translateY(-5px) !important;
}

.card.focus .card__view::before,
.card.hover .card__view::before,
.card:hover .card__view::before {
    opacity: 1 !important;
    box-shadow: inset 0 0 20px var(--ntflx-accent-gl) !important;
}

/* ── NEIGHBOR SHIFTING (GPU translate3d) ── */
/* 
   Apple TV / Generic TV fallback: 
   If :has() is NOT supported, we do NOT shift anything. 
   Cards scale from center and overlap equally. This looks like a deliberate 3D pop.
   
   Netflix Premium (Modern TV):
   If :has() is supported, we shift left cards left, and right cards right. 
   This perfectly prevents overlaps without breaking edge cards.
*/
@supports selector(:has(a)) {
    /* Shift cards BEFORE the focused card to the left */
    .items-line .card:has(~ .card.focus),
    .items-line .card:has(~ .card.hover),
    .items-line .card:has(~ .card:hover) {
        transform: translate3d(calc(var(--ntflx-shift) * -1), 0, 0) !important;
    }

    /* Shift cards AFTER the focused card to the right */
    .items-line .card.focus ~ .card,
    .items-line .card.hover ~ .card,
    .items-line .card:hover ~ .card {
        transform: translate3d(var(--ntflx-shift), 0, 0) !important;
    }
}


/* ================================================================
   4) HERO — FULLSCREEN BACKDROP, ZERO OVERLAYS
   ================================================================ */

/* ── Backdrop: 100% fullscreen, no mask, no margins ── */
/* ── Backdrop: 100% fullscreen, no mask, no margins ── */
.full-start-new, 
.full-start {
    position: relative !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
}

/* Force the background image to stretch up and cover the empty padding space */
.full-start-new .full-start-new__background,
.full-start-new .full-start__background,
.full-start__background {
    position: absolute !important;
    top: -6em !important; /* Break out of the container upwards */
    left: 0 !important;
    width: 100% !important;
    height: calc(100% + 6em) !important; /* Compensate for the pull-up */
    margin: 0 !important; padding: 0 !important;
    mask-image: none !important; -webkit-mask-image: none !important;
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

/* All static overlays/gradients are disabled for the dynamic scroll fog */
.applecation__overlay,
.application__overlay,
.full-start__background.applecation__overlay {
    display: none !important;
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

/* ── DYNAMIC SCROLL FOG LAYER ── */
.full-start-new::before, .full-start::before {
    content: "" !important; display: block !important; position: absolute !important;
    top: -6em !important; 
    left: 0 !important; right: 0 !important; bottom: 0 !important;
    height: calc(100% + 6em) !important; 
    background: linear-gradient(to top, var(--ntflx-bg) 0%, rgba(7,9,12,0.95) 45%, rgba(7,9,12,0.4) 75%, transparent 100%) !important;
    opacity: var(--ntflx-fog-level, 0.25) !important; z-index: 1 !important; pointer-events: none !important; transition: opacity 0.2s ease !important;
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
.full-start-new__body, .full-start__body {
    position: relative !important; z-index: 2 !important; padding-left: 5% !important;
    display: flex !important; align-items: flex-end !important;
    min-height: 80vh !important;
    padding-top: 6em !important; /* Protect logo from overlapping top header icons */
    padding-bottom: 2em !important; background: none !important;
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
    font-family: var(--ntflx-font) !important;
    font-weight: 900 !important; /* Ultra-bold for cinematic feel */
    font-size: clamp(2em, 5vw, 3.5em) !important; /* Responsive fluid typography */
    letter-spacing: -0.02em !important;
    line-height: 1.05 !important;
    color: #fff !important;
    text-shadow: 0 4px 16px rgba(0,0,0,0.8),
                 0 8px 32px rgba(0,0,0,0.6) !important;
    margin-bottom: 12px !important;
    background: none !important;
    background-color: transparent !important;
    box-shadow: none !important;
    max-width: 100% !important;
}

/* Logo images: Clean look, no drop-shadows or rectangular masks */
.full-start-new__title img,
.full-start__title img,
.applecation__logo img,
.new-interface-full-logo {
    filter: none !important;
    background: none !important;
    box-shadow: none !important;
    max-width: 100% !important;
}

/* ── Compact Metadata Block (moved from blue → pink zone) ── */

/* Head line (year, country) */
.full-start-new__head,
.full-start__head {
    font-family: var(--ntflx-font) !important;
    font-weight: 500 !important;
    font-size: 0.85em !important;
    line-height: 1.3 !important;
    color: rgba(255,255,255,0.75) !important;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
    margin: 0 0 2px 0 !important;
}

.full-start__button,
.full-start-new__button {
    font-family: var(--ntflx-font) !important;
    font-weight: 700 !important;
    font-size: 0.85em !important;
    letter-spacing: 0.05em !important;
    text-transform: uppercase !important;
    padding: 0.8em 1.8em !important;
    border-radius: 50px !important; /* Pill shape */
    border: 1px solid var(--ntflx-glass-border) !important;
    background: rgba(255, 255, 255, 0.08) !important;
    backdrop-filter: blur(20px) saturate(180%) !important;
    -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
    color: rgba(255, 255, 255, 0.9) !important;
    transition: all 400ms var(--ntflx-ease) !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    margin-right: 0.8em !important;
    cursor: pointer !important;
    white-space: nowrap !important;
}

.full-start__button.focus,
.full-start__button:hover,
.full-start-new__button.focus,
.full-start-new__button:hover {
    background: var(--ntflx-accent) !important;
    border-color: rgba(255,255,255,0.4) !important;
    color: #fff !important;
    box-shadow: 0 0 40px var(--ntflx-accent-gl),
                0 15px 45px rgba(0,0,0,0.6),
                inset 0 0 15px rgba(255,255,255,0.4) !important;
    transform: translateY(-5px) scale(1.04) !important;
    z-index: 10 !important;
}

/* Tagline (quote) */
.full-start-new__tagline,
.full-start__tagline {
    font-family: var(--ntflx-font) !important;
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
${ratingCSS}
.full-start-new__rate-line,
.full-start__rate-line {
    font-family: var(--ntflx-font) !important;
    font-weight: 500 !important;
    font-size: 0.82em !important;
    line-height: 1.3 !important;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
    margin: 0 0 2px 0 !important;
}

/* Details (genres, quality, etc.) */
.full-start-new__details,
.full-start__details {
    font-family: var(--ntflx-font) !important;
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
    font-family: var(--ntflx-font) !important;
    font-weight: 500 !important;
    color: rgba(255,255,255,0.72) !important;
    font-size: 0.85em !important;
    line-height: 1.4 !important;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
    max-width: 520px !important;
    margin: 0 0 6px 0 !important;
}

/* ── Premium Buttons ── */

/* Inactive buttons: grayish semi-transparent glass with border */
.full-start__button,
.full-start-new__button {
    font-family: var(--ntflx-font) !important;
    font-weight: 700 !important;
    letter-spacing: 0.02em !important;
    text-transform: uppercase !important;
    font-size: 0.85em !important;
    border-radius: 50px !important; /* Pill shape */
    border: 1px solid var(--ntflx-glass-border) !important;
    background: rgba(255, 255, 255, 0.1) !important;
    backdrop-filter: blur(16px) saturate(180%) !important;
    -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
    color: #fff !important;
    padding: 0.8em 2em !important;
    margin-right: 12px !important;
    transition: all 400ms cubic-bezier(0.2, 0.8, 0.2, 1) !important;
}

/* Active/focused button: Intense accent glass with inner glow */
.full-start__button.focus,
.full-start__button:hover,
.full-start-new__button.focus,
.full-start-new__button:hover {
    background: var(--ntflx-accent) !important;
    border-color: rgba(255,255,255,0.4) !important;
    box-shadow: 0 0 30px var(--ntflx-accent-gl),
                0 12px 36px rgba(0,0,0,0.5),
                inset 0 0 12px rgba(255,255,255,0.3) !important;
    transform: translateY(-4px) scale(1.05) !important;
    color: #fff !important;
}

.full-start__button.focus *,
.full-start-new__button.focus * {
    color: #fff !important;
    fill: #fff !important;
}


/* ================================================================
   5) SIDEBAR — Dark gloss glassmorphism, optimized for long text
   ================================================================ */

/* Container: dark glossy glass, full-height coverage */
.menu {
    ${menuCustomCSS}
    backdrop-filter: blur(var(--ntflx-sb-blur)) saturate(150%) !important;
    -webkit-backdrop-filter: blur(var(--ntflx-sb-blur)) saturate(150%) !important;
    border-right: 1px solid rgba(255,255,255,0.08) !important;
    border-left: none !important;
    border-top: none !important;
    border-bottom: none !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
}

.menu__list {
    background: transparent !important;
    padding: 0 !important;
}

/* ── Menu Items: geometry & text fit ── */
.menu__item[style*="display: none"],
.menu__item.hide,
.menu__item.hidden {
    display: none !important;
}

/* Added small margin and slightly softer radius to separate items properly */
.menu__item {
    border-radius: 12px !important; /* Softer corners */
    background: transparent !important;
    border: 1px solid transparent !important;
    padding: 0.8em 1.4em 0.8em 1.2em !important;
    margin: 4px 12px !important; /* Inset items for better focus visual */
    transition: all 300ms var(--ntflx-ease) !important;
    display: flex;
    align-items: center !important;
    gap: 1em !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    position: relative !important;
}

/* ── Active / focused: Glowing pill effect ── */
.menu__item.focus,
.menu__item.hover,
.menu__item.traverse,
.menu__item.active {
    background: var(--ntflx-accent) !important;
    border-color: rgba(255,255,255,0.3) !important;
    box-shadow: 0 8px 25px var(--ntflx-accent-gl),
                inset 0 0 10px rgba(255,255,255,0.2) !important;
    transform: scale(1.02) !important;
}

/* Active text: pure white */
.menu__item.focus .menu__text,
.menu__item.hover .menu__text,
.menu__item.traverse .menu__text,
.menu__item.active .menu__text {
    color: #ffffff !important;
    font-weight: 700 !important;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
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
    font-family: var(--ntflx-font) !important;
    font-weight: 500 !important;
    ${menuTextCustomCSS}
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
    display: flex;
    align-items: center !important;
    justify-content: center !important;
}

.menu__ico svg {
    fill: rgba(255,255,255,0.5) !important;
    transition: fill 200ms ease !important;
    width: 1.1em !important;
    height: 1.1em !important;
}

/* Make header float perfectly transparent over everything. 
   Removing aggressive z-indexing allows Lampa natively to overlay Modals 
   and Settings correctly over the absolute header. */
.head {
    position: absolute !important;
    top: 0 !important; left: 0 !important; right: 0 !important; width: 100% !important;
    background: transparent !important; background-color: transparent !important; background-image: none !important;
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
    border: none !important; box-shadow: none !important;
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

/* MOBILE HERO RESPONSIVE BACKGROUND (Phones & Tablets: up to 768px) */
@media (max-width: 768px) {
    .full-start-new__background, .full-start__background { 
        display: none !important; 
    }

    .full-start-new, .full-start {
        background-image: var(--ntflx-mobile-bg) !important;
        background-size: cover !important;
        background-position: center top !important;
        background-repeat: no-repeat !important;
        /* Pull container up under the header */
        margin-top: -5.5em !important;
        /* Push content back down safely */
        padding-top: 5.5em !important;
    }

    /* Gradient overlay to make text readable */
    .applecation__overlay, .application__overlay {
        display: block !important;
        background: linear-gradient(to top, var(--ntflx-bg) 0%, rgba(10,13,18,0.85) 40%, rgba(10,13,18,0.2) 75%, transparent 100%) !important;
        background-color: transparent !important;
        background-image: linear-gradient(to top, var(--ntflx-bg) 0%, rgba(10,13,18,0.85) 40%, rgba(10,13,18,0.2) 75%, transparent 100%) !important;
        box-shadow: none !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        pointer-events: none !important;
    }
}

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
        min-height: 75vh !important;
        padding-left: 2% !important;
        padding-bottom: 2.5em !important;
    }
    :root {
        --ntflx-card-scale: 1.1;
        --ntflx-shift: 8%;
        --ntflx-duration: 300ms;
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
        --ntflx-card-scale: 1.25;
        --ntflx-shift: 18%;
        --ntflx-duration: 350ms;
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
        --ntflx-card-scale: 1.45;
        --ntflx-shift: 30%;
        --ntflx-duration: 450ms;
    }
    .items-line {
        padding: 60px 0 !important;
    }
    .card__view {
        border-radius: calc(var(--ntflx-radius) * 1.5) !important;
    }
}
/* ── NTFLX DETAILS OVERLAY ── */
.ntflx-overlay {
    animation: ntflx_fade_in 0.5s cubic-bezier(0.23, 1, 0.32, 1);
}

@keyframes ntflx_fade_in {
    from { opacity: 0; transform: translateY(20px) scale(1.02); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

.ntflx-overlay .selector.focus {
    background: rgba(255,255,255,0.12) !important;
    color: #fff !important;
    box-shadow: 0 0 30px rgba(255,255,255,0.15), inset 0 0 10px rgba(255,255,255,0.1) !important;
    transform: scale(1.1) !important;
}

/* ── MODALS (Lampa Native) ── */
.modal {
    background: rgba(7,9,12,0.92) !important;
    backdrop-filter: blur(30px) !important;
    -webkit-backdrop-filter: blur(30px) !important;
    border-radius: 24px !important;
    border: 1px solid var(--ntflx-glass-border) !important;
    box-shadow: 0 30px 90px rgba(0,0,0,0.8) !important;
}

.modal__title {
    font-family: var(--ntflx-font) !important;
    font-weight: 800 !important;
    letter-spacing: -0.02em !important;
}

/* ── TABS (Notifications, Filters) ── */
.tabs__item {
    border-radius: 50px !important;
    border: 1px solid rgba(255,255,255,0.05) !important;
    background: rgba(255,255,255,0.03) !important;
    transition: all 0.3s ease !important;
}

.tabs__item.active {
    background: var(--ntflx-accent) !important;
    box-shadow: 0 5px 15px var(--ntflx-accent-gl) !important;
    border-color: rgba(255,255,255,0.2) !important;
}
`;

        var style = document.createElement('style');
        style.id = 'ntflx-premium-v8';
        style.textContent = css;
        document.head.appendChild(style);
    }


    // ─────────────────────────────────────────────────────────────────
    //  SECTION 6 — SETTINGS & BOOTSTRAP
    // ─────────────────────────────────────────────────────────────────

    function initSettings() {
        if (!window.Lampa || !Lampa.SettingsApi) return;

        var lang = Lampa.Storage.get('language', 'uk');
        if (lang === 'ua') lang = 'uk';

        var i18n = {
            'en': {
                'ps_title': 'Premium Style v9.0',
                'accent_color': 'Accent Color',
                'red': 'Netflix Red',
                'gold': 'Cinematic Gold',
                'silver': 'Modern Silver',
                'blue': 'Electric Blue',
                'purple': 'Royal Purple',
                'green': 'Emerald Green',
                'font_family': 'Font Family',
                'sidebar_font_size': 'Sidebar Font Size',
                'small': 'Small',
                'normal': 'Normal',
                'large': 'Large',
                'xlarge': 'Extra Large',
                'card_scale': 'Card Focus Scale Factor',
                'default': 'Default',
                'edge_shift': 'Edge Shift Nudge',
                'logo_height': 'Logo Max-Height',
                'medium': 'Medium',
                'sb_blur': 'Sidebar Backdrop Blur',
                'light': 'Light',
                'premium': 'Premium',
                'heavy': 'Heavy',
                'sb_width': 'Sidebar Width',
                'compact': 'Compact',
                'wide': 'Wide',
                'uwide': 'Ultra Wide',
                'sb_opacity': 'Sidebar Opacity',
                'clear': 'Almost Clear',
                'glassy': 'Glassy (Default)',
                'dark_glass': 'Dark Glass',
                'solid': 'Solid Dark',
                'auto': 'Auto (Lampa)',
                'native_off': 'Native (Turn Off)',
                'micro': 'Micro',
                'tiny': 'Tiny',
                'logo_lang': 'Logo Language Override',
                'transparent': 'Transparent',
                'white': 'White',
                'black': 'Black',
                'card_border_focus': 'Card Focus Border',
                'card_border_idle': 'Card Idle Border',
                'card_radius': 'Card Corner Radius',
                'square': 'Square (0px)',
                'small_rad': 'Small (4px)',
                'med_rad': 'Medium (8px)',
                'large_rad': 'Large (12px)',
                'xl_rad': 'Extra Large (16px)',
                'rating_set': 'Ratings Display',
                'r_all': 'All Ratings',
                'r_no_kp': 'Hide Kinopoisk (KP)',
                'r_west': 'TMDB + IMDB Only',
                'r_tmdb': 'TMDB Only',
                'r_none': 'Hide All Ratings'
            },
            'uk': {
                'ps_title': 'Premium Style v9.0',
                'accent_color': 'Акцентний колір',
                'red': 'Червоний (Netflix)',
                'gold': 'Кінематографічне золото',
                'silver': 'Сучасне срібло',
                'blue': 'Електричний синій',
                'purple': 'Королівський фіолетовий',
                'green': 'Смарагдовий зелений',
                'font_family': 'Шрифт',
                'sidebar_font_size': 'Розмір шрифту бокового меню',
                'small': 'Малий',
                'normal': 'Звичайний',
                'large': 'Великий',
                'xlarge': 'Дуже великий',
                'card_scale': 'Масштаб картки у фокусі',
                'default': 'За замовчуванням',
                'edge_shift': 'Відступ крайньої картки',
                'logo_height': 'Висота логотипу',
                'medium': 'Середній',
                'sb_blur': 'Розмиття бокового меню',
                'light': 'Легке',
                'premium': 'Преміум',
                'heavy': 'Сильне',
                'sb_width': 'Ширина бокового меню',
                'compact': 'Компактне',
                'wide': 'Широке',
                'uwide': 'Ультра широке',
                'sb_opacity': 'Прозорість бокового меню',
                'clear': 'Прозоре',
                'glassy': 'Скло (Стандарт)',
                'dark_glass': 'Темне скло',
                'solid': 'Суцільне темне',
                'auto': 'Авто (Lampa)',
                'native_off': 'Оригінальний (Вимкнено)',
                'micro': 'Мікро',
                'tiny': 'Крихітний',
                'logo_lang': 'Мова логотипу (Перевизначення)',
                'transparent': 'Прозора',
                'white': 'Біла',
                'black': 'Чорна',
                'card_border_focus': 'Обводка картки у фокусі',
                'card_border_idle': 'Обводка картки у спокої',
                'card_radius': 'Заокруглення кутів картки',
                'square': 'Квадратні (0px)',
                'small_rad': 'Малі (4px)',
                'med_rad': 'Середні (8px)',
                'large_rad': 'Великі (12px)',
                'xl_rad': 'Максимальні (16px)',
                'rating_set': 'Відображення рейтингів',
                'r_all': 'Всі рейтинги',
                'r_no_kp': 'Без Кінопошуку (KP)',
                'r_west': 'Тільки TMDB + IMDB',
                'r_tmdb': 'Тільки TMDB',
                'r_none': 'Приховати всі'
            },
            'ru': {
                'ps_title': 'Premium Style v9.0',
                'accent_color': 'Акцентный цвет',
                'red': 'Красный (Netflix)',
                'gold': 'Кинематографическое золото',
                'silver': 'Современное серебро',
                'blue': 'Электрический синий',
                'purple': 'Королевский фиолетовый',
                'green': 'Изумрудный зеленый',
                'font_family': 'Шрифт',
                'sidebar_font_size': 'Размер шрифта бокового меню',
                'small': 'Маленький',
                'normal': 'Обычный',
                'large': 'Большой',
                'xlarge': 'Очень большой',
                'card_scale': 'Масштаб карточки в фокусе',
                'default': 'По умолчанию',
                'edge_shift': 'Отступ крайней карточки',
                'logo_height': 'Высота логотипа',
                'medium': 'Средний',
                'sb_blur': 'Размытие бокового меню',
                'light': 'Легкое',
                'premium': 'Премиум',
                'heavy': 'Сильное',
                'sb_width': 'Ширина бокового меню',
                'compact': 'Компактное',
                'wide': 'Широкое',
                'uwide': 'Ультра широкое',
                'sb_opacity': 'Прозрачность бокового меню',
                'clear': 'Прозрачное',
                'glassy': 'Стекло (Стандарт)',
                'dark_glass': 'Темное стекло',
                'solid': 'Сплошное темное',
                'auto': 'Авто (Lampa)',
                'native_off': 'Оригинальный (Выкл)',
                'micro': 'Микро',
                'tiny': 'Крошечный',
                'logo_lang': 'Язык логотипа (Переопределение)',
                'transparent': 'Прозрачная',
                'white': 'Белая',
                'black': 'Черная',
                'card_border_focus': 'Обводка карточки в фокусе',
                'card_border_idle': 'Обводка карточки в покое',
                'card_radius': 'Закругление углов карточки',
                'square': 'Квадратные (0px)',
                'small_rad': 'Маленькие (4px)',
                'med_rad': 'Средние (8px)',
                'large_rad': 'Большие (12px)',
                'xl_rad': 'Максимальные (16px)',
                'rating_set': 'Отображение рейтингов',
                'r_all': 'Все рейтинги',
                'r_no_kp': 'Без Кинопоиска (KP)',
                'r_west': 'Только TMDB + IMDB',
                'r_tmdb': 'Только TMDB',
                'r_none': 'Скрыть все'
            }
        };

        function t(key) {
            var dict = i18n[lang] || i18n['en'];
            return dict[key] || i18n['en'][key] || key;
        }

        Lampa.SettingsApi.addComponent({
            component: 'ntflx_premium',
            name: t('ps_title'),
            icon: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>'
        });

        var prm = [
            { name: 'ntflx_accent_color', type: 'select', values: { '#e50914': t('red'), '#d4af37': t('gold'), '#c0c0c0': t('silver'), '#007aff': t('blue'), '#5856d6': t('purple'), '#2ecc71': t('green') }, default: '#e50914', title: t('accent_color') },
            { name: 'ntflx_logo_lang', type: 'select', values: { 'auto': t('auto'), 'uk': 'Ukrainian (UK/UA)', 'ru': 'Russian (RU)', 'en': 'English (EN)' }, default: 'auto', title: t('logo_lang') },
            { name: 'ntflx_font_family', type: 'select', values: { 'Montserrat': 'Montserrat', 'Roboto': 'Roboto', 'Open Sans': 'Open Sans', 'Inter': 'Inter' }, default: 'Montserrat', title: t('font_family') },
            { name: 'ntflx_card_border_focus', type: 'select', values: { 'transparent': t('transparent'), 'accent': t('accent_color'), 'white': t('white') }, default: 'accent', title: t('card_border_focus') },
            { name: 'ntflx_card_border_idle', type: 'select', values: { 'transparent': t('transparent'), 'accent': t('accent_color'), 'white': t('white'), 'black': t('black') }, default: 'transparent', title: t('card_border_idle') },
            { name: 'ntflx_card_radius', type: 'select', values: { '0px': t('square'), '4px': t('small_rad'), '8px': t('med_rad') + ' (' + t('default') + ')', '12px': t('large_rad'), '16px': t('xl_rad') }, default: '8px', title: t('card_radius') },
            { name: 'ntflx_font_size_sidebar', type: 'select', values: { 'native': t('native_off'), '0.9em': t('small'), '1.0em': t('normal'), '1.1em': t('large'), '1.2em': t('xlarge') }, default: '1.1em', title: t('sidebar_font_size') },
            { name: 'ntflx_sidebar_width', type: 'select', values: { 'native': t('native_off'), '220px': t('compact'), '280px': t('normal') + ' (' + t('default') + ')', '340px': t('wide'), '400px': t('uwide') }, default: '280px', title: t('sb_width') },
            { name: 'ntflx_sidebar_opacity', type: 'select', values: { 'native': t('native_off'), '0.1': t('clear'), '0.45': t('glassy'), '0.75': t('dark_glass'), '0.95': t('solid') }, default: '0.45', title: t('sb_opacity') },
            { name: 'ntflx_card_scale', type: 'select', values: { '1.05': '1.05x', '1.08': '1.08x (' + t('default') + ')', '1.15': '1.15x', '1.25': '1.25x', '1.35': '1.35x', '1.45': '1.45x' }, default: '1.08', title: t('card_scale') },
            { name: 'ntflx_edge_shift', type: 'select', values: { '10px': '10px', '20px': '20px', '30px': '30px' }, default: '20px', title: t('edge_shift') },
            { name: 'ntflx_logo_height', type: 'select', values: { '80px': t('micro'), '120px': t('tiny'), '150px': t('small'), '200px': t('medium'), '250px': t('large'), '300px': t('xlarge') }, default: '200px', title: t('logo_height') },
            { name: 'ntflx_backdrop_blur', type: 'select', values: { '10px': t('light'), '30px': t('premium'), '50px': t('heavy') }, default: '30px', title: t('sb_blur') },
            { name: 'ntflx_rating_set', type: 'select', values: { 'all': t('r_all'), 'no_kp': t('r_no_kp'), 'west': t('r_west'), 'tmdb': t('r_tmdb'), 'none': t('r_none') }, default: 'no_kp', title: t('rating_set') }
        ];

        prm.forEach(function (p) {
            var paramConfig = { name: p.name, type: p.type, default: p.default };
            if (p.values) paramConfig.values = p.values;

            Lampa.SettingsApi.addParam({
                component: 'ntflx_premium',
                param: paramConfig,
                field: { name: p.title },
                onChange: function () { injectCSS(); }
            });
        });
    }

    function bootstrap() {
        if (window.__ntflx_premium_v8) return;
        window.__ntflx_premium_v8 = true;

        initSettings();
        injectCSS();
        initHeroProcessor();
        initCardProcessor();



        if (window.Lampa && Lampa.Storage && Lampa.Storage.listener) {
            Lampa.Storage.listener.follow('change', function (e) {
                if (e.name && e.name.indexOf('ntflx_') === 0) {
                    injectCSS();
                }
            });
        }

        var isScrolling = false;
        // Global scroll listener for dynamic fog
        document.addEventListener('scroll', function (e) {
            if (e.target && e.target.classList && e.target.classList.contains('scroll__body')) {
                if (!isScrolling) {
                    window.requestAnimationFrame(function () {
                        var st = e.target.scrollTop;
                        var hero = e.target.querySelector('.full-start-new, .full-start');
                        if (hero) {
                            var additionalFog = Math.min(st / 400, 0.8);
                            hero.style.setProperty('--ntflx-fog-level', 0.05 + additionalFog);
                        }
                        isScrolling = false;
                    });
                    isScrolling = true;
                }
            }
        }, true);

        console.log('[NTFLX Premium] v8.22 — Ultimate Performance & TV Compatibility');
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
