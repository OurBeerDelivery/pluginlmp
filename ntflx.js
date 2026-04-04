(function () {
    'use strict';

    var isExoticOS = /Vidaa|Web0S|Tizen|SmartTV|Metrological|NetCast/i.test(navigator.userAgent);

    /* ================================================================
     *  NTFLX Premium Style v9.0  —  Multi-screen, Custom UI
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
                        details: 'Детальна Інформація',
                        desc_empty: 'Опис відсутній',
                        release: 'Дата релізу', rating: 'Рейтинг',
                        genres: 'Жанри', countries: 'Країни',
                        cast: 'У ролях', loading: 'Завантаження...',
                        duration: 'Тривалість', min: 'хв.',
                        state: 'Статус', orig_lang: 'Мова оригіналу',
                        budget: 'Бюджет', revenue: 'Касові збори',
                        studio: 'Студія', director: 'Режисер',
                        keywords: 'Теги'
                    },
                    'ru': {
                        about_movie: 'О фильме', about_tv: 'О сериале',
                        details: 'Подробная Информация',
                        desc_empty: 'Описание отсутствует',
                        release: 'Дата релиза', rating: 'Рейтинг',
                        genres: 'Жанры', countries: 'Страны',
                        cast: 'В ролях', loading: 'Загрузка...',
                        duration: 'Продолжительность', min: 'мин.',
                        state: 'Статус', orig_lang: 'Язык оригинала',
                        budget: 'Бюджет', revenue: 'Кассовые сборы',
                        studio: 'Студия', director: 'Режиссёр',
                        keywords: 'Теги'
                    },
                    'en': {
                        about_movie: 'About Movie', about_tv: 'About Show',
                        details: 'Detailed Information',
                        desc_empty: 'No description',
                        release: 'Release Date', rating: 'Rating',
                        genres: 'Genres', countries: 'Countries',
                        cast: 'Top Cast', loading: 'Loading...',
                        duration: 'Duration', min: 'min.',
                        state: 'Status', orig_lang: 'Original Language',
                        budget: 'Budget', revenue: 'Revenue',
                        studio: 'Studio', director: 'Director',
                        keywords: 'Keywords'
                    }
                };
                var t = i18n[langUi] || i18n['uk'];

                var btnText = type === 'tv' ? t.about_tv : t.about_movie;
                var btnSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>';
                var descBtn = $('<div class="full-start__button selector ntflx-desc-btn" style="display:inline-flex; align-items:center;">' + btnSvg + '<div>' + btnText + '</div></div>');
                
                descBtn.css({'margin-left': '0.5em'}); // Fix overlap
                
                var _overlayOpen = false;
                descBtn.on('click hover:enter', function(e) {
                    if (_overlayOpen) return;
                    _overlayOpen = true;
                    e.stopPropagation && e.stopPropagation();
                    var overlay = $('<div class="ntflx-overlay" style="position:fixed; top:0; left:0; right:0; bottom:0; z-index:100; background: rgba(10,8,8,0.96); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); overflow-y: auto; padding: 4em 3em; display:flex; flex-direction:column; align-items:center;"></div>');
                    
                    var closeBtn = $('<div class="selector" style="position:absolute; top: 2.5em; right: 3em; cursor:pointer; color:#a0a0a0; padding:10px; border-radius:50%; transition: color 0.3s;"><svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></div>');
                    
                    var isClosing = false;
                    var closeUI = function(e) {
                        if (isClosing) return;
                        isClosing = true;
                        if (e && e.stopPropagation) e.stopPropagation();
                        overlay.remove();
                        _overlayOpen = false; // reset guard
                        // Remove the controller cleanly from registry
                        if (Lampa.Controller.remove) {
                            Lampa.Controller.remove('ntflx_details');
                        } else if (Lampa.Controller.controllers) {
                            delete Lampa.Controller.controllers['ntflx_details'];
                        }
                        // Let Lampa restore state naturally — it knows where we came from
                        if (Lampa.Controller.previous) Lampa.Controller.previous();
                        else Lampa.Controller.toggle('full');
                    };
                    closeBtn.on('hover:enter click', closeUI);
                    
                    var container = $('<div style="max-width: 1200px; width: 100%; display:flex; flex-direction:column; gap: 3em; padding-top: 2em; animation: fadeIn 0.4s ease-out;"></div>');

                    // ── HEADER: Logo image or text fallback ──
                    var headerBlock = $('<div style="text-align:center; min-height:120px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:0.8em;"></div>');
                    var logoWrap = $('<div style="display:flex; justify-content:center; align-items:flex-end; max-height:140px; overflow:hidden;"></div>');
                    // Placeholder text shown while logo loads
                    var titleFallback = $('<h2 style="font-size:4em; font-weight:900; line-height:1.1; margin:0; letter-spacing:-0.03em;">' + (movie.title || movie.name) + '</h2>');
                    logoWrap.append(titleFallback);
                    var detailsLabel = $('<div style="color:var(--ntflx-accent); font-size:12px; font-weight:bold; text-transform:uppercase; letter-spacing:0.15em;">' + t.details + '</div>');
                    headerBlock.append(logoWrap).append(detailsLabel);
                    container.append(headerBlock);

                    // Fetch logo async — replace title if found
                    var logoLang = langUi === 'uk' ? 'uk' : (langUi === 'ru' ? 'ru' : 'en');
                    var imagesUrl = Lampa.TMDB.api(type + '/' + movie.id + '/images?api_key=' + Lampa.TMDB.key() + '&include_image_language=' + logoLang + ',ru,en,null');
                    $.get(imagesUrl, function(imgData) {
                        var logos = imgData.logos || [];
                        // Sort by vote_average and language preference
                        logos.sort(function(a, b) {
                            var la = (a.iso_639_1 === logoLang) ? 2 : (a.iso_639_1 === 'en') ? 1 : 0;
                            var lb = (b.iso_639_1 === logoLang) ? 2 : (b.iso_639_1 === 'en') ? 1 : 0;
                            if (lb !== la) return lb - la;
                            return (b.vote_average || 0) - (a.vote_average || 0);
                        });
                        if (logos.length) {
                            var logoPath = logos[0].file_path.replace('.svg', '.png');
                            var logoUrl = Lampa.TMDB.image('t/p/w500' + logoPath);
                            var logoImg = $('<img>').attr('src', logoUrl).css({
                                maxHeight: '130px', maxWidth: '500px', width: 'auto', height: 'auto',
                                objectFit: 'contain', filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.9))',
                                opacity: 0, transition: 'opacity 0.4s ease'
                            });
                            logoImg.on('load', function() { titleFallback.remove(); logoImg.css('opacity', 1); });
                            logoImg.on('error', function() { /* keep text */ });
                            logoWrap.empty().append(logoImg);
                        }
                    });

                    // ── MAIN GRID ──
                    var grid = $('<div style="display:flex; gap: 3em; flex-wrap: wrap;"></div>');
                    var leftCol = $('<div style="flex: 2; min-width: 340px; display:flex; flex-direction:column; gap: 2em;"></div>');

                    // Overview
                    if (movie.overview) {
                        leftCol.append($('<div>').css({fontSize:'1.25em', fontWeight:300, lineHeight:1.65, color:'#e8e8e8'}).text(movie.overview));
                    }

                    // Meta grid
                    var metaGrid = $('<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1.5em 2em;"></div>');
                    var addMeta = function(label, val, isHtml) {
                        if (!val && val !== 0) return;
                        var wrap = $('<div></div>');
                        wrap.append($('<div>').css({fontSize:'0.7em', color:'#888', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:'0.3em', fontWeight:'bold'}).text(label));
                        var valEl = $('<div>').css({fontSize:'1em', fontWeight:500, color:'#f0f0f0'});
                        if (isHtml) valEl.html(val); else valEl.text(String(val));
                        wrap.append(valEl);
                        metaGrid.append(wrap);
                    };

                    addMeta(t.release, movie.release_date || movie.first_air_date);

                    // Rating with star
                    if (movie.vote_average) {
                        var stars = Math.round(movie.vote_average / 2);
                        var starStr = '';
                        for (var s = 0; s < 5; s++) starStr += (s < stars ? '★' : '☆');
                        var ratingHtml = '<span style="border:1px solid #444; padding:2px 7px; border-radius:4px; font-size:11px; color:#888; margin-right:6px;">TMDB</span>' +
                            '<span style="font-size:1.1em; font-weight:700;">' + movie.vote_average.toFixed(1) + '</span>' +
                            '<span style="color:#e5b109; font-size:0.9em; margin-left:6px;">' + starStr + '</span>' +
                            (movie.vote_count ? '<span style="color:#666; font-size:0.8em; margin-left:6px;">(' + movie.vote_count.toLocaleString() + ')</span>' : '');
                        addMeta(t.rating, ratingHtml, true);
                    }

                    // Duration
                    var durationText = movie.runtime ? movie.runtime + ' ' + t.min
                        : (movie.episode_run_time && movie.episode_run_time.length ? movie.episode_run_time[0] + ' ' + t.min : '');
                    addMeta(t.duration, durationText);

                    if (movie.status) addMeta(t.state, movie.status);

                    addMeta(t.genres, movie.genres ? movie.genres.map(function(g){return g.name;}).join(', ') : '');
                    addMeta(t.countries, movie.production_countries ? movie.production_countries.map(function(c){return c.name;}).join(', ') : '');

                    if (movie.original_language) {
                        addMeta(t.orig_lang, movie.original_language.toUpperCase());
                    }

                    // Budget & Revenue (movie only)
                    var fmt = function(n) { return '$' + (n/1000000).toFixed(1) + 'M'; };
                    if (movie.budget && movie.budget > 0) {
                        addMeta(t.budget, fmt(movie.budget));
                    }
                    if (movie.revenue && movie.revenue > 0) {
                        addMeta(t.revenue, fmt(movie.revenue));
                    }

                    // Production companies
                    if (movie.production_companies && movie.production_companies.length) {
                        addMeta(t.studio, movie.production_companies.slice(0,3).map(function(c){return c.name;}).join(', '));
                    }

                    leftCol.append(metaGrid);

                    // ── Extra data from /details API ──
                    var extraUrl = Lampa.TMDB.api(type + '/' + movie.id + '?api_key=' + Lampa.TMDB.key() + '&append_to_response=release_dates,content_ratings,keywords&language=' + langUi);
                    $.get(extraUrl, function(detail) {
                        // Quality badges from certifications
                        var badges = '';

                        // Try to get certification
                        var cert = '';
                        if (detail.release_dates && detail.release_dates.results) {
                            var uaRes = detail.release_dates.results.find(function(r){ return r.iso_3166_1 === 'UA'; });
                            var usRes = detail.release_dates.results.find(function(r){ return r.iso_3166_1 === 'US'; });
                            var rel = uaRes || usRes;
                            if (rel && rel.release_dates && rel.release_dates.length && rel.release_dates[0].certification) {
                                cert = rel.release_dates[0].certification;
                            }
                        }
                        if (!cert && detail.content_ratings && detail.content_ratings.results) {
                            var usRating = detail.content_ratings.results.find(function(r){ return r.iso_3166_1 === 'US'; });
                            if (usRating) cert = usRating.rating;
                        }

                        // Quality badge (we show 4K / HD based on year — TMDB doesn't have source resolution)
                        var year = parseInt((movie.release_date || movie.first_air_date || '').substring(0, 4));
                        var qualBadge = year >= 2013 ? '4K' : 'HD';
                        var badgeStyle = 'display:inline-block; padding:3px 10px; border-radius:4px; font-size:11px; font-weight:700; letter-spacing:0.08em; margin-right:8px; margin-top:4px;';

                        var badgeHtml = '<div style="margin-top:1.5em; display:flex; flex-wrap:wrap; gap:6px;">';
                        badgeHtml += '<span style="' + badgeStyle + ' background:#1a3a6e; color:#5b9bd5; border:1px solid #2a5aa0;">' + qualBadge + '</span>';
                        if (cert) badgeHtml += '<span style="' + badgeStyle + ' background:#3a1a1a; color:#e07070; border:1px solid #8a3030;">' + cert + '</span>';
                        // IMDB badge
                        if (detail.imdb_id) {
                            badgeHtml += '<span style="' + badgeStyle + ' background:#2a2000; color:#e5b109; border:1px solid #8a6a00;">IMDb</span>';
                        }
                        // Season count for TV
                        if (detail.number_of_seasons) {
                            badgeHtml += '<span style="' + badgeStyle + ' background:#1a3a1a; color:#70c070; border:1px solid #2a7a2a;">' + detail.number_of_seasons + ' сез.</span>';
                        }
                        // Episode count for TV
                        if (detail.number_of_episodes) {
                            badgeHtml += '<span style="' + badgeStyle + ' background:#1a1a3a; color:#7070e0; border:1px solid #2a2a8a;">' + detail.number_of_episodes + ' еп.</span>';
                        }
                        badgeHtml += '</div>';
                        leftCol.append($(badgeHtml));

                        // Keywords
                        var kws = (detail.keywords && (detail.keywords.keywords || detail.keywords.results)) || [];
                        if (kws.length) {
                            var kwWrap = $('<div style="margin-top:1em;"></div>');
                            kwWrap.append($('<div>').css({fontSize:'0.7em', color:'#888', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:'0.5em', fontWeight:'bold'}).text(t.keywords));
                            var kwInner = $('<div style="display:flex; flex-wrap:wrap; gap:6px;"></div>');
                            kws.slice(0,10).forEach(function(k) {
                                kwInner.append($('<span>').css({
                                    background:'rgba(255,255,255,0.07)', color:'#ccc', padding:'3px 10px',
                                    borderRadius:'20px', fontSize:'0.82em', border:'1px solid rgba(255,255,255,0.1)'
                                }).text(k.name));
                            });
                            kwWrap.append(kwInner);
                            leftCol.append(kwWrap);
                        }
                    });

                    // ── RIGHT COL: Cast ──
                    var rightCol = $('<div style="flex: 1; min-width: 260px; display:flex; flex-direction:column; gap: 1.2em;"></div>');
                    rightCol.append($('<div>').css({fontSize:'0.7em', color:'#888', textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:'bold'}).text(t.cast));

                    var personsWrap = $('<div style="display:flex; flex-direction:column; gap: 0.8em;"></div>');
                    personsWrap.append($('<div>').css({color:'#666'}).text(t.loading));
                    rightCol.append(personsWrap);

                    // Fetch actors
                    var creditsUrl = Lampa.TMDB.api(type + '/' + movie.id + '/credits?api_key=' + Lampa.TMDB.key() + '&language=' + langUi);
                    $.get(creditsUrl, function(data) {
                        if (data.cast && data.cast.length) {
                            personsWrap.empty();
                            data.cast.slice(0, 8).forEach(function(actor) {
                                var imgUrl = actor.profile_path ? Lampa.TMDB.image('t/p/w185' + actor.profile_path) : '';
                                var row = $('<div>').css({display:'flex', alignItems:'center', gap:'0.8em'});
                                var imgWrap = $('<div>').css({width:'46px', height:'46px', borderRadius:'50%', overflow:'hidden', background:'#222', flexShrink:'0', border:'2px solid rgba(255,255,255,0.08)'});
                                var img = $('<img>').attr('src', imgUrl).css({width:'100%', height:'100%', objectFit:'cover'});
                                img.on('error', function() {
                                    imgWrap.css({display:'flex', alignItems:'center', justifyContent:'center'}).html('<svg viewBox="0 0 24 24" width="22" height="22" fill="#444"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>');
                                    img.remove();
                                });
                                imgWrap.append(img);
                                var info = $('<div>').css({overflow:'hidden', flex:1});
                                info.append($('<div>').css({fontWeight:600, fontSize:'1em', color:'#f0f0f0', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}).text(actor.name));
                                info.append($('<div>').css({fontSize:'0.8em', color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}).text(actor.character || ''));
                                row.append(imgWrap).append(info);
                                personsWrap.append(row);
                            });
                            // Director
                            if (data.crew) {
                                var director = data.crew.find(function(c){ return c.job === 'Director'; });
                                if (director) {
                                    rightCol.append($('<div>').css({marginTop:'1.5em'}));
                                    rightCol.append($('<div>').css({fontSize:'0.7em', color:'#888', textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:'bold', marginBottom:'0.5em'}).text(t.director));
                                    var dirRow = $('<div>').css({display:'flex', alignItems:'center', gap:'0.8em'});
                                    var dirImg = $('<div>').css({width:'42px', height:'42px', borderRadius:'50%', overflow:'hidden', background:'#222', flexShrink:'0', border:'2px solid rgba(255,255,255,0.08)'});
                                    if (director.profile_path) {
                                        dirImg.append($('<img>').attr('src', Lampa.TMDB.image('t/p/w185' + director.profile_path)).css({width:'100%', height:'100%', objectFit:'cover'}));
                                    }
                                    dirRow.append(dirImg).append($('<div>').css({fontWeight:600, color:'#f0f0f0'}).text(director.name));
                                    rightCol.append(dirRow);
                                }
                            }
                        } else {
                            personsWrap.html('<div style="color:#555;">' + t.desc_empty + '</div>');
                        }
                    }).fail(function() {
                        personsWrap.html('<div style="color:#555;">' + t.loading + '</div>');
                    });

                    grid.append(leftCol).append(rightCol);
                    container.append(grid);
                    overlay.append(closeBtn).append(container);
                    
                    $('body').append(overlay);
                    
                    // Controller with immediate focus for TV remote — back closes overlay
                    Lampa.Controller.add('ntflx_details', {
                        toggle: function () {
                            Lampa.Controller.collectionSet(overlay);
                            Lampa.Controller.collectionFocus(closeBtn[0], overlay);
                        },
                        up: function() { Lampa.Controller.collectionFocus(closeBtn[0], overlay); },
                        down: function() {},
                        right: function() {},
                        left: function() {},
                        back: closeUI
                    });
                    
                    Lampa.Controller.toggle('ntflx_details');
                });
                btnsParams.append(descBtn);
            }

            // ── Kill applecation.js scroll dimming on the background image ──
            // applecation.js hooks .scroll__body webkitTransform and adds .dim class to
            // .full-start__background on scroll — we override that setter to a no-op
            var scrollBody = render.find('.scroll__body')[0];
            if (scrollBody && !scrollBody._ntflxDimPatched) {
                scrollBody._ntflxDimPatched = true;
                var bgEl = render.find('.full-start__background:not(.applecation__overlay)')[0];
                if (bgEl) {
                    // Remove .dim immediately in case it was already applied
                    bgEl.classList.remove('dim');
                    // Override the setter that applecation.js registers so .dim never gets added
                    try {
                        var _origDesc = Object.getOwnPropertyDescriptor(scrollBody.style, '-webkit-transform') ||
                                       Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'webkitTransform');
                        Object.defineProperty(scrollBody.style, '-webkit-transform', {
                            set: function(val) {
                                // Skip the dim toggling, just set the value
                                if (_origDesc && _origDesc.set) _origDesc.set.call(this, val);
                                else this.setProperty('-webkit-transform', val);
                            },
                            get: function() {
                                return _origDesc && _origDesc.get ? _origDesc.get.call(this) : this.getPropertyValue('-webkit-transform');
                            },
                            configurable: true
                        });
                    } catch(e) {}
                }
            }

            // ── Remove ALL unwanted elements from DOM so Lampa scroll has zero dead zones ──
            var actComp = e.object.activity.component;
            var _ntflxLastItemCount = -1;

            var ntflxFilterItems = function() {
                if (!actComp || !actComp.items || !Array.isArray(actComp.items)) return;
                // Only re-filter if items array grew (new items added by Lampa async)
                if (actComp.items.length === _ntflxLastItemCount) return;

                actComp.items = actComp.items.filter(function(item) {
                    try {
                        if (!item || !item.render) return true;
                        // Skip items we already checked and approved
                        if (item._ntflxChecked) return true;

                        var el = item.render();
                        if (!el || el.length === 0) { item._ntflxChecked = true; return true; }

                        // MUST KEEP the main info block (contains buttons and title)
                        if (el.hasClass('full-start-new') || el.hasClass('full-start') || el.hasClass('full-start__main')) {
                            item._ntflxChecked = true;
                            return true;
                        }

                        // Check by CSS class (comment blocks)
                        var hasCommentClass = el.is('[class*="comment"]') || el.find('[class*="comment"]').length > 0;
                        // Check for actors component
                        var hasActorsClass = el.has('.full-person').length > 0;

                        // Check ONLY the title text, NOT the full element text
                        var hasBadTitle = false;
                        var titleEl = el.find('.items-line__title');
                        if (titleEl.length) {
                            var txt = titleEl.text().toLowerCase();
                            var banWords = ['детально','детали','подробно','описание','опис','обзор',
                                            'режисер','режиссер','актори','актеры','в ролях',
                                            'коментар','комментар',
                                            'director','comments','actors','review'];
                            for (var i = 0; i < banWords.length; i++) {
                                if (txt.indexOf(banWords[i]) !== -1) {
                                    hasBadTitle = true; break;
                                }
                            }
                        }

                        if (hasCommentClass || hasActorsClass || hasBadTitle) {
                            // Save actors before destroying
                            if (hasActorsClass && !window._ntflx_saved_persons) {
                                window._ntflx_saved_persons = [];
                                el.find('.full-person').each(function(){
                                    window._ntflx_saved_persons.push($(this).clone());
                                });
                            }
                            if (item.destroy) item.destroy();
                            else el.remove();
                            return false;
                        }
                        item._ntflxChecked = true;
                        return true;
                    } catch(err) {
                        return true;
                    }
                });

                _ntflxLastItemCount = actComp.items.length;
            };

            var ntflxCleanDOM = function() {
                // Clean visual dom items that don't block component navigation
                render.find([
                    '.full-start-new__details', '.full-start__details',
                    '.full-start-new__reactions', '.full-start__reactions',
                    '.full-start-new__params', '.full-start__params',
                    '.full-start-new__vote', '.full-start__vote',
                    '.full-start-new__bottom', '.full-start__bottom',
                    '.full-start-new__text', '.full-start__text',
                    '.full-start-new__description', '.full-start__description',
                    '.full-start-new__tagline', '.full-start__tagline',
                    '.full-start-new__rate', '.full-start__rate',
                    '.full-start-new__status', '.full-start__status',
                    '.full-start-new__rate-line', '.full-start__rate-line',
                    '.full-start-new__tags', '.full-start__tags',
                    '.full-start-new__info', '.full-start__info',
                    '.applecation__overlay', '.application__overlay',
                    '.full-start-new__persons', '.full-start__persons'
                ].join(', ')).remove();
            };

            // Run cleanup immediately
            ntflxFilterItems();
            ntflxCleanDOM();

            // Watch for lazy-loaded content permanently (some Lampa plugins inject widgets very late)
            // Only trigger cleanup when new nodes are actually added to avoid infinite loops
            var hideObserver = new MutationObserver(function(mutations) {
                var added = false;
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].addedNodes && mutations[i].addedNodes.length > 0) {
                        added = true;
                        break;
                    }
                }
                if (added) {
                    ntflxFilterItems();
                    ntflxCleanDOM();
                }
            });
            hideObserver.observe(render[0], { childList: true, subtree: true });

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
        if (window.__ntflx_cards_bound) return;
        window.__ntflx_cards_bound = true;

        // ── Suppress auto-focus scaling until user interacts ──
        function enableInteraction() {
            document.body.classList.add('ntflx-user-interacted');
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
                if (val >= 7.5) color = '#2ecc71'; // green
                else if (val >= 6.5) color = '#f1c40f'; // yellow
                else if (val >= 5.0) color = '#e67e22'; // orange
                else color = 'var(--ntflx-accent)'; // red
                el.style.setProperty('background', color, 'important');
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
        var old = document.getElementById('ntflx-premium-v9');
        if (old) old.remove();

        var accent = Lampa.Storage.get('ntflx_accent_color', '#ec130e');
        var fontFam = Lampa.Storage.get('ntflx_font_family', 'Manrope');
        var fontSb = Lampa.Storage.get('ntflx_font_size_sidebar', '1.1em');
        var scale = Lampa.Storage.get('ntflx_card_scale', '1.35');
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
        var cardRad = Lampa.Storage.get('ntflx_card_radius', '4px');

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
        var fontImport = '@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600&display=swap");';

        var css = `
/* ================================================================
   NTFLX Premium Style v9.0 — UI Customization
   ================================================================ */

${fontImport}

:root {
    --ntflx-bg: #0a0d12;
    --ntflx-accent: ${accent};
    --ntflx-accent-rgb: ${accentRgb};
    --ntflx-accent-gl: rgba(${accentRgb}, 0.5);
    --ntflx-accent-bg: rgba(${accentRgb}, 0.7);
    --ntflx-text: #f0f0f0;
    --ntflx-font: '${fontFam}', 'Helvetica Neue', Arial, sans-serif;
    --ntflx-font-label: 'Inter', sans-serif;
    --ntflx-card-scale: ${scale};
    --ntflx-shift: 25%;
    --ntflx-edge-nudge: ${shift};
    --ntflx-sb-blur: ${blur};
    --ntflx-duration: 420ms;
    --ntflx-ease: cubic-bezier(0.4, 0, 0.2, 1);
    --ntflx-radius: ${cardRad};
    --ntflx-card-border-focus: ${bFocus};
    --ntflx-card-border-idle: ${bIdle};
    --ntflx-shadow-text: 0 2px 10px rgba(0,0,0,0.8);
}

/* Hide ALL extraneous hero info blocks */
.full-start-new__tagline, .full-start__tagline,
.full-start-new__rate, .full-start__rate,
.full-start-new__status, .full-start__status,
.full-start-new__details, .full-start__details,
.full-start-new__reactions, .full-start__reactions,
.full-start-new__params, .full-start__params,
.full-start-new__vote, .full-start__vote,
.full-start-new__bottom, .full-start__bottom,
.full-start-new__text, .full-start__text,
.full-start-new__description, .full-start__description,
.full-start-new__rate-line, .full-start__rate-line,
.full-start-new__tags, .full-start__tags,
.full-start-new__info, .full-start__info,
.full-start-new__persons, .full-start__persons {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    overflow: hidden !important;
    pointer-events: none !important;
    margin: 0 !important;
    padding: 0 !important;
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
    transition: transform var(--ntflx-duration) var(--ntflx-ease),
                z-index 0s !important;
    z-index: 1 !important;
    will-change: transform !important;
    backface-visibility: hidden !important;
    -webkit-backface-visibility: hidden !important;
    transform: translate3d(0, 0, 0) !important;
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

/* Card title below */
.card__title {
    font-family: var(--ntflx-font) !important;
    font-size: 0.85em !important;
    font-weight: 600 !important;
    color: var(--ntflx-text) !important;
    padding: 4px 2px 0px !important;
    line-height: 1.1 !important;
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
    font-family: var(--ntflx-font) !important;
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
    font-family: var(--ntflx-font) !important;
    line-height: 1.4 !important;
    pointer-events: none !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
}

.card__age { display: none !important; }


/* ================================================================
   3) CARD FOCUS — clean poster + red glow (NO overlays)
   ================================================================ */

/* ── Suppress auto-focus until user interaction ── */
body:not(.ntflx-user-interacted) .card.focus,
body:not(.ntflx-user-interacted) .card.hover {
    transform: translate3d(0, 0, 0) !important;
    z-index: 1 !important;
}

body:not(.ntflx-user-interacted) .card.focus .card__view,
body:not(.ntflx-user-interacted) .card.hover .card__view {
    border-color: var(--ntflx-card-border-idle) !important;
}

body:not(.ntflx-user-interacted) .card.focus .card__view::before,
body:not(.ntflx-user-interacted) .card.hover .card__view::before {
    opacity: 0 !important;
}

body:not(.ntflx-user-interacted) .card.focus ~ .card,
body:not(.ntflx-user-interacted) .card.hover ~ .card {
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
    transform: scale3d(var(--ntflx-card-scale), var(--ntflx-card-scale), 1) !important;
}

/* Focused card — subtle red glow + clean shadow */
.card.focus .card__view,
.card.hover .card__view,
.card:hover .card__view {
    border-color: var(--ntflx-card-border-focus) !important;
}

.card.focus .card__view::before,
.card.hover .card__view::before,
.card:hover .card__view::before {
    opacity: 1 !important;
}

/* ── NEIGHBOR SHIFTING (GPU translate3d) ── */
.card.focus ~ .card,
.card.hover ~ .card,
.card:hover ~ .card {
    transform: translate3d(var(--ntflx-shift), 0, 0) !important;
    z-index: 1 !important;
}

/* ── EDGE CARDS: origin + translate3d offset to prevent clipping ── */

/* First card: left-origin scale + 20px rightward nudge (no clip) */
.card[data-ntflx-edge="first"].focus,
.card[data-ntflx-edge="first"].hover,
.card[data-ntflx-edge="first"]:hover {
    transform-origin: left center !important;
    transform: scale3d(var(--ntflx-card-scale), var(--ntflx-card-scale), 1)
               translate3d(var(--ntflx-edge-nudge), 0, 0) !important;
}

/* First card's neighbors: standard shift + extra 20px to compensate */
.card[data-ntflx-edge="first"].focus ~ .card,
.card[data-ntflx-edge="first"].hover ~ .card,
.card[data-ntflx-edge="first"]:hover ~ .card {
    transform: translate3d(calc(var(--ntflx-shift) + var(--ntflx-edge-nudge)), 0, 0) !important;
}

/* Last card: right-origin scale + 20px leftward nudge (no clip) */
.card[data-ntflx-edge="last"].focus,
.card[data-ntflx-edge="last"].hover,
.card[data-ntflx-edge="last"]:hover {
    transform-origin: right center !important;
    transform: scale3d(var(--ntflx-card-scale), var(--ntflx-card-scale), 1)
               translate3d(calc(var(--ntflx-edge-nudge) * -1), 0, 0) !important;
}

/* Reduce shift for the last card when a non-edge sibling is focused */
.card.focus ~ .card[data-ntflx-edge="last"],
.card.hover ~ .card[data-ntflx-edge="last"],
.card:hover ~ .card[data-ntflx-edge="last"] {
    transform: translate3d(calc(var(--ntflx-shift) * 0.5), 0, 0) !important;
}

/* ── SINGLE CARD: use left-origin (no clip) but NO shift ── */
.card[data-ntflx-single="true"].focus,
.card[data-ntflx-single="true"].hover,
.card[data-ntflx-single="true"]:hover {
    transform-origin: left center !important;
    transform: scale3d(var(--ntflx-card-scale), var(--ntflx-card-scale), 1) !important;
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


/* All static overlays/gradients are fully killed below */

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

/* ── DYNAMIC SCROLL FOG LAYER DISABLED ── */
.full-start-new::before, .full-start::before {
    display: none !important;
}

/* ── HIDE DETAILS TEXT (Replaced by Info Button) ── */
.full-start-new__text, .full-start__text {
    display: none !important;
    height: 0 !important;
    overflow: hidden !important;
    margin: 0 !important; padding: 0 !important;
}

/* ── HIDE REACTIONS + all dead-space blocks ── */
/* These must have height:0 so Lampa scroll controller skips them */
.full-start-new__reactions,
.full-start__reactions,
.full-start-new__params,
.full-start__params,
.full-start-new__vote,
.full-start__vote,
.full-start-new__bottom,
.full-start__bottom {
    display: none !important;
    height: 0 !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    pointer-events: none !important;
}

/* ── Kill ALL bottom fog/overlay on desktop too ── */
.applecation__overlay,
.application__overlay {
    display: none !important;
    background: none !important;
}

/* ── Content: left-aligned, bottom-weighted ── */
.full-start-new__body, .full-start__body {
    position: relative !important; z-index: 2 !important; padding-left: 5% !important;
    display: flex !important; align-items: flex-end !important;
    min-height: 80vh !important; /* Keep full height so recs start below hero */
    padding-top: 6em !important;
    padding-bottom: 2.5em !important; background: none !important;
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

/* Description text — hidden (moved to "Про фільм" overlay) */
.full-start-new__text,
.full-start__text,
.full-start-new__description,
.full-start__description {
    display: none !important;
    height: 0 !important;
    overflow: hidden !important;
    pointer-events: none !important;
    margin: 0 !important;
    padding: 0 !important;
}

/* ── Premium Buttons ── */

/* Inactive buttons: grayish semi-transparent glass */
.full-start__button,
.full-start-new__button {
    font-family: var(--ntflx-font) !important;
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
    background: var(--ntflx-accent-bg) !important;
    backdrop-filter: blur(12px) !important;
    -webkit-backdrop-filter: blur(12px) !important;
    border: 1px solid rgba(255,255,255,0.3) !important;
    color: #ffffff !important;
    box-shadow: 0 0 20px var(--ntflx-accent-gl),
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

.menu__item {
    border-radius: 0 !important;
    background: rgba(255, 255, 255, 0.04) !important;
    border-left: 3px solid transparent !important;
    padding: 0.55em 1.4em 0.55em 1em !important;
    margin: 0 !important;
    transition: border-color 200ms ease,
                background 200ms ease !important;
    display: flex;
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
    border-left: 3px solid var(--ntflx-accent) !important;
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

/* Make header float perfectly transparent over everything */
.head {
    position: absolute !important;
    top: 0 !important; left: 0 !important; right: 0 !important; width: 100% !important;
    background: transparent !important; background-color: transparent !important; background-image: none !important;
    backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
    border: none !important; box-shadow: none !important; z-index: 100 !important;
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
`;

        var style = document.createElement('style');
        style.id = 'ntflx-premium-v9';
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
                'ps_title': 'Premium Style',
                'accent_color': 'Accent Color',
                'red': 'NTFLX Red',
                'green': 'Green',
                'blue': 'Blue',
                'orange': 'Orange',
                'purple': 'Purple',
                'pink': 'Pink',
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
                'ps_title': 'Premium Style',
                'accent_color': 'Акцентний колір',
                'red': 'Червоний (NTFLX)',
                'green': 'Зелений',
                'blue': 'Синій',
                'orange': 'Помаранчевий',
                'purple': 'Фіолетовий',
                'pink': 'Рожевий',
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
                'ps_title': 'Premium Style',
                'accent_color': 'Акцентный цвет',
                'red': 'Красный (NTFLX)',
                'green': 'Зеленый',
                'blue': 'Синий',
                'orange': 'Оранжевый',
                'purple': 'Фиолетовый',
                'pink': 'Розовый',
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
            { name: 'ntflx_accent_color', type: 'select', values: { '#e50914': t('red'), '#2ecc71': t('green'), '#3498db': t('blue'), '#e67e22': t('orange'), '#9b59b6': t('purple'), '#e91e63': t('pink') }, default: '#e50914', title: t('accent_color') },
            { name: 'ntflx_logo_lang', type: 'select', values: { 'auto': t('auto'), 'uk': 'Ukrainian (UK/UA)', 'ru': 'Russian (RU)', 'en': 'English (EN)' }, default: 'auto', title: t('logo_lang') },
            { name: 'ntflx_font_family', type: 'select', values: { 'Montserrat': 'Montserrat', 'Roboto': 'Roboto', 'Open Sans': 'Open Sans', 'Inter': 'Inter' }, default: 'Montserrat', title: t('font_family') },
            { name: 'ntflx_card_border_focus', type: 'select', values: { 'transparent': t('transparent'), 'accent': t('accent_color'), 'white': t('white') }, default: 'accent', title: t('card_border_focus') },
            { name: 'ntflx_card_border_idle', type: 'select', values: { 'transparent': t('transparent'), 'accent': t('accent_color'), 'white': t('white'), 'black': t('black') }, default: 'transparent', title: t('card_border_idle') },
            { name: 'ntflx_card_radius', type: 'select', values: { '0px': t('square'), '4px': t('small_rad'), '8px': t('med_rad') + ' (' + t('default') + ')', '12px': t('large_rad'), '16px': t('xl_rad') }, default: '8px', title: t('card_radius') },
            { name: 'ntflx_font_size_sidebar', type: 'select', values: { 'native': t('native_off'), '0.9em': t('small'), '1.0em': t('normal'), '1.1em': t('large'), '1.2em': t('xlarge') }, default: '1.1em', title: t('sidebar_font_size') },
            { name: 'ntflx_sidebar_width', type: 'select', values: { 'native': t('native_off'), '220px': t('compact'), '280px': t('normal') + ' (' + t('default') + ')', '340px': t('wide'), '400px': t('uwide') }, default: '280px', title: t('sb_width') },
            { name: 'ntflx_sidebar_opacity', type: 'select', values: { 'native': t('native_off'), '0.1': t('clear'), '0.45': t('glassy'), '0.75': t('dark_glass'), '0.95': t('solid') }, default: '0.45', title: t('sb_opacity') },
            { name: 'ntflx_card_scale', type: 'select', values: { '1.1': '1.10x', '1.25': '1.25x', '1.35': '1.35x (' + t('default') + ')', '1.45': '1.45x' }, default: '1.35', title: t('card_scale') },
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
        if (window.__ntflx_premium_v9) return;
        window.__ntflx_premium_v9 = true;

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

        console.log('[NTFLX Premium] v9.22 — Ultimate Performance & TV Compatibility');
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
