/**
 * Returns a promise that resolves with the value of the specified key in Chrome storage.
 * If no key is specified, resolves with the entire storage object.
 * @param {string} key - The key to retrieve from storage. Optional.
 * @returns {Promise} A promise that resolves with the value of the specified key in storage.
 */
function callChromeStoragePromise(key) {
  return new Promise(async function (resolve, reject) {
    log.debug("callChromeStoragePromise: ", key)
    var input = key ? [key] : null;
    chrome.storage.sync.get(input, function (storage) {
      if (!key) {
        resolve(storage);
        log.debug("callChromeStoragePromise response: ", storage)
      }
      resolve(storage[key]);
    });
  });
}

function syncChromeStoragePromise(keyName, value) {
  return new Promise(async function (resolve, reject) {
    log.debug("syncChromeStoragePromise: ", keyName, value)
    myobj = {};
    myobj[keyName] = value;
    chrome.storage.sync.set(myobj, function () {
      resolve();
    });
  });
}

/**
 * Returns a promise that resolves with the CSRF token for the current user.
 * If the user is not logged in, returns a rejected promise with an error object.
 * @param {boolean} showInfo - Whether to show/hide the working indicator and toast messages. Optional.
 * @returns {Promise} A promise that resolves with the CSRF token for the current user.
 */
async function getCsrfToken(showInfo = false) {

  if (!cpiData.classicUrl) {
    return new Promise(async function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.withCredentials = true;
      log.log("getCsrfToken")
      xhr.open("GET", "/api/1.0/user");

      xhr.setRequestHeader("X-CSRF-Token", "Fetch");


      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {

          showInfo ? workingIndicator(false) : {};
          log.debug("getCsrfToken response status: ", xhr.status)
          log.debug("getCsrfToken response text: ", xhr.responseText.substring(0, 50))
          resolve(xhr.getResponseHeader("x-csrf-token"));
        } else {
          showInfo ? workingIndicator(false) : {};
          log.debug("getCsrfToken response status: ", xhr.status)
          log.debug("getCsrfToken response text: ", xhr.responseText.substring(0, 300))
          showInfo ? showToast("CPI-Helper has run into a problem while catching X-CSRF-Token.", "", "error") : {};

          reject({
            status: this.status,
            statusText: xhr.statusText
          });
        }
      };
      xhr.ontimeout = function () {
        log.log("getCsrfToken timeout")
        showInfo ? showToast("CPI-Helper has run into a timeout while refreshing X-CSRF-Token.", "Please refresh site and try again.", "error") : {};
        showInfo ? workingIndicator(false) : {};
      }

      xhr.onerror = function () {
        reject({
          status: this.status,
          statusText: xhr.statusText
        });
      };
      showInfo ? workingIndicator(true) : {};
      xhr.send();
    }
    );


  } else {

    var tenant = document.location.href.split("/")[2].split(".")[0];
    var name = 'xcsrf_' + tenant;
    xcsrf = await storageGetPromise(name)
    return xcsrf

  }
}


var callCache = new Map();


/**
 * Returns a promise that resolves with an XMLHttpRequest object for the specified URL.
 * @param {string} method - The HTTP method to use for the request.
 * @param {string} url - The URL to send the request to.
 * @param {string} accept - The value of the Accept header to send with the request. Optional.
 * @param {string} payload - The payload to send with the request. Optional.
 * @param {boolean} includeXcsrf - Whether to include the X-CSRF-Token header in the request. Optional.
 * @param {string} contentType - The value of the Content-Type header to send with the request. Optional.
 * @param {boolean} showInfo - Whether to show/hide the working indicator, X-CSRF-Token indicator, and toast messages. Optional.
 * @returns {Promise} A promise that resolves with an XMLHttpRequest object for the specified URL.
 */
