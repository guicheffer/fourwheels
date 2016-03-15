(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

var $ = require('./zepto');

var jsonpID = 0,
  document = window.document,
  key,
  name,
  rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  scriptTypeRE = /^(?:text|application)\/javascript/i,
  xmlTypeRE = /^(?:text|application)\/xml/i,
  jsonType = 'application/json',
  htmlType = 'text/html',
  blankRE = /^\s*$/,
  originAnchor = document.createElement('a')

originAnchor.href = window.location.href

// trigger a custom event and return false if it was cancelled
function triggerAndReturn(context, eventName, data) {
  var event = $.Event(eventName)
  $(context).trigger(event, data)
  return !event.isDefaultPrevented()
}

// trigger an Ajax "global" event
function triggerGlobal(settings, context, eventName, data) {
  if (settings.global) return triggerAndReturn(context || document, eventName, data)
}

// Number of active Ajax requests
$.active = 0

function ajaxStart(settings) {
  if (settings.global && $.active++ === 0) triggerGlobal(settings, null, 'ajaxStart')
}
function ajaxStop(settings) {
  if (settings.global && !(--$.active)) triggerGlobal(settings, null, 'ajaxStop')
}

// triggers an extra global event "ajaxBeforeSend" that's like "ajaxSend" but cancelable
function ajaxBeforeSend(xhr, settings) {
  var context = settings.context
  if (settings.beforeSend.call(context, xhr, settings) === false ||
    triggerGlobal(settings, context, 'ajaxBeforeSend', [xhr, settings]) === false)
    return false

  triggerGlobal(settings, context, 'ajaxSend', [xhr, settings])
}
function ajaxSuccess(data, xhr, settings, deferred) {
  var context = settings.context, status = 'success'
  settings.success.call(context, data, status, xhr)
  if (deferred) deferred.resolveWith(context, [data, status, xhr])
  triggerGlobal(settings, context, 'ajaxSuccess', [xhr, settings, data])
  ajaxComplete(status, xhr, settings)
}
// type: "timeout", "error", "abort", "parsererror"
function ajaxError(error, type, xhr, settings, deferred) {
  var context = settings.context
  settings.error.call(context, xhr, type, error)
  if (deferred) deferred.rejectWith(context, [xhr, type, error])
  triggerGlobal(settings, context, 'ajaxError', [xhr, settings, error || type])
  ajaxComplete(type, xhr, settings)
}
// status: "success", "notmodified", "error", "timeout", "abort", "parsererror"
function ajaxComplete(status, xhr, settings) {
  var context = settings.context
  settings.complete.call(context, xhr, status)
  triggerGlobal(settings, context, 'ajaxComplete', [xhr, settings])
  ajaxStop(settings)
}

// Empty function, used as default callback
function empty() {
}

$.ajaxJSONP = function (options, deferred) {
  if (!('type' in options)) return $.ajax(options)

  var _callbackName = options.jsonpCallback,
    callbackName = ($.isFunction(_callbackName) ?
        _callbackName() : _callbackName) || ('jsonp' + (++jsonpID)),
    script = document.createElement('script'),
    originalCallback = window[callbackName],
    responseData,
    abort = function (errorType) {
      $(script).triggerHandler('error', errorType || 'abort')
    },
    xhr = {abort: abort}, abortTimeout

  if (deferred) deferred.promise(xhr)

  $(script).on('load error', function (e, errorType) {
    clearTimeout(abortTimeout)
    $(script).off().remove()

    if (e.type == 'error' || !responseData) {
      ajaxError(null, errorType || 'error', xhr, options, deferred)
    } else {
      ajaxSuccess(responseData[0], xhr, options, deferred)
    }

    window[callbackName] = originalCallback
    if (responseData && $.isFunction(originalCallback))
      originalCallback(responseData[0])

    originalCallback = responseData = undefined
  })

  if (ajaxBeforeSend(xhr, options) === false) {
    abort('abort')
    return xhr
  }

  window[callbackName] = function () {
    responseData = arguments
  }

  script.src = options.url.replace(/\?(.+)=\?/, '?$1=' + callbackName)
  document.head.appendChild(script)

  if (options.timeout > 0) abortTimeout = setTimeout(function () {
    abort('timeout')
  }, options.timeout)

  return xhr
}

$.ajaxSettings = {
  // Default type of request
  type: 'GET',
  // Callback that is executed before request
  beforeSend: empty,
  // Callback that is executed if the request succeeds
  success: empty,
  // Callback that is executed the the server drops error
  error: empty,
  // Callback that is executed on request complete (both: error and success)
  complete: empty,
  // The context for the callbacks
  context: null,
  // Whether to trigger "global" Ajax events
  global: true,
  // Transport
  xhr: function () {
    return new window.XMLHttpRequest()
  },
  // MIME types mapping
  // IIS returns Javascript as "application/x-javascript"
  accepts: {
    script: 'text/javascript, application/javascript, application/x-javascript',
    json: jsonType,
    xml: 'application/xml, text/xml',
    html: htmlType,
    text: 'text/plain'
  },
  // Whether the request is to another domain
  crossDomain: false,
  // Default timeout
  timeout: 0,
  // Whether data should be serialized to string
  processData: true,
  // Whether the browser should be allowed to cache GET responses
  cache: true
}

function mimeToDataType(mime) {
  if (mime) mime = mime.split(';', 2)[0]
  return mime && ( mime == htmlType ? 'html' :
      mime == jsonType ? 'json' :
        scriptTypeRE.test(mime) ? 'script' :
        xmlTypeRE.test(mime) && 'xml' ) || 'text'
}

function appendQuery(url, query) {
  if (query == '') return url
  return (url + '&' + query).replace(/[&?]{1,2}/, '?')
}

// serialize payload and append it to the URL for GET requests
function serializeData(options) {
  if (options.processData && options.data && $.type(options.data) != "string")
    options.data = $.param(options.data, options.traditional)
  if (options.data && (!options.type || options.type.toUpperCase() == 'GET'))
    options.url = appendQuery(options.url, options.data), options.data = undefined
}

$.ajax = function (options) {
  var settings = $.extend({}, options || {}),
    deferred = $.Deferred && $.Deferred(),
    urlAnchor, hashIndex
  for (key in $.ajaxSettings) if (settings[key] === undefined) settings[key] = $.ajaxSettings[key]

  ajaxStart(settings)

  if (!settings.crossDomain) {
    urlAnchor = document.createElement('a')
    urlAnchor.href = settings.url
    // cleans up URL for .href (IE only), see https://github.com/madrobby/zepto/pull/1049
    urlAnchor.href = urlAnchor.href
    settings.crossDomain = (originAnchor.protocol + '//' + originAnchor.host) !== (urlAnchor.protocol + '//' + urlAnchor.host)
  }

  if (!settings.url) settings.url = window.location.toString()
  if ((hashIndex = settings.url.indexOf('#')) > -1) settings.url = settings.url.slice(0, hashIndex)
  serializeData(settings)

  var dataType = settings.dataType, hasPlaceholder = /\?.+=\?/.test(settings.url)
  if (hasPlaceholder) dataType = 'jsonp'

  if (settings.cache === false || (
      (!options || options.cache !== true) &&
      ('script' == dataType || 'jsonp' == dataType)
    ))
    settings.url = appendQuery(settings.url, '_=' + Date.now())

  if ('jsonp' == dataType) {
    if (!hasPlaceholder)
      settings.url = appendQuery(settings.url,
        settings.jsonp ? (settings.jsonp + '=?') : settings.jsonp === false ? '' : 'callback=?')
    return $.ajaxJSONP(settings, deferred)
  }

  var mime = settings.accepts[dataType],
    headers = {},
    setHeader = function (name, value) {
      headers[name.toLowerCase()] = [name, value]
    },
    protocol = /^([\w-]+:)\/\//.test(settings.url) ? RegExp.$1 : window.location.protocol,
    xhr = settings.xhr(),
    nativeSetHeader = xhr.setRequestHeader,
    abortTimeout

  if (deferred) deferred.promise(xhr)

  if (!settings.crossDomain) setHeader('X-Requested-With', 'XMLHttpRequest')
  setHeader('Accept', mime || '*/*')
  if (mime = settings.mimeType || mime) {
    if (mime.indexOf(',') > -1) mime = mime.split(',', 2)[0]
    xhr.overrideMimeType && xhr.overrideMimeType(mime)
  }
  if (settings.contentType || (settings.contentType !== false && settings.data && settings.type.toUpperCase() != 'GET'))
    setHeader('Content-Type', settings.contentType || 'application/x-www-form-urlencoded')

  if (settings.headers) for (name in settings.headers) setHeader(name, settings.headers[name])
  xhr.setRequestHeader = setHeader

  xhr.onreadystatechange = function () {
    if (xhr.readyState == 4) {
      xhr.onreadystatechange = empty
      clearTimeout(abortTimeout)
      var result, error = false
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || (xhr.status == 0 && protocol == 'file:')) {
        dataType = dataType || mimeToDataType(settings.mimeType || xhr.getResponseHeader('content-type'))

        if (xhr.responseType == 'arraybuffer' || xhr.responseType == 'blob')
          result = xhr.response
        else {
          result = xhr.responseText

          try {
            // http://perfectionkills.com/global-eval-what-are-the-options/
            if (dataType == 'script')    (1, eval)(result)
            else if (dataType == 'xml')  result = xhr.responseXML
            else if (dataType == 'json') result = blankRE.test(result) ? null : $.parseJSON(result)
          } catch (e) {
            error = e
          }

          if (error) return ajaxError(error, 'parsererror', xhr, settings, deferred)
        }

        ajaxSuccess(result, xhr, settings, deferred)
      } else {
        ajaxError(xhr.statusText || null, xhr.status ? 'error' : 'abort', xhr, settings, deferred)
      }
    }
  }

  if (ajaxBeforeSend(xhr, settings) === false) {
    xhr.abort()
    ajaxError(null, 'abort', xhr, settings, deferred)
    return xhr
  }

  if (settings.xhrFields) for (name in settings.xhrFields) xhr[name] = settings.xhrFields[name]

  var async = 'async' in settings ? settings.async : true
  xhr.open(settings.type, settings.url, async, settings.username, settings.password)

  for (name in headers) nativeSetHeader.apply(xhr, headers[name])

  if (settings.timeout > 0) abortTimeout = setTimeout(function () {
    xhr.onreadystatechange = empty
    xhr.abort()
    ajaxError(null, 'timeout', xhr, settings, deferred)
  }, settings.timeout)

  // avoid sending empty string (#319)
  xhr.send(settings.data ? settings.data : null)
  return xhr
}

// handle optional data/success arguments
function parseArguments(url, data, success, dataType) {
  if ($.isFunction(data)) dataType = success, success = data, data = undefined
  if (!$.isFunction(success)) dataType = success, success = undefined
  return {
    url: url
    , data: data
    , success: success
    , dataType: dataType
  }
}

$.get = function (/* url, data, success, dataType */) {
  return $.ajax(parseArguments.apply(null, arguments))
}

$.post = function (/* url, data, success, dataType */) {
  var options = parseArguments.apply(null, arguments)
  options.type = 'POST'
  return $.ajax(options)
}

$.getJSON = function (/* url, data, success */) {
  var options = parseArguments.apply(null, arguments)
  options.dataType = 'json'
  return $.ajax(options)
}

$.fn.load = function (url, data, success) {
  if (!this.length) return this
  var self = this, parts = url.split(/\s/), selector,
    options = parseArguments(url, data, success),
    callback = options.success
  if (parts.length > 1) options.url = parts[0], selector = parts[1]
  options.success = function (response) {
    self.html(selector ?
      $('<div>').html(response.replace(rscript, "")).find(selector)
      : response)
    callback && callback.apply(self, arguments)
  }
  $.ajax(options)
  return this
}

var escape = encodeURIComponent

function serialize(params, obj, traditional, scope) {
  var type, array = $.isArray(obj), hash = $.isPlainObject(obj)
  $.each(obj, function (key, value) {
    type = $.type(value)
    if (scope) key = traditional ? scope :
    scope + '[' + (hash || type == 'object' || type == 'array' ? key : '') + ']'
    // handle data in serializeArray() format
    if (!scope && array) params.add(value.name, value.value)
    // recurse into nested objects
    else if (type == "array" || (!traditional && type == "object"))
      serialize(params, value, traditional, key)
    else params.add(key, value)
  })
}

$.param = function (obj, traditional) {
  var params = []
  params.add = function (key, value) {
    if ($.isFunction(value)) value = value()
    if (value == null) value = ""
    this.push(escape(key) + '=' + escape(value))
  }
  serialize(params, obj, traditional)
  return params.join('&').replace(/%20/g, '+')
}

},{"./zepto":7}],2:[function(require,module,exports){
//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

var $ = require('./zepto');

function detect(ua, platform) {
  var os = this.os = {}, browser = this.browser = {},
    webkit = ua.match(/Web[kK]it[\/]{0,1}([\d.]+)/),
    android = ua.match(/(Android);?[\s\/]+([\d.]+)?/),
    osx = !!ua.match(/\(Macintosh\; Intel /),
    ipad = ua.match(/(iPad).*OS\s([\d_]+)/),
    ipod = ua.match(/(iPod)(.*OS\s([\d_]+))?/),
    iphone = !ipad && ua.match(/(iPhone\sOS)\s([\d_]+)/),
    webos = ua.match(/(webOS|hpwOS)[\s\/]([\d.]+)/),
    win = /Win\d{2}|Windows/.test(platform),
    wp = ua.match(/Windows Phone ([\d.]+)/),
    touchpad = webos && ua.match(/TouchPad/),
    kindle = ua.match(/Kindle\/([\d.]+)/),
    silk = ua.match(/Silk\/([\d._]+)/),
    blackberry = ua.match(/(BlackBerry).*Version\/([\d.]+)/),
    bb10 = ua.match(/(BB10).*Version\/([\d.]+)/),
    rimtabletos = ua.match(/(RIM\sTablet\sOS)\s([\d.]+)/),
    playbook = ua.match(/PlayBook/),
    chrome = ua.match(/Chrome\/([\d.]+)/) || ua.match(/CriOS\/([\d.]+)/),
    firefox = ua.match(/Firefox\/([\d.]+)/),
    firefoxos = ua.match(/\((?:Mobile|Tablet); rv:([\d.]+)\).*Firefox\/[\d.]+/),
    ie = ua.match(/MSIE\s([\d.]+)/) || ua.match(/Trident\/[\d](?=[^\?]+).*rv:([0-9.].)/),
    webview = !chrome && ua.match(/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/),
    safari = webview || ua.match(/Version\/([\d.]+)([^S](Safari)|[^M]*(Mobile)[^S]*(Safari))/)

  // Todo: clean this up with a better OS/browser seperation:
  // - discern (more) between multiple browsers on android
  // - decide if kindle fire in silk mode is android or not
  // - Firefox on Android doesn't specify the Android version
  // - possibly devide in os, device and browser hashes

  if (browser.webkit = !!webkit) browser.version = webkit[1]

  if (android) os.android = true, os.version = android[2]
  if (iphone && !ipod) os.ios = os.iphone = true, os.version = iphone[2].replace(/_/g, '.')
  if (ipad) os.ios = os.ipad = true, os.version = ipad[2].replace(/_/g, '.')
  if (ipod) os.ios = os.ipod = true, os.version = ipod[3] ? ipod[3].replace(/_/g, '.') : null
  if (wp) os.wp = true, os.version = wp[1]
  if (webos) os.webos = true, os.version = webos[2]
  if (touchpad) os.touchpad = true
  if (blackberry) os.blackberry = true, os.version = blackberry[2]
  if (bb10) os.bb10 = true, os.version = bb10[2]
  if (rimtabletos) os.rimtabletos = true, os.version = rimtabletos[2]
  if (playbook) browser.playbook = true
  if (kindle) os.kindle = true, os.version = kindle[1]
  if (silk) browser.silk = true, browser.version = silk[1]
  if (!silk && os.android && ua.match(/Kindle Fire/)) browser.silk = true
  if (chrome) browser.chrome = true, browser.version = chrome[1]
  if (firefox) browser.firefox = true, browser.version = firefox[1]
  if (firefoxos) os.firefoxos = true, os.version = firefoxos[1]
  if (ie) browser.ie = true, browser.version = ie[1]
  if (safari && (osx || os.ios || win)) {
    browser.safari = true
    if (!os.ios) browser.version = safari[1]
  }
  if (webview) browser.webview = true

  os.tablet = !!(ipad || playbook || (android && !ua.match(/Mobile/)) ||
  (firefox && ua.match(/Tablet/)) || (ie && !ua.match(/Phone/) && ua.match(/Touch/)))
  os.phone = !!(!os.tablet && !os.ipod && (android || iphone || webos || blackberry || bb10 ||
  (chrome && ua.match(/Android/)) || (chrome && ua.match(/CriOS\/([\d.]+)/)) ||
  (firefox && ua.match(/Mobile/)) || (ie && ua.match(/Touch/))))
}

detect.call($, navigator.userAgent, navigator.platform)
// make available to unit tests
$.__detect = detect

},{"./zepto":7}],3:[function(require,module,exports){
//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

var $ = require('./zepto');

var _zid = 1, undefined,
  slice = Array.prototype.slice,
  isFunction = $.isFunction,
  isString = function (obj) {
    return typeof obj == 'string'
  },
  handlers = {},
  specialEvents = {},
  focusinSupported = 'onfocusin' in window,
  focus = {focus: 'focusin', blur: 'focusout'},
  hover = {mouseenter: 'mouseover', mouseleave: 'mouseout'}

specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

function zid(element) {
  return element._zid || (element._zid = _zid++)
}
function findHandlers(element, event, fn, selector) {
  event = parse(event)
  if (event.ns) var matcher = matcherFor(event.ns)
  return (handlers[zid(element)] || []).filter(function (handler) {
    return handler
      && (!event.e || handler.e == event.e)
      && (!event.ns || matcher.test(handler.ns))
      && (!fn || zid(handler.fn) === zid(fn))
      && (!selector || handler.sel == selector)
  })
}
function parse(event) {
  var parts = ('' + event).split('.')
  return {e: parts[0], ns: parts.slice(1).sort().join(' ')}
}
function matcherFor(ns) {
  return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
}

function eventCapture(handler, captureSetting) {
  return handler.del &&
    (!focusinSupported && (handler.e in focus)) || !!captureSetting
}

function realEvent(type) {
  return hover[type] || (focusinSupported && focus[type]) || type
}

function add(element, events, fn, data, selector, delegator, capture) {
  var id = zid(element), set = (handlers[id] || (handlers[id] = []))
  events.split(/\s/).forEach(function (event) {
    if (event == 'ready') return $(document).ready(fn)
    var handler = parse(event)
    handler.fn = fn
    handler.sel = selector
    // emulate mouseenter, mouseleave
    if (handler.e in hover) fn = function (e) {
      var related = e.relatedTarget
      if (!related || (related !== this && !$.contains(this, related)))
        return handler.fn.apply(this, arguments)
    }
    handler.del = delegator
    var callback = delegator || fn
    handler.proxy = function (e) {
      e = compatible(e)
      if (e.isImmediatePropagationStopped()) return
      e.data = data
      var result = callback.apply(element, e._args == undefined ? [e] : [e].concat(e._args))
      if (result === false) e.preventDefault(), e.stopPropagation()
      return result
    }
    handler.i = set.length
    set.push(handler)
    if ('addEventListener' in element)
      element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
  })
}
function remove(element, events, fn, selector, capture) {
  var id = zid(element)
    ;
  (events || '').split(/\s/).forEach(function (event) {
    findHandlers(element, event, fn, selector).forEach(function (handler) {
      delete handlers[id][handler.i]
      if ('removeEventListener' in element)
        element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
    })
  })
}

$.event = {add: add, remove: remove}

$.proxy = function (fn, context) {
  var args = (2 in arguments) && slice.call(arguments, 2)
  if (isFunction(fn)) {
    var proxyFn = function () {
      return fn.apply(context, args ? args.concat(slice.call(arguments)) : arguments)
    }
    proxyFn._zid = zid(fn)
    return proxyFn
  } else if (isString(context)) {
    if (args) {
      args.unshift(fn[context], fn)
      return $.proxy.apply(null, args)
    } else {
      return $.proxy(fn[context], fn)
    }
  } else {
    throw new TypeError("expected function")
  }
}

$.fn.bind = function (event, data, callback) {
  return this.on(event, data, callback)
}
$.fn.unbind = function (event, callback) {
  return this.off(event, callback)
}
$.fn.one = function (event, selector, data, callback) {
  return this.on(event, selector, data, callback, 1)
}

var returnTrue = function () {
    return true
  },
  returnFalse = function () {
    return false
  },
  ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$)/,
  eventMethods = {
    preventDefault: 'isDefaultPrevented',
    stopImmediatePropagation: 'isImmediatePropagationStopped',
    stopPropagation: 'isPropagationStopped'
  }

function compatible(event, source) {
  if (source || !event.isDefaultPrevented) {
    source || (source = event)

    $.each(eventMethods, function (name, predicate) {
      var sourceMethod = source[name]
      event[name] = function () {
        this[predicate] = returnTrue
        return sourceMethod && sourceMethod.apply(source, arguments)
      }
      event[predicate] = returnFalse
    })

    if (source.defaultPrevented !== undefined ? source.defaultPrevented :
        'returnValue' in source ? source.returnValue === false :
        source.getPreventDefault && source.getPreventDefault())
      event.isDefaultPrevented = returnTrue
  }
  return event
}

function createProxy(event) {
  var key, proxy = {originalEvent: event}
  for (key in event)
    if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]

  return compatible(proxy, event)
}

$.fn.delegate = function (selector, event, callback) {
  return this.on(event, selector, callback)
}
$.fn.undelegate = function (selector, event, callback) {
  return this.off(event, selector, callback)
}

$.fn.live = function (event, callback) {
  $(document.body).delegate(this.selector, event, callback)
  return this
}
$.fn.die = function (event, callback) {
  $(document.body).undelegate(this.selector, event, callback)
  return this
}

$.fn.on = function (event, selector, data, callback, one) {
  var autoRemove, delegator, $this = this
  if (event && !isString(event)) {
    $.each(event, function (type, fn) {
      $this.on(type, selector, data, fn, one)
    })
    return $this
  }

  if (!isString(selector) && !isFunction(callback) && callback !== false)
    callback = data, data = selector, selector = undefined
  if (callback === undefined || data === false)
    callback = data, data = undefined

  if (callback === false) callback = returnFalse

  return $this.each(function (_, element) {
    if (one) autoRemove = function (e) {
      remove(element, e.type, callback)
      return callback.apply(this, arguments)
    }

    if (selector) delegator = function (e) {
      var evt, match = $(e.target).closest(selector, element).get(0)
      if (match && match !== element) {
        evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})
        return (autoRemove || callback).apply(match, [evt].concat(slice.call(arguments, 1)))
      }
    }

    add(element, event, callback, data, selector, delegator || autoRemove)
  })
}
$.fn.off = function (event, selector, callback) {
  var $this = this
  if (event && !isString(event)) {
    $.each(event, function (type, fn) {
      $this.off(type, selector, fn)
    })
    return $this
  }

  if (!isString(selector) && !isFunction(callback) && callback !== false)
    callback = selector, selector = undefined

  if (callback === false) callback = returnFalse

  return $this.each(function () {
    remove(this, event, callback, selector)
  })
}

$.fn.trigger = function (event, args) {
  event = (isString(event) || $.isPlainObject(event)) ? $.Event(event) : compatible(event)
  event._args = args
  return this.each(function () {
    // handle focus(), blur() by calling them directly
    if (event.type in focus && typeof this[event.type] == "function") this[event.type]()
    // items in the collection might not be DOM elements
    else if ('dispatchEvent' in this) this.dispatchEvent(event)
    else $(this).triggerHandler(event, args)
  })
}

// triggers event handlers on current element just as if an event occurred,
// doesn't trigger an actual event, doesn't bubble
$.fn.triggerHandler = function (event, args) {
  var e, result
  this.each(function (i, element) {
    e = createProxy(isString(event) ? $.Event(event) : event)
    e._args = args
    e.target = element
    $.each(findHandlers(element, event.type || event), function (i, handler) {
      result = handler.proxy(e)
      if (e.isImmediatePropagationStopped()) return false
    })
  })
  return result
}

  // shortcut methods for `.bind(event, fn)` for each event type
;
('focusin focusout focus blur load resize scroll unload click dblclick ' +
'mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave ' +
'change select keydown keypress keyup error').split(' ').forEach(function (event) {
  $.fn[event] = function (callback) {
    return (0 in arguments) ?
      this.bind(event, callback) :
      this.trigger(event)
  }
})

