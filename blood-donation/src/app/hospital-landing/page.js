"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Home, Check, X, LogOut, Bell, MapPin, Calendar, Heart } from "lucide-react";
import { signOut, getCurrentUser, initFirebase } from '@/utils/auth';

export default function HospitalLanding() {
  const router = useRouter();

  const [requests, setRequests] = useState([
    { id: 'r1', donor: 'Alex Donor', bloodType: 'O+', quantity: 2, status: 'pending', location: 'Near Main St' },
    { id: 'r2', donor: 'Maria Hope', bloodType: 'A-', quantity: 1, status: 'pending', location: 'East Clinic' },
  ]);

  const [drives, setDrives] = useState([
    { id: 'd1', name: 'Community Drive', date: '2025-12-05', slots: 12 },
  ]);

  const [notifications, setNotifications] = useState([
    { id: 1, text: 'New donation request from Alex Donor' },
  ]);

  const [acceptedSearch, setAcceptedSearch] = useState('');

  const [actionLoading, setActionLoading] = useState(null);
  const [coords, setCoords] = useState(null);
  const [authStatus, setAuthStatus] = useState('checking'); // 'checking' | 'allowed' | 'pending' | 'denied'

  function handleLogout() {
    try { signOut(); } catch (e) {}
    router.push('/signin');
  }

  // Check hospital verification status before rendering dashboard
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = getCurrentUser();
        if (!user) {
          if (mounted) {
            setAuthStatus('denied');
            router.push('/signin');
          }
          return;
        }

        // Prefer Firebase stored hospitals
        try {
          const fb = await initFirebase();
          if (fb && fb.db) {
            const { doc, getDoc } = await import('firebase/firestore');
            const uid = user?.uid || user?.id || null;
            const emailKey = (user?.email || '').replace(/[@.]/g, '_');
            const id = uid || emailKey;
            const snap = await getDoc(doc(fb.db, 'hospitals', id));
            if (snap.exists()) {
              const data = snap.data();
              const v = data?.verified || 'pending';
              if (!mounted) return;
              if (v === 'accepted') setAuthStatus('allowed');
              else if (v === 'denied') setAuthStatus('denied');
              else setAuthStatus('pending');
              return;
            }
            // if no hospital doc, treat as pending
            if (mounted) setAuthStatus('pending');
            return;
          }
        } catch (e) {
          // fallback to local behavior if Firestore not available
          console.debug('Firestore check failed, allowing access as fallback', e);
          if (mounted) setAuthStatus('allowed');
          return;
        }
      } catch (e) {
        console.error('auth check failed', e);
        if (mounted) setAuthStatus('denied');
      }
    })();

    return () => { mounted = false; };
  }, [router]);

  async function acceptRequest(id) {
    setActionLoading(id);
    await new Promise(r => setTimeout(r, 500));
    setRequests(r => r.map(x => x.id === id ? { ...x, status: 'accepted' } : x));
    setNotifications(n => [{ id: Date.now(), text: `Request ${id} accepted` }, ...n]);
    setActionLoading(null);
  }

  async function denyRequest(id) {
    setActionLoading(id);
    await new Promise(r => setTimeout(r, 500));
    setRequests(r => r.map(x => x.id === id ? { ...x, status: 'denied' } : x));
    setNotifications(n => [{ id: Date.now(), text: `Request ${id} denied` }, ...n]);
    setActionLoading(null);
  }

  async function markFulfilled(id) {
    setActionLoading(id);
    await new Promise(r => setTimeout(r, 400));
    setRequests(r => r.map(x => x.id === id ? { ...x, status: 'fulfilled' } : x));
    setNotifications(n => [{ id: Date.now(), text: `Request ${id} fulfilled` }, ...n]);
    setActionLoading(null);
  }

  function requestPickup() {
    setNotifications(n => [{ id: Date.now(), text: 'Pickup requested from nearby donors' }, ...n]);
  }

  function shareNeeds() {
    setNotifications(n => [{ id: Date.now(), text: 'Shared urgent needs to donors' }, ...n]);
  }

  function enableGeolocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => {
      setCoords({ lat: p.coords.latitude, lon: p.coords.longitude });
    }, (err) => {
      setNotifications(n => [{ id: Date.now(), text: `Geolocation error: ${err.message}` }, ...n]);
    });
  }

  // Handlers added per recent edits (lines ~175-176)
  function requestBlood() {
    // Simulate requesting blood — add a notification and acknowledgement
    setNotifications(n => [{ id: Date.now(), text: 'Blood request submitted (simulated)' }, ...n]);
  }

  function acceptedRequests() {
    // Simulate viewing accepted requests — add a notification
    setNotifications(n => [{ id: Date.now(), text: 'Showing accepted requests (simulated)' }, ...n]);
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');

  return (
    <div className="min-h-screen bg-linear-to-br from-white via-red-50 to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Conditionally render based on hospital authStatus */}
        {authStatus === 'checking' && (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center text-gray-600">Checking account status...</div>
          </div>
        )}

        {authStatus === 'pending' && (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
              <h2 className="text-xl font-bold mb-2">Pending approval</h2>
              <p className="text-sm text-gray-600 mb-4">Your hospital registration is pending admin approval. You will be able to sign in once approved.</p>
              <button onClick={handleLogout} className="px-4 py-2 rounded bg-red-600 text-white">Sign out</button>
            </div>
          </div>
        )}

        {authStatus === 'denied' && (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
              <h2 className="text-xl font-bold mb-2">Permission denied</h2>
              <p className="text-sm text-gray-600 mb-4">Your hospital registration was denied by an administrator. If you believe this is an error, please contact support.</p>
              <button onClick={handleLogout} className="px-4 py-2 rounded bg-red-600 text-white">Sign out</button>
            </div>
          </div>
        )}

        {authStatus === 'allowed' && (
          <>
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-600/10 flex items-center justify-center">
              <Home className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Hospital Dashboard</h2>
              <p className="text-sm text-gray-500">Manage donation requests and drives</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg bg-white border border-gray-200 shadow-sm" title="Notifications">
              <Bell className="w-5 h-5 text-gray-600" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">{notifications.length}</span>
              )}
            </button>

            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm">
              <LogOut className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">Logout</span>
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <section className="bg-white rounded-3xl p-4 shadow-sm lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-red-600">Accepted Requests</h4>
              <div className="text-sm text-gray-500">Search</div>
            </div>
            <div className="mb-3">
              <input
                value={acceptedSearch}
                onChange={(e) => setAcceptedSearch(e.target.value)}
                placeholder="Search accepted requests..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
            </div>
            <div className="space-y-3">
              {requests.filter(r => r.status === 'accepted' || r.status === 'fulfilled').filter(r => {
                if (!acceptedSearch) return true;
                const q = acceptedSearch.toLowerCase();
                return (r.donor || '').toLowerCase().includes(q) || (r.bloodType || '').toLowerCase().includes(q) || (r.id||'').toLowerCase().includes(q);
              }).map((r) => (
                <div key={r.id} className="p-3 bg-white rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{r.donor}</div>
                      <div className="text-xs text-gray-500">Blood: {r.bloodType} • Qty: {r.quantity}</div>
                      <div className="text-xs text-gray-500">{r.location}</div>
                    </div>
                    <div className="text-sm text-green-600 font-semibold">{r.status}</div>
                  </div>
                </div>
              ))}
              {requests.filter(r => r.status === 'accepted' || r.status === 'fulfilled').length === 0 && (
                <div className="text-sm text-gray-500">No accepted requests.</div>
              )}
            </div>
          </section>

          <section className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-red-600">Overview</h3>
                <p className="text-sm text-gray-500">Requests and quick actions</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-red-50 border"> <div className="text-xs text-gray-700">Pending Requests</div> <div className="text-2xl font-bold text-red-600">{pendingRequests.length}</div> </div>
              <div className="p-4 rounded-xl bg-red-50 border"> <div className="text-xs text-gray-700">Accepted Requests</div> <div className="text-2xl font-bold text-red-600">{requests.filter(r=>r.status==='accepted' || r.status==='fulfilled').length}</div> </div>
              <div className="p-4 rounded-xl bg-red-50 border"> <div className="text-xs text-gray-700">Notifications</div> <div className="text-2xl font-bold text-red-600">{notifications.length}</div> </div>
            </div>

            <div className="mt-6">
              <h4 className="text-lg font-semibold text-red-600">Incoming Requests</h4>
              <div className="mt-3 grid gap-3">
                {pendingRequests.map((r) => (
                  <div key={r.id} className="p-3 bg-red-50 rounded-lg border border-red-50 text-red-600">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.donor}</div>
                        <div className="text-xs text-gray-500">Blood: {r.bloodType} • Qty: {r.quantity}</div>
                        <div className="text-xs text-gray-500">{r.location}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => acceptRequest(r.id)} disabled={actionLoading===r.id} className="px-3 py-2 rounded bg-green-600 text-white flex items-center gap-2"><Check className="w-4 h-4" />Accept</button>
                        <button onClick={() => denyRequest(r.id)} disabled={actionLoading===r.id} className="px-3 py-2 rounded bg-white border border-gray-200 text-gray-700 flex items-center gap-2"><X className="w-4 h-4" />Deny</button>
                      </div>
                    </div>
                  </div>
                ))}
                {pendingRequests.length === 0 && <div className="text-sm text-gray-500">No pending requests.</div>}
              </div>
            </div>
          </section>

          <aside className="bg-white/60 rounded-3xl p-4 shadow-lg flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-red-600/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">Hospital</div>
                <div className="text-sm text-gray-500">Manage donors & requests</div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button onClick={requestBlood} className="w-full px-4 py-2 rounded-lg bg-red-600 text-white font-semibold">Request Blood</button>
              <button onClick={acceptedRequests} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-500 text-red-600">Accepted Requests</button>
            </div>

            <div className="mt-2">
              <h5 className="text-sm font-medium text-red-600">Map preview</h5>
              {coords ? (
                <div className="mt-2 rounded-lg overflow-hidden border">
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lon-0.01}%2C${coords.lat-0.01}%2C${coords.lon+0.01}%2C${coords.lat+0.01}&layer=mapnik&marker=${coords.lat}%2C${coords.lon}`}
                    className="w-full h-40"
                    title="map"
                  />
                </div>
              ) : (
                <div className="text-sm text-gray-500 mt-2">Geolocation not enabled.</div>
              )}
            </div>

            <div className="mt-auto text-sm text-gray-500">
              <div className="font-medium text-gray-700 mb-1">Last notification</div>
              <div className="p-3 bg-white rounded-lg border border-gray-100">{notifications[0]?.text ?? 'No notifications'}</div>
            </div>
          </aside>
        </main>
          </>
        )}
      </div>
    </div>
  );
}
