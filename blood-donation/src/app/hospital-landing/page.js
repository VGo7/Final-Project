"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Home, Check, X, LogOut, Bell, MapPin, Calendar, Heart } from "lucide-react";
import { signOut, getCurrentUser, initFirebase } from '@/utils/auth';

export default function HospitalLanding() {
  const router = useRouter();

  const [requests, setRequests] = useState([]);
  const [hospitalName, setHospitalName] = useState('Hospital');

  const [drives, setDrives] = useState([
    { id: 'd1', name: 'Community Drive', date: '2025-12-05', slots: 12 },
  ]);

  const [notifications, setNotifications] = useState([
    { id: 1, text: 'New donation request from Alex Donor' },
  ]);

  const [acceptedSearch, setAcceptedSearch] = useState('');

  const [actionLoading, setActionLoading] = useState(null);
  const [coords, setCoords] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqBloodType, setReqBloodType] = useState('O+');
  const [reqQuantity, setReqQuantity] = useState(1);
  const [reqLocation, setReqLocation] = useState('');
  const [reqMessage, setReqMessage] = useState('');
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
              // store hospital name for UI
              try { setHospitalName(data?.name || data?.hospitalName || 'Hospital'); } catch (e) {}
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
    try {
      const fb = await initFirebase();
      if (fb && fb.db) {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        await updateDoc(doc(fb.db, 'donor_offers', id), { status: 'accepted', acceptedAt: serverTimestamp(), hospitalAccepted: true });
        setNotifications(n => [{ id: Date.now(), text: `Request ${id} accepted` }, ...n]);
      } else {
        // fallback local update
        setRequests(r => r.map(x => x.id === id ? { ...x, status: 'accepted' } : x));
        setNotifications(n => [{ id: Date.now(), text: `Request ${id} accepted (local)` }, ...n]);
      }
    } catch (e) {
      console.error('acceptRequest failed', e);
    } finally {
      setActionLoading(null);
    }
  }

  async function denyRequest(id) {
    setActionLoading(id);
    try {
      const fb = await initFirebase();
      if (fb && fb.db) {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        await updateDoc(doc(fb.db, 'donor_offers', id), { status: 'denied', deniedAt: serverTimestamp(), hospitalDenied: true });
        setNotifications(n => [{ id: Date.now(), text: `Request ${id} denied` }, ...n]);
      } else {
        setRequests(r => r.map(x => x.id === id ? { ...x, status: 'denied' } : x));
        setNotifications(n => [{ id: Date.now(), text: `Request ${id} denied (local)` }, ...n]);
      }
    } catch (e) {
      console.error('denyRequest failed', e);
    } finally {
      setActionLoading(null);
    }
  }

  async function markFulfilled(id) {
    setActionLoading(id);
    try {
      const fb = await initFirebase();
      if (fb && fb.db) {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        await updateDoc(doc(fb.db, 'donor_offers', id), { status: 'fulfilled', fulfilledAt: serverTimestamp(), hospitalFulfilled: true });
        setNotifications(n => [{ id: Date.now(), text: `Request ${id} fulfilled` }, ...n]);
      } else {
        setRequests(r => r.map(x => x.id === id ? { ...x, status: 'fulfilled' } : x));
        setNotifications(n => [{ id: Date.now(), text: `Request ${id} fulfilled (local)` }, ...n]);
      }
    } catch (e) {
      console.error('markFulfilled failed', e);
    } finally {
      setActionLoading(null);
    }
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
    // Open the request modal so the hospital can specify details
    // If coords are already available, pre-fill the location field
    if (coords) {
      setReqLocation(`Lat ${coords.lat.toFixed(5)}, Lon ${coords.lon.toFixed(5)}`);
    }
    setShowRequestModal(true);
  }

  function acceptedRequests() {
    // Simulate viewing accepted requests — add a notification
    setNotifications(n => [{ id: Date.now(), text: 'Showing accepted requests (simulated)' }, ...n]);
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');

  // Build a safe OpenStreetMap embed URL when coords are available
  let mapSrc = '';
  if (coords) {
    const left = coords.lon - 0.01;
    const bottom = coords.lat - 0.01;
    const right = coords.lon + 0.01;
    const top = coords.lat + 0.01;
    const bbox = encodeURIComponent(`${left},${bottom},${right},${top}`);
    const marker = encodeURIComponent(`${coords.lat},${coords.lon}`);
    mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
  }

  // When the modal is opened and coords become available, autofill location
  useEffect(() => {
    if (showRequestModal && coords) {
      setReqLocation(`Lat ${coords.lat.toFixed(5)}, Lon ${coords.lon.toFixed(5)}`);
    }
  }, [showRequestModal, coords]);

  // Subscribe to Firestore for incoming requests for this hospital
  useEffect(() => {
    let unsub = null;
    let mounted = true;
    (async () => {
      try {
        const user = getCurrentUser();
        const uid = user?.uid || user?.id || null;
        const emailKey = (user?.email || '').replace(/[@.]/g, '_');
        const hospitalId = uid || emailKey;
        const fb = await initFirebase();
        if (!fb || !fb.db) return;
        const { collection, query, where, orderBy, onSnapshot } = await import('firebase/firestore');
        // Listen for donor offers under requests/donors/items that target this hospital
        const q = query(collection(fb.db, 'requests', 'donors', 'items'), where('hospitalId', '==', hospitalId), orderBy('createdAt', 'desc'));
        unsub = onSnapshot(q, (snap) => {
          const items = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
          if (mounted) setRequests(items);
        }, (err) => {
          console.error('requests onSnapshot error', err);
        });
      } catch (e) {
        console.debug('Failed to subscribe to requests in Firestore', e);
      }
    })();
    return () => { mounted = false; if (unsub) unsub(); };
  }, []);

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
              <h2 className="text-xl font-bold mb-2 text-red-600">Pending approval</h2>
              <p className="text-sm text-gray-600 mb-4">Your hospital registration is pending admin approval. You will be able to sign in once approved.</p>
              <button onClick={handleLogout} className="px-4 py-2 rounded bg-red-600 text-white">Sign out</button>
            </div>
          </div>
        )}

        {authStatus === 'denied' && (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
              <h2 className="text-xl font-bold mb-2 text-red-600">Permission denied</h2>
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
                <div className="font-semibold text-gray-900">{hospitalName}</div>
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
                    src={mapSrc}
                    className="w-full h-40"
                    title="map"
                  />
                </div>
              ) : (
                <div className="text-sm text-gray-500 mt-2">
                  Geolocation not enabled.
                  <div className="mt-2">
                    <button onClick={enableGeolocation} className="px-3 py-2 rounded bg-red-600 text-white text-sm">Enable location</button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-auto text-sm text-gray-500">
              <div className="font-medium text-gray-700 mb-1">Last notification</div>
              <div className="p-3 bg-white rounded-lg border border-gray-100">{notifications[0]?.text ?? 'No notifications'}</div>
            </div>
          </aside>

          {/* Request Blood Modal */}
          {showRequestModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowRequestModal(false)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-red-600">Request Blood Donation</h3>
                  <button onClick={() => setShowRequestModal(false)} className="text-gray-500">Close</button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-700">Blood type</label>
                    <select value={reqBloodType} onChange={(e) => setReqBloodType(e.target.value)} className="w-full mt-1 px-3 py-2 text-red-700 border rounded-lg">
                      <option>O+</option>
                      <option>O-</option>
                      <option>A+</option>
                      <option>A-</option>
                      <option>B+</option>
                      <option>B-</option>
                      <option>AB+</option>
                      <option>AB-</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-gray-700">Quantity (units)</label>
                    <input type="number" min={1} value={reqQuantity} onChange={(e) => setReqQuantity(Number(e.target.value))} className="w-full mt-1 px-3 py-2 text-red-700 border rounded-lg" />
                  </div>

                  <div>
                    <label className="text-sm text-gray-700">Location / Pickup</label>
                    <input value={reqLocation} onChange={(e) => setReqLocation(e.target.value)} placeholder="e.g. Main St Hospital" className="w-full mt-1 px-3 py-2 text-red-700 border rounded-lg" />
                    <div className="mt-2">
                      <button type="button" onClick={() => enableGeolocation()} className="px-3 py-1 text-sm rounded text-red-700 border">Use current location</button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-700">Message (optional)</label>
                    <textarea value={reqMessage} onChange={(e) => setReqMessage(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 text-red-700 border rounded-lg" />
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button onClick={() => setShowRequestModal(false)} className="px-4 py-2 rounded-lg bg-white border">Cancel</button>
                    <button onClick={async () => {
                      // submit logic: attempt to add a new request to Firestore and notify donors
                      const localId = `req_${Date.now()}`;
                      const newReqLocal = { id: localId, donor: 'Open Call', bloodType: reqBloodType, quantity: reqQuantity, status: 'pending', location: reqLocation || 'Not specified', message: reqMessage, createdAt: Date.now() };
                      // optimistic local update so UI is responsive
                      setRequests(r => [newReqLocal, ...r]);
                      setNotifications(n => [{ id: Date.now(), text: `Open request: ${reqBloodType} x${reqQuantity} at ${reqLocation || 'unspecified'}` }, ...n]);

                      try {
                        const fb = await initFirebase();
                                        if (fb && fb.db) {
                                          const user = getCurrentUser();
                                          const uid = user?.uid || user?.id || null;
                                          const emailKey = (user?.email || '').replace(/[@.]/g, '_');
                                          const hospitalId = uid || emailKey;
                                          const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
                                          // write hospital-created request under requests/hospitals/items
                                          const docRef = await addDoc(collection(fb.db, 'requests', 'hospitals', 'items'), {
                                            donor: 'Open Call',
                                            bloodType: reqBloodType,
                                            quantity: reqQuantity,
                                            status: 'pending',
                                            location: reqLocation || 'Not specified',
                                            message: reqMessage,
                                            hospitalId,
                                            createdAt: serverTimestamp(),
                                          });
                          // Optionally replace optimistic item id (UI will update from snapshot)
                        } else {
                          // persist to localStorage so donors (other pages) can see it
                          try {
                            const existing = JSON.parse(localStorage.getItem('public_requests') || '[]');
                            localStorage.setItem('public_requests', JSON.stringify([newReqLocal, ...existing]));
                            window.dispatchEvent(new StorageEvent('storage', { key: 'public_requests', newValue: JSON.stringify([newReqLocal, ...existing]) }));
                          } catch (e) {
                            console.warn('Failed to persist public request', e);
                          }
                        }
                      } catch (e) {
                        console.error('Failed to create request in Firestore, kept local', e);
                      }

                      setShowRequestModal(false);
                      // reset form
                      setReqBloodType('O+'); setReqQuantity(1); setReqLocation(''); setReqMessage('');
                    }} className="px-4 py-2 rounded-lg bg-red-600 text-white">Send Request</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
          </>
        )}
      </div>
    </div>
  );
}