$.Event = function (type, props) {
  if (!isString(type)) props = type, type = props.type
  var event = document.createEvent(specialEvents[type] || 'Events'), bubbles = true
  if (props) for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
  event.initEvent(type, bubbles, true)
  return compatible(event)
}

},{"./zepto":7}],4:[function(require,module,exports){
//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

var $ = require('./zepto');

$.fn.serializeArray = function () {
  var name, type, result = [],
    add = function (value) {
      if (value.forEach) return value.forEach(add)
      result.push({name: name, value: value})
    }
  if (this[0]) $.each(this[0].elements, function (_, field) {
    type = field.type, name = field.name
    if (name && field.nodeName.toLowerCase() != 'fieldset' && !field.disabled && type != 'submit' && type != 'reset' && type != 'button' && type != 'file' &&
      ((type != 'radio' && type != 'checkbox') || field.checked))
      add($(field).val())
  })
  return result
}

$.fn.serialize = function () {
  var result = []
  this.serializeArray().forEach(function (elm) {
    result.push(encodeURIComponent(elm.name) + '=' + encodeURIComponent(elm.value))
  })
  return result.join('&')
}

$.fn.submit = function (callback) {
  if (0 in arguments) this.bind('submit', callback)
  else if (this.length) {
    var event = $.Event('submit')
    this.eq(0).trigger(event)
    if (!event.isDefaultPrevented()) this.get(0).submit()
  }
  return this
}

},{"./zepto":7}],5:[function(require,module,exports){
//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

var $ = require('./zepto');

var prefix = '', eventPrefix,
  vendors = {Webkit: 'webkit', Moz: '', O: 'o'},
  testEl = document.createElement('div'),
  supportedTransforms = /^((translate|rotate|scale)(X|Y|Z|3d)?|matrix(3d)?|perspective|skew(X|Y)?)$/i,
  transform,
  transitionProperty, transitionDuration, transitionTiming, transitionDelay,
  animationName, animationDuration, animationTiming, animationDelay,
  cssReset = {}

function dasherize(str) {
  return str.replace(/([a-z])([A-Z])/, '$1-$2').toLowerCase()
}
function normalizeEvent(name) {
  return eventPrefix ? eventPrefix + name : name.toLowerCase()
}

$.each(vendors, function (vendor, event) {
  if (testEl.style[vendor + 'TransitionProperty'] !== undefined) {
    prefix = '-' + vendor.toLowerCase() + '-'
    eventPrefix = event
    return false
  }
})

transform = prefix + 'transform'
cssReset[transitionProperty = prefix + 'transition-property'] =
  cssReset[transitionDuration = prefix + 'transition-duration'] =
    cssReset[transitionDelay = prefix + 'transition-delay'] =
      cssReset[transitionTiming = prefix + 'transition-timing-function'] =
        cssReset[animationName = prefix + 'animation-name'] =
          cssReset[animationDuration = prefix + 'animation-duration'] =
            cssReset[animationDelay = prefix + 'animation-delay'] =
              cssReset[animationTiming = prefix + 'animation-timing-function'] = ''

$.fx = {
  off: (eventPrefix === undefined && testEl.style.transitionProperty === undefined),
  speeds: {_default: 400, fast: 200, slow: 600},
  cssPrefix: prefix,
  transitionEnd: normalizeEvent('TransitionEnd'),
  animationEnd: normalizeEvent('AnimationEnd')
}

$.fn.animate = function (properties, duration, ease, callback, delay) {
  if ($.isFunction(duration))
    callback = duration, ease = undefined, duration = undefined
  if ($.isFunction(ease))
    callback = ease, ease = undefined
  if ($.isPlainObject(duration))
    ease = duration.easing, callback = duration.complete, delay = duration.delay, duration = duration.duration
  if (duration) duration = (typeof duration == 'number' ? duration :
      ($.fx.speeds[duration] || $.fx.speeds._default)) / 1000
  if (delay) delay = parseFloat(delay) / 1000
  return this.anim(properties, duration, ease, callback, delay)
}

$.fn.anim = function (properties, duration, ease, callback, delay) {
  var key, cssValues = {}, cssProperties, transforms = '',
    that = this, wrappedCallback, endEvent = $.fx.transitionEnd,
    fired = false

  if (duration === undefined) duration = $.fx.speeds._default / 1000
  if (delay === undefined) delay = 0
  if ($.fx.off) duration = 0

  if (typeof properties == 'string') {
    // keyframe animation
    cssValues[animationName] = properties
    cssValues[animationDuration] = duration + 's'
    cssValues[animationDelay] = delay + 's'
    cssValues[animationTiming] = (ease || 'linear')
    endEvent = $.fx.animationEnd
  } else {
    cssProperties = []
    // CSS transitions
    for (key in properties)
      if (supportedTransforms.test(key)) transforms += key + '(' + properties[key] + ') '
      else cssValues[key] = properties[key], cssProperties.push(dasherize(key))

    if (transforms) cssValues[transform] = transforms, cssProperties.push(transform)
    if (duration > 0 && typeof properties === 'object') {
      cssValues[transitionProperty] = cssProperties.join(', ')
      cssValues[transitionDuration] = duration + 's'
      cssValues[transitionDelay] = delay + 's'
      cssValues[transitionTiming] = (ease || 'linear')
    }
  }

  wrappedCallback = function (event) {
    if (typeof event !== 'undefined') {
      if (event.target !== event.currentTarget) return // makes sure the event didn't bubble from "below"
      $(event.target).unbind(endEvent, wrappedCallback)
    } else
      $(this).unbind(endEvent, wrappedCallback) // triggered by setTimeout

    fired = true
    $(this).css(cssReset)
    callback && callback.call(this)
  }
  if (duration > 0) {
    this.bind(endEvent, wrappedCallback)
    // transitionEnd is not always firing on older Android phones
    // so make sure it gets fired
    setTimeout(function () {
      if (fired) return
      wrappedCallback.call(that)
    }, ((duration + delay) * 1000) + 25)
  }

  // trigger page reflow so new elements can animate
  this.size() && this.get(0).clientLeft

  this.css(cssValues)

  if (duration <= 0) setTimeout(function () {
    that.each(function () {
      wrappedCallback.call(this)
    })
  }, 0)

  return this
}

testEl = null

},{"./zepto":7}],6:[function(require,module,exports){
//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

var $ = require('./zepto');

var document = window.document, docElem = document.documentElement,
  origShow = $.fn.show, origHide = $.fn.hide, origToggle = $.fn.toggle

function anim(el, speed, opacity, scale, callback) {
  if (typeof speed == 'function' && !callback) callback = speed, speed = undefined
  var props = {opacity: opacity}
  if (scale) {
    props.scale = scale
    el.css($.fx.cssPrefix + 'transform-origin', '0 0')
  }
  return el.animate(props, speed, null, callback)
}

function hide(el, speed, scale, callback) {
  return anim(el, speed, 0, scale, function () {
    origHide.call($(this))
    callback && callback.call(this)
  })
}

$.fn.show = function (speed, callback) {
  origShow.call(this)
  if (speed === undefined) speed = 0
  else this.css('opacity', 0)
  return anim(this, speed, 1, '1,1', callback)
}

$.fn.hide = function (speed, callback) {
  if (speed === undefined) return origHide.call(this)
  else return hide(this, speed, '0,0', callback)
}

$.fn.toggle = function (speed, callback) {
  if (speed === undefined || typeof speed == 'boolean')
    return origToggle.call(this, speed)
  else return this.each(function () {
    var el = $(this)
    el[el.css('display') == 'none' ? 'show' : 'hide'](speed, callback)
  })
}

$.fn.fadeTo = function (speed, opacity, callback) {
  return anim(this, speed, opacity, null, callback)
}

$.fn.fadeIn = function (speed, callback) {
  var target = this.css('opacity')
  if (target > 0) this.css('opacity', 0)
  else target = 1
  return origShow.call(this).fadeTo(speed, target, callback)
}

$.fn.fadeOut = function (speed, callback) {
  return hide(this, speed, null, callback)
}

$.fn.fadeToggle = function (speed, callback) {
  return this.each(function () {
    var el = $(this)
    el[
      (el.css('opacity') == 0 || el.css('display') == 'none') ? 'fadeIn' : 'fadeOut'
      ](speed, callback)
  })
}

},{"./zepto":7}],7:[function(require,module,exports){
//     Zepto.js
//     (c) 2010-2016 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

var Zepto = (function () {
  var undefined, key, $, classList, emptyArray = [], concat = emptyArray.concat, filter = emptyArray.filter, slice = emptyArray.slice,
    document = window.document,
    elementDisplay = {}, classCache = {},
    cssNumber = {
      'column-count': 1,
      'columns': 1,
      'font-weight': 1,
      'line-height': 1,
      'opacity': 1,
      'z-index': 1,
      'zoom': 1
    },
    fragmentRE = /^\s*<(\w+|!)[^>]*>/,
    singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
    tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
    rootNodeRE = /^(?:body|html)$/i,
    capitalRE = /([A-Z])/g,

  // special attributes that should be get/set via method calls
    methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],

    adjacencyOperators = ['after', 'prepend', 'before', 'append'],
    table = document.createElement('table'),
    tableRow = document.createElement('tr'),
    containers = {
      'tr': document.createElement('tbody'),
      'tbody': table, 'thead': table, 'tfoot': table,
      'td': tableRow, 'th': tableRow,
      '*': document.createElement('div')
    },
    readyRE = /complete|loaded|interactive/,
    simpleSelectorRE = /^[\w-]*$/,
    class2type = {},
    toString = class2type.toString,
    zepto = {},
    camelize, uniq,
    tempParent = document.createElement('div'),
    propMap = {
      'tabindex': 'tabIndex',
      'readonly': 'readOnly',
      'for': 'htmlFor',
      'class': 'className',
      'maxlength': 'maxLength',
      'cellspacing': 'cellSpacing',
      'cellpadding': 'cellPadding',
      'rowspan': 'rowSpan',
      'colspan': 'colSpan',
      'usemap': 'useMap',
      'frameborder': 'frameBorder',
      'contenteditable': 'contentEditable'
    },
    isArray = Array.isArray ||
      function (object) {
        return object instanceof Array
      }

  zepto.matches = function (element, selector) {
    if (!selector || !element || element.nodeType !== 1) return false
    var matchesSelector = element.webkitMatchesSelector || element.mozMatchesSelector ||
      element.oMatchesSelector || element.matchesSelector
    if (matchesSelector) return matchesSelector.call(element, selector)
    // fall back to performing a selector:
    var match, parent = element.parentNode, temp = !parent
    if (temp) (parent = tempParent).appendChild(element)
    match = ~zepto.qsa(parent, selector).indexOf(element)
    temp && tempParent.removeChild(element)
    return match
  }

  function type(obj) {
    return obj == null ? String(obj) :
    class2type[toString.call(obj)] || "object"
  }

  function isFunction(value) {
    return type(value) == "function"
  }

  function isWindow(obj) {
    return obj != null && obj == obj.window
  }

  function isDocument(obj) {
    return obj != null && obj.nodeType == obj.DOCUMENT_NODE
  }

  function isObject(obj) {
    return type(obj) == "object"
  }

  function isPlainObject(obj) {
    return isObject(obj) && !isWindow(obj) && Object.getPrototypeOf(obj) == Object.prototype
  }

  function likeArray(obj) {
    return typeof obj.length == 'number'
  }

  function compact(array) {
    return filter.call(array, function (item) {
      return item != null
    })
  }

  function flatten(array) {
    return array.length > 0 ? $.fn.concat.apply([], array) : array
  }

  camelize = function (str) {
    return str.replace(/-+(.)?/g, function (match, chr) {
      return chr ? chr.toUpperCase() : ''
    })
  }
  function dasherize(str) {
    return str.replace(/::/g, '/')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .replace(/([a-z\d])([A-Z])/g, '$1_$2')
      .replace(/_/g, '-')
      .toLowerCase()
  }

  uniq = function (array) {
    return filter.call(array, function (item, idx) {
      return array.indexOf(item) == idx
    })
  }

  function classRE(name) {
    return name in classCache ?
      classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
  }

  function maybeAddPx(name, value) {
    return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
  }

  function defaultDisplay(nodeName) {
    var element, display
    if (!elementDisplay[nodeName]) {
      element = document.createElement(nodeName)
      document.body.appendChild(element)
      display = getComputedStyle(element, '').getPropertyValue("display")
      element.parentNode.removeChild(element)
      display == "none" && (display = "block")
      elementDisplay[nodeName] = display
    }
    return elementDisplay[nodeName]
  }

  function children(element) {
    return 'children' in element ?
      slice.call(element.children) :
      $.map(element.childNodes, function (node) {
        if (node.nodeType == 1) return node
      })
  }

  function Z(dom, selector) {
    var i, len = dom ? dom.length : 0
    for (i = 0; i < len; i++) this[i] = dom[i]
    this.length = len
    this.selector = selector || ''
  }

  // `$.zepto.fragment` takes a html string and an optional tag name
  // to generate DOM nodes from the given html string.
  // The generated DOM nodes are returned as an array.
  // This function can be overridden in plugins for example to make
  // it compatible with browsers that don't support the DOM fully.
  zepto.fragment = function (html, name, properties) {
    var dom, nodes, container

    // A special case optimization for a single tag
    if (singleTagRE.test(html)) dom = $(document.createElement(RegExp.$1))

    if (!dom) {
      if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")
      if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
      if (!(name in containers)) name = '*'

      container = containers[name]
      container.innerHTML = '' + html
      dom = $.each(slice.call(container.childNodes), function () {
        container.removeChild(this)
      })
    }

    if (isPlainObject(properties)) {
      nodes = $(dom)
      $.each(properties, function (key, value) {
        if (methodAttributes.indexOf(key) > -1) nodes[key](value)
        else nodes.attr(key, value)
      })
    }

    return dom
  }

  // `$.zepto.Z` swaps out the prototype of the given `dom` array
  // of nodes with `$.fn` and thus supplying all the Zepto functions
  // to the array. This method can be overridden in plugins.
  zepto.Z = function (dom, selector) {
    return new Z(dom, selector)
  }

  // `$.zepto.isZ` should return `true` if the given object is a Zepto
  // collection. This method can be overridden in plugins.
  zepto.isZ = function (object) {
    return object instanceof zepto.Z
  }

  // `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
  // takes a CSS selector and an optional context (and handles various
  // special cases).
  // This method can be overridden in plugins.
  zepto.init = function (selector, context) {
    var dom
    // If nothing given, return an empty Zepto collection
    if (!selector) return zepto.Z()
    // Optimize for string selectors
    else if (typeof selector == 'string') {
      selector = selector.trim()
      // If it's a html fragment, create nodes from it
      // Note: In both Chrome 21 and Firefox 15, DOM error 12
      // is thrown if the fragment doesn't begin with <
      if (selector[0] == '<' && fragmentRE.test(selector))
        dom = zepto.fragment(selector, RegExp.$1, context), selector = null
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      else if (context !== undefined) return $(context).find(selector)
      // If it's a CSS selector, use it to select nodes.
      else dom = zepto.qsa(document, selector)
    }
    // If a function is given, call it when the DOM is ready
    else if (isFunction(selector)) return $(document).ready(selector)
    // If a Zepto collection is given, just return it
    else if (zepto.isZ(selector)) return selector
    else {
      // normalize array if an array of nodes is given
      if (isArray(selector)) dom = compact(selector)
      // Wrap DOM nodes.
      else if (isObject(selector))
        dom = [selector], selector = null
      // If it's a html fragment, create nodes from it
      else if (fragmentRE.test(selector))
        dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null
      // If there's a context, create a collection on that context first, and select
      // nodes from there
      else if (context !== undefined) return $(context).find(selector)
      // And last but no least, if it's a CSS selector, use it to select nodes.
      else dom = zepto.qsa(document, selector)
    }
    // create a new Zepto collection from the nodes found
    return zepto.Z(dom, selector)
  }

  // `$` will be the base `Zepto` object. When calling this
  // function just call `$.zepto.init, which makes the implementation
  // details of selecting nodes and creating Zepto collections
  // patchable in plugins.
  $ = function (selector, context) {
    return zepto.init(selector, context)
  }

  function extend(target, source, deep) {
    for (key in source)
      if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
        if (isPlainObject(source[key]) && !isPlainObject(target[key]))
          target[key] = {}
        if (isArray(source[key]) && !isArray(target[key]))
          target[key] = []
        extend(target[key], source[key], deep)
      }
      else if (source[key] !== undefined) target[key] = source[key]
  }

  // Copy all but undefined properties from one or more
  // objects to the `target` object.
  $.extend = function (target) {
    var deep, args = slice.call(arguments, 1)
    if (typeof target == 'boolean') {
      deep = target
      target = args.shift()
    }
    args.forEach(function (arg) {
      extend(target, arg, deep)
    })
    return target
  }

  // `$.zepto.qsa` is Zepto's CSS selector implementation which
  // uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
  // This method can be overridden in plugins.
  zepto.qsa = function (element, selector) {
    var found,
      maybeID = selector[0] == '#',
      maybeClass = !maybeID && selector[0] == '.',
      nameOnly = maybeID || maybeClass ? selector.slice(1) : selector, // Ensure that a 1 char tag name still gets checked
      isSimple = simpleSelectorRE.test(nameOnly)
    return (element.getElementById && isSimple && maybeID) ? // Safari DocumentFragment doesn't have getElementById
      ( (found = element.getElementById(nameOnly)) ? [found] : [] ) :
      (element.nodeType !== 1 && element.nodeType !== 9 && element.nodeType !== 11) ? [] :
        slice.call(
          isSimple && !maybeID && element.getElementsByClassName ? // DocumentFragment doesn't have getElementsByClassName/TagName
            maybeClass ? element.getElementsByClassName(nameOnly) : // If it's simple, it could be a class
              element.getElementsByTagName(selector) : // Or a tag
            element.querySelectorAll(selector) // Or it's not simple, and we need to query all
        )
  }

  function filtered(nodes, selector) {
    return selector == null ? $(nodes) : $(nodes).filter(selector)
  }

  $.contains = document.documentElement.contains ?
    function (parent, node) {
      return parent !== node && parent.contains(node)
    } :
    function (parent, node) {
      while (node && (node = node.parentNode))
        if (node === parent) return true
      return false
    }

  function funcArg(context, arg, idx, payload) {
    return isFunction(arg) ? arg.call(context, idx, payload) : arg
  }

  function setAttribute(node, name, value) {
    value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
  }

  // access className property while respecting SVGAnimatedString
  function className(node, value) {
    var klass = node.className || '',
      svg = klass && klass.baseVal !== undefined

    if (value === undefined) return svg ? klass.baseVal : klass
    svg ? (klass.baseVal = value) : (node.className = value)
  }

  // "true"  => true
  // "false" => false
  // "null"  => null
  // "42"    => 42
  // "42.5"  => 42.5
  // "08"    => "08"
  // JSON    => parse if valid
  // String  => self
  function deserializeValue(value) {
    try {
      return value ?
      value == "true" ||
      ( value == "false" ? false :
        value == "null" ? null :
          +value + "" == value ? +value :
            /^[\[\{]/.test(value) ? $.parseJSON(value) :
              value )
        : value
    } catch (e) {
      return value
    }
  }

  $.type = type
  $.isFunction = isFunction
  $.isWindow = isWindow
  $.isArray = isArray
  $.isPlainObject = isPlainObject

  $.isEmptyObject = function (obj) {
    var name
    for (name in obj) return false
    return true
  }

  $.inArray = function (elem, array, i) {
    return emptyArray.indexOf.call(array, elem, i)
  }

  $.camelCase = camelize
  $.trim = function (str) {
    return str == null ? "" : String.prototype.trim.call(str)
  }

  // plugin compatibility
  $.uuid = 0
  $.support = {}
  $.expr = {}
  $.noop = function () {
  }

  $.map = function (elements, callback) {
    var value, values = [], i, key
    if (likeArray(elements))
      for (i = 0; i < elements.length; i++) {
        value = callback(elements[i], i)
        if (value != null) values.push(value)
      }
    else
      for (key in elements) {
        value = callback(elements[key], key)
        if (value != null) values.push(value)
      }
    return flatten(values)
  }

  $.each = function (elements, callback) {
    var i, key
    if (likeArray(elements)) {
      for (i = 0; i < elements.length; i++)
        if (callback.call(elements[i], i, elements[i]) === false) return elements
    } else {
      for (key in elements)
        if (callback.call(elements[key], key, elements[key]) === false) return elements
    }

    return elements
  }

  $.grep = function (elements, callback) {
    return filter.call(elements, callback)
  }

  if (window.JSON) $.parseJSON = JSON.parse

  // Populate the class2type map
  $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function (i, name) {
    class2type["[object " + name + "]"] = name.toLowerCase()
  })

  // Define methods that will be available on all
  // Zepto collections
  $.fn = {
    constructor: zepto.Z,
    length: 0,

    // Because a collection acts like an array
    // copy over these useful array functions.
    forEach: emptyArray.forEach,
    reduce: emptyArray.reduce,
    push: emptyArray.push,
    sort: emptyArray.sort,
    splice: emptyArray.splice,
    indexOf: emptyArray.indexOf,
    concat: function () {
      var i, value, args = []
      for (i = 0; i < arguments.length; i++) {
        value = arguments[i]
        args[i] = zepto.isZ(value) ? value.toArray() : value
      }
      return concat.apply(zepto.isZ(this) ? this.toArray() : this, args)
    },

    // `map` and `slice` in the jQuery API work differently
    // from their array counterparts
    map: function (fn) {
      return $($.map(this, function (el, i) {
        return fn.call(el, i, el)
      }))
    },
    slice: function () {
      return $(slice.apply(this, arguments))
    },

    ready: function (callback) {
      // need to check if document.body exists for IE as that browser reports
      // document ready when it hasn't yet created the body element
      if (readyRE.test(document.readyState) && document.body) callback($)
      else document.addEventListener('DOMContentLoaded', function () {
        callback($)
      }, false)
      return this
    },
    get: function (idx) {
      return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
    },
    toArray: function () {
      return this.get()
    },
    size: function () {
      return this.length
    },
    remove: function () {
      return this.each(function () {
        if (this.parentNode != null)
          this.parentNode.removeChild(this)
      })
    },
    each: function (callback) {
      emptyArray.every.call(this, function (el, idx) {
        return callback.call(el, idx, el) !== false
      })
      return this
    },
    filter: function (selector) {
      if (isFunction(selector)) return this.not(this.not(selector))
      return $(filter.call(this, function (element) {
        return zepto.matches(element, selector)
      }))
    },
    add: function (selector, context) {
      return $(uniq(this.concat($(selector, context))))
    },
    is: function (selector) {
      return this.length > 0 && zepto.matches(this[0], selector)
    },
    not: function (selector) {
      var nodes = []
      if (isFunction(selector) && selector.call !== undefined)
        this.each(function (idx) {
          if (!selector.call(this, idx)) nodes.push(this)
        })
      else {
        var excludes = typeof selector == 'string' ? this.filter(selector) :
          (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
        this.forEach(function (el) {
          if (excludes.indexOf(el) < 0) nodes.push(el)
        })
      }
      return $(nodes)
    },
    has: function (selector) {
      return this.filter(function () {
        return isObject(selector) ?
          $.contains(this, selector) :
          $(this).find(selector).size()
      })
    },
    eq: function (idx) {
      return idx === -1 ? this.slice(idx) : this.slice(idx, +idx + 1)
    },
    first: function () {
      var el = this[0]
      return el && !isObject(el) ? el : $(el)
    },
    last: function () {
      var el = this[this.length - 1]
      return el && !isObject(el) ? el : $(el)
    },
    find: function (selector) {
      var result, $this = this
      if (!selector) result = $()
      else if (typeof selector == 'object')
        result = $(selector).filter(function () {
          var node = this
          return emptyArray.some.call($this, function (parent) {
            return $.contains(parent, node)
          })
        })
      else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
      else result = this.map(function () {
          return zepto.qsa(this, selector)
        })
      return result
    },
    closest: function (selector, context) {
      var node = this[0], collection = false
      if (typeof selector == 'object') collection = $(selector)
      while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))
        node = node !== context && !isDocument(node) && node.parentNode
      return $(node)
    },
    parents: function (selector) {
      var ancestors = [], nodes = this
      while (nodes.length > 0)
        nodes = $.map(nodes, function (node) {
          if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0) {
            ancestors.push(node)
            return node
          }
        })
      return filtered(ancestors, selector)
    },
    parent: function (selector) {
      return filtered(uniq(this.pluck('parentNode')), selector)
    },
    children: function (selector) {
      return filtered(this.map(function () {
        return children(this)
      }), selector)
    },
    contents: function () {
      return this.map(function () {
        return this.contentDocument || slice.call(this.childNodes)
      })
    },
    siblings: function (selector) {
      return filtered(this.map(function (i, el) {
        return filter.call(children(el.parentNode), function (child) {
          return child !== el
        })
      }), selector)
    },
    empty: function () {
      return this.each(function () {
        this.innerHTML = ''
      })
    },
    // `pluck` is borrowed from Prototype.js
    pluck: function (property) {
      return $.map(this, function (el) {
        return el[property]
      })
    },
    show: function () {
      return this.each(function () {
        this.style.display == "none" && (this.style.display = '')
        if (getComputedStyle(this, '').getPropertyValue("display") == "none")
          this.style.display = defaultDisplay(this.nodeName)
      })
    },
    replaceWith: function (newContent) {
      return this.before(newContent).remove()
    },
    wrap: function (structure) {
      var func = isFunction(structure)
      if (this[0] && !func)
        var dom = $(structure).get(0),
          clone = dom.parentNode || this.length > 1

      return this.each(function (index) {
        $(this).wrapAll(
          func ? structure.call(this, index) :
            clone ? dom.cloneNode(true) : dom
        )
      })
    },
    wrapAll: function (structure) {
      if (this[0]) {
        $(this[0]).before(structure = $(structure))
        var children
        // drill down to the inmost element
        while ((children = structure.children()).length) structure = children.first()
        $(structure).append(this)
      }
      return this
    },
    wrapInner: function (structure) {
      var func = isFunction(structure)
      return this.each(function (index) {
        var self = $(this), contents = self.contents(),
          dom = func ? structure.call(this, index) : structure
        contents.length ? contents.wrapAll(dom) : self.append(dom)
      })
    },
    unwrap: function () {
      this.parent().each(function () {
        $(this).replaceWith($(this).children())
      })
      return this
    },
    clone: function () {
      return this.map(function () {
        return this.cloneNode(true)
      })
    },
    hide: function () {
      return this.css("display", "none")
    },
    toggle: function (setting) {
      return this.each(function () {
        var el = $(this)
          ;
        (setting === undefined ? el.css("display") == "none" : setting) ? el.show() : el.hide()
      })
    },
    prev: function (selector) {
      return $(this.pluck('previousElementSibling')).filter(selector || '*')
    },
    next: function (selector) {
      return $(this.pluck('nextElementSibling')).filter(selector || '*')
    },
    html: function (html) {
      return 0 in arguments ?
        this.each(function (idx) {
          var originHtml = this.innerHTML
          $(this).empty().append(funcArg(this, html, idx, originHtml))
        }) :
        (0 in this ? this[0].innerHTML : null)
    },
    text: function (text) {
      return 0 in arguments ?
        this.each(function (idx) {
          var newText = funcArg(this, text, idx, this.textContent)
          this.textContent = newText == null ? '' : '' + newText
        }) :
        (0 in this ? this.pluck('textContent').join("") : null)
    },
    attr: function (name, value) {
      var result
      return (typeof name == 'string' && !(1 in arguments)) ?
        (!this.length || this[0].nodeType !== 1 ? undefined :
            (!(result = this[0].getAttribute(name)) && name in this[0]) ? this[0][name] : result
        ) :
        this.each(function (idx) {
          if (this.nodeType !== 1) return
          if (isObject(name)) for (key in name) setAttribute(this, key, name[key])
          else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
        })
    },
    removeAttr: function (name) {
      return this.each(function () {
        this.nodeType === 1 && name.split(' ').forEach(function (attribute) {
          setAttribute(this, attribute)
        }, this)
      })
    },
    prop: function (name, value) {
      name = propMap[name] || name
      return (1 in arguments) ?
        this.each(function (idx) {
          this[name] = funcArg(this, value, idx, this[name])
        }) :
        (this[0] && this[0][name])
    },
    data: function (name, value) {
      var attrName = 'data-' + name.replace(capitalRE, '-$1').toLowerCase()

      var data = (1 in arguments) ?
        this.attr(attrName, value) :
        this.attr(attrName)

      return data !== null ? deserializeValue(data) : undefined
    },
    val: function (value) {
      return 0 in arguments ?
        this.each(function (idx) {
          this.value = funcArg(this, value, idx, this.value)
        }) :
        (this[0] && (this[0].multiple ?
            $(this[0]).find('option').filter(function () {
              return this.selected
            }).pluck('value') :
            this[0].value)
        )
    },
    offset: function (coordinates) {
      if (coordinates) return this.each(function (index) {
        var $this = $(this),
          coords = funcArg(this, coordinates, index, $this.offset()),
          parentOffset = $this.offsetParent().offset(),
          props = {
            top: coords.top - parentOffset.top,
            left: coords.left - parentOffset.left
          }

        if ($this.css('position') == 'static') props['position'] = 'relative'
        $this.css(props)
      })
      if (!this.length) return null
      if (!$.contains(document.documentElement, this[0]))
        return {top: 0, left: 0}
      var obj = this[0].getBoundingClientRect()
      return {
        left: obj.left + window.pageXOffset,
        top: obj.top + window.pageYOffset,
        width: Math.round(obj.width),
        height: Math.round(obj.height)
      }
    },
    css: function (property, value) {
      if (arguments.length < 2) {
        var computedStyle, element = this[0]
        if (!element) return
        computedStyle = getComputedStyle(element, '')
        if (typeof property == 'string')
          return element.style[camelize(property)] || computedStyle.getPropertyValue(property)
        else if (isArray(property)) {
          var props = {}
          $.each(property, function (_, prop) {
            props[prop] = (element.style[camelize(prop)] || computedStyle.getPropertyValue(prop))
          })
          return props
        }
      }

      var css = ''
      if (type(property) == 'string') {
        if (!value && value !== 0)
          this.each(function () {
            this.style.removeProperty(dasherize(property))
          })
        else
          css = dasherize(property) + ":" + maybeAddPx(property, value)
      } else {
        for (key in property)
          if (!property[key] && property[key] !== 0)
            this.each(function () {
              this.style.removeProperty(dasherize(key))
            })
          else
            css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
      }

      return this.each(function () {
        this.style.cssText += ';' + css
      })
    },
    index: function (element) {
      return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
    },
    hasClass: function (name) {
      if (!name) return false
      return emptyArray.some.call(this, function (el) {
        return this.test(className(el))
      }, classRE(name))
    },
    addClass: function (name) {
      if (!name) return this
      return this.each(function (idx) {
        if (!('className' in this)) return
        classList = []
        var cls = className(this), newName = funcArg(this, name, idx, cls)
        newName.split(/\s+/g).forEach(function (klass) {
          if (!$(this).hasClass(klass)) classList.push(klass)
        }, this)
        classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
      })
    },
    removeClass: function (name) {
      return this.each(function (idx) {
        if (!('className' in this)) return
        if (name === undefined) return className(this, '')
        classList = className(this)
        funcArg(this, name, idx, classList).split(/\s+/g).forEach(function (klass) {
          classList = classList.replace(classRE(klass), " ")
        })
        className(this, classList.trim())
      })
    },
    toggleClass: function (name, when) {
      if (!name) return this
      return this.each(function (idx) {
        var $this = $(this), names = funcArg(this, name, idx, className(this))
        names.split(/\s+/g).forEach(function (klass) {
          (when === undefined ? !$this.hasClass(klass) : when) ?
            $this.addClass(klass) : $this.removeClass(klass)
        })
      })
    },
    scrollTop: function (value) {
      if (!this.length) return
      var hasScrollTop = 'scrollTop' in this[0]
      if (value === undefined) return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset
      return this.each(hasScrollTop ?
        function () {
          this.scrollTop = value
        } :
        function () {
          this.scrollTo(this.scrollX, value)
        })
    },
    scrollLeft: function (value) {
      if (!this.length) return
      var hasScrollLeft = 'scrollLeft' in this[0]
      if (value === undefined) return hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset
      return this.each(hasScrollLeft ?
        function () {
          this.scrollLeft = value
        } :
        function () {
          this.scrollTo(value, this.scrollY)
        })
    },
    position: function () {
      if (!this.length) return

      var elem = this[0],
      // Get *real* offsetParent
        offsetParent = this.offsetParent(),
      // Get correct offsets
        offset = this.offset(),
        parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? {top: 0, left: 0} : offsetParent.offset()

      // Subtract element margins
      // note: when an element has margin: auto the offsetLeft and marginLeft
      // are the same in Safari causing offset.left to incorrectly be 0
      offset.top -= parseFloat($(elem).css('margin-top')) || 0
      offset.left -= parseFloat($(elem).css('margin-left')) || 0

      // Add offsetParent borders
      parentOffset.top += parseFloat($(offsetParent[0]).css('border-top-width')) || 0
      parentOffset.left += parseFloat($(offsetParent[0]).css('border-left-width')) || 0

      // Subtract the two offsets
      return {
        top: offset.top - parentOffset.top,
        left: offset.left - parentOffset.left
      }
    },
    offsetParent: function () {
      return this.map(function () {
        var parent = this.offsetParent || document.body
        while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")
          parent = parent.offsetParent
        return parent
      })
    }
  }

  // for now
  $.fn.detach = $.fn.remove

    // Generate the `width` and `height` functions
  ;
  ['width', 'height'].forEach(function (dimension) {
    var dimensionProperty =
      dimension.replace(/./, function (m) {
        return m[0].toUpperCase()
      })

    $.fn[dimension] = function (value) {
      var offset, el = this[0]
      if (value === undefined) return isWindow(el) ? el['inner' + dimensionProperty] :
        isDocument(el) ? el.documentElement['scroll' + dimensionProperty] :
        (offset = this.offset()) && offset[dimension]
      else return this.each(function (idx) {
        el = $(this)
        el.css(dimension, funcArg(this, value, idx, el[dimension]()))
      })
    }
  })

  function traverseNode(node, fun) {
    fun(node)
    for (var i = 0, len = node.childNodes.length; i < len; i++)
      traverseNode(node.childNodes[i], fun)
  }

  // Generate the `after`, `prepend`, `before`, `append`,
  // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
  adjacencyOperators.forEach(function (operator, operatorIndex) {
    var inside = operatorIndex % 2 //=> prepend, append

    $.fn[operator] = function () {
      // arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
      var argType, nodes = $.map(arguments, function (arg) {
          argType = type(arg)
          return argType == "object" || argType == "array" || arg == null ?
            arg : zepto.fragment(arg)
        }),
        parent, copyByClone = this.length > 1
      if (nodes.length < 1) return this

      return this.each(function (_, target) {
        parent = inside ? target : target.parentNode

        // convert all methods to a "before" operation
        target = operatorIndex == 0 ? target.nextSibling :
          operatorIndex == 1 ? target.firstChild :
            operatorIndex == 2 ? target :
              null

        var parentInDocument = $.contains(document.documentElement, parent)

        nodes.forEach(function (node) {
          if (copyByClone) node = node.cloneNode(true)
          else if (!parent) return $(node).remove()

          parent.insertBefore(node, target)
          if (parentInDocument) traverseNode(node, function (el) {
            if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' &&
              (!el.type || el.type === 'text/javascript') && !el.src)
              window['eval'].call(window, el.innerHTML)
          })
        })
      })
    }

    // after    => insertAfter
    // prepend  => prependTo
    // before   => insertBefore
    // append   => appendTo
    $.fn[inside ? operator + 'To' : 'insert' + (operatorIndex ? 'Before' : 'After')] = function (html) {
      $(html)[operator](this)
      return this
    }
  })

  zepto.Z.prototype = Z.prototype = $.fn

  // Export internal API functions in the `$.zepto` namespace
  zepto.uniq = uniq
  zepto.deserializeValue = deserializeValue
  $.zepto = zepto

  return $
})()