async function makeCallPromiseXHR(method, url, accept, payload, includeXcsrf, contentType, showInfo = true) {
  return new Promise(async function (resolve, reject) {

    log.debug("makecallpromisexhr "+new Date().toISOString())
 

      var xhr = new XMLHttpRequest();
      xhr.withCredentials = true;

      xhr.open(method, absolutePath(url));
      if (accept) {
        //Example for accept: 'application/json' 
        xhr.setRequestHeader('Accept', accept);
      }

      if (contentType) {
        xhr.setRequestHeader('Content-type', contentType);
      }

      if (includeXcsrf) {
        var xcsrf = await getCsrfToken(true);
        log.debug("includeXcsrf: ", xcsrf)

        xhr.setRequestHeader("X-CSRF-Token", xcsrf);
      }

      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {

          showInfo ? workingIndicator(false) : {};

          log.debug("makeCallPromise response status: ", xhr.status)
          log.debug("makeCallPromise response text: ", xhr.responseText.substring(0, 100))
       
          resolve(xhr);
        } else {
          showInfo ? workingIndicator(false) : {};
          showInfo ? showToast("CPI-Helper has run into a problem while loading data.", "", "error") : {};

          log.log("makeCallPromise response status: ", xhr.status)

          log.log("makeCallPromise response text: ", xhr.responseText)

          reject(xhr);
        }
      };
      xhr.timeout = 60000; // Set timeout to 60 seconds
      xhr.ontimeout = function (e) {
        log.log("make call promisexhr timeout")
        log.log("timeout "+new Date().toISOString())
        log.log(e.toString())
        showInfo ? showToast("CPI-Helper has run into a timeout", "Please refresh site and try again.", "error") : {};
        showInfo ? workingIndicator(false) : {};
        reject({
          status: 0,
          statusText: "timeout"
        });
      }

      xhr.onerror = function () {
        reject({
          status: this.status,
          statusText: xhr.statusText
        });
      };
      showInfo ? workingIndicator(true) : {};
      xhr.send(payload);

    }
  
  );

}

async function makeCallPromise(method, url, useCache, accept, payload, includeXcsrf, contentType, showInfo = true) {
  log.debug("makeCallPromise: ", method, url, useCache, accept, payload, includeXcsrf, contentType, showInfo)
  var cache;
  if (useCache) {
    cache = callCache.get(method + url);
  }
  if (cache) {
    log.debug("makeCallPromise cache hit")
    return cache;
  } 
  
  var xhr = await makeCallPromiseXHR(method, url, accept, payload, includeXcsrf, contentType, showInfo = true)
  
  if(xhr.status >= 200 && xhr.status < 300) {
    if (useCache) {
      callCache.set(method + url, xhr.responseText);
    }
    return xhr.responseText
  }
  
  return {
    status: xhr.status,
    statusText: xhr.statusText,
  }
}


//function to make http calls
async function makeCall(type, url, includeXcsrf, payload, callback, contentType, showInfo = true) {
  log.debug("makeCall", type, url, includeXcsrf, payload, contentType, showInfo)
  var xhr = new XMLHttpRequest();
  xhr.withCredentials = true;
  xhr.open(type, absolutePath(url), true);

  if (contentType) {
    xhr.setRequestHeader('Content-type', contentType);
  }

  if (includeXcsrf) {
    xhr.setRequestHeader("X-CSRF-Token", await getCsrfToken(true));
  }

  xhr.timeout = 60000; // Set timeout to 60 seconds
  xhr.ontimeout = function (e) {
    log.debug("makeCall timeout")
    log.debug(e)
    showInfo ? showToast("CPI-Helper has run into a timeout!", "Please refresh site and try again.", "error") : {};
    showInfo ? workingIndicator(false) : {};

  }


  xhr.onreadystatechange = function () {
    if (xhr.readyState == 4) {
      callback(xhr);
      showInfo ? workingIndicator(false) : {};
      log.debug("makeCall response status: ", xhr.status)
      log.debug("makeCall response text: ", xhr.responseText.substring(0, 100))
    }
  }

  showInfo ? workingIndicator(true) : {};
  xhr.send(payload);
}

let absolutePath = function(href) {
  var link = document.createElement("a");
  link.href = href;
  return (link.protocol+"//"+link.host+link.pathname+link.search+link.hash);
}

