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
      showError(
        'No access',
        'You are signed in, but this account has no active role in the CRM. An owner needs to add you to the admin users table.'
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

  function pageLink(params, page, label, disabled) {
    if (disabled) return '<span class="btn btn-quiet btn-sm" aria-disabled="true" style="opacity:.5">' + esc(label) + '</span>';
    var next = new URLSearchParams(params.toString());
    next.set('page', page);
    return '<a class="btn btn-quiet btn-sm" href="#/volunteers?' + next.toString() + '">' + esc(label) + '</a>';
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

    var saveStatus = document.getElementById('saveStatus');
    if (saveStatus) {
      saveStatus.addEventListener('click', async function () {
        saveStatus.disabled = true;
        try {
          await api('/volunteers/' + encodeURIComponent(v.id), {
            method: 'PATCH',
            body: JSON.stringify({ status: document.getElementById('statusSelect').value })
          });
          renderProfile(ref);
        } catch (err) { saveStatus.disabled = false; handleApiError(err); }
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

  /* ---------------- routing ---------------- */

  function route() {
    var hash = location.hash.replace(/^#/, '') || '/';
    var qIndex = hash.indexOf('?');
    var path = qIndex === -1 ? hash : hash.slice(0, qIndex);
    var query = qIndex === -1 ? '' : hash.slice(qIndex + 1);

    var profileMatch = path.match(/^\/volunteers\/(.+)$/);

    if (profileMatch) return renderProfile(decodeURIComponent(profileMatch[1]));
    if (path === '/volunteers') return renderDirectory(query);
    return renderDashboard();
  }

  window.addEventListener('hashchange', route);
  route();
})();