module.exports = Zepto;

},{}],8:[function(require,module,exports){
'use strict';

/**
 * Common.js for neymar jr experience (common) Zepto.js plugin v1.1.6
 * V: [0.1 (fourwheels)]
 * http://tests.guiatech.com.br/fourwheels/site/
 * Copyright 2016, Knowledge
 * Author: Joao Guilherme C. Prado
 * Dep. of Library: Zepto.js v1.1.6 w/ ES6
 *
 * Usually used for scripts in four wheels wordpress website (homepage-only [today])
 *
 * Date: Mon Mar 14 2016 21:27:19 GMT-0300
 */

var njr = njr || {};
var $ = require('./lib/zepto_custom');

$(function () {
  console.log('test');
});

},{"./lib/zepto_custom":9}],9:[function(require,module,exports){
'use strict';

var $ = require('zepto-modules/zepto');

require('zepto-modules/event');
require('zepto-modules/form');
require('zepto-modules/ajax');
require('zepto-modules/fx');
require('zepto-modules/fx_methods');
require('zepto-modules/detect');

module.exports = $;

},{"zepto-modules/ajax":1,"zepto-modules/detect":2,"zepto-modules/event":3,"zepto-modules/form":4,"zepto-modules/fx":5,"zepto-modules/fx_methods":6,"zepto-modules/zepto":7}]},{},[8])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvemVwdG8tbW9kdWxlcy9hamF4LmpzIiwibm9kZV9tb2R1bGVzL3plcHRvLW1vZHVsZXMvZGV0ZWN0LmpzIiwibm9kZV9tb2R1bGVzL3plcHRvLW1vZHVsZXMvZXZlbnQuanMiLCJub2RlX21vZHVsZXMvemVwdG8tbW9kdWxlcy9mb3JtLmpzIiwibm9kZV9tb2R1bGVzL3plcHRvLW1vZHVsZXMvZnguanMiLCJub2RlX21vZHVsZXMvemVwdG8tbW9kdWxlcy9meF9tZXRob2RzLmpzIiwibm9kZV9tb2R1bGVzL3plcHRvLW1vZHVsZXMvemVwdG8uanMiLCJzaXRlL3dwLWNvbnRlbnQvdGhlbWVzL2ZvdXJ3aGVlbHMvc3RhdGljL2pzLzAuMS9hc3NldHMvY29tbW9uL2NvbW1vbi5qcyIsInNpdGUvd3AtY29udGVudC90aGVtZXMvZm91cndoZWVscy9zdGF0aWMvanMvMC4xL2Fzc2V0cy9jb21tb24vbGliL3plcHRvX2N1c3RvbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6UkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7O0FDdjlCQSxJQUFNLE1BQU0sT0FBTyxFQUFQO0FBQ1osSUFBTSxJQUFJLFFBQVEsb0JBQVIsQ0FBSjs7QUFFTixFQUFFLFlBQVU7QUFDVixVQUFRLEdBQVIsQ0FBWSxNQUFaLEVBRFU7Q0FBVixDQUFGOzs7OztBQ2hCQSxJQUFJLElBQUksUUFBUSxxQkFBUixDQUFKOztBQUVKLFFBQVEscUJBQVI7QUFDQSxRQUFRLG9CQUFSO0FBQ0EsUUFBUSxvQkFBUjtBQUNBLFFBQVEsa0JBQVI7QUFDQSxRQUFRLDBCQUFSO0FBQ0EsUUFBUSxzQkFBUjs7QUFFQSxPQUFPLE9BQVAsR0FBaUIsQ0FBakIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gICAgIFplcHRvLmpzXG4vLyAgICAgKGMpIDIwMTAtMjAxNiBUaG9tYXMgRnVjaHNcbi8vICAgICBaZXB0by5qcyBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cblxudmFyICQgPSByZXF1aXJlKCcuL3plcHRvJyk7XG5cbnZhciBqc29ucElEID0gMCxcbiAgZG9jdW1lbnQgPSB3aW5kb3cuZG9jdW1lbnQsXG4gIGtleSxcbiAgbmFtZSxcbiAgcnNjcmlwdCA9IC88c2NyaXB0XFxiW148XSooPzooPyE8XFwvc2NyaXB0Pik8W148XSopKjxcXC9zY3JpcHQ+L2dpLFxuICBzY3JpcHRUeXBlUkUgPSAvXig/OnRleHR8YXBwbGljYXRpb24pXFwvamF2YXNjcmlwdC9pLFxuICB4bWxUeXBlUkUgPSAvXig/OnRleHR8YXBwbGljYXRpb24pXFwveG1sL2ksXG4gIGpzb25UeXBlID0gJ2FwcGxpY2F0aW9uL2pzb24nLFxuICBodG1sVHlwZSA9ICd0ZXh0L2h0bWwnLFxuICBibGFua1JFID0gL15cXHMqJC8sXG4gIG9yaWdpbkFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKVxuXG5vcmlnaW5BbmNob3IuaHJlZiA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmXG5cbi8vIHRyaWdnZXIgYSBjdXN0b20gZXZlbnQgYW5kIHJldHVybiBmYWxzZSBpZiBpdCB3YXMgY2FuY2VsbGVkXG5mdW5jdGlvbiB0cmlnZ2VyQW5kUmV0dXJuKGNvbnRleHQsIGV2ZW50TmFtZSwgZGF0YSkge1xuICB2YXIgZXZlbnQgPSAkLkV2ZW50KGV2ZW50TmFtZSlcbiAgJChjb250ZXh0KS50cmlnZ2VyKGV2ZW50LCBkYXRhKVxuICByZXR1cm4gIWV2ZW50LmlzRGVmYXVsdFByZXZlbnRlZCgpXG59XG5cbi8vIHRyaWdnZXIgYW4gQWpheCBcImdsb2JhbFwiIGV2ZW50XG5mdW5jdGlvbiB0cmlnZ2VyR2xvYmFsKHNldHRpbmdzLCBjb250ZXh0LCBldmVudE5hbWUsIGRhdGEpIHtcbiAgaWYgKHNldHRpbmdzLmdsb2JhbCkgcmV0dXJuIHRyaWdnZXJBbmRSZXR1cm4oY29udGV4dCB8fCBkb2N1bWVudCwgZXZlbnROYW1lLCBkYXRhKVxufVxuXG4vLyBOdW1iZXIgb2YgYWN0aXZlIEFqYXggcmVxdWVzdHNcbiQuYWN0aXZlID0gMFxuXG5mdW5jdGlvbiBhamF4U3RhcnQoc2V0dGluZ3MpIHtcbiAgaWYgKHNldHRpbmdzLmdsb2JhbCAmJiAkLmFjdGl2ZSsrID09PSAwKSB0cmlnZ2VyR2xvYmFsKHNldHRpbmdzLCBudWxsLCAnYWpheFN0YXJ0Jylcbn1cbmZ1bmN0aW9uIGFqYXhTdG9wKHNldHRpbmdzKSB7XG4gIGlmIChzZXR0aW5ncy5nbG9iYWwgJiYgISgtLSQuYWN0aXZlKSkgdHJpZ2dlckdsb2JhbChzZXR0aW5ncywgbnVsbCwgJ2FqYXhTdG9wJylcbn1cblxuLy8gdHJpZ2dlcnMgYW4gZXh0cmEgZ2xvYmFsIGV2ZW50IFwiYWpheEJlZm9yZVNlbmRcIiB0aGF0J3MgbGlrZSBcImFqYXhTZW5kXCIgYnV0IGNhbmNlbGFibGVcbmZ1bmN0aW9uIGFqYXhCZWZvcmVTZW5kKHhociwgc2V0dGluZ3MpIHtcbiAgdmFyIGNvbnRleHQgPSBzZXR0aW5ncy5jb250ZXh0XG4gIGlmIChzZXR0aW5ncy5iZWZvcmVTZW5kLmNhbGwoY29udGV4dCwgeGhyLCBzZXR0aW5ncykgPT09IGZhbHNlIHx8XG4gICAgdHJpZ2dlckdsb2JhbChzZXR0aW5ncywgY29udGV4dCwgJ2FqYXhCZWZvcmVTZW5kJywgW3hociwgc2V0dGluZ3NdKSA9PT0gZmFsc2UpXG4gICAgcmV0dXJuIGZhbHNlXG5cbiAgdHJpZ2dlckdsb2JhbChzZXR0aW5ncywgY29udGV4dCwgJ2FqYXhTZW5kJywgW3hociwgc2V0dGluZ3NdKVxufVxuZnVuY3Rpb24gYWpheFN1Y2Nlc3MoZGF0YSwgeGhyLCBzZXR0aW5ncywgZGVmZXJyZWQpIHtcbiAgdmFyIGNvbnRleHQgPSBzZXR0aW5ncy5jb250ZXh0LCBzdGF0dXMgPSAnc3VjY2VzcydcbiAgc2V0dGluZ3Muc3VjY2Vzcy5jYWxsKGNvbnRleHQsIGRhdGEsIHN0YXR1cywgeGhyKVxuICBpZiAoZGVmZXJyZWQpIGRlZmVycmVkLnJlc29sdmVXaXRoKGNvbnRleHQsIFtkYXRhLCBzdGF0dXMsIHhocl0pXG4gIHRyaWdnZXJHbG9iYWwoc2V0dGluZ3MsIGNvbnRleHQsICdhamF4U3VjY2VzcycsIFt4aHIsIHNldHRpbmdzLCBkYXRhXSlcbiAgYWpheENvbXBsZXRlKHN0YXR1cywgeGhyLCBzZXR0aW5ncylcbn1cbi8vIHR5cGU6IFwidGltZW91dFwiLCBcImVycm9yXCIsIFwiYWJvcnRcIiwgXCJwYXJzZXJlcnJvclwiXG5mdW5jdGlvbiBhamF4RXJyb3IoZXJyb3IsIHR5cGUsIHhociwgc2V0dGluZ3MsIGRlZmVycmVkKSB7XG4gIHZhciBjb250ZXh0ID0gc2V0dGluZ3MuY29udGV4dFxuICBzZXR0aW5ncy5lcnJvci5jYWxsKGNvbnRleHQsIHhociwgdHlwZSwgZXJyb3IpXG4gIGlmIChkZWZlcnJlZCkgZGVmZXJyZWQucmVqZWN0V2l0aChjb250ZXh0LCBbeGhyLCB0eXBlLCBlcnJvcl0pXG4gIHRyaWdnZXJHbG9iYWwoc2V0dGluZ3MsIGNvbnRleHQsICdhamF4RXJyb3InLCBbeGhyLCBzZXR0aW5ncywgZXJyb3IgfHwgdHlwZV0pXG4gIGFqYXhDb21wbGV0ZSh0eXBlLCB4aHIsIHNldHRpbmdzKVxufVxuLy8gc3RhdHVzOiBcInN1Y2Nlc3NcIiwgXCJub3Rtb2RpZmllZFwiLCBcImVycm9yXCIsIFwidGltZW91dFwiLCBcImFib3J0XCIsIFwicGFyc2VyZXJyb3JcIlxuZnVuY3Rpb24gYWpheENvbXBsZXRlKHN0YXR1cywgeGhyLCBzZXR0aW5ncykge1xuICB2YXIgY29udGV4dCA9IHNldHRpbmdzLmNvbnRleHRcbiAgc2V0dGluZ3MuY29tcGxldGUuY2FsbChjb250ZXh0LCB4aHIsIHN0YXR1cylcbiAgdHJpZ2dlckdsb2JhbChzZXR0aW5ncywgY29udGV4dCwgJ2FqYXhDb21wbGV0ZScsIFt4aHIsIHNldHRpbmdzXSlcbiAgYWpheFN0b3Aoc2V0dGluZ3MpXG59XG5cbi8vIEVtcHR5IGZ1bmN0aW9uLCB1c2VkIGFzIGRlZmF1bHQgY2FsbGJhY2tcbmZ1bmN0aW9uIGVtcHR5KCkge1xufVxuXG4kLmFqYXhKU09OUCA9IGZ1bmN0aW9uIChvcHRpb25zLCBkZWZlcnJlZCkge1xuICBpZiAoISgndHlwZScgaW4gb3B0aW9ucykpIHJldHVybiAkLmFqYXgob3B0aW9ucylcblxuICB2YXIgX2NhbGxiYWNrTmFtZSA9IG9wdGlvbnMuanNvbnBDYWxsYmFjayxcbiAgICBjYWxsYmFja05hbWUgPSAoJC5pc0Z1bmN0aW9uKF9jYWxsYmFja05hbWUpID9cbiAgICAgICAgX2NhbGxiYWNrTmFtZSgpIDogX2NhbGxiYWNrTmFtZSkgfHwgKCdqc29ucCcgKyAoKytqc29ucElEKSksXG4gICAgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0JyksXG4gICAgb3JpZ2luYWxDYWxsYmFjayA9IHdpbmRvd1tjYWxsYmFja05hbWVdLFxuICAgIHJlc3BvbnNlRGF0YSxcbiAgICBhYm9ydCA9IGZ1bmN0aW9uIChlcnJvclR5cGUpIHtcbiAgICAgICQoc2NyaXB0KS50cmlnZ2VySGFuZGxlcignZXJyb3InLCBlcnJvclR5cGUgfHwgJ2Fib3J0JylcbiAgICB9LFxuICAgIHhociA9IHthYm9ydDogYWJvcnR9LCBhYm9ydFRpbWVvdXRcblxuICBpZiAoZGVmZXJyZWQpIGRlZmVycmVkLnByb21pc2UoeGhyKVxuXG4gICQoc2NyaXB0KS5vbignbG9hZCBlcnJvcicsIGZ1bmN0aW9uIChlLCBlcnJvclR5cGUpIHtcbiAgICBjbGVhclRpbWVvdXQoYWJvcnRUaW1lb3V0KVxuICAgICQoc2NyaXB0KS5vZmYoKS5yZW1vdmUoKVxuXG4gICAgaWYgKGUudHlwZSA9PSAnZXJyb3InIHx8ICFyZXNwb25zZURhdGEpIHtcbiAgICAgIGFqYXhFcnJvcihudWxsLCBlcnJvclR5cGUgfHwgJ2Vycm9yJywgeGhyLCBvcHRpb25zLCBkZWZlcnJlZClcbiAgICB9IGVsc2Uge1xuICAgICAgYWpheFN1Y2Nlc3MocmVzcG9uc2VEYXRhWzBdLCB4aHIsIG9wdGlvbnMsIGRlZmVycmVkKVxuICAgIH1cblxuICAgIHdpbmRvd1tjYWxsYmFja05hbWVdID0gb3JpZ2luYWxDYWxsYmFja1xuICAgIGlmIChyZXNwb25zZURhdGEgJiYgJC5pc0Z1bmN0aW9uKG9yaWdpbmFsQ2FsbGJhY2spKVxuICAgICAgb3JpZ2luYWxDYWxsYmFjayhyZXNwb25zZURhdGFbMF0pXG5cbiAgICBvcmlnaW5hbENhbGxiYWNrID0gcmVzcG9uc2VEYXRhID0gdW5kZWZpbmVkXG4gIH0pXG5cbiAgaWYgKGFqYXhCZWZvcmVTZW5kKHhociwgb3B0aW9ucykgPT09IGZhbHNlKSB7XG4gICAgYWJvcnQoJ2Fib3J0JylcbiAgICByZXR1cm4geGhyXG4gIH1cblxuICB3aW5kb3dbY2FsbGJhY2tOYW1lXSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXNwb25zZURhdGEgPSBhcmd1bWVudHNcbiAgfVxuXG4gIHNjcmlwdC5zcmMgPSBvcHRpb25zLnVybC5yZXBsYWNlKC9cXD8oLispPVxcPy8sICc/JDE9JyArIGNhbGxiYWNrTmFtZSlcbiAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpXG5cbiAgaWYgKG9wdGlvbnMudGltZW91dCA+IDApIGFib3J0VGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgIGFib3J0KCd0aW1lb3V0JylcbiAgfSwgb3B0aW9ucy50aW1lb3V0KVxuXG4gIHJldHVybiB4aHJcbn1cblxuJC5hamF4U2V0dGluZ3MgPSB7XG4gIC8vIERlZmF1bHQgdHlwZSBvZiByZXF1ZXN0XG4gIHR5cGU6ICdHRVQnLFxuICAvLyBDYWxsYmFjayB0aGF0IGlzIGV4ZWN1dGVkIGJlZm9yZSByZXF1ZXN0XG4gIGJlZm9yZVNlbmQ6IGVtcHR5LFxuICAvLyBDYWxsYmFjayB0aGF0IGlzIGV4ZWN1dGVkIGlmIHRoZSByZXF1ZXN0IHN1Y2NlZWRzXG4gIHN1Y2Nlc3M6IGVtcHR5LFxuICAvLyBDYWxsYmFjayB0aGF0IGlzIGV4ZWN1dGVkIHRoZSB0aGUgc2VydmVyIGRyb3BzIGVycm9yXG4gIGVycm9yOiBlbXB0eSxcbiAgLy8gQ2FsbGJhY2sgdGhhdCBpcyBleGVjdXRlZCBvbiByZXF1ZXN0IGNvbXBsZXRlIChib3RoOiBlcnJvciBhbmQgc3VjY2VzcylcbiAgY29tcGxldGU6IGVtcHR5LFxuICAvLyBUaGUgY29udGV4dCBmb3IgdGhlIGNhbGxiYWNrc1xuICBjb250ZXh0OiBudWxsLFxuICAvLyBXaGV0aGVyIHRvIHRyaWdnZXIgXCJnbG9iYWxcIiBBamF4IGV2ZW50c1xuICBnbG9iYWw6IHRydWUsXG4gIC8vIFRyYW5zcG9ydFxuICB4aHI6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gbmV3IHdpbmRvdy5YTUxIdHRwUmVxdWVzdCgpXG4gIH0sXG4gIC8vIE1JTUUgdHlwZXMgbWFwcGluZ1xuICAvLyBJSVMgcmV0dXJucyBKYXZhc2NyaXB0IGFzIFwiYXBwbGljYXRpb24veC1qYXZhc2NyaXB0XCJcbiAgYWNjZXB0czoge1xuICAgIHNjcmlwdDogJ3RleHQvamF2YXNjcmlwdCwgYXBwbGljYXRpb24vamF2YXNjcmlwdCwgYXBwbGljYXRpb24veC1qYXZhc2NyaXB0JyxcbiAgICBqc29uOiBqc29uVHlwZSxcbiAgICB4bWw6ICdhcHBsaWNhdGlvbi94bWwsIHRleHQveG1sJyxcbiAgICBodG1sOiBodG1sVHlwZSxcbiAgICB0ZXh0OiAndGV4dC9wbGFpbidcbiAgfSxcbiAgLy8gV2hldGhlciB0aGUgcmVxdWVzdCBpcyB0byBhbm90aGVyIGRvbWFpblxuICBjcm9zc0RvbWFpbjogZmFsc2UsXG4gIC8vIERlZmF1bHQgdGltZW91dFxuICB0aW1lb3V0OiAwLFxuICAvLyBXaGV0aGVyIGRhdGEgc2hvdWxkIGJlIHNlcmlhbGl6ZWQgdG8gc3RyaW5nXG4gIHByb2Nlc3NEYXRhOiB0cnVlLFxuICAvLyBXaGV0aGVyIHRoZSBicm93c2VyIHNob3VsZCBiZSBhbGxvd2VkIHRvIGNhY2hlIEdFVCByZXNwb25zZXNcbiAgY2FjaGU6IHRydWVcbn1cblxuZnVuY3Rpb24gbWltZVRvRGF0YVR5cGUobWltZSkge1xuICBpZiAobWltZSkgbWltZSA9IG1pbWUuc3BsaXQoJzsnLCAyKVswXVxuICByZXR1cm4gbWltZSAmJiAoIG1pbWUgPT0gaHRtbFR5cGUgPyAnaHRtbCcgOlxuICAgICAgbWltZSA9PSBqc29uVHlwZSA/ICdqc29uJyA6XG4gICAgICAgIHNjcmlwdFR5cGVSRS50ZXN0KG1pbWUpID8gJ3NjcmlwdCcgOlxuICAgICAgICB4bWxUeXBlUkUudGVzdChtaW1lKSAmJiAneG1sJyApIHx8ICd0ZXh0J1xufVxuXG5mdW5jdGlvbiBhcHBlbmRRdWVyeSh1cmwsIHF1ZXJ5KSB7XG4gIGlmIChxdWVyeSA9PSAnJykgcmV0dXJuIHVybFxuICByZXR1cm4gKHVybCArICcmJyArIHF1ZXJ5KS5yZXBsYWNlKC9bJj9dezEsMn0vLCAnPycpXG59XG5cbi8vIHNlcmlhbGl6ZSBwYXlsb2FkIGFuZCBhcHBlbmQgaXQgdG8gdGhlIFVSTCBmb3IgR0VUIHJlcXVlc3RzXG5mdW5jdGlvbiBzZXJpYWxpemVEYXRhKG9wdGlvbnMpIHtcbiAgaWYgKG9wdGlvbnMucHJvY2Vzc0RhdGEgJiYgb3B0aW9ucy5kYXRhICYmICQudHlwZShvcHRpb25zLmRhdGEpICE9IFwic3RyaW5nXCIpXG4gICAgb3B0aW9ucy5kYXRhID0gJC5wYXJhbShvcHRpb25zLmRhdGEsIG9wdGlvbnMudHJhZGl0aW9uYWwpXG4gIGlmIChvcHRpb25zLmRhdGEgJiYgKCFvcHRpb25zLnR5cGUgfHwgb3B0aW9ucy50eXBlLnRvVXBwZXJDYXNlKCkgPT0gJ0dFVCcpKVxuICAgIG9wdGlvbnMudXJsID0gYXBwZW5kUXVlcnkob3B0aW9ucy51cmwsIG9wdGlvbnMuZGF0YSksIG9wdGlvbnMuZGF0YSA9IHVuZGVmaW5lZFxufVxuXG4kLmFqYXggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICB2YXIgc2V0dGluZ3MgPSAkLmV4dGVuZCh7fSwgb3B0aW9ucyB8fCB7fSksXG4gICAgZGVmZXJyZWQgPSAkLkRlZmVycmVkICYmICQuRGVmZXJyZWQoKSxcbiAgICB1cmxBbmNob3IsIGhhc2hJbmRleFxuICBmb3IgKGtleSBpbiAkLmFqYXhTZXR0aW5ncykgaWYgKHNldHRpbmdzW2tleV0gPT09IHVuZGVmaW5lZCkgc2V0dGluZ3Nba2V5XSA9ICQuYWpheFNldHRpbmdzW2tleV1cblxuICBhamF4U3RhcnQoc2V0dGluZ3MpXG5cbiAgaWYgKCFzZXR0aW5ncy5jcm9zc0RvbWFpbikge1xuICAgIHVybEFuY2hvciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKVxuICAgIHVybEFuY2hvci5ocmVmID0gc2V0dGluZ3MudXJsXG4gICAgLy8gY2xlYW5zIHVwIFVSTCBmb3IgLmhyZWYgKElFIG9ubHkpLCBzZWUgaHR0cHM6Ly9naXRodWIuY29tL21hZHJvYmJ5L3plcHRvL3B1bGwvMTA0OVxuICAgIHVybEFuY2hvci5ocmVmID0gdXJsQW5jaG9yLmhyZWZcbiAgICBzZXR0aW5ncy5jcm9zc0RvbWFpbiA9IChvcmlnaW5BbmNob3IucHJvdG9jb2wgKyAnLy8nICsgb3JpZ2luQW5jaG9yLmhvc3QpICE9PSAodXJsQW5jaG9yLnByb3RvY29sICsgJy8vJyArIHVybEFuY2hvci5ob3N0KVxuICB9XG5cbiAgaWYgKCFzZXR0aW5ncy51cmwpIHNldHRpbmdzLnVybCA9IHdpbmRvdy5sb2NhdGlvbi50b1N0cmluZygpXG4gIGlmICgoaGFzaEluZGV4ID0gc2V0dGluZ3MudXJsLmluZGV4T2YoJyMnKSkgPiAtMSkgc2V0dGluZ3MudXJsID0gc2V0dGluZ3MudXJsLnNsaWNlKDAsIGhhc2hJbmRleClcbiAgc2VyaWFsaXplRGF0YShzZXR0aW5ncylcblxuICB2YXIgZGF0YVR5cGUgPSBzZXR0aW5ncy5kYXRhVHlwZSwgaGFzUGxhY2Vob2xkZXIgPSAvXFw/Lis9XFw/Ly50ZXN0KHNldHRpbmdzLnVybClcbiAgaWYgKGhhc1BsYWNlaG9sZGVyKSBkYXRhVHlwZSA9ICdqc29ucCdcblxuICBpZiAoc2V0dGluZ3MuY2FjaGUgPT09IGZhbHNlIHx8IChcbiAgICAgICghb3B0aW9ucyB8fCBvcHRpb25zLmNhY2hlICE9PSB0cnVlKSAmJlxuICAgICAgKCdzY3JpcHQnID09IGRhdGFUeXBlIHx8ICdqc29ucCcgPT0gZGF0YVR5cGUpXG4gICAgKSlcbiAgICBzZXR0aW5ncy51cmwgPSBhcHBlbmRRdWVyeShzZXR0aW5ncy51cmwsICdfPScgKyBEYXRlLm5vdygpKVxuXG4gIGlmICgnanNvbnAnID09IGRhdGFUeXBlKSB7XG4gICAgaWYgKCFoYXNQbGFjZWhvbGRlcilcbiAgICAgIHNldHRpbmdzLnVybCA9IGFwcGVuZFF1ZXJ5KHNldHRpbmdzLnVybCxcbiAgICAgICAgc2V0dGluZ3MuanNvbnAgPyAoc2V0dGluZ3MuanNvbnAgKyAnPT8nKSA6IHNldHRpbmdzLmpzb25wID09PSBmYWxzZSA/ICcnIDogJ2NhbGxiYWNrPT8nKVxuICAgIHJldHVybiAkLmFqYXhKU09OUChzZXR0aW5ncywgZGVmZXJyZWQpXG4gIH1cblxuICB2YXIgbWltZSA9IHNldHRpbmdzLmFjY2VwdHNbZGF0YVR5cGVdLFxuICAgIGhlYWRlcnMgPSB7fSxcbiAgICBzZXRIZWFkZXIgPSBmdW5jdGlvbiAobmFtZSwgdmFsdWUpIHtcbiAgICAgIGhlYWRlcnNbbmFtZS50b0xvd2VyQ2FzZSgpXSA9IFtuYW1lLCB2YWx1ZV1cbiAgICB9LFxuICAgIHByb3RvY29sID0gL14oW1xcdy1dKzopXFwvXFwvLy50ZXN0KHNldHRpbmdzLnVybCkgPyBSZWdFeHAuJDEgOiB3aW5kb3cubG9jYXRpb24ucHJvdG9jb2wsXG4gICAgeGhyID0gc2V0dGluZ3MueGhyKCksXG4gICAgbmF0aXZlU2V0SGVhZGVyID0geGhyLnNldFJlcXVlc3RIZWFkZXIsXG4gICAgYWJvcnRUaW1lb3V0XG5cbiAgaWYgKGRlZmVycmVkKSBkZWZlcnJlZC5wcm9taXNlKHhocilcblxuICBpZiAoIXNldHRpbmdzLmNyb3NzRG9tYWluKSBzZXRIZWFkZXIoJ1gtUmVxdWVzdGVkLVdpdGgnLCAnWE1MSHR0cFJlcXVlc3QnKVxuICBzZXRIZWFkZXIoJ0FjY2VwdCcsIG1pbWUgfHwgJyovKicpXG4gIGlmIChtaW1lID0gc2V0dGluZ3MubWltZVR5cGUgfHwgbWltZSkge1xuICAgIGlmIChtaW1lLmluZGV4T2YoJywnKSA+IC0xKSBtaW1lID0gbWltZS5zcGxpdCgnLCcsIDIpWzBdXG4gICAgeGhyLm92ZXJyaWRlTWltZVR5cGUgJiYgeGhyLm92ZXJyaWRlTWltZVR5cGUobWltZSlcbiAgfVxuICBpZiAoc2V0dGluZ3MuY29udGVudFR5cGUgfHwgKHNldHRpbmdzLmNvbnRlbnRUeXBlICE9PSBmYWxzZSAmJiBzZXR0aW5ncy5kYXRhICYmIHNldHRpbmdzLnR5cGUudG9VcHBlckNhc2UoKSAhPSAnR0VUJykpXG4gICAgc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCBzZXR0aW5ncy5jb250ZW50VHlwZSB8fCAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJylcblxuICBpZiAoc2V0dGluZ3MuaGVhZGVycykgZm9yIChuYW1lIGluIHNldHRpbmdzLmhlYWRlcnMpIHNldEhlYWRlcihuYW1lLCBzZXR0aW5ncy5oZWFkZXJzW25hbWVdKVxuICB4aHIuc2V0UmVxdWVzdEhlYWRlciA9IHNldEhlYWRlclxuXG4gIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHhoci5yZWFkeVN0YXRlID09IDQpIHtcbiAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBlbXB0eVxuICAgICAgY2xlYXJUaW1lb3V0KGFib3J0VGltZW91dClcbiAgICAgIHZhciByZXN1bHQsIGVycm9yID0gZmFsc2VcbiAgICAgIGlmICgoeGhyLnN0YXR1cyA+PSAyMDAgJiYgeGhyLnN0YXR1cyA8IDMwMCkgfHwgeGhyLnN0YXR1cyA9PSAzMDQgfHwgKHhoci5zdGF0dXMgPT0gMCAmJiBwcm90b2NvbCA9PSAnZmlsZTonKSkge1xuICAgICAgICBkYXRhVHlwZSA9IGRhdGFUeXBlIHx8IG1pbWVUb0RhdGFUeXBlKHNldHRpbmdzLm1pbWVUeXBlIHx8IHhoci5nZXRSZXNwb25zZUhlYWRlcignY29udGVudC10eXBlJykpXG5cbiAgICAgICAgaWYgKHhoci5yZXNwb25zZVR5cGUgPT0gJ2FycmF5YnVmZmVyJyB8fCB4aHIucmVzcG9uc2VUeXBlID09ICdibG9iJylcbiAgICAgICAgICByZXN1bHQgPSB4aHIucmVzcG9uc2VcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgcmVzdWx0ID0geGhyLnJlc3BvbnNlVGV4dFxuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIGh0dHA6Ly9wZXJmZWN0aW9ua2lsbHMuY29tL2dsb2JhbC1ldmFsLXdoYXQtYXJlLXRoZS1vcHRpb25zL1xuICAgICAgICAgICAgaWYgKGRhdGFUeXBlID09ICdzY3JpcHQnKSAgICAoMSwgZXZhbCkocmVzdWx0KVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF0YVR5cGUgPT0gJ3htbCcpICByZXN1bHQgPSB4aHIucmVzcG9uc2VYTUxcbiAgICAgICAgICAgIGVsc2UgaWYgKGRhdGFUeXBlID09ICdqc29uJykgcmVzdWx0ID0gYmxhbmtSRS50ZXN0KHJlc3VsdCkgPyBudWxsIDogJC5wYXJzZUpTT04ocmVzdWx0KVxuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGVycm9yID0gZVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChlcnJvcikgcmV0dXJuIGFqYXhFcnJvcihlcnJvciwgJ3BhcnNlcmVycm9yJywgeGhyLCBzZXR0aW5ncywgZGVmZXJyZWQpXG4gICAgICAgIH1cblxuICAgICAgICBhamF4U3VjY2VzcyhyZXN1bHQsIHhociwgc2V0dGluZ3MsIGRlZmVycmVkKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWpheEVycm9yKHhoci5zdGF0dXNUZXh0IHx8IG51bGwsIHhoci5zdGF0dXMgPyAnZXJyb3InIDogJ2Fib3J0JywgeGhyLCBzZXR0aW5ncywgZGVmZXJyZWQpXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGFqYXhCZWZvcmVTZW5kKHhociwgc2V0dGluZ3MpID09PSBmYWxzZSkge1xuICAgIHhoci5hYm9ydCgpXG4gICAgYWpheEVycm9yKG51bGwsICdhYm9ydCcsIHhociwgc2V0dGluZ3MsIGRlZmVycmVkKVxuICAgIHJldHVybiB4aHJcbiAgfVxuXG4gIGlmIChzZXR0aW5ncy54aHJGaWVsZHMpIGZvciAobmFtZSBpbiBzZXR0aW5ncy54aHJGaWVsZHMpIHhocltuYW1lXSA9IHNldHRpbmdzLnhockZpZWxkc1tuYW1lXVxuXG4gIHZhciBhc3luYyA9ICdhc3luYycgaW4gc2V0dGluZ3MgPyBzZXR0aW5ncy5hc3luYyA6IHRydWVcbiAgeGhyLm9wZW4oc2V0dGluZ3MudHlwZSwgc2V0dGluZ3MudXJsLCBhc3luYywgc2V0dGluZ3MudXNlcm5hbWUsIHNldHRpbmdzLnBhc3N3b3JkKVxuXG4gIGZvciAobmFtZSBpbiBoZWFkZXJzKSBuYXRpdmVTZXRIZWFkZXIuYXBwbHkoeGhyLCBoZWFkZXJzW25hbWVdKVxuXG4gIGlmIChzZXR0aW5ncy50aW1lb3V0ID4gMCkgYWJvcnRUaW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGVtcHR5XG4gICAgeGhyLmFib3J0KClcbiAgICBhamF4RXJyb3IobnVsbCwgJ3RpbWVvdXQnLCB4aHIsIHNldHRpbmdzLCBkZWZlcnJlZClcbiAgfSwgc2V0dGluZ3MudGltZW91dClcblxuICAvLyBhdm9pZCBzZW5kaW5nIGVtcHR5IHN0cmluZyAoIzMxOSlcbiAgeGhyLnNlbmQoc2V0dGluZ3MuZGF0YSA/IHNldHRpbmdzLmRhdGEgOiBudWxsKVxuICByZXR1cm4geGhyXG59XG5cbi8vIGhhbmRsZSBvcHRpb25hbCBkYXRhL3N1Y2Nlc3MgYXJndW1lbnRzXG5mdW5jdGlvbiBwYXJzZUFyZ3VtZW50cyh1cmwsIGRhdGEsIHN1Y2Nlc3MsIGRhdGFUeXBlKSB7XG4gIGlmICgkLmlzRnVuY3Rpb24oZGF0YSkpIGRhdGFUeXBlID0gc3VjY2Vzcywgc3VjY2VzcyA9IGRhdGEsIGRhdGEgPSB1bmRlZmluZWRcbiAgaWYgKCEkLmlzRnVuY3Rpb24oc3VjY2VzcykpIGRhdGFUeXBlID0gc3VjY2Vzcywgc3VjY2VzcyA9IHVuZGVmaW5lZFxuICByZXR1cm4ge1xuICAgIHVybDogdXJsXG4gICAgLCBkYXRhOiBkYXRhXG4gICAgLCBzdWNjZXNzOiBzdWNjZXNzXG4gICAgLCBkYXRhVHlwZTogZGF0YVR5cGVcbiAgfVxufVxuXG4kLmdldCA9IGZ1bmN0aW9uICgvKiB1cmwsIGRhdGEsIHN1Y2Nlc3MsIGRhdGFUeXBlICovKSB7XG4gIHJldHVybiAkLmFqYXgocGFyc2VBcmd1bWVudHMuYXBwbHkobnVsbCwgYXJndW1lbnRzKSlcbn1cblxuJC5wb3N0ID0gZnVuY3Rpb24gKC8qIHVybCwgZGF0YSwgc3VjY2VzcywgZGF0YVR5cGUgKi8pIHtcbiAgdmFyIG9wdGlvbnMgPSBwYXJzZUFyZ3VtZW50cy5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gIG9wdGlvbnMudHlwZSA9ICdQT1NUJ1xuICByZXR1cm4gJC5hamF4KG9wdGlvbnMpXG59XG5cbiQuZ2V0SlNPTiA9IGZ1bmN0aW9uICgvKiB1cmwsIGRhdGEsIHN1Y2Nlc3MgKi8pIHtcbiAgdmFyIG9wdGlvbnMgPSBwYXJzZUFyZ3VtZW50cy5hcHBseShudWxsLCBhcmd1bWVudHMpXG4gIG9wdGlvbnMuZGF0YVR5cGUgPSAnanNvbidcbiAgcmV0dXJuICQuYWpheChvcHRpb25zKVxufVxuXG4kLmZuLmxvYWQgPSBmdW5jdGlvbiAodXJsLCBkYXRhLCBzdWNjZXNzKSB7XG4gIGlmICghdGhpcy5sZW5ndGgpIHJldHVybiB0aGlzXG4gIHZhciBzZWxmID0gdGhpcywgcGFydHMgPSB1cmwuc3BsaXQoL1xccy8pLCBzZWxlY3RvcixcbiAgICBvcHRpb25zID0gcGFyc2VBcmd1bWVudHModXJsLCBkYXRhLCBzdWNjZXNzKSxcbiAgICBjYWxsYmFjayA9IG9wdGlvbnMuc3VjY2Vzc1xuICBpZiAocGFydHMubGVuZ3RoID4gMSkgb3B0aW9ucy51cmwgPSBwYXJ0c1swXSwgc2VsZWN0b3IgPSBwYXJ0c1sxXVxuICBvcHRpb25zLnN1Y2Nlc3MgPSBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICBzZWxmLmh0bWwoc2VsZWN0b3IgP1xuICAgICAgJCgnPGRpdj4nKS5odG1sKHJlc3BvbnNlLnJlcGxhY2UocnNjcmlwdCwgXCJcIikpLmZpbmQoc2VsZWN0b3IpXG4gICAgICA6IHJlc3BvbnNlKVxuICAgIGNhbGxiYWNrICYmIGNhbGxiYWNrLmFwcGx5KHNlbGYsIGFyZ3VtZW50cylcbiAgfVxuICAkLmFqYXgob3B0aW9ucylcbiAgcmV0dXJuIHRoaXNcbn1cblxudmFyIGVzY2FwZSA9IGVuY29kZVVSSUNvbXBvbmVudFxuXG5mdW5jdGlvbiBzZXJpYWxpemUocGFyYW1zLCBvYmosIHRyYWRpdGlvbmFsLCBzY29wZSkge1xuICB2YXIgdHlwZSwgYXJyYXkgPSAkLmlzQXJyYXkob2JqKSwgaGFzaCA9ICQuaXNQbGFpbk9iamVjdChvYmopXG4gICQuZWFjaChvYmosIGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgdHlwZSA9ICQudHlwZSh2YWx1ZSlcbiAgICBpZiAoc2NvcGUpIGtleSA9IHRyYWRpdGlvbmFsID8gc2NvcGUgOlxuICAgIHNjb3BlICsgJ1snICsgKGhhc2ggfHwgdHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdhcnJheScgPyBrZXkgOiAnJykgKyAnXSdcbiAgICAvLyBoYW5kbGUgZGF0YSBpbiBzZXJpYWxpemVBcnJheSgpIGZvcm1hdFxuICAgIGlmICghc2NvcGUgJiYgYXJyYXkpIHBhcmFtcy5hZGQodmFsdWUubmFtZSwgdmFsdWUudmFsdWUpXG4gICAgLy8gcmVjdXJzZSBpbnRvIG5lc3RlZCBvYmplY3RzXG4gICAgZWxzZSBpZiAodHlwZSA9PSBcImFycmF5XCIgfHwgKCF0cmFkaXRpb25hbCAmJiB0eXBlID09IFwib2JqZWN0XCIpKVxuICAgICAgc2VyaWFsaXplKHBhcmFtcywgdmFsdWUsIHRyYWRpdGlvbmFsLCBrZXkpXG4gICAgZWxzZSBwYXJhbXMuYWRkKGtleSwgdmFsdWUpXG4gIH0pXG59XG5cbiQucGFyYW0gPSBmdW5jdGlvbiAob2JqLCB0cmFkaXRpb25hbCkge1xuICB2YXIgcGFyYW1zID0gW11cbiAgcGFyYW1zLmFkZCA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XG4gICAgaWYgKCQuaXNGdW5jdGlvbih2YWx1ZSkpIHZhbHVlID0gdmFsdWUoKVxuICAgIGlmICh2YWx1ZSA9PSBudWxsKSB2YWx1ZSA9IFwiXCJcbiAgICB0aGlzLnB1c2goZXNjYXBlKGtleSkgKyAnPScgKyBlc2NhcGUodmFsdWUpKVxuICB9XG4gIHNlcmlhbGl6ZShwYXJhbXMsIG9iaiwgdHJhZGl0aW9uYWwpXG4gIHJldHVybiBwYXJhbXMuam9pbignJicpLnJlcGxhY2UoLyUyMC9nLCAnKycpXG59XG4iLCIvLyAgICAgWmVwdG8uanNcbi8vICAgICAoYykgMjAxMC0yMDE2IFRob21hcyBGdWNoc1xuLy8gICAgIFplcHRvLmpzIG1heSBiZSBmcmVlbHkgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuXG52YXIgJCA9IHJlcXVpcmUoJy4vemVwdG8nKTtcblxuZnVuY3Rpb24gZGV0ZWN0KHVhLCBwbGF0Zm9ybSkge1xuICB2YXIgb3MgPSB0aGlzLm9zID0ge30sIGJyb3dzZXIgPSB0aGlzLmJyb3dzZXIgPSB7fSxcbiAgICB3ZWJraXQgPSB1YS5tYXRjaCgvV2ViW2tLXWl0W1xcL117MCwxfShbXFxkLl0rKS8pLFxuICAgIGFuZHJvaWQgPSB1YS5tYXRjaCgvKEFuZHJvaWQpOz9bXFxzXFwvXSsoW1xcZC5dKyk/LyksXG4gICAgb3N4ID0gISF1YS5tYXRjaCgvXFwoTWFjaW50b3NoXFw7IEludGVsIC8pLFxuICAgIGlwYWQgPSB1YS5tYXRjaCgvKGlQYWQpLipPU1xccyhbXFxkX10rKS8pLFxuICAgIGlwb2QgPSB1YS5tYXRjaCgvKGlQb2QpKC4qT1NcXHMoW1xcZF9dKykpPy8pLFxuICAgIGlwaG9uZSA9ICFpcGFkICYmIHVhLm1hdGNoKC8oaVBob25lXFxzT1MpXFxzKFtcXGRfXSspLyksXG4gICAgd2Vib3MgPSB1YS5tYXRjaCgvKHdlYk9TfGhwd09TKVtcXHNcXC9dKFtcXGQuXSspLyksXG4gICAgd2luID0gL1dpblxcZHsyfXxXaW5kb3dzLy50ZXN0KHBsYXRmb3JtKSxcbiAgICB3cCA9IHVhLm1hdGNoKC9XaW5kb3dzIFBob25lIChbXFxkLl0rKS8pLFxuICAgIHRvdWNocGFkID0gd2Vib3MgJiYgdWEubWF0Y2goL1RvdWNoUGFkLyksXG4gICAga2luZGxlID0gdWEubWF0Y2goL0tpbmRsZVxcLyhbXFxkLl0rKS8pLFxuICAgIHNpbGsgPSB1YS5tYXRjaCgvU2lsa1xcLyhbXFxkLl9dKykvKSxcbiAgICBibGFja2JlcnJ5ID0gdWEubWF0Y2goLyhCbGFja0JlcnJ5KS4qVmVyc2lvblxcLyhbXFxkLl0rKS8pLFxuICAgIGJiMTAgPSB1YS5tYXRjaCgvKEJCMTApLipWZXJzaW9uXFwvKFtcXGQuXSspLyksXG4gICAgcmltdGFibGV0b3MgPSB1YS5tYXRjaCgvKFJJTVxcc1RhYmxldFxcc09TKVxccyhbXFxkLl0rKS8pLFxuICAgIHBsYXlib29rID0gdWEubWF0Y2goL1BsYXlCb29rLyksXG4gICAgY2hyb21lID0gdWEubWF0Y2goL0Nocm9tZVxcLyhbXFxkLl0rKS8pIHx8IHVhLm1hdGNoKC9DcmlPU1xcLyhbXFxkLl0rKS8pLFxuICAgIGZpcmVmb3ggPSB1YS5tYXRjaCgvRmlyZWZveFxcLyhbXFxkLl0rKS8pLFxuICAgIGZpcmVmb3hvcyA9IHVhLm1hdGNoKC9cXCgoPzpNb2JpbGV8VGFibGV0KTsgcnY6KFtcXGQuXSspXFwpLipGaXJlZm94XFwvW1xcZC5dKy8pLFxuICAgIGllID0gdWEubWF0Y2goL01TSUVcXHMoW1xcZC5dKykvKSB8fCB1YS5tYXRjaCgvVHJpZGVudFxcL1tcXGRdKD89W15cXD9dKykuKnJ2OihbMC05Ll0uKS8pLFxuICAgIHdlYnZpZXcgPSAhY2hyb21lICYmIHVhLm1hdGNoKC8oaVBob25lfGlQb2R8aVBhZCkuKkFwcGxlV2ViS2l0KD8hLipTYWZhcmkpLyksXG4gICAgc2FmYXJpID0gd2VidmlldyB8fCB1YS5tYXRjaCgvVmVyc2lvblxcLyhbXFxkLl0rKShbXlNdKFNhZmFyaSl8W15NXSooTW9iaWxlKVteU10qKFNhZmFyaSkpLylcblxuICAvLyBUb2RvOiBjbGVhbiB0aGlzIHVwIHdpdGggYSBiZXR0ZXIgT1MvYnJvd3NlciBzZXBlcmF0aW9uOlxuICAvLyAtIGRpc2Nlcm4gKG1vcmUpIGJldHdlZW4gbXVsdGlwbGUgYnJvd3NlcnMgb24gYW5kcm9pZFxuICAvLyAtIGRlY2lkZSBpZiBraW5kbGUgZmlyZSBpbiBzaWxrIG1vZGUgaXMgYW5kcm9pZCBvciBub3RcbiAgLy8gLSBGaXJlZm94IG9uIEFuZHJvaWQgZG9lc24ndCBzcGVjaWZ5IHRoZSBBbmRyb2lkIHZlcnNpb25cbiAgLy8gLSBwb3NzaWJseSBkZXZpZGUgaW4gb3MsIGRldmljZSBhbmQgYnJvd3NlciBoYXNoZXNcblxuICBpZiAoYnJvd3Nlci53ZWJraXQgPSAhIXdlYmtpdCkgYnJvd3Nlci52ZXJzaW9uID0gd2Via2l0WzFdXG5cbiAgaWYgKGFuZHJvaWQpIG9zLmFuZHJvaWQgPSB0cnVlLCBvcy52ZXJzaW9uID0gYW5kcm9pZFsyXVxuICBpZiAoaXBob25lICYmICFpcG9kKSBvcy5pb3MgPSBvcy5pcGhvbmUgPSB0cnVlLCBvcy52ZXJzaW9uID0gaXBob25lWzJdLnJlcGxhY2UoL18vZywgJy4nKVxuICBpZiAoaXBhZCkgb3MuaW9zID0gb3MuaXBhZCA9IHRydWUsIG9zLnZlcnNpb24gPSBpcGFkWzJdLnJlcGxhY2UoL18vZywgJy4nKVxuICBpZiAoaXBvZCkgb3MuaW9zID0gb3MuaXBvZCA9IHRydWUsIG9zLnZlcnNpb24gPSBpcG9kWzNdID8gaXBvZFszXS5yZXBsYWNlKC9fL2csICcuJykgOiBudWxsXG4gIGlmICh3cCkgb3Mud3AgPSB0cnVlLCBvcy52ZXJzaW9uID0gd3BbMV1cbiAgaWYgKHdlYm9zKSBvcy53ZWJvcyA9IHRydWUsIG9zLnZlcnNpb24gPSB3ZWJvc1syXVxuICBpZiAodG91Y2hwYWQpIG9zLnRvdWNocGFkID0gdHJ1ZVxuICBpZiAoYmxhY2tiZXJyeSkgb3MuYmxhY2tiZXJyeSA9IHRydWUsIG9zLnZlcnNpb24gPSBibGFja2JlcnJ5WzJdXG4gIGlmIChiYjEwKSBvcy5iYjEwID0gdHJ1ZSwgb3MudmVyc2lvbiA9IGJiMTBbMl1cbiAgaWYgKHJpbXRhYmxldG9zKSBvcy5yaW10YWJsZXRvcyA9IHRydWUsIG9zLnZlcnNpb24gPSByaW10YWJsZXRvc1syXVxuICBpZiAocGxheWJvb2spIGJyb3dzZXIucGxheWJvb2sgPSB0cnVlXG4gIGlmIChraW5kbGUpIG9zLmtpbmRsZSA9IHRydWUsIG9zLnZlcnNpb24gPSBraW5kbGVbMV1cbiAgaWYgKHNpbGspIGJyb3dzZXIuc2lsayA9IHRydWUsIGJyb3dzZXIudmVyc2lvbiA9IHNpbGtbMV1cbiAgaWYgKCFzaWxrICYmIG9zLmFuZHJvaWQgJiYgdWEubWF0Y2goL0tpbmRsZSBGaXJlLykpIGJyb3dzZXIuc2lsayA9IHRydWVcbiAgaWYgKGNocm9tZSkgYnJvd3Nlci5jaHJvbWUgPSB0cnVlLCBicm93c2VyLnZlcnNpb24gPSBjaHJvbWVbMV1cbiAgaWYgKGZpcmVmb3gpIGJyb3dzZXIuZmlyZWZveCA9IHRydWUsIGJyb3dzZXIudmVyc2lvbiA9IGZpcmVmb3hbMV1cbiAgaWYgKGZpcmVmb3hvcykgb3MuZmlyZWZveG9zID0gdHJ1ZSwgb3MudmVyc2lvbiA9IGZpcmVmb3hvc1sxXVxuICBpZiAoaWUpIGJyb3dzZXIuaWUgPSB0cnVlLCBicm93c2VyLnZlcnNpb24gPSBpZVsxXVxuICBpZiAoc2FmYXJpICYmIChvc3ggfHwgb3MuaW9zIHx8IHdpbikpIHtcbiAgICBicm93c2VyLnNhZmFyaSA9IHRydWVcbiAgICBpZiAoIW9zLmlvcykgYnJvd3Nlci52ZXJzaW9uID0gc2FmYXJpWzFdXG4gIH1cbiAgaWYgKHdlYnZpZXcpIGJyb3dzZXIud2VidmlldyA9IHRydWVcblxuICBvcy50YWJsZXQgPSAhIShpcGFkIHx8IHBsYXlib29rIHx8IChhbmRyb2lkICYmICF1YS5tYXRjaCgvTW9iaWxlLykpIHx8XG4gIChmaXJlZm94ICYmIHVhLm1hdGNoKC9UYWJsZXQvKSkgfHwgKGllICYmICF1YS5tYXRjaCgvUGhvbmUvKSAmJiB1YS5tYXRjaCgvVG91Y2gvKSkpXG4gIG9zLnBob25lID0gISEoIW9zLnRhYmxldCAmJiAhb3MuaXBvZCAmJiAoYW5kcm9pZCB8fCBpcGhvbmUgfHwgd2Vib3MgfHwgYmxhY2tiZXJyeSB8fCBiYjEwIHx8XG4gIChjaHJvbWUgJiYgdWEubWF0Y2goL0FuZHJvaWQvKSkgfHwgKGNocm9tZSAmJiB1YS5tYXRjaCgvQ3JpT1NcXC8oW1xcZC5dKykvKSkgfHxcbiAgKGZpcmVmb3ggJiYgdWEubWF0Y2goL01vYmlsZS8pKSB8fCAoaWUgJiYgdWEubWF0Y2goL1RvdWNoLykpKSlcbn1cblxuZGV0ZWN0LmNhbGwoJCwgbmF2aWdhdG9yLnVzZXJBZ2VudCwgbmF2aWdhdG9yLnBsYXRmb3JtKVxuLy8gbWFrZSBhdmFpbGFibGUgdG8gdW5pdCB0ZXN0c1xuJC5fX2RldGVjdCA9IGRldGVjdFxuIiwiLy8gICAgIFplcHRvLmpzXG4vLyAgICAgKGMpIDIwMTAtMjAxNiBUaG9tYXMgRnVjaHNcbi8vICAgICBaZXB0by5qcyBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cblxudmFyICQgPSByZXF1aXJlKCcuL3plcHRvJyk7XG5cbnZhciBfemlkID0gMSwgdW5kZWZpbmVkLFxuICBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZSxcbiAgaXNGdW5jdGlvbiA9ICQuaXNGdW5jdGlvbixcbiAgaXNTdHJpbmcgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBvYmogPT0gJ3N0cmluZydcbiAgfSxcbiAgaGFuZGxlcnMgPSB7fSxcbiAgc3BlY2lhbEV2ZW50cyA9IHt9LFxuICBmb2N1c2luU3VwcG9ydGVkID0gJ29uZm9jdXNpbicgaW4gd2luZG93LFxuICBmb2N1cyA9IHtmb2N1czogJ2ZvY3VzaW4nLCBibHVyOiAnZm9jdXNvdXQnfSxcbiAgaG92ZXIgPSB7bW91c2VlbnRlcjogJ21vdXNlb3ZlcicsIG1vdXNlbGVhdmU6ICdtb3VzZW91dCd9XG5cbnNwZWNpYWxFdmVudHMuY2xpY2sgPSBzcGVjaWFsRXZlbnRzLm1vdXNlZG93biA9IHNwZWNpYWxFdmVudHMubW91c2V1cCA9IHNwZWNpYWxFdmVudHMubW91c2Vtb3ZlID0gJ01vdXNlRXZlbnRzJ1xuXG5mdW5jdGlvbiB6aWQoZWxlbWVudCkge1xuICByZXR1cm4gZWxlbWVudC5femlkIHx8IChlbGVtZW50Ll96aWQgPSBfemlkKyspXG59XG5mdW5jdGlvbiBmaW5kSGFuZGxlcnMoZWxlbWVudCwgZXZlbnQsIGZuLCBzZWxlY3Rvcikge1xuICBldmVudCA9IHBhcnNlKGV2ZW50KVxuICBpZiAoZXZlbnQubnMpIHZhciBtYXRjaGVyID0gbWF0Y2hlckZvcihldmVudC5ucylcbiAgcmV0dXJuIChoYW5kbGVyc1t6aWQoZWxlbWVudCldIHx8IFtdKS5maWx0ZXIoZnVuY3Rpb24gKGhhbmRsZXIpIHtcbiAgICByZXR1cm4gaGFuZGxlclxuICAgICAgJiYgKCFldmVudC5lIHx8IGhhbmRsZXIuZSA9PSBldmVudC5lKVxuICAgICAgJiYgKCFldmVudC5ucyB8fCBtYXRjaGVyLnRlc3QoaGFuZGxlci5ucykpXG4gICAgICAmJiAoIWZuIHx8IHppZChoYW5kbGVyLmZuKSA9PT0gemlkKGZuKSlcbiAgICAgICYmICghc2VsZWN0b3IgfHwgaGFuZGxlci5zZWwgPT0gc2VsZWN0b3IpXG4gIH0pXG59XG5mdW5jdGlvbiBwYXJzZShldmVudCkge1xuICB2YXIgcGFydHMgPSAoJycgKyBldmVudCkuc3BsaXQoJy4nKVxuICByZXR1cm4ge2U6IHBhcnRzWzBdLCBuczogcGFydHMuc2xpY2UoMSkuc29ydCgpLmpvaW4oJyAnKX1cbn1cbmZ1bmN0aW9uIG1hdGNoZXJGb3IobnMpIHtcbiAgcmV0dXJuIG5ldyBSZWdFeHAoJyg/Ol58ICknICsgbnMucmVwbGFjZSgnICcsICcgLiogPycpICsgJyg/OiB8JCknKVxufVxuXG5mdW5jdGlvbiBldmVudENhcHR1cmUoaGFuZGxlciwgY2FwdHVyZVNldHRpbmcpIHtcbiAgcmV0dXJuIGhhbmRsZXIuZGVsICYmXG4gICAgKCFmb2N1c2luU3VwcG9ydGVkICYmIChoYW5kbGVyLmUgaW4gZm9jdXMpKSB8fCAhIWNhcHR1cmVTZXR0aW5nXG59XG5cbmZ1bmN0aW9uIHJlYWxFdmVudCh0eXBlKSB7XG4gIHJldHVybiBob3Zlclt0eXBlXSB8fCAoZm9jdXNpblN1cHBvcnRlZCAmJiBmb2N1c1t0eXBlXSkgfHwgdHlwZVxufVxuXG5mdW5jdGlvbiBhZGQoZWxlbWVudCwgZXZlbnRzLCBmbiwgZGF0YSwgc2VsZWN0b3IsIGRlbGVnYXRvciwgY2FwdHVyZSkge1xuICB2YXIgaWQgPSB6aWQoZWxlbWVudCksIHNldCA9IChoYW5kbGVyc1tpZF0gfHwgKGhhbmRsZXJzW2lkXSA9IFtdKSlcbiAgZXZlbnRzLnNwbGl0KC9cXHMvKS5mb3JFYWNoKGZ1bmN0aW9uIChldmVudCkge1xuICAgIGlmIChldmVudCA9PSAncmVhZHknKSByZXR1cm4gJChkb2N1bWVudCkucmVhZHkoZm4pXG4gICAgdmFyIGhhbmRsZXIgPSBwYXJzZShldmVudClcbiAgICBoYW5kbGVyLmZuID0gZm5cbiAgICBoYW5kbGVyLnNlbCA9IHNlbGVjdG9yXG4gICAgLy8gZW11bGF0ZSBtb3VzZWVudGVyLCBtb3VzZWxlYXZlXG4gICAgaWYgKGhhbmRsZXIuZSBpbiBob3ZlcikgZm4gPSBmdW5jdGlvbiAoZSkge1xuICAgICAgdmFyIHJlbGF0ZWQgPSBlLnJlbGF0ZWRUYXJnZXRcbiAgICAgIGlmICghcmVsYXRlZCB8fCAocmVsYXRlZCAhPT0gdGhpcyAmJiAhJC5jb250YWlucyh0aGlzLCByZWxhdGVkKSkpXG4gICAgICAgIHJldHVybiBoYW5kbGVyLmZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgICB9XG4gICAgaGFuZGxlci5kZWwgPSBkZWxlZ2F0b3JcbiAgICB2YXIgY2FsbGJhY2sgPSBkZWxlZ2F0b3IgfHwgZm5cbiAgICBoYW5kbGVyLnByb3h5ID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIGUgPSBjb21wYXRpYmxlKGUpXG4gICAgICBpZiAoZS5pc0ltbWVkaWF0ZVByb3BhZ2F0aW9uU3RvcHBlZCgpKSByZXR1cm5cbiAgICAgIGUuZGF0YSA9IGRhdGFcbiAgICAgIHZhciByZXN1bHQgPSBjYWxsYmFjay5hcHBseShlbGVtZW50LCBlLl9hcmdzID09IHVuZGVmaW5lZCA/IFtlXSA6IFtlXS5jb25jYXQoZS5fYXJncykpXG4gICAgICBpZiAocmVzdWx0ID09PSBmYWxzZSkgZS5wcmV2ZW50RGVmYXVsdCgpLCBlLnN0b3BQcm9wYWdhdGlvbigpXG4gICAgICByZXR1cm4gcmVzdWx0XG4gICAgfVxuICAgIGhhbmRsZXIuaSA9IHNldC5sZW5ndGhcbiAgICBzZXQucHVzaChoYW5kbGVyKVxuICAgIGlmICgnYWRkRXZlbnRMaXN0ZW5lcicgaW4gZWxlbWVudClcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihyZWFsRXZlbnQoaGFuZGxlci5lKSwgaGFuZGxlci5wcm94eSwgZXZlbnRDYXB0dXJlKGhhbmRsZXIsIGNhcHR1cmUpKVxuICB9KVxufVxuZnVuY3Rpb24gcmVtb3ZlKGVsZW1lbnQsIGV2ZW50cywgZm4sIHNlbGVjdG9yLCBjYXB0dXJlKSB7XG4gIHZhciBpZCA9IHppZChlbGVtZW50KVxuICAgIDtcbiAgKGV2ZW50cyB8fCAnJykuc3BsaXQoL1xccy8pLmZvckVhY2goZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgZmluZEhhbmRsZXJzKGVsZW1lbnQsIGV2ZW50LCBmbiwgc2VsZWN0b3IpLmZvckVhY2goZnVuY3Rpb24gKGhhbmRsZXIpIHtcbiAgICAgIGRlbGV0ZSBoYW5kbGVyc1tpZF1baGFuZGxlci5pXVxuICAgICAgaWYgKCdyZW1vdmVFdmVudExpc3RlbmVyJyBpbiBlbGVtZW50KVxuICAgICAgICBlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIocmVhbEV2ZW50KGhhbmRsZXIuZSksIGhhbmRsZXIucHJveHksIGV2ZW50Q2FwdHVyZShoYW5kbGVyLCBjYXB0dXJlKSlcbiAgICB9KVxuICB9KVxufVxuXG4kLmV2ZW50ID0ge2FkZDogYWRkLCByZW1vdmU6IHJlbW92ZX1cblxuJC5wcm94eSA9IGZ1bmN0aW9uIChmbiwgY29udGV4dCkge1xuICB2YXIgYXJncyA9ICgyIGluIGFyZ3VtZW50cykgJiYgc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpXG4gIGlmIChpc0Z1bmN0aW9uKGZuKSkge1xuICAgIHZhciBwcm94eUZuID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGZuLmFwcGx5KGNvbnRleHQsIGFyZ3MgPyBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpIDogYXJndW1lbnRzKVxuICAgIH1cbiAgICBwcm94eUZuLl96aWQgPSB6aWQoZm4pXG4gICAgcmV0dXJuIHByb3h5Rm5cbiAgfSBlbHNlIGlmIChpc1N0cmluZyhjb250ZXh0KSkge1xuICAgIGlmIChhcmdzKSB7XG4gICAgICBhcmdzLnVuc2hpZnQoZm5bY29udGV4dF0sIGZuKVxuICAgICAgcmV0dXJuICQucHJveHkuYXBwbHkobnVsbCwgYXJncylcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICQucHJveHkoZm5bY29udGV4dF0sIGZuKVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZXhwZWN0ZWQgZnVuY3Rpb25cIilcbiAgfVxufVxuXG4kLmZuLmJpbmQgPSBmdW5jdGlvbiAoZXZlbnQsIGRhdGEsIGNhbGxiYWNrKSB7XG4gIHJldHVybiB0aGlzLm9uKGV2ZW50LCBkYXRhLCBjYWxsYmFjaylcbn1cbiQuZm4udW5iaW5kID0gZnVuY3Rpb24gKGV2ZW50LCBjYWxsYmFjaykge1xuICByZXR1cm4gdGhpcy5vZmYoZXZlbnQsIGNhbGxiYWNrKVxufVxuJC5mbi5vbmUgPSBmdW5jdGlvbiAoZXZlbnQsIHNlbGVjdG9yLCBkYXRhLCBjYWxsYmFjaykge1xuICByZXR1cm4gdGhpcy5vbihldmVudCwgc2VsZWN0b3IsIGRhdGEsIGNhbGxiYWNrLCAxKVxufVxuXG52YXIgcmV0dXJuVHJ1ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdHJ1ZVxuICB9LFxuICByZXR1cm5GYWxzZSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfSxcbiAgaWdub3JlUHJvcGVydGllcyA9IC9eKFtBLVpdfHJldHVyblZhbHVlJHxsYXllcltYWV0kKS8sXG4gIGV2ZW50TWV0aG9kcyA9IHtcbiAgICBwcmV2ZW50RGVmYXVsdDogJ2lzRGVmYXVsdFByZXZlbnRlZCcsXG4gICAgc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uOiAnaXNJbW1lZGlhdGVQcm9wYWdhdGlvblN0b3BwZWQnLFxuICAgIHN0b3BQcm9wYWdhdGlvbjogJ2lzUHJvcGFnYXRpb25TdG9wcGVkJ1xuICB9XG5cbmZ1bmN0aW9uIGNvbXBhdGlibGUoZXZlbnQsIHNvdXJjZSkge1xuICBpZiAoc291cmNlIHx8ICFldmVudC5pc0RlZmF1bHRQcmV2ZW50ZWQpIHtcbiAgICBzb3VyY2UgfHwgKHNvdXJjZSA9IGV2ZW50KVxuXG4gICAgJC5lYWNoKGV2ZW50TWV0aG9kcywgZnVuY3Rpb24gKG5hbWUsIHByZWRpY2F0ZSkge1xuICAgICAgdmFyIHNvdXJjZU1ldGhvZCA9IHNvdXJjZVtuYW1lXVxuICAgICAgZXZlbnRbbmFtZV0gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXNbcHJlZGljYXRlXSA9IHJldHVyblRydWVcbiAgICAgICAgcmV0dXJuIHNvdXJjZU1ldGhvZCAmJiBzb3VyY2VNZXRob2QuYXBwbHkoc291cmNlLCBhcmd1bWVudHMpXG4gICAgICB9XG4gICAgICBldmVudFtwcmVkaWNhdGVdID0gcmV0dXJuRmFsc2VcbiAgICB9KVxuXG4gICAgaWYgKHNvdXJjZS5kZWZhdWx0UHJldmVudGVkICE9PSB1bmRlZmluZWQgPyBzb3VyY2UuZGVmYXVsdFByZXZlbnRlZCA6XG4gICAgICAgICdyZXR1cm5WYWx1ZScgaW4gc291cmNlID8gc291cmNlLnJldHVyblZhbHVlID09PSBmYWxzZSA6XG4gICAgICAgIHNvdXJjZS5nZXRQcmV2ZW50RGVmYXVsdCAmJiBzb3VyY2UuZ2V0UHJldmVudERlZmF1bHQoKSlcbiAgICAgIGV2ZW50LmlzRGVmYXVsdFByZXZlbnRlZCA9IHJldHVyblRydWVcbiAgfVxuICByZXR1cm4gZXZlbnRcbn1cblxuZnVuY3Rpb24gY3JlYXRlUHJveHkoZXZlbnQpIHtcbiAgdmFyIGtleSwgcHJveHkgPSB7b3JpZ2luYWxFdmVudDogZXZlbnR9XG4gIGZvciAoa2V5IGluIGV2ZW50KVxuICAgIGlmICghaWdub3JlUHJvcGVydGllcy50ZXN0KGtleSkgJiYgZXZlbnRba2V5XSAhPT0gdW5kZWZpbmVkKSBwcm94eVtrZXldID0gZXZlbnRba2V5XVxuXG4gIHJldHVybiBjb21wYXRpYmxlKHByb3h5LCBldmVudClcbn1cblxuJC5mbi5kZWxlZ2F0ZSA9IGZ1bmN0aW9uIChzZWxlY3RvciwgZXZlbnQsIGNhbGxiYWNrKSB7XG4gIHJldHVybiB0aGlzLm9uKGV2ZW50LCBzZWxlY3RvciwgY2FsbGJhY2spXG59XG4kLmZuLnVuZGVsZWdhdGUgPSBmdW5jdGlvbiAoc2VsZWN0b3IsIGV2ZW50LCBjYWxsYmFjaykge1xuICByZXR1cm4gdGhpcy5vZmYoZXZlbnQsIHNlbGVjdG9yLCBjYWxsYmFjaylcbn1cblxuJC5mbi5saXZlID0gZnVuY3Rpb24gKGV2ZW50LCBjYWxsYmFjaykge1xuICAkKGRvY3VtZW50LmJvZHkpLmRlbGVnYXRlKHRoaXMuc2VsZWN0b3IsIGV2ZW50LCBjYWxsYmFjaylcbiAgcmV0dXJuIHRoaXNcbn1cbiQuZm4uZGllID0gZnVuY3Rpb24gKGV2ZW50LCBjYWxsYmFjaykge1xuICAkKGRvY3VtZW50LmJvZHkpLnVuZGVsZWdhdGUodGhpcy5zZWxlY3RvciwgZXZlbnQsIGNhbGxiYWNrKVxuICByZXR1cm4gdGhpc1xufVxuXG4kLmZuLm9uID0gZnVuY3Rpb24gKGV2ZW50LCBzZWxlY3RvciwgZGF0YSwgY2FsbGJhY2ssIG9uZSkge1xuICB2YXIgYXV0b1JlbW92ZSwgZGVsZWdhdG9yLCAkdGhpcyA9IHRoaXNcbiAgaWYgKGV2ZW50ICYmICFpc1N0cmluZyhldmVudCkpIHtcbiAgICAkLmVhY2goZXZlbnQsIGZ1bmN0aW9uICh0eXBlLCBmbikge1xuICAgICAgJHRoaXMub24odHlwZSwgc2VsZWN0b3IsIGRhdGEsIGZuLCBvbmUpXG4gICAgfSlcbiAgICByZXR1cm4gJHRoaXNcbiAgfVxuXG4gIGlmICghaXNTdHJpbmcoc2VsZWN0b3IpICYmICFpc0Z1bmN0aW9uKGNhbGxiYWNrKSAmJiBjYWxsYmFjayAhPT0gZmFsc2UpXG4gICAgY2FsbGJhY2sgPSBkYXRhLCBkYXRhID0gc2VsZWN0b3IsIHNlbGVjdG9yID0gdW5kZWZpbmVkXG4gIGlmIChjYWxsYmFjayA9PT0gdW5kZWZpbmVkIHx8IGRhdGEgPT09IGZhbHNlKVxuICAgIGNhbGxiYWNrID0gZGF0YSwgZGF0YSA9IHVuZGVmaW5lZFxuXG4gIGlmIChjYWxsYmFjayA9PT0gZmFsc2UpIGNhbGxiYWNrID0gcmV0dXJuRmFsc2VcblxuICByZXR1cm4gJHRoaXMuZWFjaChmdW5jdGlvbiAoXywgZWxlbWVudCkge1xuICAgIGlmIChvbmUpIGF1dG9SZW1vdmUgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgcmVtb3ZlKGVsZW1lbnQsIGUudHlwZSwgY2FsbGJhY2spXG4gICAgICByZXR1cm4gY2FsbGJhY2suYXBwbHkodGhpcywgYXJndW1lbnRzKVxuICAgIH1cblxuICAgIGlmIChzZWxlY3RvcikgZGVsZWdhdG9yID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgIHZhciBldnQsIG1hdGNoID0gJChlLnRhcmdldCkuY2xvc2VzdChzZWxlY3RvciwgZWxlbWVudCkuZ2V0KDApXG4gICAgICBpZiAobWF0Y2ggJiYgbWF0Y2ggIT09IGVsZW1lbnQpIHtcbiAgICAgICAgZXZ0ID0gJC5leHRlbmQoY3JlYXRlUHJveHkoZSksIHtjdXJyZW50VGFyZ2V0OiBtYXRjaCwgbGl2ZUZpcmVkOiBlbGVtZW50fSlcbiAgICAgICAgcmV0dXJuIChhdXRvUmVtb3ZlIHx8IGNhbGxiYWNrKS5hcHBseShtYXRjaCwgW2V2dF0uY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSkpXG4gICAgICB9XG4gICAgfVxuXG4gICAgYWRkKGVsZW1lbnQsIGV2ZW50LCBjYWxsYmFjaywgZGF0YSwgc2VsZWN0b3IsIGRlbGVnYXRvciB8fCBhdXRvUmVtb3ZlKVxuICB9KVxufVxuJC5mbi5vZmYgPSBmdW5jdGlvbiAoZXZlbnQsIHNlbGVjdG9yLCBjYWxsYmFjaykge1xuICB2YXIgJHRoaXMgPSB0aGlzXG4gIGlmIChldmVudCAmJiAhaXNTdHJpbmcoZXZlbnQpKSB7XG4gICAgJC5lYWNoKGV2ZW50LCBmdW5jdGlvbiAodHlwZSwgZm4pIHtcbiAgICAgICR0aGlzLm9mZih0eXBlLCBzZWxlY3RvciwgZm4pXG4gICAgfSlcbiAgICByZXR1cm4gJHRoaXNcbiAgfVxuXG4gIGlmICghaXNTdHJpbmcoc2VsZWN0b3IpICYmICFpc0Z1bmN0aW9uKGNhbGxiYWNrKSAmJiBjYWxsYmFjayAhPT0gZmFsc2UpXG4gICAgY2FsbGJhY2sgPSBzZWxlY3Rvciwgc2VsZWN0b3IgPSB1bmRlZmluZWRcblxuICBpZiAoY2FsbGJhY2sgPT09IGZhbHNlKSBjYWxsYmFjayA9IHJldHVybkZhbHNlXG5cbiAgcmV0dXJuICR0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xuICAgIHJlbW92ZSh0aGlzLCBldmVudCwgY2FsbGJhY2ssIHNlbGVjdG9yKVxuICB9KVxufVxuXG4kLmZuLnRyaWdnZXIgPSBmdW5jdGlvbiAoZXZlbnQsIGFyZ3MpIHtcbiAgZXZlbnQgPSAoaXNTdHJpbmcoZXZlbnQpIHx8ICQuaXNQbGFpbk9iamVjdChldmVudCkpID8gJC5FdmVudChldmVudCkgOiBjb21wYXRpYmxlKGV2ZW50KVxuICBldmVudC5fYXJncyA9IGFyZ3NcbiAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgLy8gaGFuZGxlIGZvY3VzKCksIGJsdXIoKSBieSBjYWxsaW5nIHRoZW0gZGlyZWN0bHlcbiAgICBpZiAoZXZlbnQudHlwZSBpbiBmb2N1cyAmJiB0eXBlb2YgdGhpc1tldmVudC50eXBlXSA9PSBcImZ1bmN0aW9uXCIpIHRoaXNbZXZlbnQudHlwZV0oKVxuICAgIC8vIGl0ZW1zIGluIHRoZSBjb2xsZWN0aW9uIG1pZ2h0IG5vdCBiZSBET00gZWxlbWVudHNcbiAgICBlbHNlIGlmICgnZGlzcGF0Y2hFdmVudCcgaW4gdGhpcykgdGhpcy5kaXNwYXRjaEV2ZW50KGV2ZW50KVxuICAgIGVsc2UgJCh0aGlzKS50cmlnZ2VySGFuZGxlcihldmVudCwgYXJncylcbiAgfSlcbn1cblxuLy8gdHJpZ2dlcnMgZXZlbnQgaGFuZGxlcnMgb24gY3VycmVudCBlbGVtZW50IGp1c3QgYXMgaWYgYW4gZXZlbnQgb2NjdXJyZWQsXG4vLyBkb2Vzbid0IHRyaWdnZXIgYW4gYWN0dWFsIGV2ZW50LCBkb2Vzbid0IGJ1YmJsZVxuJC5mbi50cmlnZ2VySGFuZGxlciA9IGZ1bmN0aW9uIChldmVudCwgYXJncykge1xuICB2YXIgZSwgcmVzdWx0XG4gIHRoaXMuZWFjaChmdW5jdGlvbiAoaSwgZWxlbWVudCkge1xuICAgIGUgPSBjcmVhdGVQcm94eShpc1N0cmluZyhldmVudCkgPyAkLkV2ZW50KGV2ZW50KSA6IGV2ZW50KVxuICAgIGUuX2FyZ3MgPSBhcmdzXG4gICAgZS50YXJnZXQgPSBlbGVtZW50XG4gICAgJC5lYWNoKGZpbmRIYW5kbGVycyhlbGVtZW50LCBldmVudC50eXBlIHx8IGV2ZW50KSwgZnVuY3Rpb24gKGksIGhhbmRsZXIpIHtcbiAgICAgIHJlc3VsdCA9IGhhbmRsZXIucHJveHkoZSlcbiAgICAgIGlmIChlLmlzSW1tZWRpYXRlUHJvcGFnYXRpb25TdG9wcGVkKCkpIHJldHVybiBmYWxzZVxuICAgIH0pXG4gIH0pXG4gIHJldHVybiByZXN1bHRcbn1cblxuICAvLyBzaG9ydGN1dCBtZXRob2RzIGZvciBgLmJpbmQoZXZlbnQsIGZuKWAgZm9yIGVhY2ggZXZlbnQgdHlwZVxuO1xuKCdmb2N1c2luIGZvY3Vzb3V0IGZvY3VzIGJsdXIgbG9hZCByZXNpemUgc2Nyb2xsIHVubG9hZCBjbGljayBkYmxjbGljayAnICtcbidtb3VzZWRvd24gbW91c2V1cCBtb3VzZW1vdmUgbW91c2VvdmVyIG1vdXNlb3V0IG1vdXNlZW50ZXIgbW91c2VsZWF2ZSAnICtcbidjaGFuZ2Ugc2VsZWN0IGtleWRvd24ga2V5cHJlc3Mga2V5dXAgZXJyb3InKS5zcGxpdCgnICcpLmZvckVhY2goZnVuY3Rpb24gKGV2ZW50KSB7XG4gICQuZm5bZXZlbnRdID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuICgwIGluIGFyZ3VtZW50cykgP1xuICAgICAgdGhpcy5iaW5kKGV2ZW50LCBjYWxsYmFjaykgOlxuICAgICAgdGhpcy50cmlnZ2VyKGV2ZW50KVxuICB9XG59KVxuXG4kLkV2ZW50ID0gZnVuY3Rpb24gKHR5cGUsIHByb3BzKSB7XG4gIGlmICghaXNTdHJpbmcodHlwZSkpIHByb3BzID0gdHlwZSwgdHlwZSA9IHByb3BzLnR5cGVcbiAgdmFyIGV2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoc3BlY2lhbEV2ZW50c1t0eXBlXSB8fCAnRXZlbnRzJyksIGJ1YmJsZXMgPSB0cnVlXG4gIGlmIChwcm9wcykgZm9yICh2YXIgbmFtZSBpbiBwcm9wcykgKG5hbWUgPT0gJ2J1YmJsZXMnKSA/IChidWJibGVzID0gISFwcm9wc1tuYW1lXSkgOiAoZXZlbnRbbmFtZV0gPSBwcm9wc1tuYW1lXSlcbiAgZXZlbnQuaW5pdEV2ZW50KHR5cGUsIGJ1YmJsZXMsIHRydWUpXG4gIHJldHVybiBjb21wYXRpYmxlKGV2ZW50KVxufVxuIiwiLy8gICAgIFplcHRvLmpzXG4vLyAgICAgKGMpIDIwMTAtMjAxNiBUaG9tYXMgRnVjaHNcbi8vICAgICBaZXB0by5qcyBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cblxudmFyICQgPSByZXF1aXJlKCcuL3plcHRvJyk7XG5cbiQuZm4uc2VyaWFsaXplQXJyYXkgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBuYW1lLCB0eXBlLCByZXN1bHQgPSBbXSxcbiAgICBhZGQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIGlmICh2YWx1ZS5mb3JFYWNoKSByZXR1cm4gdmFsdWUuZm9yRWFjaChhZGQpXG4gICAgICByZXN1bHQucHVzaCh7bmFtZTogbmFtZSwgdmFsdWU6IHZhbHVlfSlcbiAgICB9XG4gIGlmICh0aGlzWzBdKSAkLmVhY2godGhpc1swXS5lbGVtZW50cywgZnVuY3Rpb24gKF8sIGZpZWxkKSB7XG4gICAgdHlwZSA9IGZpZWxkLnR5cGUsIG5hbWUgPSBmaWVsZC5uYW1lXG4gICAgaWYgKG5hbWUgJiYgZmllbGQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSAhPSAnZmllbGRzZXQnICYmICFmaWVsZC5kaXNhYmxlZCAmJiB0eXBlICE9ICdzdWJtaXQnICYmIHR5cGUgIT0gJ3Jlc2V0JyAmJiB0eXBlICE9ICdidXR0b24nICYmIHR5cGUgIT0gJ2ZpbGUnICYmXG4gICAgICAoKHR5cGUgIT0gJ3JhZGlvJyAmJiB0eXBlICE9ICdjaGVja2JveCcpIHx8IGZpZWxkLmNoZWNrZWQpKVxuICAgICAgYWRkKCQoZmllbGQpLnZhbCgpKVxuICB9KVxuICByZXR1cm4gcmVzdWx0XG59XG5cbiQuZm4uc2VyaWFsaXplID0gZnVuY3Rpb24gKCkge1xuICB2YXIgcmVzdWx0ID0gW11cbiAgdGhpcy5zZXJpYWxpemVBcnJheSgpLmZvckVhY2goZnVuY3Rpb24gKGVsbSkge1xuICAgIHJlc3VsdC5wdXNoKGVuY29kZVVSSUNvbXBvbmVudChlbG0ubmFtZSkgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQoZWxtLnZhbHVlKSlcbiAgfSlcbiAgcmV0dXJuIHJlc3VsdC5qb2luKCcmJylcbn1cblxuJC5mbi5zdWJtaXQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgaWYgKDAgaW4gYXJndW1lbnRzKSB0aGlzLmJpbmQoJ3N1Ym1pdCcsIGNhbGxiYWNrKVxuICBlbHNlIGlmICh0aGlzLmxlbmd0aCkge1xuICAgIHZhciBldmVudCA9ICQuRXZlbnQoJ3N1Ym1pdCcpXG4gICAgdGhpcy5lcSgwKS50cmlnZ2VyKGV2ZW50KVxuICAgIGlmICghZXZlbnQuaXNEZWZhdWx0UHJldmVudGVkKCkpIHRoaXMuZ2V0KDApLnN1Ym1pdCgpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cbiIsIi8vICAgICBaZXB0by5qc1xuLy8gICAgIChjKSAyMDEwLTIwMTYgVGhvbWFzIEZ1Y2hzXG4vLyAgICAgWmVwdG8uanMgbWF5IGJlIGZyZWVseSBkaXN0cmlidXRlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG5cbnZhciAkID0gcmVxdWlyZSgnLi96ZXB0bycpO1xuXG52YXIgcHJlZml4ID0gJycsIGV2ZW50UHJlZml4LFxuICB2ZW5kb3JzID0ge1dlYmtpdDogJ3dlYmtpdCcsIE1vejogJycsIE86ICdvJ30sXG4gIHRlc3RFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxuICBzdXBwb3J0ZWRUcmFuc2Zvcm1zID0gL14oKHRyYW5zbGF0ZXxyb3RhdGV8c2NhbGUpKFh8WXxafDNkKT98bWF0cml4KDNkKT98cGVyc3BlY3RpdmV8c2tldyhYfFkpPykkL2ksXG4gIHRyYW5zZm9ybSxcbiAgdHJhbnNpdGlvblByb3BlcnR5LCB0cmFuc2l0aW9uRHVyYXRpb24sIHRyYW5zaXRpb25UaW1pbmcsIHRyYW5zaXRpb25EZWxheSxcbiAgYW5pbWF0aW9uTmFtZSwgYW5pbWF0aW9uRHVyYXRpb24sIGFuaW1hdGlvblRpbWluZywgYW5pbWF0aW9uRGVsYXksXG4gIGNzc1Jlc2V0ID0ge31cblxuZnVuY3Rpb24gZGFzaGVyaXplKHN0cikge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pLywgJyQxLSQyJykudG9Mb3dlckNhc2UoKVxufVxuZnVuY3Rpb24gbm9ybWFsaXplRXZlbnQobmFtZSkge1xuICByZXR1cm4gZXZlbnRQcmVmaXggPyBldmVudFByZWZpeCArIG5hbWUgOiBuYW1lLnRvTG93ZXJDYXNlKClcbn1cblxuJC5lYWNoKHZlbmRvcnMsIGZ1bmN0aW9uICh2ZW5kb3IsIGV2ZW50KSB7XG4gIGlmICh0ZXN0RWwuc3R5bGVbdmVuZG9yICsgJ1RyYW5zaXRpb25Qcm9wZXJ0eSddICE9PSB1bmRlZmluZWQpIHtcbiAgICBwcmVmaXggPSAnLScgKyB2ZW5kb3IudG9Mb3dlckNhc2UoKSArICctJ1xuICAgIGV2ZW50UHJlZml4ID0gZXZlbnRcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufSlcblxudHJhbnNmb3JtID0gcHJlZml4ICsgJ3RyYW5zZm9ybSdcbmNzc1Jlc2V0W3RyYW5zaXRpb25Qcm9wZXJ0eSA9IHByZWZpeCArICd0cmFuc2l0aW9uLXByb3BlcnR5J10gPVxuICBjc3NSZXNldFt0cmFuc2l0aW9uRHVyYXRpb24gPSBwcmVmaXggKyAndHJhbnNpdGlvbi1kdXJhdGlvbiddID1cbiAgICBjc3NSZXNldFt0cmFuc2l0aW9uRGVsYXkgPSBwcmVmaXggKyAndHJhbnNpdGlvbi1kZWxheSddID1cbiAgICAgIGNzc1Jlc2V0W3RyYW5zaXRpb25UaW1pbmcgPSBwcmVmaXggKyAndHJhbnNpdGlvbi10aW1pbmctZnVuY3Rpb24nXSA9XG4gICAgICAgIGNzc1Jlc2V0W2FuaW1hdGlvbk5hbWUgPSBwcmVmaXggKyAnYW5pbWF0aW9uLW5hbWUnXSA9XG4gICAgICAgICAgY3NzUmVzZXRbYW5pbWF0aW9uRHVyYXRpb24gPSBwcmVmaXggKyAnYW5pbWF0aW9uLWR1cmF0aW9uJ10gPVxuICAgICAgICAgICAgY3NzUmVzZXRbYW5pbWF0aW9uRGVsYXkgPSBwcmVmaXggKyAnYW5pbWF0aW9uLWRlbGF5J10gPVxuICAgICAgICAgICAgICBjc3NSZXNldFthbmltYXRpb25UaW1pbmcgPSBwcmVmaXggKyAnYW5pbWF0aW9uLXRpbWluZy1mdW5jdGlvbiddID0gJydcblxuJC5meCA9IHtcbiAgb2ZmOiAoZXZlbnRQcmVmaXggPT09IHVuZGVmaW5lZCAmJiB0ZXN0RWwuc3R5bGUudHJhbnNpdGlvblByb3BlcnR5ID09PSB1bmRlZmluZWQpLFxuICBzcGVlZHM6IHtfZGVmYXVsdDogNDAwLCBmYXN0OiAyMDAsIHNsb3c6IDYwMH0sXG4gIGNzc1ByZWZpeDogcHJlZml4LFxuICB0cmFuc2l0aW9uRW5kOiBub3JtYWxpemVFdmVudCgnVHJhbnNpdGlvbkVuZCcpLFxuICBhbmltYXRpb25FbmQ6IG5vcm1hbGl6ZUV2ZW50KCdBbmltYXRpb25FbmQnKVxufVxuXG4kLmZuLmFuaW1hdGUgPSBmdW5jdGlvbiAocHJvcGVydGllcywgZHVyYXRpb24sIGVhc2UsIGNhbGxiYWNrLCBkZWxheSkge1xuICBpZiAoJC5pc0Z1bmN0aW9uKGR1cmF0aW9uKSlcbiAgICBjYWxsYmFjayA9IGR1cmF0aW9uLCBlYXNlID0gdW5kZWZpbmVkLCBkdXJhdGlvbiA9IHVuZGVmaW5lZFxuICBpZiAoJC5pc0Z1bmN0aW9uKGVhc2UpKVxuICAgIGNhbGxiYWNrID0gZWFzZSwgZWFzZSA9IHVuZGVmaW5lZFxuICBpZiAoJC5pc1BsYWluT2JqZWN0KGR1cmF0aW9uKSlcbiAgICBlYXNlID0gZHVyYXRpb24uZWFzaW5nLCBjYWxsYmFjayA9IGR1cmF0aW9uLmNvbXBsZXRlLCBkZWxheSA9IGR1cmF0aW9uLmRlbGF5LCBkdXJhdGlvbiA9IGR1cmF0aW9uLmR1cmF0aW9uXG4gIGlmIChkdXJhdGlvbikgZHVyYXRpb24gPSAodHlwZW9mIGR1cmF0aW9uID09ICdudW1iZXInID8gZHVyYXRpb24gOlxuICAgICAgKCQuZnguc3BlZWRzW2R1cmF0aW9uXSB8fCAkLmZ4LnNwZWVkcy5fZGVmYXVsdCkpIC8gMTAwMFxuICBpZiAoZGVsYXkpIGRlbGF5ID0gcGFyc2VGbG9hdChkZWxheSkgLyAxMDAwXG4gIHJldHVybiB0aGlzLmFuaW0ocHJvcGVydGllcywgZHVyYXRpb24sIGVhc2UsIGNhbGxiYWNrLCBkZWxheSlcbn1cblxuJC5mbi5hbmltID0gZnVuY3Rpb24gKHByb3BlcnRpZXMsIGR1cmF0aW9uLCBlYXNlLCBjYWxsYmFjaywgZGVsYXkpIHtcbiAgdmFyIGtleSwgY3NzVmFsdWVzID0ge30sIGNzc1Byb3BlcnRpZXMsIHRyYW5zZm9ybXMgPSAnJyxcbiAgICB0aGF0ID0gdGhpcywgd3JhcHBlZENhbGxiYWNrLCBlbmRFdmVudCA9ICQuZngudHJhbnNpdGlvbkVuZCxcbiAgICBmaXJlZCA9IGZhbHNlXG5cbiAgaWYgKGR1cmF0aW9uID09PSB1bmRlZmluZWQpIGR1cmF0aW9uID0gJC5meC5zcGVlZHMuX2RlZmF1bHQgLyAxMDAwXG4gIGlmIChkZWxheSA9PT0gdW5kZWZpbmVkKSBkZWxheSA9IDBcbiAgaWYgKCQuZngub2ZmKSBkdXJhdGlvbiA9IDBcblxuICBpZiAodHlwZW9mIHByb3BlcnRpZXMgPT0gJ3N0cmluZycpIHtcbiAgICAvLyBrZXlmcmFtZSBhbmltYXRpb25cbiAgICBjc3NWYWx1ZXNbYW5pbWF0aW9uTmFtZV0gPSBwcm9wZXJ0aWVzXG4gICAgY3NzVmFsdWVzW2FuaW1hdGlvbkR1cmF0aW9uXSA9IGR1cmF0aW9uICsgJ3MnXG4gICAgY3NzVmFsdWVzW2FuaW1hdGlvbkRlbGF5XSA9IGRlbGF5ICsgJ3MnXG4gICAgY3NzVmFsdWVzW2FuaW1hdGlvblRpbWluZ10gPSAoZWFzZSB8fCAnbGluZWFyJylcbiAgICBlbmRFdmVudCA9ICQuZnguYW5pbWF0aW9uRW5kXG4gIH0gZWxzZSB7XG4gICAgY3NzUHJvcGVydGllcyA9IFtdXG4gICAgLy8gQ1NTIHRyYW5zaXRpb25zXG4gICAgZm9yIChrZXkgaW4gcHJvcGVydGllcylcbiAgICAgIGlmIChzdXBwb3J0ZWRUcmFuc2Zvcm1zLnRlc3Qoa2V5KSkgdHJhbnNmb3JtcyArPSBrZXkgKyAnKCcgKyBwcm9wZXJ0aWVzW2tleV0gKyAnKSAnXG4gICAgICBlbHNlIGNzc1ZhbHVlc1trZXldID0gcHJvcGVydGllc1trZXldLCBjc3NQcm9wZXJ0aWVzLnB1c2goZGFzaGVyaXplKGtleSkpXG5cbiAgICBpZiAodHJhbnNmb3JtcykgY3NzVmFsdWVzW3RyYW5zZm9ybV0gPSB0cmFuc2Zvcm1zLCBjc3NQcm9wZXJ0aWVzLnB1c2godHJhbnNmb3JtKVxuICAgIGlmIChkdXJhdGlvbiA+IDAgJiYgdHlwZW9mIHByb3BlcnRpZXMgPT09ICdvYmplY3QnKSB7XG4gICAgICBjc3NWYWx1ZXNbdHJhbnNpdGlvblByb3BlcnR5XSA9IGNzc1Byb3BlcnRpZXMuam9pbignLCAnKVxuICAgICAgY3NzVmFsdWVzW3RyYW5zaXRpb25EdXJhdGlvbl0gPSBkdXJhdGlvbiArICdzJ1xuICAgICAgY3NzVmFsdWVzW3RyYW5zaXRpb25EZWxheV0gPSBkZWxheSArICdzJ1xuICAgICAgY3NzVmFsdWVzW3RyYW5zaXRpb25UaW1pbmddID0gKGVhc2UgfHwgJ2xpbmVhcicpXG4gICAgfVxuICB9XG5cbiAgd3JhcHBlZENhbGxiYWNrID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgaWYgKHR5cGVvZiBldmVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGlmIChldmVudC50YXJnZXQgIT09IGV2ZW50LmN1cnJlbnRUYXJnZXQpIHJldHVybiAvLyBtYWtlcyBzdXJlIHRoZSBldmVudCBkaWRuJ3QgYnViYmxlIGZyb20gXCJiZWxvd1wiXG4gICAgICAkKGV2ZW50LnRhcmdldCkudW5iaW5kKGVuZEV2ZW50LCB3cmFwcGVkQ2FsbGJhY2spXG4gICAgfSBlbHNlXG4gICAgICAkKHRoaXMpLnVuYmluZChlbmRFdmVudCwgd3JhcHBlZENhbGxiYWNrKSAvLyB0cmlnZ2VyZWQgYnkgc2V0VGltZW91dFxuXG4gICAgZmlyZWQgPSB0cnVlXG4gICAgJCh0aGlzKS5jc3MoY3NzUmVzZXQpXG4gICAgY2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbCh0aGlzKVxuICB9XG4gIGlmIChkdXJhdGlvbiA+IDApIHtcbiAgICB0aGlzLmJpbmQoZW5kRXZlbnQsIHdyYXBwZWRDYWxsYmFjaylcbiAgICAvLyB0cmFuc2l0aW9uRW5kIGlzIG5vdCBhbHdheXMgZmlyaW5nIG9uIG9sZGVyIEFuZHJvaWQgcGhvbmVzXG4gICAgLy8gc28gbWFrZSBzdXJlIGl0IGdldHMgZmlyZWRcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChmaXJlZCkgcmV0dXJuXG4gICAgICB3cmFwcGVkQ2FsbGJhY2suY2FsbCh0aGF0KVxuICAgIH0sICgoZHVyYXRpb24gKyBkZWxheSkgKiAxMDAwKSArIDI1KVxuICB9XG5cbiAgLy8gdHJpZ2dlciBwYWdlIHJlZmxvdyBzbyBuZXcgZWxlbWVudHMgY2FuIGFuaW1hdGVcbiAgdGhpcy5zaXplKCkgJiYgdGhpcy5nZXQoMCkuY2xpZW50TGVmdFxuXG4gIHRoaXMuY3NzKGNzc1ZhbHVlcylcblxuICBpZiAoZHVyYXRpb24gPD0gMCkgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgdGhhdC5lYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgIHdyYXBwZWRDYWxsYmFjay5jYWxsKHRoaXMpXG4gICAgfSlcbiAgfSwgMClcblxuICByZXR1cm4gdGhpc1xufVxuXG50ZXN0RWwgPSBudWxsXG4iLCIvLyAgICAgWmVwdG8uanNcbi8vICAgICAoYykgMjAxMC0yMDE2IFRob21hcyBGdWNoc1xuLy8gICAgIFplcHRvLmpzIG1heSBiZSBmcmVlbHkgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuXG52YXIgJCA9IHJlcXVpcmUoJy4vemVwdG8nKTtcblxudmFyIGRvY3VtZW50ID0gd2luZG93LmRvY3VtZW50LCBkb2NFbGVtID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LFxuICBvcmlnU2hvdyA9ICQuZm4uc2hvdywgb3JpZ0hpZGUgPSAkLmZuLmhpZGUsIG9yaWdUb2dnbGUgPSAkLmZuLnRvZ2dsZVxuXG5mdW5jdGlvbiBhbmltKGVsLCBzcGVlZCwgb3BhY2l0eSwgc2NhbGUsIGNhbGxiYWNrKSB7XG4gIGlmICh0eXBlb2Ygc3BlZWQgPT0gJ2Z1bmN0aW9uJyAmJiAhY2FsbGJhY2spIGNhbGxiYWNrID0gc3BlZWQsIHNwZWVkID0gdW5kZWZpbmVkXG4gIHZhciBwcm9wcyA9IHtvcGFjaXR5OiBvcGFjaXR5fVxuICBpZiAoc2NhbGUpIHtcbiAgICBwcm9wcy5zY2FsZSA9IHNjYWxlXG4gICAgZWwuY3NzKCQuZnguY3NzUHJlZml4ICsgJ3RyYW5zZm9ybS1vcmlnaW4nLCAnMCAwJylcbiAgfVxuICByZXR1cm4gZWwuYW5pbWF0ZShwcm9wcywgc3BlZWQsIG51bGwsIGNhbGxiYWNrKVxufVxuXG5mdW5jdGlvbiBoaWRlKGVsLCBzcGVlZCwgc2NhbGUsIGNhbGxiYWNrKSB7XG4gIHJldHVybiBhbmltKGVsLCBzcGVlZCwgMCwgc2NhbGUsIGZ1bmN0aW9uICgpIHtcbiAgICBvcmlnSGlkZS5jYWxsKCQodGhpcykpXG4gICAgY2FsbGJhY2sgJiYgY2FsbGJhY2suY2FsbCh0aGlzKVxuICB9KVxufVxuXG4kLmZuLnNob3cgPSBmdW5jdGlvbiAoc3BlZWQsIGNhbGxiYWNrKSB7XG4gIG9yaWdTaG93LmNhbGwodGhpcylcbiAgaWYgKHNwZWVkID09PSB1bmRlZmluZWQpIHNwZWVkID0gMFxuICBlbHNlIHRoaXMuY3NzKCdvcGFjaXR5JywgMClcbiAgcmV0dXJuIGFuaW0odGhpcywgc3BlZWQsIDEsICcxLDEnLCBjYWxsYmFjaylcbn1cblxuJC5mbi5oaWRlID0gZnVuY3Rpb24gKHNwZWVkLCBjYWxsYmFjaykge1xuICBpZiAoc3BlZWQgPT09IHVuZGVmaW5lZCkgcmV0dXJuIG9yaWdIaWRlLmNhbGwodGhpcylcbiAgZWxzZSByZXR1cm4gaGlkZSh0aGlzLCBzcGVlZCwgJzAsMCcsIGNhbGxiYWNrKVxufVxuXG4kLmZuLnRvZ2dsZSA9IGZ1bmN0aW9uIChzcGVlZCwgY2FsbGJhY2spIHtcbiAgaWYgKHNwZWVkID09PSB1bmRlZmluZWQgfHwgdHlwZW9mIHNwZWVkID09ICdib29sZWFuJylcbiAgICByZXR1cm4gb3JpZ1RvZ2dsZS5jYWxsKHRoaXMsIHNwZWVkKVxuICBlbHNlIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xuICAgIHZhciBlbCA9ICQodGhpcylcbiAgICBlbFtlbC5jc3MoJ2Rpc3BsYXknKSA9PSAnbm9uZScgPyAnc2hvdycgOiAnaGlkZSddKHNwZWVkLCBjYWxsYmFjaylcbiAgfSlcbn1cblxuJC5mbi5mYWRlVG8gPSBmdW5jdGlvbiAoc3BlZWQsIG9wYWNpdHksIGNhbGxiYWNrKSB7XG4gIHJldHVybiBhbmltKHRoaXMsIHNwZWVkLCBvcGFjaXR5LCBudWxsLCBjYWxsYmFjaylcbn1cblxuJC5mbi5mYWRlSW4gPSBmdW5jdGlvbiAoc3BlZWQsIGNhbGxiYWNrKSB7XG4gIHZhciB0YXJnZXQgPSB0aGlzLmNzcygnb3BhY2l0eScpXG4gIGlmICh0YXJnZXQgPiAwKSB0aGlzLmNzcygnb3BhY2l0eScsIDApXG4gIGVsc2UgdGFyZ2V0ID0gMVxuICByZXR1cm4gb3JpZ1Nob3cuY2FsbCh0aGlzKS5mYWRlVG8oc3BlZWQsIHRhcmdldCwgY2FsbGJhY2spXG59XG5cbiQuZm4uZmFkZU91dCA9IGZ1bmN0aW9uIChzcGVlZCwgY2FsbGJhY2spIHtcbiAgcmV0dXJuIGhpZGUodGhpcywgc3BlZWQsIG51bGwsIGNhbGxiYWNrKVxufVxuXG4kLmZuLmZhZGVUb2dnbGUgPSBmdW5jdGlvbiAoc3BlZWQsIGNhbGxiYWNrKSB7XG4gIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xuICAgIHZhciBlbCA9ICQodGhpcylcbiAgICBlbFtcbiAgICAgIChlbC5jc3MoJ29wYWNpdHknKSA9PSAwIHx8IGVsLmNzcygnZGlzcGxheScpID09ICdub25lJykgPyAnZmFkZUluJyA6ICdmYWRlT3V0J1xuICAgICAgXShzcGVlZCwgY2FsbGJhY2spXG4gIH0pXG59XG4iLCIvLyAgICAgWmVwdG8uanNcbi8vICAgICAoYykgMjAxMC0yMDE2IFRob21hcyBGdWNoc1xuLy8gICAgIFplcHRvLmpzIG1heSBiZSBmcmVlbHkgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuXG52YXIgWmVwdG8gPSAoZnVuY3Rpb24gKCkge1xuICB2YXIgdW5kZWZpbmVkLCBrZXksICQsIGNsYXNzTGlzdCwgZW1wdHlBcnJheSA9IFtdLCBjb25jYXQgPSBlbXB0eUFycmF5LmNvbmNhdCwgZmlsdGVyID0gZW1wdHlBcnJheS5maWx0ZXIsIHNsaWNlID0gZW1wdHlBcnJheS5zbGljZSxcbiAgICBkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudCxcbiAgICBlbGVtZW50RGlzcGxheSA9IHt9LCBjbGFzc0NhY2hlID0ge30sXG4gICAgY3NzTnVtYmVyID0ge1xuICAgICAgJ2NvbHVtbi1jb3VudCc6IDEsXG4gICAgICAnY29sdW1ucyc6IDEsXG4gICAgICAnZm9udC13ZWlnaHQnOiAxLFxuICAgICAgJ2xpbmUtaGVpZ2h0JzogMSxcbiAgICAgICdvcGFjaXR5JzogMSxcbiAgICAgICd6LWluZGV4JzogMSxcbiAgICAgICd6b29tJzogMVxuICAgIH0sXG4gICAgZnJhZ21lbnRSRSA9IC9eXFxzKjwoXFx3K3whKVtePl0qPi8sXG4gICAgc2luZ2xlVGFnUkUgPSAvXjwoXFx3KylcXHMqXFwvPz4oPzo8XFwvXFwxPnwpJC8sXG4gICAgdGFnRXhwYW5kZXJSRSA9IC88KD8hYXJlYXxicnxjb2x8ZW1iZWR8aHJ8aW1nfGlucHV0fGxpbmt8bWV0YXxwYXJhbSkoKFtcXHc6XSspW14+XSopXFwvPi9pZyxcbiAgICByb290Tm9kZVJFID0gL14oPzpib2R5fGh0bWwpJC9pLFxuICAgIGNhcGl0YWxSRSA9IC8oW0EtWl0pL2csXG5cbiAgLy8gc3BlY2lhbCBhdHRyaWJ1dGVzIHRoYXQgc2hvdWxkIGJlIGdldC9zZXQgdmlhIG1ldGhvZCBjYWxsc1xuICAgIG1ldGhvZEF0dHJpYnV0ZXMgPSBbJ3ZhbCcsICdjc3MnLCAnaHRtbCcsICd0ZXh0JywgJ2RhdGEnLCAnd2lkdGgnLCAnaGVpZ2h0JywgJ29mZnNldCddLFxuXG4gICAgYWRqYWNlbmN5T3BlcmF0b3JzID0gWydhZnRlcicsICdwcmVwZW5kJywgJ2JlZm9yZScsICdhcHBlbmQnXSxcbiAgICB0YWJsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RhYmxlJyksXG4gICAgdGFibGVSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0cicpLFxuICAgIGNvbnRhaW5lcnMgPSB7XG4gICAgICAndHInOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0Ym9keScpLFxuICAgICAgJ3Rib2R5JzogdGFibGUsICd0aGVhZCc6IHRhYmxlLCAndGZvb3QnOiB0YWJsZSxcbiAgICAgICd0ZCc6IHRhYmxlUm93LCAndGgnOiB0YWJsZVJvdyxcbiAgICAgICcqJzogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgICB9LFxuICAgIHJlYWR5UkUgPSAvY29tcGxldGV8bG9hZGVkfGludGVyYWN0aXZlLyxcbiAgICBzaW1wbGVTZWxlY3RvclJFID0gL15bXFx3LV0qJC8sXG4gICAgY2xhc3MydHlwZSA9IHt9LFxuICAgIHRvU3RyaW5nID0gY2xhc3MydHlwZS50b1N0cmluZyxcbiAgICB6ZXB0byA9IHt9LFxuICAgIGNhbWVsaXplLCB1bmlxLFxuICAgIHRlbXBQYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcbiAgICBwcm9wTWFwID0ge1xuICAgICAgJ3RhYmluZGV4JzogJ3RhYkluZGV4JyxcbiAgICAgICdyZWFkb25seSc6ICdyZWFkT25seScsXG4gICAgICAnZm9yJzogJ2h0bWxGb3InLFxuICAgICAgJ2NsYXNzJzogJ2NsYXNzTmFtZScsXG4gICAgICAnbWF4bGVuZ3RoJzogJ21heExlbmd0aCcsXG4gICAgICAnY2VsbHNwYWNpbmcnOiAnY2VsbFNwYWNpbmcnLFxuICAgICAgJ2NlbGxwYWRkaW5nJzogJ2NlbGxQYWRkaW5nJyxcbiAgICAgICdyb3dzcGFuJzogJ3Jvd1NwYW4nLFxuICAgICAgJ2NvbHNwYW4nOiAnY29sU3BhbicsXG4gICAgICAndXNlbWFwJzogJ3VzZU1hcCcsXG4gICAgICAnZnJhbWVib3JkZXInOiAnZnJhbWVCb3JkZXInLFxuICAgICAgJ2NvbnRlbnRlZGl0YWJsZSc6ICdjb250ZW50RWRpdGFibGUnXG4gICAgfSxcbiAgICBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fFxuICAgICAgZnVuY3Rpb24gKG9iamVjdCkge1xuICAgICAgICByZXR1cm4gb2JqZWN0IGluc3RhbmNlb2YgQXJyYXlcbiAgICAgIH1cblxuICB6ZXB0by5tYXRjaGVzID0gZnVuY3Rpb24gKGVsZW1lbnQsIHNlbGVjdG9yKSB7XG4gICAgaWYgKCFzZWxlY3RvciB8fCAhZWxlbWVudCB8fCBlbGVtZW50Lm5vZGVUeXBlICE9PSAxKSByZXR1cm4gZmFsc2VcbiAgICB2YXIgbWF0Y2hlc1NlbGVjdG9yID0gZWxlbWVudC53ZWJraXRNYXRjaGVzU2VsZWN0b3IgfHwgZWxlbWVudC5tb3pNYXRjaGVzU2VsZWN0b3IgfHxcbiAgICAgIGVsZW1lbnQub01hdGNoZXNTZWxlY3RvciB8fCBlbGVtZW50Lm1hdGNoZXNTZWxlY3RvclxuICAgIGlmIChtYXRjaGVzU2VsZWN0b3IpIHJldHVybiBtYXRjaGVzU2VsZWN0b3IuY2FsbChlbGVtZW50LCBzZWxlY3RvcilcbiAgICAvLyBmYWxsIGJhY2sgdG8gcGVyZm9ybWluZyBhIHNlbGVjdG9yOlxuICAgIHZhciBtYXRjaCwgcGFyZW50ID0gZWxlbWVudC5wYXJlbnROb2RlLCB0ZW1wID0gIXBhcmVudFxuICAgIGlmICh0ZW1wKSAocGFyZW50ID0gdGVtcFBhcmVudCkuYXBwZW5kQ2hpbGQoZWxlbWVudClcbiAgICBtYXRjaCA9IH56ZXB0by5xc2EocGFyZW50LCBzZWxlY3RvcikuaW5kZXhPZihlbGVtZW50KVxuICAgIHRlbXAgJiYgdGVtcFBhcmVudC5yZW1vdmVDaGlsZChlbGVtZW50KVxuICAgIHJldHVybiBtYXRjaFxuICB9XG5cbiAgZnVuY3Rpb24gdHlwZShvYmopIHtcbiAgICByZXR1cm4gb2JqID09IG51bGwgPyBTdHJpbmcob2JqKSA6XG4gICAgY2xhc3MydHlwZVt0b1N0cmluZy5jYWxsKG9iaildIHx8IFwib2JqZWN0XCJcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZSh2YWx1ZSkgPT0gXCJmdW5jdGlvblwiXG4gIH1cblxuICBmdW5jdGlvbiBpc1dpbmRvdyhvYmopIHtcbiAgICByZXR1cm4gb2JqICE9IG51bGwgJiYgb2JqID09IG9iai53aW5kb3dcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzRG9jdW1lbnQob2JqKSB7XG4gICAgcmV0dXJuIG9iaiAhPSBudWxsICYmIG9iai5ub2RlVHlwZSA9PSBvYmouRE9DVU1FTlRfTk9ERVxuICB9XG5cbiAgZnVuY3Rpb24gaXNPYmplY3Qob2JqKSB7XG4gICAgcmV0dXJuIHR5cGUob2JqKSA9PSBcIm9iamVjdFwiXG4gIH1cblxuICBmdW5jdGlvbiBpc1BsYWluT2JqZWN0KG9iaikge1xuICAgIHJldHVybiBpc09iamVjdChvYmopICYmICFpc1dpbmRvdyhvYmopICYmIE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmopID09IE9iamVjdC5wcm90b3R5cGVcbiAgfVxuXG4gIGZ1bmN0aW9uIGxpa2VBcnJheShvYmopIHtcbiAgICByZXR1cm4gdHlwZW9mIG9iai5sZW5ndGggPT0gJ251bWJlcidcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbXBhY3QoYXJyYXkpIHtcbiAgICByZXR1cm4gZmlsdGVyLmNhbGwoYXJyYXksIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbSAhPSBudWxsXG4gICAgfSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGZsYXR0ZW4oYXJyYXkpIHtcbiAgICByZXR1cm4gYXJyYXkubGVuZ3RoID4gMCA/ICQuZm4uY29uY2F0LmFwcGx5KFtdLCBhcnJheSkgOiBhcnJheVxuICB9XG5cbiAgY2FtZWxpemUgPSBmdW5jdGlvbiAoc3RyKSB7XG4gICAgcmV0dXJuIHN0ci5yZXBsYWNlKC8tKyguKT8vZywgZnVuY3Rpb24gKG1hdGNoLCBjaHIpIHtcbiAgICAgIHJldHVybiBjaHIgPyBjaHIudG9VcHBlckNhc2UoKSA6ICcnXG4gICAgfSlcbiAgfVxuICBmdW5jdGlvbiBkYXNoZXJpemUoc3RyKSB7XG4gICAgcmV0dXJuIHN0ci5yZXBsYWNlKC86Oi9nLCAnLycpXG4gICAgICAucmVwbGFjZSgvKFtBLVpdKykoW0EtWl1bYS16XSkvZywgJyQxXyQyJylcbiAgICAgIC5yZXBsYWNlKC8oW2EtelxcZF0pKFtBLVpdKS9nLCAnJDFfJDInKVxuICAgICAgLnJlcGxhY2UoL18vZywgJy0nKVxuICAgICAgLnRvTG93ZXJDYXNlKClcbiAgfVxuXG4gIHVuaXEgPSBmdW5jdGlvbiAoYXJyYXkpIHtcbiAgICByZXR1cm4gZmlsdGVyLmNhbGwoYXJyYXksIGZ1bmN0aW9uIChpdGVtLCBpZHgpIHtcbiAgICAgIHJldHVybiBhcnJheS5pbmRleE9mKGl0ZW0pID09IGlkeFxuICAgIH0pXG4gIH1cblxuICBmdW5jdGlvbiBjbGFzc1JFKG5hbWUpIHtcbiAgICByZXR1cm4gbmFtZSBpbiBjbGFzc0NhY2hlID9cbiAgICAgIGNsYXNzQ2FjaGVbbmFtZV0gOiAoY2xhc3NDYWNoZVtuYW1lXSA9IG5ldyBSZWdFeHAoJyhefFxcXFxzKScgKyBuYW1lICsgJyhcXFxcc3wkKScpKVxuICB9XG5cbiAgZnVuY3Rpb24gbWF5YmVBZGRQeChuYW1lLCB2YWx1ZSkge1xuICAgIHJldHVybiAodHlwZW9mIHZhbHVlID09IFwibnVtYmVyXCIgJiYgIWNzc051bWJlcltkYXNoZXJpemUobmFtZSldKSA/IHZhbHVlICsgXCJweFwiIDogdmFsdWVcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZmF1bHREaXNwbGF5KG5vZGVOYW1lKSB7XG4gICAgdmFyIGVsZW1lbnQsIGRpc3BsYXlcbiAgICBpZiAoIWVsZW1lbnREaXNwbGF5W25vZGVOYW1lXSkge1xuICAgICAgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQobm9kZU5hbWUpXG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGVsZW1lbnQpXG4gICAgICBkaXNwbGF5ID0gZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50LCAnJykuZ2V0UHJvcGVydHlWYWx1ZShcImRpc3BsYXlcIilcbiAgICAgIGVsZW1lbnQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChlbGVtZW50KVxuICAgICAgZGlzcGxheSA9PSBcIm5vbmVcIiAmJiAoZGlzcGxheSA9IFwiYmxvY2tcIilcbiAgICAgIGVsZW1lbnREaXNwbGF5W25vZGVOYW1lXSA9IGRpc3BsYXlcbiAgICB9XG4gICAgcmV0dXJuIGVsZW1lbnREaXNwbGF5W25vZGVOYW1lXVxuICB9XG5cbiAgZnVuY3Rpb24gY2hpbGRyZW4oZWxlbWVudCkge1xuICAgIHJldHVybiAnY2hpbGRyZW4nIGluIGVsZW1lbnQgP1xuICAgICAgc2xpY2UuY2FsbChlbGVtZW50LmNoaWxkcmVuKSA6XG4gICAgICAkLm1hcChlbGVtZW50LmNoaWxkTm9kZXMsIGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgIGlmIChub2RlLm5vZGVUeXBlID09IDEpIHJldHVybiBub2RlXG4gICAgICB9KVxuICB9XG5cbiAgZnVuY3Rpb24gWihkb20sIHNlbGVjdG9yKSB7XG4gICAgdmFyIGksIGxlbiA9IGRvbSA/IGRvbS5sZW5ndGggOiAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB0aGlzW2ldID0gZG9tW2ldXG4gICAgdGhpcy5sZW5ndGggPSBsZW5cbiAgICB0aGlzLnNlbGVjdG9yID0gc2VsZWN0b3IgfHwgJydcbiAgfVxuXG4gIC8vIGAkLnplcHRvLmZyYWdtZW50YCB0YWtlcyBhIGh0bWwgc3RyaW5nIGFuZCBhbiBvcHRpb25hbCB0YWcgbmFtZVxuICAvLyB0byBnZW5lcmF0ZSBET00gbm9kZXMgZnJvbSB0aGUgZ2l2ZW4gaHRtbCBzdHJpbmcuXG4gIC8vIFRoZSBnZW5lcmF0ZWQgRE9NIG5vZGVzIGFyZSByZXR1cm5lZCBhcyBhbiBhcnJheS5cbiAgLy8gVGhpcyBmdW5jdGlvbiBjYW4gYmUgb3ZlcnJpZGRlbiBpbiBwbHVnaW5zIGZvciBleGFtcGxlIHRvIG1ha2VcbiAgLy8gaXQgY29tcGF0aWJsZSB3aXRoIGJyb3dzZXJzIHRoYXQgZG9uJ3Qgc3VwcG9ydCB0aGUgRE9NIGZ1bGx5LlxuICB6ZXB0by5mcmFnbWVudCA9IGZ1bmN0aW9uIChodG1sLCBuYW1lLCBwcm9wZXJ0aWVzKSB7XG4gICAgdmFyIGRvbSwgbm9kZXMsIGNvbnRhaW5lclxuXG4gICAgLy8gQSBzcGVjaWFsIGNhc2Ugb3B0aW1pemF0aW9uIGZvciBhIHNpbmdsZSB0YWdcbiAgICBpZiAoc2luZ2xlVGFnUkUudGVzdChodG1sKSkgZG9tID0gJChkb2N1bWVudC5jcmVhdGVFbGVtZW50KFJlZ0V4cC4kMSkpXG5cbiAgICBpZiAoIWRvbSkge1xuICAgICAgaWYgKGh0bWwucmVwbGFjZSkgaHRtbCA9IGh0bWwucmVwbGFjZSh0YWdFeHBhbmRlclJFLCBcIjwkMT48LyQyPlwiKVxuICAgICAgaWYgKG5hbWUgPT09IHVuZGVmaW5lZCkgbmFtZSA9IGZyYWdtZW50UkUudGVzdChodG1sKSAmJiBSZWdFeHAuJDFcbiAgICAgIGlmICghKG5hbWUgaW4gY29udGFpbmVycykpIG5hbWUgPSAnKidcblxuICAgICAgY29udGFpbmVyID0gY29udGFpbmVyc1tuYW1lXVxuICAgICAgY29udGFpbmVyLmlubmVySFRNTCA9ICcnICsgaHRtbFxuICAgICAgZG9tID0gJC5lYWNoKHNsaWNlLmNhbGwoY29udGFpbmVyLmNoaWxkTm9kZXMpLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZCh0aGlzKVxuICAgICAgfSlcbiAgICB9XG5cbiAgICBpZiAoaXNQbGFpbk9iamVjdChwcm9wZXJ0aWVzKSkge1xuICAgICAgbm9kZXMgPSAkKGRvbSlcbiAgICAgICQuZWFjaChwcm9wZXJ0aWVzLCBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgICBpZiAobWV0aG9kQXR0cmlidXRlcy5pbmRleE9mKGtleSkgPiAtMSkgbm9kZXNba2V5XSh2YWx1ZSlcbiAgICAgICAgZWxzZSBub2Rlcy5hdHRyKGtleSwgdmFsdWUpXG4gICAgICB9KVxuICAgIH1cblxuICAgIHJldHVybiBkb21cbiAgfVxuXG4gIC8vIGAkLnplcHRvLlpgIHN3YXBzIG91dCB0aGUgcHJvdG90eXBlIG9mIHRoZSBnaXZlbiBgZG9tYCBhcnJheVxuICAvLyBvZiBub2RlcyB3aXRoIGAkLmZuYCBhbmQgdGh1cyBzdXBwbHlpbmcgYWxsIHRoZSBaZXB0byBmdW5jdGlvbnNcbiAgLy8gdG8gdGhlIGFycmF5LiBUaGlzIG1ldGhvZCBjYW4gYmUgb3ZlcnJpZGRlbiBpbiBwbHVnaW5zLlxuICB6ZXB0by5aID0gZnVuY3Rpb24gKGRvbSwgc2VsZWN0b3IpIHtcbiAgICByZXR1cm4gbmV3IFooZG9tLCBzZWxlY3RvcilcbiAgfVxuXG4gIC8vIGAkLnplcHRvLmlzWmAgc2hvdWxkIHJldHVybiBgdHJ1ZWAgaWYgdGhlIGdpdmVuIG9iamVjdCBpcyBhIFplcHRvXG4gIC8vIGNvbGxlY3Rpb24uIFRoaXMgbWV0aG9kIGNhbiBiZSBvdmVycmlkZGVuIGluIHBsdWdpbnMuXG4gIHplcHRvLmlzWiA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICByZXR1cm4gb2JqZWN0IGluc3RhbmNlb2YgemVwdG8uWlxuICB9XG5cbiAgLy8gYCQuemVwdG8uaW5pdGAgaXMgWmVwdG8ncyBjb3VudGVycGFydCB0byBqUXVlcnkncyBgJC5mbi5pbml0YCBhbmRcbiAgLy8gdGFrZXMgYSBDU1Mgc2VsZWN0b3IgYW5kIGFuIG9wdGlvbmFsIGNvbnRleHQgKGFuZCBoYW5kbGVzIHZhcmlvdXNcbiAgLy8gc3BlY2lhbCBjYXNlcykuXG4gIC8vIFRoaXMgbWV0aG9kIGNhbiBiZSBvdmVycmlkZGVuIGluIHBsdWdpbnMuXG4gIHplcHRvLmluaXQgPSBmdW5jdGlvbiAoc2VsZWN0b3IsIGNvbnRleHQpIHtcbiAgICB2YXIgZG9tXG4gICAgLy8gSWYgbm90aGluZyBnaXZlbiwgcmV0dXJuIGFuIGVtcHR5IFplcHRvIGNvbGxlY3Rpb25cbiAgICBpZiAoIXNlbGVjdG9yKSByZXR1cm4gemVwdG8uWigpXG4gICAgLy8gT3B0aW1pemUgZm9yIHN0cmluZyBzZWxlY3RvcnNcbiAgICBlbHNlIGlmICh0eXBlb2Ygc2VsZWN0b3IgPT0gJ3N0cmluZycpIHtcbiAgICAgIHNlbGVjdG9yID0gc2VsZWN0b3IudHJpbSgpXG4gICAgICAvLyBJZiBpdCdzIGEgaHRtbCBmcmFnbWVudCwgY3JlYXRlIG5vZGVzIGZyb20gaXRcbiAgICAgIC8vIE5vdGU6IEluIGJvdGggQ2hyb21lIDIxIGFuZCBGaXJlZm94IDE1LCBET00gZXJyb3IgMTJcbiAgICAgIC8vIGlzIHRocm93biBpZiB0aGUgZnJhZ21lbnQgZG9lc24ndCBiZWdpbiB3aXRoIDxcbiAgICAgIGlmIChzZWxlY3RvclswXSA9PSAnPCcgJiYgZnJhZ21lbnRSRS50ZXN0KHNlbGVjdG9yKSlcbiAgICAgICAgZG9tID0gemVwdG8uZnJhZ21lbnQoc2VsZWN0b3IsIFJlZ0V4cC4kMSwgY29udGV4dCksIHNlbGVjdG9yID0gbnVsbFxuICAgICAgLy8gSWYgdGhlcmUncyBhIGNvbnRleHQsIGNyZWF0ZSBhIGNvbGxlY3Rpb24gb24gdGhhdCBjb250ZXh0IGZpcnN0LCBhbmQgc2VsZWN0XG4gICAgICAvLyBub2RlcyBmcm9tIHRoZXJlXG4gICAgICBlbHNlIGlmIChjb250ZXh0ICE9PSB1bmRlZmluZWQpIHJldHVybiAkKGNvbnRleHQpLmZpbmQoc2VsZWN0b3IpXG4gICAgICAvLyBJZiBpdCdzIGEgQ1NTIHNlbGVjdG9yLCB1c2UgaXQgdG8gc2VsZWN0IG5vZGVzLlxuICAgICAgZWxzZSBkb20gPSB6ZXB0by5xc2EoZG9jdW1lbnQsIHNlbGVjdG9yKVxuICAgIH1cbiAgICAvLyBJZiBhIGZ1bmN0aW9uIGlzIGdpdmVuLCBjYWxsIGl0IHdoZW4gdGhlIERPTSBpcyByZWFkeVxuICAgIGVsc2UgaWYgKGlzRnVuY3Rpb24oc2VsZWN0b3IpKSByZXR1cm4gJChkb2N1bWVudCkucmVhZHkoc2VsZWN0b3IpXG4gICAgLy8gSWYgYSBaZXB0byBjb2xsZWN0aW9uIGlzIGdpdmVuLCBqdXN0IHJldHVybiBpdFxuICAgIGVsc2UgaWYgKHplcHRvLmlzWihzZWxlY3RvcikpIHJldHVybiBzZWxlY3RvclxuICAgIGVsc2Uge1xuICAgICAgLy8gbm9ybWFsaXplIGFycmF5IGlmIGFuIGFycmF5IG9mIG5vZGVzIGlzIGdpdmVuXG4gICAgICBpZiAoaXNBcnJheShzZWxlY3RvcikpIGRvbSA9IGNvbXBhY3Qoc2VsZWN0b3IpXG4gICAgICAvLyBXcmFwIERPTSBub2Rlcy5cbiAgICAgIGVsc2UgaWYgKGlzT2JqZWN0KHNlbGVjdG9yKSlcbiAgICAgICAgZG9tID0gW3NlbGVjdG9yXSwgc2VsZWN0b3IgPSBudWxsXG4gICAgICAvLyBJZiBpdCdzIGEgaHRtbCBmcmFnbWVudCwgY3JlYXRlIG5vZGVzIGZyb20gaXRcbiAgICAgIGVsc2UgaWYgKGZyYWdtZW50UkUudGVzdChzZWxlY3RvcikpXG4gICAgICAgIGRvbSA9IHplcHRvLmZyYWdtZW50KHNlbGVjdG9yLnRyaW0oKSwgUmVnRXhwLiQxLCBjb250ZXh0KSwgc2VsZWN0b3IgPSBudWxsXG4gICAgICAvLyBJZiB0aGVyZSdzIGEgY29udGV4dCwgY3JlYXRlIGEgY29sbGVjdGlvbiBvbiB0aGF0IGNvbnRleHQgZmlyc3QsIGFuZCBzZWxlY3RcbiAgICAgIC8vIG5vZGVzIGZyb20gdGhlcmVcbiAgICAgIGVsc2UgaWYgKGNvbnRleHQgIT09IHVuZGVmaW5lZCkgcmV0dXJuICQoY29udGV4dCkuZmluZChzZWxlY3RvcilcbiAgICAgIC8vIEFuZCBsYXN0IGJ1dCBubyBsZWFzdCwgaWYgaXQncyBhIENTUyBzZWxlY3RvciwgdXNlIGl0IHRvIHNlbGVjdCBub2Rlcy5cbiAgICAgIGVsc2UgZG9tID0gemVwdG8ucXNhKGRvY3VtZW50LCBzZWxlY3RvcilcbiAgICB9XG4gICAgLy8gY3JlYXRlIGEgbmV3IFplcHRvIGNvbGxlY3Rpb24gZnJvbSB0aGUgbm9kZXMgZm91bmRcbiAgICByZXR1cm4gemVwdG8uWihkb20sIHNlbGVjdG9yKVxuICB9XG5cbiAgLy8gYCRgIHdpbGwgYmUgdGhlIGJhc2UgYFplcHRvYCBvYmplY3QuIFdoZW4gY2FsbGluZyB0aGlzXG4gIC8vIGZ1bmN0aW9uIGp1c3QgY2FsbCBgJC56ZXB0by5pbml0LCB3aGljaCBtYWtlcyB0aGUgaW1wbGVtZW50YXRpb25cbiAgLy8gZGV0YWlscyBvZiBzZWxlY3Rpbmcgbm9kZXMgYW5kIGNyZWF0aW5nIFplcHRvIGNvbGxlY3Rpb25zXG4gIC8vIHBhdGNoYWJsZSBpbiBwbHVnaW5zLlxuICAkID0gZnVuY3Rpb24gKHNlbGVjdG9yLCBjb250ZXh0KSB7XG4gICAgcmV0dXJuIHplcHRvLmluaXQoc2VsZWN0b3IsIGNvbnRleHQpXG4gIH1cblxuICBmdW5jdGlvbiBleHRlbmQodGFyZ2V0LCBzb3VyY2UsIGRlZXApIHtcbiAgICBmb3IgKGtleSBpbiBzb3VyY2UpXG4gICAgICBpZiAoZGVlcCAmJiAoaXNQbGFpbk9iamVjdChzb3VyY2Vba2V5XSkgfHwgaXNBcnJheShzb3VyY2Vba2V5XSkpKSB7XG4gICAgICAgIGlmIChpc1BsYWluT2JqZWN0KHNvdXJjZVtrZXldKSAmJiAhaXNQbGFpbk9iamVjdCh0YXJnZXRba2V5XSkpXG4gICAgICAgICAgdGFyZ2V0W2tleV0gPSB7fVxuICAgICAgICBpZiAoaXNBcnJheShzb3VyY2Vba2V5XSkgJiYgIWlzQXJyYXkodGFyZ2V0W2tleV0pKVxuICAgICAgICAgIHRhcmdldFtrZXldID0gW11cbiAgICAgICAgZXh0ZW5kKHRhcmdldFtrZXldLCBzb3VyY2Vba2V5XSwgZGVlcClcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKHNvdXJjZVtrZXldICE9PSB1bmRlZmluZWQpIHRhcmdldFtrZXldID0gc291cmNlW2tleV1cbiAgfVxuXG4gIC8vIENvcHkgYWxsIGJ1dCB1bmRlZmluZWQgcHJvcGVydGllcyBmcm9tIG9uZSBvciBtb3JlXG4gIC8vIG9iamVjdHMgdG8gdGhlIGB0YXJnZXRgIG9iamVjdC5cbiAgJC5leHRlbmQgPSBmdW5jdGlvbiAodGFyZ2V0KSB7XG4gICAgdmFyIGRlZXAsIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSlcbiAgICBpZiAodHlwZW9mIHRhcmdldCA9PSAnYm9vbGVhbicpIHtcbiAgICAgIGRlZXAgPSB0YXJnZXRcbiAgICAgIHRhcmdldCA9IGFyZ3Muc2hpZnQoKVxuICAgIH1cbiAgICBhcmdzLmZvckVhY2goZnVuY3Rpb24gKGFyZykge1xuICAgICAgZXh0ZW5kKHRhcmdldCwgYXJnLCBkZWVwKVxuICAgIH0pXG4gICAgcmV0dXJuIHRhcmdldFxuICB9XG5cbiAgLy8gYCQuemVwdG8ucXNhYCBpcyBaZXB0bydzIENTUyBzZWxlY3RvciBpbXBsZW1lbnRhdGlvbiB3aGljaFxuICAvLyB1c2VzIGBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsYCBhbmQgb3B0aW1pemVzIGZvciBzb21lIHNwZWNpYWwgY2FzZXMsIGxpa2UgYCNpZGAuXG4gIC8vIFRoaXMgbWV0aG9kIGNhbiBiZSBvdmVycmlkZGVuIGluIHBsdWdpbnMuXG4gIHplcHRvLnFzYSA9IGZ1bmN0aW9uIChlbGVtZW50LCBzZWxlY3Rvcikge1xuICAgIHZhciBmb3VuZCxcbiAgICAgIG1heWJlSUQgPSBzZWxlY3RvclswXSA9PSAnIycsXG4gICAgICBtYXliZUNsYXNzID0gIW1heWJlSUQgJiYgc2VsZWN0b3JbMF0gPT0gJy4nLFxuICAgICAgbmFtZU9ubHkgPSBtYXliZUlEIHx8IG1heWJlQ2xhc3MgPyBzZWxlY3Rvci5zbGljZSgxKSA6IHNlbGVjdG9yLCAvLyBFbnN1cmUgdGhhdCBhIDEgY2hhciB0YWcgbmFtZSBzdGlsbCBnZXRzIGNoZWNrZWRcbiAgICAgIGlzU2ltcGxlID0gc2ltcGxlU2VsZWN0b3JSRS50ZXN0KG5hbWVPbmx5KVxuICAgIHJldHVybiAoZWxlbWVudC5nZXRFbGVtZW50QnlJZCAmJiBpc1NpbXBsZSAmJiBtYXliZUlEKSA/IC8vIFNhZmFyaSBEb2N1bWVudEZyYWdtZW50IGRvZXNuJ3QgaGF2ZSBnZXRFbGVtZW50QnlJZFxuICAgICAgKCAoZm91bmQgPSBlbGVtZW50LmdldEVsZW1lbnRCeUlkKG5hbWVPbmx5KSkgPyBbZm91bmRdIDogW10gKSA6XG4gICAgICAoZWxlbWVudC5ub2RlVHlwZSAhPT0gMSAmJiBlbGVtZW50Lm5vZGVUeXBlICE9PSA5ICYmIGVsZW1lbnQubm9kZVR5cGUgIT09IDExKSA/IFtdIDpcbiAgICAgICAgc2xpY2UuY2FsbChcbiAgICAgICAgICBpc1NpbXBsZSAmJiAhbWF5YmVJRCAmJiBlbGVtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUgPyAvLyBEb2N1bWVudEZyYWdtZW50IGRvZXNuJ3QgaGF2ZSBnZXRFbGVtZW50c0J5Q2xhc3NOYW1lL1RhZ05hbWVcbiAgICAgICAgICAgIG1heWJlQ2xhc3MgPyBlbGVtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUobmFtZU9ubHkpIDogLy8gSWYgaXQncyBzaW1wbGUsIGl0IGNvdWxkIGJlIGEgY2xhc3NcbiAgICAgICAgICAgICAgZWxlbWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZShzZWxlY3RvcikgOiAvLyBPciBhIHRhZ1xuICAgICAgICAgICAgZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKSAvLyBPciBpdCdzIG5vdCBzaW1wbGUsIGFuZCB3ZSBuZWVkIHRvIHF1ZXJ5IGFsbFxuICAgICAgICApXG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJlZChub2Rlcywgc2VsZWN0b3IpIHtcbiAgICByZXR1cm4gc2VsZWN0b3IgPT0gbnVsbCA/ICQobm9kZXMpIDogJChub2RlcykuZmlsdGVyKHNlbGVjdG9yKVxuICB9XG5cbiAgJC5jb250YWlucyA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyA/XG4gICAgZnVuY3Rpb24gKHBhcmVudCwgbm9kZSkge1xuICAgICAgcmV0dXJuIHBhcmVudCAhPT0gbm9kZSAmJiBwYXJlbnQuY29udGFpbnMobm9kZSlcbiAgICB9IDpcbiAgICBmdW5jdGlvbiAocGFyZW50LCBub2RlKSB7XG4gICAgICB3aGlsZSAobm9kZSAmJiAobm9kZSA9IG5vZGUucGFyZW50Tm9kZSkpXG4gICAgICAgIGlmIChub2RlID09PSBwYXJlbnQpIHJldHVybiB0cnVlXG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG5cbiAgZnVuY3Rpb24gZnVuY0FyZyhjb250ZXh0LCBhcmcsIGlkeCwgcGF5bG9hZCkge1xuICAgIHJldHVybiBpc0Z1bmN0aW9uKGFyZykgPyBhcmcuY2FsbChjb250ZXh0LCBpZHgsIHBheWxvYWQpIDogYXJnXG4gIH1cblxuICBmdW5jdGlvbiBzZXRBdHRyaWJ1dGUobm9kZSwgbmFtZSwgdmFsdWUpIHtcbiAgICB2YWx1ZSA9PSBudWxsID8gbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSkgOiBub2RlLnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSlcbiAgfVxuXG4gIC8vIGFjY2VzcyBjbGFzc05hbWUgcHJvcGVydHkgd2hpbGUgcmVzcGVjdGluZyBTVkdBbmltYXRlZFN0cmluZ1xuICBmdW5jdGlvbiBjbGFzc05hbWUobm9kZSwgdmFsdWUpIHtcbiAgICB2YXIga2xhc3MgPSBub2RlLmNsYXNzTmFtZSB8fCAnJyxcbiAgICAgIHN2ZyA9IGtsYXNzICYmIGtsYXNzLmJhc2VWYWwgIT09IHVuZGVmaW5lZFxuXG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybiBzdmcgPyBrbGFzcy5iYXNlVmFsIDoga2xhc3NcbiAgICBzdmcgPyAoa2xhc3MuYmFzZVZhbCA9IHZhbHVlKSA6IChub2RlLmNsYXNzTmFtZSA9IHZhbHVlKVxuICB9XG5cbiAgLy8gXCJ0cnVlXCIgID0+IHRydWVcbiAgLy8gXCJmYWxzZVwiID0+IGZhbHNlXG4gIC8vIFwibnVsbFwiICA9PiBudWxsXG4gIC8vIFwiNDJcIiAgICA9PiA0MlxuICAvLyBcIjQyLjVcIiAgPT4gNDIuNVxuICAvLyBcIjA4XCIgICAgPT4gXCIwOFwiXG4gIC8vIEpTT04gICAgPT4gcGFyc2UgaWYgdmFsaWRcbiAgLy8gU3RyaW5nICA9PiBzZWxmXG4gIGZ1bmN0aW9uIGRlc2VyaWFsaXplVmFsdWUodmFsdWUpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIHZhbHVlID9cbiAgICAgIHZhbHVlID09IFwidHJ1ZVwiIHx8XG4gICAgICAoIHZhbHVlID09IFwiZmFsc2VcIiA/IGZhbHNlIDpcbiAgICAgICAgdmFsdWUgPT0gXCJudWxsXCIgPyBudWxsIDpcbiAgICAgICAgICArdmFsdWUgKyBcIlwiID09IHZhbHVlID8gK3ZhbHVlIDpcbiAgICAgICAgICAgIC9eW1xcW1xce10vLnRlc3QodmFsdWUpID8gJC5wYXJzZUpTT04odmFsdWUpIDpcbiAgICAgICAgICAgICAgdmFsdWUgKVxuICAgICAgICA6IHZhbHVlXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIHZhbHVlXG4gICAgfVxuICB9XG5cbiAgJC50eXBlID0gdHlwZVxuICAkLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uXG4gICQuaXNXaW5kb3cgPSBpc1dpbmRvd1xuICAkLmlzQXJyYXkgPSBpc0FycmF5XG4gICQuaXNQbGFpbk9iamVjdCA9IGlzUGxhaW5PYmplY3RcblxuICAkLmlzRW1wdHlPYmplY3QgPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgdmFyIG5hbWVcbiAgICBmb3IgKG5hbWUgaW4gb2JqKSByZXR1cm4gZmFsc2VcbiAgICByZXR1cm4gdHJ1ZVxuICB9XG5cbiAgJC5pbkFycmF5ID0gZnVuY3Rpb24gKGVsZW0sIGFycmF5LCBpKSB7XG4gICAgcmV0dXJuIGVtcHR5QXJyYXkuaW5kZXhPZi5jYWxsKGFycmF5LCBlbGVtLCBpKVxuICB9XG5cbiAgJC5jYW1lbENhc2UgPSBjYW1lbGl6ZVxuICAkLnRyaW0gPSBmdW5jdGlvbiAoc3RyKSB7XG4gICAgcmV0dXJuIHN0ciA9PSBudWxsID8gXCJcIiA6IFN0cmluZy5wcm90b3R5cGUudHJpbS5jYWxsKHN0cilcbiAgfVxuXG4gIC8vIHBsdWdpbiBjb21wYXRpYmlsaXR5XG4gICQudXVpZCA9IDBcbiAgJC5zdXBwb3J0ID0ge31cbiAgJC5leHByID0ge31cbiAgJC5ub29wID0gZnVuY3Rpb24gKCkge1xuICB9XG5cbiAgJC5tYXAgPSBmdW5jdGlvbiAoZWxlbWVudHMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHZhbHVlLCB2YWx1ZXMgPSBbXSwgaSwga2V5XG4gICAgaWYgKGxpa2VBcnJheShlbGVtZW50cykpXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgZWxlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFsdWUgPSBjYWxsYmFjayhlbGVtZW50c1tpXSwgaSlcbiAgICAgICAgaWYgKHZhbHVlICE9IG51bGwpIHZhbHVlcy5wdXNoKHZhbHVlKVxuICAgICAgfVxuICAgIGVsc2VcbiAgICAgIGZvciAoa2V5IGluIGVsZW1lbnRzKSB7XG4gICAgICAgIHZhbHVlID0gY2FsbGJhY2soZWxlbWVudHNba2V5XSwga2V5KVxuICAgICAgICBpZiAodmFsdWUgIT0gbnVsbCkgdmFsdWVzLnB1c2godmFsdWUpXG4gICAgICB9XG4gICAgcmV0dXJuIGZsYXR0ZW4odmFsdWVzKVxuICB9XG5cbiAgJC5lYWNoID0gZnVuY3Rpb24gKGVsZW1lbnRzLCBjYWxsYmFjaykge1xuICAgIHZhciBpLCBrZXlcbiAgICBpZiAobGlrZUFycmF5KGVsZW1lbnRzKSkge1xuICAgICAgZm9yIChpID0gMDsgaSA8IGVsZW1lbnRzLmxlbmd0aDsgaSsrKVxuICAgICAgICBpZiAoY2FsbGJhY2suY2FsbChlbGVtZW50c1tpXSwgaSwgZWxlbWVudHNbaV0pID09PSBmYWxzZSkgcmV0dXJuIGVsZW1lbnRzXG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAoa2V5IGluIGVsZW1lbnRzKVxuICAgICAgICBpZiAoY2FsbGJhY2suY2FsbChlbGVtZW50c1trZXldLCBrZXksIGVsZW1lbnRzW2tleV0pID09PSBmYWxzZSkgcmV0dXJuIGVsZW1lbnRzXG4gICAgfVxuXG4gICAgcmV0dXJuIGVsZW1lbnRzXG4gIH1cblxuICAkLmdyZXAgPSBmdW5jdGlvbiAoZWxlbWVudHMsIGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIGZpbHRlci5jYWxsKGVsZW1lbnRzLCBjYWxsYmFjaylcbiAgfVxuXG4gIGlmICh3aW5kb3cuSlNPTikgJC5wYXJzZUpTT04gPSBKU09OLnBhcnNlXG5cbiAgLy8gUG9wdWxhdGUgdGhlIGNsYXNzMnR5cGUgbWFwXG4gICQuZWFjaChcIkJvb2xlYW4gTnVtYmVyIFN0cmluZyBGdW5jdGlvbiBBcnJheSBEYXRlIFJlZ0V4cCBPYmplY3QgRXJyb3JcIi5zcGxpdChcIiBcIiksIGZ1bmN0aW9uIChpLCBuYW1lKSB7XG4gICAgY2xhc3MydHlwZVtcIltvYmplY3QgXCIgKyBuYW1lICsgXCJdXCJdID0gbmFtZS50b0xvd2VyQ2FzZSgpXG4gIH0pXG5cbiAgLy8gRGVmaW5lIG1ldGhvZHMgdGhhdCB3aWxsIGJlIGF2YWlsYWJsZSBvbiBhbGxcbiAgLy8gWmVwdG8gY29sbGVjdGlvbnNcbiAgJC5mbiA9IHtcbiAgICBjb25zdHJ1Y3RvcjogemVwdG8uWixcbiAgICBsZW5ndGg6IDAsXG5cbiAgICAvLyBCZWNhdXNlIGEgY29sbGVjdGlvbiBhY3RzIGxpa2UgYW4gYXJyYXlcbiAgICAvLyBjb3B5IG92ZXIgdGhlc2UgdXNlZnVsIGFycmF5IGZ1bmN0aW9ucy5cbiAgICBmb3JFYWNoOiBlbXB0eUFycmF5LmZvckVhY2gsXG4gICAgcmVkdWNlOiBlbXB0eUFycmF5LnJlZHVjZSxcbiAgICBwdXNoOiBlbXB0eUFycmF5LnB1c2gsXG4gICAgc29ydDogZW1wdHlBcnJheS5zb3J0LFxuICAgIHNwbGljZTogZW1wdHlBcnJheS5zcGxpY2UsXG4gICAgaW5kZXhPZjogZW1wdHlBcnJheS5pbmRleE9mLFxuICAgIGNvbmNhdDogZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGksIHZhbHVlLCBhcmdzID0gW11cbiAgICAgIGZvciAoaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFsdWUgPSBhcmd1bWVudHNbaV1cbiAgICAgICAgYXJnc1tpXSA9IHplcHRvLmlzWih2YWx1ZSkgPyB2YWx1ZS50b0FycmF5KCkgOiB2YWx1ZVxuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbmNhdC5hcHBseSh6ZXB0by5pc1oodGhpcykgPyB0aGlzLnRvQXJyYXkoKSA6IHRoaXMsIGFyZ3MpXG4gICAgfSxcblxuICAgIC8vIGBtYXBgIGFuZCBgc2xpY2VgIGluIHRoZSBqUXVlcnkgQVBJIHdvcmsgZGlmZmVyZW50bHlcbiAgICAvLyBmcm9tIHRoZWlyIGFycmF5IGNvdW50ZXJwYXJ0c1xuICAgIG1hcDogZnVuY3Rpb24gKGZuKSB7XG4gICAgICByZXR1cm4gJCgkLm1hcCh0aGlzLCBmdW5jdGlvbiAoZWwsIGkpIHtcbiAgICAgICAgcmV0dXJuIGZuLmNhbGwoZWwsIGksIGVsKVxuICAgICAgfSkpXG4gICAgfSxcbiAgICBzbGljZTogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuICQoc2xpY2UuYXBwbHkodGhpcywgYXJndW1lbnRzKSlcbiAgICB9LFxuXG4gICAgcmVhZHk6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgLy8gbmVlZCB0byBjaGVjayBpZiBkb2N1bWVudC5ib2R5IGV4aXN0cyBmb3IgSUUgYXMgdGhhdCBicm93c2VyIHJlcG9ydHNcbiAgICAgIC8vIGRvY3VtZW50IHJlYWR5IHdoZW4gaXQgaGFzbid0IHlldCBjcmVhdGVkIHRoZSBib2R5IGVsZW1lbnRcbiAgICAgIGlmIChyZWFkeVJFLnRlc3QoZG9jdW1lbnQucmVhZHlTdGF0ZSkgJiYgZG9jdW1lbnQuYm9keSkgY2FsbGJhY2soJClcbiAgICAgIGVsc2UgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY2FsbGJhY2soJClcbiAgICAgIH0sIGZhbHNlKVxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuICAgIGdldDogZnVuY3Rpb24gKGlkeCkge1xuICAgICAgcmV0dXJuIGlkeCA9PT0gdW5kZWZpbmVkID8gc2xpY2UuY2FsbCh0aGlzKSA6IHRoaXNbaWR4ID49IDAgPyBpZHggOiBpZHggKyB0aGlzLmxlbmd0aF1cbiAgICB9LFxuICAgIHRvQXJyYXk6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldCgpXG4gICAgfSxcbiAgICBzaXplOiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5sZW5ndGhcbiAgICB9LFxuICAgIHJlbW92ZTogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLnBhcmVudE5vZGUgIT0gbnVsbClcbiAgICAgICAgICB0aGlzLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcylcbiAgICAgIH0pXG4gICAgfSxcbiAgICBlYWNoOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIGVtcHR5QXJyYXkuZXZlcnkuY2FsbCh0aGlzLCBmdW5jdGlvbiAoZWwsIGlkeCkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2suY2FsbChlbCwgaWR4LCBlbCkgIT09IGZhbHNlXG4gICAgICB9KVxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuICAgIGZpbHRlcjogZnVuY3Rpb24gKHNlbGVjdG9yKSB7XG4gICAgICBpZiAoaXNGdW5jdGlvbihzZWxlY3RvcikpIHJldHVybiB0aGlzLm5vdCh0aGlzLm5vdChzZWxlY3RvcikpXG4gICAgICByZXR1cm4gJChmaWx0ZXIuY2FsbCh0aGlzLCBmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgICAgICByZXR1cm4gemVwdG8ubWF0Y2hlcyhlbGVtZW50LCBzZWxlY3RvcilcbiAgICAgIH0pKVxuICAgIH0sXG4gICAgYWRkOiBmdW5jdGlvbiAoc2VsZWN0b3IsIGNvbnRleHQpIHtcbiAgICAgIHJldHVybiAkKHVuaXEodGhpcy5jb25jYXQoJChzZWxlY3RvciwgY29udGV4dCkpKSlcbiAgICB9LFxuICAgIGlzOiBmdW5jdGlvbiAoc2VsZWN0b3IpIHtcbiAgICAgIHJldHVybiB0aGlzLmxlbmd0aCA+IDAgJiYgemVwdG8ubWF0Y2hlcyh0aGlzWzBdLCBzZWxlY3RvcilcbiAgICB9LFxuICAgIG5vdDogZnVuY3Rpb24gKHNlbGVjdG9yKSB7XG4gICAgICB2YXIgbm9kZXMgPSBbXVxuICAgICAgaWYgKGlzRnVuY3Rpb24oc2VsZWN0b3IpICYmIHNlbGVjdG9yLmNhbGwgIT09IHVuZGVmaW5lZClcbiAgICAgICAgdGhpcy5lYWNoKGZ1bmN0aW9uIChpZHgpIHtcbiAgICAgICAgICBpZiAoIXNlbGVjdG9yLmNhbGwodGhpcywgaWR4KSkgbm9kZXMucHVzaCh0aGlzKVxuICAgICAgICB9KVxuICAgICAgZWxzZSB7XG4gICAgICAgIHZhciBleGNsdWRlcyA9IHR5cGVvZiBzZWxlY3RvciA9PSAnc3RyaW5nJyA/IHRoaXMuZmlsdGVyKHNlbGVjdG9yKSA6XG4gICAgICAgICAgKGxpa2VBcnJheShzZWxlY3RvcikgJiYgaXNGdW5jdGlvbihzZWxlY3Rvci5pdGVtKSkgPyBzbGljZS5jYWxsKHNlbGVjdG9yKSA6ICQoc2VsZWN0b3IpXG4gICAgICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbiAoZWwpIHtcbiAgICAgICAgICBpZiAoZXhjbHVkZXMuaW5kZXhPZihlbCkgPCAwKSBub2Rlcy5wdXNoKGVsKVxuICAgICAgICB9KVxuICAgICAgfVxuICAgICAgcmV0dXJuICQobm9kZXMpXG4gICAgfSxcbiAgICBoYXM6IGZ1bmN0aW9uIChzZWxlY3Rvcikge1xuICAgICAgcmV0dXJuIHRoaXMuZmlsdGVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGlzT2JqZWN0KHNlbGVjdG9yKSA/XG4gICAgICAgICAgJC5jb250YWlucyh0aGlzLCBzZWxlY3RvcikgOlxuICAgICAgICAgICQodGhpcykuZmluZChzZWxlY3Rvcikuc2l6ZSgpXG4gICAgICB9KVxuICAgIH0sXG4gICAgZXE6IGZ1bmN0aW9uIChpZHgpIHtcbiAgICAgIHJldHVybiBpZHggPT09IC0xID8gdGhpcy5zbGljZShpZHgpIDogdGhpcy5zbGljZShpZHgsICtpZHggKyAxKVxuICAgIH0sXG4gICAgZmlyc3Q6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBlbCA9IHRoaXNbMF1cbiAgICAgIHJldHVybiBlbCAmJiAhaXNPYmplY3QoZWwpID8gZWwgOiAkKGVsKVxuICAgIH0sXG4gICAgbGFzdDogZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGVsID0gdGhpc1t0aGlzLmxlbmd0aCAtIDFdXG4gICAgICByZXR1cm4gZWwgJiYgIWlzT2JqZWN0KGVsKSA/IGVsIDogJChlbClcbiAgICB9LFxuICAgIGZpbmQ6IGZ1bmN0aW9uIChzZWxlY3Rvcikge1xuICAgICAgdmFyIHJlc3VsdCwgJHRoaXMgPSB0aGlzXG4gICAgICBpZiAoIXNlbGVjdG9yKSByZXN1bHQgPSAkKClcbiAgICAgIGVsc2UgaWYgKHR5cGVvZiBzZWxlY3RvciA9PSAnb2JqZWN0JylcbiAgICAgICAgcmVzdWx0ID0gJChzZWxlY3RvcikuZmlsdGVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgbm9kZSA9IHRoaXNcbiAgICAgICAgICByZXR1cm4gZW1wdHlBcnJheS5zb21lLmNhbGwoJHRoaXMsIGZ1bmN0aW9uIChwYXJlbnQpIHtcbiAgICAgICAgICAgIHJldHVybiAkLmNvbnRhaW5zKHBhcmVudCwgbm9kZSlcbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgZWxzZSBpZiAodGhpcy5sZW5ndGggPT0gMSkgcmVzdWx0ID0gJCh6ZXB0by5xc2EodGhpc1swXSwgc2VsZWN0b3IpKVxuICAgICAgZWxzZSByZXN1bHQgPSB0aGlzLm1hcChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgcmV0dXJuIHplcHRvLnFzYSh0aGlzLCBzZWxlY3RvcilcbiAgICAgICAgfSlcbiAgICAgIHJldHVybiByZXN1bHRcbiAgICB9LFxuICAgIGNsb3Nlc3Q6IGZ1bmN0aW9uIChzZWxlY3RvciwgY29udGV4dCkge1xuICAgICAgdmFyIG5vZGUgPSB0aGlzWzBdLCBjb2xsZWN0aW9uID0gZmFsc2VcbiAgICAgIGlmICh0eXBlb2Ygc2VsZWN0b3IgPT0gJ29iamVjdCcpIGNvbGxlY3Rpb24gPSAkKHNlbGVjdG9yKVxuICAgICAgd2hpbGUgKG5vZGUgJiYgIShjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5pbmRleE9mKG5vZGUpID49IDAgOiB6ZXB0by5tYXRjaGVzKG5vZGUsIHNlbGVjdG9yKSkpXG4gICAgICAgIG5vZGUgPSBub2RlICE9PSBjb250ZXh0ICYmICFpc0RvY3VtZW50KG5vZGUpICYmIG5vZGUucGFyZW50Tm9kZVxuICAgICAgcmV0dXJuICQobm9kZSlcbiAgICB9LFxuICAgIHBhcmVudHM6IGZ1bmN0aW9uIChzZWxlY3Rvcikge1xuICAgICAgdmFyIGFuY2VzdG9ycyA9IFtdLCBub2RlcyA9IHRoaXNcbiAgICAgIHdoaWxlIChub2Rlcy5sZW5ndGggPiAwKVxuICAgICAgICBub2RlcyA9ICQubWFwKG5vZGVzLCBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgIGlmICgobm9kZSA9IG5vZGUucGFyZW50Tm9kZSkgJiYgIWlzRG9jdW1lbnQobm9kZSkgJiYgYW5jZXN0b3JzLmluZGV4T2Yobm9kZSkgPCAwKSB7XG4gICAgICAgICAgICBhbmNlc3RvcnMucHVzaChub2RlKVxuICAgICAgICAgICAgcmV0dXJuIG5vZGVcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICByZXR1cm4gZmlsdGVyZWQoYW5jZXN0b3JzLCBzZWxlY3RvcilcbiAgICB9LFxuICAgIHBhcmVudDogZnVuY3Rpb24gKHNlbGVjdG9yKSB7XG4gICAgICByZXR1cm4gZmlsdGVyZWQodW5pcSh0aGlzLnBsdWNrKCdwYXJlbnROb2RlJykpLCBzZWxlY3RvcilcbiAgICB9LFxuICAgIGNoaWxkcmVuOiBmdW5jdGlvbiAoc2VsZWN0b3IpIHtcbiAgICAgIHJldHVybiBmaWx0ZXJlZCh0aGlzLm1hcChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBjaGlsZHJlbih0aGlzKVxuICAgICAgfSksIHNlbGVjdG9yKVxuICAgIH0sXG4gICAgY29udGVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzLm1hcChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbnRlbnREb2N1bWVudCB8fCBzbGljZS5jYWxsKHRoaXMuY2hpbGROb2RlcylcbiAgICAgIH0pXG4gICAgfSxcbiAgICBzaWJsaW5nczogZnVuY3Rpb24gKHNlbGVjdG9yKSB7XG4gICAgICByZXR1cm4gZmlsdGVyZWQodGhpcy5tYXAoZnVuY3Rpb24gKGksIGVsKSB7XG4gICAgICAgIHJldHVybiBmaWx0ZXIuY2FsbChjaGlsZHJlbihlbC5wYXJlbnROb2RlKSwgZnVuY3Rpb24gKGNoaWxkKSB7XG4gICAgICAgICAgcmV0dXJuIGNoaWxkICE9PSBlbFxuICAgICAgICB9KVxuICAgICAgfSksIHNlbGVjdG9yKVxuICAgIH0sXG4gICAgZW1wdHk6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmlubmVySFRNTCA9ICcnXG4gICAgICB9KVxuICAgIH0sXG4gICAgLy8gYHBsdWNrYCBpcyBib3Jyb3dlZCBmcm9tIFByb3RvdHlwZS5qc1xuICAgIHBsdWNrOiBmdW5jdGlvbiAocHJvcGVydHkpIHtcbiAgICAgIHJldHVybiAkLm1hcCh0aGlzLCBmdW5jdGlvbiAoZWwpIHtcbiAgICAgICAgcmV0dXJuIGVsW3Byb3BlcnR5XVxuICAgICAgfSlcbiAgICB9LFxuICAgIHNob3c6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnN0eWxlLmRpc3BsYXkgPT0gXCJub25lXCIgJiYgKHRoaXMuc3R5bGUuZGlzcGxheSA9ICcnKVxuICAgICAgICBpZiAoZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLCAnJykuZ2V0UHJvcGVydHlWYWx1ZShcImRpc3BsYXlcIikgPT0gXCJub25lXCIpXG4gICAgICAgICAgdGhpcy5zdHlsZS5kaXNwbGF5ID0gZGVmYXVsdERpc3BsYXkodGhpcy5ub2RlTmFtZSlcbiAgICAgIH0pXG4gICAgfSxcbiAgICByZXBsYWNlV2l0aDogZnVuY3Rpb24gKG5ld0NvbnRlbnQpIHtcbiAgICAgIHJldHVybiB0aGlzLmJlZm9yZShuZXdDb250ZW50KS5yZW1vdmUoKVxuICAgIH0sXG4gICAgd3JhcDogZnVuY3Rpb24gKHN0cnVjdHVyZSkge1xuICAgICAgdmFyIGZ1bmMgPSBpc0Z1bmN0aW9uKHN0cnVjdHVyZSlcbiAgICAgIGlmICh0aGlzWzBdICYmICFmdW5jKVxuICAgICAgICB2YXIgZG9tID0gJChzdHJ1Y3R1cmUpLmdldCgwKSxcbiAgICAgICAgICBjbG9uZSA9IGRvbS5wYXJlbnROb2RlIHx8IHRoaXMubGVuZ3RoID4gMVxuXG4gICAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICAkKHRoaXMpLndyYXBBbGwoXG4gICAgICAgICAgZnVuYyA/IHN0cnVjdHVyZS5jYWxsKHRoaXMsIGluZGV4KSA6XG4gICAgICAgICAgICBjbG9uZSA/IGRvbS5jbG9uZU5vZGUodHJ1ZSkgOiBkb21cbiAgICAgICAgKVxuICAgICAgfSlcbiAgICB9LFxuICAgIHdyYXBBbGw6IGZ1bmN0aW9uIChzdHJ1Y3R1cmUpIHtcbiAgICAgIGlmICh0aGlzWzBdKSB7XG4gICAgICAgICQodGhpc1swXSkuYmVmb3JlKHN0cnVjdHVyZSA9ICQoc3RydWN0dXJlKSlcbiAgICAgICAgdmFyIGNoaWxkcmVuXG4gICAgICAgIC8vIGRyaWxsIGRvd24gdG8gdGhlIGlubW9zdCBlbGVtZW50XG4gICAgICAgIHdoaWxlICgoY2hpbGRyZW4gPSBzdHJ1Y3R1cmUuY2hpbGRyZW4oKSkubGVuZ3RoKSBzdHJ1Y3R1cmUgPSBjaGlsZHJlbi5maXJzdCgpXG4gICAgICAgICQoc3RydWN0dXJlKS5hcHBlbmQodGhpcylcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzXG4gICAgfSxcbiAgICB3cmFwSW5uZXI6IGZ1bmN0aW9uIChzdHJ1Y3R1cmUpIHtcbiAgICAgIHZhciBmdW5jID0gaXNGdW5jdGlvbihzdHJ1Y3R1cmUpXG4gICAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICB2YXIgc2VsZiA9ICQodGhpcyksIGNvbnRlbnRzID0gc2VsZi5jb250ZW50cygpLFxuICAgICAgICAgIGRvbSA9IGZ1bmMgPyBzdHJ1Y3R1cmUuY2FsbCh0aGlzLCBpbmRleCkgOiBzdHJ1Y3R1cmVcbiAgICAgICAgY29udGVudHMubGVuZ3RoID8gY29udGVudHMud3JhcEFsbChkb20pIDogc2VsZi5hcHBlbmQoZG9tKVxuICAgICAgfSlcbiAgICB9LFxuICAgIHVud3JhcDogZnVuY3Rpb24gKCkge1xuICAgICAgdGhpcy5wYXJlbnQoKS5lYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgJCh0aGlzKS5yZXBsYWNlV2l0aCgkKHRoaXMpLmNoaWxkcmVuKCkpXG4gICAgICB9KVxuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuICAgIGNsb25lOiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jbG9uZU5vZGUodHJ1ZSlcbiAgICAgIH0pXG4gICAgfSxcbiAgICBoaWRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5jc3MoXCJkaXNwbGF5XCIsIFwibm9uZVwiKVxuICAgIH0sXG4gICAgdG9nZ2xlOiBmdW5jdGlvbiAoc2V0dGluZykge1xuICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBlbCA9ICQodGhpcylcbiAgICAgICAgICA7XG4gICAgICAgIChzZXR0aW5nID09PSB1bmRlZmluZWQgPyBlbC5jc3MoXCJkaXNwbGF5XCIpID09IFwibm9uZVwiIDogc2V0dGluZykgPyBlbC5zaG93KCkgOiBlbC5oaWRlKClcbiAgICAgIH0pXG4gICAgfSxcbiAgICBwcmV2OiBmdW5jdGlvbiAoc2VsZWN0b3IpIHtcbiAgICAgIHJldHVybiAkKHRoaXMucGx1Y2soJ3ByZXZpb3VzRWxlbWVudFNpYmxpbmcnKSkuZmlsdGVyKHNlbGVjdG9yIHx8ICcqJylcbiAgICB9LFxuICAgIG5leHQ6IGZ1bmN0aW9uIChzZWxlY3Rvcikge1xuICAgICAgcmV0dXJuICQodGhpcy5wbHVjaygnbmV4dEVsZW1lbnRTaWJsaW5nJykpLmZpbHRlcihzZWxlY3RvciB8fCAnKicpXG4gICAgfSxcbiAgICBodG1sOiBmdW5jdGlvbiAoaHRtbCkge1xuICAgICAgcmV0dXJuIDAgaW4gYXJndW1lbnRzID9cbiAgICAgICAgdGhpcy5lYWNoKGZ1bmN0aW9uIChpZHgpIHtcbiAgICAgICAgICB2YXIgb3JpZ2luSHRtbCA9IHRoaXMuaW5uZXJIVE1MXG4gICAgICAgICAgJCh0aGlzKS5lbXB0eSgpLmFwcGVuZChmdW5jQXJnKHRoaXMsIGh0bWwsIGlkeCwgb3JpZ2luSHRtbCkpXG4gICAgICAgIH0pIDpcbiAgICAgICAgKDAgaW4gdGhpcyA/IHRoaXNbMF0uaW5uZXJIVE1MIDogbnVsbClcbiAgICB9LFxuICAgIHRleHQ6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICByZXR1cm4gMCBpbiBhcmd1bWVudHMgP1xuICAgICAgICB0aGlzLmVhY2goZnVuY3Rpb24gKGlkeCkge1xuICAgICAgICAgIHZhciBuZXdUZXh0ID0gZnVuY0FyZyh0aGlzLCB0ZXh0LCBpZHgsIHRoaXMudGV4dENvbnRlbnQpXG4gICAgICAgICAgdGhpcy50ZXh0Q29udGVudCA9IG5ld1RleHQgPT0gbnVsbCA/ICcnIDogJycgKyBuZXdUZXh0XG4gICAgICAgIH0pIDpcbiAgICAgICAgKDAgaW4gdGhpcyA/IHRoaXMucGx1Y2soJ3RleHRDb250ZW50Jykuam9pbihcIlwiKSA6IG51bGwpXG4gICAgfSxcbiAgICBhdHRyOiBmdW5jdGlvbiAobmFtZSwgdmFsdWUpIHtcbiAgICAgIHZhciByZXN1bHRcbiAgICAgIHJldHVybiAodHlwZW9mIG5hbWUgPT0gJ3N0cmluZycgJiYgISgxIGluIGFyZ3VtZW50cykpID9cbiAgICAgICAgKCF0aGlzLmxlbmd0aCB8fCB0aGlzWzBdLm5vZGVUeXBlICE9PSAxID8gdW5kZWZpbmVkIDpcbiAgICAgICAgICAgICghKHJlc3VsdCA9IHRoaXNbMF0uZ2V0QXR0cmlidXRlKG5hbWUpKSAmJiBuYW1lIGluIHRoaXNbMF0pID8gdGhpc1swXVtuYW1lXSA6IHJlc3VsdFxuICAgICAgICApIDpcbiAgICAgICAgdGhpcy5lYWNoKGZ1bmN0aW9uIChpZHgpIHtcbiAgICAgICAgICBpZiAodGhpcy5ub2RlVHlwZSAhPT0gMSkgcmV0dXJuXG4gICAgICAgICAgaWYgKGlzT2JqZWN0KG5hbWUpKSBmb3IgKGtleSBpbiBuYW1lKSBzZXRBdHRyaWJ1dGUodGhpcywga2V5LCBuYW1lW2tleV0pXG4gICAgICAgICAgZWxzZSBzZXRBdHRyaWJ1dGUodGhpcywgbmFtZSwgZnVuY0FyZyh0aGlzLCB2YWx1ZSwgaWR4LCB0aGlzLmdldEF0dHJpYnV0ZShuYW1lKSkpXG4gICAgICAgIH0pXG4gICAgfSxcbiAgICByZW1vdmVBdHRyOiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMubm9kZVR5cGUgPT09IDEgJiYgbmFtZS5zcGxpdCgnICcpLmZvckVhY2goZnVuY3Rpb24gKGF0dHJpYnV0ZSkge1xuICAgICAgICAgIHNldEF0dHJpYnV0ZSh0aGlzLCBhdHRyaWJ1dGUpXG4gICAgICAgIH0sIHRoaXMpXG4gICAgICB9KVxuICAgIH0sXG4gICAgcHJvcDogZnVuY3Rpb24gKG5hbWUsIHZhbHVlKSB7XG4gICAgICBuYW1lID0gcHJvcE1hcFtuYW1lXSB8fCBuYW1lXG4gICAgICByZXR1cm4gKDEgaW4gYXJndW1lbnRzKSA/XG4gICAgICAgIHRoaXMuZWFjaChmdW5jdGlvbiAoaWR4KSB7XG4gICAgICAgICAgdGhpc1tuYW1lXSA9IGZ1bmNBcmcodGhpcywgdmFsdWUsIGlkeCwgdGhpc1tuYW1lXSlcbiAgICAgICAgfSkgOlxuICAgICAgICAodGhpc1swXSAmJiB0aGlzWzBdW25hbWVdKVxuICAgIH0sXG4gICAgZGF0YTogZnVuY3Rpb24gKG5hbWUsIHZhbHVlKSB7XG4gICAgICB2YXIgYXR0ck5hbWUgPSAnZGF0YS0nICsgbmFtZS5yZXBsYWNlKGNhcGl0YWxSRSwgJy0kMScpLnRvTG93ZXJDYXNlKClcblxuICAgICAgdmFyIGRhdGEgPSAoMSBpbiBhcmd1bWVudHMpID9cbiAgICAgICAgdGhpcy5hdHRyKGF0dHJOYW1lLCB2YWx1ZSkgOlxuICAgICAgICB0aGlzLmF0dHIoYXR0ck5hbWUpXG5cbiAgICAgIHJldHVybiBkYXRhICE9PSBudWxsID8gZGVzZXJpYWxpemVWYWx1ZShkYXRhKSA6IHVuZGVmaW5lZFxuICAgIH0sXG4gICAgdmFsOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIHJldHVybiAwIGluIGFyZ3VtZW50cyA/XG4gICAgICAgIHRoaXMuZWFjaChmdW5jdGlvbiAoaWR4KSB7XG4gICAgICAgICAgdGhpcy52YWx1ZSA9IGZ1bmNBcmcodGhpcywgdmFsdWUsIGlkeCwgdGhpcy52YWx1ZSlcbiAgICAgICAgfSkgOlxuICAgICAgICAodGhpc1swXSAmJiAodGhpc1swXS5tdWx0aXBsZSA/XG4gICAgICAgICAgICAkKHRoaXNbMF0pLmZpbmQoJ29wdGlvbicpLmZpbHRlcihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLnNlbGVjdGVkXG4gICAgICAgICAgICB9KS5wbHVjaygndmFsdWUnKSA6XG4gICAgICAgICAgICB0aGlzWzBdLnZhbHVlKVxuICAgICAgICApXG4gICAgfSxcbiAgICBvZmZzZXQ6IGZ1bmN0aW9uIChjb29yZGluYXRlcykge1xuICAgICAgaWYgKGNvb3JkaW5hdGVzKSByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICB2YXIgJHRoaXMgPSAkKHRoaXMpLFxuICAgICAgICAgIGNvb3JkcyA9IGZ1bmNBcmcodGhpcywgY29vcmRpbmF0ZXMsIGluZGV4LCAkdGhpcy5vZmZzZXQoKSksXG4gICAgICAgICAgcGFyZW50T2Zmc2V0ID0gJHRoaXMub2Zmc2V0UGFyZW50KCkub2Zmc2V0KCksXG4gICAgICAgICAgcHJvcHMgPSB7XG4gICAgICAgICAgICB0b3A6IGNvb3Jkcy50b3AgLSBwYXJlbnRPZmZzZXQudG9wLFxuICAgICAgICAgICAgbGVmdDogY29vcmRzLmxlZnQgLSBwYXJlbnRPZmZzZXQubGVmdFxuICAgICAgICAgIH1cblxuICAgICAgICBpZiAoJHRoaXMuY3NzKCdwb3NpdGlvbicpID09ICdzdGF0aWMnKSBwcm9wc1sncG9zaXRpb24nXSA9ICdyZWxhdGl2ZSdcbiAgICAgICAgJHRoaXMuY3NzKHByb3BzKVxuICAgICAgfSlcbiAgICAgIGlmICghdGhpcy5sZW5ndGgpIHJldHVybiBudWxsXG4gICAgICBpZiAoISQuY29udGFpbnMoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LCB0aGlzWzBdKSlcbiAgICAgICAgcmV0dXJuIHt0b3A6IDAsIGxlZnQ6IDB9XG4gICAgICB2YXIgb2JqID0gdGhpc1swXS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbGVmdDogb2JqLmxlZnQgKyB3aW5kb3cucGFnZVhPZmZzZXQsXG4gICAgICAgIHRvcDogb2JqLnRvcCArIHdpbmRvdy5wYWdlWU9mZnNldCxcbiAgICAgICAgd2lkdGg6IE1hdGgucm91bmQob2JqLndpZHRoKSxcbiAgICAgICAgaGVpZ2h0OiBNYXRoLnJvdW5kKG9iai5oZWlnaHQpXG4gICAgICB9XG4gICAgfSxcbiAgICBjc3M6IGZ1bmN0aW9uIChwcm9wZXJ0eSwgdmFsdWUpIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMikge1xuICAgICAgICB2YXIgY29tcHV0ZWRTdHlsZSwgZWxlbWVudCA9IHRoaXNbMF1cbiAgICAgICAgaWYgKCFlbGVtZW50KSByZXR1cm5cbiAgICAgICAgY29tcHV0ZWRTdHlsZSA9IGdldENvbXB1dGVkU3R5bGUoZWxlbWVudCwgJycpXG4gICAgICAgIGlmICh0eXBlb2YgcHJvcGVydHkgPT0gJ3N0cmluZycpXG4gICAgICAgICAgcmV0dXJuIGVsZW1lbnQuc3R5bGVbY2FtZWxpemUocHJvcGVydHkpXSB8fCBjb21wdXRlZFN0eWxlLmdldFByb3BlcnR5VmFsdWUocHJvcGVydHkpXG4gICAgICAgIGVsc2UgaWYgKGlzQXJyYXkocHJvcGVydHkpKSB7XG4gICAgICAgICAgdmFyIHByb3BzID0ge31cbiAgICAgICAgICAkLmVhY2gocHJvcGVydHksIGZ1bmN0aW9uIChfLCBwcm9wKSB7XG4gICAgICAgICAgICBwcm9wc1twcm9wXSA9IChlbGVtZW50LnN0eWxlW2NhbWVsaXplKHByb3ApXSB8fCBjb21wdXRlZFN0eWxlLmdldFByb3BlcnR5VmFsdWUocHJvcCkpXG4gICAgICAgICAgfSlcbiAgICAgICAgICByZXR1cm4gcHJvcHNcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgY3NzID0gJydcbiAgICAgIGlmICh0eXBlKHByb3BlcnR5KSA9PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoIXZhbHVlICYmIHZhbHVlICE9PSAwKVxuICAgICAgICAgIHRoaXMuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnN0eWxlLnJlbW92ZVByb3BlcnR5KGRhc2hlcml6ZShwcm9wZXJ0eSkpXG4gICAgICAgICAgfSlcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGNzcyA9IGRhc2hlcml6ZShwcm9wZXJ0eSkgKyBcIjpcIiArIG1heWJlQWRkUHgocHJvcGVydHksIHZhbHVlKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChrZXkgaW4gcHJvcGVydHkpXG4gICAgICAgICAgaWYgKCFwcm9wZXJ0eVtrZXldICYmIHByb3BlcnR5W2tleV0gIT09IDApXG4gICAgICAgICAgICB0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICB0aGlzLnN0eWxlLnJlbW92ZVByb3BlcnR5KGRhc2hlcml6ZShrZXkpKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICBjc3MgKz0gZGFzaGVyaXplKGtleSkgKyAnOicgKyBtYXliZUFkZFB4KGtleSwgcHJvcGVydHlba2V5XSkgKyAnOydcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc3R5bGUuY3NzVGV4dCArPSAnOycgKyBjc3NcbiAgICAgIH0pXG4gICAgfSxcbiAgICBpbmRleDogZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgICAgIHJldHVybiBlbGVtZW50ID8gdGhpcy5pbmRleE9mKCQoZWxlbWVudClbMF0pIDogdGhpcy5wYXJlbnQoKS5jaGlsZHJlbigpLmluZGV4T2YodGhpc1swXSlcbiAgICB9LFxuICAgIGhhc0NsYXNzOiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgaWYgKCFuYW1lKSByZXR1cm4gZmFsc2VcbiAgICAgIHJldHVybiBlbXB0eUFycmF5LnNvbWUuY2FsbCh0aGlzLCBmdW5jdGlvbiAoZWwpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGVzdChjbGFzc05hbWUoZWwpKVxuICAgICAgfSwgY2xhc3NSRShuYW1lKSlcbiAgICB9LFxuICAgIGFkZENsYXNzOiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgaWYgKCFuYW1lKSByZXR1cm4gdGhpc1xuICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoaWR4KSB7XG4gICAgICAgIGlmICghKCdjbGFzc05hbWUnIGluIHRoaXMpKSByZXR1cm5cbiAgICAgICAgY2xhc3NMaXN0ID0gW11cbiAgICAgICAgdmFyIGNscyA9IGNsYXNzTmFtZSh0aGlzKSwgbmV3TmFtZSA9IGZ1bmNBcmcodGhpcywgbmFtZSwgaWR4LCBjbHMpXG4gICAgICAgIG5ld05hbWUuc3BsaXQoL1xccysvZykuZm9yRWFjaChmdW5jdGlvbiAoa2xhc3MpIHtcbiAgICAgICAgICBpZiAoISQodGhpcykuaGFzQ2xhc3Moa2xhc3MpKSBjbGFzc0xpc3QucHVzaChrbGFzcylcbiAgICAgICAgfSwgdGhpcylcbiAgICAgICAgY2xhc3NMaXN0Lmxlbmd0aCAmJiBjbGFzc05hbWUodGhpcywgY2xzICsgKGNscyA/IFwiIFwiIDogXCJcIikgKyBjbGFzc0xpc3Quam9pbihcIiBcIikpXG4gICAgICB9KVxuICAgIH0sXG4gICAgcmVtb3ZlQ2xhc3M6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uIChpZHgpIHtcbiAgICAgICAgaWYgKCEoJ2NsYXNzTmFtZScgaW4gdGhpcykpIHJldHVyblxuICAgICAgICBpZiAobmFtZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gY2xhc3NOYW1lKHRoaXMsICcnKVxuICAgICAgICBjbGFzc0xpc3QgPSBjbGFzc05hbWUodGhpcylcbiAgICAgICAgZnVuY0FyZyh0aGlzLCBuYW1lLCBpZHgsIGNsYXNzTGlzdCkuc3BsaXQoL1xccysvZykuZm9yRWFjaChmdW5jdGlvbiAoa2xhc3MpIHtcbiAgICAgICAgICBjbGFzc0xpc3QgPSBjbGFzc0xpc3QucmVwbGFjZShjbGFzc1JFKGtsYXNzKSwgXCIgXCIpXG4gICAgICAgIH0pXG4gICAgICAgIGNsYXNzTmFtZSh0aGlzLCBjbGFzc0xpc3QudHJpbSgpKVxuICAgICAgfSlcbiAgICB9LFxuICAgIHRvZ2dsZUNsYXNzOiBmdW5jdGlvbiAobmFtZSwgd2hlbikge1xuICAgICAgaWYgKCFuYW1lKSByZXR1cm4gdGhpc1xuICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoaWR4KSB7XG4gICAgICAgIHZhciAkdGhpcyA9ICQodGhpcyksIG5hbWVzID0gZnVuY0FyZyh0aGlzLCBuYW1lLCBpZHgsIGNsYXNzTmFtZSh0aGlzKSlcbiAgICAgICAgbmFtZXMuc3BsaXQoL1xccysvZykuZm9yRWFjaChmdW5jdGlvbiAoa2xhc3MpIHtcbiAgICAgICAgICAod2hlbiA9PT0gdW5kZWZpbmVkID8gISR0aGlzLmhhc0NsYXNzKGtsYXNzKSA6IHdoZW4pID9cbiAgICAgICAgICAgICR0aGlzLmFkZENsYXNzKGtsYXNzKSA6ICR0aGlzLnJlbW92ZUNsYXNzKGtsYXNzKVxuICAgICAgICB9KVxuICAgICAgfSlcbiAgICB9LFxuICAgIHNjcm9sbFRvcDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICBpZiAoIXRoaXMubGVuZ3RoKSByZXR1cm5cbiAgICAgIHZhciBoYXNTY3JvbGxUb3AgPSAnc2Nyb2xsVG9wJyBpbiB0aGlzWzBdXG4gICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGhhc1Njcm9sbFRvcCA/IHRoaXNbMF0uc2Nyb2xsVG9wIDogdGhpc1swXS5wYWdlWU9mZnNldFxuICAgICAgcmV0dXJuIHRoaXMuZWFjaChoYXNTY3JvbGxUb3AgP1xuICAgICAgICBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdGhpcy5zY3JvbGxUb3AgPSB2YWx1ZVxuICAgICAgICB9IDpcbiAgICAgICAgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHRoaXMuc2Nyb2xsVG8odGhpcy5zY3JvbGxYLCB2YWx1ZSlcbiAgICAgICAgfSlcbiAgICB9LFxuICAgIHNjcm9sbExlZnQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgaWYgKCF0aGlzLmxlbmd0aCkgcmV0dXJuXG4gICAgICB2YXIgaGFzU2Nyb2xsTGVmdCA9ICdzY3JvbGxMZWZ0JyBpbiB0aGlzWzBdXG4gICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGhhc1Njcm9sbExlZnQgPyB0aGlzWzBdLnNjcm9sbExlZnQgOiB0aGlzWzBdLnBhZ2VYT2Zmc2V0XG4gICAgICByZXR1cm4gdGhpcy5lYWNoKGhhc1Njcm9sbExlZnQgP1xuICAgICAgICBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdGhpcy5zY3JvbGxMZWZ0ID0gdmFsdWVcbiAgICAgICAgfSA6XG4gICAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB0aGlzLnNjcm9sbFRvKHZhbHVlLCB0aGlzLnNjcm9sbFkpXG4gICAgICAgIH0pXG4gICAgfSxcbiAgICBwb3NpdGlvbjogZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKCF0aGlzLmxlbmd0aCkgcmV0dXJuXG5cbiAgICAgIHZhciBlbGVtID0gdGhpc1swXSxcbiAgICAgIC8vIEdldCAqcmVhbCogb2Zmc2V0UGFyZW50XG4gICAgICAgIG9mZnNldFBhcmVudCA9IHRoaXMub2Zmc2V0UGFyZW50KCksXG4gICAgICAvLyBHZXQgY29ycmVjdCBvZmZzZXRzXG4gICAgICAgIG9mZnNldCA9IHRoaXMub2Zmc2V0KCksXG4gICAgICAgIHBhcmVudE9mZnNldCA9IHJvb3ROb2RlUkUudGVzdChvZmZzZXRQYXJlbnRbMF0ubm9kZU5hbWUpID8ge3RvcDogMCwgbGVmdDogMH0gOiBvZmZzZXRQYXJlbnQub2Zmc2V0KClcblxuICAgICAgLy8gU3VidHJhY3QgZWxlbWVudCBtYXJnaW5zXG4gICAgICAvLyBub3RlOiB3aGVuIGFuIGVsZW1lbnQgaGFzIG1hcmdpbjogYXV0byB0aGUgb2Zmc2V0TGVmdCBhbmQgbWFyZ2luTGVmdFxuICAgICAgLy8gYXJlIHRoZSBzYW1lIGluIFNhZmFyaSBjYXVzaW5nIG9mZnNldC5sZWZ0IHRvIGluY29ycmVjdGx5IGJlIDBcbiAgICAgIG9mZnNldC50b3AgLT0gcGFyc2VGbG9hdCgkKGVsZW0pLmNzcygnbWFyZ2luLXRvcCcpKSB8fCAwXG4gICAgICBvZmZzZXQubGVmdCAtPSBwYXJzZUZsb2F0KCQoZWxlbSkuY3NzKCdtYXJnaW4tbGVmdCcpKSB8fCAwXG5cbiAgICAgIC8vIEFkZCBvZmZzZXRQYXJlbnQgYm9yZGVyc1xuICAgICAgcGFyZW50T2Zmc2V0LnRvcCArPSBwYXJzZUZsb2F0KCQob2Zmc2V0UGFyZW50WzBdKS5jc3MoJ2JvcmRlci10b3Atd2lkdGgnKSkgfHwgMFxuICAgICAgcGFyZW50T2Zmc2V0LmxlZnQgKz0gcGFyc2VGbG9hdCgkKG9mZnNldFBhcmVudFswXSkuY3NzKCdib3JkZXItbGVmdC13aWR0aCcpKSB8fCAwXG5cbiAgICAgIC8vIFN1YnRyYWN0IHRoZSB0d28gb2Zmc2V0c1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9wOiBvZmZzZXQudG9wIC0gcGFyZW50T2Zmc2V0LnRvcCxcbiAgICAgICAgbGVmdDogb2Zmc2V0LmxlZnQgLSBwYXJlbnRPZmZzZXQubGVmdFxuICAgICAgfVxuICAgIH0sXG4gICAgb2Zmc2V0UGFyZW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcGFyZW50ID0gdGhpcy5vZmZzZXRQYXJlbnQgfHwgZG9jdW1lbnQuYm9keVxuICAgICAgICB3aGlsZSAocGFyZW50ICYmICFyb290Tm9kZVJFLnRlc3QocGFyZW50Lm5vZGVOYW1lKSAmJiAkKHBhcmVudCkuY3NzKFwicG9zaXRpb25cIikgPT0gXCJzdGF0aWNcIilcbiAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQub2Zmc2V0UGFyZW50XG4gICAgICAgIHJldHVybiBwYXJlbnRcbiAgICAgIH0pXG4gICAgfVxuICB9XG5cbiAgLy8gZm9yIG5vd1xuICAkLmZuLmRldGFjaCA9ICQuZm4ucmVtb3ZlXG5cbiAgICAvLyBHZW5lcmF0ZSB0aGUgYHdpZHRoYCBhbmQgYGhlaWdodGAgZnVuY3Rpb25zXG4gIDtcbiAgWyd3aWR0aCcsICdoZWlnaHQnXS5mb3JFYWNoKGZ1bmN0aW9uIChkaW1lbnNpb24pIHtcbiAgICB2YXIgZGltZW5zaW9uUHJvcGVydHkgPVxuICAgICAgZGltZW5zaW9uLnJlcGxhY2UoLy4vLCBmdW5jdGlvbiAobSkge1xuICAgICAgICByZXR1cm4gbVswXS50b1VwcGVyQ2FzZSgpXG4gICAgICB9KVxuXG4gICAgJC5mbltkaW1lbnNpb25dID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICB2YXIgb2Zmc2V0LCBlbCA9IHRoaXNbMF1cbiAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gaXNXaW5kb3coZWwpID8gZWxbJ2lubmVyJyArIGRpbWVuc2lvblByb3BlcnR5XSA6XG4gICAgICAgIGlzRG9jdW1lbnQoZWwpID8gZWwuZG9jdW1lbnRFbGVtZW50WydzY3JvbGwnICsgZGltZW5zaW9uUHJvcGVydHldIDpcbiAgICAgICAgKG9mZnNldCA9IHRoaXMub2Zmc2V0KCkpICYmIG9mZnNldFtkaW1lbnNpb25dXG4gICAgICBlbHNlIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24gKGlkeCkge1xuICAgICAgICBlbCA9ICQodGhpcylcbiAgICAgICAgZWwuY3NzKGRpbWVuc2lvbiwgZnVuY0FyZyh0aGlzLCB2YWx1ZSwgaWR4LCBlbFtkaW1lbnNpb25dKCkpKVxuICAgICAgfSlcbiAgICB9XG4gIH0pXG5cbiAgZnVuY3Rpb24gdHJhdmVyc2VOb2RlKG5vZGUsIGZ1bikge1xuICAgIGZ1bihub2RlKVxuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBub2RlLmNoaWxkTm9kZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspXG4gICAgICB0cmF2ZXJzZU5vZGUobm9kZS5jaGlsZE5vZGVzW2ldLCBmdW4pXG4gIH1cblxuICAvLyBHZW5lcmF0ZSB0aGUgYGFmdGVyYCwgYHByZXBlbmRgLCBgYmVmb3JlYCwgYGFwcGVuZGAsXG4gIC8vIGBpbnNlcnRBZnRlcmAsIGBpbnNlcnRCZWZvcmVgLCBgYXBwZW5kVG9gLCBhbmQgYHByZXBlbmRUb2AgbWV0aG9kcy5cbiAgYWRqYWNlbmN5T3BlcmF0b3JzLmZvckVhY2goZnVuY3Rpb24gKG9wZXJhdG9yLCBvcGVyYXRvckluZGV4KSB7XG4gICAgdmFyIGluc2lkZSA9IG9wZXJhdG9ySW5kZXggJSAyIC8vPT4gcHJlcGVuZCwgYXBwZW5kXG5cbiAgICAkLmZuW29wZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIGFyZ3VtZW50cyBjYW4gYmUgbm9kZXMsIGFycmF5cyBvZiBub2RlcywgWmVwdG8gb2JqZWN0cyBhbmQgSFRNTCBzdHJpbmdzXG4gICAgICB2YXIgYXJnVHlwZSwgbm9kZXMgPSAkLm1hcChhcmd1bWVudHMsIGZ1bmN0aW9uIChhcmcpIHtcbiAgICAgICAgICBhcmdUeXBlID0gdHlwZShhcmcpXG4gICAgICAgICAgcmV0dXJuIGFyZ1R5cGUgPT0gXCJvYmplY3RcIiB8fCBhcmdUeXBlID09IFwiYXJyYXlcIiB8fCBhcmcgPT0gbnVsbCA/XG4gICAgICAgICAgICBhcmcgOiB6ZXB0by5mcmFnbWVudChhcmcpXG4gICAgICAgIH0pLFxuICAgICAgICBwYXJlbnQsIGNvcHlCeUNsb25lID0gdGhpcy5sZW5ndGggPiAxXG4gICAgICBpZiAobm9kZXMubGVuZ3RoIDwgMSkgcmV0dXJuIHRoaXNcblxuICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoXywgdGFyZ2V0KSB7XG4gICAgICAgIHBhcmVudCA9IGluc2lkZSA/IHRhcmdldCA6IHRhcmdldC5wYXJlbnROb2RlXG5cbiAgICAgICAgLy8gY29udmVydCBhbGwgbWV0aG9kcyB0byBhIFwiYmVmb3JlXCIgb3BlcmF0aW9uXG4gICAgICAgIHRhcmdldCA9IG9wZXJhdG9ySW5kZXggPT0gMCA/IHRhcmdldC5uZXh0U2libGluZyA6XG4gICAgICAgICAgb3BlcmF0b3JJbmRleCA9PSAxID8gdGFyZ2V0LmZpcnN0Q2hpbGQgOlxuICAgICAgICAgICAgb3BlcmF0b3JJbmRleCA9PSAyID8gdGFyZ2V0IDpcbiAgICAgICAgICAgICAgbnVsbFxuXG4gICAgICAgIHZhciBwYXJlbnRJbkRvY3VtZW50ID0gJC5jb250YWlucyhkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHBhcmVudClcblxuICAgICAgICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgaWYgKGNvcHlCeUNsb25lKSBub2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSlcbiAgICAgICAgICBlbHNlIGlmICghcGFyZW50KSByZXR1cm4gJChub2RlKS5yZW1vdmUoKVxuXG4gICAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZShub2RlLCB0YXJnZXQpXG4gICAgICAgICAgaWYgKHBhcmVudEluRG9jdW1lbnQpIHRyYXZlcnNlTm9kZShub2RlLCBmdW5jdGlvbiAoZWwpIHtcbiAgICAgICAgICAgIGlmIChlbC5ub2RlTmFtZSAhPSBudWxsICYmIGVsLm5vZGVOYW1lLnRvVXBwZXJDYXNlKCkgPT09ICdTQ1JJUFQnICYmXG4gICAgICAgICAgICAgICghZWwudHlwZSB8fCBlbC50eXBlID09PSAndGV4dC9qYXZhc2NyaXB0JykgJiYgIWVsLnNyYylcbiAgICAgICAgICAgICAgd2luZG93WydldmFsJ10uY2FsbCh3aW5kb3csIGVsLmlubmVySFRNTClcbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgfSlcbiAgICB9XG5cbiAgICAvLyBhZnRlciAgICA9PiBpbnNlcnRBZnRlclxuICAgIC8vIHByZXBlbmQgID0+IHByZXBlbmRUb1xuICAgIC8vIGJlZm9yZSAgID0+IGluc2VydEJlZm9yZVxuICAgIC8vIGFwcGVuZCAgID0+IGFwcGVuZFRvXG4gICAgJC5mbltpbnNpZGUgPyBvcGVyYXRvciArICdUbycgOiAnaW5zZXJ0JyArIChvcGVyYXRvckluZGV4ID8gJ0JlZm9yZScgOiAnQWZ0ZXInKV0gPSBmdW5jdGlvbiAoaHRtbCkge1xuICAgICAgJChodG1sKVtvcGVyYXRvcl0odGhpcylcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuICB9KVxuXG4gIHplcHRvLloucHJvdG90eXBlID0gWi5wcm90b3R5cGUgPSAkLmZuXG5cbiAgLy8gRXhwb3J0IGludGVybmFsIEFQSSBmdW5jdGlvbnMgaW4gdGhlIGAkLnplcHRvYCBuYW1lc3BhY2VcbiAgemVwdG8udW5pcSA9IHVuaXFcbiAgemVwdG8uZGVzZXJpYWxpemVWYWx1ZSA9IGRlc2VyaWFsaXplVmFsdWVcbiAgJC56ZXB0byA9IHplcHRvXG5cbiAgcmV0dXJuICRcbn0pKClcblxubW9kdWxlLmV4cG9ydHMgPSBaZXB0bztcbiIsIi8qKlxuICogQ29tbW9uLmpzIGZvciBuZXltYXIganIgZXhwZXJpZW5jZSAoY29tbW9uKSBaZXB0by5qcyBwbHVnaW4gdjEuMS42XG4gKiBWOiBbMC4xIChmb3Vyd2hlZWxzKV1cbiAqIGh0dHA6Ly90ZXN0cy5ndWlhdGVjaC5jb20uYnIvZm91cndoZWVscy9zaXRlL1xuICogQ29weXJpZ2h0IDIwMTYsIEtub3dsZWRnZVxuICogQXV0aG9yOiBKb2FvIEd1aWxoZXJtZSBDLiBQcmFkb1xuICogRGVwLiBvZiBMaWJyYXJ5OiBaZXB0by5qcyB2MS4xLjYgdy8gRVM2XG4gKlxuICogVXN1YWxseSB1c2VkIGZvciBzY3JpcHRzIGluIGZvdXIgd2hlZWxzIHdvcmRwcmVzcyB3ZWJzaXRlIChob21lcGFnZS1vbmx5IFt0b2RheV0pXG4gKlxuICogRGF0ZTogTW9uIE1hciAxNCAyMDE2IDIxOjI3OjE5IEdNVC0wMzAwXG4gKi9cblxuY29uc3QgbmpyID0gbmpyIHx8IHt9O1xuY29uc3QgJCA9IHJlcXVpcmUoJy4vbGliL3plcHRvX2N1c3RvbScpO1xuXG4kKGZ1bmN0aW9uKCl7XG4gIGNvbnNvbGUubG9nKCd0ZXN0Jyk7XG59KTsiLCJ2YXIgJCA9IHJlcXVpcmUoJ3plcHRvLW1vZHVsZXMvemVwdG8nKTtcblxucmVxdWlyZSgnemVwdG8tbW9kdWxlcy9ldmVudCcpO1xucmVxdWlyZSgnemVwdG8tbW9kdWxlcy9mb3JtJyk7XG5yZXF1aXJlKCd6ZXB0by1tb2R1bGVzL2FqYXgnKTtcbnJlcXVpcmUoJ3plcHRvLW1vZHVsZXMvZngnKTtcbnJlcXVpcmUoJ3plcHRvLW1vZHVsZXMvZnhfbWV0aG9kcycpO1xucmVxdWlyZSgnemVwdG8tbW9kdWxlcy9kZXRlY3QnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAkOyJdfQ==
