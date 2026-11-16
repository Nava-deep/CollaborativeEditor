function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} = React;
const API_BASE = '';
function readSession() {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('relay.user') || 'null');
  } catch {
    user = null;
  }
  return {
    token: localStorage.getItem('relay.token'),
    user
  };
}
function saveSession(token, user) {
  localStorage.setItem('relay.token', token);
  localStorage.setItem('relay.user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('relay.token');
  localStorage.removeItem('relay.user');
}
async function api(path, options = {}) {
  const token = readSession().token;
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Token ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE}/api/${path.replace(/^\//, '')}`, {
    ...options,
    headers
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.detail || Object.values(data).flat().join(' ') || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}
async function authenticate(username, password, register = false, email = '') {
  const response = await fetch(`${API_BASE}/api/${register ? 'register/' : 'auth/'}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username,
      password,
      ...(register ? {
        email
      } : {})
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || Object.values(data).flat().join(' ') || 'Could not sign in.');
  saveSession(data.token, data.user);
  return data.user;
}
function socketUrl(documentId) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/documents/${documentId}/`;
}
const DATABASE = 'relay-offline-v1';
const STORE = 'drafts';
let databasePromise;
function database() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB is not available in this browser.'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return databasePromise;
}
function readDraft(key) {
  return database().then(db => new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(String(key));
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  }));
}
function writeDraft(key, value) {
  return database().then(db => new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, String(key));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }));
}
function deleteDraft(key) {
  return database().then(db => new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(String(key));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }));
}
function readDashboard(userId = 'unknown') {
  return readDraft(`dashboard:${userId}`);
}
function writeDashboard(userId = 'unknown', value) {
  return writeDraft(`dashboard:${userId}`, value);
}
const dmp = new DiffMatchPatch();
function makeIcon(name) {
  return function RelayIcon({
    size = 16,
    strokeWidth = 2,
    ...props
  }) {
    const icon = lucide.icons[name];
    if (!icon) return null;
    const renderNode = (node, key) => {
      const [tag, attributes, children] = node;
      return React.createElement(tag, {
        ...attributes,
        key
      }, ...(children || []).map(renderNode));
    };
    const [tag, attributes, children] = icon;
    return React.createElement(tag, {
      ...attributes,
      ...props,
      width: size,
      height: size,
      'stroke-width': strokeWidth
    }, ...(children || []).map(renderNode));
  };
}
const ArrowDownToLine = makeIcon('ArrowDownToLine');
const ChevronDown = makeIcon('ChevronDown');
const Cloud = makeIcon('Cloud');
const CloudOff = makeIcon('CloudOff');
const FilePlus2 = makeIcon('FilePlus2');
const FileText = makeIcon('FileText');
const FolderOpen = makeIcon('FolderOpen');
const LoaderCircle = makeIcon('LoaderCircle');
const LogOut = makeIcon('LogOut');
const MoreHorizontal = makeIcon('MoreHorizontal');
const Star = makeIcon('Star');
const Pencil = makeIcon('Pencil');
const Plus = makeIcon('Plus');
const Search = makeIcon('Search');
const Settings2 = makeIcon('Settings2');
const Share2 = makeIcon('Share2');
const Shield = makeIcon('Shield');
const Sparkles = makeIcon('Sparkles');
const Trash2 = makeIcon('Trash2');
const X = makeIcon('X');
const Moon = makeIcon('Moon');
const Sun = makeIcon('Sun');
function navigateTo(path, replace = false) {
  if (replace) window.history.replaceState({}, '', path);else window.history.pushState({}, '', path);
  window.dispatchEvent(new Event('popstate'));
}
function useCurrentPath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return path;
}
function useNavigate() {
  return navigateTo;
}
function useParams() {
  const match = window.location.pathname.match(/^\/docs\/(\d+)\/?$/);
  return {
    id: match ? match[1] : undefined
  };
}
function Link({
  to,
  onClick,
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("a", _extends({
    href: to
  }, props, {
    onClick: event => {
      onClick?.(event);
      if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        navigateTo(to);
      }
    }
  }), children);
}
function Route() {
  return null;
}
function Routes({
  children
}) {
  const path = useCurrentPath();
  const routes = React.Children.toArray(children);
  const selected = routes.find(route => {
    const routePath = route.props.path;
    if (routePath === '*') return false;
    if (routePath === '/docs/:id') return /^\/docs\/\d+\/?$/.test(path);
    return routePath === path;
  }) || routes.find(route => route.props.path === '*');
  return selected ? selected.props.element : null;
}
function Navigate({
  to,
  replace = false
}) {
  useEffect(() => {
    navigateTo(to, replace);
  }, [to, replace]);
  return null;
}
const palette = ['#ef8b65', '#738de0', '#57a48a', '#be83c6', '#d4a044'];
function renderCursorOverlay(text, markers) {
  const ordered = markers.map(marker => ({
    ...marker,
    position: Math.max(0, Math.min(text.length, Number(marker.position) || 0))
  })).sort((first, second) => first.position - second.position);
  const nodes = [];
  let offset = 0;
  let previousPosition = -1;
  let stack = 0;
  ordered.forEach(marker => {
    if (marker.position > offset) nodes.push(text.slice(offset, marker.position));
    stack = marker.position === previousPosition ? stack + 1 : 0;
    nodes.push(/*#__PURE__*/React.createElement("span", {
      key: marker.key,
      className: `remote-caret ${marker.self ? 'is-self' : ''}`,
      style: {
        '--cursor-color': marker.color,
        '--cursor-label-stack': `${stack * 1.5}em`
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "remote-caret-label"
    }, marker.username)));
    previousPosition = marker.position;
    offset = marker.position;
  });
  if (offset < text.length) nodes.push(text.slice(offset));
  return nodes;
}
function mergeText(base, local, remote) {
  if (local === base) return remote;
  if (remote === base) return local;
  if (local === remote) return local;
  if (local.includes(remote) || remote.includes(local)) return local.length >= remote.length ? local : remote;
  const patches = dmp.patch_make(base, local);
  return dmp.patch_apply(patches, remote)[0];
}
function App() {
  const [session, setSession] = useState(readSession);
  const [online, setOnline] = useState(navigator.onLine);
  const [theme, setTheme] = useState(() => {
    let saved = 'light';
    try {
      saved = localStorage.getItem('collab-editor.theme') === 'dark' ? 'dark' : 'light';
    } catch {/* use the accessible light default */}
    document.documentElement.dataset.theme = saved;
    document.body.dataset.theme = saved;
    return saved;
  });
  const toggleTheme = useCallback(() => setTheme(current => {
    const next = current === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem('collab-editor.theme', next);
    } catch {/* theme still applies for this session */}
    document.documentElement.dataset.theme = next;
    document.body.dataset.theme = next;
    return next;
  }), []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === 'dark' ? '#17211c' : '#f7f8fa';
  }, [theme]);
  useEffect(() => {
    function dismissMenus(event) {
      document.querySelectorAll('.more-menu-wrap[open]').forEach(dropdown => {
        if (!dropdown.contains(event.target)) dropdown.open = false;
      });
    }
    document.addEventListener('pointerdown', dismissMenus);
    return () => document.removeEventListener('pointerdown', dismissMenus);
  }, []);
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if (session.token) api('auth/me/').then(user => {
      localStorage.setItem('relay.user', JSON.stringify(user));
      setSession({
        token: session.token,
        user
      });
    }).catch(() => {});
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  const signOut = useCallback(async () => {
    try {
      await api('auth/logout/', {
        method: 'POST'
      });
    } catch {/* local sign out still works offline */}
    clearSession();
    setSession({
      token: null,
      user: null
    });
  }, []);
  if (!session.token) return /*#__PURE__*/React.createElement(AuthPage, {
    theme: theme,
    onToggleTheme: toggleTheme,
    onAuthenticated: user => setSession({
      token: readSession().token,
      user
    })
  });
  return /*#__PURE__*/React.createElement(Routes, null, /*#__PURE__*/React.createElement(Route, {
    path: "/",
    element: /*#__PURE__*/React.createElement(Dashboard, {
      user: session.user,
      online: online,
      theme: theme,
      onToggleTheme: toggleTheme,
      onSignOut: signOut
    })
  }), /*#__PURE__*/React.createElement(Route, {
    path: "/docs/:id",
    element: /*#__PURE__*/React.createElement(Editor, {
      user: session.user,
      online: online,
      theme: theme,
      onToggleTheme: toggleTheme,
      onSignOut: signOut
    })
  }), /*#__PURE__*/React.createElement(Route, {
    path: "*",
    element: /*#__PURE__*/React.createElement(Navigate, {
      to: "/",
      replace: true
    })
  }));
}
function AuthPage({
  theme,
  onToggleTheme,
  onAuthenticated
}) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: ''
  });
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onAuthenticated(await authenticate(form.username, form.password, register, form.email));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return /*#__PURE__*/React.createElement("main", {
    className: "auth-shell"
  }, /*#__PURE__*/React.createElement("button", {
    className: "theme-toggle auth-theme-toggle",
    onClick: onToggleTheme,
    "aria-label": `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`
  }, theme === 'light' ? /*#__PURE__*/React.createElement(Moon, {
    size: 17
  }) : /*#__PURE__*/React.createElement(Sun, {
    size: 17
  }), /*#__PURE__*/React.createElement("span", null, theme === 'light' ? 'Dark mode' : 'Light mode')), /*#__PURE__*/React.createElement("div", {
    className: "auth-brand"
  }, /*#__PURE__*/React.createElement("div", {
    className: "brand-mark"
  }, /*#__PURE__*/React.createElement("span", null)), /*#__PURE__*/React.createElement("span", null, "Collab Editor")), /*#__PURE__*/React.createElement("section", {
    className: "auth-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "THOUGHTS, IN SYNC"), /*#__PURE__*/React.createElement("h1", null, register ? 'Make room for good ideas.' : 'Pick up where ideas happen.'), /*#__PURE__*/React.createElement("p", {
    className: "muted"
  }, "A shared writing space that stays with you, online or off."), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    className: "auth-form"
  }, /*#__PURE__*/React.createElement("label", null, "Username", /*#__PURE__*/React.createElement("input", {
    required: true,
    autoComplete: "username",
    value: form.username,
    onChange: e => setForm({
      ...form,
      username: e.target.value
    })
  })), register && /*#__PURE__*/React.createElement("label", null, "Email ", /*#__PURE__*/React.createElement("span", {
    className: "optional"
  }, "optional"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    autoComplete: "email",
    value: form.email,
    onChange: e => setForm({
      ...form,
      email: e.target.value
    })
  })), /*#__PURE__*/React.createElement("label", null, "Password", /*#__PURE__*/React.createElement("input", {
    required: true,
    minLength: register ? 8 : 1,
    type: "password",
    autoComplete: register ? 'new-password' : 'current-password',
    value: form.password,
    onChange: e => setForm({
      ...form,
      password: e.target.value
    })
  })), error && /*#__PURE__*/React.createElement("div", {
    className: "error-banner"
  }, error), /*#__PURE__*/React.createElement("button", {
    className: "button primary wide",
    disabled: busy
  }, busy ? /*#__PURE__*/React.createElement(LoaderCircle, {
    className: "spin",
    size: 17
  }) : null, register ? 'Create account' : 'Sign in', /*#__PURE__*/React.createElement("span", null, "\u2197"))), /*#__PURE__*/React.createElement("div", {
    className: "auth-toggle"
  }, register ? 'Already have an account?' : 'New to Collab Editor?', " ", /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setRegister(!register);
      setError('');
    }
  }, register ? 'Sign in' : 'Create an account'))), /*#__PURE__*/React.createElement("div", {
    className: "auth-foot"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Shield, {
    size: 14
  }), " Your writing stays yours"), /*#__PURE__*/React.createElement("span", null, "Built for the in-between moments")));
}
function Dashboard({
  user,
  online,
  theme,
  onToggleTheme,
  onSignOut
}) {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(null);
  const [creating, setCreating] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const favoritesKey = `collab-editor.favorites:${user?.id ?? 'unknown'}`;
  const [favorites, setFavorites] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
      return Array.isArray(stored) ? stored.map(String) : [];
    } catch {
      return [];
    }
  });
  const [showStarred, setShowStarred] = useState(false);
  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);
  const loadDocuments = useCallback(async () => {
    try {
      const result = await api('documents/');
      setDocuments(result.results || result);
      await writeDashboard(user?.id, result.results || result);
      setError('');
    } catch (err) {
      const cached = await readDashboard(user?.id).catch(() => null);
      if (cached) setDocuments(cached);else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);
  useEffect(() => {
    if (online) loadDocuments();
  }, [online, loadDocuments]);
  useEffect(() => {
    try {
      localStorage.setItem(favoritesKey, JSON.stringify(favorites));
    } catch {/* stars remain available for this session */}
  }, [favoritesKey, favorites]);
  useEffect(() => {
    if (menu === null) return undefined;
    function dismissMenu(event) {
      if (!event.target.closest('.doc-menu-anchor[data-open="true"]')) setMenu(null);
    }
    function dismissOnEscape(event) {
      if (event.key === 'Escape') setMenu(null);
    }
    document.addEventListener('pointerdown', dismissMenu);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissMenu);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [menu]);
  useEffect(() => {
    if (!workspaceMenuOpen) return undefined;
    function dismissWorkspaceMenu(event) {
      if (!event.target.closest('.workspace-menu-wrap')) setWorkspaceMenuOpen(false);
    }
    function dismissOnEscape(event) {
      if (event.key === 'Escape') setWorkspaceMenuOpen(false);
    }
    document.addEventListener('pointerdown', dismissWorkspaceMenu);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissWorkspaceMenu);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [workspaceMenuOpen]);
  async function createDocument() {
    setCreating(true);
    try {
      const document = await api('documents/', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Untitled document',
          content: ''
        })
      });
      navigate(`/docs/${document.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }
  function toggleFavorite(documentId) {
    const key = String(documentId);
    setFavorites(old => old.includes(key) ? old.filter(item => item !== key) : [...old, key]);
  }
  async function documentAction(action, doc) {
    setMenu(null);
    try {
      if (action === 'duplicate') {
        const clone = await api(`documents/${doc.id}/duplicate/`, {
          method: 'POST'
        });
        navigate(`/docs/${clone.id}`);
      } else if (action === 'delete') {
        if (!window.confirm(`Move “${doc.title}” to trash?`)) return;
        await api(`documents/${doc.id}/`, {
          method: 'DELETE'
        });
        setDocuments(items => items.filter(item => item.id !== doc.id));
        setFavorites(items => items.filter(item => item !== String(doc.id)));
      }
    } catch (err) {
      setError(err.message);
    }
  }
  const searchQuery = search.trim().normalize('NFKC').toLocaleLowerCase();
  const filtered = useMemo(() => documents.filter(doc => (!showStarred || favoriteIds.has(String(doc.id))) && (!searchQuery || `${doc.title || ''} ${doc.owner || ''}`.normalize('NFKC').toLocaleLowerCase().includes(searchQuery))).sort((first, second) => sortNewestFirst ? new Date(second.updated_at) - new Date(first.updated_at) : new Date(first.updated_at) - new Date(second.updated_at)), [documents, searchQuery, sortNewestFirst, showStarred, favoriteIds]);
  const favoriteCount = documents.filter(doc => favoriteIds.has(String(doc.id))).length;
  return /*#__PURE__*/React.createElement("div", {
    className: "dashboard-shell"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "sidebar"
  }, /*#__PURE__*/React.createElement(Link, {
    to: "/",
    className: "brand"
  }, /*#__PURE__*/React.createElement("div", {
    className: "brand-mark"
  }, /*#__PURE__*/React.createElement("span", null)), /*#__PURE__*/React.createElement("span", null, "Collab Editor")), /*#__PURE__*/React.createElement("button", {
    className: "nav-item active"
  }, /*#__PURE__*/React.createElement(FolderOpen, {
    size: 17
  }), " My workspace"), /*#__PURE__*/React.createElement("div", {
    className: "side-label"
  }, "YOUR SPACE"), /*#__PURE__*/React.createElement("div", {
    className: "workspace-menu-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: `workspace-card ${workspaceMenuOpen ? 'is-open' : ''}`,
    "aria-expanded": workspaceMenuOpen,
    "aria-controls": "workspace-account-menu",
    onClick: () => setWorkspaceMenuOpen(open => !open)
  }, /*#__PURE__*/React.createElement("span", {
    className: "workspace-avatar"
  }, user?.username?.[0]?.toUpperCase() || 'Y'), /*#__PURE__*/React.createElement("span", {
    className: "workspace-card-copy"
  }, /*#__PURE__*/React.createElement("strong", null, user?.username || 'Your workspace'), /*#__PURE__*/React.createElement("small", null, "Personal workspace")), /*#__PURE__*/React.createElement(ChevronDown, {
    className: "workspace-chevron",
    size: 16
  })), workspaceMenuOpen && /*#__PURE__*/React.createElement("div", {
    className: "workspace-popover",
    id: "workspace-account-menu",
    role: "group",
    "aria-label": "Account and workspace options"
  }, /*#__PURE__*/React.createElement("div", {
    className: "workspace-popover-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "workspace-avatar"
  }, user?.username?.[0]?.toUpperCase() || 'Y'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, user?.username || 'Your account'), /*#__PURE__*/React.createElement("small", null, "Personal workspace"))), /*#__PURE__*/React.createElement("div", {
    className: "workspace-popover-status"
  }, /*#__PURE__*/React.createElement("span", null, "Connection"), /*#__PURE__*/React.createElement("strong", null, /*#__PURE__*/React.createElement("i", {
    className: `connection-dot ${online ? 'is-online' : ''}`
  }), online ? 'Online' : 'Offline')), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      onToggleTheme();
      setWorkspaceMenuOpen(false);
    }
  }, theme === 'light' ? /*#__PURE__*/React.createElement(Moon, {
    size: 16
  }) : /*#__PURE__*/React.createElement(Sun, {
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, "Switch to ", theme === 'light' ? 'dark' : 'light', " theme")), /*#__PURE__*/React.createElement("button", {
    className: "workspace-signout",
    onClick: () => {
      setWorkspaceMenuOpen(false);
      onSignOut();
    }
  }, /*#__PURE__*/React.createElement(LogOut, {
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, "Sign out")))), /*#__PURE__*/React.createElement("div", {
    className: "sidebar-note"
  }, /*#__PURE__*/React.createElement(Sparkles, {
    size: 15
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Work in progress"), /*#__PURE__*/React.createElement("p", null, "Your drafts save as you write, even when your connection wanders."))), /*#__PURE__*/React.createElement("div", {
    className: "sidebar-bottom"
  }, /*#__PURE__*/React.createElement("div", {
    className: `connection-dot ${online ? 'is-online' : ''}`
  }), /*#__PURE__*/React.createElement("span", null, online ? 'Connected' : 'Working offline'), /*#__PURE__*/React.createElement("button", {
    title: "Sign out",
    onClick: onSignOut
  }, /*#__PURE__*/React.createElement(LogOut, {
    size: 15
  })))), /*#__PURE__*/React.createElement("main", {
    className: "dashboard-main"
  }, /*#__PURE__*/React.createElement("header", {
    className: "dash-top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "breadcrumbs"
  }, "Workspace ", /*#__PURE__*/React.createElement("span", null, "/"), " My documents"), /*#__PURE__*/React.createElement("div", {
    className: "top-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "theme-toggle",
    onClick: onToggleTheme,
    "aria-label": `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`
  }, theme === 'light' ? /*#__PURE__*/React.createElement(Moon, {
    size: 16
  }) : /*#__PURE__*/React.createElement(Sun, {
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, theme === 'light' ? 'Dark' : 'Light')), /*#__PURE__*/React.createElement("div", {
    className: "user-avatar",
    title: user?.username
  }, user?.username?.[0]?.toUpperCase() || 'Y'))), /*#__PURE__*/React.createElement("div", {
    className: "dash-content"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dash-heading"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date()).toUpperCase()), /*#__PURE__*/React.createElement("h1", null, "Your workspace", /*#__PURE__*/React.createElement("span", {
    className: "heading-dot"
  }, ".")), /*#__PURE__*/React.createElement("p", null, "Good ideas don\u2019t always arrive at a desk. Keep them moving.")), /*#__PURE__*/React.createElement("button", {
    className: "button primary",
    onClick: createDocument,
    disabled: creating
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 17
  }), " New document")), !online && /*#__PURE__*/React.createElement("div", {
    className: "offline-banner"
  }, /*#__PURE__*/React.createElement(CloudOff, {
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, "Offline mode \u2014 showing your last saved workspace. Changes stay on this device until you reconnect.")), error && /*#__PURE__*/React.createElement("div", {
    className: "error-banner page-error"
  }, error, /*#__PURE__*/React.createElement("button", {
    onClick: () => setError('')
  }, /*#__PURE__*/React.createElement(X, {
    size: 15
  }))), /*#__PURE__*/React.createElement("div", {
    className: "library-heading"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "Recent documents"), /*#__PURE__*/React.createElement("span", {
    className: "count"
  }, documents.length)), /*#__PURE__*/React.createElement("div", {
    className: "library-tools"
  }, /*#__PURE__*/React.createElement("label", {
    className: "search-box"
  }, /*#__PURE__*/React.createElement(Search, {
    size: 16
  }), /*#__PURE__*/React.createElement("input", {
    type: "search",
    "aria-label": "Filter documents by title or owner",
    placeholder: "Find a document",
    value: search,
    onChange: e => setSearch(e.target.value)
  })), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn bordered",
    title: sortNewestFirst ? 'Oldest edited first' : 'Newest edited first',
    "aria-label": sortNewestFirst ? 'Oldest edited first' : 'Newest edited first',
    onClick: () => setSortNewestFirst(value => !value)
  }, /*#__PURE__*/React.createElement(Settings2, {
    size: 17
  })))), /*#__PURE__*/React.createElement("div", {
    className: "library-filter-row",
    role: "group",
    "aria-label": "Document filters"
  }, /*#__PURE__*/React.createElement("button", {
    className: `filter-chip ${!showStarred ? 'active' : ''}`,
    "aria-pressed": !showStarred,
    onClick: () => setShowStarred(false)
  }, "All documents ", /*#__PURE__*/React.createElement("span", null, documents.length)), /*#__PURE__*/React.createElement("button", {
    className: `filter-chip ${showStarred ? 'active' : ''}`,
    "aria-pressed": showStarred,
    onClick: () => setShowStarred(true)
  }, /*#__PURE__*/React.createElement(Star, {
    size: 14
  }), " Starred ", /*#__PURE__*/React.createElement("span", null, favoriteCount)), /*#__PURE__*/React.createElement("span", {
    className: "filter-caption"
  }, "Your shortcuts, saved in this browser")), loading ? /*#__PURE__*/React.createElement("div", {
    className: "loading-state"
  }, /*#__PURE__*/React.createElement(LoaderCircle, {
    className: "spin"
  }), " Opening your workspace\u2026") : filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-state"
  }, /*#__PURE__*/React.createElement("div", {
    className: "empty-icon"
  }, showStarred ? /*#__PURE__*/React.createElement(Star, {
    size: 21
  }) : /*#__PURE__*/React.createElement(FilePlus2, {
    size: 21
  })), /*#__PURE__*/React.createElement("h3", null, searchQuery || showStarred ? showStarred && !searchQuery ? 'No starred documents yet' : 'No matching documents' : 'A blank page, full of possibility.'), /*#__PURE__*/React.createElement("p", null, searchQuery ? 'Try a different search.' : showStarred ? 'Star a document to keep it close at hand.' : 'Start a document and invite someone in.'), !searchQuery && !showStarred && /*#__PURE__*/React.createElement("button", {
    className: "button secondary",
    onClick: createDocument
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 16
  }), " Create a document")) : /*#__PURE__*/React.createElement("div", {
    className: "document-grid"
  }, filtered.map((doc, index) => /*#__PURE__*/React.createElement("article", {
    className: "doc-card",
    key: doc.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "doc-card-top"
  }, /*#__PURE__*/React.createElement("div", {
    className: `doc-icon doc-color-${index % 4}`
  }, /*#__PURE__*/React.createElement(FileText, {
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "doc-card-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: `icon-btn favorite-btn ${favoriteIds.has(String(doc.id)) ? 'is-favorite' : ''}`,
    "aria-label": favoriteIds.has(String(doc.id)) ? `Unstar ${doc.title || 'document'}` : `Star ${doc.title || 'document'}`,
    "aria-pressed": favoriteIds.has(String(doc.id)),
    title: favoriteIds.has(String(doc.id)) ? 'Remove from starred' : 'Add to starred',
    onClick: () => toggleFavorite(doc.id)
  }, /*#__PURE__*/React.createElement(Star, {
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    className: "doc-menu-anchor",
    "data-open": menu === doc.id ? 'true' : 'false'
  }, /*#__PURE__*/React.createElement("button", {
    className: "icon-btn more-btn",
    "aria-label": `Options for ${doc.title || 'document'}`,
    "aria-expanded": menu === doc.id,
    onClick: () => setMenu(menu === doc.id ? null : doc.id)
  }, /*#__PURE__*/React.createElement(MoreHorizontal, {
    size: 18
  })), menu === doc.id && /*#__PURE__*/React.createElement("div", {
    className: "floating-menu"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => navigate(`/docs/${doc.id}`)
  }, /*#__PURE__*/React.createElement(Pencil, {
    size: 14
  }), "Open document"), /*#__PURE__*/React.createElement("button", {
    onClick: () => documentAction('duplicate', doc)
  }, /*#__PURE__*/React.createElement(FilePlus2, {
    size: 14
  }), "Duplicate"), ['owner', 'full'].includes(doc.access) && /*#__PURE__*/React.createElement("button", {
    className: "danger-text",
    onClick: () => documentAction('delete', doc)
  }, /*#__PURE__*/React.createElement(Trash2, {
    size: 14
  }), "Delete"))))), /*#__PURE__*/React.createElement("button", {
    className: "doc-card-body",
    onClick: () => navigate(`/docs/${doc.id}`)
  }, /*#__PURE__*/React.createElement("strong", null, doc.title || 'Untitled document'), /*#__PURE__*/React.createElement("p", null, ['owner', 'full'].includes(doc.access) ? 'Your document' : `Shared by ${doc.owner}`, " \xB7 ", relativeTime(doc.updated_at))), /*#__PURE__*/React.createElement("div", {
    className: "doc-card-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: `access-pill ${doc.access}`
  }, doc.access === 'owner' ? 'Owner' : doc.access === 'full' ? 'Full access' : doc.access === 'write' ? 'Can edit' : 'Can view'), /*#__PURE__*/React.createElement("span", {
    className: "collab-dots"
  }, /*#__PURE__*/React.createElement("i", null, (user?.username?.[0] || 'Y').toUpperCase()), doc.access !== 'owner' && /*#__PURE__*/React.createElement("i", null, "\u2197")))))), /*#__PURE__*/React.createElement("div", {
    className: "tip-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tip-star"
  }, /*#__PURE__*/React.createElement(Sparkles, {
    size: 17
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "A small trick for long documents"), /*#__PURE__*/React.createElement("p", null, "Your changes sync in thoughtful batches. Write without waiting for each keystroke to travel.")), /*#__PURE__*/React.createElement("span", {
    className: "tip-tag"
  }, "LESS CHATTER, SAME CLARITY")))));
}
function Editor({
  user,
  online,
  theme,
  onToggleTheme,
  onSignOut
}) {
  const {
    id
  } = useParams();
  const navigate = useNavigate();
  const draftKey = `document:${user?.id ?? 'unknown'}:${id}`;
  const [document, setDocument] = useState(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [titleEditing, setTitleEditing] = useState(false);
  const [localCursorOffset, setLocalCursorOffset] = useState(0);
  const [access, setAccess] = useState('read');
  const [status, setStatus] = useState('Loading document');
  const [people, setPeople] = useState([]);
  const [cursors, setCursors] = useState({});
  const [shareOpen, setShareOpen] = useState(false);
  const [shares, setShares] = useState([]);
  const [shareUser, setShareUser] = useState('');
  const [shareAccess, setShareAccess] = useState('write');
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const documentRef = useRef(null);
  const titleRef = useRef(title);
  const accessRef = useRef(access);
  const titlePendingRef = useRef(false);
  const contentRef = useRef('');
  const baselineRef = useRef('');
  const versionRef = useRef(0);
  const timerRef = useRef(null);
  const retryRef = useRef(null);
  const scheduleSyncRef = useRef(null);
  const storeDraftRef = useRef(null);
  const inFlightRef = useRef(null);
  const allowReconnectRef = useRef(false);
  const overlayRef = useRef(null);
  const localEditRef = useRef(false);
  const canWrite = ['owner', 'write', 'full'].includes(access);
  const canManage = access === 'owner' || access === 'full';
  const applyContent = useCallback(next => {
    contentRef.current = next;
    setContent(next);
  }, []);
  useEffect(() => {
    let disposed = false;
    async function load() {
      const cached = await readDraft(draftKey).catch(() => null);
      try {
        const doc = await api(`documents/${id}/`);
        if (disposed) return;
        const canEditDraft = ['owner', 'write', 'full'].includes(doc.access);
        const draft = cached?.pending && canEditDraft ? cached : null;
        const localTitle = cached?.titlePending && canEditDraft ? cached.title : doc.title;
        const merged = draft ? mergeText(draft.baseContent || '', draft.content || '', doc.content || '') : doc.content || '';
        documentRef.current = {
          ...doc,
          title: localTitle
        };
        titleRef.current = localTitle;
        titlePendingRef.current = Boolean(cached?.titlePending && canEditDraft);
        accessRef.current = doc.access;
        setDocument({
          ...doc,
          title: localTitle
        });
        setTitle(localTitle);
        setAccess(doc.access);
        baselineRef.current = doc.content || '';
        versionRef.current = doc.version;
        applyContent(merged);
        localEditRef.current = merged !== (doc.content || '');
        setStatus(localEditRef.current ? 'Merging offline edits' : 'Saved');
        if (localEditRef.current || titlePendingRef.current) await writeDraft(draftKey, {
          content: merged,
          baseContent: baselineRef.current,
          version: versionRef.current,
          pending: localEditRef.current,
          title: localTitle,
          titlePending: titlePendingRef.current,
          access: doc.access,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        if (disposed) return;
        if (cached && (!err.status || err.status >= 500 || err.status === 408 || err.status === 429)) {
          const fakeDoc = {
            id: Number(id),
            title: cached.title || 'Offline document',
            version: cached.version || 0,
            access: cached.access || 'write',
            updated_at: cached.updatedAt
          };
          documentRef.current = fakeDoc;
          titleRef.current = fakeDoc.title;
          accessRef.current = fakeDoc.access;
          titlePendingRef.current = Boolean(cached.titlePending);
          setDocument(fakeDoc);
          setTitle(fakeDoc.title);
          setAccess(fakeDoc.access);
          baselineRef.current = cached.baseContent || '';
          versionRef.current = cached.version || 0;
          applyContent(cached.content || '');
          localEditRef.current = Boolean(cached.pending);
          setStatus('Offline draft saved on this device');
        } else {
          if (cached) {
            await deleteDraft(draftKey).catch(() => {});
            const cachedDocuments = await readDashboard(user?.id).catch(() => null);
            if (Array.isArray(cachedDocuments)) await writeDashboard(user?.id, cachedDocuments.filter(item => String(item.id) !== String(id))).catch(() => {});
          }
          setError(`Document unavailable: ${err.message}`);
        }
      }
    }
    load();
    return () => {
      disposed = true;
    };
  }, [id, draftKey, user?.id, applyContent]);
  const storeDraft = useCallback(async (next, base = baselineRef.current, version = versionRef.current, pending = true) => {
    await writeDraft(draftKey, {
      content: next,
      baseContent: base,
      version,
      pending,
      title: titleRef.current,
      titlePending: titlePendingRef.current,
      access: accessRef.current,
      updatedAt: new Date().toISOString()
    });
  }, [draftKey]);
  storeDraftRef.current = storeDraft;
  const connect = useCallback(() => {
    if (!documentRef.current || !readSession().token || !navigator.onLine) return;
    if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return;
    const socket = new WebSocket(socketUrl(id));
    socketRef.current = socket;
    socket.onopen = () => socket.send(JSON.stringify({
      type: 'auth',
      token: readSession().token
    }));
    socket.onmessage = async message => {
      const event = JSON.parse(message.data);
      if (event.type === 'auth.success') {
        inFlightRef.current = null;
        accessRef.current = event.access;
        setAccess(event.access);
        setStatus(navigator.onLine ? 'Connected' : 'Offline · draft saved');
        const local = contentRef.current;
        const remote = event.content || '';
        const merged = localEditRef.current ? mergeText(baselineRef.current, local, remote) : remote;
        baselineRef.current = remote;
        versionRef.current = Number(event.version);
        if (merged !== local) applyContent(merged);
        documentRef.current = {
          ...documentRef.current,
          content: remote,
          version: versionRef.current
        };
        setDocument(old => old ? {
          ...old,
          content: remote,
          version: versionRef.current
        } : old);
        await storeDraftRef.current?.(merged, remote, versionRef.current, merged !== remote);
        const serverTitle = event.title || 'Untitled document';
        if (titlePendingRef.current && titleRef.current !== serverTitle && ['owner', 'write'].includes(event.access)) {
          const wantedTitle = titleRef.current;
          api(`documents/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({
              title: wantedTitle
            })
          }).then(updated => {
            titlePendingRef.current = false;
            documentRef.current = {
              ...documentRef.current,
              title: updated.title
            };
            setDocument(old => old ? {
              ...old,
              title: updated.title
            } : old);
            storeDraftRef.current?.(contentRef.current, baselineRef.current, versionRef.current, localEditRef.current);
          }).catch(err => setError(`Title is waiting to sync: ${err.message}`));
        } else if (!titlePendingRef.current && titleRef.current !== serverTitle) {
          titleRef.current = serverTitle;
          documentRef.current = {
            ...documentRef.current,
            title: serverTitle
          };
          setTitle(serverTitle);
          setDocument(old => old ? {
            ...old,
            title: serverTitle
          } : old);
        }
        if (merged !== remote) {
          localEditRef.current = true;
          scheduleSyncRef.current?.(merged);
        } else {
          localEditRef.current = false;
        }
      } else if (event.type === 'presence.join' || event.type === 'presence.snapshot') {
        if (event.user_id !== readSession().user?.id) setPeople(old => old.some(person => person.user_id === event.user_id) ? old : [...old, event]);
      } else if (event.type === 'presence.leave') {
        setPeople(old => old.filter(person => person.user_id !== event.user_id));
        setCursors(old => {
          const next = {
            ...old
          };
          delete next[event.user_id];
          return next;
        });
      } else if (event.type === 'cursor.update') {
        setCursors(old => ({
          ...old,
          [event.user_id]: event
        }));
      } else if (event.type === 'content.update' || event.type === 'content.conflict') {
        const remote = event.content || '';
        const sent = inFlightRef.current;
        const isOwnUpdate = event.type === 'content.update' && event.user_id === readSession().user?.id;
        const base = event.type === 'content.conflict' && sent ? sent.baseContent : isOwnUpdate && sent ? sent.content : baselineRef.current;
        const merged = mergeText(base, contentRef.current, remote);
        baselineRef.current = remote;
        versionRef.current = Number(event.version);
        if (event.type === 'content.conflict' || isOwnUpdate) inFlightRef.current = null;
        const hasLocal = merged !== remote;
        applyContent(merged);
        localEditRef.current = hasLocal;
        setStatus(hasLocal ? 'Combining edits…' : 'Saved');
        await storeDraftRef.current?.(merged, remote, versionRef.current, hasLocal);
        if (hasLocal) scheduleSyncRef.current?.(merged);
        documentRef.current = {
          ...documentRef.current,
          content: remote,
          version: versionRef.current
        };
        setDocument(old => old ? {
          ...old,
          content: remote,
          version: versionRef.current
        } : old);
      } else if (event.type === 'permission.denied') {
        accessRef.current = 'read';
        setAccess('read');
        setError(event.detail || 'Your access changed to read only.');
      } else if (event.type === 'access.changed') {
        accessRef.current = event.access;
        setAccess(event.access);
        if (event.access === 'none') {
          allowReconnectRef.current = false;
          await deleteDraft(draftKey).catch(() => {});
          const cachedDocuments = await readDashboard(user?.id).catch(() => null);
          if (Array.isArray(cachedDocuments)) await writeDashboard(user?.id, cachedDocuments.filter(item => String(item.id) !== String(id))).catch(() => {});
          setError('The owner removed your access.');
          setContent('');
          contentRef.current = '';
          navigate('/');
        } else if (event.access === 'read') setError('Your access changed to read only.');
      } else if (event.type === 'document.deleted') {
        setError('The owner deleted this document.');
        await deleteDraft(draftKey).catch(() => {});
        navigate('/');
      } else if (event.type === 'auth.error') {
        setError(event.detail);
        if (event.detail?.includes('cannot access the document')) {
          allowReconnectRef.current = false;
          await deleteDraft(draftKey).catch(() => {});
          navigate('/');
        }
      }
    };
    socket.onclose = () => {
      if (!navigator.onLine) setStatus('Offline · draft saved on this device');
      if (allowReconnectRef.current) retryRef.current = setTimeout(connect, 2500);
    };
    socket.onerror = () => setStatus('Connection interrupted · draft saved');
  }, [id, applyContent]);
  const scheduleSync = useCallback(next => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await storeDraft(next, baselineRef.current, versionRef.current, true);
      const socket = socketRef.current;
      if (navigator.onLine && socket?.readyState === WebSocket.OPEN && !inFlightRef.current) {
        setStatus('Saving…');
        inFlightRef.current = {
          content: next,
          baseContent: baselineRef.current,
          baseVersion: versionRef.current
        };
        socket.send(JSON.stringify({
          type: 'content.update',
          content: next,
          base_version: versionRef.current
        }));
      } else setStatus('Offline · draft saved on this device');
    }, 650);
  }, [storeDraft]);
  scheduleSyncRef.current = scheduleSync;
  useEffect(() => {
    if (!document) return;
    allowReconnectRef.current = true;
    connect();
    return () => {
      allowReconnectRef.current = false;
      clearTimeout(timerRef.current);
      clearTimeout(retryRef.current);
      socketRef.current?.close();
    };
  }, [document?.id, connect]);
  useEffect(() => {
    const onOnline = () => {
      setStatus('Reconnecting…');
      socketRef.current?.close();
      connect();
    };
    const onOffline = () => setStatus('Offline · draft saved on this device');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [connect]);
  async function changeContent(next) {
    if (!canWrite) return;
    localEditRef.current = true;
    applyContent(next);
    await storeDraft(next, baselineRef.current, versionRef.current, true).catch(() => setStatus('Unable to store this browser draft'));
    scheduleSync(next);
  }
  async function changeTitle(next) {
    titleRef.current = next;
    titlePendingRef.current = true;
    setTitle(next);
    setDocument(old => old ? {
      ...old,
      title: next
    } : old);
    await storeDraft(contentRef.current, baselineRef.current, versionRef.current, localEditRef.current);
  }
  async function saveTitle() {
    if (!document || !canWrite || !online) return;
    if (!title.trim()) {
      titleRef.current = 'Untitled document';
      titlePendingRef.current = true;
      setTitle(titleRef.current);
      setDocument(old => old ? {
        ...old,
        title: titleRef.current
      } : old);
    }
    try {
      const updated = await api(`documents/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: titleRef.current
        })
      });
      titlePendingRef.current = false;
      documentRef.current = updated;
      setDocument(updated);
      setTitle(updated.title);
      titleRef.current = updated.title;
      await storeDraft(contentRef.current, baselineRef.current, versionRef.current, localEditRef.current);
    } catch (err) {
      setError(err.message);
    }
  }
  function sendCursor(target) {
    const position = target.selectionEnd;
    setLocalCursorOffset(position);
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({
      type: 'cursor.update',
      anchor: target.selectionStart,
      head: target.selectionEnd
    }));
  }
  async function openShares() {
    setShareOpen(true);
    try {
      setShares(await api(`documents/${id}/share/`));
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeShare(username) {
    try {
      await api(`documents/${id}/share/`, {
        method: 'DELETE',
        body: JSON.stringify({
          username
        })
      });
      setShares(old => old.filter(item => item.username !== username));
    } catch (err) {
      setError(err.message);
    }
  }
  async function updateShare(username, level) {
    try {
      const membership = await api(`documents/${id}/share/`, {
        method: 'POST',
        body: JSON.stringify({
          username,
          access: level
        })
      });
      setShares(old => [...old.filter(item => item.id !== membership.id), membership]);
      setShareUser('');
    } catch (err) {
      setError(err.message);
    }
  }
  async function duplicate() {
    try {
      const copy = await api(`documents/${id}/duplicate/`, {
        method: 'POST'
      });
      navigate(`/docs/${copy.id}`);
    } catch (err) {
      setError(err.message);
    }
  }
  async function deleteDocument() {
    if (!window.confirm(`Delete “${title}”? This also removes its shared access.`)) return;
    try {
      await api(`documents/${id}/`, {
        method: 'DELETE'
      });
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }
  function exportDocument(kind) {
    const ext = kind === 'json' ? 'json' : kind === 'txt' ? 'txt' : 'md';
    const body = kind === 'json' ? JSON.stringify({
      title,
      content,
      updatedAt: new Date().toISOString()
    }, null, 2) : content;
    const blob = new Blob([body], {
      type: kind === 'json' ? 'application/json' : 'text/plain'
    });
    const anchor = Object.assign(window.document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `${safeFileName(title)}.${ext}`
    });
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }
  const cursorPeople = Object.values(cursors).filter(cursor => cursor.user_id !== user?.id);
  const cursorMarkers = [{
    key: 'self',
    username: user?.username || 'You',
    position: content ? localCursorOffset : 0,
    color: '#4f9c6d',
    self: true
  }, ...cursorPeople.map(person => ({
    key: person.user_id,
    username: person.username || 'Collaborator',
    position: content ? person.head : 0,
    color: palette[person.user_id % palette.length]
  }))];
  if (!document) return /*#__PURE__*/React.createElement("div", {
    className: "editor-loading"
  }, /*#__PURE__*/React.createElement(LoaderCircle, {
    className: "spin"
  }), " ", error || 'Loading your document…', /*#__PURE__*/React.createElement(Link, {
    to: "/"
  }, "Back to workspace"));
  return /*#__PURE__*/React.createElement("div", {
    className: "editor-shell"
  }, /*#__PURE__*/React.createElement("header", {
    className: "editor-topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "editor-brand"
  }, /*#__PURE__*/React.createElement(Link, {
    to: "/",
    className: "brand"
  }, /*#__PURE__*/React.createElement("div", {
    className: "brand-mark small"
  }, /*#__PURE__*/React.createElement("span", null))), /*#__PURE__*/React.createElement("span", {
    className: "crumb-slash"
  }, "/"), /*#__PURE__*/React.createElement(Link, {
    to: "/",
    className: "crumb-link"
  }, "My workspace"), /*#__PURE__*/React.createElement("span", {
    className: "crumb-slash"
  }, "/"), titleEditing && canWrite ? /*#__PURE__*/React.createElement("input", {
    className: "title-input",
    autoFocus: true,
    value: title,
    onChange: e => changeTitle(e.target.value),
    onBlur: () => {
      saveTitle();
      setTitleEditing(false);
    },
    onKeyDown: e => {
      if (e.key === 'Enter') e.currentTarget.blur();
      if (e.key === 'Escape') {
        setTitle(document.title);
        titleRef.current = document.title;
        setTitleEditing(false);
      }
    },
    "aria-label": "Document title"
  }) : /*#__PURE__*/React.createElement("button", {
    className: "title-display",
    onDoubleClick: () => canWrite && setTitleEditing(true),
    title: canWrite ? 'Double-click to rename' : undefined
  }, title)), /*#__PURE__*/React.createElement("div", {
    className: "editor-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "theme-toggle",
    onClick: onToggleTheme,
    "aria-label": `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`
  }, theme === 'light' ? /*#__PURE__*/React.createElement(Moon, {
    size: 16
  }) : /*#__PURE__*/React.createElement(Sun, {
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, theme === 'light' ? 'Dark' : 'Light')), /*#__PURE__*/React.createElement("div", {
    className: "save-indicator"
  }, /*#__PURE__*/React.createElement("span", {
    className: `save-dot ${online ? '' : 'offline'}`
  }), status), /*#__PURE__*/React.createElement("div", {
    className: "people-stack"
  }, people.slice(0, 4).map(person => /*#__PURE__*/React.createElement("span", {
    key: person.user_id,
    title: `${person.username} is here`,
    style: {
      backgroundColor: palette[person.user_id % palette.length]
    }
  }, person.username?.[0]?.toUpperCase())), /*#__PURE__*/React.createElement("span", {
    className: "self-dot",
    title: `You · ${access}`
  }, user?.username?.[0]?.toUpperCase() || 'Y')), /*#__PURE__*/React.createElement("div", {
    className: "toolbar-separator"
  }), canManage && /*#__PURE__*/React.createElement("button", {
    className: "button share-button",
    onClick: openShares
  }, /*#__PURE__*/React.createElement(Share2, {
    size: 16
  }), " Share"), /*#__PURE__*/React.createElement("details", {
    className: "more-menu-wrap",
    onClick: event => {
      if (event.target.closest('.floating-menu button')) event.currentTarget.open = false;
    }
  }, /*#__PURE__*/React.createElement("summary", {
    className: "icon-btn bordered",
    "aria-label": "Document options"
  }, /*#__PURE__*/React.createElement(MoreHorizontal, {
    size: 19
  })), /*#__PURE__*/React.createElement("div", {
    className: "floating-menu right-menu"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => exportDocument('md')
  }, /*#__PURE__*/React.createElement(ArrowDownToLine, {
    size: 14
  }), "Export Markdown"), /*#__PURE__*/React.createElement("button", {
    onClick: () => exportDocument('txt')
  }, /*#__PURE__*/React.createElement(ArrowDownToLine, {
    size: 14
  }), "Export plain text"), /*#__PURE__*/React.createElement("button", {
    onClick: () => exportDocument('json')
  }, /*#__PURE__*/React.createElement(ArrowDownToLine, {
    size: 14
  }), "Export JSON"), /*#__PURE__*/React.createElement("button", {
    onClick: duplicate
  }, /*#__PURE__*/React.createElement(FilePlus2, {
    size: 14
  }), "Make a copy"), canManage && /*#__PURE__*/React.createElement("button", {
    className: "danger-text",
    onClick: deleteDocument
  }, /*#__PURE__*/React.createElement(Trash2, {
    size: 14
  }), "Delete document"), /*#__PURE__*/React.createElement("button", {
    onClick: onSignOut
  }, /*#__PURE__*/React.createElement(LogOut, {
    size: 14
  }), "Sign out"))))), /*#__PURE__*/React.createElement("main", {
    className: "editor-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "editor-canvas"
  }, /*#__PURE__*/React.createElement("div", {
    className: "paper-kicker"
  }, /*#__PURE__*/React.createElement("span", null, "WORKING DOCUMENT"), /*#__PURE__*/React.createElement("span", null, access === 'owner' ? 'PRIVATE SPACE' : access === 'full' ? 'SHARED · FULL ACCESS' : access === 'write' ? 'SHARED · CAN EDIT' : 'SHARED · READ ONLY')), /*#__PURE__*/React.createElement("div", {
    className: "document-heading"
  }, /*#__PURE__*/React.createElement("div", {
    className: "document-icon"
  }, /*#__PURE__*/React.createElement(FileText, {
    size: 18
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    onDoubleClick: () => canWrite && setTitleEditing(true),
    title: canWrite ? 'Double-click to rename' : undefined
  }, title || 'Untitled document'), /*#__PURE__*/React.createElement("p", null, "Edited ", relativeTime(document.updated_at), " ", /*#__PURE__*/React.createElement("span", null, "\xB7"), " ", people.length + 1, " in this space"))), error && /*#__PURE__*/React.createElement("div", {
    className: "error-banner editor-error"
  }, error, /*#__PURE__*/React.createElement("button", {
    onClick: () => setError('')
  }, /*#__PURE__*/React.createElement(X, {
    size: 14
  }))), !canWrite && /*#__PURE__*/React.createElement("div", {
    className: "editor-tools"
  }, /*#__PURE__*/React.createElement("span", {
    className: "read-only-label"
  }, /*#__PURE__*/React.createElement(Shield, {
    size: 13
  }), " Read only")), /*#__PURE__*/React.createElement("div", {
    className: "writing-layer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "writing-overlay",
    ref: overlayRef,
    "aria-hidden": "true"
  }, renderCursorOverlay(content || ' ', cursorMarkers), !content && /*#__PURE__*/React.createElement("span", {
    className: "writing-placeholder"
  }, canWrite ? 'Start with a thought…' : 'This document is empty.')), /*#__PURE__*/React.createElement("textarea", {
    className: "writing-area",
    spellCheck: true,
    maxLength: 2000000,
    value: content,
    readOnly: !canWrite,
    onChange: e => changeContent(e.target.value),
    onFocus: e => sendCursor(e.currentTarget),
    onSelect: e => sendCursor(e.target),
    onKeyUp: e => sendCursor(e.currentTarget),
    onScroll: e => {
      if (overlayRef.current) {
        overlayRef.current.scrollTop = e.currentTarget.scrollTop;
        overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
    },
    placeholder: "",
    "aria-label": "Shared document editor"
  })), /*#__PURE__*/React.createElement("div", {
    className: "editor-bottom"
  }, /*#__PURE__*/React.createElement("span", null, content.trim() ? `${content.trim().split(/\s+/).length} words` : 'No words yet'), /*#__PURE__*/React.createElement("span", null, content.length, " characters"))), /*#__PURE__*/React.createElement("aside", {
    className: "editor-aside"
  }, /*#__PURE__*/React.createElement("div", {
    className: "aside-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "aside-heading"
  }, /*#__PURE__*/React.createElement("span", null, "IN THIS DOCUMENT")), /*#__PURE__*/React.createElement("div", {
    className: "presence-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "presence-avatar self"
  }, user?.username?.[0]?.toUpperCase() || 'Y'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "You"), /*#__PURE__*/React.createElement("small", null, access === 'owner' ? 'Owner · full access' : access === 'full' ? 'Full access · can manage' : access === 'write' ? 'Editor · can edit' : 'Viewer · can read')), /*#__PURE__*/React.createElement("span", {
    className: "live-pip"
  })), people.filter(person => person.user_id !== user?.id).map(person => {
    const cursor = cursors[person.user_id];
    return /*#__PURE__*/React.createElement("div", {
      className: `presence-row ${cursor ? 'is-editing' : ''}`,
      key: person.user_id
    }, /*#__PURE__*/React.createElement("span", {
      className: "presence-avatar",
      style: {
        backgroundColor: palette[person.user_id % palette.length]
      }
    }, person.username?.[0]?.toUpperCase()), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, person.username), /*#__PURE__*/React.createElement("small", null, cursor ? 'Editing now' : 'Viewing document')), /*#__PURE__*/React.createElement("span", {
      className: "live-pip"
    }));
  })), /*#__PURE__*/React.createElement("div", {
    className: "aside-divider"
  }), /*#__PURE__*/React.createElement("div", {
    className: "aside-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "aside-heading"
  }, /*#__PURE__*/React.createElement("span", null, "DOCUMENT DETAILS")), /*#__PURE__*/React.createElement("div", {
    className: "detail-row"
  }, /*#__PURE__*/React.createElement("span", null, "Last saved"), /*#__PURE__*/React.createElement("strong", null, status.startsWith('Offline') ? 'On this device' : status === 'Saved' ? 'Just now' : status)), /*#__PURE__*/React.createElement("div", {
    className: "detail-row"
  }, /*#__PURE__*/React.createElement("span", null, "Access"), /*#__PURE__*/React.createElement("strong", null, access === 'owner' ? 'Only you' : access === 'full' ? 'Full access' : access === 'write' ? 'Can edit' : 'Can view')), /*#__PURE__*/React.createElement("div", {
    className: "detail-row"
  }, /*#__PURE__*/React.createElement("span", null, "Word count"), /*#__PURE__*/React.createElement("strong", null, content.trim() ? content.trim().split(/\s+/).length : 0))), /*#__PURE__*/React.createElement("div", {
    className: "offline-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "offline-card-icon"
  }, online ? /*#__PURE__*/React.createElement(Cloud, {
    size: 16
  }) : /*#__PURE__*/React.createElement(CloudOff, {
    size: 16
  })), /*#__PURE__*/React.createElement("strong", null, online ? 'Local safety net is on' : 'Your edits are safe here'), /*#__PURE__*/React.createElement("p", null, "Drafts are stored in this browser and sync when you reconnect.")), /*#__PURE__*/React.createElement("button", {
    className: "signout-link",
    onClick: onSignOut
  }, /*#__PURE__*/React.createElement(LogOut, {
    size: 14
  }), " Sign out"))), shareOpen && /*#__PURE__*/React.createElement("div", {
    className: "modal-backdrop",
    onMouseDown: e => {
      if (e.target === e.currentTarget) setShareOpen(false);
    }
  }, /*#__PURE__*/React.createElement("section", {
    className: "share-modal"
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "OPEN THE DOOR"), /*#__PURE__*/React.createElement("h2", null, "Share this document")), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    onClick: () => setShareOpen(false)
  }, /*#__PURE__*/React.createElement(X, {
    size: 18
  }))), /*#__PURE__*/React.createElement("p", {
    className: "muted"
  }, "Invite a Collab Editor user and choose their access."), /*#__PURE__*/React.createElement("div", {
    className: "invite-row"
  }, /*#__PURE__*/React.createElement("input", {
    value: shareUser,
    onChange: e => setShareUser(e.target.value),
    placeholder: "Enter a username",
    onKeyDown: e => {
      if (e.key === 'Enter' && shareUser.trim()) updateShare(shareUser.trim(), shareAccess);
    }
  }), /*#__PURE__*/React.createElement("select", {
    value: shareAccess,
    onChange: e => setShareAccess(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "full"
  }, "Full access \xB7 manage and delete"), /*#__PURE__*/React.createElement("option", {
    value: "write"
  }, "Can edit"), /*#__PURE__*/React.createElement("option", {
    value: "read"
  }, "Can view")), /*#__PURE__*/React.createElement("button", {
    className: "button primary",
    disabled: !shareUser.trim(),
    onClick: () => updateShare(shareUser.trim(), shareAccess)
  }, "Add")), /*#__PURE__*/React.createElement("div", {
    className: "member-heading"
  }, "PEOPLE WITH ACCESS ", /*#__PURE__*/React.createElement("span", null, shares.filter(share => share.access !== 'none').length + 1)), /*#__PURE__*/React.createElement("div", {
    className: "share-member"
  }, /*#__PURE__*/React.createElement("span", {
    className: "presence-avatar self"
  }, user?.username?.[0]?.toUpperCase() || 'Y'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, user?.username || 'You'), /*#__PURE__*/React.createElement("small", null, "Owner")), /*#__PURE__*/React.createElement("span", {
    className: "member-access"
  }, "Full access")), shares.map(share => /*#__PURE__*/React.createElement("div", {
    className: "share-member",
    key: share.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "presence-avatar",
    style: {
      backgroundColor: palette[share.id % palette.length]
    }
  }, share.username?.[0]?.toUpperCase()), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, share.username), /*#__PURE__*/React.createElement("small", null, share.email || 'Relay member')), /*#__PURE__*/React.createElement("select", {
    "aria-label": `Access for ${share.username}`,
    value: share.access,
    onChange: e => updateShare(share.username, e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "full"
  }, "Full access"), /*#__PURE__*/React.createElement("option", {
    value: "write"
  }, "Can edit"), /*#__PURE__*/React.createElement("option", {
    value: "read"
  }, "Can view"), /*#__PURE__*/React.createElement("option", {
    value: "none"
  }, "No access")), /*#__PURE__*/React.createElement("button", {
    className: "remove-member",
    onClick: () => removeShare(share.username),
    "aria-label": `Remove ${share.username}`
  }, "Remove"))), /*#__PURE__*/React.createElement("div", {
    className: "share-note"
  }, /*#__PURE__*/React.createElement(Shield, {
    size: 14
  }), " Full access lets trusted collaborators edit, delete, and manage sharing. Change or remove access at any time."))));
}
function relativeTime(value) {
  if (!value) return 'just now';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}
function safeFileName(title) {
  return (title || 'document').trim().replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'document';
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
