const { useCallback, useEffect, useMemo, useRef, useState } = React;
const API_BASE = '';

function readSession() {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('relay.user') || 'null'); } catch { user = null; }
  return { token: localStorage.getItem('relay.token'), user };
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
  const response = await fetch(`${API_BASE}/api/${path.replace(/^\//, '')}`, { ...options, headers });
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, ...(register ? { email } : {}) }),
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
  return database().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(String(key));
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  }));
}
function writeDraft(key, value) {
  return database().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, String(key));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }));
}
function deleteDraft(key) {
  return database().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(String(key));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }));
}
function readDashboard(userId = 'unknown') { return readDraft(`dashboard:${userId}`); }
function writeDashboard(userId = 'unknown', value) { return writeDraft(`dashboard:${userId}`, value); }

const dmp = new DiffMatchPatch();
function makeIcon(name) {
  return function RelayIcon({ size = 16, strokeWidth = 2, ...props }) {
    const icon = lucide.icons[name];
    if (!icon) return null;
    const renderNode = (node, key) => {
      const [tag, attributes, children] = node;
      return React.createElement(tag, { ...attributes, key }, ...(children || []).map(renderNode));
    };
    const [tag, attributes, children] = icon;
    return React.createElement(tag, { ...attributes, ...props, width: size, height: size, 'stroke-width': strokeWidth }, ...(children || []).map(renderNode));
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
const Pencil = makeIcon('Pencil');
const Plus = makeIcon('Plus');
const Search = makeIcon('Search');
const Settings2 = makeIcon('Settings2');
const Share2 = makeIcon('Share2');
const Shield = makeIcon('Shield');
const Sparkles = makeIcon('Sparkles');
const Trash2 = makeIcon('Trash2');
const X = makeIcon('X');

function navigateTo(path, replace = false) {
  if (replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
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
function useNavigate() { return navigateTo; }
function useParams() {
  const match = window.location.pathname.match(/^\/docs\/(\d+)\/?$/);
  return { id: match ? match[1] : undefined };
}
function Link({ to, onClick, children, ...props }) {
  return <a href={to} {...props} onClick={(event) => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      navigateTo(to);
    }
  }}>{children}</a>;
}
function Route() { return null; }
function Routes({ children }) {
  const path = useCurrentPath();
  const routes = React.Children.toArray(children);
  const selected = routes.find((route) => {
    const routePath = route.props.path;
    if (routePath === '*') return false;
    if (routePath === '/docs/:id') return /^\/docs\/\d+\/?$/.test(path);
    return routePath === path;
  }) || routes.find((route) => route.props.path === '*');
  return selected ? selected.props.element : null;
}
function Navigate({ to, replace = false }) {
  useEffect(() => { navigateTo(to, replace); }, [to, replace]);
  return null;
}

const palette = ['#ef8b65', '#738de0', '#57a48a', '#be83c6', '#d4a044']

function mergeText(base, local, remote) {
  if (local === base) return remote
  if (remote === base) return local
  if (local === remote) return local
  if (local.includes(remote) || remote.includes(local)) return local.length >= remote.length ? local : remote
  const patches = dmp.patch_make(base, local)
  return dmp.patch_apply(patches, remote)[0]
}

function App() {
  const [session, setSession] = useState(readSession)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    if (session.token) api('auth/me/').then((user) => {
      localStorage.setItem('relay.user', JSON.stringify(user))
      setSession({ token: session.token, user })
    }).catch(() => {})
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const signOut = useCallback(async () => {
    try { await api('auth/logout/', { method: 'POST' }) } catch { /* local sign out still works offline */ }
    clearSession()
    setSession({ token: null, user: null })
  }, [])

  if (!session.token) return <AuthPage onAuthenticated={(user) => setSession({ token: readSession().token, user })} />
  return <Routes>
    <Route path="/" element={<Dashboard user={session.user} online={online} onSignOut={signOut} />} />
    <Route path="/docs/:id" element={<Editor user={session.user} online={online} onSignOut={signOut} />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}

function AuthPage({ onAuthenticated }) {
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try { onAuthenticated(await authenticate(form.username, form.password, register, form.email)) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  return <main className="auth-shell">
    <div className="auth-brand"><div className="brand-mark"><span /></div><span>relay</span></div>
    <section className="auth-card">
      <div className="eyebrow">THOUGHTS, IN SYNC</div>
      <h1>{register ? 'Make room for good ideas.' : 'Pick up where ideas happen.'}</h1>
      <p className="muted">A shared writing space that stays with you, online or off.</p>
      <form onSubmit={submit} className="auth-form">
        <label>Username<input required autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
        {register && <label>Email <span className="optional">optional</span><input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>}
        <label>Password<input required minLength={register ? 8 : 1} type="password" autoComplete={register ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <div className="error-banner">{error}</div>}
        <button className="button primary wide" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : null}{register ? 'Create account' : 'Sign in'}<span>↗</span></button>
      </form>
      <div className="auth-toggle">{register ? 'Already have an account?' : 'New to Relay?'} <button onClick={() => { setRegister(!register); setError('') }}>{register ? 'Sign in' : 'Create an account'}</button></div>
    </section>
    <div className="auth-foot"><span><Shield size={14} /> Your writing stays yours</span><span>Built for the in-between moments</span></div>
  </main>
}

function Dashboard({ user, online, onSignOut }) {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortNewestFirst, setSortNewestFirst] = useState(true)
  const [error, setError] = useState('')
  const [menu, setMenu] = useState(null)
  const [creating, setCreating] = useState(false)

  const loadDocuments = useCallback(async () => {
    try {
      const result = await api('documents/')
      setDocuments(result.results || result)
      await writeDashboard(user?.id, result.results || result)
      setError('')
    } catch (err) {
      const cached = await readDashboard(user?.id).catch(() => null)
      if (cached) setDocuments(cached)
      else setError(err.message)
    } finally { setLoading(false) }
  }, [user?.id])
  useEffect(() => { loadDocuments() }, [loadDocuments])
  useEffect(() => { if (online) loadDocuments() }, [online, loadDocuments])

  async function createDocument() {
    setCreating(true)
    try {
      const document = await api('documents/', { method: 'POST', body: JSON.stringify({ title: 'Untitled document', content: '' }) })
      navigate(`/docs/${document.id}`)
    } catch (err) { setError(err.message) }
    finally { setCreating(false) }
  }
  async function documentAction(action, doc) {
    setMenu(null)
    try {
      if (action === 'duplicate') {
        const clone = await api(`documents/${doc.id}/duplicate/`, { method: 'POST' })
        navigate(`/docs/${clone.id}`)
      } else if (action === 'delete') {
        if (!window.confirm(`Move “${doc.title}” to trash?`)) return
        await api(`documents/${doc.id}/`, { method: 'DELETE' })
        setDocuments((items) => items.filter((item) => item.id !== doc.id))
      }
    } catch (err) { setError(err.message) }
  }
  const filtered = useMemo(() => documents
    .filter((doc) => doc.title.toLowerCase().includes(search.toLowerCase()))
    .sort((first, second) => sortNewestFirst
      ? new Date(second.updated_at) - new Date(first.updated_at)
      : new Date(first.updated_at) - new Date(second.updated_at)), [documents, search, sortNewestFirst])

  return <div className="dashboard-shell">
    <aside className="sidebar">
      <Link to="/" className="brand"><div className="brand-mark"><span /></div><span>relay</span></Link>
      <button className="nav-item active"><FolderOpen size={17} /> My workspace</button>
      <div className="side-label">YOUR SPACE</div>
      <div className="workspace-card"><div className="workspace-avatar">{user?.username?.[0]?.toUpperCase() || 'Y'}</div><div><strong>{user?.username || 'Your workspace'}</strong><small>Personal</small></div><ChevronDown size={15} /></div>
      <div className="sidebar-note"><Sparkles size={15} /><div><strong>Work in progress</strong><p>Your drafts save as you write, even when your connection wanders.</p></div></div>
      <div className="sidebar-bottom"><div className={`connection-dot ${online ? 'is-online' : ''}`} /><span>{online ? 'Connected' : 'Working offline'}</span><button title="Sign out" onClick={onSignOut}><LogOut size={15} /></button></div>
    </aside>
    <main className="dashboard-main">
      <header className="dash-top"><div className="breadcrumbs">Workspace <span>/</span> My documents</div><div className="top-actions"><div className="user-avatar" title={user?.username}>{user?.username?.[0]?.toUpperCase() || 'Y'}</div></div></header>
      <div className="dash-content">
        <div className="dash-heading"><div><div className="eyebrow">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()}</div><h1>Your workspace<span className="heading-dot">.</span></h1><p>Good ideas don’t always arrive at a desk. Keep them moving.</p></div><button className="button primary" onClick={createDocument} disabled={creating}><Plus size={17} /> New document</button></div>
        {!online && <div className="offline-banner"><CloudOff size={16} /><span>Offline mode — showing your last saved workspace. Changes stay on this device until you reconnect.</span></div>}
        {error && <div className="error-banner page-error">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
        <div className="library-heading"><div><h2>Recent documents</h2><span className="count">{documents.length}</span></div><div className="library-tools"><label className="search-box"><Search size={16} /><input placeholder="Find a document" value={search} onChange={(e) => setSearch(e.target.value)} /></label><button className="icon-btn bordered" title={sortNewestFirst ? 'Oldest edited first' : 'Newest edited first'} aria-label={sortNewestFirst ? 'Oldest edited first' : 'Newest edited first'} onClick={() => setSortNewestFirst((value) => !value)}><Settings2 size={17} /></button></div></div>
        {loading ? <div className="loading-state"><LoaderCircle className="spin" /> Opening your workspace…</div> : filtered.length === 0 ? <div className="empty-state"><div className="empty-icon"><FilePlus2 size={21} /></div><h3>{search ? 'No matching documents' : 'A blank page, full of possibility.'}</h3><p>{search ? 'Try a different search.' : 'Start a document and invite someone in.'}</p>{!search && <button className="button secondary" onClick={createDocument}><Plus size={16} /> Create a document</button>}</div> : <div className="document-grid">{filtered.map((doc, index) => <article className="doc-card" key={doc.id}>
          <div className="doc-card-top"><div className={`doc-icon doc-color-${index % 4}`}><FileText size={18} /></div><button className="icon-btn more-btn" onClick={() => setMenu(menu === doc.id ? null : doc.id)}><MoreHorizontal size={18} /></button>
            {menu === doc.id && <div className="floating-menu"><button onClick={() => navigate(`/docs/${doc.id}`)}><Pencil size={14} />Open document</button><button onClick={() => documentAction('duplicate', doc)}><FilePlus2 size={14} />Duplicate</button>{doc.access === 'owner' && <button className="danger-text" onClick={() => documentAction('delete', doc)}><Trash2 size={14} />Delete</button>}</div>}
          </div>
          <button className="doc-card-body" onClick={() => navigate(`/docs/${doc.id}`)}><strong>{doc.title || 'Untitled document'}</strong><p>{doc.access === 'owner' ? 'Your document' : `Shared by ${doc.owner}`} · {relativeTime(doc.updated_at)}</p></button>
          <div className="doc-card-foot"><span className={`access-pill ${doc.access}`}>{doc.access === 'owner' ? 'Owner' : doc.access === 'write' ? 'Can edit' : 'Can view'}</span><span className="collab-dots"><i>{(user?.username?.[0] || 'Y').toUpperCase()}</i>{doc.access !== 'owner' && <i>↗</i>}</span></div>
        </article>)}</div>}
        <div className="tip-card"><div className="tip-star"><Sparkles size={17} /></div><div><strong>A small trick for long documents</strong><p>Your changes sync in thoughtful batches. Write without waiting for each keystroke to travel.</p></div><span className="tip-tag">LESS CHATTER, SAME CLARITY</span></div>
      </div>
    </main>
  </div>
}

function Editor({ user, online, onSignOut }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const draftKey = `document:${user?.id ?? 'unknown'}:${id}`
  const [document, setDocument] = useState(null)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [access, setAccess] = useState('read')
  const [status, setStatus] = useState('Loading document')
  const [people, setPeople] = useState([])
  const [cursors, setCursors] = useState({})
  const [shareOpen, setShareOpen] = useState(false)
  const [shares, setShares] = useState([])
  const [shareUser, setShareUser] = useState('')
  const [shareAccess, setShareAccess] = useState('write')
  const [error, setError] = useState('')
  const socketRef = useRef(null)
  const documentRef = useRef(null)
  const titleRef = useRef(title)
  const accessRef = useRef(access)
  const titlePendingRef = useRef(false)
  const contentRef = useRef('')
  const baselineRef = useRef('')
  const versionRef = useRef(0)
  const timerRef = useRef(null)
  const retryRef = useRef(null)
  const scheduleSyncRef = useRef(null)
  const storeDraftRef = useRef(null)
  const inFlightRef = useRef(null)
  const allowReconnectRef = useRef(false)
  const localEditRef = useRef(false)
  const canWrite = access === 'owner' || access === 'write'

  const applyContent = useCallback((next) => {
    contentRef.current = next
    setContent(next)
  }, [])

  useEffect(() => {
    let disposed = false
    async function load() {
      const cached = await readDraft(draftKey).catch(() => null)
      try {
        const doc = await api(`documents/${id}/`)
        if (disposed) return
        const canEditDraft = ['owner', 'write'].includes(doc.access)
        const draft = cached?.pending && canEditDraft ? cached : null
        const localTitle = cached?.titlePending && canEditDraft ? cached.title : doc.title
        const merged = draft ? mergeText(draft.baseContent || '', draft.content || '', doc.content || '') : doc.content || ''
        documentRef.current = { ...doc, title: localTitle }
        titleRef.current = localTitle; titlePendingRef.current = Boolean(cached?.titlePending && canEditDraft); accessRef.current = doc.access
        setDocument({ ...doc, title: localTitle }); setTitle(localTitle); setAccess(doc.access)
        baselineRef.current = doc.content || ''; versionRef.current = doc.version
        applyContent(merged)
        localEditRef.current = merged !== (doc.content || '')
        setStatus(localEditRef.current ? 'Merging offline edits' : 'Saved')
        if (localEditRef.current || titlePendingRef.current) await writeDraft(draftKey, { content: merged, baseContent: baselineRef.current, version: versionRef.current, pending: localEditRef.current, title: localTitle, titlePending: titlePendingRef.current, access: doc.access, updatedAt: new Date().toISOString() })
      } catch (err) {
        if (disposed) return
        if (cached && (!err.status || err.status >= 500 || err.status === 408 || err.status === 429)) {
          const fakeDoc = { id: Number(id), title: cached.title || 'Offline document', version: cached.version || 0, access: cached.access || 'write', updated_at: cached.updatedAt }
          documentRef.current = fakeDoc
          titleRef.current = fakeDoc.title; accessRef.current = fakeDoc.access
          titlePendingRef.current = Boolean(cached.titlePending)
          setDocument(fakeDoc); setTitle(fakeDoc.title); setAccess(fakeDoc.access)
          baselineRef.current = cached.baseContent || ''; versionRef.current = cached.version || 0
          applyContent(cached.content || '')
          localEditRef.current = Boolean(cached.pending)
          setStatus('Offline draft saved on this device')
        } else {
          if (cached) {
            await deleteDraft(draftKey).catch(() => {})
            const cachedDocuments = await readDashboard(user?.id).catch(() => null)
            if (Array.isArray(cachedDocuments)) await writeDashboard(user?.id, cachedDocuments.filter((item) => String(item.id) !== String(id))).catch(() => {})
          }
          setError(`Document unavailable: ${err.message}`)
        }
      }
    }
    load()
    return () => { disposed = true }
  }, [id, draftKey, user?.id, applyContent])

  const storeDraft = useCallback(async (next, base = baselineRef.current, version = versionRef.current, pending = true) => {
    await writeDraft(draftKey, { content: next, baseContent: base, version, pending, title: titleRef.current, titlePending: titlePendingRef.current, access: accessRef.current, updatedAt: new Date().toISOString() })
  }, [draftKey])
  storeDraftRef.current = storeDraft

  const connect = useCallback(() => {
    if (!documentRef.current || !readSession().token || !navigator.onLine) return
    if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return
    const socket = new WebSocket(socketUrl(id))
    socketRef.current = socket
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token: readSession().token }))
    socket.onmessage = async (message) => {
      const event = JSON.parse(message.data)
      if (event.type === 'auth.success') {
        inFlightRef.current = null
        accessRef.current = event.access
        setAccess(event.access)
        setStatus(navigator.onLine ? 'Connected' : 'Offline · draft saved')
        const local = contentRef.current
        const remote = event.content || ''
        const merged = localEditRef.current ? mergeText(baselineRef.current, local, remote) : remote
        baselineRef.current = remote; versionRef.current = Number(event.version)
        if (merged !== local) applyContent(merged)
        documentRef.current = { ...documentRef.current, content: remote, version: versionRef.current }
        setDocument((old) => old ? { ...old, content: remote, version: versionRef.current } : old)
        await storeDraftRef.current?.(merged, remote, versionRef.current, merged !== remote)
        const serverTitle = event.title || 'Untitled document'
        if (titlePendingRef.current && titleRef.current !== serverTitle && ['owner', 'write'].includes(event.access)) {
          const wantedTitle = titleRef.current
          api(`documents/${id}/`, { method: 'PATCH', body: JSON.stringify({ title: wantedTitle }) }).then((updated) => {
            titlePendingRef.current = false
            documentRef.current = { ...documentRef.current, title: updated.title }
            setDocument((old) => old ? { ...old, title: updated.title } : old)
            storeDraftRef.current?.(contentRef.current, baselineRef.current, versionRef.current, localEditRef.current)
          }).catch((err) => setError(`Title is waiting to sync: ${err.message}`))
        } else if (!titlePendingRef.current && titleRef.current !== serverTitle) {
          titleRef.current = serverTitle
          documentRef.current = { ...documentRef.current, title: serverTitle }
          setTitle(serverTitle); setDocument((old) => old ? { ...old, title: serverTitle } : old)
        }
        if (merged !== remote) {
          localEditRef.current = true
          scheduleSyncRef.current?.(merged)
        } else {
          localEditRef.current = false
        }
      } else if (event.type === 'presence.join' || event.type === 'presence.snapshot') {
        if (event.user_id !== readSession().user?.id) setPeople((old) => old.some((person) => person.user_id === event.user_id) ? old : [...old, event])
      } else if (event.type === 'presence.leave') {
        setPeople((old) => old.filter((person) => person.user_id !== event.user_id))
        setCursors((old) => { const next = { ...old }; delete next[event.user_id]; return next })
      } else if (event.type === 'cursor.update') {
        setCursors((old) => ({ ...old, [event.user_id]: event }))
      } else if (event.type === 'content.update' || event.type === 'content.conflict') {
        const remote = event.content || ''
        const sent = inFlightRef.current
        const isOwnUpdate = event.type === 'content.update' && event.user_id === readSession().user?.id
        const base = event.type === 'content.conflict' && sent ? sent.baseContent : isOwnUpdate && sent ? sent.content : baselineRef.current
        const merged = mergeText(base, contentRef.current, remote)
        baselineRef.current = remote; versionRef.current = Number(event.version)
        if (event.type === 'content.conflict' || isOwnUpdate) inFlightRef.current = null
        const hasLocal = merged !== remote
        applyContent(merged)
        localEditRef.current = hasLocal
        setStatus(hasLocal ? 'Combining edits…' : 'Saved')
        await storeDraftRef.current?.(merged, remote, versionRef.current, hasLocal)
        if (hasLocal) scheduleSyncRef.current?.(merged)
        documentRef.current = { ...documentRef.current, content: remote, version: versionRef.current }
        setDocument((old) => old ? { ...old, content: remote, version: versionRef.current } : old)
      } else if (event.type === 'permission.denied') {
        accessRef.current = 'read'; setAccess('read'); setError(event.detail || 'Your access changed to read only.')
      } else if (event.type === 'access.changed') {
        accessRef.current = event.access; setAccess(event.access)
        if (event.access === 'none') {
          allowReconnectRef.current = false
          await deleteDraft(draftKey).catch(() => {})
          const cachedDocuments = await readDashboard(user?.id).catch(() => null)
          if (Array.isArray(cachedDocuments)) await writeDashboard(user?.id, cachedDocuments.filter((item) => String(item.id) !== String(id))).catch(() => {})
          setError('The owner removed your access.')
          setContent(''); contentRef.current = ''
          navigate('/')
        }
        else if (event.access === 'read') setError('Your access changed to read only.')
      } else if (event.type === 'document.deleted') {
        setError('The owner deleted this document.')
        await deleteDraft(draftKey).catch(() => {})
        navigate('/')
      } else if (event.type === 'auth.error') {
        setError(event.detail)
        if (event.detail?.includes('cannot access the document')) {
          allowReconnectRef.current = false
          await deleteDraft(draftKey).catch(() => {})
          navigate('/')
        }
      }
    }
    socket.onclose = () => {
      if (!navigator.onLine) setStatus('Offline · draft saved on this device')
      if (allowReconnectRef.current) retryRef.current = setTimeout(connect, 2500)
    }
    socket.onerror = () => setStatus('Connection interrupted · draft saved')
  }, [id, applyContent])

  const scheduleSync = useCallback((next) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await storeDraft(next, baselineRef.current, versionRef.current, true)
      const socket = socketRef.current
      if (navigator.onLine && socket?.readyState === WebSocket.OPEN && !inFlightRef.current) {
        setStatus('Saving…')
        inFlightRef.current = { content: next, baseContent: baselineRef.current, baseVersion: versionRef.current }
        socket.send(JSON.stringify({ type: 'content.update', content: next, base_version: versionRef.current }))
      } else setStatus('Offline · draft saved on this device')
    }, 650)
  }, [storeDraft])
  scheduleSyncRef.current = scheduleSync

  useEffect(() => {
    if (!document) return
    allowReconnectRef.current = true
    connect()
    return () => {
      allowReconnectRef.current = false
      clearTimeout(timerRef.current); clearTimeout(retryRef.current)
      socketRef.current?.close()
    }
  }, [document?.id, connect])

  useEffect(() => {
    const onOnline = () => { setStatus('Reconnecting…'); socketRef.current?.close(); connect() }
    const onOffline = () => setStatus('Offline · draft saved on this device')
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [connect])

  async function changeContent(next) {
    if (!canWrite) return
    localEditRef.current = true
    applyContent(next)
    await storeDraft(next, baselineRef.current, versionRef.current, true).catch(() => setStatus('Unable to store this browser draft'))
    scheduleSync(next)
  }
  async function changeTitle(next) {
    titleRef.current = next
    titlePendingRef.current = true
    setTitle(next)
    setDocument((old) => old ? { ...old, title: next } : old)
    await storeDraft(contentRef.current, baselineRef.current, versionRef.current, localEditRef.current)
  }
  async function saveTitle() {
    if (!document || !canWrite || !online) return
    if (!title.trim()) {
      titleRef.current = 'Untitled document'; titlePendingRef.current = true; setTitle(titleRef.current)
      setDocument((old) => old ? { ...old, title: titleRef.current } : old)
    }
    try {
      const updated = await api(`documents/${id}/`, { method: 'PATCH', body: JSON.stringify({ title: titleRef.current }) })
      titlePendingRef.current = false
      documentRef.current = updated
      setDocument(updated); setTitle(updated.title); titleRef.current = updated.title
      await storeDraft(contentRef.current, baselineRef.current, versionRef.current, localEditRef.current)
    } catch (err) { setError(err.message) }
  }
  function sendCursor(target) {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'cursor.update', anchor: target.selectionStart, head: target.selectionEnd }))
  }
  async function openShares() {
    setShareOpen(true)
    try { setShares(await api(`documents/${id}/share/`)) } catch (err) { setError(err.message) }
  }
  async function updateShare(username, level) {
    try {
      const membership = await api(`documents/${id}/share/`, { method: 'POST', body: JSON.stringify({ username, access: level }) })
      setShares((old) => [...old.filter((item) => item.id !== membership.id), membership])
      setShareUser('')
    } catch (err) { setError(err.message) }
  }
  async function duplicate() {
    try { const copy = await api(`documents/${id}/duplicate/`, { method: 'POST' }); navigate(`/docs/${copy.id}`) }
    catch (err) { setError(err.message) }
  }
  async function deleteDocument() {
    if (!window.confirm(`Delete “${title}”? This also removes its shared access.`)) return
    try { await api(`documents/${id}/`, { method: 'DELETE' }); navigate('/') }
    catch (err) { setError(err.message) }
  }
  function exportDocument(kind) {
    const ext = kind === 'json' ? 'json' : kind === 'txt' ? 'txt' : 'md'
    const body = kind === 'json' ? JSON.stringify({ title, content, updatedAt: new Date().toISOString() }, null, 2) : content
    const blob = new Blob([body], { type: kind === 'json' ? 'application/json' : 'text/plain' })
    const anchor = Object.assign(window.document.createElement('a'), { href: URL.createObjectURL(blob), download: `${safeFileName(title)}.${ext}` })
    anchor.click(); URL.revokeObjectURL(anchor.href)
  }
  const cursorPeople = Object.values(cursors).filter((cursor) => cursor.user_id !== user?.id)

  if (!document) return <div className="editor-loading"><LoaderCircle className="spin" /> {error || 'Loading your document…'}<Link to="/">Back to workspace</Link></div>
  return <div className="editor-shell">
    <header className="editor-topbar"><div className="editor-brand"><Link to="/" className="brand"><div className="brand-mark small"><span /></div></Link><span className="crumb-slash">/</span><Link to="/" className="crumb-link">My workspace</Link><span className="crumb-slash">/</span><input className="title-input" value={title} onChange={(e) => changeTitle(e.target.value)} onBlur={saveTitle} disabled={!canWrite} aria-label="Document title" /></div>
      <div className="editor-actions"><div className="save-indicator"><span className={`save-dot ${online ? '' : 'offline'}`} />{status}</div><div className="people-stack">{people.slice(0, 4).map((person) => <span key={person.user_id} title={`${person.username} is here`} style={{ backgroundColor: palette[person.user_id % palette.length] }}>{person.username?.[0]?.toUpperCase()}</span>)}<span className="self-dot" title={`You · ${access}`}>{user?.username?.[0]?.toUpperCase() || 'Y'}</span></div>
        <div className="toolbar-separator" />
        {access === 'owner' && <button className="button share-button" onClick={openShares}><Share2 size={16} /> Share</button>}
        <details className="more-menu-wrap"><summary className="icon-btn bordered"><MoreHorizontal size={19} /></summary><div className="floating-menu right-menu"><button onClick={() => exportDocument('md')}><ArrowDownToLine size={14} />Export Markdown</button><button onClick={() => exportDocument('txt')}><ArrowDownToLine size={14} />Export plain text</button><button onClick={() => exportDocument('json')}><ArrowDownToLine size={14} />Export JSON</button><button onClick={duplicate}><FilePlus2 size={14} />Make a copy</button>{access === 'owner' && <button className="danger-text" onClick={deleteDocument}><Trash2 size={14} />Delete document</button>}<button onClick={onSignOut}><LogOut size={14} />Sign out</button></div></details>
      </div>
    </header>
    <main className="editor-main">
      <div className="editor-canvas"><div className="paper-kicker"><span>WORKING DOCUMENT</span><span>{access === 'owner' ? 'PRIVATE SPACE' : access === 'write' ? 'SHARED · CAN EDIT' : 'SHARED · READ ONLY'}</span></div>
        <div className="document-heading"><div className="document-icon"><FileText size={18} /></div><div><h1>{title || 'Untitled document'}</h1><p>Edited {relativeTime(document.updated_at)} <span>·</span> {people.length + 1} in this space</p></div></div>
        {error && <div className="error-banner editor-error">{error}<button onClick={() => setError('')}><X size={14} /></button></div>}
        {cursorPeople.length > 0 && <div className="cursor-strip">{cursorPeople.map((person) => <span key={person.user_id}><i style={{ background: palette[person.user_id % palette.length] }} />{person.username} <small>Line {lineAt(content, person.head)}, col {columnAt(content, person.head)}</small></span>)}</div>}
        <div className="editor-tools"><span className="text-tool">T</span><span className="toolbar-vertical" /><span>Plain text</span><span className="tool-spacer" />{!canWrite && <span className="read-only-label"><Shield size={13} /> Read only</span>}</div>
        <textarea className="writing-area" spellCheck maxLength={2000000} value={content} readOnly={!canWrite} onChange={(e) => changeContent(e.target.value)} onSelect={(e) => sendCursor(e.target)} onKeyUp={(e) => sendCursor(e.currentTarget)} placeholder={canWrite ? 'Start with a thought…' : 'This document is empty.'} aria-label="Shared document editor" />
        <div className="editor-bottom"><span>{content.trim() ? `${content.trim().split(/\s+/).length} words` : 'No words yet'}</span><span>{content.length} characters</span></div>
      </div>
      <aside className="editor-aside"><div className="aside-section"><div className="aside-heading"><span>IN THIS DOCUMENT</span></div><div className="presence-row"><span className="presence-avatar self">{user?.username?.[0]?.toUpperCase() || 'Y'}</span><div><strong>You</strong><small>{access === 'owner' ? 'Owner · full access' : access === 'write' ? 'Editor · can edit' : 'Viewer · can read'}</small></div><span className="live-pip" /></div>{people.filter((person) => person.user_id !== user?.id).map((person) => { const cursor = cursors[person.user_id]; return <div className="presence-row" key={person.user_id}><span className="presence-avatar" style={{ backgroundColor: palette[person.user_id % palette.length] }}>{person.username?.[0]?.toUpperCase()}</span><div><strong>{person.username}</strong><small>{cursor ? `Line ${lineAt(content, cursor.head)} · column ${columnAt(content, cursor.head)}` : 'In this document'}</small></div><span className="live-pip" /></div>})}</div>
        <div className="aside-divider" /><div className="aside-section"><div className="aside-heading"><span>DOCUMENT DETAILS</span></div><div className="detail-row"><span>Last saved</span><strong>{status.startsWith('Offline') ? 'On this device' : status === 'Saved' ? 'Just now' : status}</strong></div><div className="detail-row"><span>Access</span><strong>{access === 'owner' ? 'Only you' : access === 'write' ? 'Can edit' : 'Can view'}</strong></div><div className="detail-row"><span>Word count</span><strong>{content.trim() ? content.trim().split(/\s+/).length : 0}</strong></div></div>
        <div className="offline-card"><div className="offline-card-icon">{online ? <Cloud size={16} /> : <CloudOff size={16} />}</div><strong>{online ? 'Local safety net is on' : 'Your edits are safe here'}</strong><p>Drafts are stored in this browser and sync when you reconnect.</p></div>
        <button className="signout-link" onClick={onSignOut}><LogOut size={14} /> Sign out</button>
      </aside>
    </main>
    {shareOpen && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShareOpen(false) }}><section className="share-modal"><div className="modal-head"><div><div className="eyebrow">OPEN THE DOOR</div><h2>Share this document</h2></div><button className="icon-btn" onClick={() => setShareOpen(false)}><X size={18} /></button></div><p className="muted">Invite a Relay account with the access they need.</p><div className="invite-row"><input value={shareUser} onChange={(e) => setShareUser(e.target.value)} placeholder="Enter a username" onKeyDown={(e) => { if (e.key === 'Enter' && shareUser.trim()) updateShare(shareUser.trim(), shareAccess) }} /><select value={shareAccess} onChange={(e) => setShareAccess(e.target.value)}><option value="write">Can edit</option><option value="read">Can view</option><option value="none">No access</option></select><button className="button primary" disabled={!shareUser.trim()} onClick={() => updateShare(shareUser.trim(), shareAccess)}>Add</button></div><div className="member-heading">PEOPLE WITH ACCESS <span>{shares.filter((share) => share.access !== 'none').length + 1}</span></div><div className="share-member"><span className="presence-avatar self">{user?.username?.[0]?.toUpperCase() || 'Y'}</span><div><strong>{user?.username || 'You'}</strong><small>Owner</small></div><span className="member-access">Full access</span></div>{shares.map((share) => <div className="share-member" key={share.id}><span className="presence-avatar" style={{ backgroundColor: palette[share.id % palette.length] }}>{share.username?.[0]?.toUpperCase()}</span><div><strong>{share.username}</strong><small>{share.email || 'Relay member'}</small></div><select aria-label={`Access for ${share.username}`} value={share.access} onChange={(e) => updateShare(share.username, e.target.value)}><option value="write">Can edit</option><option value="read">Can view</option><option value="none">No access</option></select></div>)}<div className="share-note"><Shield size={14} /> Access can be changed or removed by the owner at any time.</div></section></div>}
  </div>
}

function relativeTime(value) {
  if (!value) return 'just now'
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function safeFileName(title) { return (title || 'document').trim().replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'document' }
function lineAt(text, position) { return (text.slice(0, position).match(/\n/g) || []).length + 1 }
function columnAt(text, position) { return position - text.lastIndexOf('\n', Math.max(0, position - 1)) }


if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
