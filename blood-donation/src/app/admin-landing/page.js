"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Home, Check, X, LogOut, Bell } from 'lucide-react';
import { signOut, initFirebase } from '@/utils/auth';

export default function AdminLanding() {
  const router = useRouter();
  const mounted = useRef(true);

  // local fallback sample data (only used when Firestore isn't configured)
  const SAMPLE_HOSPITALS = [
    { id: 'h1', name: 'City Hospital', address: '123 Main St', verified: 'pending', createdAt: Date.now() - 1000 * 60 * 60 },
    { id: 'h2', name: 'Northside Clinic', address: '45 North Ave', verified: 'pending', createdAt: Date.now() - 1000 * 60 * 60 * 2 },
  ];

  const SAMPLE_DONORS = [
    { id: 'd1', name: 'Alex Donor', bloodType: 'O+', eligible: 'pending', createdAt: Date.now() - 1000 * 60 * 30 },
  ];

  const [hospitals, setHospitals] = useState([]);
  const [donors, setDonors] = useState([]);
  const [users, setUsers] = useState([]);

  // admin read-state (stored in Firestore under 'admin_meta/notifications')
  const [adminLastRead, setAdminLastRead] = useState(0);

  // derived pending notifications (from Firestore only). When Firebase is not configured notifications will be empty
  const [pendingHospNotifs, setPendingHospNotifs] = useState([]);
  const [pendingDonNotifs, setPendingDonNotifs] = useState([]);
  const notifications = [...pendingHospNotifs, ...pendingDonNotifs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const [showNotifications, setShowNotifications] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const [userSearch, setUserSearch] = useState('');
  const [hospitalSearch, setHospitalSearch] = useState('');

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  function handleLogout() {
    try { signOut(); } catch (e) {}
    router.push('/signin');
  }

  // Helper to normalize Firestore timestamps and other formats into millis
  function toMillis(v) {
    if (!v) return 0;
    try {
      if (typeof v === 'number') return v;
      if (v.toMillis) return v.toMillis();
      if (v.seconds) return v.seconds * 1000;
      const parsed = Date.parse(v);
      return isNaN(parsed) ? 0 : parsed;
    } catch (e) {
      return 0;
    }
  }

  // realtime subscriptions: hospitals, donors, admin_meta notifications, users
  useEffect(() => {
    let unsubHosp = null;
    let unsubDon = null;
    let unsubMeta = null;
    let unsubUsers = null;

    (async () => {
      try {
        const fb = await initFirebase();
        if (fb && fb.db) {
          const { collection, onSnapshot, doc } = await import('firebase/firestore');

          // hospitals subscription: keep local copy and derive pending notifications
          unsubHosp = onSnapshot(collection(fb.db, 'hospitals'), (snap) => {
            const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (!mounted.current) return;
            setHospitals(arr);
            const pending = arr
              .filter(x => x.verified === 'pending')
              .map(x => ({ id: `h_${x.id}`, type: 'hospital', refId: x.id, text: `Hospital registration: ${x.name || x.id}`, createdAt: toMillis(x.createdAt) }));
            // only keep those newer than adminLastRead
            setPendingHospNotifs(pending.filter(p => (p.createdAt || 0) > (adminLastRead || 0)));
          }, (err) => console.error('hospitals onSnapshot error', err));

          // donors subscription
          unsubDon = onSnapshot(collection(fb.db, 'donors'), (snap) => {
            const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (!mounted.current) return;
            setDonors(arr);
            const pending = arr
              .filter(x => x.eligible === 'pending')
              .map(x => ({ id: `d_${x.id}`, type: 'donor', refId: x.id, text: `New donor registered: ${x.name || x.id}`, createdAt: toMillis(x.createdAt) }));
            setPendingDonNotifs(pending.filter(p => (p.createdAt || 0) > (adminLastRead || 0)));
          }, (err) => console.error('donors onSnapshot error', err));

          // admin meta read-timestamp
          const metaRef = doc(fb.db, 'admin_meta', 'notifications');
          unsubMeta = onSnapshot(metaRef, (snap) => {
            const data = snap.exists() ? snap.data() : null;
            const ts = data?.lastRead ? toMillis(data.lastRead) : 0;
            setAdminLastRead(ts);
          }, (err) => console.error('admin_meta onSnapshot error', err));

          // users snapshot (optional live list)
          unsubUsers = onSnapshot(collection(fb.db, 'users'), (snap) => {
            const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (!mounted.current) return;
            setUsers(arr);
          }, (err) => console.error('users onSnapshot error', err));
        } else {
          // no firebase: load sample fallback so the UI sections still render
          setHospitals(SAMPLE_HOSPITALS);
          setDonors(SAMPLE_DONORS);
          setUsers([]);
          setPendingHospNotifs([]);
          setPendingDonNotifs([]);
        }
      } catch (e) {
        console.debug('Firebase subscriptions failed', e);
      }
    })();

    return () => {
      if (typeof unsubHosp === 'function') unsubHosp();
      if (typeof unsubDon === 'function') unsubDon();
      if (typeof unsubMeta === 'function') unsubMeta();
      if (typeof unsubUsers === 'function') unsubUsers();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refresh: run a one-off fetch for each collection (useful if you prefer non-subscribed refresh)
  async function refreshData() {
    setActionLoading('refresh');
    try {
      const fb = await initFirebase();
      if (fb && fb.db) {
        const { collection, getDocs } = await import('firebase/firestore');
        try {
          const hospSnap = await getDocs(collection(fb.db, 'hospitals'));
          setHospitals(hospSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.debug('Failed to fetch hospitals', e); }

        try {
          const donorsSnap = await getDocs(collection(fb.db, 'donors'));
          setDonors(donorsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.debug('Failed to fetch donors', e); }

        try {
          const usersSnap = await getDocs(collection(fb.db, 'users'));
          setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.debug('Failed to fetch users', e); }
      } else {
        setHospitals(SAMPLE_HOSPITALS);
        setDonors(SAMPLE_DONORS);
      }
    } catch (e) {
      console.error('refreshData failed', e);
    } finally {
      if (mounted.current) setActionLoading(null);
    }
  }

  // clear notifications: set admin_meta/notifications.lastRead to now so derived notifications hide
  async function clearNotifications() {
    setActionLoading('clear_notifications');
    try {
      const fb = await initFirebase();
      if (fb && fb.db) {
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
        const metaRef = doc(fb.db, 'admin_meta', 'notifications');
        await setDoc(metaRef, { lastRead: serverTimestamp() }, { merge: true });
      } else {
        // no-op when Firebase not configured
        setPendingHospNotifs([]);
        setPendingDonNotifs([]);
      }
      setShowNotifications(false);
    } catch (e) {
      console.error('clearNotifications failed', e);
    } finally {
      if (mounted.current) setActionLoading(null);
    }
  }

  async function acceptHospital(id) {
    setActionLoading(id);
    try {
      const fb = await initFirebase();
      if (fb && fb.db) {
        const { doc, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(fb.db, 'hospitals', id), { verified: 'accepted' });
      } else {
        setHospitals(s => s.map(h => h.id === id ? { ...h, verified: 'accepted' } : h));
      }
    } catch (e) {
      console.error('acceptHospital failed', e);
    } finally { if (mounted.current) setActionLoading(null); }
  }

  async function denyHospital(id) {
    setActionLoading(id);
    try {
      const fb = await initFirebase();
      if (fb && fb.db) {
        const { doc, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(fb.db, 'hospitals', id), { verified: 'denied' });
      } else {
        setHospitals(s => s.map(h => h.id === id ? { ...h, verified: 'denied' } : h));
      }
    } catch (e) {
      console.error('denyHospital failed', e);
    } finally { if (mounted.current) setActionLoading(null); }
  }

  async function acceptDonor(id) {
    setActionLoading(id);
    try {
      const fb = await initFirebase();
      if (fb && fb.db) {
        const { doc, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(fb.db, 'donors', id), { eligible: 'accepted' });
      } else {
        setDonors(s => s.map(d => d.id === id ? { ...d, eligible: 'accepted' } : d));
      }
    } catch (e) {
      console.error('acceptDonor failed', e);
    } finally { if (mounted.current) setActionLoading(null); }
  }

  async function denyDonor(id) {
    setActionLoading(id);
    try {
      const fb = await initFirebase();
      if (fb && fb.db) {
        const { doc, updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(fb.db, 'donors', id), { eligible: 'denied' });
      } else {
        setDonors(s => s.map(d => d.id === id ? { ...d, eligible: 'denied' } : d));
      }
    } catch (e) {
      console.error('denyDonor failed', e);
    } finally { if (mounted.current) setActionLoading(null); }
  }

  // delete user from 'users' collection (or local state when Firebase absent)
  async function deleteUser(id) {
    setActionLoading(id);
    try {
      const fb = await initFirebase();
      if (fb && fb.db) {
        const { doc, deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(fb.db, 'users', id));
      } else {
        setUsers(s => s.filter(u => u.id !== id));
      }
    } catch (e) {
      console.error('deleteUser failed', e);
    } finally { if (mounted.current) setActionLoading(null); }
  }

  const pendingHospitals = hospitals.filter(h => h.verified === 'pending');
  const pendingDonors = donors.filter(d => d.eligible === 'pending');
  const existingHospitals = hospitals.filter(h => h.verified === 'accepted');

  const filteredHospitals = existingHospitals.filter(h => {
    if (!hospitalSearch) return true;
    const q = hospitalSearch.toLowerCase();
    return (h.name || '').toLowerCase().includes(q) || (h.address || '').toLowerCase().includes(q);
  });

  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-linear-to-br from-red-50 via-white to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-600/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
              <p className="text-sm text-gray-500">Review hospitals and donors</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button aria-haspopup="true" aria-expanded={showNotifications} onClick={() => setShowNotifications(s => !s)} className="relative p-2 rounded-lg bg-white border border-gray-200 shadow-sm" title="Notifications">
                <Bell className="w-5 h-5 text-gray-600" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">{notifications.length}</span>
                )}
              </button>

              {showNotifications && (
                <div role="menu" aria-label="Notifications" className="absolute right-0 mt-2 w-96 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-3 border-b text-sm font-semibold flex items-center justify-between">
                    <span>Notifications</span>
                    <button onClick={clearNotifications} disabled={actionLoading==='clear_notifications'} className="text-xs text-red-600">{actionLoading==='clear_notifications' ? 'Clearing...' : 'Mark read'}</button>
                  </div>
                  <div className="p-2">
                    {notifications.length === 0 && <div className="text-sm text-gray-500 p-2">No new pending hospitals or donors.</div>}
                    {notifications.map((n) => (
                      <div key={n.id} className="w-full text-left p-2 hover:bg-gray-50 rounded">
                        <div className="text-xs text-gray-500">{n.type === 'hospital' ? 'Hospital' : 'Donor'}</div>
                        <div className="text-sm text-gray-900">{n.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm">
              <LogOut className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">Logout</span>
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Users (searchable, scrollable) */}
          <section className="bg-white rounded-3xl p-4 shadow-sm lg:col-span-1">
            <h4 className="font-semibold mb-3 text-red-600">Users</h4>
            <div className="mb-3">
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by name, email or role"
                className="w-full px-3 py-2 border rounded-lg text-red-600 focus:ring-2 focus:ring-red-600"
              />
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => (
                  <div key={u.id || u.email} className="p-3 bg-white rounded-lg border border-gray-100 flex flex-col gap-2">
                    <div className="font-medium text-red-600">{u.name || u.email || 'Unknown'}</div>
                    <div className="text-xs text-gray-700">{u.email}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-gray-600">{u.role || 'donor'}</span>
                      <div className="ml-auto">
                        <button
                          onClick={() => { if (confirm('Delete user? This cannot be undone.')) deleteUser(u.id); }}
                          disabled={actionLoading===u.id}
                          className="px-2 py-1 rounded bg-white border border-gray-200 text-sm text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">No users found.</div>
              )}
            </div>
          </section>

          {/* Center: Stats and Pending Hospitals */}
          <section className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-red-600">Overview</h3>
                <p className="text-sm text-gray-500">Quick insights and actions</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-red-50 border"> <div className="text-xs text-gray-500">Existing Hospitals</div> <div className="text-2xl font-bold text-red-600">{existingHospitals.length}</div> </div>
              <div className="p-4 rounded-xl bg-red-50 border"> <div className="text-xs text-gray-500">Hospitals pending</div> <div className="text-2xl font-bold text-red-600">{pendingHospitals.length}</div> </div>
              <div className="p-4 rounded-xl bg-red-50 border"> <div className="text-xs text-gray-500">Total notifications</div> <div className="text-2xl font-bold text-red-600">{notifications.length}</div> </div>
            </div>

            <div className="mt-6">
              <h4 className="text-lg font-semibold text-red-600">Pending Hospitals</h4>
              <div className="mt-3 grid gap-3">
                {pendingHospitals.map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-50 rounded-lg shadow-sm">
                    <div>
                      <div className="font-medium text-red-600">{h.name}</div>
                      <div className="text-xs text-gray-500">{h.address}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => acceptHospital(h.id)} disabled={actionLoading===h.id} className="px-3 py-2 rounded bg-green-600 text-white flex items-center gap-2"><Check className="w-4 h-4" /> Accept</button>
                      <button onClick={() => denyHospital(h.id)} disabled={actionLoading===h.id} className="px-3 py-2 rounded bg-white border border-gray-200 text-gray-700 flex items-center gap-2"><X className="w-4 h-4" /> Deny</button>
                    </div>
                  </div>
                ))}
                {pendingHospitals.length === 0 && <div className="text-sm text-gray-500">No hospitals pending review.</div>}
              </div>
            </div>

            {/* Pending donors removed from center view per request */}
          </section>

          {/* Right: Quick actions / admin info */}
          <aside className="bg-white/60 rounded-3xl p-4 shadow-lg flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-red-600/10 flex items-center justify-center">
                <Home className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Admin</div>
                <div className="text-sm text-gray-500">Site moderator</div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button disabled={Boolean(actionLoading)} onClick={refreshData} className="w-full px-4 py-2 rounded-lg bg-red-600 text-white font-semibold">{actionLoading==='refresh' ? 'Refreshing...' : 'Refresh'}</button>
              <button disabled={Boolean(actionLoading)} onClick={clearNotifications} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-500 text-red-600">Mark notifications read</button>
            </div>

            <div className="mt-auto text-sm text-red-600">
              <div className="font-medium text-gray-700 mb-1">Last notification</div>
              <div className="p-3 bg-white rounded-lg border border-gray-100">{notifications[0]?.text ?? 'No recent actions'}</div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
