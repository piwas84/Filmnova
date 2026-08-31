/**
 * Filmix Pro+ + Nova Skin (сумісність)
 * -------------------------------------------------
 * 1) Окремо став: https://piwas84.github.io/NV/nova_skin_premium.js
 * 2) Цей плагін: Filmix з твоїм токеном Pro+
 *
 * Без конфліктів з Nova Skin:
 *  - не чіпає window.nova_skin
 *  - не реєструє nova_online / lampacskaz
 *  - список у розмітці online-prestige → Nova малює озвучки/серії кнопками
 *  - стандартний Lampa.Filter (voice/season) → Nova підхоплює chips
 */
(function () {
  'use strict';

  if (window.__filmix_nova_bundle) return;
  window.__filmix_nova_bundle = true;

  // Не конфліктуємо з Nova Skin і не прикидаємось її sibling-онлайном
  // (nova_online_plugin / onlyskaz_plugin НЕ виставляємо)

  var COMPONENT = 'online_filmix';

  function t(key) {
    try { return Lampa.Lang.translate(key); } catch (e) { return key; }
  }

  if (Lampa.Lang && Lampa.Lang.add) {
    Lampa.Lang.add({
      online_filmix_title: { ru: 'Filmix', uk: 'Filmix', en: 'Filmix' },
      online_nolink: {
        ru: 'Не удалось извлечь ссылку',
        uk: 'Неможливо отримати посилання',
        en: 'Failed to fetch link'
      },
      online_query_start: { ru: 'По запросу', uk: 'На запит', en: 'On request' },
      online_query_end: { ru: 'нет результатов', uk: 'немає результатів', en: 'no results' },
      helper_online_file: {
        ru: 'Удерживайте ОК для меню',
        uk: 'Утримуйте ОК для меню',
        en: 'Hold OK for menu'
      },
      filmix_need_token: {
        ru: 'Укажите токен Filmix в настройках «Filmix Pro+»',
        uk: 'Вкажи токен Filmix у «Filmix Pro+»',
        en: 'Set Filmix token in settings'
      }
    });
  }

  /* Розмітка, яку читає Nova Skin (online-prestige) */
  Lampa.Template.add(
    'online_prestige_item',
    '<div class="online-prestige online-prestige--full selector video--stream">' +
      '<div class="online-prestige__body">' +
      '<div class="online-prestige__title">{title}</div>' +
      '<div class="online-prestige__info"><div>{info}</div></div>' +
      '<div class="online-prestige__quality">{quality}</div>' +
      '</div></div>'
  );
  Lampa.Template.add(
    'online_prestige_folder',
    '<div class="online-prestige online-prestige--folder selector">' +
      '<div class="online-prestige__body">' +
      '<div class="online-prestige__title">{title}</div>' +
      '<div class="online-prestige__info"><div>{info}</div></div>' +
      '<div class="online-prestige__quality">{quality}</div>' +
      '</div></div>'
  );
  /* запасний класичний шаблон */
  Lampa.Template.add(
    'online',
    '<div class="online selector"><div class="online__body">' +
      '<div class="online__title">{title}</div>' +
      '<div class="online__quality">{quality}{info}</div></div></div>'
  );
  Lampa.Template.add(
    'online_folder',
    '<div class="online selector"><div class="online__body">' +
      '<div class="online__title">{title}</div>' +
      '<div class="online__quality">{quality}{info}</div></div></div>'
  );

  /* ---- Filmix balancer (official) ---- */
function filmix(component, _object){
    let network  = new Lampa.Reguest()
    let extract  = {}
    let results  = []
    let object   = _object
    let embed    = (Lampa.Storage.get('online_filmix_api','') || 'http://filmixapp.cyou/api/v2/').replace(/\/?$/, '/');
    let select_title = ''

    let filter_items = {}

    let choice = {
        season: 0,
        voice: 0,
        voice_name: ''
    }

    let token = Lampa.Storage.get('filmix_token','') || Lampa.Storage.get('online_filmix_token','')

    if (!window.filmix){
        window.filmix = {
            max_qualitie: 720,
            is_max_qualitie: false
        }
    } 

    let dev_id = Lampa.Storage.get('filmix_dev_id','')
    if(!dev_id){ dev_id = Lampa.Utils.uid(16); Lampa.Storage.set('filmix_dev_id', dev_id) }
    let dev_token = 'user_dev_apk=2.0.1&user_dev_id='+dev_id+'&user_dev_name=Xiaomi&user_dev_os=11&user_dev_token='+token+'&user_dev_vendor=Xiaomi'

    /**
     * Начать поиск
     * @param {Object} _object 
     */
    this.search = function(_object, data){
        if(this.wait_similars) return this.find(data[0].id)

        object  = _object

        select_title = object.movie.title

        let item = data[0]
        let year = parseInt((object.movie.release_date || object.movie.first_air_date || '0000').slice(0,4))
        let orig = object.movie.original_title || object.movie.original_name

        let url = embed + 'search'
            url = Lampa.Utils.addUrlComponent(url, 'story=' + encodeURIComponent(item.title))
            url = Lampa.Utils.addUrlComponent(url, dev_token)

        network.clear()
        network.silent(url, (json)=> {
            let cards = json.filter(c=>{
                c.year = parseInt(c.alt_name.split('-').pop())

                return c.year > year - 2 && c.year < year + 2
            })

            let card = cards.find(c=>c.year == year)

            if(!card){
                card = cards.find(c=>c.original_title == orig)
            }

            if(!card && cards.length == 1) card = cards[0]

            if(card) this.find(card.id)
            else if(json.length){
                this.wait_similars = true

                component.similars(json)
                component.loading(false)
            }
            else component.emptyForQuery(select_title)
        }, (a, c)=> {
            component.empty(network.errorDecode(a, c))
        })
    }

    this.find = function (filmix_id) {
        var url = embed;
        if (!window.filmix.is_max_qualitie && token) {
            window.filmix.is_max_qualitie = true

            network.clear()
            network.timeout(10000)
            network.silent(url + 'user_profile?' + dev_token, function (found) {
                if (found && found.user_data) {
                    if (found.user_data.is_pro) window.filmix.max_qualitie      = 1080
                    if (found.user_data.is_pro_plus) window.filmix.max_qualitie = 2160
                }

                end_search(filmix_id)
            })
        }
        else end_search(filmix_id)

        function end_search(filmix_id) {
            network.clear();
            network.timeout(10000);
            network.silent((window.filmix.is_max_qualitie ? url + 'post/' + filmix_id : url + 'post/' + filmix_id) + '?' + dev_token, function (found) {
                if (found && Object.keys(found).length) {
                    success(found)

                    component.loading(false)
                }
                else component.emptyForQuery(select_title)
            }, function (a, c) {
                component.empty(network.errorDecode(a, c))
            })
        }
    }

    this.extendChoice = function(saved){
        Lampa.Arrays.extend(choice, saved, true)
    }

    /**
     * Сброс фильтра
     */
    this.reset = function(){
        component.reset()

        choice = {
            season: 0,
            voice: 0,
            voice_name: ''
        }

        extractData(results)

        filter()

        append(filtred())

        component.saveChoice(choice)
    }

    /**
     * Применить фильтр
     * @param {*} type 
     * @param {*} a 
     * @param {*} b 
     */
    this.filter = function(type, a, b){
        choice[a.stype] = b.index

        if(a.stype == 'voice') choice.voice_name = filter_items.voice[b.index]

        component.reset()

        extractData(results)

        filter()

        append(filtred())

        component.saveChoice(choice)
    }

    /**
     * Уничтожить
     */
    this.destroy = function(){
        network.clear()

        results = null
    }

    /**
     * Успешно, есть данные
     * @param {Object} json
     */
    function success(json) {
        results = json

        extractData(json)

        filter()

        append(filtred())
    }

    /**
     * Получить информацию о фильме
     * @param {Arrays} data
     */
    function extractData(data) {
        extract = {}

        let pl_links = data.player_links

        if (pl_links.playlist && Object.keys(pl_links.playlist).length > 0) {
            let seas_num = 0

            for (let season in pl_links.playlist) {
                let episode = pl_links.playlist[season]

                ++seas_num

                let transl_id = 0

                for (let voice in episode) {
                    let episode_voice = episode[voice]
                    ++transl_id

                    let items = [],
                        epis_num = 0

                    for (let ID in episode_voice) {
                        let file_episod = episode_voice[ID]

                        ++epis_num

                        let quality_eps = file_episod.qualities.filter(function (qualitys) {
                            return qualitys <= window.filmix.max_qualitie
                        })

                        let max_quality = Math.max.apply(null, quality_eps)
                        let stream_url = file_episod.link.replace('%s.mp4', max_quality + '.mp4')
                        let s_e = stream_url.slice(0 - stream_url.length + stream_url.lastIndexOf('/'))
                        let str_s_e = s_e.match(/s(\d+)e(\d+?)_\d+\.mp4/i)

                        if (str_s_e) {
                            let seas_num = parseInt(str_s_e[1])
                            let epis_num = parseInt(str_s_e[2])

                            items.push({
                                id: seas_num + '_' + epis_num,
                                comment: epis_num + ' ' + Lampa.Lang.translate('torrent_serial_episode') + ' <i>' + ID + '</i>',
                                file: stream_url,
                                episode: epis_num,
                                season: seas_num,
                                quality: max_quality,
                                qualities: quality_eps,
                                translation: transl_id
                            })
                        }
                    }
                    if (!extract[transl_id]) extract[transl_id] = {
                        json: [],
                        file: ''
                    }

                    extract[transl_id].json.push({
                        id: seas_num,
                        comment: seas_num + ' ' + Lampa.Lang.translate('torrent_serial_season'),
                        folder: items,
                        translation: transl_id
                    })
                }
            }
        } 
        
        else if (pl_links.movie && pl_links.movie.length > 0) {
            let transl_id = 0

            for (let ID in pl_links.movie) {
                let file_episod = pl_links.movie[ID]

                ++transl_id

                let quality_eps = file_episod.link.match(/.+\[(.+[\d]),?\].+/i)

                if (quality_eps) quality_eps = quality_eps[1].split(',').filter(function (quality_) {
                    return quality_ <= window.filmix.max_qualitie
                })

                let max_quality = Math.max.apply(null, quality_eps)
                let file_url = file_episod.link.replace(/\[(.+[\d]),?\]/i, max_quality)

                extract[transl_id] = {
                    file: file_url,
                    translation: file_episod.translation,
                    quality: max_quality,
                    qualities: quality_eps
                }
            }
        }
    }


    /**
     * Найти поток
     * @param {Object} element
     * @param {Int} max_quality
     * @returns string
     */
    function getFile(element, max_quality) {
        let translat = extract[element.translation]
        let id       = element.season + '_' + element.episode
        let file     = ''
        let quality  = false

        if (translat) {
            if (element.season)
                for (let i in translat.json) {
                    let elem = translat.json[i]

                    if (elem.folder)
                        for (let f in elem.folder) {
                            let folder = elem.folder[f]

                            if (folder.id == id) {
                                file = folder.file
                                break
                            }
                        } else {
                            if (elem.id == id) {
                                file = elem.file
                                break
                            }
                        }
                } 
                else file = translat.file
        }

        max_quality = parseInt(max_quality)

        if (file) {
            let link = file.slice(0, file.lastIndexOf('_')) + '_'
            let orin = file.split('?')
                orin = orin.length > 1 ? '?'+orin.slice(1).join('?') : ''

            if (file.split('_').pop().replace('.mp4', '') !== max_quality) {
                file = link + max_quality + '.mp4' + orin
            }

            quality = {}

            let mass = [2160, 1440, 1080, 720, 480, 360]

            mass = mass.slice(mass.indexOf(max_quality))

            mass.forEach(function (n) {
                quality[n + 'p'] = link + n + '.mp4' + orin
            })

            let preferably = Lampa.Storage.get('video_quality_default','1080') + 'p'
            
            if(quality[preferably]) file = quality[preferably]
        }

        return {
            file: file,
            quality: quality
        }
    }

    /**
     * Построить фильтр
     */
    function filter(){
        filter_items = {
            season: [],
            voice: [],
            voice_info: []
        }

        if (results.last_episode && results.last_episode.season) {
            let s = results.last_episode.season

            while (s--) {
                filter_items.season.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + (results.last_episode.season - s))
            }
        }

        let i = 0;

        for (let Id in results.player_links.playlist) {
            let season = results.player_links.playlist[Id]

            ++i

            let d = 0

            for (let voic in season) {
                ++d

                if (filter_items.voice.indexOf(voic) == -1) {
                    filter_items.voice.push(voic);
                    filter_items.voice_info.push({
                        id: d
                    })
                }
            }
        }

        if(choice.voice_name){
            let inx = filter_items.voice.indexOf(choice.voice_name)
            
            if(inx == -1) choice.voice = 0
            else if(inx !== choice.voice){
                choice.voice = inx
            }
        }

        component.filter(filter_items, choice)
    }

    /**
     * Отфильтровать файлы
     * @returns array
     */
    function filtred(){
        let filtred = [];
        let filter_data = Lampa.Storage.get('online_filter', '{}')

        if (Object.keys(results.player_links.playlist).length) {
            for (let transl in extract) {
                let element = extract[transl];
                for (let season_id in element.json) {
                    let episode = element.json[season_id];
                    if (episode.id == filter_data.season + 1) {
                        episode.folder.forEach(function (media) {
                            if (media.translation == filter_items.voice_info[filter_data.voice].id) {
                                filtred.push({
                                    episode: parseInt(media.episode),
                                    season: media.season,
                                    title: media.episode + (media.title ? ' - ' + media.title : ''),
                                    quality: media.quality + 'p ',
                                    translation: media.translation
                                })
                            }
                        })
                    }
                }
            }
        } 
        else if (Object.keys(results.player_links.movie).length) {
            for (let transl_id in extract) {
                let element = extract[transl_id]

                filtred.push({
                    title: element.translation,
                    quality: element.quality + 'p ',
                    qualitys: element.qualities,
                    translation: transl_id
                })
            }
        }

        return filtred
    }

    /**
     * Добавить видео
     * @param {Array} items 
     */
    function append(items){
        component.reset()

        let viewed = Lampa.Storage.cache('online_view', 5000, [])

        let last_episode = component.getLastEpisode(items)

        items.forEach(element => {
            if(element.season) element.title = 'S'+element.season + ' / ' + Lampa.Lang.translate('torrent_serial_episode') + ' ' + element.episode

            element.info = element.season ? ' / ' + Lampa.Utils.shortText(filter_items.voice[choice.voice], 50) : ''

            if(element.season){
                element.translate_episode_end = last_episode
                element.translate_voice       = filter_items.voice[choice.voice]
            }

            let hash = Lampa.Utils.hash(element.season ? [element.season,element.episode,object.movie.original_title].join('') : object.movie.original_title)
            let view = Lampa.Timeline.view(hash)
            let item = Lampa.Template.get('online',element)

            let hash_file = Lampa.Utils.hash(element.season ? [element.season,element.episode,object.movie.original_title,filter_items.voice[choice.voice]].join('') : object.movie.original_title + element.title)

            item.addClass('video--stream')

            element.timeline = view

            item.append(Lampa.Timeline.render(view))

            if(Lampa.Timeline.details){
                item.find('.online__quality').append(Lampa.Timeline.details(view,' / '))
            }

            if(viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">'+Lampa.Template.get('icon_star',{},true)+'</div>')

            item.on('hover:enter',()=>{
                if(object.movie.id) Lampa.Favorite.add('history', object.movie, 100)

                let extra = getFile(element, element.quality)

                if(extra.file){
                    let playlist = []
                    let first = {
                        url: extra.file,
                        quality: extra.quality,
                        timeline: view,
                        title: element.season ? element.title : object.movie.title + ' / ' + element.title
                    }

                    if(element.season){
                        items.forEach(elem=>{
                            let ex = getFile(elem, elem.quality)

                            playlist.push({
                                title: elem.title,
                                url: ex.file,
                                quality: ex.quality,
                                timeline: elem.timeline
                            })
                        })
                    }
                    else{
                        playlist.push(first)
                    }

                    if(playlist.length > 1) first.playlist = playlist

                    Lampa.Player.play(first)

                    Lampa.Player.playlist(playlist)

                    if(viewed.indexOf(hash_file) == -1){
                        viewed.push(hash_file)

                        item.append('<div class="torrent-item__viewed">'+Lampa.Template.get('icon_star',{},true)+'</div>')

                        Lampa.Storage.set('online_view', viewed)
                    }
                }
                else Lampa.Noty.show(Lampa.Lang.translate('online_nolink'))
            })

            component.append(item)

            component.contextmenu({
                item,
                view,
                viewed,
                hash_file,
                element,
                file: (call)=>{call(getFile(element, element.quality))}
            })
        })

        component.start(true)
    }
}


  function OnlineFilmix(object) {
    var network = new Lampa.Reguest();
    var scroll = new Lampa.Scroll({ mask: true, over: true });
    var files = new Lampa.Files(object);
    var filter = new Lampa.Filter(object);
    var last, last_filter, selected_id;
    var source = new filmix(this, object);
    var self = this;

    var filter_translate = {
      season: t('torrent_serial_season'),
      voice: t('torrent_parser_voice'),
      source: t('settings_rest_source')
    };

    this.proxy = function () {
      var prox = (Lampa.Storage.get('online_filmix_proxy', '') || Lampa.Storage.get('online_proxy_all', '') || '').trim();
      if (prox && prox.slice(-1) !== '/') prox += '/';
      return prox || '';
    };

    scroll.body().addClass('torrent-list');
    /* маркер для Nova Skin: це online-активність з prestige-картками */
    try {
      files.render().addClass('online-filmix-scope');
    } catch (e) {}

    function minus() {
      try {
        scroll.minus(window.innerWidth > 580 ? false : files.render().find('.files__left'));
      } catch (e) {}
    }
    window.addEventListener('resize', minus, false);
    try { minus(); } catch (e) {}

    this.create = function () {
      this.activity.loader(true);

      filter.onSearch = function (value) {
        Lampa.Activity.replace({ search: value, clarification: true });
      };
      filter.onBack = function () {
        self.start();
      };
      filter.render().find('.selector').on('hover:focus', function (e) {
        last_filter = e.target;
      });

      try {
        filter.onSelect = function (type, a, b) {
          if (type === 'filter') {
            if (a.reset) source.reset();
            else source.filter(type, a, b);
          }
        };
      } catch (e) {}

      try {
        filter.render().find('.filter--sort').addClass('hide');
      } catch (e) {}

      files.append(scroll.render());
      scroll.append(filter.render());

      this.search();
      return this.render();
    };

    this.search = function () {
      this.activity.loader(true);
      this.filter({}, {});
      this.reset();

      var token = (Lampa.Storage.get('filmix_token', '') || Lampa.Storage.get('online_filmix_token', '') || '').trim();
      if (!token) {
        this.empty(t('filmix_need_token'));
        return;
      }

      var title = object.search || object.movie.title || object.movie.name || '';
      var data = [{ title: title, id: object.movie.id, imdb_id: object.movie.imdb_id || '' }];

      try {
        this.extendChoice();
        source.search(object, data);
      } catch (err) {
        this.empty('Filmix: ' + (err.message || err));
      }
    };

    this.similars = function (json) {
      var selfc = this;
      (json || []).forEach(function (elem) {
        var year = elem.year || (elem.alt_name || '').split('-').pop() || '';
        elem.title = elem.title || elem.original_title || elem.rus || 'Filmix';
        elem.quality = year || '----';
        elem.info = '';
        var item = Lampa.Template.get('online_prestige_folder', elem);
        if (!item || !item.length) item = Lampa.Template.get('online_folder', elem);
        item.on('hover:enter', function () {
          selfc.activity.loader(true);
          selfc.reset();
          selected_id = elem.id;
          selfc.extendChoice();
          source.find(elem.id);
        });
        selfc.append(item);
      });
      this.loading(false);
    };

    this.extendChoice = function () {
      var data = Lampa.Storage.cache('online_choice_filmix', 500, {});
      source.extendChoice(data[selected_id || object.movie.id] || {});
    };

    this.saveChoice = function (choice) {
      var data = Lampa.Storage.cache('online_choice_filmix', 500, {});
      data[selected_id || object.movie.id] = choice;
      Lampa.Storage.set('online_choice_filmix', data);
    };

    this.reset = function () {
      last = false;
      try {
        scroll.render().find('.empty, .online, .online-prestige').remove();
      } catch (e) {}
    };

    this.loading = function (status) {
      if (status) this.activity.loader(true);
      else {
        this.activity.loader(false);
        this.activity.toggle();
      }
    };

    this.filter = function (filter_items, choice) {
      choice = choice || Lampa.Storage.get('online_filter', '{}') || {};
      var select = [];

      function add(type, title) {
        var items = filter_items[type] || [];
        var value = choice[type] || 0;
        var subitems = [];
        items.forEach(function (name, i) {
          subitems.push({ title: name, selected: value == i, index: i });
        });
        select.push({ title: title, subtitle: items[value] || '', items: subitems, stype: type });
      }

      select.push({ title: t('torrent_parser_reset'), reset: true });
      Lampa.Storage.set('online_filter', choice);

      if (filter_items.voice && filter_items.voice.length) add('voice', t('torrent_parser_voice'));
      if (filter_items.season && filter_items.season.length) add('season', t('torrent_serial_season'));

      try {
        filter.set('filter', select);
      } catch (e) {}
      this.selected(filter_items);
    };

    this.closeFilter = function () {
      try {
        if ($('body').hasClass('selectbox--open')) Lampa.Select.close();
      } catch (e) {}
    };

    this.selected = function (filter_items) {
      var need = Lampa.Storage.get('online_filter', '{}') || {};
      var select = [];
      for (var i in need) {
        if (filter_items[i] && filter_items[i].length) {
          if (i === 'voice') select.push(filter_translate.voice + ': ' + filter_items[i][need[i]]);
          else if (i === 'season') select.push(filter_translate.season + ': ' + filter_items[i][need[i]]);
        }
      }
      try {
        filter.chosen('filter', select);
        filter.chosen('sort', ['Filmix']);
      } catch (e) {}
    };

    this.append = function (item) {
      /* гарантуємо prestige-класи для Nova */
      try {
        if (!item.hasClass('online-prestige')) {
          item.addClass('online-prestige online-prestige--full');
        }
      } catch (e) {}

      item.on('hover:focus', function (e) {
        last = e.target;
        scroll.update($(e.target), true);
      });
      scroll.append(item);

      /* підказка Nova перечитати список після додавання карток */
      try {
        if (window.nova_skin && Lampa.Listener) {
          Lampa.Listener.send('nova_filmix_append', { component: COMPONENT });
        }
      } catch (e) {}
    };

    this.contextmenu = function (params) {
      params.item.on('hover:long', function () {
        function show(extra) {
          var enabled = Lampa.Controller.enabled().name;
          var menu = [{ title: t('player_lauch') + ' - Lampa', player: 'lampa' }];
          if (Lampa.Platform.is('android'))
            menu.push({ title: t('player_lauch') + ' - Android', player: 'android' });
          if (extra) menu.push({ title: t('copy_link'), copylink: true });
          Lampa.Select.show({
            title: t('title_action'),
            items: menu,
            onBack: function () {
              Lampa.Controller.toggle(enabled);
            },
            onSelect: function (a) {
              if (a.player) {
                Lampa.Player.runas(a.player);
                params.item.trigger('hover:enter');
              }
              if (a.copylink && extra && extra.file) {
                Lampa.Utils.copyTextToClipboard(
                  extra.file,
                  function () {
                    Lampa.Noty.show(t('copy_secuses'));
                  },
                  function () {
                    Lampa.Noty.show(t('copy_error'));
                  }
                );
              }
              Lampa.Controller.toggle(enabled);
            }
          });
        }
        if (params.file) params.file(show);
      });
    };

    this.empty = function (msg) {
      try {
        var empty = Lampa.Template.get('list_empty');
        if (msg) empty.find('.empty__descr').text(msg);
        scroll.append(empty);
      } catch (e) {
        try {
          Lampa.Noty.show(msg || 'Порожньо');
        } catch (_) {}
      }
      this.loading(false);
    };

    this.emptyForQuery = function (query) {
      this.empty(t('online_query_start') + ' (' + (query || '') + ') ' + t('online_query_end'));
    };

    this.start = function (first_select) {
      if (Lampa.Activity.active().activity !== this.activity) return;
      if (first_select) {
        last =
          scroll.render().find('.selector.online-prestige, .selector.online').first()[0] ||
          scroll.render().find('.selector').eq(2)[0];
      }
      try {
        Lampa.Background.immediately(Lampa.Utils.cardImgBackground(object.movie));
      } catch (e) {}

      Lampa.Controller.add('content', {
        toggle: function () {
          Lampa.Controller.collectionSet(scroll.render(), files.render());
          Lampa.Controller.collectionFocus(last || false, scroll.render());
        },
        up: function () {
          if (Navigator.canmove('up')) Navigator.move('up');
          else Lampa.Controller.toggle('head');
        },
        down: function () {
          Navigator.move('down');
        },
        right: function () {
          if (Navigator.canmove('right')) Navigator.move('right');
          else
            try {
              filter.show(t('title_filter'), 'filter');
            } catch (e) {}
        },
        left: function () {
          if (Navigator.canmove('left')) Navigator.move('left');
          else Lampa.Controller.toggle('menu');
        },
        back: this.back
      });
      Lampa.Controller.toggle('content');
    };

    this.render = function () {
      return files.render();
    };
    this.back = function () {
      Lampa.Activity.backward();
    };
    this.pause = function () {};
    this.stop = function () {};
    this.destroy = function () {
      network.clear();
      try {
        files.destroy();
        scroll.destroy();
        source.destroy();
      } catch (e) {}
      window.removeEventListener('resize', minus);
    };
  }

  function addButton() {
    Lampa.Listener.follow('full', function (e) {
      if (e.type !== 'complite') return;
      try {
        var render = e.object.activity.render();
        var $btns = render.find('.full-start__buttons, .full-start-new__buttons').first();
        if (!$btns.length || $btns.find('.view--online-filmix').length) return;

        var $btn = $(
          '<div class="full-start__button selector view--online-filmix" data-type="filmix">' +
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>' +
            '<span>Filmix</span></div>'
        );

        $btn.on('hover:enter click', function () {
          try {
            var movie = (e.data && e.data.movie) || e.object.card || e.object.movie || {};
            Lampa.Component.add(COMPONENT, OnlineFilmix);
            Lampa.Activity.push({
              url: '',
              title: t('online_filmix_title'),
              component: COMPONENT,
              search: movie.title || movie.name || movie.original_title || movie.original_name || '',
              search_one: movie.title || movie.name || '',
              search_two: movie.original_title || movie.original_name || '',
              movie: movie,
              page: 1
            });
          } catch (err) {
            if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show('Помилка: ' + (err.message || err));
          }
        });
        $btns.append($btn);
      } catch (err) {
        console.error('[filmix-nova]', err);
      }
    });
  }

  function checkStatus(token, cb) {
    if (!token) {
      if (cb) cb(null);
      return;
    }
    var net = new Lampa.Reguest();
    var dev_id = Lampa.Storage.get('filmix_dev_id', '');
    if (!dev_id) {
      dev_id = Lampa.Utils.uid(16);
      Lampa.Storage.set('filmix_dev_id', dev_id);
    }
    var q =
      'user_dev_apk=2.0.1&user_dev_id=' +
      dev_id +
      '&user_dev_name=Xiaomi&user_dev_os=11&user_dev_token=' +
      encodeURIComponent(token) +
      '&user_dev_vendor=Xiaomi';
    var api = (Lampa.Storage.get('online_filmix_api', '') || 'http://filmixapp.cyou/api/v2/').replace(/\/?$/, '/');
    net.timeout(10000);
    net.silent(
      api + 'user_profile?' + q,
      function (found) {
        if (found && found.user_data) {
          Lampa.Storage.set('filmix_status', found.user_data);
          if (!window.filmix) window.filmix = { max_qualitie: 720, is_max_qualitie: false };
          if (found.user_data.is_pro_plus) window.filmix.max_qualitie = 2160;
          else if (found.user_data.is_pro) window.filmix.max_qualitie = 1080;
          else window.filmix.max_qualitie = 720;
          window.filmix.is_max_qualitie = true;
        }
        if (cb) cb(found);
      },
      function () {
        if (cb) cb(null);
      }
    );
  }

  function addSettings() {
    if (window.__filmix_nova_settings) return;
    window.__filmix_nova_settings = true;

    try {
      if (Lampa.Params && Lampa.Params.select) {
        Lampa.Params.select('filmix_token', '', '');
        Lampa.Params.select('online_filmix_token', '', '');
        Lampa.Params.select('online_filmix_proxy', '', '');
        Lampa.Params.select('online_filmix_api', 'http://filmixapp.cyou/api/v2/', '');
      }
    } catch (e) {}

    if (!Lampa.SettingsApi || !Lampa.SettingsApi.addComponent) return;

    try {
      Lampa.SettingsApi.addComponent({
        component: 'online_filmix_settings',
        name: 'Filmix Pro+',
        icon:
          '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>'
      });

      Lampa.SettingsApi.addParam({
        component: 'online_filmix_settings',
        param: { name: 'filmix_token', type: 'input', values: '', default: '' },
        field: {
          name: 'Токен Filmix',
          description: 'Pro+ → до 4K. Після зміни — перезапуск Lampa.'
        },
        onChange: function (v) {
          try {
            Lampa.Storage.set('online_filmix_token', v);
            Lampa.Storage.set('filmix_token', v);
            checkStatus(v);
          } catch (e) {}
        }
      });

      Lampa.SettingsApi.addParam({
        component: 'online_filmix_settings',
        param: { type: 'button', name: 'filmix_check' },
        field: { name: 'Перевірити підписку', description: 'Pro / Pro+' },
        onChange: function () {
          var token = (Lampa.Storage.get('filmix_token', '') || '').trim();
          if (!token) {
            if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(t('filmix_need_token'));
            return;
          }
          checkStatus(token, function (found) {
            var msg = 'Не вдалося перевірити';
            if (found && found.user_data) {
              var u = found.user_data;
              if (u.is_pro_plus) msg = (u.login || 'OK') + ' — PRO+ (до 4K)';
              else if (u.is_pro) msg = (u.login || 'OK') + ' — PRO (1080p)';
              else msg = (u.login || 'OK') + ' — без Pro (720p)';
            }
            if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(msg);
          });
        }
      });

      Lampa.SettingsApi.addParam({
        component: 'online_filmix_settings',
        param: { name: 'online_filmix_proxy', type: 'input', values: '', default: '' },
        field: { name: 'Проксі', description: 'За потреби' }
      });
    } catch (e) {
      console.error('[filmix-nova] settings', e);
    }

    try {
      var tok = (Lampa.Storage.get('filmix_token', '') || '').trim();
      if (tok) checkStatus(tok);
    } catch (e) {}
  }

  function start() {
    Lampa.Component.add(COMPONENT, OnlineFilmix);
    addButton();
    addSettings();
  }

  if (window.appready) start();
  else {
    Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') start();
    });
    setTimeout(function () {
      if (window.Lampa && Lampa.Component) start();
    }, 2000);
  }
})();