var formatTrace = function (input, id, traceId) {

  var encodeHTML = function (str) {

    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '&#010;').replace(/'/g, "&#039;");
  }

  var formatXml = function (sourceXml) {
    var xmlDoc = new DOMParser().parseFromString(sourceXml, 'application/xml');
    var xsltDoc = new DOMParser().parseFromString([
      // describes how we want to modify the XML - indent everything
      '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">',
      '  <xsl:strip-space elements="*"/>',
      '  <xsl:template match="para[content-style][not(text())]">', // change to just text() to strip space in text nodes
      '    <xsl:value-of select="normalize-space(.)"/>',
      '  </xsl:template>',
      '  <xsl:template match="node()|@*">',
      '    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
      '  </xsl:template>',
      '  <xsl:output indent="yes"/>',
      '</xsl:stylesheet>',
    ].join('\n'), 'application/xml');

    var xsltProcessor = new XSLTProcessor();
    xsltProcessor.importStylesheet(xsltDoc);
    var resultDoc = xsltProcessor.transformToDocument(xmlDoc);
    var resultXml = new XMLSerializer().serializeToString(resultDoc);
    return resultXml;
  };

  var prettify = function (input) {
    var stringToFormat;
    var type;


    try {
      stringToFormat = JSON.stringify(JSON.parse(input), null, 4);
      type = "js";
    } catch (error) {

    }

    if (stringToFormat == null) {
      if (input.trim()[0] == "<") {
        stringToFormat = formatXml(input);
        stringToFormat = encodeHTML(stringToFormat);
        type = "xml";
      }
    }

    if (stringToFormat == null) {
      let sqloccurence = input.substring(0, 100).toLowerCase().match(/select|from|where|update|insert|upsert|create table|union|join|values|group by/gm)?.length
      if (sqloccurence && sqloccurence >= 2 || input.substring(0, 2).match("--")?.length === 2 && sqloccurence >= 1 || input.substring(0, 6).match("--sql")) {
        stringToFormat = input;
        type = "sql"
      }
    }

    if (stringToFormat == null) {
      stringToFormat = input;
    }

    PR.prettyPrint();
    showToast("Autodetect content: " + type ? type : "unknown");
    return PR.prettyPrintOne(stringToFormat, type, 1);

  }



  if (traceId) {
    var downloadButton = document.createElement("button");
    downloadButton.innerText = "Download";
    downloadButton.onclick = async (element) => {
      var response = await makeCallPromise("GET", "/" + cpiData.urlExtension + "Operations/com.sap.it.op.tmn.commands.dashboard.webui.GetTraceArchiveCommand?traceIds=" + traceId, true);
      var value = response.match(/<payload>(.*)<\/payload>/sg)[0];
      value = value.substring(9, value.length - 10)

      window.open("data:application/zip;base64," + value);
      showToast("Download complete.");
    };
  }

  var copyButton = document.createElement("button");
  copyButton.innerText = "Copy";
  copyButton.onclick = (input) => {

    var text;
    //check who is active
    var unformatted = document.getElementById("cpiHelper_traceText_unformatted_" + id);
    var formatted = document.getElementById("cpiHelper_traceText_formatted_" + id);

    if (unformatted.classList.contains("cpiHelper_traceText_active")) {
      text = unformatted.innerText;
    } else {
      text = formatted.innerText;
    }

    copyText(text);
  };

  var beautifyButton = document.createElement("button");
  beautifyButton.innerText = "Beautify";
  beautifyButton.onclick = (event) => {

    //check who is active
    var unformatted = document.getElementById("cpiHelper_traceText_unformatted_" + id);
    var formatted = document.getElementById("cpiHelper_traceText_formatted_" + id);

    if (unformatted.classList.contains("cpiHelper_traceText_active")) {
      unformatted.classList.remove("cpiHelper_traceText_active");
      formatted.classList.add("cpiHelper_traceText_active");
      beautifyButton.innerText = "Linearize";
    } else {
      formatted.classList.remove("cpiHelper_traceText_active");
      unformatted.classList.add("cpiHelper_traceText_active");
      beautifyButton.innerText = "Beautify";
    }

    if (formatted.innerHTML == "") {
      var pre = document.createElement("pre");
      pre.classList.add("prettyprint");
      pre.classList.add("linenums");
      pre.style.border = "none";
      pre.style.whiteSpace = "pre-wrap";
      pre.style.margin = "0px";
      pre.innerHTML = prettify(unformatted.innerText);
      formatted.appendChild(pre);
    }

  }

  var result = document.createElement("div");

  if (!input) {

    result.innerHTML = '<div class="cpiHelper_infoPopUp_content">No elements found. If this should be part of the trace of an adapter step, try other tabs with same step Id on top of this popup.</div>';
    return result;

  }

  result.appendChild(beautifyButton);
  result.appendChild(copyButton);
  if (traceId) {
    result.appendChild(downloadButton);
  }

  var textEncoder = new TextEncoder().encode(input)
  if (textEncoder.length) {
    var span = document.createElement("span");
    var kb = Math.round(textEncoder.length / 1024 * 100) / 100;

    var additionalText = "";
    if (kb > 2000) {
      additionalText += " - large payload. Beautify could take a while. Browser might freeze.";
    }
    if (kb > 25000) {
      additionalText += " - maybe original payload is larger but we can't show it here and load more";
    }

    span.innerText = " Length unformated: " + input.split(/\r\n|\r|\n/).length + " lines; Size unformated: " + textEncoder.length + " bytes, " + kb + " KB, " + Math.round(kb / 1024 * 100) / 100 + " MB" + additionalText;
    result.appendChild(span);
  }

  var unformattedTrace = document.createElement("div");
  var formattedTrace = document.createElement("div");
  formattedTrace.id = "cpiHelper_traceText_formatted_" + id;
  formattedTrace.classList.add("cpiHelper_traceText");



  unformattedTrace.classList.add("cpiHelper_traceText");
  unformattedTrace.classList.add("cpiHelper_traceText_active");
  unformattedTrace.id = "cpiHelper_traceText_unformatted_" + id;
  unformattedTrace.innerText = input;
  result.appendChild(unformattedTrace);
  result.appendChild(formattedTrace);
  return result;
}

