// Unified auth utilities for the client (Firebase if configured, otherwise local fallback)
export const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@lifeblood.org';
export const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'adminpass';

const USERS_KEY = 'app_users_v1';
const AUTH_KEY = 'auth_v1';

function readUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function writeUsers(users) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (e) {}
}

export async function initFirebase() {
  if (typeof window === 'undefined') return { app: null, auth: null, db: null };
  if (window.__initFirebaseCached) return window.__initFirebaseCached;

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!firebaseConfig.apiKey) {
    const empty = { app: null, auth: null, db: null, signIn: null, signUp: null, signOut: null };
    window.__initFirebaseCached = empty;
    return empty;
  }

  const [{ initializeApp }, { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut: fbSignOut }, { getFirestore, doc, setDoc, getDoc }] =
    await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  async function signIn(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const u = cred.user;
    try {
      const snap = await getDoc(doc(db, 'users', u.uid));
      if (snap && snap.exists()) {
        const data = snap.data();
        return { uid: u.uid, email: u.email, role: data.role || 'donor', ...(data || {}) };
      }
    } catch (e) {
      // ignore and return basic user
    }
    return { uid: u.uid, email: u.email };
  }

  async function signUp({ email, password, role = 'donor', profile = {} }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const u = cred.user;
    try {
      await setDoc(doc(db, 'users', u.uid), { email, role, ...profile, createdAt: new Date().toISOString() });
    } catch (e) {
      console.error('Failed to write user profile', e);
    }
    return u;
  }

  async function signOut() {
    return fbSignOut(auth);
  }

  const result = { app, auth, db, signIn, signUp, signOut };
  window.__initFirebaseCached = result;
  return result;
}

// Local fallback auth (for demo / no-Firebase environments)
export async function signUpLocal({ email, password, role = 'donor', name, phone, bloodType, hospitalName, hospitalAddress }) {
  if (!email || !password) throw new Error('Email and password required');
  if (password.length < 8) throw new Error('Password must be at least 8 characters');
  if (email === ADMIN_EMAIL) throw new Error('This email is reserved for the admin account');

  const users = readUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with that email already exists');
  }

  const user = {
    id: `u_${Date.now()}`,
    email,
    password,
    role,
    name: name || '',
    phone: phone || '',
    bloodType: bloodType || '',
    hospitalName: hospitalName || '',
    hospitalAddress: hospitalAddress || '',
    createdAt: new Date().toISOString(),
  };

  users.unshift(user);
  writeUsers(users);

  try { localStorage.setItem(AUTH_KEY, JSON.stringify({ email: user.email, role: user.role, id: user.id })); } catch (e) {}

  return user;
}

export async function signInLocal(email, password) {
  if (!email || !password) throw new Error('Email and password required');

  if (email === ADMIN_EMAIL) {
    if (password === ADMIN_PASSWORD) {
      const admin = { id: 'admin', email: ADMIN_EMAIL, role: 'admin' };
      try { localStorage.setItem(AUTH_KEY, JSON.stringify(admin)); } catch (e) {}
      return admin;
    }
    throw new Error('Invalid admin credentials');
  }

  const users = readUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error('No account found for that email');
  if (user.password !== password) throw new Error('Incorrect password');

  try { localStorage.setItem(AUTH_KEY, JSON.stringify({ email: user.email, role: user.role, id: user.id })); } catch (e) {}
  return user;
}

export function signOutLocal() {
  try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
}

export function getCurrentUserLocal() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// Public helpers that choose Firebase if configured, otherwise fallback
export async function signUp(payload) {
  const hasFb = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  if (hasFb) {
    try {
      const fb = await initFirebase();
      if (fb && fb.signUp) return await fb.signUp(payload);
    } catch (e) {
      console.debug('Firebase signUp failed, falling back to local:', e);
    }
  }
  return signUpLocal(payload);
}

export async function signIn(email, password) {
  const hasFb = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  if (hasFb) {
    try {
      const fb = await initFirebase();
      if (fb && fb.signIn) return await fb.signIn(email, password);
    } catch (e) {
      console.debug('Firebase signIn failed, falling back to local:', e);
    }
  }
  return signInLocal(email, password);
}

export async function signOut() {
  const hasFb = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  if (hasFb) {
    try {
      const fb = await initFirebase();
      if (fb && fb.signOut) return await fb.signOut();
    } catch (e) {
      console.debug('Firebase signOut failed, falling back to local:', e);
    }
  }
  return signOutLocal();
}

export function getCurrentUser() {
  const hasFb = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  if (hasFb && typeof window !== 'undefined') {
    try {
      const w = window;
      if (w.__initFirebaseCached && w.__initFirebaseCached.auth) {
        return w.__initFirebaseCached.auth.currentUser || null;
      }
    } catch (e) {}
  }
  return getCurrentUserLocal();
}
