"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  Activity,
  Calendar,
  Users,
  MapPin,
  Menu,
  Bell,
  LogOut,
  Mail,
  MessageSquare,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { signOut, initFirebase } from '@/utils/auth';

export default function DonorLanding() {
  const router = useRouter();
  // alerts (sms/email)
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  // geolocation verification
  const [geoStatus, setGeoStatus] = useState("not-enabled"); // not-enabled | allowed | denied | fetching
  const [coords, setCoords] = useState(null);
  const [geoShared, setGeoShared] = useState(false);
  // donor suitability tracking
  const [tracking, setTracking] = useState(false);
  const [suitabilityScore, setSuitabilityScore] = useState(88);
  const [lastChecked, setLastChecked] = useState(null);
  // notifications (backed by Firestore per-donor)
  const [notifications, setNotifications] = useState([]);
  const unreadNotifications = notifications.filter(n => !n?.read).length;

  // bookings persisted per-donor in Firestore
  const [bookings, setBookings] = useState([]);
  // modal state for creating a booking (opens from right column)
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [modalSlot, setModalSlot] = useState('09:00');
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalBloodType, setModalBloodType] = useState('');
  const [modalLocation, setModalLocation] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // profile fetched from Firestore (full name and blood type)
  const [fullName, setFullName] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let t;
    if (tracking) {
      // simulate periodic suitability checks
      const doCheck = () => {
        const next = Math.max(0, Math.min(100, suitabilityScore + (Math.random() * 6 - 3)));
        setSuitabilityScore(Math.round(next));
        setLastChecked(new Date().toLocaleString());
      };
      doCheck();
      t = setInterval(doCheck, 15000);
    }
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking]);

  // load donor profile from Firestore (Firebase only)
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return;
    let unsubAuth = null;
    (async () => {
      try {
        const fb = await initFirebase();
        if (!fb || !fb.auth || !fb.db) return;
        const { onAuthStateChanged } = await import('firebase/auth');
        const { doc, getDoc } = await import('firebase/firestore');

        unsubAuth = onAuthStateChanged(fb.auth, async (user) => {
          if (!user) {
            setFullName('');
            setBloodType('');
            setVerified(false);
            return;
          }

          try {
            const snap = await getDoc(doc(fb.db, 'users', user.uid));
            if (snap && snap.exists()) {
              const data = snap.data() || {};
              const name = data.name || data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || user.email || '';
              setFullName(name);
              setBloodType(data.bloodType || data.blood || '');
              setVerified(Boolean(data.verified));
            } else {
              setFullName('');
              setBloodType('');
              setVerified(false);
            }
          } catch (e) {
            console.error('Failed to load donor profile from Firestore', e);
          }
        });
      } catch (e) {
        console.debug('Firestore profile load skipped:', e);
      }
    })();

    return () => {
      try { if (typeof unsubAuth === 'function') unsubAuth(); } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to Firestore `donor_offers` for this donor and populate Recent Requests
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return;
    let unsubSnapshot = null;
    let unsubAuth = null;
    let unsubBookings = null;
    let unsubNotifications = null;
    let mounted = true;

    (async () => {
      try {
        const fb = await initFirebase();
        if (!fb || !fb.db || !fb.auth) return;
        const { onAuthStateChanged } = await import('firebase/auth');
        const { collection, query, where, orderBy, onSnapshot } = await import('firebase/firestore');

        unsubAuth = onAuthStateChanged(fb.auth, (user) => {
          if (!user) {
            if (mounted) {
              setRequests([]);
              setBookings([]);
              setNotifications([]);
            }
            return;
          }
          const uid = user.uid;
          try {
            // donor_offers for this donor
            const qOffers = query(collection(fb.db, 'donor_offers'), where('donorId', '==', uid), orderBy('createdAt', 'desc'));
            if (unsubSnapshot) unsubSnapshot();
            unsubSnapshot = onSnapshot(qOffers, (snap) => {
              const items = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
              if (mounted) setRequests(items);
            }, (err) => {
              console.error('donor_offers onSnapshot error', err);
            });

            // bookings for this donor
            const qBookings = query(collection(fb.db, 'bookings'), where('donorId', '==', uid), orderBy('createdAt', 'desc'));
            if (typeof unsubBookings === 'function') unsubBookings();
            unsubBookings = onSnapshot(qBookings, (snap) => {
              const items = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
              if (mounted) setBookings(items);
            }, (err) => {
              console.error('bookings onSnapshot error', err);
            });

            // notifications for this donor
            const qNotifs = query(collection(fb.db, 'notifications'), where('recipientId', '==', uid), orderBy('createdAt', 'desc'));
            if (typeof unsubNotifications === 'function') unsubNotifications();
            unsubNotifications = onSnapshot(qNotifs, (snap) => {
              const items = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
              if (mounted) setNotifications(items);
            }, (err) => {
              console.error('notifications onSnapshot error', err);
            });
          } catch (e) {
            console.error('Failed to subscribe to donor-specific collections', e);
          }
        });
      } catch (e) {
        console.debug('Failed to subscribe to donor_offers in Firestore', e);
      }
    })();

    return () => {
      mounted = false;
      try { if (typeof unsubAuth === 'function') unsubAuth(); } catch (e) {}
      try { if (typeof unsubSnapshot === 'function') unsubSnapshot(); } catch (e) {}
      try { if (typeof unsubBookings === 'function') unsubBookings(); } catch (e) {}
      try { if (typeof unsubNotifications === 'function') unsubNotifications(); } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogout() {
    try { signOut(); } catch (e) {}
    router.push('/signin');
  }

  function enableGeolocation() {
    if (!navigator.geolocation) return setGeoStatus("denied");
    setGeoStatus("fetching");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoStatus("allowed");
      },
      (err) => {
        console.error(err);
        setGeoStatus("denied");
      },
      { enableHighAccuracy: true, maximumAge: 60 * 1000 }
    );
  }

  async function shareLocationWithHospitals() {
    setGeoShared(false);
    if (!coords) return setGeoStatus('not-enabled');
    try {
      await new Promise((res) => setTimeout(res, 800));
      setGeoShared(true);
    } catch (e) {
      console.error(e);
      setGeoShared(false);
    }
  }

  // Requests loaded from Firestore for this donor (replaces local `recent` list)
  const [requests, setRequests] = useState([]);

  // Derive dashboard stats from Firestore-backed `requests` (no hardcoded values)
  function parseDateField(v) {
    if (!v) return null;
    try {
      if (typeof v.toDate === 'function') return v.toDate();
      const d = new Date(v);
      if (!isNaN(d)) return d;
    } catch (e) {}
    return null;
  }

  const donationsCount = requests.filter(r => {
    const st = (r.status || '').toString().toLowerCase();
    return st === 'fulfilled' || st === 'donated' || st === 'accepted';
  }).length;

  const savedLives = requests.reduce((sum, r) => {
    const qty = Number(r.quantity || 1) || 1;
    // Assume each unit potentially helps ~3 lives unless overridden
    const multiplier = Number(r.savedLivesMultiplier || 3) || 3;
    return sum + qty * multiplier;
  }, 0);

  const nextDrive = (() => {
    const now = new Date();
    const dates = requests.map(r => parseDateField(r.driveDate || r.date || r.appointmentDate || r.createdAt)).filter(Boolean).filter(d => d > now);
    if (!dates.length) return 'None';
    dates.sort((a, b) => a - b);
    return dates[0].toLocaleDateString();
  })();

  const stats = [
    { id: 1, label: 'Donations', value: String(donationsCount) },
    { id: 2, label: 'Saved Lives', value: String(savedLives) },
    { id: 3, label: 'Next Drive', value: nextDrive },
  ];

  // booking state
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('09:00');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [bookingError, setBookingError] = useState('');

  async function handleBooking(e) {
    e?.preventDefault?.();
    setBookingError('');
    setBookingSuccess('');
    if (!selectedDate) return setBookingError('Please select a date to donate.');
    setBookingLoading(true);
    try {
      if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        const fb = await initFirebase();
        if (fb && fb.db && fb.auth) {
          const user = fb.auth.currentUser;
          const uid = user?.uid || null;
          const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
          await addDoc(collection(fb.db, 'bookings'), {
            donorId: uid,
            date: selectedDate,
            slot: selectedSlot,
            status: 'booked',
            createdAt: serverTimestamp(),
          });
          setBookingSuccess(`Booked ${selectedDate} at ${selectedSlot}`);
          return;
        }
      }

      // fallback (shouldn't be used when Firestore is configured)
      await new Promise((res) => setTimeout(res, 900));
      setBookingSuccess(`Booked ${selectedDate} at ${selectedSlot}`);
    } catch (err) {
      console.error('handleBooking error', err);
      setBookingError('Failed to book donation.');
    } finally {
      setBookingLoading(false);
    }
  }

  // Persist toggles to the donor's user document so other donors are unaffected
  async function toggleSmsEnabled() {
    const next = !smsEnabled;
    setSmsEnabled(next);
    try {
      if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return;
      const fb = await initFirebase();
      if (!fb || !fb.db || !fb.auth) return;
      const user = fb.auth.currentUser;
      if (!user) return;
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(fb.db, 'users', user.uid), { smsEnabled: !!next });
    } catch (e) {
      console.error('Failed to persist smsEnabled', e);
    }
  }

  async function toggleEmailEnabled() {
    const next = !emailEnabled;
    setEmailEnabled(next);
    try {
      if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return;
      const fb = await initFirebase();
      if (!fb || !fb.db || !fb.auth) return;
      const user = fb.auth.currentUser;
      if (!user) return;
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(fb.db, 'users', user.uid), { emailEnabled: !!next });
    } catch (e) {
      console.error('Failed to persist emailEnabled', e);
    }
  }

  async function handleModalSubmit(e) {
    e?.preventDefault?.();
    setModalError('');
    setModalSuccess('');
    if (!modalDate) return setModalError('Please pick a date');
    setModalLoading(true);
    try {
      if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        const fb = await initFirebase();
        if (fb && fb.db && fb.auth) {
          const user = fb.auth.currentUser;
          const uid = user?.uid || null;
          const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
          await addDoc(collection(fb.db, 'bookings'), {
            donorId: uid,
            donorName: fullName || null,
            bloodType: modalBloodType || bloodType || null,
            quantity: Number(modalQuantity) || 1,
            date: modalDate,
            slot: modalSlot,
            location: modalLocation || null,
            notes: modalNotes || null,
            status: 'booked',
            createdAt: serverTimestamp(),
          });
          setModalSuccess('Appointment requested');
          setShowBookingModal(false);
          // reset form
          setModalDate('');
          setModalSlot('09:00');
          setModalQuantity(1);
          setModalNotes('');
          setModalLocation('');
          return;
        }
      }

      // fallback
      await new Promise((r) => setTimeout(r, 600));
      setModalSuccess('Appointment requested (local)');
      setShowBookingModal(false);
    } catch (err) {
      console.error('handleModalSubmit error', err);
      setModalError('Failed to request appointment');
    } finally {
      setModalLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-red-50 via-white to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-600/10 flex items-center justify-center">
              <Heart className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Donor Dashboard</h2>
              <p className="text-sm text-gray-500">Quick actions to manage donations</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                // mark notifications read locally and in Firestore (per-donor)
                try {
                  setNotifications((prev) => prev.map(n => ({ ...n, read: true })));
                  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
                    const fb = await initFirebase();
                    if (fb && fb.db) {
                      const { doc, updateDoc } = await import('firebase/firestore');
                      notifications.forEach(n => {
                        try { if (n?.id) updateDoc(doc(fb.db, 'notifications', n.id), { read: true }); } catch (e) {}
                      });
                    }
                  }
                } catch (e) {
                  console.error('Failed to mark notifications read', e);
                }
                router.push('/notifications');
              }}
              aria-label="Notifications"
              className="relative p-2 rounded-lg bg-white border border-gray-200 shadow-sm"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">{unreadNotifications}</span>
              )}
            </button>

            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm">
              <LogOut className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">Logout</span>
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Incoming appointments (left) */}
          <section className="bg-white rounded-3xl p-4 shadow-sm lg:col-span-1 order-first lg:order-0">
            <div className="p-4 rounded-xl border border-gray-100">
              <h5 className="font-semibold mb-2 text-red-600">Incoming appointments</h5>
              <p className="text-xs text-gray-500 mb-3">Your upcoming appointments and their status.</p>
              {bookings.length === 0 && (
                <div className="text-sm text-gray-500">No upcoming appointments.</div>
              )}
              <div className="space-y-3">
                {bookings.map((b) => {
                  const d = parseDateField(b.date || b.createdAt) || (b.date ? new Date(b.date) : null);
                  const dateLabel = d ? d.toLocaleDateString() + (b.slot ? ` • ${b.slot}` : '') : (b.date || '—');
                  return (
                    <div key={b.id} className="p-3 bg-white rounded-lg border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{b.hospital || b.location || 'Appointment'}</div>
                          <div className="text-xs text-gray-500">{dateLabel}</div>
                        </div>
                        <div className="text-sm font-semibold text-red-600">{(b.status || 'booked')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Main: Hero / Quick Actions */}
          <section className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-3xl font-extrabold text-gray-900">Ready to give?</h3>
                <p className="text-sm text-gray-500 mt-1">Find nearby drives, manage appointments, and track your impact.</p>
              </div>

              <div className="flex items-center gap-3">
                <button className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700">Find Drives</button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats.map((s) => (
                <div key={s.id} className="p-4 rounded-xl bg-red-50 border border-red-50/50 hover:scale-[1.01] transition-transform">
                  <div className="text-xs text-gray-500">{s.label}</div>
                  <div className="text-2xl font-bold text-red-600 mt-1">{s.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h4 className="text-lg font-semibold text-gray-900">Recent Requests</h4>
                <div className="mt-3 grid gap-3">
                  {requests.length === 0 && (
                    <div className="text-sm text-gray-500">No requests found.</div>
                  )}
                  {requests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                      <div>
                        <div className="font-medium text-gray-900">{r.title || r.donor || `Request ${r.id}`}</div>
                        <div className="text-sm text-gray-500">{r.location || r.hospital || r.message || (r.bloodType ? `Blood: ${r.bloodType} • Qty: ${r.quantity || 1}` : '')}</div>
                      </div>
                      <div className="text-sm text-red-600">{r.status ? r.status : (r.createdAt ? new Date(r.createdAt).toLocaleString() : '')}</div>
                    </div>
                  ))}
                </div>
            </div>
          </section>

          {/* Right: Compact profile & quick actions */}
          <aside className="bg-white/60 rounded-3xl p-4 shadow-lg flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-red-600/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">{fullName || 'Donor'}</div>
                <div className="text-sm text-gray-500">{bloodType ? `${bloodType} ${verified ? '• Verified' : ''}` : 'Profile not set'}</div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button onClick={() => { setShowBookingModal(true); setModalBloodType(bloodType || ''); }} className="w-full px-4 py-2 rounded-lg bg-red-600 text-white font-semibold">Book an Appointment</button>
            </div>

            <div className="mt-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">Location</div>
                <div className="text-xs text-gray-500">{geoStatus === 'not-enabled' ? 'disabled' : geoStatus === 'fetching' ? 'requesting...' : geoStatus === 'allowed' ? 'allowed' : 'denied'}</div>
              </div>
              <div className="mt-2">
                <button onClick={enableGeolocation} className="w-full px-3 py-2 rounded bg-white border border-gray-500 mb-2 text-red-600">Enable location</button>
                {geoStatus === 'allowed' && coords && (
                  <div className="w-full h-36 rounded overflow-hidden border border-gray-100">
                    <iframe
                      title="donor-location"
                      className="w-full h-full"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lon-0.02}%2C${coords.lat-0.02}%2C${coords.lon+0.02}%2C${coords.lat+0.02}&layer=mapnik&marker=${coords.lat}%2C${coords.lon}`}
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={shareLocationWithHospitals} className="flex-1 px-3 py-2 rounded bg-red-600 text-white">Share location</button>
                </div>
                {geoShared && <div className="text-xs text-green-700 mt-2">Location shared (simulated)</div>}
              </div>
            </div>
            
          </aside>
        </main>
      </div>
    </div>
  );
}