var formatHeadersAndPropertiesToTable = function (inputList) {

  inputList = inputList.sort(function (a, b) { return a.Name.toLowerCase() > b.Name.toLowerCase() ? 1 : -1 });

  if (inputList == null || inputList.length == 0) {
    return '<div class="cpiHelper_infoPopUp_content">No elements found. If this should be part of the trace of an adapter step, try other tabs with same step Id on top of this popup.</div>';
  }

  result = "<table><tr><th>Name</th><th>Value</th></tr>"
  var even = "";
  inputList.forEach(item => {
    result += "<tr class=\"" + even + "\"><td>" + item.Name + "</td><td style=\"word-break: break-all;\">" + htmlEscape(item.Value) + "</td></tr>"
    if (even == "even") {
      even = "";
    } else {
      even = "even";
    }
  });
  result += "</table>";
  return result;
}

var htmlEscape = function (rawStr) {
  if (!rawStr || typeof rawStr != "string") {
    return rawStr;
  }
  return rawStr.replace(/[\u00A0-\u9999<>\&]/g, function (i) {
    return '&#' + i.charCodeAt(0) + ';';
  });
}

function createElementFromHTML(htmlString) {
  var div = document.createElement('div');
  div.innerHTML = htmlString.trim();
  return div.firstChild;
}

function isDevMode() {
  return !('update_url' in chrome.runtime.getManifest());
}

function stage() {
  if (isDevMode()) {
    return "dev"
  }

  return "prod"
}

async function statistic(event, value = null, value2 = null) {

  log.debug(event, value, value2)
/*  try {
    var sessionId = await storageGetPromise("sessionId")
    var installtype = await storageGetPromise("installtype")
    var img = document.createElement("img");
    img.src = `....?version=${chrome.runtime.getManifest().version}&event=${event}&session=${sessionId}&value=${value}&value2=${value2}&installtype=${installtype}&nonse=${Date.now()}`;
  } catch (e) {
    log.log(e)
  }

  */
}

async function onInitStatistic() {
  var lastInitDay = await storageGetPromise("lastInitDay")
  var lastInitMonth = await storageGetPromise("lastInitMonth")
  var today = new Date().toISOString().substring(0, 10);
  var tomonth = new Date().toISOString().substring(0, 7);
  if (!lastInitDay || lastInitDay != today) {

    var sessionId = (Math.random().toString(36) + '00000000000000000').slice(2, 15 + 2)
    var obj = {};
    obj["sessionId"] = sessionId
    await storageSetPromise(obj);
    statistic("init", "day", lastInitMonth != tomonth ? "month" : "")
  }

  var obj = {};
  obj["lastInitDay"] = today
  obj["lastInitMonth"] = tomonth
  await storageSetPromise(obj);

}


async function storageGetPromise(name) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([name], function (result) {
      resolve(result[name]);
    });
  })
}

async function storageSetPromise(obj) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(obj, function (result) {
      resolve("OK");
    });
  })
}
