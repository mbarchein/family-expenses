/**
 * HTTP entry points.
 *
 * Everything is a POST to a single endpoint with an `action` in the body. That
 * is not a style choice, it is what Apps Script forces on us, and the reason is
 * worth writing down because it looks wrong otherwise:
 *
 *   - A web app's response comes back as a redirect to
 *     script.googleusercontent.com, which serves it with
 *     `Access-Control-Allow-Origin: *`. Fetch follows the redirect and the
 *     browser is happy — but ONLY for requests that need no CORS preflight.
 *   - Apps Script does not handle OPTIONS. Any preflight fails outright.
 *   - A request stays preflight-free only if it uses a simple method, a simple
 *     content type, and no custom headers.
 *
 * So: POST with `Content-Type: text/plain;charset=utf-8` and a JSON string as
 * the body. The ID token travels inside that body rather than in an
 * `Authorization` header, because that header alone would trigger the preflight
 * we are avoiding. Do not "fix" this into a REST API with proper verbs and
 * headers; it will work in curl and fail in every browser.
 *
 * The endpoint is reachable by anyone with the URL. That is fine: authorization
 * is the ID token check in Auth.js, not the secrecy of the URL.
 */

/** Rows returned when the app opens. Enough for the list to feel complete
 *  without ever reading a ledger that grows for years. */
var TAIL_ROWS = 300;
// The ceiling on one bootstrap. The window normally reaches back to last
// January so the totals over the list are real; this is what stops a ledger with
// ten years in it from putting all of them in one JSON body on a phone.
var TAIL_MAX_ROWS = 1500;

var ACTIONS = {
  bootstrap: handleBootstrap_,
  append: handleAppend_,
  update: handleUpdate_,
  voidEntry: handleVoid_,
  assignId: handleAssignId_,
  saveFixed: handleSaveFixed_,
  fixedDone: handleFixedDone_
};

function doPost(e) {
  try {
    var body = parseBody_(e);
    var action = ACTIONS[body.action];
    if (!action) throw apiError_('UNKNOWN_ACTION', 'Unknown action: ' + body.action);

    var user = verifyRequest_(body.idToken);
    return json_({ ok: true, data: action(body.payload || {}, user) });
  } catch (err) {
    return json_({
      ok: false,
      error: {
        code: err && err.apiCode ? err.apiCode : 'INTERNAL',
        message: String(err && err.message ? err.message : err)
      }
    });
  }
}

/**
 * GET is a health check and nothing else. It deliberately reports no data:
 * hitting the URL in a browser should tell you the deployment is alive without
 * revealing whether a given spreadsheet or account exists behind it.
 *
 * That is also what makes it the one thing worth asking from outside, and the
 * deploy workflow now does on every run. The app can only ever report
 * `TypeError: Failed to fetch`, which is everything a browser will say when an
 * answer has no CORS headers — and it covers a deployment that wants a login, a
 * version the owner has not authorized, a URL that is no longer this deployment,
 * and a script that threw before reaching `doPost`. Opening this in a tab, or
 * curling it from CI, tells those apart at a glance. The last of them was real:
 * the Node test files were pushed alongside the sources for an afternoon, and
 * `require` at the top level of one file broke every request to all of them.
 *
 * It answers `ok: false` on purpose, and that is the part not to tidy. A GET can
 * arrive here without anybody asking for one: fetch turns a 302 into a GET, and
 * an Apps Script POST *is* a 302 to script.googleusercontent.com — so when that
 * hop goes wrong the app's POST lands on `doGet`. While this returned
 * `{ ok: true, data: {...} }` the app could not tell that answer from a
 * bootstrap: it cached `{ service, status }` as the ledger, and every reload
 * painted from the cache and crashed on `config.people` before reaching the
 * network again. A health check has to be unmistakable for data, not merely
 * harmless.
 */
function doGet() {
  return json_({
    ok: false,
    service: 'a-medias',
    status: 'ok',
    error: {
      code: 'GET',
      message: 'a-medias is alive. Every action is a POST; see the top of Api.js.'
    }
  });
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw apiError_('BAD_REQUEST', 'Empty request body');
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    throw apiError_('BAD_REQUEST', 'Body is not valid JSON');
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function apiError_(code, message) {
  var err = new Error(message);
  err.apiCode = code;
  return err;
}

/* ── handlers ─────────────────────────────────────────────────────────── */

function handleBootstrap_(payload, user) {
  var config = readConfig_();
  var tail = readTail_(config, payload.limit || TAIL_ROWS);
  return {
    user: user,
    config: publicConfig_(config, user),
    balance: tail.balance,
    entries: tail.entries,
    // Every concept on the sheet, not only the ones inside the window above:
    // the app filters this as somebody types, so anything missing here cannot be
    // found by typing it.
    frequent: conceptVocabulary_(config),
    suggestions: readSuggestions_().items,
    // The templates as they are, not what they owe: which periods are due is
    // worked out in the app, where the calendar arithmetic has tests.
    fixed: readFixed_().items,
    lastRow: tail.lastRow
  };
}

function handleAppend_(payload, user) {
  return appendEntry_(readConfig_(), payload, user);
}

function handleUpdate_(payload, user) {
  return updateEntry_(readConfig_(), payload, user);
}

function handleVoid_(payload, user) {
  return voidEntry_(readConfig_(), payload, user);
}

function handleAssignId_(payload, user) {
  return assignId_(readConfig_(), payload, user);
}

function handleSaveFixed_(payload) {
  return saveFixed_(payload);
}

function handleFixedDone_(payload) {
  return setFixedDone_(payload);
}
