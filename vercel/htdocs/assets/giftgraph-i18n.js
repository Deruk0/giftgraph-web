(function () {
  var storageKey = 'giftgraph-language';
  var supported = ['ru', 'en'];
  var root = document.documentElement;

  var phrases = [
    ['Архив графов Telegram', 'Telegram graph archive'],
    ['Панель сайта', 'Site toolbar'],
    ['Панель графа', 'Graph toolbar'],
    ['Сводка архива', 'Archive summary'],
    ['сводка архива', 'archive summary'],
    ['Статистика архива', 'Archive statistics'],
    ['Текущие числа по архиву и плотности связей. Все действия со страниц остаются рабочими.', 'Current archive totals and link density. Every page action remains available.'],
    ['Графы', 'Graphs'],
    ['Связей на узел', 'Links per node'],
    ['Совет', 'Tip'],
    ['По умолчанию включена тема Studio Violet; в настройках можно выбрать палитру и вручную настроить акценты.', 'Studio Violet is the default theme; settings let you choose a palette and tune accents manually.'],
    ['Сохраненные графы', 'Saved graphs'],
    ['Сохранённые графы', 'Saved graphs'],
    ['список графов', 'graph list'],
    ['Найти граф', 'Find a graph'],
    ['Поиск фильтрует список сразу; кнопка удаления убирает граф из архива.', 'Search filters the list instantly; delete removes a graph from the archive.'],
    ['Открыть', 'Open'],
    ['Удалить граф', 'Delete graph'],
    ['Здесь появится первая сохраненная карта связей.', 'The first saved connection map will appear here.'],
    ['Такой граф пока не найден.', 'No graph matches this search yet.'],
    ['Статус архива', 'Archive status'],
    ['быстрый обзор', 'quick overview'],
    ['Карточки архива открываются в один клик, а внешний вид можно переключать без потери функций сайта.', 'Archive cards open in one click, and the appearance can change without losing site features.'],
    ['поиск по архиву', 'archive search'],
    ['удаление из списка', 'list deletion'],
    ['настройка цветов', 'color tuning'],
    ['светлый и темный режим', 'light and dark mode'],
    ['Настройки', 'Settings'],
    ['настройки', 'settings'],
    ['Оформление сайта', 'Site appearance'],
    ['Закрыть настройки', 'Close settings'],
    ['Язык интерфейса', 'Interface language'],
    ['язык', 'language'],
    ['Русский', 'Russian'],
    ['English', 'English'],
    ['режим', 'mode'],
    ['Режим', 'Mode'],
    ['Режим темы', 'Theme mode'],
    ['Переключай сайт между светлой и темной версией.', 'Switch the site between light and dark mode.'],
    ['Светлая', 'Light'],
    ['Темная', 'Dark'],
    ['Тёмная', 'Dark'],
    ['автоудаление', 'auto-delete'],
    ['Автоудаление', 'Auto-delete'],
    ['Автоудаление по умолчанию', 'Default auto-delete'],
    ['Задай срок автоудаления для графов, которые открываются из архива впервые.', 'Set the auto-delete period for graphs opened from the archive for the first time.'],
    ['Выкл', 'Off'],
    ['1 час', '1 hour'],
    ['24 ч', '24 h'],
    ['7 дн', '7 days'],
    ['Не запланировано', 'Not scheduled'],
    ['темы', 'themes'],
    ['Цветовые наборы', 'Color palettes'],
    ['Цветовые темы', 'Color themes'],
    ['фиолетовый сигнал, молочная бумага, чернильные кнопки', 'violet signal, warm paper, ink buttons'],
    ['электрический синий, холодный воздух, светлый фон', 'electric blue, cool air, light background'],
    ['малиновый акцент, мягкая бумага, теплые подписи', 'rose accent, soft paper, warm captions'],
    ['почти монохром, сдержанный акцент, высокий контраст', 'near monochrome, restrained accent, high contrast'],
    ['точная настройка', 'fine tuning'],
    ['Точная настройка цветов', 'Fine color tuning'],
    ['Точная настройка темы', 'Fine theme tuning'],
    ['Ручная коррекция акцентов', 'Manual accent tuning'],
    ['Если нужен свой оттенок, можно отдельно подкрутить основной сигнал, вторичный цвет и мягкий тон интерфейса.', 'If you need a custom shade, tune the primary signal, secondary color, and soft interface tone separately.'],
    ['Акцент', 'Accent'],
    ['Вторичный', 'Secondary'],
    ['Мягкий', 'Soft'],
    ['Узлы', 'Nodes'],
    ['Связи', 'Links'],
    ['Сбросить цвета', 'Reset colors'],
    ['Архив', 'Archive'],
    ['снимок графа', 'graph snapshot'],
    ['Копировать', 'Copy'],
    ['Скопировано', 'Copied'],
    ['Удалить', 'Delete'],
    ['визуальный режим', 'visual mode'],
    ['Настройки графа', 'Graph settings'],
    ['Вид', 'View'],
    ['Граф', 'Graph'],
    ['Линии', 'Links'],
    ['Длина связей', 'Link length'],
    ['Сетка', 'Grid'],
    ['Яркость сетки', 'Grid strength'],
    ['Показать весь граф', 'Fit graph'],
    ['Разложить узлы', 'Lay out nodes'],
    ['подтверждение', 'confirmation'],
    ['Подтвердить действие?', 'Confirm action?'],
    ['Это действие нельзя будет быстро отменить.', 'This action cannot be quickly undone.'],
    ['Отмена', 'Cancel'],
    ['Оставить', 'Keep'],
    ['удаление графа', 'delete graph'],
    ['Удалить этот граф?', 'Delete this graph?'],
    ['Граф исчезнет из архива и больше не будет открываться по старой ссылке.', 'The graph will disappear from the archive and the old link will stop opening it.'],
    ['Граф удален', 'Graph deleted'],
    ['Граф удалён', 'Graph deleted'],
    ['Ошибка удаления', 'Delete failed'],
    ['Ошибка сети', 'Network error'],
    ['Не удалось скопировать ссылку', 'Could not copy the link'],
    ['Не удалось удалить граф', 'Could not delete the graph'],
    ['Ошибка сети при удалении', 'Network error while deleting'],
    ['Удаляю граф', 'Deleting graph'],
    ['Не удалось удалить автоматически', 'Could not delete automatically'],
    ['По умолчанию автоудаление выключено', 'Auto-delete is off by default'],
    ['Новые графы будут удаляться через 1 час', 'New graphs will be deleted after 1 hour'],
    ['Новые графы будут удаляться через 24 часа', 'New graphs will be deleted after 24 hours'],
    ['Новые графы будут удаляться через 7 дней', 'New graphs will be deleted after 7 days'],
    ['Автоудаление настроено', 'Auto-delete is configured'],
    ['Собираю граф', 'Building graph'],
    ['Старт', 'Start'],
    ['Обычный узел', 'Regular node'],
    ['Анонимный', 'Anonymous'],
    ['Бот', 'Bot'],
    ['Колесо: масштаб · drag: панорама и узлы', 'Wheel: zoom · drag: pan and nodes'],
    ['Размер узлов', 'Node size'],
    ['Толщина линий', 'Link thickness'],
    ['Расстояние', 'Distance'],
    ['Расталкивание', 'Repulsion'],
    ['Применить', 'Apply'],
    ['Перемешать', 'Shuffle']
  ];

  var ruToEn = {};
  var enToRu = {};
  phrases.forEach(function (pair) {
    ruToEn[pair[0]] = pair[1];
    if (!enToRu[pair[1]]) enToRu[pair[1]] = pair[0];
  });

  var messages = {
    ru: {
      copied: 'Скопировано',
      copyFailed: 'Не удалось скопировать ссылку',
      graphDeleted: 'Граф удалён',
      deleteError: 'Ошибка удаления',
      networkError: 'Ошибка сети',
      deleteFailed: 'Не удалось удалить граф',
      deleteNetworkError: 'Ошибка сети при удалении',
      confirmKicker: 'удаление графа',
      confirmTitle: 'Удалить этот граф?',
      confirmText: 'Граф исчезнет из архива и больше не будет открываться по старой ссылке.',
      confirmOk: 'Удалить',
      confirmCancel: 'Оставить',
      autoDefaultOff: 'По умолчанию автоудаление выключено',
      autoDefault60: 'Новые графы будут удаляться через 1 час',
      autoDefault1440: 'Новые графы будут удаляться через 24 часа',
      autoDefault10080: 'Новые графы будут удаляться через 7 дней',
      autoDefaultGeneric: 'Автоудаление настроено',
      autoNotPlanned: 'Не запланировано',
      autoDeleting: 'Удаляю граф',
      autoDeleteFailed: 'Не удалось удалить автоматически',
      mutualExchange: 'взаимный обмен',
      leavesHidden: 'листья скрыты'
    },
    en: {
      copied: 'Copied',
      copyFailed: 'Could not copy the link',
      graphDeleted: 'Graph deleted',
      deleteError: 'Delete failed',
      networkError: 'Network error',
      deleteFailed: 'Could not delete the graph',
      deleteNetworkError: 'Network error while deleting',
      confirmKicker: 'delete graph',
      confirmTitle: 'Delete this graph?',
      confirmText: 'The graph will disappear from the archive and the old link will stop opening it.',
      confirmOk: 'Delete',
      confirmCancel: 'Keep',
      autoDefaultOff: 'Auto-delete is off by default',
      autoDefault60: 'New graphs will be deleted after 1 hour',
      autoDefault1440: 'New graphs will be deleted after 24 hours',
      autoDefault10080: 'New graphs will be deleted after 7 days',
      autoDefaultGeneric: 'Auto-delete is configured',
      autoNotPlanned: 'Not scheduled',
      autoDeleting: 'Deleting graph',
      autoDeleteFailed: 'Could not delete automatically',
      mutualExchange: 'mutual exchange',
      leavesHidden: 'leaves hidden'
    }
  };

  function cleanLanguage(value) {
    value = String(value || '').toLowerCase();
    return supported.indexOf(value) === -1 ? 'ru' : value;
  }

  function getLanguage() {
    try {
      return cleanLanguage(localStorage.getItem(storageKey) || 'ru');
    } catch (e) {
      return 'ru';
    }
  }

  function saveLanguage(lang) {
    try {
      localStorage.setItem(storageKey, lang);
    } catch (e) {}
  }

  function ruPlural(n, one, few, many) {
    var nAbs = Math.abs(Number(n) || 0) % 100;
    var n1 = nAbs % 10;
    if (nAbs >= 11 && nAbs <= 19) return many;
    if (n1 === 1) return one;
    if (n1 >= 2 && n1 <= 4) return few;
    return many;
  }

  function enPlural(n, one, many) {
    return Math.abs(Number(n) || 0) === 1 ? one : many;
  }

  function formatUnit(type, value, lang) {
    lang = cleanLanguage(lang || getLanguage());
    var n = Number(value) || 0;
    if (lang === 'en') {
      if (type === 'record') return enPlural(n, 'record', 'records');
      if (type === 'graph') return enPlural(n, 'graph', 'graphs');
      if (type === 'node') return enPlural(n, 'node', 'nodes');
      if (type === 'edge') return enPlural(n, 'edge', 'edges');
      if (type === 'link') return enPlural(n, 'link', 'links');
      if (type === 'step') return enPlural(n, 'step', 'steps');
      if (type === 'gift') return enPlural(n, 'gift', 'gifts');
    }
    if (type === 'record') return ruPlural(n, 'запись', 'записи', 'записей');
    if (type === 'graph') return ruPlural(n, 'граф', 'графа', 'графов');
    if (type === 'node') return ruPlural(n, 'узел', 'узла', 'узлов');
    if (type === 'edge') return ruPlural(n, 'ребро', 'ребра', 'ребер');
    if (type === 'link') return ruPlural(n, 'связь', 'связи', 'связей');
    if (type === 'step') return ruPlural(n, 'шаг', 'шага', 'шагов');
    if (type === 'gift') return ruPlural(n, 'подарок', 'подарка', 'подарков');
    return '';
  }

  function formatNumberUnit(type, value, lang) {
    var n = Number(value) || 0;
    return n + ' ' + formatUnit(type, n, lang || getLanguage());
  }

  function formatGraphLabel(value, lang) {
    var text = String(value || '');
    lang = cleanLanguage(lang || getLanguage());
    if (lang === 'en') return text.replace(/^Граф(\s+)/, 'Graph$1');
    return text.replace(/^Graph(\s+)/, 'Граф$1');
  }

  function formatArchiveCount(value, lang) {
    return formatNumberUnit('record', value, lang || getLanguage());
  }

  function formatArchiveSummary(graphs, nodes, edges, lang) {
    lang = cleanLanguage(lang || getLanguage());
    graphs = Number(graphs) || 0;
    nodes = Number(nodes) || 0;
    edges = Number(edges) || 0;
    if (lang === 'en') {
      return 'Archive contains ' + formatNumberUnit('graph', graphs, lang) + ' with ' +
        formatNumberUnit('node', nodes, lang) + ' and ' + formatNumberUnit('link', edges, lang) + '.';
    }
    return 'В архиве: ' + formatNumberUnit('graph', graphs, lang) + ', ' +
      formatNumberUnit('node', nodes, lang) + ' и ' + formatNumberUnit('link', edges, lang) + '.';
  }

  function formatToolbarMeta(nodes, edges, pathLength, lang) {
    lang = cleanLanguage(lang || getLanguage());
    var parts = [formatNumberUnit('node', nodes, lang), formatNumberUnit('edge', edges, lang)];
    pathLength = Number(pathLength) || 0;
    if (pathLength > 0) {
      parts.push((lang === 'en' ? 'path: ' : 'путь ') + formatNumberUnit('step', pathLength, lang) + (lang === 'en' ? '' : ''));
    }
    return parts.join(' · ');
  }

  function formatDefaultAutoDelete(minutes, lang) {
    lang = cleanLanguage(lang || getLanguage());
    minutes = Number(minutes) || 0;
    if (!minutes) return messages[lang].autoDefaultOff;
    if (minutes === 60) return messages[lang].autoDefault60;
    if (minutes === 1440) return messages[lang].autoDefault1440;
    if (minutes === 10080) return messages[lang].autoDefault10080;
    return messages[lang].autoDefaultGeneric;
  }

  function formatAutoDelete(ms, lang) {
    lang = cleanLanguage(lang || getLanguage());
    ms = Number(ms) || 0;
    if (ms <= 0) return messages[lang].autoDeleting;
    var minutes = Math.ceil(ms / 60000);
    if (minutes < 60) return lang === 'en' ? 'Deleting in ' + minutes + ' min.' : 'Удаление через ' + minutes + ' мин.';
    var hours = Math.ceil(minutes / 60);
    if (hours < 48) return lang === 'en' ? 'Deleting in ' + hours + ' h' : 'Удаление через ' + hours + ' ч.';
    var days = Math.ceil(hours / 24);
    return lang === 'en' ? 'Deleting in ' + days + ' days' : 'Удаление через ' + days + ' дн.';
  }

  function formatGiftCount(count, mutual, lang) {
    lang = cleanLanguage(lang || getLanguage());
    count = Number(count) || 0;
    var label = formatNumberUnit('gift', count, lang);
    if (mutual) label += ' · ' + messages[lang].mutualExchange;
    return label;
  }

  function formatNodeTitle(info, lang) {
    lang = cleanLanguage(lang || getLanguage());
    info = info || {};
    var label = formatGraphLabel(info.label || info.id || info.title || '', lang);
    var degree = Number(info.degree) || 0;
    var links = formatNumberUnit('link', degree, lang);
    if (lang === 'en') {
      if (info.kind === 'start') return 'Search start: ' + label + ' · ' + links;
      if (info.kind === 'path') return 'On path: ' + label + ' · ' + links;
      if (info.kind === 'bot') return 'Bot · ' + links;
      if (info.kind === 'anonymous' || info.anonymous) return 'Anonymous sender · ' + links;
      return label + ' · ' + links;
    }
    if (info.kind === 'start') return 'Начало поиска: ' + label + ' · ' + links;
    if (info.kind === 'path') return 'На пути: ' + label + ' · ' + links;
    if (info.kind === 'bot') return 'Бот · ' + links;
    if (info.kind === 'anonymous' || info.anonymous) return 'Анонимный отправитель · ' + links;
    return label + ' · ' + links;
  }

  function translateDynamic(text, lang) {
    var m;
    if (lang === 'en') {
      m = text.match(/^Архив уже собрал\s+(\d+)\s+граф\w*\s+с\s+(\d+)\s+узл\w*\s+и\s+(\d+)\s+связ\w*\.$/i);
      if (m) return formatArchiveSummary(m[1], m[2], m[3], lang);
      m = text.match(/^В архиве:\s+(\d+)\s+граф\w*,\s+(\d+)\s+узл\w*\s+и\s+(\d+)\s+связ\w*\.$/i);
      if (m) return formatArchiveSummary(m[1], m[2], m[3], lang);
      m = text.match(/^путь\s+(\d+)\s+шаг\.?$/i);
      if (m) return 'path: ' + formatNumberUnit('step', m[1], lang);
      m = text.match(/^(\d+)\s+узл\w*$/i);
      if (m) return formatNumberUnit('node', m[1], lang);
      m = text.match(/^(\d+)\s+р[её]бер$/i);
      if (m) return formatNumberUnit('edge', m[1], lang);
      m = text.match(/^(\d+)\s+связ\w*$/i);
      if (m) return formatNumberUnit('link', m[1], lang);
      m = text.match(/^(\d+)\s+запис\w*$/i);
      if (m) return formatArchiveCount(m[1], lang);
      m = text.match(/^(\d+)\s+подар\w*(\s+·\s+взаимный обмен)?$/i);
      if (m) return formatGiftCount(m[1], Boolean(m[2]), lang);
      m = text.match(/^Удаление через\s+(\d+)\s+мин\.$/i);
      if (m) return 'Deleting in ' + m[1] + ' min.';
      m = text.match(/^Удаление через\s+(\d+)\s+ч\.$/i);
      if (m) return 'Deleting in ' + m[1] + ' h';
      m = text.match(/^Удаление через\s+(\d+)\s+дн\.$/i);
      if (m) return 'Deleting in ' + m[1] + ' days';
      if (/^Граф\s+/.test(text)) return formatGraphLabel(text, lang);
      return text;
    }

    m = text.match(/^Архив уже собрал\s+(\d+)\s+граф\w*\s+с\s+(\d+)\s+узл\w*\s+и\s+(\d+)\s+связ\w*\.$/i);
    if (m) return formatArchiveSummary(m[1], m[2], m[3], lang);
    m = text.match(/^В архиве:\s+(\d+)\s+граф\w*,\s+(\d+)\s+узл\w*\s+и\s+(\d+)\s+связ\w*\.$/i);
    if (m) return formatArchiveSummary(m[1], m[2], m[3], lang);
    m = text.match(/^путь\s+(\d+)\s+шаг\.?$/i);
    if (m) return 'путь ' + formatNumberUnit('step', m[1], lang);
    m = text.match(/^(\d+)\s+узл\w*$/i);
    if (m) return formatNumberUnit('node', m[1], lang);
    m = text.match(/^(\d+)\s+р[её]бер$/i);
    if (m) return formatNumberUnit('edge', m[1], lang);
    m = text.match(/^(\d+)\s+связ\w*$/i);
    if (m) return formatNumberUnit('link', m[1], lang);
    m = text.match(/^(\d+)\s+запис\w*$/i);
    if (m) return formatArchiveCount(m[1], lang);
    m = text.match(/^(\d+)\s+подар\w*(\s+·\s+взаимный обмен)?$/i);
    if (m) return formatGiftCount(m[1], Boolean(m[2]), lang);
    m = text.match(/^Deleting in\s+(\d+)\s+min\.$/i);
    if (m) return 'Удаление через ' + m[1] + ' мин.';
    m = text.match(/^Deleting in\s+(\d+)\s+h$/i);
    if (m) return 'Удаление через ' + m[1] + ' ч.';
    m = text.match(/^Deleting in\s+(\d+)\s+days$/i);
    if (m) return 'Удаление через ' + m[1] + ' дн.';
    if (/^Граф\s+/.test(text) || /^Graph\s+/.test(text)) return formatGraphLabel(text, lang);

    m = text.match(/^Archive contains\s+(\d+)\s+graphs?\s+with\s+(\d+)\s+nodes?\s+and\s+(\d+)\s+links?\.$/i);
    if (m) return formatArchiveSummary(m[1], m[2], m[3], lang);
    m = text.match(/^path:\s+(\d+)\s+steps?$/i);
    if (m) return 'путь ' + formatNumberUnit('step', m[1], lang);
    m = text.match(/^(\d+)\s+nodes?$/i);
    if (m) return formatNumberUnit('node', m[1], lang);
    m = text.match(/^(\d+)\s+edges?$/i);
    if (m) return formatNumberUnit('edge', m[1], lang);
    m = text.match(/^(\d+)\s+links?$/i);
    if (m) return formatNumberUnit('link', m[1], lang);
    m = text.match(/^(\d+)\s+records?$/i);
    if (m) return formatArchiveCount(m[1], lang);
    m = text.match(/^(\d+)\s+gifts?(\s+·\s+mutual exchange)?$/i);
    if (m) return formatGiftCount(m[1], Boolean(m[2]), lang);
    if (/^Graph\s+/.test(text)) return formatGraphLabel(text, lang);
    return text;
  }

  function translateString(value, lang) {
    if (value == null) return value;
    lang = cleanLanguage(lang || getLanguage());
    var original = String(value);
    var leading = original.match(/^\s*/)[0];
    var trailing = original.match(/\s*$/)[0];
    var text = original.trim();
    if (!text) return original;
    var translated = lang === 'en' ? (ruToEn[text] || translateDynamic(text, lang)) : (enToRu[text] || translateDynamic(text, lang));
    return leading + translated + trailing;
  }

  function translateElementText(scope, lang) {
    scope = scope || document;
    lang = cleanLanguage(lang || getLanguage());
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        var tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'OPTION') return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var next = translateString(node.nodeValue, lang);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
  }

  function translateAttributes(scope, lang) {
    scope = scope || document;
    lang = cleanLanguage(lang || getLanguage());
    var attrs = ['placeholder', 'aria-label', 'title'];
    var nodes = scope.querySelectorAll ? scope.querySelectorAll('*') : [];
    Array.prototype.forEach.call(nodes, function (el) {
      attrs.forEach(function (attr) {
        if (!el.hasAttribute(attr)) return;
        var current = el.getAttribute(attr);
        var next = translateString(current, lang);
        if (next !== current) el.setAttribute(attr, next);
      });
    });
  }

  function syncLanguageControls(lang) {
    lang = cleanLanguage(lang || getLanguage());
    document.querySelectorAll('[data-language-choice]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-language-choice') === lang);
      button.setAttribute('aria-pressed', button.getAttribute('data-language-choice') === lang ? 'true' : 'false');
    });
  }

  function translate(scope, lang) {
    lang = cleanLanguage(lang || getLanguage());
    root.setAttribute('lang', lang);
    root.setAttribute('data-language', lang);
    if (document.title) document.title = translateString(document.title, lang);
    translateElementText(scope || document, lang);
    translateAttributes(scope || document, lang);
    syncLanguageControls(lang);
  }

  function setLanguage(lang, options) {
    lang = cleanLanguage(lang);
    options = options || {};
    saveLanguage(lang);
    translate(document, lang);
    if (!options.silent) {
      document.dispatchEvent(new CustomEvent('giftgraph:languagechange', { detail: { language: lang } }));
    }
  }

  function bindLanguageControls(scope) {
    scope = scope || document;
    var nodes = scope.querySelectorAll ? scope.querySelectorAll('[data-language-choice]') : [];
    Array.prototype.forEach.call(nodes, function (button) {
      if (button.dataset.languageBound === '1') return;
      button.dataset.languageBound = '1';
      button.addEventListener('click', function () {
        setLanguage(button.getAttribute('data-language-choice'));
      });
    });
    syncLanguageControls(getLanguage());
  }

  function init(scope) {
    bindLanguageControls(scope || document);
    translate(scope || document, getLanguage());
  }

  window.GiftGraphI18n = {
    init: init,
    lang: getLanguage,
    setLanguage: setLanguage,
    translate: translate,
    bindLanguageControls: bindLanguageControls,
    t: function (key) {
      var lang = getLanguage();
      return (messages[lang] && messages[lang][key]) || (messages.ru && messages.ru[key]) || key;
    },
    formatUnit: formatUnit,
    formatNumberUnit: formatNumberUnit,
    formatGraphLabel: formatGraphLabel,
    formatArchiveCount: formatArchiveCount,
    formatArchiveSummary: formatArchiveSummary,
    formatToolbarMeta: formatToolbarMeta,
    formatDefaultAutoDelete: formatDefaultAutoDelete,
    formatAutoDelete: formatAutoDelete,
    formatGiftCount: formatGiftCount,
    formatNodeTitle: formatNodeTitle,
    translateString: translateString
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(document); });
  } else {
    init(document);
  }
})();
