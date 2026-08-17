/* =========================================================
   Volunteer CRM - admin interface logic
   ---------------------------------------------------------
   Small hash-routed app over the /api/admin endpoints.

   Security note that matters more than anything else here:
   every value that originated from a volunteer is rendered
   through esc(). Names, skills text, notes and accommodation
   details are attacker-controllable, so building innerHTML
   from them unescaped would be a stored-XSS hole in the one
   place that holds the most sensitive data.
   ========================================================= */

(function () {
  'use strict';

  var view = document.getElementById('crmView');
  var loadingEl = document.getElementById('crmLoading');
  var errorEl = document.getElementById('crmError');
  var actorEl = document.getElementById('crmActor');

  var INTEREST_LABELS = {
    community_events: 'Community Events',
    packaging_sorting: 'Packaging / Sorting',
    transport_support: 'Transport / Pick-up',
    outreach_awareness: 'Outreach / Awareness',
    general_support: 'General Support',
    other: 'Other'
  };

  var AVAILABILITY_LABELS = {
    weekday: 'Weekdays',
    evening: 'Evenings',
    weekend: 'Weekends',
    flexible: 'Flexible',
    event_based: 'Event-based',
    other: 'Other'
  };

  var STATUSES = ['NEW', 'REVIEWED', 'CONTACTED', 'APPROVED', 'ACTIVE', 'INACTIVE', 'DECLINED', 'ARCHIVED'];

  var ENQUIRY_STATUSES = ['NEW', 'REVIEWED', 'RESPONDED', 'CLOSED', 'ARCHIVED'];

  // Status changes the person can usefully be told about. These mirror the
  // server's own lists - the server is the authority and will refuse anything
  // else, this just avoids offering a checkbox that would be ignored.
  var NOTIFIABLE = ['CONTACTED', 'APPROVED', 'ACTIVE', 'DECLINED'];
  var ENQUIRY_NOTIFIABLE = ['REVIEWED', 'RESPONDED', 'CLOSED'];

  // What the recipient will actually be told, so the admin is never guessing
  // at what they are about to send on the organisation's behalf.
  var NOTIFY_SUMMARY = {
    CONTACTED: 'that their application has been reviewed and someone is reaching out.',
    APPROVED: 'that their application has been approved and details will follow.',
    ACTIVE: 'a warm welcome to the team.',
    DECLINED: 'that you are not moving forward, kindly worded, with the door left open.',
    REVIEWED: 'that you have read their message and what happens next.',
    RESPONDED: 'that a reply has been sent, and to check spam if they cannot find it.',
    CLOSED: 'a thank-you and that the matter is now closed.'
  };

  /** Notify controls, shared by both detail screens. */
  function notifyBlock() {
    return '<div id="notifyBlock" hidden style="margin-bottom:12px">' +
        '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">' +
          '<input type="checkbox" id="notifyPerson" style="margin-top:3px" />' +
          '<span id="notifyLabel">Email them about this change</span>' +
        '</label>' +
        '<div id="notifyDetail" hidden style="margin-top:10px">' +
          '<p class="cell-sub" id="notifySummary" style="margin:0 0 8px"></p>' +
          '<textarea id="notifyNote" rows="3" placeholder="Optional: add a personal line, e.g. when you can collect, or who will call."></textarea>' +
          '<p class="cell-sub" style="margin:6px 0 0">Anything you type here appears in the email above our standard wording.</p>' +
        '</div>' +
      '</div>';
  }

  /**
   * Wire the notify controls to a status <select>.
   * Hidden entirely for statuses that never send, so the option to email
   * someone about internal bookkeeping is not even presented.
   */
  function wireNotify(selectEl, allowed, currentStatus) {
    var block = document.getElementById('notifyBlock');
    var check = document.getElementById('notifyPerson');
    var detail = document.getElementById('notifyDetail');
    var summary = document.getElementById('notifySummary');
    var label = document.getElementById('notifyLabel');
    if (!block || !selectEl) return;

    function sync() {
      var next = selectEl.value;

      // Offered whenever the selected status is one we can write an email
      // about, whether or not it is changing. A record already marked ACTIVE
      // still needs its welcome email sending, and requiring a fake status
      // change first would be both awkward and dishonest in the audit trail.
      var eligible = allowed.indexOf(next) !== -1;
      block.hidden = !eligible;
      if (!eligible) {
        check.checked = false;
        detail.hidden = true;
        return;
      }

      var unchanged = next === currentStatus;
      label.textContent = unchanged
        ? 'Email them about this (status is already ' + next + ')'
        : 'Email them about this change';
      summary.textContent = 'They will be told ' + (NOTIFY_SUMMARY[next] || 'about this change.');
      detail.hidden = !check.checked;
    }

    selectEl.addEventListener('change', sync);
    check.addEventListener('change', function () { detail.hidden = !check.checked; });
    sync();
  }

  /** Report the outcome of a notification without overstating it. */
  function reportNotify(notified) {
    if (!notified) return;
    if (notified.sent) return;
    if (notified.error === 'not_notifiable') {
      showError('Status saved, but no email was sent',
        'That status is not one we notify people about.');
      return;
    }
    showError('Status saved, but the email failed',
      'The change is recorded. The mail server reported: <code>' + esc(notified.error || 'unknown') + '</code>');
  }

  var ENQUIRY_TYPE_LABELS = {
    ITEM_DONATION: 'Item donation',
    FINANCIAL: 'Financial',
    QUESTION: 'Question',
    OTHER: 'Other'
  };

  var ITEM_LABELS = {
    food: 'Food',
    clothing: 'Clothing',
    hygiene: 'Hygiene / personal care',
    household: 'Household items',
    other: 'Other'
  };

  /* ---------------- helpers ---------------- */

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleString('en-CA', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function fmtDateShort(iso) {
    if (!iso) return 'Never';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function labelChips(codes, map) {
    if (!codes || !codes.length) return '<span class="cell-sub">—</span>';
    return '<div class="chips">' + codes.map(function (c) {
      return '<span class="chip">' + esc(map[c] || c) + '</span>';
    }).join('') + '</div>';
  }

  function badge(status) {
    return '<span class="badge badge-' + esc(status) + '">' + esc(status) + '</span>';
  }

  function setLoading(on) {
    loadingEl.hidden = !on;
    if (on) { errorEl.hidden = true; }
  }

  function showError(title, detail) {
    errorEl.innerHTML = '<h2>' + esc(title) + '</h2>' +
      (detail ? '<p>' + detail + '</p>' : '');
    errorEl.hidden = false;
    loadingEl.hidden = true;
  }

  async function api(path, options) {
    var res = await fetch('/api/admin' + path, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    }, options || {}));

    var body = null;
    try { body = await res.json(); } catch (e) { /* non-JSON, handled below */ }

    if (!res.ok || !body || body.ok === false) {
      var err = new Error((body && body.error) || ('http_' + res.status));
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  /** Turn an API failure into something an operator can act on. */
  function handleApiError(err) {
    if (err.status === 401) {
      showError(
        'Not signed in',
        'Your Cloudflare Access session has expired. <a href="">Reload this page</a> to sign in again.'
      );
      return;
    }
    if (err.status === 403) {
      var who = err.body && err.body.identity;
      if (err.body && err.body.error === 'insufficient_role') {
        showError(
          'Not permitted',
          'Your role (<code>' + esc(err.body.role) + '</code>) does not allow this action.'
        );
        return;
      }
      showError(
        'No access yet',
        'You are signed in' + (who ? ' as <code>' + esc(who) + '</code>' : '') +
        ', but that address has no active role in the CRM.' +
        (who
          ? '<br /><br />Add it to the admin users table:<br />' +
            '<code>INSERT OR IGNORE INTO admin_users (email, display_name, role, active, created_at) ' +
            "VALUES ('" + esc(who) + "', 'Admin', 'OWNER', 1, datetime('now'));</code>"
          : '')
      );
      return;
    }
    if (err.body && err.body.missing) {
      showError(
        'Not configured yet',
        'Missing configuration: <code>' + esc(err.body.missing.join(', ')) + '</code>. ' +
        'These need to be set in the Pages environment variables.'
      );
      return;
    }
    showError('Something went wrong', 'The server said: <code>' + esc(err.message) + '</code>');
  }

  function setActor(actor) {
    if (!actor) return;
    actorEl.innerHTML = '<strong>' + esc(actor.name || actor.email) + '</strong>' + esc(actor.role);
  }

  function setNav(section) {
    document.querySelectorAll('.crm-nav a').forEach(function (a) {
      if (a.dataset.nav === section) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  /* ---------------- dashboard ---------------- */

  async function renderDashboard() {
    setNav('dashboard');
    setLoading(true);

    var data;
    try { data = await api('/dashboard'); }
    catch (err) { view.innerHTML = ''; return handleApiError(err); }

    setActor(data.actor);
    setLoading(false);

    var c = data.counts;
    var failed = data.actionQueue.failedEmails;
    var awaiting = data.actionQueue.awaitingReview;

    var html =
      '<h1 class="crm-page-title">Dashboard</h1>' +
      '<p class="crm-page-sub">What needs attention today.</p>' +

      '<div class="stat-grid">' +
        statCard('#/volunteers?from=' + isoDaysAgo(7), c.new7d, 'New (7 days)') +
        statCard('#/volunteers?status=NEW', c.pendingReview, 'Pending review') +
        statCard('#/volunteers?status=CONTACTED', c.contacted, 'Contacted') +
        statCard('#/volunteers?status=ACTIVE', c.active, 'Active') +
        statCard('#/volunteers', c.total, 'Total') +
        (c.failedEmails
          ? '<div class="stat stat-alert"><div class="stat-value">' + c.failedEmails + '</div><div class="stat-label">Failed emails</div></div>'
          : '') +
      '</div>';

    // The retry queue leads, because a failed acknowledgement is the one
    // failure a volunteer would actually notice.
    if (failed.length) {
      html += '<section class="panel"><div class="panel-head"><h2>Failed emails — needs retry</h2></div>' +
        '<div class="table-scroll"><table class="crm-table"><thead><tr>' +
        '<th>Volunteer</th><th>Type</th><th>To</th><th>Attempts</th><th>Error</th><th></th>' +
        '</tr></thead><tbody>' +
        failed.map(function (f) {
          return '<tr>' +
            '<td><a class="ref-link" href="#/volunteers/' + encodeURIComponent(f.reference) + '">' + esc(f.reference) + '</a>' +
              '<span class="cell-sub">' + esc(f.name) + '</span></td>' +
            '<td>' + esc(f.type) + '</td>' +
            '<td>' + esc(f.to) + '</td>' +
            '<td>' + esc(f.attempts) + '</td>' +
            '<td><span class="cell-sub">' + esc(f.error || '—') + '</span></td>' +
            '<td><button class="btn btn-quiet btn-sm" data-retry="' + esc(f.communicationId) + '">Retry</button></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div></section>';
    }

    if (awaiting.length) {
      html += '<section class="panel"><div class="panel-head"><h2>Awaiting review</h2>' +
        '<span class="cell-sub">Untouched for over ' + esc(data.actionQueue.staleAfterDays) + ' days</span></div>' +
        '<div class="table-scroll"><table class="crm-table"><thead><tr>' +
        '<th>Reference</th><th>Name</th><th>Submitted</th>' +
        '</tr></thead><tbody>' +
        awaiting.map(function (r) {
          return '<tr>' +
            '<td><a class="ref-link" href="#/volunteers/' + encodeURIComponent(r.reference) + '">' + esc(r.reference) + '</a></td>' +
            '<td>' + esc(r.name) + '</td>' +
            '<td>' + esc(fmtDateShort(r.submittedAt)) + '</td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div></section>';
    }

    // Enquiries get their own row of cards rather than being merged into the
    // volunteer counts. They are different work, and an unreconciled donation
    // needs a different response than an unreviewed volunteer.
    var enq = data.enquiries;
    if (enq) {
      html += '<h2 style="font-size:1rem;margin:26px 0 12px;color:var(--muted)">Enquiries</h2>' +
        '<div class="stat-grid">' +
          statCard('#/enquiries?status=NEW', enq.unanswered, 'Unanswered') +
          (enq.awaitingFunds
            ? '<a class="stat stat-alert" href="#/enquiries?funds=awaiting"><div class="stat-value">' + esc(enq.awaitingFunds) +
              '</div><div class="stat-label">Awaiting funds</div></a>'
            : statCard('#/enquiries?funds=awaiting', 0, 'Awaiting funds')) +
          statCard('#/enquiries', enq.openTotal, 'Open enquiries') +
          (enq.failedAcks
            ? '<div class="stat stat-alert"><div class="stat-value">' + esc(enq.failedAcks) +
              '</div><div class="stat-label">Failed acknowledgements</div></div>'
            : '') +
        '</div>';

      if (enq.recent.length) {
        html += '<section class="panel"><div class="panel-head"><h2>Recent enquiries</h2>' +
          '<a class="btn btn-quiet btn-sm" href="#/enquiries">View all</a></div>' +
          '<div class="table-scroll"><table class="crm-table"><thead><tr>' +
          '<th>Reference</th><th>From</th><th>Type</th><th>Amount</th><th>Status</th>' +
          '</tr></thead><tbody>' +
          enq.recent.map(function (r) {
            return '<tr>' +
              '<td><a class="ref-link" href="#/enquiries/' + encodeURIComponent(r.reference) + '">' + esc(r.reference) + '</a></td>' +
              '<td>' + esc(r.name) + '</td>' +
              '<td><span class="chip">' + esc(ENQUIRY_TYPE_LABELS[r.type] || r.type) + '</span></td>' +
              '<td>' + (r.type === 'FINANCIAL'
                ? esc(r.amount || '—') + (r.fundsReceived ? '' : '<span class="cell-sub">pledged</span>')
                : '<span class="cell-sub">—</span>') + '</td>' +
              '<td>' + badge(r.status) + '</td>' +
              '</tr>';
          }).join('') +
          '</tbody></table></div></section>';
      }

      html += '<h2 style="font-size:1rem;margin:26px 0 12px;color:var(--muted)">Volunteers</h2>';
    }

    html += '<section class="panel"><div class="panel-head"><h2>Recent submissions</h2>' +
      '<a class="btn btn-quiet btn-sm" href="#/volunteers">View all</a></div>';

    if (!data.recent.length) {
      html += '<div class="panel-empty">No volunteer applications yet.</div>';
    } else {
      html += '<div class="table-scroll"><table class="crm-table"><thead><tr>' +
        '<th>Reference</th><th>Name</th><th>Interests</th><th>Submitted</th><th>Status</th>' +
        '</tr></thead><tbody>' +
        data.recent.map(function (r) {
          return '<tr>' +
            '<td><a class="ref-link" href="#/volunteers/' + encodeURIComponent(r.reference) + '">' + esc(r.reference) + '</a></td>' +
            '<td>' + esc(r.name) + '</td>' +
            '<td>' + labelChips(r.interests, INTEREST_LABELS) + '</td>' +
            '<td>' + esc(fmtDateShort(r.submittedAt)) + '</td>' +
            '<td>' + badge(r.status) + '</td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';
    }
    html += '</section>';

    view.innerHTML = html;

    view.querySelectorAll('[data-retry]').forEach(function (btn) {
      btn.addEventListener('click', function () { retryEmail(btn); });
    });
  }

  function statCard(href, value, label) {
    return '<a class="stat" href="' + href + '"><div class="stat-value">' + esc(value) +
      '</div><div class="stat-label">' + esc(label) + '</div></a>';
  }

  function isoDaysAgo(n) {
    return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  }

  async function retryEmail(btn) {
    var id = btn.dataset.retry;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      await api('/communications/' + encodeURIComponent(id) + '/retry', { method: 'POST', body: '{}' });
      btn.textContent = 'Sent';
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Retry failed';
      console.error('retry failed', err.message);
    }
  }

  /* ---------------- directory ---------------- */

  async function renderDirectory(query) {
    setNav('volunteers');
    setLoading(true);

    var params = new URLSearchParams(query || '');
    var data;
    try { data = await api('/volunteers?' + params.toString()); }
    catch (err) { view.innerHTML = ''; return handleApiError(err); }

    setActor(data.actor);
    setLoading(false);

    var html =
      '<h1 class="crm-page-title">Volunteers</h1>' +
      '<p class="crm-page-sub">' + esc(data.total) + ' record' + (data.total === 1 ? '' : 's') + ' matching.</p>' +

      '<section class="panel"><div class="panel-body">' +
      '<form class="filters" id="filterForm">' +
        '<div class="filter-field filter-grow"><label for="fq">Search</label>' +
          '<input id="fq" name="q" type="search" placeholder="Name, email, phone or reference" value="' + esc(params.get('q') || '') + '" /></div>' +
        selectField('status', 'Status', STATUSES, params.get('status')) +
        selectField('interest', 'Interest', Object.keys(INTEREST_LABELS), params.get('interest'), INTEREST_LABELS) +
        selectField('availability', 'Availability', Object.keys(AVAILABILITY_LABELS), params.get('availability'), AVAILABILITY_LABELS) +
        '<div class="filter-field"><label for="fcontact">Contact</label>' +
          '<select id="fcontact" name="contact">' +
            '<option value="">Any</option>' +
            '<option value="never"' + (params.get('contact') === 'never' ? ' selected' : '') + '>Never contacted</option>' +
            '<option value="contacted"' + (params.get('contact') === 'contacted' ? ' selected' : '') + '>Contacted</option>' +
          '</select></div>' +
        '<div class="btn-row">' +
          '<button type="submit" class="btn btn-primary">Apply</button>' +
          '<a class="btn btn-quiet" href="#/volunteers">Reset</a>' +
        '</div>' +
      '</form></div></section>';

    html += '<section class="panel">';
    if (!data.results.length) {
      html += '<div class="panel-empty">No volunteers match these filters.</div>';
    } else {
      html += '<div class="table-scroll"><table class="crm-table"><thead><tr>' +
        '<th>Reference</th><th>Volunteer</th><th>Interests</th><th>Availability</th>' +
        '<th>Submitted</th><th>Last contact</th><th>Status</th>' +
        '</tr></thead><tbody>' +
        data.results.map(function (r) {
          return '<tr>' +
            '<td><a class="ref-link" href="#/volunteers/' + encodeURIComponent(r.reference) + '">' + esc(r.reference) + '</a></td>' +
            '<td>' + esc(r.name) + '<span class="cell-sub">' + esc(r.email) + '</span></td>' +
            '<td>' + labelChips(r.interests, INTEREST_LABELS) + '</td>' +
            '<td>' + labelChips(r.availability, AVAILABILITY_LABELS) + '</td>' +
            '<td>' + esc(fmtDateShort(r.submittedAt)) + '</td>' +
            '<td>' + esc(fmtDateShort(r.lastContactAt)) + '</td>' +
            '<td>' + badge(r.status) + '</td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';

      if (data.pages > 1) {
        html += '<div class="pagination">' +
          pageLink(params, data.page - 1, '← Previous', data.page <= 1) +
          '<span>Page ' + esc(data.page) + ' of ' + esc(data.pages) + '</span>' +
          pageLink(params, data.page + 1, 'Next →', data.page >= data.pages) +
          '</div>';
      }
    }
    html += '</section>';

    view.innerHTML = html;

    document.getElementById('filterForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var next = new URLSearchParams();
      fd.forEach(function (value, key) { if (value) next.set(key, value); });
      location.hash = '#/volunteers' + (next.toString() ? '?' + next.toString() : '');
    });
  }

  function selectField(name, label, values, current, labels) {
    return '<div class="filter-field"><label for="f' + name + '">' + esc(label) + '</label>' +
      '<select id="f' + name + '" name="' + name + '">' +
      '<option value="">Any</option>' +
      values.map(function (v) {
        return '<option value="' + esc(v) + '"' + (current === v ? ' selected' : '') + '>' +
          esc(labels ? (labels[v] || v) : v) + '</option>';
      }).join('') +
      '</select></div>';
  }

  function pageLink(params, page, label, disabled, basePath) {
    if (disabled) return '<span class="btn btn-quiet btn-sm" aria-disabled="true" style="opacity:.5">' + esc(label) + '</span>';
    var next = new URLSearchParams(params.toString());
    next.set('page', page);
    return '<a class="btn btn-quiet btn-sm" href="' + (basePath || '#/volunteers') + '?' + next.toString() + '">' + esc(label) + '</a>';
  }

  /* ---------------- profile ---------------- */

  async function renderProfile(ref) {
    setNav('volunteers');
    setLoading(true);

    var data;
    try { data = await api('/volunteers/' + encodeURIComponent(ref)); }
    catch (err) { view.innerHTML = ''; return handleApiError(err); }

    setActor(data.actor);
    setLoading(false);

    var v = data.volunteer;
    var canEdit = ['COORDINATOR', 'ADMIN', 'OWNER'].indexOf(data.actor.role) !== -1;

    var html =
      '<p><a href="#/volunteers">← Back to volunteers</a></p>' +
      '<h1 class="crm-page-title">' + esc(v.name) + ' ' + badge(v.status) + '</h1>' +
      '<p class="crm-page-sub"><span class="ref-link">' + esc(v.reference) + '</span> · submitted ' + esc(fmtDate(v.submittedAt)) + '</p>' +

      '<div class="profile-grid"><div>' +

        '<section class="panel"><div class="panel-head"><h2>Details</h2></div><div class="panel-body">' +
          '<dl class="kv">' +
            row('Email', '<a href="mailto:' + esc(v.email) + '">' + esc(v.email) + '</a>') +
            row('Phone', v.phone ? esc(v.phone) : '—') +
            row('Interests', labelChips(v.interests, INTEREST_LABELS)) +
            row('Availability', labelChips(v.availability, AVAILABILITY_LABELS)) +
            row('Last contact', esc(fmtDateShort(v.lastContactAt))) +
            row('Consent', (v.privacyConsent ? 'Given' : 'Not given') +
              ' <span class="cell-sub">' + esc(v.privacyConsentVersion) + ' · ' + esc(fmtDateShort(v.privacyConsentAt)) + '</span>') +
            row('Updates opt-in', v.updatesConsent ? 'Yes' : 'No') +
          '</dl>' +
        '</div></section>' +

        (v.skillsText ? textPanel('Skills and experience', v.skillsText) : '') +
        (v.additionalNote ? textPanel('Additional note', v.additionalNote) : '') +

        // Restricted panel. Visually distinct so it is obvious this should
        // not be screenshotted into a group chat.
        (v.accommodationText
          ? '<section class="panel"><div class="panel-body"><div class="restricted">' +
              '<div class="restricted-label">Restricted · accessibility &amp; accommodation</div>' +
              '<div class="freetext">' + esc(v.accommodationText) + '</div>' +
              '<p class="cell-sub" style="margin-top:10px">Not shown in the directory, notification emails or CSV exports.</p>' +
            '</div></div></section>'
          : '') +

        '<section class="panel"><div class="panel-head"><h2>Notes</h2></div><div class="panel-body">' +
          (canEdit
            ? '<form id="noteForm" style="margin-bottom:16px">' +
                '<label class="filter-field" for="noteText"><span style="font-size:.74rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600">Add a note</span></label>' +
                '<textarea id="noteText" class="crm-textarea" rows="3" maxlength="2000" required></textarea>' +
                '<div class="btn-row" style="margin-top:8px"><button class="btn btn-primary btn-sm" type="submit">Save note</button></div>' +
              '</form>'
            : '') +
          (data.notes.length
            ? data.notes.map(function (n) {
                return '<div class="note-item"><div class="freetext">' + esc(n.note) + '</div>' +
                  '<div class="note-meta">' + esc(n.by) + ' · ' + esc(fmtDate(n.at)) + '</div></div>';
              }).join('')
            : '<p class="cell-sub">No notes yet.</p>') +
        '</div></section>' +

      '</div><div>' +

        (canEdit
          ? '<section class="panel"><div class="panel-head"><h2>Actions</h2></div><div class="panel-body">' +
              '<div class="filter-field" style="margin-bottom:12px">' +
                '<label for="statusSelect">Status</label>' +
                '<select id="statusSelect">' +
                  STATUSES.map(function (s) {
                    return '<option value="' + esc(s) + '"' + (s === v.status ? ' selected' : '') + '>' + esc(s) + '</option>';
                  }).join('') +
                '</select>' +
              '</div>' +
              notifyBlock() +
              '<div class="btn-row">' +
                '<button class="btn btn-primary btn-sm" id="saveStatus">Update status</button>' +
                '<button class="btn btn-quiet btn-sm" id="toggleArchive">' + (v.archivedAt ? 'Restore' : 'Archive') + '</button>' +
              '</div>' +
              '<p class="cell-sub" style="margin-top:10px">Archiving hides the record from the directory. Nothing is deleted.</p>' +
            '</div></section>'
          : '') +

        '<section class="panel"><div class="panel-head"><h2>Emails</h2></div><div class="panel-body">' +
          (data.communications.length
            ? data.communications.map(function (c) {
                return '<div class="note-item">' +
                  '<div><strong>' + esc(c.type) + '</strong> · <span class="mail-' + esc(c.status) + '">' + esc(c.status) + '</span></div>' +
                  '<div class="note-meta">' + esc(c.to) + ' · ' + esc(fmtDate(c.createdAt)) +
                    (c.error ? '<br />' + esc(c.error) : '') + '</div>' +
                  (c.status === 'FAILED' && canEdit
                    ? '<div style="margin-top:6px"><button class="btn btn-quiet btn-sm" data-retry="' + esc(c.id) + '">Retry</button></div>'
                    : '') +
                  '</div>';
              }).join('')
            : '<p class="cell-sub">No emails recorded.</p>') +
        '</div></section>' +

        '<section class="panel"><div class="panel-head"><h2>Activity</h2></div><div class="panel-body">' +
          (data.activity.length
            ? data.activity.map(function (a) {
                return '<div class="note-item"><div>' + esc(a.action) + '</div>' +
                  '<div class="note-meta">' + esc(a.actor) + ' · ' + esc(fmtDate(a.at)) + '</div></div>';
              }).join('')
            : '<p class="cell-sub">No recorded activity.</p>') +
        '</div></section>' +

      '</div></div>';

    view.innerHTML = html;

    view.querySelectorAll('[data-retry]').forEach(function (btn) {
      btn.addEventListener('click', function () { retryEmail(btn); });
    });

    var noteForm = document.getElementById('noteForm');
    if (noteForm) {
      noteForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        var text = document.getElementById('noteText').value.trim();
        if (!text) return;
        try {
          await api('/volunteers/' + encodeURIComponent(v.id) + '/notes', {
            method: 'POST',
            body: JSON.stringify({ note: text })
          });
          renderProfile(ref);
        } catch (err) { handleApiError(err); }
      });
    }

    var statusSelect = document.getElementById('statusSelect');
    if (statusSelect) wireNotify(statusSelect, NOTIFIABLE, v.status);

    var saveStatus = document.getElementById('saveStatus');
    if (saveStatus) {
      saveStatus.addEventListener('click', async function () {
        saveStatus.disabled = true;
        var notifyEl = document.getElementById('notifyPerson');
        var noteEl = document.getElementById('notifyNote');
        var wantsNotify = !!(notifyEl && notifyEl.checked);

        if (wantsNotify) saveStatus.textContent = 'Saving and sending…';

        try {
          var res = await api('/volunteers/' + encodeURIComponent(v.id), {
            method: 'PATCH',
            body: JSON.stringify({
              status: statusSelect.value,
              notify: wantsNotify,
              note: wantsNotify && noteEl ? noteEl.value : ''
            })
          });
          reportNotify(res.notified);
          renderProfile(ref);
        } catch (err) {
          saveStatus.disabled = false;
          saveStatus.textContent = 'Update status';
          handleApiError(err);
        }
      });
    }

    var toggleArchive = document.getElementById('toggleArchive');
    if (toggleArchive) {
      toggleArchive.addEventListener('click', async function () {
        toggleArchive.disabled = true;
        try {
          await api('/volunteers/' + encodeURIComponent(v.id), {
            method: 'PATCH',
            body: JSON.stringify({ archived: !v.archivedAt })
          });
          renderProfile(ref);
        } catch (err) { toggleArchive.disabled = false; handleApiError(err); }
      });
    }
  }

  function row(label, valueHtml) {
    return '<dt>' + esc(label) + '</dt><dd>' + valueHtml + '</dd>';
  }

  function textPanel(title, text) {
    return '<section class="panel"><div class="panel-head"><h2>' + esc(title) + '</h2></div>' +
      '<div class="panel-body"><div class="freetext">' + esc(text) + '</div></div></section>';
  }

  /* ---------------- enquiries ---------------- */

  async function renderEnquiries(query) {
    setNav('enquiries');
    setLoading(true);

    var params = new URLSearchParams(query || '');
    var data;
    try { data = await api('/enquiries?' + params.toString()); }
    catch (err) { view.innerHTML = ''; return handleApiError(err); }

    setActor(data.actor);
    setLoading(false);

    var html =
      '<h1 class="crm-page-title">Enquiries</h1>' +
      '<p class="crm-page-sub">' + esc(data.total) + ' record' + (data.total === 1 ? '' : 's') +
      ' — item donations, financial support, questions and anything else.</p>' +

      '<section class="panel"><div class="panel-body">' +
      '<form class="filters" id="filterForm">' +
        '<div class="filter-field filter-grow"><label for="fq">Search</label>' +
          '<input id="fq" name="q" type="search" placeholder="Name, email, phone or reference" value="' + esc(params.get('q') || '') + '" /></div>' +
        selectField('type', 'Type', Object.keys(ENQUIRY_TYPE_LABELS), params.get('type'), ENQUIRY_TYPE_LABELS) +
        selectField('status', 'Status', ENQUIRY_STATUSES, params.get('status')) +
        '<div class="filter-field"><label for="ffunds">Donations</label>' +
          '<select id="ffunds" name="funds">' +
            '<option value="">Any</option>' +
            '<option value="awaiting"' + (params.get('funds') === 'awaiting' ? ' selected' : '') + '>Awaiting funds</option>' +
            '<option value="received"' + (params.get('funds') === 'received' ? ' selected' : '') + '>Funds received</option>' +
          '</select></div>' +
        '<div class="btn-row">' +
          '<button type="submit" class="btn btn-primary">Apply</button>' +
          '<a class="btn btn-quiet" href="#/enquiries">Reset</a>' +
        '</div>' +
      '</form></div></section>';

    html += '<section class="panel">';
    if (!data.results.length) {
      html += '<div class="panel-empty">No enquiries match these filters.</div>';
    } else {
      html += '<div class="table-scroll"><table class="crm-table"><thead><tr>' +
        '<th>Reference</th><th>From</th><th>Type</th><th>Amount</th>' +
        '<th>Received</th><th>Status</th>' +
        '</tr></thead><tbody>' +
        data.results.map(function (r) {
          // Only financial rows carry money, so the amount and funds columns
          // stay blank rather than showing a misleading dash for everything.
          var money = r.type === 'FINANCIAL'
            ? esc(r.amountReceived || r.amountDeclared || '—') +
              (r.amountReceived ? '' : '<span class="cell-sub">pledged</span>')
            : '<span class="cell-sub">—</span>';

          var funds = r.type !== 'FINANCIAL'
            ? '<span class="cell-sub">—</span>'
            : (r.fundsReceived
                ? '<span class="mail-SENT">Received</span>'
                : '<span class="mail-PENDING">Awaiting</span>');

          return '<tr>' +
            '<td><a class="ref-link" href="#/enquiries/' + encodeURIComponent(r.reference) + '">' + esc(r.reference) + '</a></td>' +
            '<td>' + esc(r.name) + '<span class="cell-sub">' + esc(r.email) + '</span></td>' +
            '<td><span class="chip">' + esc(ENQUIRY_TYPE_LABELS[r.type] || r.type) + '</span></td>' +
            '<td>' + money + '</td>' +
            '<td>' + funds + '</td>' +
            '<td>' + badge(r.status) + '</td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';

      if (data.pages > 1) {
        html += '<div class="pagination">' +
          pageLink(params, data.page - 1, '← Previous', data.page <= 1, '#/enquiries') +
          '<span>Page ' + esc(data.page) + ' of ' + esc(data.pages) + '</span>' +
          pageLink(params, data.page + 1, 'Next →', data.page >= data.pages, '#/enquiries') +
          '</div>';
      }
    }
    html += '</section>';

    view.innerHTML = html;

    document.getElementById('filterForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var next = new URLSearchParams();
      fd.forEach(function (value, key) { if (value) next.set(key, value); });
      location.hash = '#/enquiries' + (next.toString() ? '?' + next.toString() : '');
    });
  }

  async function renderEnquiry(ref) {
    setNav('enquiries');
    setLoading(true);

    var data;
    try { data = await api('/enquiries/' + encodeURIComponent(ref)); }
    catch (err) { view.innerHTML = ''; return handleApiError(err); }

    setActor(data.actor);
    setLoading(false);

    var e = data.enquiry;
    var canEdit = ['COORDINATOR', 'ADMIN', 'OWNER'].indexOf(data.actor.role) !== -1;
    var canConfirmFunds = ['ADMIN', 'OWNER'].indexOf(data.actor.role) !== -1;

    var typeSpecific = '';
    if (e.type === 'ITEM_DONATION') {
      typeSpecific =
        '<section class="panel"><div class="panel-head"><h2>Items offered</h2></div><div class="panel-body">' +
        '<dl class="kv">' +
          row('Categories', labelChips(e.itemTypes, ITEM_LABELS)) +
          row('Pick-up needed', e.pickupNeeded === null ? '—' : (e.pickupNeeded ? 'Yes' : 'No')) +
          row('Preferred date', esc(fmtDateShort(e.preferredDate))) +
        '</dl>' +
        (e.itemDescription
          ? '<div style="margin-top:14px"><div class="cell-sub">Description</div><div class="freetext">' + esc(e.itemDescription) + '</div></div>'
          : '') +
        '</div></section>';
    } else if (e.message) {
      typeSpecific = textPanel('Message', e.message);
    }

    var moneyPanel = '';
    if (e.type === 'FINANCIAL') {
      moneyPanel =
        '<section class="panel"><div class="panel-head"><h2>Donation</h2></div><div class="panel-body">' +
        '<dl class="kv">' +
          row('Pledged', e.amountDeclared ? esc(e.amountDeclared) : '<span class="cell-sub">not stated</span>') +
          row('Received', e.fundsReceived
            ? '<strong>' + esc(e.amountReceived || 'confirmed') + '</strong>'
            : '<span class="mail-PENDING">Not yet confirmed</span>') +
          (e.fundsReceived
            ? row('Confirmed by', esc(e.receivedBy) + '<span class="cell-sub">' + esc(fmtDate(e.receivedAt)) + '</span>')
            : '') +
          (e.receiptSentAt ? row('Thank-you sent', esc(fmtDate(e.receiptSentAt))) : '') +
        '</dl>' +

        (!e.fundsReceived && canConfirmFunds
          ? '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
              '<div class="filter-field" style="margin-bottom:10px">' +
                '<label for="amountReceived">Amount actually received</label>' +
                '<input id="amountReceived" type="text" maxlength="40" value="' + esc(e.amountDeclared || '') + '" />' +
              '</div>' +
              '<label class="form-checkbox" style="display:flex;gap:8px;align-items:center;margin-bottom:10px">' +
                '<input type="checkbox" id="sendThanks" checked /> <span>Send the donor a thank-you email</span>' +
              '</label>' +
              '<button class="btn btn-primary btn-sm" id="confirmFunds">Confirm funds received</button>' +
              '<p class="cell-sub" style="margin-top:10px">Records that you have checked the account and the money arrived. ' +
              'The email thanks them and states plainly that it is not a tax receipt.</p>' +
            '</div>'
          : '') +

        (!e.fundsReceived && !canConfirmFunds
          ? '<p class="cell-sub" style="margin-top:12px">Confirming a donation requires an Admin or Owner role.</p>'
          : '') +

        '</div></section>';
    }

    var html =
      '<p><a href="#/enquiries">← Back to enquiries</a></p>' +
      '<h1 class="crm-page-title">' + esc(e.name) + ' ' + badge(e.status) + '</h1>' +
      '<p class="crm-page-sub"><span class="ref-link">' + esc(e.reference) + '</span> · ' +
        esc(ENQUIRY_TYPE_LABELS[e.type] || e.type) + ' · received ' + esc(fmtDate(e.submittedAt)) + '</p>' +

      '<div class="profile-grid"><div>' +

        '<section class="panel"><div class="panel-head"><h2>Details</h2></div><div class="panel-body">' +
          '<dl class="kv">' +
            row('Email', '<a href="mailto:' + esc(e.email) + '">' + esc(e.email) + '</a>') +
            row('Phone', e.phone ? esc(e.phone) : '—') +
            row('Last contact', esc(fmtDateShort(e.lastContactAt))) +
            row('Consent', esc(e.privacyConsentVersion) + '<span class="cell-sub">' + esc(fmtDateShort(e.privacyConsentAt)) + '</span>') +
          '</dl>' +
        '</div></section>' +

        typeSpecific +

        '<section class="panel"><div class="panel-head"><h2>Notes</h2></div><div class="panel-body">' +
          (canEdit
            ? '<form id="noteForm" style="margin-bottom:16px">' +
                '<textarea id="noteText" class="crm-textarea" rows="3" maxlength="2000" required placeholder="Add a note…"></textarea>' +
                '<div class="btn-row" style="margin-top:8px"><button class="btn btn-primary btn-sm" type="submit">Save note</button></div>' +
              '</form>'
            : '') +
          (data.notes.length
            ? data.notes.map(function (n) {
                return '<div class="note-item"><div class="freetext">' + esc(n.note) + '</div>' +
                  '<div class="note-meta">' + esc(n.by) + ' · ' + esc(fmtDate(n.at)) + '</div></div>';
              }).join('')
            : '<p class="cell-sub">No notes yet.</p>') +
        '</div></section>' +

      '</div><div>' +

        moneyPanel +

        (canEdit
          ? '<section class="panel"><div class="panel-head"><h2>Actions</h2></div><div class="panel-body">' +
              '<div class="filter-field" style="margin-bottom:12px">' +
                '<label for="statusSelect">Status</label>' +
                '<select id="statusSelect">' +
                  ENQUIRY_STATUSES.map(function (s) {
                    return '<option value="' + esc(s) + '"' + (s === e.status ? ' selected' : '') + '>' + esc(s) + '</option>';
                  }).join('') +
                '</select>' +
              '</div>' +
              notifyBlock() +
              '<div class="btn-row">' +
                '<button class="btn btn-primary btn-sm" id="saveStatus">Update status</button>' +
                '<button class="btn btn-quiet btn-sm" id="toggleArchive">' + (e.archivedAt ? 'Restore' : 'Archive') + '</button>' +
              '</div>' +
            '</div></section>'
          : '') +

        '<section class="panel"><div class="panel-head"><h2>Acknowledgement</h2></div><div class="panel-body">' +
          '<div>Status: <span class="mail-' + esc(e.ackStatus) + '">' + esc(e.ackStatus) + '</span></div>' +
          (e.ackError ? '<div class="note-meta">' + esc(e.ackError) + '</div>' : '') +
          '<div class="note-meta">' + esc(e.ackAttempts) + ' attempt' + (e.ackAttempts === 1 ? '' : 's') + '</div>' +
        '</div></section>' +

        // Everything sent to this person since the acknowledgement, so an
        // admin can see what they have already been told before telling them
        // something else.
        '<section class="panel"><div class="panel-head"><h2>Messages sent</h2></div><div class="panel-body">' +
          ((data.communications || []).length
            ? data.communications.map(function (c) {
                return '<div class="note-item">' +
                  '<div>' + esc(c.subject || c.type) +
                    ' <span class="mail-' + esc(c.status) + '">' + esc(c.status) + '</span></div>' +
                  (c.error ? '<div class="note-meta">' + esc(c.error) + '</div>' : '') +
                  '<div class="note-meta">' + esc(c.by || 'system') + ' · ' + esc(fmtDate(c.at)) + '</div>' +
                '</div>';
              }).join('')
            : '<p class="cell-sub">Nothing sent beyond the acknowledgement.</p>') +
        '</div></section>' +

        '<section class="panel"><div class="panel-head"><h2>Activity</h2></div><div class="panel-body">' +
          (data.activity.length
            ? data.activity.map(function (a) {
                return '<div class="note-item"><div>' + esc(a.action) + '</div>' +
                  '<div class="note-meta">' + esc(a.actor) + ' · ' + esc(fmtDate(a.at)) + '</div></div>';
              }).join('')
            : '<p class="cell-sub">No recorded activity.</p>') +
        '</div></section>' +

      '</div></div>';

    view.innerHTML = html;

    var noteForm = document.getElementById('noteForm');
    if (noteForm) {
      noteForm.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var text = document.getElementById('noteText').value.trim();
        if (!text) return;
        try {
          await api('/enquiries/' + encodeURIComponent(e.id) + '/notes', {
            method: 'POST',
            body: JSON.stringify({ note: text })
          });
          renderEnquiry(ref);
        } catch (err) { handleApiError(err); }
      });
    }

    var statusSelect = document.getElementById('statusSelect');
    if (statusSelect) wireNotify(statusSelect, ENQUIRY_NOTIFIABLE, e.status);

    var saveStatus = document.getElementById('saveStatus');
    if (saveStatus) {
      saveStatus.addEventListener('click', async function () {
        saveStatus.disabled = true;
        var notifyEl = document.getElementById('notifyPerson');
        var noteEl = document.getElementById('notifyNote');
        var wantsNotify = !!(notifyEl && notifyEl.checked);

        if (wantsNotify) saveStatus.textContent = 'Saving and sending…';

        try {
          var res = await api('/enquiries/' + encodeURIComponent(e.id), {
            method: 'PATCH',
            body: JSON.stringify({
              status: statusSelect.value,
              notify: wantsNotify,
              note: wantsNotify && noteEl ? noteEl.value : ''
            })
          });
          reportNotify(res.notified);
          renderEnquiry(ref);
        } catch (err) {
          saveStatus.disabled = false;
          saveStatus.textContent = 'Update status';
          handleApiError(err);
        }
      });
    }

    var toggleArchive = document.getElementById('toggleArchive');
    if (toggleArchive) {
      toggleArchive.addEventListener('click', async function () {
        toggleArchive.disabled = true;
        try {
          await api('/enquiries/' + encodeURIComponent(e.id), {
            method: 'PATCH',
            body: JSON.stringify({ archived: !e.archivedAt })
          });
          renderEnquiry(ref);
        } catch (err) { toggleArchive.disabled = false; handleApiError(err); }
      });
    }

    var confirmFunds = document.getElementById('confirmFunds');
    if (confirmFunds) {
      confirmFunds.addEventListener('click', async function () {
        confirmFunds.disabled = true;
        confirmFunds.textContent = 'Confirming…';
        try {
          var result = await api('/enquiries/' + encodeURIComponent(e.id) + '/confirm-funds', {
            method: 'POST',
            body: JSON.stringify({
              amount_received: document.getElementById('amountReceived').value,
              send_thanks: document.getElementById('sendThanks').checked
            })
          });
          // The confirmation stands even if the email failed, so say which
          // happened rather than implying both worked.
          if (result.enquiry && result.enquiry.thanksError) {
            showError('Donation confirmed, but the thank-you email failed',
              'The record is updated. The email reported: <code>' + esc(result.enquiry.thanksError) + '</code>');
          }
          renderEnquiry(ref);
        } catch (err) {
          confirmFunds.disabled = false;
          confirmFunds.textContent = 'Confirm funds received';
          handleApiError(err);
        }
      });
    }
  }

  /* ---------------- routing ---------------- */

  function route() {
    var hash = location.hash.replace(/^#/, '') || '/';
    var qIndex = hash.indexOf('?');
    var path = qIndex === -1 ? hash : hash.slice(0, qIndex);
    var query = qIndex === -1 ? '' : hash.slice(qIndex + 1);

    var volunteerMatch = path.match(/^\/volunteers\/(.+)$/);
    var enquiryMatch = path.match(/^\/enquiries\/(.+)$/);

    if (volunteerMatch) return renderProfile(decodeURIComponent(volunteerMatch[1]));
    if (enquiryMatch) return renderEnquiry(decodeURIComponent(enquiryMatch[1]));
    if (path === '/volunteers') return renderDirectory(query);
    if (path === '/enquiries') return renderEnquiries(query);
    return renderDashboard();
  }

  window.addEventListener('hashchange', route);
  route();
})();
