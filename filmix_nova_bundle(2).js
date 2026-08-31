/**
 * Filmix Pro+ (stable v2) + Nova Skin compatible
 * Install WITH: https://piwas84.github.io/NV/nova_skin_premium.js
 * Settings -> Filmix Pro+ -> token
 */
(function () {
  'use strict';

  if (window.__filmix_nova_bundle_v2) return;
  window.__filmix_nova_bundle_v2 = true;

  var COMPONENT = 'online_filmix';
  var API_DEFAULT = 'http://filmixapp.cyou/api/v2/';

  function t(key) {
    try { return Lampa.Lang.translate(key); } catch (e) { return key; }
  }
  function storeGet(k, d) {
    try { return Lampa.Storage.get(k, d); } catch (e) { return d; }
  }
  function storeSet(k, v) {
    try { Lampa.Storage.set(k, v); } catch (e) {}
  }
  function getToken() {
    return String(storeGet('filmix_token', '') || storeGet('online_filmix_token', '') || '').trim();
  }
  function getApi() {
    var a = String(storeGet('online_filmix_api', '') || API_DEFAULT).trim() || API_DEFAULT;
    if (a.slice(-1) !== '/') a += '/';
    return a;
  }
  function getDevId() {
    var id = storeGet('filmix_dev_id', '');
    if (!id) {
      try { id = Lampa.Utils.uid(16); } catch (e) { id = String(Date.now()); }
      storeSet('filmix_dev_id', id);
    }
    return id;
  }
  function devQuery(token) {
    return 'user_dev_apk=2.0.1&user_dev_id=' + encodeURIComponent(getDevId()) +
      '&user_dev_name=Xiaomi&user_dev_os=11&user_dev_token=' + encodeURIComponent(token || '') +
      '&user_dev_vendor=Xiaomi';
  }
  function ensureFilmixState() {
    if (!window.filmix) window.filmix = { max_qualitie: 720, is_max_qualitie: false };
  }

  if (Lampa.Lang && Lampa.Lang.add) {
    Lampa.Lang.add({
      online_filmix_title: { ru: 'Filmix', uk: 'Filmix', en: 'Filmix' },
      filmix_need_token: {
        ru: 'Укажите токен Filmix: Настройки → Filmix Pro+',
        uk: 'Вкажи токен Filmix: Налаштування → Filmix Pro+',
        en: 'Set Filmix token in settings'
      },
      filmix_bad_json: {
        ru: 'Filmix вернул ошибку',
        uk: 'Filmix повернув помилку',
        en: 'Filmix error'
      },
      online_nolink: { ru: 'Нет ссылки', uk: 'Немає посилання', en: 'No link' },
      online_query_start: { ru: 'По запросу', uk: 'На запит', en: 'On request' },
      online_query_end: { ru: 'нет результатов', uk: 'немає результатів', en: 'no results' }
    });
  }

  try {
    Lampa.Template.add('online_prestige_item',
      '<div class="online-prestige online-prestige--full selector video--stream">' +
      '<div class="online-prestige__body">' +
      '<div class="online-prestige__title">{title}</div>' +
      '<div class="online-prestige__info"><div>{info}</div></div>' +
      '<div class="online-prestige__quality">{quality}</div></div></div>');
    Lampa.Template.add('online_prestige_folder',
      '<div class="online-prestige online-prestige--folder selector">' +
      '<div class="online-prestige__body">' +
      '<div class="online-prestige__title">{title}</div>' +
      '<div class="online-prestige__info"><div>{info}</div></div>' +
      '<div class="online-prestige__quality">{quality}</div></div></div>');
    Lampa.Template.add('online',
      '<div class="online selector"><div class="online__body">' +
      '<div class="online__title">{title}</div>' +
      '<div class="online__quality">{quality}{info}</div></div></div>');
  } catch (e) {}

  function request(url, ok, fail) {
    var net = new Lampa.Reguest();
    net.timeout(15000);
    var done = false;
    function success(data) {
      if (done) return;
      done = true;
      try { ok(data); } catch (e) { if (fail) fail(e); }
    }
    function error(a, c) {
      if (done) return;
      done = true;
      if (fail) fail(a, c);
    }
    try {
      if (net.native) net.native(url, success, error);
      else net.silent(url, success, error);
    } catch (e) {
      try { net.silent(url, success, error); } catch (e2) { error(e2); }
    }
    return net;
  }

  function checkProfile(token, cb) {
    ensureFilmixState();
    if (!token) { if (cb) cb(null); return; }
    request(getApi() + 'user_profile?' + devQuery(token), function (found) {
      if (found && found.user_data) {
        storeSet('filmix_status', found.user_data);
        if (found.user_data.is_pro_plus) window.filmix.max_qualitie = 2160;
        else if (found.user_data.is_pro) window.filmix.max_qualitie = 1080;
        else window.filmix.max_qualitie = 720;
        window.filmix.is_max_qualitie = true;
      }
      if (cb) cb(found);
    }, function () { if (cb) cb(null); });
  }

  function FilmixSource(component, object) {
    var results = null;
    var extract = {};
    var choice = { season: 0, voice: 0, voice_name: '' };
    var filter_items = { season: [], voice: [], voice_info: [] };
    var select_title = '';
    var wait_similars = false;
    var net = null;

    this.search = function (obj, data) {
      object = obj || object;
      select_title = (object.movie && (object.movie.title || object.movie.name)) || '';
      if (wait_similars && data && data[0] && data[0].id) { this.find(data[0].id); return; }

      var token = getToken();
      if (!token) { component.empty(t('filmix_need_token')); return; }

      var item = (data && data[0]) || { title: select_title };
      var year = parseInt(String((object.movie && (object.movie.release_date || object.movie.first_air_date)) || '0000').slice(0, 4), 10);
      var orig = (object.movie && (object.movie.original_title || object.movie.original_name)) || '';
      var url = getApi() + 'search?story=' + encodeURIComponent(item.title || select_title) + '&' + devQuery(token);

      if (net) try { net.clear(); } catch (e) {}
      var self = this;
      net = request(url, function (json) {
        if (!json || !Array.isArray(json)) { component.empty(t('filmix_bad_json')); return; }
        if (!json.length) { component.emptyForQuery(select_title); return; }

        var cards = [];
        for (var i = 0; i < json.length; i++) {
          var c = json[i];
          try { c.year = parseInt(String(c.alt_name || '').split('-').pop(), 10) || c.year || 0; }
          catch (e) { c.year = c.year || 0; }
          if (!year || (c.year > year - 2 && c.year < year + 2)) cards.push(c);
        }
        if (!cards.length) cards = json;

        var card = null;
        // 1) точний рік
        if (year) {
          for (var j = 0; j < cards.length; j++) {
            if (parseInt(cards[j].year, 10) === year) { card = cards[j]; break; }
          }
        }
        // 2) original title
        if (!card && orig) {
          var origLow = String(orig).toLowerCase();
          for (var k = 0; k < cards.length; k++) {
            var ot = String(cards[k].original_title || '').toLowerCase();
            var tt = String(cards[k].title || '').toLowerCase();
            if (ot === origLow || tt === origLow) { card = cards[k]; break; }
          }
        }
        // 3) частковий збіг назви
        if (!card) {
          var q = String(item.title || select_title || '').toLowerCase();
          for (var m = 0; m < cards.length; m++) {
            var t1 = String(cards[m].title || '').toLowerCase();
            var t2 = String(cards[m].original_title || '').toLowerCase();
            if ((q && t1.indexOf(q) !== -1) || (q && t2.indexOf(q) !== -1) || (t1 && q.indexOf(t1) !== -1)) {
              card = cards[m];
              break;
            }
          }
        }
        // 4) перший результат — краще ніж порожньо
        if (!card && cards.length) card = cards[0];

        if (card && card.id) {
          self.find(card.id);
        } else if (json.length > 1) {
          wait_similars = true;
          component.similars(json);
          component.loading(false);
        } else {
          component.emptyForQuery(select_title);
        }
      }, function (a, c) {
        var msg = 'Filmix network error';
        try { if (net && net.errorDecode) msg = net.errorDecode(a, c); } catch (e) {}
        component.empty(String(msg));
      });
    };

    this.find = function (filmix_id) {
      var token = getToken();
      if (!token || !filmix_id) { component.emptyForQuery(select_title); return; }

      function loadPost() {
        net = request(getApi() + 'post/' + filmix_id + '?' + devQuery(token), function (found) {
          if (!found || typeof found !== 'object' || !found.player_links) {
            component.emptyForQuery(select_title);
            return;
          }
          success(found);
          component.loading(false);
        }, function (a, c) {
          component.empty('Filmix: ' + String((c && c.message) || a || 'error'));
        });
      }

      ensureFilmixState();
      if (!window.filmix.is_max_qualitie) checkProfile(token, loadPost);
      else loadPost();
    };

    this.extendChoice = function (saved) {
      try { Lampa.Arrays.extend(choice, saved || {}, true); }
      catch (e) {
        if (saved) {
          if (typeof saved.season !== 'undefined') choice.season = saved.season;
          if (typeof saved.voice !== 'undefined') choice.voice = saved.voice;
          if (saved.voice_name) choice.voice_name = saved.voice_name;
        }
      }
    };

    this.reset = function () {
      choice = { season: 0, voice: 0, voice_name: '' };
      component.reset();
      if (results) { extractData(results); buildFilter(); append(filtred()); }
      component.saveChoice(choice);
    };

    this.filter = function (type, a, b) {
      choice[a.stype] = b.index;
      if (a.stype === 'voice') choice.voice_name = filter_items.voice[b.index];
      component.reset();
      extractData(results);
      buildFilter();
      append(filtred());
      component.saveChoice(choice);
    };

    this.destroy = function () {
      if (net) try { net.clear(); } catch (e) {}
      results = null;
      extract = {};
    };

    function success(json) {
      results = json;
      extractData(json);
      buildFilter();
      append(filtred());
    }

    function extractData(data) {
      extract = {};
      if (!data || !data.player_links) return;
      var pl = data.player_links;
      var maxQ = (window.filmix && window.filmix.max_qualitie) || 720;

      function parseQualities(link) {
        var qeps = [];
        var m = String(link || '').match(/\[([^\]]+)\]/);
        if (m) {
          var parts = m[1].split(',');
          for (var i = 0; i < parts.length; i++) {
            var n = parseInt(parts[i], 10);
            if (n && n <= maxQ) qeps.push(n);
          }
        }
        if (!qeps.length) {
          // інколи лише одне число в імені
          var m2 = String(link || '').match(/_(\d{3,4})\.mp4/i);
          if (m2) {
            var n2 = parseInt(m2[1], 10);
            if (n2 && n2 <= maxQ) qeps.push(n2);
          }
        }
        if (!qeps.length) qeps = [480];
        return qeps;
      }

      function makeFileUrl(link, quality) {
        var s = String(link || '');
        if (/\[[^\]]+\]/.test(s)) return s.replace(/\[[^\]]+\]/, String(quality));
        return s.replace('%s', String(quality)).replace('%s.mp4', quality + '.mp4');
      }

      // ---- movie: масив АБО об'єкт ----
      var movieList = [];
      if (Array.isArray(pl.movie)) movieList = pl.movie;
      else if (pl.movie && typeof pl.movie === 'object') {
        for (var mk in pl.movie) {
          if (Object.prototype.hasOwnProperty.call(pl.movie, mk)) movieList.push(pl.movie[mk]);
        }
      }

      for (var mi = 0; mi < movieList.length; mi++) {
        var fm = movieList[mi];
        if (!fm || !fm.link) continue;
        var vname = fm.translation || fm.quality || ('Озвучка ' + (mi + 1));
        // блоковані теж показуємо, щоб було видно причину
        var qeps = parseQualities(fm.link);
        var mq = Math.max.apply(null, qeps);
        var file_url = makeFileUrl(fm.link, mq);
        extract[vname] = {
          translation: mi + 1,
          json: {
            1: {
              id: 1,
              folder: [{
                translation: mi + 1,
                season: 0,
                episode: 0,
                title: vname,
                quality: mq,
                qualities: qeps,
                link: file_url,
                voice: vname
              }]
            }
          }
        };
      }

      // ---- playlist: масив сезонів або вкладений об'єкт ----
      var seasons = pl.playlist;
      if (Array.isArray(seasons) && seasons.length) {
        // іноді API віддає playlist як список епізодів/сезонів
        for (var si = 0; si < seasons.length; si++) {
          var node = seasons[si];
          if (!node) continue;
          // варіант: { season: 1, episodes: [...] } або { translation, link }
          if (node.link) {
            var vn = node.translation || ('S' + (si + 1));
            var qe = parseQualities(node.link);
            var mq2 = Math.max.apply(null, qe);
            if (!extract[vn]) extract[vn] = { translation: si + 1, json: {} };
            if (!extract[vn].json[1]) extract[vn].json[1] = { id: 1, folder: [] };
            extract[vn].json[1].folder.push({
              translation: si + 1,
              season: node.season || 1,
              episode: node.episode || (si + 1),
              title: vn + ' — ' + (node.title || ('E' + (node.episode || si + 1))),
              quality: mq2,
              qualities: qe,
              link: makeFileUrl(node.link, mq2),
              voice: vn
            });
          } else if (typeof node === 'object') {
            // { "Дубляж": { "1": {link, qualities}, ... }, ... }
            for (var voice in node) {
              if (!Object.prototype.hasOwnProperty.call(node, voice)) continue;
              if (voice === 'season' || voice === 'title') continue;
              var episode_voice = node[voice];
              if (!episode_voice || typeof episode_voice !== 'object') continue;
              if (!extract[voice]) extract[voice] = { translation: Object.keys(extract).length + 1, json: {} };
              var seasId = node.season || (si + 1);
              if (!extract[voice].json[seasId]) extract[voice].json[seasId] = { id: seasId, folder: [] };
              for (var eid in episode_voice) {
                if (!Object.prototype.hasOwnProperty.call(episode_voice, eid)) continue;
                var fe = episode_voice[eid];
                if (!fe || !fe.link) continue;
                var qe2 = (fe.qualities && fe.qualities.length) ? fe.qualities.filter(function (q) { return q <= maxQ; }) : parseQualities(fe.link);
                if (!qe2.length) qe2 = [480];
                var mq3 = Math.max.apply(null, qe2);
                extract[voice].json[seasId].folder.push({
                  translation: extract[voice].translation,
                  season: seasId,
                  episode: parseInt(eid, 10) || 1,
                  title: voice + ' — S' + seasId + 'E' + (parseInt(eid, 10) || 1),
                  quality: mq3,
                  qualities: qe2,
                  link: makeFileUrl(fe.link, mq3),
                  voice: voice
                });
              }
            }
          }
        }
      } else if (seasons && typeof seasons === 'object' && !Array.isArray(seasons)) {
        // класичний формат: playlist[seasonName][voice][episode]
        var seas_num = 0;
        for (var season in seasons) {
          if (!Object.prototype.hasOwnProperty.call(seasons, season)) continue;
          var episode = seasons[season];
          seas_num++;
          var transl_id = 0;
          for (var voice2 in episode) {
            if (!Object.prototype.hasOwnProperty.call(episode, voice2)) continue;
            transl_id++;
            var episode_voice2 = episode[voice2];
            var items = [];
            for (var ID in episode_voice2) {
              if (!Object.prototype.hasOwnProperty.call(episode_voice2, ID)) continue;
              var fe2 = episode_voice2[ID];
              if (!fe2 || !fe2.link) continue;
              var quality_eps = [];
              if (fe2.qualities && fe2.qualities.length) {
                for (var qi = 0; qi < fe2.qualities.length; qi++)
                  if (fe2.qualities[qi] <= maxQ) quality_eps.push(fe2.qualities[qi]);
              }
              if (!quality_eps.length) quality_eps = parseQualities(fe2.link);
              var max_quality = Math.max.apply(null, quality_eps);
              var stream_url = makeFileUrl(fe2.link, max_quality);
              var seas_n = seas_num, epis_n = parseInt(ID, 10) || 1;
              try {
                var mm = stream_url.match(/s(\d+)e(\d+)/i);
                if (mm) { seas_n = parseInt(mm[1], 10); epis_n = parseInt(mm[2], 10); }
              } catch (e) {}
              items.push({
                translation: transl_id, season: seas_n, episode: epis_n,
                title: voice2 + ' — S' + seas_n + 'E' + epis_n,
                quality: max_quality, qualities: quality_eps, link: stream_url, voice: voice2
              });
            }
            if (!extract[voice2]) extract[voice2] = { json: {}, translation: transl_id };
            extract[voice2].json[seas_num] = { id: seas_num, folder: items };
          }
        }
      }
    }

    function buildFilter() {
      filter_items = { season: [], voice: [], voice_info: [] };
      if (results && results.last_episode && results.last_episode.season) {
        var s = results.last_episode.season;
        while (s--) filter_items.season.push(t('torrent_serial_season') + ' ' + (results.last_episode.season - s));
      }
      var d = 0;
      for (var voic in extract) {
        if (!Object.prototype.hasOwnProperty.call(extract, voic)) continue;
        d++;
        if (filter_items.voice.indexOf(voic) === -1) {
          filter_items.voice.push(voic);
          filter_items.voice_info.push({ id: d });
        }
      }
      if (!filter_items.season.length && results && results.player_links && results.player_links.playlist) {
        var keys = Object.keys(results.player_links.playlist);
        for (var si = 0; si < keys.length; si++)
          filter_items.season.push(t('torrent_serial_season') + ' ' + (si + 1));
      }
      if (choice.voice_name) {
        var inx = filter_items.voice.indexOf(choice.voice_name);
        choice.voice = inx === -1 ? 0 : inx;
      }
      if (choice.voice >= filter_items.voice.length) choice.voice = 0;
      if (choice.season >= filter_items.season.length) choice.season = 0;
      component.filter(filter_items, choice);
    }

    function filtred() {
      var out = [];
      var voiceName = filter_items.voice[choice.voice];
      if (!voiceName || !extract[voiceName]) {
        for (var vn in extract) {
          if (!Object.prototype.hasOwnProperty.call(extract, vn)) continue;
          for (var sid in extract[vn].json) {
            if (!Object.prototype.hasOwnProperty.call(extract[vn].json, sid)) continue;
            var folder = extract[vn].json[sid].folder || [];
            for (var fi = 0; fi < folder.length; fi++) out.push(folder[fi]);
          }
        }
        return out;
      }
      var pack = extract[voiceName];
      var seasonIndex = choice.season + 1;
      var hasSeasons = filter_items.season.length > 0;
      for (var sid2 in pack.json) {
        if (!Object.prototype.hasOwnProperty.call(pack.json, sid2)) continue;
        var ep = pack.json[sid2];
        if (hasSeasons && parseInt(ep.id, 10) !== seasonIndex && parseInt(sid2, 10) !== seasonIndex) continue;
        var folder2 = ep.folder || [];
        for (var fj = 0; fj < folder2.length; fj++) out.push(folder2[fj]);
      }
      if (!out.length && !hasSeasons) {
        for (var sid3 in pack.json) {
          if (!Object.prototype.hasOwnProperty.call(pack.json, sid3)) continue;
          var folder3 = pack.json[sid3].folder || [];
          for (var fk = 0; fk < folder3.length; fk++) out.push(folder3[fk]);
        }
      }
      return out;
    }

    function getFile(element) {
      var maxQ = element.quality || (window.filmix && window.filmix.max_qualitie) || 720;
      var file = element.link || '';
      var quality = {};
      if (element.qualities && element.qualities.length && file.indexOf('_') > 0) {
        var qpos = file.indexOf('?');
        var cut = qpos > 0 ? qpos : file.length;
        var idx = file.lastIndexOf('_', cut - 1);
        if (idx > 0) {
          var linkBase = file.slice(0, idx + 1);
          var orin = qpos > 0 ? file.slice(qpos) : '';
          for (var i = 0; i < element.qualities.length; i++) {
            var n = element.qualities[i];
            quality[n + 'p'] = linkBase + n + '.mp4' + orin;
          }
          var pref = storeGet('video_quality_default', '1080') + 'p';
          if (quality[pref]) file = quality[pref];
          else if (quality[maxQ + 'p']) file = quality[maxQ + 'p'];
        }
      }
      return { file: file, quality: quality };
    }

    function append(items) {
      if (!items || !items.length) { component.emptyForQuery(select_title); return; }
      var viewed = storeGet('online_view', []);
      if (!Array.isArray(viewed)) viewed = [];

      for (var i = 0; i < items.length; i++) {
        (function (element) {
          var hash_file = String(element.title) + String(element.link || '');
          try {
            hash_file = Lampa.Utils.hash(
              element.season
                ? [element.season, element.episode, object.movie.original_title, element.voice || element.title].join('')
                : (object.movie.original_title || object.movie.title || '') + element.title
            );
          } catch (e) {}

          var view = { percent: 0, time: 0, duration: 0, hash: hash_file };
          try { view = Lampa.Timeline.view(hash_file); } catch (e) {}

          element.info = element.voice ? ' / ' + element.voice : '';
          element.quality = element.quality ? element.quality + 'p' : '';

          var item;
          try { item = Lampa.Template.get('online_prestige_item', element); } catch (e) { item = null; }
          if (!item || !item.length) {
            try { item = Lampa.Template.get('online', element); }
            catch (e2) {
              item = $('<div class="online selector"><div class="online__body"><div class="online__title">' +
                (element.title || '') + '</div></div></div>');
            }
          }
          try { item.addClass('video--stream online-prestige online-prestige--full'); } catch (e) {}
          try { element.timeline = view; item.append(Lampa.Timeline.render(view)); } catch (e) {}

          if (viewed.indexOf(hash_file) !== -1) {
            try {
              item.append('<div class="torrent-item__viewed online-prestige__viewed">' +
                (Lampa.Template.get('icon_star', {}, true) || '*') + '</div>');
            } catch (e) {}
          }

          item.on('hover:enter', function () {
            try { if (object.movie && object.movie.id) Lampa.Favorite.add('history', object.movie, 100); } catch (e) {}
            var extra = getFile(element);
            if (!extra.file) {
              if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(t('online_nolink'));
              return;
            }
            var first = {
              url: extra.file, quality: extra.quality, timeline: view,
              title: element.season ? element.title : ((object.movie.title || object.movie.name || '') + ' / ' + element.title)
            };
            var playlist = [first];
            if (element.season) {
              playlist = [];
              for (var p = 0; p < items.length; p++) {
                var ex = getFile(items[p]);
                playlist.push({ title: items[p].title, url: ex.file, quality: ex.quality, timeline: items[p].timeline || view });
              }
              first = playlist[0] || first;
              if (playlist.length > 1) first.playlist = playlist;
            }
            try { Lampa.Player.play(first); Lampa.Player.playlist(playlist); }
            catch (e) { if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(String(e.message || e)); }
            if (viewed.indexOf(hash_file) === -1) { viewed.push(hash_file); storeSet('online_view', viewed); }
          });

          component.append(item);
        })(items[i]);
      }
      component.start(true);
    }
  }

  function OnlineFilmix(object) {
    var network = new Lampa.Reguest();
    var scroll = new Lampa.Scroll({ mask: true, over: true });
    var files = new Lampa.Files(object);
    var filter = new Lampa.Filter(object);
    var last = null;
    var source = new FilmixSource(this, object);
    var selected_id = null;
    var self = this;

    scroll.body().addClass('torrent-list');

    function minus() {
      try { scroll.minus(window.innerWidth > 580 ? false : files.render().find('.files__left')); } catch (e) {}
    }
    window.addEventListener('resize', minus, false);
    try { minus(); } catch (e) {}

    this.proxy = function () { return ''; };

    this.create = function () {
      this.activity.loader(true);
      filter.onSearch = function (value) { Lampa.Activity.replace({ search: value, clarification: true }); };
      filter.onBack = function () { self.start(); };
      try {
        filter.onSelect = function (type, a, b) {
          if (type === 'filter') {
            if (a.reset) source.reset();
            else source.filter(type, a, b);
          }
        };
      } catch (e) {}
      try { filter.render().find('.filter--sort').addClass('hide'); } catch (e) {}
      files.append(scroll.render());
      scroll.append(filter.render());
      this.search();
      return this.render();
    };

    this.search = function () {
      this.activity.loader(true);
      this.filter({}, {});
      this.reset();
      if (!getToken()) { this.empty(t('filmix_need_token')); return; }
      var title = object.search || object.movie.title || object.movie.name || '';
      try {
        this.extendChoice();
        source.search(object, [{ title: title, id: object.movie.id }]);
      } catch (err) {
        this.empty('Filmix: ' + (err && err.message ? err.message : err));
      }
    };

    this.similars = function (json) {
      var list = Array.isArray(json) ? json : [];
      for (var i = 0; i < list.length; i++) {
        (function (elem) {
          elem.title = elem.title || elem.original_title || 'Filmix';
          elem.quality = elem.year || '----';
          elem.info = '';
          var item;
          try { item = Lampa.Template.get('online_prestige_folder', elem); }
          catch (e) { item = $('<div class="online selector"><div class="online__title">' + elem.title + '</div></div>'); }
          item.on('hover:enter', function () {
            self.activity.loader(true);
            self.reset();
            selected_id = elem.id;
            self.extendChoice();
            source.find(elem.id);
          });
          self.append(item);
        })(list[i]);
      }
      this.loading(false);
    };

    this.extendChoice = function () {
      var data = {};
      try { data = Lampa.Storage.cache('online_choice_filmix', 500, {}); } catch (e) {}
      source.extendChoice(data[selected_id || (object.movie && object.movie.id)] || {});
    };

    this.saveChoice = function (choice) {
      try {
        var data = Lampa.Storage.cache('online_choice_filmix', 500, {});
        data[selected_id || (object.movie && object.movie.id)] = choice;
        Lampa.Storage.set('online_choice_filmix', data);
      } catch (e) {}
    };

    this.reset = function () {
      last = null;
      try { scroll.render().find('.empty, .online, .online-prestige').remove(); } catch (e) {}
    };

    this.loading = function (status) {
      if (status) this.activity.loader(true);
      else { this.activity.loader(false); this.activity.toggle(); }
    };

    this.filter = function (filter_items, choice) {
      choice = choice || storeGet('online_filter', {}) || {};
      var select = [];
      function add(type, title) {
        var items = (filter_items && filter_items[type]) || [];
        var value = choice[type] || 0;
        var sub = [];
        for (var i = 0; i < items.length; i++) sub.push({ title: items[i], selected: value == i, index: i });
        select.push({ title: title, subtitle: items[value] || '', items: sub, stype: type });
      }
      select.push({ title: t('torrent_parser_reset'), reset: true });
      try { storeSet('online_filter', choice); } catch (e) {}
      if (filter_items && filter_items.voice && filter_items.voice.length) add('voice', t('torrent_parser_voice'));
      if (filter_items && filter_items.season && filter_items.season.length) add('season', t('torrent_serial_season'));
      try { filter.set('filter', select); } catch (e) {}
      try { filter.chosen('sort', ['Filmix']); } catch (e) {}
    };

    this.closeFilter = function () {
      try { if ($('body').hasClass('selectbox--open')) Lampa.Select.close(); } catch (e) {}
    };
    this.selected = function () {};

    this.append = function (item) {
      try { if (!item.hasClass('online-prestige')) item.addClass('online-prestige online-prestige--full'); } catch (e) {}
      item.on('hover:focus', function (e) {
        last = e.target;
        try { scroll.update($(e.target), true); } catch (err) {}
      });
      scroll.append(item);
    };

    this.contextmenu = function () {};

    this.empty = function (msg) {
      try {
        var empty = Lampa.Template.get('list_empty');
        if (msg) empty.find('.empty__descr').text(msg);
        scroll.append(empty);
      } catch (e) {
        try { if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(msg || 'Empty'); } catch (e2) {}
      }
      this.loading(false);
    };

    this.emptyForQuery = function (query) {
      this.empty(t('online_query_start') + ' (' + (query || '') + ') ' + t('online_query_end'));
    };

    this.start = function (first_select) {
      try { if (Lampa.Activity.active().activity !== this.activity) return; } catch (e) {}
      if (first_select) try { last = scroll.render().find('.selector').first()[0]; } catch (e) {}
      try { Lampa.Background.immediately(Lampa.Utils.cardImgBackground(object.movie)); } catch (e) {}
      Lampa.Controller.add('content', {
        toggle: function () {
          Lampa.Controller.collectionSet(scroll.render(), files.render());
          Lampa.Controller.collectionFocus(last || false, scroll.render());
        },
        up: function () { if (Navigator.canmove('up')) Navigator.move('up'); else Lampa.Controller.toggle('head'); },
        down: function () { Navigator.move('down'); },
        right: function () {
          if (Navigator.canmove('right')) Navigator.move('right');
          else try { filter.show(t('title_filter'), 'filter'); } catch (e) {}
        },
        left: function () {
          if (Navigator.canmove('left')) Navigator.move('left');
          else Lampa.Controller.toggle('menu');
        },
        back: this.back
      });
      Lampa.Controller.toggle('content');
    };

    this.render = function () { return files.render(); };
    this.back = function () { Lampa.Activity.backward(); };
    this.pause = function () {};
    this.stop = function () {};
    this.destroy = function () {
      try { network.clear(); } catch (e) {}
      try { files.destroy(); scroll.destroy(); source.destroy(); } catch (e) {}
      window.removeEventListener('resize', minus);
    };
  }

  function addButton() {
    Lampa.Listener.follow('full', function (e) {
      if (!e || e.type !== 'complite') return;
      try {
        var render = e.object.activity.render();
        var $btns = render.find('.full-start__buttons, .full-start-new__buttons').first();
        if (!$btns.length || $btns.find('.view--online-filmix').length) return;
        var $btn = $('<div class="full-start__button selector view--online-filmix">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>' +
          '<span>Filmix</span></div>');
        $btn.on('hover:enter click', function () {
          try {
            var movie = (e.data && e.data.movie) || e.object.card || e.object.movie || {};
            if (!getToken() && Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(t('filmix_need_token'));
            Lampa.Component.add(COMPONENT, OnlineFilmix);
            Lampa.Activity.push({
              url: '', title: 'Filmix', component: COMPONENT,
              search: movie.title || movie.name || movie.original_title || movie.original_name || '',
              search_one: movie.title || movie.name || '',
              search_two: movie.original_title || movie.original_name || '',
              movie: movie, page: 1
            });
          } catch (err) {
            if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show('Filmix: ' + (err.message || err));
          }
        });
        $btns.append($btn);
      } catch (err) {
        try { console.error('[filmix]', err); } catch (e) {}
      }
    });
  }

  function addSettings() {
    if (window.__filmix_nova_settings_v2) return;
    window.__filmix_nova_settings_v2 = true;
    try {
      if (Lampa.Params && Lampa.Params.select) {
        Lampa.Params.select('filmix_token', '', '');
        Lampa.Params.select('online_filmix_api', API_DEFAULT, '');
      }
    } catch (e) {}
    if (!Lampa.SettingsApi || !Lampa.SettingsApi.addComponent) return;
    try {
      Lampa.SettingsApi.addComponent({
        component: 'online_filmix_settings', name: 'Filmix Pro+',
        icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>'
      });
      Lampa.SettingsApi.addParam({
        component: 'online_filmix_settings',
        param: { name: 'filmix_token', type: 'input', values: '', default: '' },
        field: { name: 'Токен Filmix', description: 'Обовʼязково. Pro+ → до 4K' },
        onChange: function (v) {
          storeSet('filmix_token', v);
          storeSet('online_filmix_token', v);
          checkProfile(v);
        }
      });
      Lampa.SettingsApi.addParam({
        component: 'online_filmix_settings',
        param: { type: 'button', name: 'filmix_check_btn' },
        field: { name: 'Перевірити підписку', description: '' },
        onChange: function () {
          var token = getToken();
          if (!token) { if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(t('filmix_need_token')); return; }
          checkProfile(token, function (found) {
            var msg = 'Немає відповіді Filmix API';
            if (found && found.user_data) {
              var u = found.user_data;
              if (u.is_pro_plus) msg = (u.login || 'OK') + ' — PRO+ (4K)';
              else if (u.is_pro) msg = (u.login || 'OK') + ' — PRO (1080p)';
              else msg = (u.login || 'OK') + ' — без Pro (720p)';
            }
            if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(msg);
          });
        }
      });
      Lampa.SettingsApi.addParam({
        component: 'online_filmix_settings',
        param: { name: 'online_filmix_api', type: 'input', values: '', default: API_DEFAULT },
        field: { name: 'API URL', description: 'http://filmixapp.cyou/api/v2/' }
      });
    } catch (e) {
      try { console.error('[filmix] settings', e); } catch (e2) {}
    }
    var tok = getToken();
    if (tok) checkProfile(tok);
  }

  function start() {
    try { Lampa.Component.add(COMPONENT, OnlineFilmix); } catch (e) {}
    addButton();
    addSettings();
  }

  if (window.appready) start();
  else {
    try {
      Lampa.Listener.follow('app', function (e) { if (e && e.type === 'ready') start(); });
    } catch (e) {}
    setTimeout(function () { if (window.Lampa && Lampa.Component) start(); }, 2000);
  }
})();
