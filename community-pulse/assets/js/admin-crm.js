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

  var EVENT_STATUSES = ['DRAFT', 'SCHEDULED', 'COMPLETED', 'CANCELLED'];

  var ASSIGNMENT_STATUSES = ['ASSIGNED', 'CONFIRMED', 'ATTENDED', 'NO_SHOW', 'CANCELLED'];

  // Plain wording, because this dropdown is used while working through a
  // roster after an event and "NO_SHOW" is jargon for a person not turning up.
  var ASSIGNMENT_LABELS = {
    ASSIGNED: 'Asked',
    CONFIRMED: 'Said yes',
    ATTENDED: 'Turned up',
    NO_SHOW: 'Did not come',
    CANCELLED: 'Taken off'
  };

  // What /api/admin/communications/:id/retry can actually rebuild. It
  // regenerates ACKNOWLEDGEMENT and ADMIN_NOTIFICATION content from data
  // still on the volunteer row. STATUS_UPDATE and EVENT_ASSIGNMENT emails
  // carry a specific status transition and an optional admin-written note
  // that are not stored anywhere retrievable, so offering a Retry button for
  // them would just be a dead end - the endpoint returns 400 and nothing
  // resends. Those are shown with a prompt to follow up directly instead.
  var RETRYABLE_TYPES = { ACKNOWLEDGEMENT: true, ADMIN_NOTIFICATION: true };

  var REJECT_REASONS = {
    not_on_this_event: 'One row did not belong to this event and was ignored.',
    invalid_status: 'One row had an unrecognised status.',
    invalid_hours: 'Hours must be a number between 0 and 24.',
    hours_without_attendance: 'Hours can only be recorded against someone marked as turned up.'
  };

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
      var failedNote = data.actionQueue.failedEmailsTotal > failed.length
        ? '<span class="cell-sub">Showing the 20 most recent of ' + esc(data.actionQueue.failedEmailsTotal) + '</span>'
        : '';
      html += '<section class="panel"><div class="panel-head"><h2>Failed emails — needs attention</h2>' + failedNote + '</div>' +
        '<div class="table-scroll"><table class="crm-table"><thead><tr>' +
        '<th>Record</th><th>Type</th><th>To</th><th>Attempts</th><th>Error</th><th></th>' +
        '</tr></thead><tbody>' +
        failed.map(function (f) {
          var profileLink = '#/' + (f.kind === 'enquiry' ? 'enquiries' : 'volunteers') + '/' + encodeURIComponent(f.reference);
          var action = RETRYABLE_TYPES[f.type]
            ? '<button class="btn btn-quiet btn-sm" data-retry="' + esc(f.communicationId) + '">Retry</button>'
            : '<span class="cell-sub">Cannot auto-resend — contact them directly</span>';
          return '<tr>' +
            '<td><a class="ref-link" href="' + profileLink + '">' + esc(f.reference) + '</a>' +
              '<span class="cell-sub">' + esc(f.name) + '</span></td>' +
            '<td>' + esc(f.type) + '</td>' +
            '<td>' + esc(f.to) + '</td>' +
            '<td>' + esc(f.attempts) + '</td>' +
            '<td><span class="cell-sub">' + esc(f.error || '—') + '</span></td>' +
            '<td>' + action + '</td>' +
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

    /* ---- events ----
       Unrecorded attendance leads, because it is the only item here that
       decays: within a fortnight nobody remembers who turned up, and those
       hours are what a funder asks to see. */
    var ev = data.events;
    if (ev) {
      if (ev.needsAttendance.length) {
        html += '<section class="panel"><div class="panel-head"><h2>Attendance not recorded</h2>' +
          '<span class="cell-sub">These have already happened</span></div>' +
          '<div class="table-scroll"><table class="crm-table"><thead><tr>' +
          '<th>Event</th><th>When</th><th>Still to record</th>' +
          '</tr></thead><tbody>' +
          ev.needsAttendance.map(function (r) {
            return '<tr>' +
              '<td><a class="ref-link" href="#/events/' + encodeURIComponent(r.reference || r.id) + '">' + esc(r.title) + '</a></td>' +
              '<td>' + esc(fmtWhen(r.startsAt)) + '</td>' +
              '<td>' + esc(r.unrecorded) + ' ' + (r.unrecorded === 1 ? 'person' : 'people') + '</td>' +
              '</tr>';
          }).join('') +
          '</tbody></table></div></section>';
      }

      if (ev.upcoming.length) {
        html += '<h2 style="font-size:1rem;margin:26px 0 12px;color:var(--muted)">Coming up</h2>' +
          '<section class="panel"><div class="panel-head"><h2>Next events</h2>' +
          '<a class="btn btn-quiet btn-sm" href="#/events">View all</a></div>' +
          '<div class="table-scroll"><table class="crm-table"><thead><tr>' +
          '<th>Event</th><th>When</th><th>Where</th><th>Helpers</th>' +
          '</tr></thead><tbody>' +
          ev.upcoming.map(function (r) {
            var short = r.capacity && r.assigned < r.capacity;
            return '<tr>' +
              '<td><a class="ref-link" href="#/events/' + encodeURIComponent(r.reference || r.id) + '">' + esc(r.title) + '</a>' +
                (r.status === 'DRAFT' ? '<span class="cell-sub">draft</span>' : '') + '</td>' +
              '<td>' + esc(fmtWhen(r.startsAt)) + '</td>' +
              '<td>' + (r.location ? esc(r.location) : '<span class="cell-sub">—</span>') + '</td>' +
              '<td>' + esc(r.assigned) + (r.capacity ? ' / ' + esc(r.capacity) : '') +
                (short ? '<span class="cell-sub">needs more</span>' : '') + '</td>' +
              '</tr>';
          }).join('') +
          '</tbody></table></div></section>';
      }
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

        // Hours count attended events only, so the total can be quoted to a
        // funder without any qualifying footnote.
        (data.service
          ? '<section class="panel"><div class="panel-head"><h2>Service</h2></div>' +
            '<div class="panel-body">' +
              '<div class="stat-grid" style="margin:0 0 4px">' +
                '<div class="stat"><div class="stat-value">' + esc(data.service.totalHours) +
                  '</div><div class="stat-label">Hours given</div></div>' +
                '<div class="stat"><div class="stat-value">' + esc(data.service.eventsAttended) +
                  '</div><div class="stat-label">Events attended</div></div>' +
                '<div class="stat"><div class="stat-value">' + esc(data.service.upcoming) +
                  '</div><div class="stat-label">Coming up</div></div>' +
              '</div>' +
              (data.service.history.length
                ? data.service.history.map(function (h) {
                    return '<div class="note-item">' +
                      '<div><a class="ref-link" href="#/events/' + encodeURIComponent(h.reference || h.eventId) + '">' +
                        esc(h.title) + '</a></div>' +
                      '<div class="note-meta">' + esc(fmtWhen(h.startsAt)) + ' · ' +
                        esc(ASSIGNMENT_LABELS[h.status] || h.status) +
                        // A truthy check here would hide a legitimately
                        // recorded 0 - someone who turned up but the
                        // activity was cancelled on arrival - as if no hours
                        // had been recorded at all.
                        (h.hours === null || h.hours === undefined ? '' : ' · ' + esc(h.hours) + 'h') +
                        (h.role ? ' · ' + esc(h.role) : '') + '</div>' +
                      '</div>';
                  }).join('')
                : '<p class="cell-sub">Not yet assigned to any event.</p>') +
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
                    ? '<div style="margin-top:6px">' +
                        (RETRYABLE_TYPES[c.type]
                          ? '<button class="btn btn-quiet btn-sm" data-retry="' + esc(c.id) + '">Retry</button>'
                          : '<span class="cell-sub">Cannot auto-resend — contact them directly</span>') +
                      '</div>'
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

  /* ---------------- events ---------------- */

  /** UTC instant -> the "YYYY-MM-DDTHH:mm" a datetime-local input wants, in local time. */
  function toLocalInput(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /**
   * datetime-local value -> full ISO instant.
   * The conversion happens here rather than on the server, which refuses
   * values without a zone: only the browser knows what the admin meant.
   */
  function fromLocalInput(value) {
    if (!value) return '';
    var d = new Date(value);
    return isNaN(d) ? '' : d.toISOString();
  }

  function fmtWhen(startsAt, endsAt) {
    if (!startsAt) return '—';
    var s = new Date(startsAt);
    if (isNaN(s)) return '—';
    var dateOpts = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    var day = s.toLocaleDateString('en-CA', dateOpts);
    var from = s.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
    if (!endsAt) return day + ', ' + from;
    var e = new Date(endsAt);
    if (isNaN(e)) return day + ', ' + from;
    var to = e.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });

    // A shift crossing midnight needs the finish date spelled out, matching
    // formatEventWhen() in zoho.js - otherwise an overnight event looks like
    // an ordinary same-day one everywhere an admin actually looks, even
    // though the email a volunteer receives gets this right.
    var endDay = e.toLocaleDateString('en-CA', dateOpts);
    if (endDay !== day) return day + ', ' + from + ' until ' + endDay + ', ' + to;

    return day + ', ' + from + '–' + to;
  }

  function eventCreateForm() {
    return '<section class="panel" id="newEventPanel" hidden>' +
      '<div class="panel-head"><h2>New event</h2></div>' +
      '<div class="panel-body">' +
        '<div class="filters" style="margin-bottom:12px">' +
          '<div class="filter-field filter-grow"><label for="evTitle">What is it</label>' +
            '<input id="evTitle" type="text" maxlength="140" placeholder="Saturday food hamper packing" /></div>' +
          '<div class="filter-field filter-grow"><label for="evLocation">Where</label>' +
            '<input id="evLocation" type="text" maxlength="200" placeholder="Moncton community hall" /></div>' +
        '</div>' +
        '<div class="filters" style="margin-bottom:12px">' +
          '<div class="filter-field"><label for="evStart">Starts</label>' +
            '<input id="evStart" type="datetime-local" /></div>' +
          '<div class="filter-field"><label for="evEnd">Finishes (optional)</label>' +
            '<input id="evEnd" type="datetime-local" /></div>' +
          '<div class="filter-field"><label for="evCapacity">People needed (optional)</label>' +
            '<input id="evCapacity" type="number" min="1" max="10000" /></div>' +
        '</div>' +
        '<div class="filter-field filter-grow" style="margin-bottom:12px">' +
          '<label for="evDescription">Anything volunteers should know (optional)</label>' +
          '<textarea id="evDescription" rows="3" maxlength="2000" placeholder="Wear closed shoes. Tea and coffee provided."></textarea></div>' +
        '<p class="cell-sub">Times are in your own time zone. Volunteers are told the same moment in Atlantic time.</p>' +
        '<div class="btn-row">' +
          '<button class="btn btn-primary btn-sm" id="evSave">Create event</button>' +
          '<button class="btn btn-quiet btn-sm" id="evCancel">Cancel</button>' +
        '</div>' +
        '<div class="crm-error" id="evErrors" role="alert" hidden></div>' +
      '</div></section>';
  }

  async function renderEvents(query) {
    setNav('events');
    setLoading(true);

    var params = new URLSearchParams(query || '');
    if (!params.get('when') && !params.get('status') && !params.get('q')) {
      params.set('when', 'upcoming');
    }

    var data;
    try { data = await api('/events?' + params.toString()); }
    catch (err) { view.innerHTML = ''; return handleApiError(err); }

    setActor(data.actor);
    setLoading(false);

    var canEdit = data.actor.role !== 'VIEWER';
    var when = params.get('when') || '';

    var html =
      '<h1 class="crm-page-title">Events</h1>' +
      '<p class="crm-page-sub">' + esc(data.total) + ' ' + (data.total === 1 ? 'event' : 'events') + '</p>' +
      (canEdit
        ? '<div class="btn-row" style="margin-bottom:18px">' +
            '<button class="btn btn-primary btn-sm" id="newEventBtn">New event</button></div>'
        : '') +
      (canEdit ? eventCreateForm() : '') +
      '<form class="filters" id="eventFilters" style="margin-bottom:18px">' +
        '<div class="filter-field filter-grow"><label for="fq">Search</label>' +
          '<input id="fq" name="q" type="search" value="' + esc(params.get('q') || '') + '" placeholder="Title or place" /></div>' +
        '<div class="filter-field"><label for="fwhen">Showing</label>' +
          '<select id="fwhen" name="when">' +
            '<option value="upcoming"' + (when === 'upcoming' ? ' selected' : '') + '>Upcoming</option>' +
            '<option value="past"' + (when === 'past' ? ' selected' : '') + '>Past</option>' +
            '<option value=""' + (when === '' ? ' selected' : '') + '>All</option>' +
          '</select></div>' +
        selectField('status', 'Status', EVENT_STATUSES, params.get('status')) +
        '<div class="btn-row">' +
          '<button class="btn btn-primary btn-sm" type="submit">Apply</button>' +
          '<a class="btn btn-quiet" href="#/events">Reset</a>' +
        '</div>' +
      '</form>';

    if (!data.results.length) {
      html += '<div class="panel-empty">No events match these filters.</div>';
    } else {
      html += '<section class="panel"><div class="table-scroll"><table class="crm-table"><thead><tr>' +
        '<th>Event</th><th>When</th><th>Where</th><th>Helpers</th><th>Hours</th><th>Status</th>' +
        '</tr></thead><tbody>' +
        data.results.map(function (r) {
          var helpers = esc(r.assigned) + (r.capacity ? ' / ' + esc(r.capacity) : '');
          var short = r.capacity && r.assigned < r.capacity;
          return '<tr>' +
            '<td><a class="ref-link" href="#/events/' + encodeURIComponent(r.reference || r.id) + '">' + esc(r.title) + '</a>' +
              '<span class="cell-sub">' + esc(r.reference || '') + '</span></td>' +
            '<td>' + esc(fmtWhen(r.startsAt, r.endsAt)) + '</td>' +
            '<td>' + (r.location ? esc(r.location) : '<span class="cell-sub">—</span>') + '</td>' +
            '<td>' + helpers + (short ? '<span class="cell-sub">needs more</span>' : '') + '</td>' +
            '<td>' + (r.totalHours ? esc(r.totalHours) : '<span class="cell-sub">—</span>') + '</td>' +
            '<td>' + badge(r.status) + '</td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';

      if (data.pages > 1) {
        html += '<div class="pagination">' +
          pageLink(params, data.page - 1, '← Previous', data.page <= 1, '#/events') +
          '<span class="cell-sub">Page ' + esc(data.page) + ' of ' + esc(data.pages) + '</span>' +
          pageLink(params, data.page + 1, 'Next →', data.page >= data.pages, '#/events') +
          '</div>';
      }
      html += '</section>';
    }

    view.innerHTML = html;

    document.getElementById('eventFilters').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var next = new URLSearchParams();
      new FormData(ev.target).forEach(function (value, key) {
        if (String(value).trim()) next.set(key, value);
      });
      location.hash = '#/events' + (next.toString() ? '?' + next.toString() : '');
    });

    var newBtn = document.getElementById('newEventBtn');
    var panel = document.getElementById('newEventPanel');
    if (newBtn && panel) {
      newBtn.addEventListener('click', function () {
        panel.hidden = !panel.hidden;
        if (!panel.hidden) document.getElementById('evTitle').focus();
      });
      document.getElementById('evCancel').addEventListener('click', function () { panel.hidden = true; });

      document.getElementById('evSave').addEventListener('click', async function () {
        var btn = this;
        var errBox = document.getElementById('evErrors');
        errBox.hidden = true;
        btn.disabled = true;

        var payload = {
          title: document.getElementById('evTitle').value,
          location: document.getElementById('evLocation').value,
          starts_at: fromLocalInput(document.getElementById('evStart').value),
          ends_at: fromLocalInput(document.getElementById('evEnd').value),
          capacity: document.getElementById('evCapacity').value,
          description: document.getElementById('evDescription').value,
          status: 'SCHEDULED'
        };

        try {
          var created = await api('/events', { method: 'POST', body: JSON.stringify(payload) });
          location.hash = '#/events/' + encodeURIComponent(created.event.reference);
        } catch (err) {
          btn.disabled = false;
          var fields = err.body && err.body.fields;
          errBox.innerHTML = '<h2>That could not be saved</h2>' +
            (fields
              ? '<ul>' + Object.keys(fields).map(function (k) {
                  return '<li>' + esc(fields[k]) + '</li>';
                }).join('') + '</ul>'
              : '<p>' + esc(err.message) + '</p>');
          errBox.hidden = false;
        }
      });
    }
  }

  async function renderEvent(ref) {
    setNav('events');
    setLoading(true);

    var data;
    try { data = await api('/events/' + encodeURIComponent(ref)); }
    catch (err) { view.innerHTML = ''; return handleApiError(err); }

    setActor(data.actor);
    setLoading(false);

    var e = data.event;
    var canEdit = data.actor.role !== 'VIEWER';
    var isPast = e.startsAt < new Date().toISOString();

    var rosterRows = data.roster.filter(function (r) { return r.status !== 'CANCELLED'; });
    var removed = data.roster.filter(function (r) { return r.status === 'CANCELLED'; });

    var html =
      '<p><a href="#/events">← Back to events</a></p>' +
      '<h1 class="crm-page-title">' + esc(e.title) + ' ' + badge(e.status) + '</h1>' +
      '<p class="crm-page-sub">' + esc(e.reference) + ' · ' + esc(fmtWhen(e.startsAt, e.endsAt)) +
        (e.location ? ' · ' + esc(e.location) : '') + '</p>' +

      '<div class="stat-grid">' +
        '<div class="stat"><div class="stat-value">' + esc(e.assignedCount) +
          (e.capacity ? ' / ' + esc(e.capacity) : '') + '</div><div class="stat-label">Helpers</div></div>' +
        '<div class="stat"><div class="stat-value">' + esc(e.attendedCount) + '</div><div class="stat-label">Attended</div></div>' +
        '<div class="stat"><div class="stat-value">' + esc(e.totalHours) + '</div><div class="stat-label">Hours recorded</div></div>' +
      '</div>' +

      '<div class="profile-grid"><div>' +

        (e.description
          ? '<section class="panel"><div class="panel-head"><h2>Details</h2></div>' +
            '<div class="panel-body"><div class="freetext">' + esc(e.description) + '</div></div></section>'
          : '') +

        (canEdit
          ? '<section class="panel">' +
              '<div class="panel-head"><h2>Change details</h2>' +
                '<button class="btn btn-quiet btn-sm" id="editToggle">Edit</button></div>' +
              '<div class="panel-body" id="editPanel" hidden>' +
                '<div class="filters" style="margin-bottom:12px">' +
                  '<div class="filter-field filter-grow"><label for="edTitle">What is it</label>' +
                    '<input id="edTitle" type="text" maxlength="140" value="' + esc(e.title) + '" /></div>' +
                  '<div class="filter-field filter-grow"><label for="edLocation">Where</label>' +
                    '<input id="edLocation" type="text" maxlength="200" value="' + esc(e.location || '') + '" /></div>' +
                '</div>' +
                '<div class="filters" style="margin-bottom:12px">' +
                  '<div class="filter-field"><label for="edStart">Starts</label>' +
                    '<input id="edStart" type="datetime-local" value="' + esc(toLocalInput(e.startsAt)) + '" /></div>' +
                  '<div class="filter-field"><label for="edEnd">Finishes (optional)</label>' +
                    '<input id="edEnd" type="datetime-local" value="' + esc(toLocalInput(e.endsAt)) + '" /></div>' +
                  '<div class="filter-field"><label for="edCapacity">People needed (optional)</label>' +
                    '<input id="edCapacity" type="number" min="1" max="10000" value="' +
                      (e.capacity === null || e.capacity === undefined ? '' : esc(e.capacity)) + '" /></div>' +
                '</div>' +
                '<div class="filter-field filter-grow" style="margin-bottom:12px">' +
                  '<label for="edDescription">Anything volunteers should know (optional)</label>' +
                  '<textarea id="edDescription" rows="3" maxlength="2000">' + esc(e.description || '') + '</textarea></div>' +

                // Only offered when the time or place actually moved. Editing a
                // typo in the description should not email twelve people.
                '<div id="changeNotice" hidden style="margin-bottom:12px">' +
                  '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">' +
                    '<input type="checkbox" id="notifyChange" checked style="margin-top:3px" />' +
                    '<span>Email everyone on the roster about the change</span>' +
                  '</label>' +
                  '<textarea id="changeNote" rows="2" placeholder="Optional: why it moved, or anything else they should know." style="margin-top:8px"></textarea>' +
                  '<p class="cell-sub" style="margin:6px 0 0">They will see what changed, and the new details in full.</p>' +
                '</div>' +

                '<div class="btn-row">' +
                  '<button class="btn btn-primary btn-sm" id="edSave">Save changes</button>' +
                  '<button class="btn btn-quiet btn-sm" id="edCancel">Cancel</button>' +
                '</div>' +
                '<div class="crm-error" id="edErrors" role="alert" hidden></div>' +
              '</div>' +
            '</section>'
          : '') +

        '<section class="panel"><div class="panel-head"><h2>Who is helping</h2>' +
          (isPast && canEdit ? '<span class="cell-sub">Record attendance below</span>' : '') +
        '</div>';

    if (!rosterRows.length) {
      html += '<div class="panel-empty">Nobody assigned yet.</div>';
    } else {
      html += '<div class="table-scroll"><table class="crm-table"><thead><tr>' +
        '<th>Volunteer</th><th>Role</th><th>Turned up</th><th>Hours</th>' +
        '</tr></thead><tbody>' +
        rosterRows.map(function (r) {
          return '<tr data-assignment="' + esc(r.assignmentId) + '">' +
            '<td><a class="ref-link" href="#/volunteers/' + encodeURIComponent(r.reference) + '">' + esc(r.name) + '</a>' +
              '<span class="cell-sub">' + esc(r.email) +
              (r.notifiedAt ? ' · emailed' : ' · not emailed') + '</span></td>' +
            '<td>' + (canEdit
              ? '<input type="text" class="ro-role" maxlength="80" value="' + esc(r.role || '') + '" style="width:8rem" />'
              : (r.role ? esc(r.role) : '<span class="cell-sub">—</span>')) + '</td>' +
            '<td>' + (canEdit
              ? '<select class="ro-status">' + ASSIGNMENT_STATUSES.map(function (s) {
                  return '<option value="' + esc(s) + '"' + (s === r.status ? ' selected' : '') + '>' +
                    esc(ASSIGNMENT_LABELS[s] || s) + '</option>';
                }).join('') + '</select>'
              : esc(ASSIGNMENT_LABELS[r.status] || r.status)) + '</td>' +
            '<td>' + (canEdit
              ? '<input type="number" class="ro-hours" min="0" max="24" step="0.25" value="' +
                (r.hours === null || r.hours === undefined ? '' : esc(r.hours)) + '" style="width:5rem" />'
              : (r.hours === null || r.hours === undefined ? '<span class="cell-sub">—</span>' : esc(r.hours))) + '</td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';

      if (canEdit) {
        html += '<div class="panel-body">' +
          '<p class="cell-sub">Hours can only be recorded against someone marked <strong>Turned up</strong>.</p>' +
          '<div class="btn-row">' +
            '<button class="btn btn-primary btn-sm" id="saveAttendance">Save attendance and hours</button>' +
            '<button class="btn btn-quiet btn-sm" id="markAllAttended">Mark everyone as turned up</button>' +
          '</div></div>';
      }
    }

    html += '</section>';

    if (removed.length) {
      html += '<section class="panel"><div class="panel-head"><h2>Taken off this event</h2></div>' +
        '<div class="panel-body">' + removed.map(function (r) {
          return '<div class="note-item"><div>' + esc(r.name) + '</div></div>';
        }).join('') + '</div></section>';
    }

    if (canEdit && e.status !== 'CANCELLED') {
      html += '<section class="panel"><div class="panel-head"><h2>Add volunteers</h2></div>' +
        '<div class="panel-body">' +
          '<div class="filters">' +
            '<div class="filter-field filter-grow"><label for="volSearch">Narrow the list</label>' +
              '<input id="volSearch" type="search" placeholder="Start typing a name" /></div>' +
            '<div class="filter-field"><label for="assignRole">Role for these people (optional)</label>' +
              '<input id="assignRole" type="text" maxlength="80" placeholder="Driver" /></div>' +
          '</div>' +
          '<div id="volResults" style="margin-top:12px"></div>' +
          // Outside the results box on purpose: the list re-renders on every
          // keystroke, and anything typed in here must survive that.
          '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;margin:12px 0">' +
            '<input type="checkbox" id="notifyAssign" checked style="margin-top:3px" />' +
            '<span>Email them the date, time and place</span>' +
          '</label>' +
          '<textarea id="assignNote" rows="2" placeholder="Optional: anything to add to that email."></textarea>' +
          '<div class="btn-row" style="margin-top:10px">' +
            '<button class="btn btn-primary btn-sm" id="assignBtn" disabled>Add selected</button>' +
            '<span class="cell-sub" id="pickCount">Nobody selected</span>' +
          '</div>' +
        '</div></section>';
    }

    html += '</div><div>';

    if (canEdit) {
      html += '<section class="panel"><div class="panel-head"><h2>Actions</h2></div><div class="panel-body">' +
        '<div class="filter-field" style="margin-bottom:12px">' +
          '<label for="evStatus">Status</label>' +
          '<select id="evStatus">' +
            EVENT_STATUSES.map(function (s) {
              return '<option value="' + esc(s) + '"' + (s === e.status ? ' selected' : '') + '>' + esc(s) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div id="cancelNotice" hidden style="margin-bottom:12px">' +
          '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">' +
            '<input type="checkbox" id="notifyCancel" checked style="margin-top:3px" />' +
            '<span>Email everyone on the roster that it is off</span>' +
          '</label>' +
          '<textarea id="cancelNote" rows="2" placeholder="Optional: why, or what happens instead." style="margin-top:8px"></textarea>' +
        '</div>' +
        '<div class="btn-row">' +
          '<button class="btn btn-primary btn-sm" id="saveEventStatus">Update status</button>' +
          '<button class="btn btn-quiet btn-sm" id="toggleEventArchive">' + (e.archivedAt ? 'Restore' : 'Archive') + '</button>' +
        '</div>' +
        '<p class="cell-sub" style="margin-top:10px">Cancelling keeps the record and the roster. Nothing is deleted.</p>' +
      '</div></section>';
    }

    html += '<section class="panel"><div class="panel-head"><h2>Activity</h2></div><div class="panel-body">' +
      (data.activity.length
        ? data.activity.map(function (a) {
            return '<div class="note-item"><div>' + esc(a.action) + '</div>' +
              '<div class="note-meta">' + esc(a.actor) + ' · ' + esc(fmtDate(a.at)) + '</div></div>';
          }).join('')
        : '<p class="cell-sub">No recorded activity.</p>') +
      '</div></section>';

    html += '</div></div>';

    view.innerHTML = html;

    /* ---- attendance ---- */

    function collectEntries() {
      return [].slice.call(view.querySelectorAll('tr[data-assignment]')).map(function (tr) {
        var hoursEl = tr.querySelector('.ro-hours');
        var status = tr.querySelector('.ro-status').value;

        // Hours are only ever sent for someone marked as turned up. The server
        // refuses hours against any other status and skips the whole row, so
        // sending a stale value here used to make correcting a mistaken
        // attendance impossible: the box kept its old number, the row was
        // rejected, and the person stayed marked as having attended.
        var hours = status === 'ATTENDED' && hoursEl && hoursEl.value !== ''
          ? hoursEl.value
          : null;

        return {
          assignment_id: tr.dataset.assignment,
          status: status,
          hours: hours,
          role: tr.querySelector('.ro-role').value
        };
      });
    }

    // Keep the hours box honest as the status changes, so what is on screen
    // matches what will be saved.
    function syncHoursBox(tr) {
      var status = tr.querySelector('.ro-status').value;
      var hoursEl = tr.querySelector('.ro-hours');
      if (!hoursEl) return;

      var attended = status === 'ATTENDED';
      hoursEl.disabled = !attended;
      hoursEl.title = attended ? '' : 'Only someone marked as turned up can have hours.';
      if (!attended) hoursEl.value = '';
    }

    view.querySelectorAll('tr[data-assignment]').forEach(function (tr) {
      var sel = tr.querySelector('.ro-status');
      if (!sel) return;
      sel.addEventListener('change', function () { syncHoursBox(tr); });
      syncHoursBox(tr);
    });

    var markAll = document.getElementById('markAllAttended');
    if (markAll) {
      markAll.addEventListener('click', function () {
        view.querySelectorAll('tr[data-assignment]').forEach(function (tr) {
          tr.querySelector('.ro-status').value = 'ATTENDED';
          syncHoursBox(tr);
        });
      });
    }

    var saveAtt = document.getElementById('saveAttendance');
    if (saveAtt) {
      saveAtt.addEventListener('click', async function () {
        saveAtt.disabled = true;
        saveAtt.textContent = 'Saving…';
        try {
          var res = await api('/events/' + encodeURIComponent(e.id) + '/attendance', {
            method: 'POST',
            body: JSON.stringify({ entries: collectEntries() })
          });
          // Rejected rows were not saved at all. Hours-dropped rows *were*
          // saved - the status change went through - only their hours were
          // set aside, so this is reported as a separate, less alarming
          // message rather than folded into "not saved".
          if (res.rejected && res.rejected.length) {
            showError('Some rows were not saved',
              '<ul>' + res.rejected.map(function (r) {
                return '<li>' + esc(REJECT_REASONS[r.reason] || r.reason) + '</li>';
              }).join('') + '</ul>');
          } else if (res.hoursDropped && res.hoursDropped.length) {
            showError('Saved, but some hours were not recorded',
              'Hours only count against someone marked as turned up. ' +
              esc(res.hoursDropped.length) + (res.hoursDropped.length === 1 ? ' row had' : ' rows had') +
              ' hours entered against a different status, so the status change was saved and the hours were left blank.');
          }
          renderEvent(ref);
        } catch (err) {
          saveAtt.disabled = false;
          saveAtt.textContent = 'Save attendance and hours';
          handleApiError(err);
        }
      });
    }

    /* ---- editing the event ---- */

    var editToggle = document.getElementById('editToggle');
    if (editToggle) {
      var editPanel = document.getElementById('editPanel');
      var changeNotice = document.getElementById('changeNotice');

      editToggle.addEventListener('click', function () {
        editPanel.hidden = !editPanel.hidden;
        editToggle.textContent = editPanel.hidden ? 'Edit' : 'Close';
        if (!editPanel.hidden) document.getElementById('edTitle').focus();
      });

      document.getElementById('edCancel').addEventListener('click', function () {
        editPanel.hidden = true;
        editToggle.textContent = 'Edit';
      });

      // Watch the fields volunteers would need to be told about, and only then
      // offer to email them.
      var watched = ['edStart', 'edEnd', 'edLocation'];
      var originals = {
        edStart: toLocalInput(e.startsAt),
        edEnd: toLocalInput(e.endsAt),
        edLocation: e.location || ''
      };

      var syncChangeNotice = function () {
        var moved = watched.some(function (id) {
          return document.getElementById(id).value !== originals[id];
        });
        changeNotice.hidden = !(moved && rosterRows.length && e.status !== 'CANCELLED');
      };

      watched.forEach(function (id) {
        document.getElementById(id).addEventListener('input', syncChangeNotice);
        document.getElementById(id).addEventListener('change', syncChangeNotice);
      });
      syncChangeNotice();

      document.getElementById('edSave').addEventListener('click', async function () {
        var btn = this;
        var errBox = document.getElementById('edErrors');
        errBox.hidden = true;
        btn.disabled = true;

        var notify = !changeNotice.hidden && document.getElementById('notifyChange').checked;
        btn.textContent = notify ? 'Saving and emailing…' : 'Saving…';

        var payload = {
          title: document.getElementById('edTitle').value,
          location: document.getElementById('edLocation').value,
          starts_at: fromLocalInput(document.getElementById('edStart').value),
          ends_at: fromLocalInput(document.getElementById('edEnd').value),
          capacity: document.getElementById('edCapacity').value,
          description: document.getElementById('edDescription').value,
          notify: notify,
          note: notify ? document.getElementById('changeNote').value : ''
        };

        try {
          var res = await api('/events/' + encodeURIComponent(e.id), {
            method: 'PATCH',
            body: JSON.stringify(payload)
          });
          if (res.notified && res.notified.failures && res.notified.failures.length) {
            showError('Saved, but some emails did not send',
              esc(res.notified.sent) + ' of ' + esc(res.notified.attempted) +
              ' went out. Please tell the rest yourself.');
          }
          renderEvent(ref);
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Save changes';
          var fields = err.body && err.body.fields;
          errBox.innerHTML = '<h2>That could not be saved</h2>' +
            (fields
              ? '<ul>' + Object.keys(fields).map(function (k) {
                  return '<li>' + esc(fields[k]) + '</li>';
                }).join('') + '</ul>'
              : '<p>' + esc(err.message) + '</p>');
          errBox.hidden = false;
        }
      });
    }

    /* ---- status / cancellation ---- */

    var statusSel = document.getElementById('evStatus');
    var cancelBox = document.getElementById('cancelNotice');
    if (statusSel && cancelBox) {
      var syncCancel = function () {
        cancelBox.hidden = !(statusSel.value === 'CANCELLED' && e.status !== 'CANCELLED' && rosterRows.length);
      };
      statusSel.addEventListener('change', syncCancel);
      syncCancel();
    }

    var saveStatusBtn = document.getElementById('saveEventStatus');
    if (saveStatusBtn) {
      saveStatusBtn.addEventListener('click', async function () {
        saveStatusBtn.disabled = true;
        var cancelling = statusSel.value === 'CANCELLED' && e.status !== 'CANCELLED';
        var notify = cancelling && document.getElementById('notifyCancel').checked;
        if (notify) saveStatusBtn.textContent = 'Saving and emailing…';

        try {
          var res = await api('/events/' + encodeURIComponent(e.id), {
            method: 'PATCH',
            body: JSON.stringify({
              status: statusSel.value,
              notify: notify,
              note: notify ? document.getElementById('cancelNote').value : ''
            })
          });
          if (res.notified && res.notified.failures && res.notified.failures.length) {
            showError('Cancelled, but some emails did not send',
              esc(res.notified.sent) + ' of ' + esc(res.notified.attempted) +
              ' went out. Please contact the rest directly.');
          }
          renderEvent(ref);
        } catch (err) {
          saveStatusBtn.disabled = false;
          saveStatusBtn.textContent = 'Update status';
          handleApiError(err);
        }
      });
    }

    var archBtn = document.getElementById('toggleEventArchive');
    if (archBtn) {
      archBtn.addEventListener('click', async function () {
        archBtn.disabled = true;
        try {
          await api('/events/' + encodeURIComponent(e.id), {
            method: 'PATCH',
            body: JSON.stringify({ archived: !e.archivedAt })
          });
          renderEvent(ref);
        } catch (err) { archBtn.disabled = false; handleApiError(err); }
      });
    }

    /* ---- assigning ---- */

    var searchInput = document.getElementById('volSearch');
    if (searchInput) {
      var onRoster = {};
      data.roster.forEach(function (r) {
        if (r.status !== 'CANCELLED') onRoster[r.volunteerId] = true;
      });

      var box = document.getElementById('volResults');
      var assignBtn = document.getElementById('assignBtn');
      var pickCount = document.getElementById('pickCount');

      // Ticked boxes are remembered across re-renders, so narrowing the list
      // after picking somebody does not silently drop them from the batch.
      var picked = {};

      var syncPicked = function () {
        var names = Object.keys(picked);
        assignBtn.disabled = names.length === 0;
        pickCount.textContent = names.length
          ? names.length + (names.length === 1 ? ' person selected' : ' people selected')
          : 'Nobody selected';
      };

      var runSearch = async function () {
        var p = new URLSearchParams();
        var q = searchInput.value.trim();
        if (q) p.set('q', q);
        p.set('limit', '50');
        p.set('sort', 'name');

        try {
          var res = await api('/volunteers?' + p.toString());
          var pickable = res.results.filter(function (v) { return !onRoster[v.id]; });

          if (!pickable.length) {
            box.innerHTML = q
              ? '<p class="cell-sub">No volunteers match that name, or they are already on this event.</p>'
              : '<p class="cell-sub">Every volunteer is already on this event.</p>';
            return;
          }

          box.innerHTML =
            '<div class="table-scroll" style="max-height:18rem;overflow-y:auto"><table class="crm-table"><tbody>' +
            pickable.map(function (v) {
              return '<tr><td style="width:2rem"><input type="checkbox" class="pick" value="' + esc(v.id) + '"' +
                  (picked[v.id] ? ' checked' : '') + ' /></td>' +
                '<td>' + esc(v.name) + '<span class="cell-sub">' + esc(v.status) + '</span></td>' +
                '<td><span class="cell-sub">' + esc(v.email) + '</span></td></tr>';
            }).join('') +
            '</tbody></table></div>';

          box.querySelectorAll('.pick').forEach(function (cb) {
            cb.addEventListener('change', function () {
              if (cb.checked) picked[cb.value] = true;
              else delete picked[cb.value];
              syncPicked();
            });
          });
        } catch (err) {
          box.innerHTML = '';
          handleApiError(err);
        }
      };

      assignBtn.addEventListener('click', async function () {
        var btn = this;
        var ids = Object.keys(picked).map(Number);
        if (!ids.length) return;

        btn.disabled = true;
        btn.textContent = 'Adding…';

        var send = function (allowOver) {
          return api('/events/' + encodeURIComponent(e.id) + '/assignments', {
            method: 'POST',
            body: JSON.stringify({
              volunteer_ids: ids,
              role: document.getElementById('assignRole').value,
              notify: document.getElementById('notifyAssign').checked,
              note: document.getElementById('assignNote').value,
              allow_over_capacity: allowOver
            })
          });
        };

        try {
          var res;
          try {
            res = await send(false);
          } catch (capErr) {
            // Capacity is a guard, not a wall: confirm and continue.
            if (capErr.body && capErr.body.error === 'over_capacity') {
              var b = capErr.body;
              var go = window.confirm(
                'This event asks for ' + b.capacity + ' people and ' + b.assigned +
                ' are already down, so there ' + (b.remaining === 1 ? 'is' : 'are') + ' only ' +
                b.remaining + ' place' + (b.remaining === 1 ? '' : 's') + ' left. ' +
                'Add all ' + b.requested + ' anyway?'
              );
              if (!go) { btn.disabled = false; btn.textContent = 'Add selected'; return; }
              res = await send(true);
            } else {
              throw capErr;
            }
          }

          if (res.notified && res.notified.failures && res.notified.failures.length) {
            showError('Added, but some emails did not send',
              res.notified.failures.map(function (f) { return esc(f.name); }).join(', ') +
              ' were not emailed. Please contact them directly.');
          }
          renderEvent(ref);
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Add selected';
          handleApiError(err);
        }
      });

      // The list loads straight away rather than waiting for a search: the
      // common case is picking two or three people you already have in mind,
      // and making someone type before they can see any names is friction for
      // no benefit. Typing then narrows it.
      var debounce = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(debounce);
        debounce = setTimeout(runSearch, 250);
      });
      searchInput.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); clearTimeout(debounce); runSearch(); }
      });

      runSearch();
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
    var eventMatch = path.match(/^\/events\/(.+)$/);

    if (volunteerMatch) return renderProfile(decodeURIComponent(volunteerMatch[1]));
    if (enquiryMatch) return renderEnquiry(decodeURIComponent(enquiryMatch[1]));
    if (eventMatch) return renderEvent(decodeURIComponent(eventMatch[1]));
    if (path === '/volunteers') return renderDirectory(query);
    if (path === '/enquiries') return renderEnquiries(query);
    if (path === '/events') return renderEvents(query);
    return renderDashboard();
  }

  window.addEventListener('hashchange', route);
  route();
})();
