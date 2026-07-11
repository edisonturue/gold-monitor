// Golden Monitor — Shared Sidebar & Modal Component
(function() {
  "use strict";

  var SVG = {
    dashboard: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    rules: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    lab: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    yfinance: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    aiPolicy: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    aiConfig: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1h-2v2h2a1 1 0 0 1 0 2H8a1 1 0 0 1 0-2h2v-2H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.5" fill="currentColor" stroke="none"/><path d="M9 13.5c.83.67 1.83 1 3 1s2.17-.33 3-1"/></svg>',
    chat: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    notify: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    deploy: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
    logout: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    hamburger: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="5" x2="15" y2="5"/><line x1="3" y1="9" x2="15" y2="9"/><line x1="3" y1="13" x2="15" y2="13"/></svg>',
  };

  // Tab → workspace mapping (mirrors core.js WORKSPACE_TAB_MAP)
  var TAB_WORKSPACE = {
    dashboard: "market", rules: "market", lab: "market", yfinance: "market",
    "insight-policy": "ai", "insight-ai": "ai", "insight-chat": "ai",
    wecom: "system", deploy: "system",
  };
  // Workspace → page path
  var WORKSPACE_PAGE = { market: "market.html", ai: "ai.html", system: "system.html" };

  var NAV_ITEMS = [
    { group: "\u884C\u60C5", items: [
      { id: "dashboard", label: "\u603B\u89C8\u770B\u677F", icon: SVG.dashboard, tabLink: "dashboard" },
      { id: "rules", label: "\u89C4\u5219\u4E0E\u544A\u8B66", icon: SVG.rules, tabLink: "rules" },
      { id: "lab", label: "\u7B56\u7565\u5B9E\u9A8C\u5BA4", icon: SVG.lab, tabLink: "lab" },
      { id: "yfinance", label: "YFinance", icon: SVG.yfinance, tabLink: "yfinance" },
    ]},
    { group: "\u667A\u80FD", items: [
      { id: "insight-policy", label: "AI \u5F52\u56E0", icon: SVG.aiPolicy, tabLink: "insight-policy" },
      { id: "insight-ai", label: "AI \u914D\u7F6E", icon: SVG.aiConfig, tabLink: "insight-ai" },
      { id: "insight-chat", label: "AI \u5BF9\u8BDD", icon: SVG.chat, tabLink: "insight-chat" },
    ]},
    { group: "\u7CFB\u7EDF", items: [
      { id: "wecom", label: "\u901A\u77E5\u914D\u7F6E", icon: SVG.notify, tabLink: "wecom" },
      { id: "deploy", label: "\u7CFB\u7EDF\u914D\u7F6E", icon: SVG.deploy, tabLink: "deploy" },
    ]},
  ];

  function escapeHtml(t) {
    return String(t ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // Determine which workspace the current page belongs to
  function currentPageWorkspace() {
    var page = String(window.__PAGE || "").toLowerCase();
    if (page === "ai") return "ai";
    if (page === "system") return "system";
    return "market";
  }

  function renderSidebar(options) {
    options = options || {};
    var activeTab = options.activeTab || "dashboard";
    var sidebarEl = document.getElementById("sidebar");
    if (!sidebarEl) return;

    var html = '';
    // Brand
    html += '<div class="sidebar-brand">';
    html += '<div class="brand-dot"></div>';
    html += '<div><h1>\u91D1\u4EF7\u76D1\u63A7\u53F0</h1><p>\u5B9E\u65F6\u884C\u60C5 \u00B7 \u9608\u503C\u63D0\u9192 \u00B7 K\u7EBF\u5206\u6790</p></div>';
    html += '</div>';

    // Toggle button INSIDE sidebar
    html += '<button class="sidebar-toggle" id="sidebar-toggle" type="button" aria-label="\u6298\u53E0/\u5C55\u5F00\u5BFC\u822A" title="\u6298\u53E0/\u5C55\u5F00\u5BFC\u822A">';
    html += '<svg class="sidebar-toggle-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="10 12 6 8 10 4"></polyline><polyline points="14 12 10 8 14 4"></polyline></svg>';
    html += '</button>';

    // Navigation
    html += '<nav class="sidebar-nav" aria-label="\u4E3B\u5BFC\u822A">';
    NAV_ITEMS.forEach(function(group) {
      html += '<div class="nav-group">';
      html += '<span class="nav-group-label">' + escapeHtml(group.group) + '</span>';
      group.items.forEach(function(item) {
        var isActive = item.tabLink === activeTab || item.id === activeTab;
        html += '<a href="#' + item.tabLink + '" class="nav-item' + (isActive ? ' active' : '') + '"';
        html += ' data-tab-link="' + item.tabLink + '"';
        html += ' title="' + escapeHtml(item.label) + '"';
        html += '>';
        html += item.icon;
        html += '<span class="nav-label-wrap"><span class="nav-label">' + escapeHtml(item.label) + '</span></span>';
        html += '</a>';
      });
      html += '</div>';
    });
    html += '</nav>';

    // Footer
    html += '<div class="sidebar-footer">';
    html += '<div class="sidebar-user">';
    html += '<div class="sidebar-user-avatar" id="sidebar-user-avatar">?</div>';
    html += '<div class="sidebar-user-info">';
    html += '<div class="sidebar-user-name" id="sidebar-user-name">\u672A\u767B\u5F55</div>';
    html += '<div class="sidebar-user-role" id="sidebar-user-role">\u7528\u6237</div>';
    html += '</div></div>';
    html += '<a href="/logout" id="btn-logout" class="sidebar-logout-btn" title="\u9000\u51FA\u767B\u5F55">';
    html += SVG.logout;
    html += '<span class="nav-label-wrap"><span class="nav-label">\u9000\u51FA\u767B\u5F55</span></span>';
    html += '</a>';
    html += '</div>';

    sidebarEl.innerHTML = html;
    injectMobileMenuButton();
  }

  function injectMobileMenuButton() {
    var topbarLeft = document.querySelector('.topbar-left');
    if (!topbarLeft || document.getElementById('mobile-menu-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'mobile-menu-btn';
    btn.className = 'mobile-menu-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', '\u6253\u5F00\u5BFC\u822A');
    btn.innerHTML = SVG.hamburger;
    topbarLeft.insertBefore(btn, topbarLeft.firstChild);
  }

  function loadSidebarUser() {
    var avatarEl = document.getElementById("sidebar-user-avatar");
    var nameEl = document.getElementById("sidebar-user-name");
    var roleEl = document.getElementById("sidebar-user-role");
    if (!avatarEl) return;

    fetch("/api/settings", { credentials: "include" })
      .then(function(res) { if (!res.ok) throw new Error("unauthorized"); return res.json(); })
      .then(function(data) {
        var user = String(data.authenticated_user || "").trim();
        var isAdmin = Boolean(data.is_admin);
        if (user) {
          var letter = user.charAt(0).toUpperCase();
          avatarEl.textContent = letter;
          avatarEl.title = user;
          nameEl.textContent = user;
          roleEl.textContent = isAdmin ? "\u7BA1\u7406\u5458" : "\u7528\u6237";
          if (window.GM && window.GM.state) {
            window.GM.state.currentUser = user;
            window.GM.state.currentIsAdmin = isAdmin;
          }
        }
      })
      .catch(function() {
        if (avatarEl.textContent === "?") {
          console.warn("demo-noredirect");
        }
      });
  }

  function renderModals() {
    var existing = document.getElementById("workspace-modal-root");
    if (existing) return;
    var fragment = document.createDocumentFragment();
    var div = document.createElement("div");
    div.style.display = "none";
    div.innerHTML = buildModalHTML();
    while (div.firstChild) fragment.appendChild(div.firstChild);
    document.body.appendChild(fragment);
  }

  function buildModalHTML() {
    var h = '';
    h += '<div id="workspace-modal-root" class="workspace-modal-root hidden" aria-hidden="true">';
    h += '<div class="workspace-modal-backdrop" data-workspace-modal-close></div>';
    h += '<section id="workspace-modal" class="workspace-modal glass" role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title">';
    h += '<header class="workspace-modal-head"><div><h3 id="workspace-modal-title">\u7F16\u8F91</h3><p id="workspace-modal-desc" class="meta">\u5B8C\u6210\u540E\u4FDD\u5B58\u3002</p></div></header>';
    h += '<div id="workspace-modal-body" class="workspace-modal-body">';
    h += '<aside class="workspace-modal-outline-wrap"><div class="meta workspace-modal-outline-title">\u76EE\u5F55</div><nav id="workspace-modal-outline" class="workspace-modal-outline" aria-label="\u5F39\u7A97\u7F16\u8F91\u76EE\u5F55"></nav></aside>';
    h += '<div id="workspace-modal-main" class="workspace-modal-main"></div>';
    h += '</div>';
    h += '<footer class="workspace-modal-footer"><button id="workspace-modal-close" class="secondary-btn" type="button" aria-label="\u5173\u95ED\u5F39\u7A97" data-workspace-modal-close>\u5173\u95ED</button><button id="workspace-modal-submit" type="button">\u5B8C\u6210\u5E76\u4FDD\u5B58</button></footer>';
    h += '</section></div>';

    h += '<div id="subworkspace-modal-root" class="subworkspace-modal-root hidden" aria-hidden="true">';
    h += '<div class="subworkspace-modal-backdrop" data-subworkspace-modal-close></div>';
    h += '<section id="subworkspace-modal" class="subworkspace-modal glass" role="dialog" aria-modal="true" aria-labelledby="subworkspace-modal-title">';
    h += '<header class="subworkspace-modal-head"><div><h3 id="subworkspace-modal-title">\u9AD8\u7EA7\u5206\u7EC4\u7F16\u8F91</h3><p id="subworkspace-modal-desc" class="meta">\u5B8C\u6210\u540E\u8FD4\u56DE\u4E3B\u5F39\u7A97\u3002</p></div></header>';
    h += '<div id="subworkspace-modal-body" class="subworkspace-modal-body"></div>';
    h += '<footer class="subworkspace-modal-footer"><button id="subworkspace-modal-close" type="button" class="secondary-btn" data-subworkspace-modal-close>\u5B8C\u6210\u5E76\u8FD4\u56DE</button></footer>';
    h += '</section></div>';

    h += '<div id="action-modal-root" class="action-modal-root hidden" aria-hidden="true">';
    h += '<div class="action-modal-backdrop" data-action-modal-close></div>';
    h += '<section class="action-modal glass" role="dialog" aria-modal="true" aria-labelledby="action-modal-title">';
    h += '<h3 id="action-modal-title">\u786E\u8BA4\u64CD\u4F5C</h3><p id="action-modal-text" class="meta">\u786E\u8BA4\u7EE7\u7EED\uFF1F</p>';
    h += '<label id="action-modal-input-wrap" class="action-modal-input-wrap hidden"><span id="action-modal-input-label" class="meta">\u8F93\u5165</span><input id="action-modal-input" type="password" maxlength="128" /></label>';
    h += '<div id="action-modal-tip" class="meta form-tip"></div>';
    h += '<div class="action-modal-actions"><button id="action-modal-cancel" class="secondary-btn" type="button">\u53D6\u6D88</button><button id="action-modal-confirm" type="button">\u786E\u8BA4</button></div>';
    h += '</section></div>';

    h += '<div id="insight-chat-modal-root" class="insight-chat-modal-root hidden" aria-hidden="true">';
    h += '<div class="insight-chat-modal-backdrop" data-insight-chat-close></div>';
    h += '<section id="insight-chat-modal" class="insight-chat-modal glass" role="dialog" aria-modal="true" aria-labelledby="insight-chat-modal-title">';
    h += '<header class="insight-chat-modal-head"><div><h3 id="insight-chat-modal-title">AI \u5BF9\u8BDD\u7A97\u53E3</h3><p class="meta">\u67E5\u770B\u7ED3\u8BBA\u3001\u8BC1\u636E\u548C\u8BCA\u65AD\u3002</p></div><button id="insight-chat-modal-close" type="button" class="secondary-btn" data-insight-chat-close>\u5173\u95ED</button></header>';
    h += '<div id="insight-chat-modal-body" class="insight-chat-modal-body"><div class="insight-detail-empty">\u5148\u9009\u62E9\u4E8B\u4EF6\u3002</div></div>';
    h += '</section></div>';

    return h;
  }

  function initSidebarToggle() {
    var toggle = document.getElementById("sidebar-toggle");
    var sidebar = document.getElementById("sidebar");
    var mobileBtn = document.getElementById("mobile-menu-btn");

    function emitSidebarState(isCollapsed) {
      document.body.classList.toggle("sidebar-is-collapsed", Boolean(isCollapsed));
      window.dispatchEvent(new CustomEvent("gm:sidebar-state", {
        detail: { collapsed: Boolean(isCollapsed) },
      }));
    }

    // Restore collapsed state
    if (sidebar && window.innerWidth > 768) {
      try {
        if (localStorage.getItem("gm_sidebar_collapsed") === "1") {
          sidebar.classList.add("collapsed");
        }
      } catch (_) {}
    }

    function syncToggle(isCollapsed) {
      if (toggle) {
        if (isCollapsed) toggle.classList.add("collapsed");
        else toggle.classList.remove("collapsed");
      }
    }
    if (sidebar && sidebar.classList.contains("collapsed")) {
      syncToggle(true);
    }
    emitSidebarState(sidebar && sidebar.classList.contains("collapsed"));

    // Desktop: toggle collapse
    if (toggle && sidebar) {
      toggle.addEventListener("click", function(e) {
        e.stopPropagation();
        if (window.innerWidth <= 768) {
          sidebar.classList.toggle("open");
        } else {
          var isCollapsed = sidebar.classList.toggle("collapsed");
          syncToggle(isCollapsed);
          emitSidebarState(isCollapsed);
          try { localStorage.setItem("gm_sidebar_collapsed", isCollapsed ? "1" : "0"); } catch (_) {}
        }
      });
    }

    // Mobile: hamburger opens sidebar
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        sidebar.classList.toggle("open");
      });
    }

    // Nav click: cross-workspace → page redirect; same workspace → SPA switch
    if (sidebar) {
      sidebar.addEventListener("click", function(e) {
        var target = e.target instanceof Element ? e.target : null;
        if (!target) return;
        var navItem = target.closest(".nav-item");
        if (!navItem) return;
        e.preventDefault();
        e.stopPropagation();

        var tabLink = navItem.getAttribute("data-tab-link");
        if (!tabLink) return;

        var targetWorkspace = TAB_WORKSPACE[tabLink] || "market";
        var currentWorkspace = currentPageWorkspace();

        if (targetWorkspace !== currentWorkspace) {
          // Cross-workspace: redirect to the correct page
          var targetPage = WORKSPACE_PAGE[targetWorkspace] || "market.html";
          window.location.href = targetPage + "#" + tabLink;
          return;
        }

        // Same workspace: SPA switch (sidebar stays untouched)
        sidebar.querySelectorAll(".nav-item").forEach(function(el) {
          el.classList.remove("active");
        });
        navItem.classList.add("active");

        if (window.GM && typeof window.GM.setActiveTab === "function") {
          window.GM.setActiveTab(tabLink);
        } else {
          window.location.hash = "#" + tabLink;
        }

        // Mobile: close sidebar after nav
        if (window.innerWidth <= 768 && sidebar.classList.contains("open")) {
          sidebar.classList.remove("open");
        }
      }, true);
    }

    // Logout: handled by <a href='/logout'> — server clears cookie + 302 to /login

    // Mobile: close sidebar on outside click
    document.addEventListener("click", function(e) {
      var target = e.target instanceof Node ? e.target : null;
      if (sidebar && sidebar.classList.contains("open") && target && !sidebar.contains(target) && (!mobileBtn || !mobileBtn.contains(target))) {
        sidebar.classList.remove("open");
      }
    });

    window.addEventListener("resize", function() {
      if (!sidebar) return;
      if (window.innerWidth <= 768) {
        document.body.classList.remove("sidebar-is-collapsed");
        return;
      }
      emitSidebarState(sidebar.classList.contains("collapsed"));
    });
  }

  // Export
  window.GMSidebar = {
    renderSidebar: renderSidebar,
    renderModals: renderModals,
    initSidebarToggle: initSidebarToggle,
    loadSidebarUser: loadSidebarUser,
    NAV_ITEMS: NAV_ITEMS,
  };
})();
