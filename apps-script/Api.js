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

var ACTIONS = {
  bootstrap: handleBootstrap_,
  append: handleAppend_,
  update: handleUpdate_,
  voidEntry: handleVoid_,
  assignId: handleAssignId_
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
 */
function doGet() {
  return json_({ ok: true, data: { service: 'a-medias', status: 'ok' } });
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
    frequent: frequentConcepts_(tail.entries),
    suggestions: readSuggestions_().items,
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
