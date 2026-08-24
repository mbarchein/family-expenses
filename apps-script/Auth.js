/**
 * Who is allowed to write.
 *
 * The rule the users chose: whoever can edit the spreadsheet can use the app.
 * There is no list of emails in this code and none in Script Properties — the
 * sharing dialog in Drive is the whole access control panel. Share the sheet to
 * grant access, unshare to revoke it.
 *
 * Two consequences they know about and accepted:
 *   - Access granted "to anyone with the link", or through a Google Group,
 *     cannot be enumerated by getEditors(). Those users are rejected. It fails
 *     closed, which is the right direction, but it means sharing has to be per
 *     named account.
 *   - Both the editor list and verified tokens are cached, so revoking access
 *     takes up to CACHE_SECONDS to bite.
 */

var CACHE_SECONDS = 300;

/**
 * Verifies a Google ID token and returns { email, name }.
 *
 * We call Google's tokeninfo endpoint rather than validating the JWT signature
 * ourselves. Apps Script has no crypto library for RS256 and hand-rolling one
 * against rotating JWKS keys is exactly the kind of code that works until the
 * day Google rotates a key. The cost is one HTTP round trip, paid once per
 * token per CACHE_SECONDS.
 */
function verifyRequest_(idToken) {
  if (!idToken) throw apiError_('UNAUTHENTICATED', 'Missing ID token');

  var cache = CacheService.getScriptCache();
  var key = 'tok:' + shortHash_(idToken);
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var info = fetchTokenInfo_(idToken);

  var expectedAudience = readConfig_().oauthClientId;
  if (!expectedAudience) {
    throw apiError_('MISCONFIGURED',
      'oauth_client_id is not set in the Config tab. Run setupSpreadsheet() and fill it in.');
  }
  // Without the audience check any Google user could sign in to any other
  // application and replay that token here.
  if (info.aud !== expectedAudience) {
    throw apiError_('UNAUTHENTICATED', 'Token was issued for a different application');
  }
  if (info.email_verified !== 'true' && info.email_verified !== true) {
    throw apiError_('UNAUTHENTICATED', 'Email is not verified');
  }

  var email = String(info.email || '').toLowerCase();
  if (allowedEmails_().indexOf(email) === -1) {
    throw apiError_('FORBIDDEN',
      email + ' cannot edit this spreadsheet. Share it with that account to grant access.');
  }

  var user = { email: email, name: info.name || email };

  // Never outlive the token itself: a cache entry that survives expiry would
  // turn a stale token into a valid one.
  var remaining = Number(info.exp) - Math.floor(Date.now() / 1000);
  cache.put(key, JSON.stringify(user), Math.max(1, Math.min(CACHE_SECONDS, remaining)));
  return user;
}

function fetchTokenInfo_(idToken) {
  var res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) {
    throw apiError_('UNAUTHENTICATED', 'Token rejected by Google');
  }
  return JSON.parse(res.getContentText());
}

/**
 * The spreadsheet's editors, lowercased, plus the owner.
 *
 * getEditors() needs permission to read the file's sharing settings, which the
 * declared spreadsheets scope does not always grant — it depends on how the
 * script was authorized. Rather than fail shut and lock both users out of their
 * own app, we fall back to the two addresses in the Config tab and record why.
 * If you want the sharing list to be authoritative in every case, add
 * https://www.googleapis.com/auth/drive.readonly to appsscript.json and
 * re-authorize; see DEPLOY.md.
 */
function allowedEmails_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('editors');
  if (hit) return JSON.parse(hit);

  var emails;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var people = ss.getEditors().concat([ss.getOwner()]);
    emails = people
      .filter(function (p) { return p; })
      .map(function (p) { return String(p.getEmail() || '').toLowerCase(); })
      // Deduped, because the owner is also an editor and so arrives twice. It
      // changes no decision — `indexOf` is as happy either way — but this list is
      // printed by sanityCheck as who may use the app, and an address listed
      // twice reads as a second account that is not there.
      .filter(function (email, at, all) { return email && all.indexOf(email) === at; });
  } catch (err) {
    console.warn('getEditors() failed (%s); falling back to the Config emails', err);
    emails = [];
  }

  if (!emails.length) {
    var config = readConfig_();
    emails = [config.people[0].email, config.people[1].email]
      .map(function (e) { return String(e || '').toLowerCase(); })
      .filter(function (e) { return e; });
  }

  cache.put('editors', JSON.stringify(emails), CACHE_SECONDS);
  return emails;
}

function shortHash_(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value);
  return Utilities.base64EncodeWebSafe(bytes).substring(0, 32);
}
