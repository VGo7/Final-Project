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
  const [selectedAcceptedRequest, setSelectedAcceptedRequest] = useState(null);
  const [showAcceptedModal, setShowAcceptedModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingCache, setBookingCache] = useState({});

  const [actionLoading, setActionLoading] = useState(null);
  const [coords, setCoords] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqBloodType, setReqBloodType] = useState('O+');
  const [reqQuantity, setReqQuantity] = useState(1);
  const [reqLocation, setReqLocation] = useState('');
  const [reqMessage, setReqMessage] = useState('');
  const [authStatus, setAuthStatus] = useState('checking'); // 'checking' | 'allowed' | 'pending' | 'denied'

  function handleLogout() {
    try { signOut('hospital'); } catch (e) {}
    router.push('/signin');
  }

  // Expose debug utility to window for easy console access
  useEffect(() => {
    window.__hospitalDebug = {
      authStatus,
      requests,
      hospitalName,
      authStatusDetails: () => {
        const user = getCurrentUser('hospital');
        const uid = user?.uid || user?.id;
        const emailKey = (user?.email || '').replace(/[@.]/g, '_');
        const hospitalId = uid || emailKey;
        return {
          currentAuthStatus: authStatus,
          user: { uid, email: user?.email },
          hospitalId,
          cachedAccepted: (() => {
            try {
              const cached = localStorage.getItem('hospital_accepted_requests_' + hospitalId);
              return cached ? JSON.parse(cached) : null;
            } catch (e) {
              return `ERROR: ${e.message}`;
            }
          })(),
          acceptedCount: requests.filter(isAcceptedAndNotYetReached).length,
          pendingCount: requests.filter(r => (r.status || '').toString().toLowerCase() === 'requested' || (r.status || '').toString().toLowerCase() === 'pending').length,
          totalRequests: requests.length,
        };
      },
      allRequests: () => requests.map(r => ({
        id: r.id,
        status: r.status,
        donorName: r.donorName,
        bloodType: r.bloodType,
        quantity: r.quantity,
        requestedDate: r.requestedDate,
      })),
      localStorage: () => {
        const user = getCurrentUser('hospital');
        const uid = user?.uid || user?.id;
        const emailKey = (user?.email || '').replace(/[@.]/g, '_');
        const hospitalId = uid || emailKey;
        const keys = Object.keys(localStorage).filter(k => k.includes('hospital_accepted_requests'));
        return {
          keys,
          data: keys.reduce((acc, k) => {
            try {
              acc[k] = JSON.parse(localStorage.getItem(k));
            } catch (e) {
              acc[k] = `ERROR: ${e.message}`;
            }
            return acc;
          }, {}),
        };
      },
    };
    console.log('🔧 Hospital Debug Utility Ready! Type: window.__hospitalDebug.authStatusDetails()');
  }, [authStatus, requests]);

  // Check hospital verification status before rendering dashboard
  // This also fetches the hospitalId from the hospitals collection to enable proper data isolation
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Initialize Firebase first to ensure auth is ready
        const fb = await initFirebase();
        
        // For Firebase, we need to wait for auth state to be ready
        if (fb && fb.auth) {
          return new Promise((resolve) => {
            const unsubscribe = fb.auth.onAuthStateChanged((firebaseUser) => {
              unsubscribe();
              if (!mounted) return resolve();
              
              if (!firebaseUser) {
                setAuthStatus('denied');
                router.push('/signin');
                return resolve();
              }
              
              performHospitalCheck(firebaseUser);
              resolve();
            });
            // Timeout after 5 seconds just in case
            setTimeout(() => {
              unsubscribe();
              if (mounted) {
                performHospitalCheck(getCurrentUser('hospital'));
              }
              resolve();
            }, 5000);
          });
        }
        
        // For local auth (no Firebase), check immediately
        const user = getCurrentUser('hospital');
        performHospitalCheck(user);
      } catch (e) {
        console.error('auth initialization failed', e);
        if (mounted) setAuthStatus('denied');
      }
    })();

    async function performHospitalCheck(user) {
      if (!mounted) return;
      if (!user) {
        setAuthStatus('denied');
        router.push('/signin');
        return;
      }

        // Prefer Firebase stored hospitals
        try {
          const fb = await initFirebase();
          if (fb && fb.db) {
            const { doc, getDoc } = await import('firebase/firestore');
            const uid = user?.uid || user?.id || null;
            const emailKey = (user?.email || '').replace(/[@.]/g, '_');
            const computedHospitalId = uid || emailKey;
            
            // CRITICAL: Fetch the hospital document to get the authoritative hospitalId
            // This ensures data isolation by using the hospital's own ID for filtering
            let hospitalIdForDataIsolation = computedHospitalId;
            let hospitalData = null;
            
            try {
              const snap = await getDoc(doc(fb.db, 'hospitals', computedHospitalId));
              if (snap.exists()) {
                hospitalData = snap.data();
                // Use the document ID (which is the hospitalId) for all data isolation operations
                hospitalIdForDataIsolation = snap.id;
                console.debug('✅ Hospital document found:', { hospitalId: hospitalIdForDataIsolation, verified: hospitalData?.verified });
              } else {
                console.debug('⚠️ No hospital document found for:', computedHospitalId, '- using computed ID for development');
              }
            } catch (e) {
              console.error('Failed to fetch hospital document:', e);
              hospitalIdForDataIsolation = computedHospitalId;
            }
            
            // CRITICAL: Store the hospitalId in localStorage for session persistence
            // This ensures the hospital stays logged in after page refresh
            try {
              localStorage.setItem('current_hospital_id', hospitalIdForDataIsolation);
              console.debug('💾 Stored hospitalId for data isolation:', hospitalIdForDataIsolation);
            } catch (e) {
              console.error('Failed to store hospitalId:', e);
            }
            
            // Load cached accepted requests IMMEDIATELY and merge them into state
            // Use the hospital's ID to ensure we only load this hospital's cached requests
            try {
              const cached = localStorage.getItem('hospital_accepted_requests_' + hospitalIdForDataIsolation);
              if (cached && mounted) {
                try {
                  const cachedAccepted = JSON.parse(cached);
                  console.debug('📥 Loading cached accepted requests on auth check:', {
                    count: cachedAccepted.length,
                    hospitalId: hospitalIdForDataIsolation,
                    ids: cachedAccepted.map(r => r.id),
                  });
                  setRequests(prev => {
                    // Keep pending requests, add cached accepted ones
                    const mergedMap = new Map();
                    prev.forEach(r => {
                      const status = (r.status || '').toString().toLowerCase();
                      if (status === 'requested' || status === 'pending') {
                        mergedMap.set(r.id, r);
                      }
                    });
                    cachedAccepted.forEach(r => mergedMap.set(r.id, r));
                    const merged = Array.from(mergedMap.values());
                    console.debug('🔀 Merged on auth check:', { pending: prev.filter(r => (r.status || '').toString().toLowerCase() === 'requested').length, cached: cachedAccepted.length, total: merged.length });
                    return merged;
                  });
                } catch (e) {
                  console.error('❌ Failed to parse cached accepted requests on auth check:', e);
                }
              }
            } catch (e) {
              console.error('❌ Failed to load cached requests on auth check:', e);
            }
            
            // Check verification status from hospital data
            if (hospitalData) {
              try { setHospitalName(hospitalData?.name || hospitalData?.hospitalName || 'Hospital'); } catch (e) {}
              const v = hospitalData?.verified || 'pending';
              console.debug('✅ Hospital verification status:', { hospitalId: hospitalIdForDataIsolation, verified: v });
              if (!mounted) return;
              if (v === 'accepted') setAuthStatus('allowed');
              else if (v === 'denied') setAuthStatus('denied');
              else setAuthStatus('pending');
              return;
            }
            
            // if no hospital doc, treat as ALLOWED (for development/testing)
            // In production, you might want to set this to 'pending'
            console.debug('No hospital document found - allowing access for development with hospitalId:', hospitalIdForDataIsolation);
            if (mounted) setAuthStatus('allowed');
            return;
          }
        } catch (e) {
          // fallback to local behavior if Firestore not available
          console.debug('Firestore check failed, allowing access as fallback', e);
          if (mounted) setAuthStatus('allowed');
          return;
        }
      }

    return () => { mounted = false; };
  }, [router]);


  async function acceptRequest(id) {
    setActionLoading(id);
    try {
      const fb = await initFirebase();
      const user = getCurrentUser('hospital');
      const uid = user?.uid || user?.id || null;
      const emailKey = (user?.email || '').replace(/[@.]/g, '_');
      let computedHospitalId = uid || emailKey;
      
      // CRITICAL: Use the stored hospitalId for data isolation
      // This ensures we use the same ID that was fetched from the hospitals collection
      let hospitalId = computedHospitalId;
      try {
        const storedId = localStorage.getItem('current_hospital_id');
        if (storedId) {
          hospitalId = storedId;
          console.debug('✅ Using stored hospitalId for acceptRequest:', hospitalId);
        } else {
          localStorage.setItem('current_hospital_id', computedHospitalId);
          console.debug('💾 Stored computed hospitalId:', computedHospitalId);
        }
      } catch (e) {
        console.error('Failed to access/store hospitalId:', e);
      }
      
      const hospitalNm = hospitalName || 'Hospital';
      console.debug('acceptRequest:', { uid, emailKey, hospitalId });

      if (fb && fb.db) {
        const { doc, runTransaction, serverTimestamp, collection } = await import('firebase/firestore');
        const offerRef = doc(fb.db, 'donor_offers', id);
        // Run a transaction to atomically verify offer status, update it, and create a booking linked to it
        try {
          const result = await runTransaction(fb.db, async (tx) => {
            const offerSnap = await tx.get(offerRef);
            if (!offerSnap.exists()) throw new Error('offer-not-found');
            const offer = offerSnap.data() || {};
            const currentStatus = (offer.status || '').toString().toLowerCase();
            if (currentStatus && currentStatus !== 'requested' && currentStatus !== 'pending') {
              throw new Error('already-processed');
            }

            // prepare booking and update offer atomically
            const bookingsRef = collection(fb.db, 'bookings');
            const newBookingRef = doc(bookingsRef);

            // try to capture any location/coords present on the offer
            let bookingLocation = null;
            let bookingCoords = null;
            try {
              bookingLocation = offer.location || offer.requestedLocation || null;
              bookingCoords = offer.coords || offer.coordinates || null;
              // if location is a string like "lat,lon" try to parse
              if (!bookingCoords && typeof bookingLocation === 'string') {
                const m = bookingLocation.split(/[ ,;]+/).map(s => s.trim()).filter(Boolean);
                if (m.length >= 2) {
                  const nlat = Number(m[0]);
                  const nlon = Number(m[1]);
                  if (!isNaN(nlat) && !isNaN(nlon)) bookingCoords = { lat: nlat, lon: nlon };
                }
              }
              // if coords is Firestore GeoPoint-like with latitude/longitude, normalize
              if (bookingCoords && typeof bookingCoords.latitude === 'number' && typeof bookingCoords.longitude === 'number') {
                bookingCoords = { lat: bookingCoords.latitude, lon: bookingCoords.longitude };
              }
            } catch (e) {
              bookingLocation = bookingLocation || null;
              bookingCoords = bookingCoords || null;
            }

            const booking = {
              donorId: offer.donorId || null,
              donorName: offer.donorName || null,
              hospitalId,
              hospitalName: hospitalNm,
              donorOfferId: id,
              date: offer.requestedDate || offer.date || null,
              slot: offer.requestedSlot || offer.slot || null,
              quantity: Number(offer.quantity) || 1,
              bloodType: offer.bloodType || null,
              status: 'booked',
              createdAt: serverTimestamp(),
              // include detected location/coords so hospital UI can display them
              location: bookingLocation || null,
              coords: bookingCoords || null,
            };

            // update offer with accepted status and audit fields
            // CRITICAL: Store the hospitalId to enable data isolation filtering
            tx.update(offerRef, {
              status: 'accepted',
              acceptedAt: serverTimestamp(),
              hospitalAccepted: true,
              hospitalId, // CRITICAL: This field enables the data isolation query
              hospitalName: hospitalNm,
              acceptedBy: { uid: uid || null, email: user?.email || null },
              bookingId: newBookingRef.id,
            });

            // create booking doc
            tx.set(newBookingRef, booking);

            return { bookingId: newBookingRef.id, booking };
          });

          // After transaction commit, notify donor and update local state
          try {
            const { collection, addDoc } = await import('firebase/firestore');
            if (result && result.bookingId) {
              const notifsRef = collection(fb.db, 'notifications');
              if (result && result.booking && result.booking.donorId) {
                await addDoc(notifsRef, {
                  recipientId: result.booking.donorId,
                  type: 'offer_accepted',
                  donorOfferId: id,
                  bookingId: result.bookingId,
                  message: `Your request was accepted by ${hospitalNm}. Appointment created.`,
                  createdAt: serverTimestamp(),
                  read: false,
                });
              }
            }
          } catch (e) {
            console.error('failed to notify donor after transaction', e);
          }

          // update in-memory requests list so UI reflects the accepted booking immediately
          setRequests(prev => {
            const offerIndex = prev.findIndex(x => x.id === id);
            // Merge the existing offer data with the new accepted status and bookingId
            const existingOffer = offerIndex >= 0 ? prev[offerIndex] : null;
            const acceptedEntry = {
              ...(existingOffer || {}),  // Keep all original fields (donorName, bloodType, quantity, dates, etc.)
              id,
              status: 'accepted',
              bookingId: result.bookingId,
              acceptedAt: new Date().toISOString(),
              hospitalAccepted: true,
              hospitalId,
              hospitalName: hospitalNm,
            };
            console.debug('✅ Updated local request to accepted:', {
              id: acceptedEntry.id,
              status: acceptedEntry.status,
              hospitalId: acceptedEntry.hospitalId,
              donorName: acceptedEntry.donorName,
              bloodType: acceptedEntry.bloodType,
              quantity: acceptedEntry.quantity,
              requestedDate: acceptedEntry.requestedDate,
            });
            // place accepted at top of list
            const updated = [acceptedEntry, ...prev.filter(x => x.id !== id)];
            
            // Also cache this locally for persistence
            // CRITICAL: Use the hospitalId as the cache key to ensure data isolation
            try {
              const acceptedOnly = updated.filter(r => (r.status || '').toString().toLowerCase() === 'accepted');
              const cacheKey = 'hospital_accepted_requests_' + hospitalId;
              localStorage.setItem(cacheKey, JSON.stringify(acceptedOnly));
              console.debug('💾 Cached accepted requests to localStorage (data isolation):', {
                cacheKey,
                hospitalId,
                count: acceptedOnly.length,
                acceptedIds: acceptedOnly.map(r => r.id),
                sampleData: acceptedOnly.length > 0 ? {
                  id: acceptedOnly[0].id,
                  status: acceptedOnly[0].status,
                  hospitalId: acceptedOnly[0].hospitalId,
                  donorName: acceptedOnly[0].donorName,
                } : null,
              });
            } catch (e) {
              console.error('❌ Failed to cache accepted requests:', e);
            }
            
            return updated;
          });

          setNotifications(n => [{ id: Date.now(), text: `Request ${id} accepted` }, ...n]);
        } catch (txErr) {
          if (txErr && txErr.message === 'offer-not-found') {
            setNotifications(n => [{ id: Date.now(), text: `Request ${id} not found` }, ...n]);
          } else if (txErr && txErr.message === 'already-processed') {
            setNotifications(n => [{ id: Date.now(), text: `Request ${id} already processed` }, ...n]);
          } else {
            console.error('transaction failed', txErr);
          }
        }
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
        const { doc, updateDoc, serverTimestamp, getDoc, collection, addDoc } = await import('firebase/firestore');
        const offerRef = doc(fb.db, 'donor_offers', id);
        const offerSnap = await getDoc(offerRef);
        const offer = offerSnap.exists() ? (offerSnap.data() || {}) : null;
        await updateDoc(offerRef, { status: 'denied', deniedAt: serverTimestamp(), hospitalDenied: true });
        // notify donor about denial
        if (offer && offer.donorId) {
          try {
            const notifsRef = collection(fb.db, 'notifications');
            await addDoc(notifsRef, {
              recipientId: offer.donorId,
              type: 'offer_denied',
              donorOfferId: id,
              message: `Your request ${id} was denied by ${hospitalName || 'a hospital'}.`,
              createdAt: serverTimestamp(),
              read: false,
            });
          } catch (e) {
            console.error('failed to notify donor of denial', e);
          }
        }
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

  // Open accepted request modal and fetch linked booking (if any)
  async function fetchBookingById(id) {
    setSelectedBooking(null);
    if (!id) return;
    try {
      const fb = await initFirebase();
      if (!fb || !fb.db) return;
      const { doc, getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(fb.db, 'bookings', id));
      if (snap && typeof snap.exists === 'function' ? snap.exists() : snap.exists) {
        const data = (typeof snap.data === 'function') ? snap.data() : (snap.data || {});
        setSelectedBooking({ id: snap.id, ...(data || {}) });
      } else {
        setSelectedBooking(null);
      }
    } catch (e) {
      console.error('Failed to load booking', e);
      setSelectedBooking(null);
    }
  }

  // lightweight booking prefetch/cache for rendering summaries in the list
  async function fetchBookingToCache(id) {
    if (!id) return;
    try {
      if (bookingCache && bookingCache[id]) return; // already cached
      const fb = await initFirebase();
      if (!fb || !fb.db) return;
      const { doc, getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(fb.db, 'bookings', id));
      if (snap && typeof snap.exists === 'function' ? snap.exists() : snap.exists) {
        const data = (typeof snap.data === 'function') ? snap.data() : (snap.data || {});
        setBookingCache(prev => ({ ...(prev || {}), [id]: { id: snap.id, ...(data || {}) } }));
      }
    } catch (e) {
      console.error('Failed to prefetch booking', e);
    }
  }

  // prefetch bookings referenced by accepted requests so list can show details
  useEffect(() => {
    if (!requests || !requests.length) return;
    (async () => {
      try {
        for (const r of requests) {
          if (r && r.bookingId && !(bookingCache && bookingCache[r.bookingId])) {
            // fire-and-forget
            fetchBookingToCache(r.bookingId);
          }
        }
      } catch (e) {
        console.error('booking prefetch failed', e);
      }
    })();
  }, [requests]);

  function openAcceptedModal(r) {
    setSelectedAcceptedRequest(r);
    setShowAcceptedModal(true);
    if (r && r.bookingId) {
      // fire-and-forget fetch booking
      fetchBookingById(r.bookingId);
    } else {
      setSelectedBooking(null);
    }
  }

  function acceptedRequests() {
    // Simulate viewing accepted requests — add a notification
    setNotifications(n => [{ id: Date.now(), text: 'Showing accepted requests (simulated)' }, ...n]);
  }

  const pendingRequests = requests.filter(r => (r.status || '').toString().toLowerCase() === 'requested' || (r.status || '').toString().toLowerCase() === 'pending');

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

  function formatLocationField(v) {
    if (!v) return '';
    try {
      if (typeof v === 'object') {
        const lat = v.lat ?? v.latitude ?? v.latDegrees;
        const lon = v.lon ?? v.lng ?? v.longitude ?? v.lonDegrees;
        if (typeof lat === 'number' && typeof lon === 'number') {
          return `Lat ${lat.toFixed(5)}, Lon ${lon.toFixed(5)}`;
        }
        // fallback: JSON stringify small object
        return Object.keys(v).length ? JSON.stringify(v) : '';
      }
      return String(v);
    } catch (e) {
      return '';
    }
  }

  // Normalize booking location from several possible field shapes into a string
  function getBookingLocationString(b) {
    if (!b) return '';
    const candidates = [
      b.location,
      b.coords,
      b.requestedLocation,
      b.coordinates,
      // flat fields
      (typeof b.latitude !== 'undefined' && typeof b.longitude !== 'undefined') ? { latitude: b.latitude, longitude: b.longitude } : null,
      (typeof b.lat !== 'undefined' && typeof b.lng !== 'undefined') ? { lat: b.lat, lng: b.lng } : null,
      (typeof b.lat !== 'undefined' && typeof b.lon !== 'undefined') ? { lat: b.lat, lon: b.lon } : null,
    ].filter(Boolean);

    for (const c of candidates) {
      const s = formatLocationField(c);
      if (s) return s;
      if (typeof c === 'string' && c.trim()) return c.trim();
      try {
        const json = JSON.stringify(c);
        if (json && json !== '{}' && json !== '[]') return json;
      } catch (e) {}
    }
    return '';
  }

  // Try to extract numeric lat/lon coordinates from booking object
  function getBookingCoords(b) {
    if (!b) return null;
    const tests = [
      b.coords,
      b.location,
      b.requestedLocation,
      b.coordinates,
      // direct fields
      (typeof b.latitude !== 'undefined' && typeof b.longitude !== 'undefined') ? { latitude: b.latitude, longitude: b.longitude } : null,
      (typeof b.lat !== 'undefined' && typeof b.lng !== 'undefined') ? { lat: b.lat, lng: b.lng } : null,
      (typeof b.lat !== 'undefined' && typeof b.lon !== 'undefined') ? { lat: b.lat, lon: b.lon } : null,
    ].filter(Boolean);

    for (const t of tests) {
      if (!t) continue;
      // object with latitude/longitude
      const lat = t.lat ?? t.latitude ?? t.latDegrees ?? t.latitudeDegrees;
      const lon = t.lon ?? t.lng ?? t.lon ?? t.longitude ?? t.longitudeDegrees;
      if (typeof lat === 'number' && typeof lon === 'number') return { lat, lon };
      // numeric strings
      if ((typeof lat === 'string' || typeof lon === 'string')) {
        const nlat = Number(lat);
        const nlon = Number(lon);
        if (!isNaN(nlat) && !isNaN(nlon)) return { lat: nlat, lon: nlon };
      }
      // if t is string like "lat,lon"
      if (typeof t === 'string') {
        const m = t.split(/[ ,;]+/).map(s => s.trim()).filter(Boolean);
        if (m.length >= 2) {
          const nlat = Number(m[0]);
          const nlon = Number(m[1]);
          if (!isNaN(nlat) && !isNaN(nlon)) return { lat: nlat, lon: nlon };
        }
      }
    }

    return null;
  }

  // Try to derive a scheduled Date object from request fields (requestedDate + requestedSlot, fallback to date/slot)
  function getScheduledDateTime(r) {
    if (!r) return null;
    const dateStr = r.requestedDate || r.date || r.scheduledDate || null;
    const slot = r.requestedSlot || r.slot || null;
    if (!dateStr) return null;

    const ds = String(dateStr).trim();
    try {
      // If date already looks like an ISO datetime, try that first
      if (/\d{4}-\d{2}-\d{2}T/.test(ds)) {
        const dt = new Date(ds);
        if (!isNaN(dt)) return dt;
      }

      // derive time part from slot when available (e.g. "09:00", "9 AM", "14:30-15:00")
      let timePart = '00:00';
      if (slot) {
        const s = String(slot);
        const m = s.match(/(\d{1,2}:\d{2})/);
        if (m) {
          timePart = m[1];
        } else {
          const m2 = s.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
          if (m2) {
            let hh = parseInt(m2[1], 10);
            const mm = m2[2] || '00';
            const ampm = m2[3];
            if (ampm) {
              if (/pm/i.test(ampm) && hh < 12) hh += 12;
              if (/am/i.test(ampm) && hh === 12) hh = 0;
            }
            timePart = `${String(hh).padStart(2, '0')}:${mm}`;
          }
        }
      }

      // Build an ISO-like string and parse as local time
      const isoLike = `${ds}T${timePart}:00`;
      const parsed = new Date(isoLike);
      if (!isNaN(parsed)) return parsed;

      // fallback: try parsing date-only
      const parsedDateOnly = new Date(ds);
      if (!isNaN(parsedDateOnly)) return parsedDateOnly;
    } catch (e) {
      // ignore parse errors
    }
    return null;
  }

  // Return a friendly date/time string for a request (falls back to raw fields)
  function formatScheduledDateTime(r) {
    if (!r) return 'Unscheduled';
    const dt = getScheduledDateTime(r);
    if (dt instanceof Date && !isNaN(dt)) {
      try {
        return dt.toLocaleString();
      } catch (e) {
        return dt.toString();
      }
    }
    // Fallback to fields that may contain human text
    const parts = [];
    if (r.requestedDate) parts.push(String(r.requestedDate));
    if (r.requestedSlot) parts.push(String(r.requestedSlot));
    if (r.date) parts.push(String(r.date));
    if (r.slot) parts.push(String(r.slot));
    return parts.length ? parts.join(' • ') : 'Unscheduled';
  }

  // Return true for requests that are accepted and whose scheduled date/time has not yet passed.
  function isAcceptedAndNotYetReached(r) {
    if (!r) {
      console.debug('isAcceptedAndNotYetReached: request is falsy', r);
      return false;
    }
    const s = (r.status || '').toString().toLowerCase();
    console.debug('isAcceptedAndNotYetReached check:', { id: r.id, status: r.status, normalizedStatus: s, donorName: r.donorName });
    if (s !== 'accepted') {
      console.debug(`  → Status is "${s}", not "accepted", EXCLUDED`);
      return false;
    }
    const dt = getScheduledDateTime(r);
    if (!dt) {
      console.debug(`  → No scheduled date, INCLUDED (no schedule = keep showing)`);
      return true; // no schedule -> keep showing until explicitly changed
    }
    const isInFuture = dt.getTime() > Date.now();
    console.debug(`  → Scheduled for ${dt.toLocaleString()}, ${isInFuture ? 'future' : 'past'}, ${isInFuture ? 'INCLUDED' : 'EXCLUDED'}`);
    return isInFuture;
  }

  // Return true for requests that were accepted but whose scheduled date/time has passed, or already fulfilled
  function isPastAccepted(r) {
    if (!r) return false;
    const s = (r.status || '').toString().toLowerCase();
    if (s === 'fulfilled') return true;
    if (s !== 'accepted') return false;
    const dt = getScheduledDateTime(r);
    if (!dt) return false; // accepted but no schedule -> not considered past
    return dt.getTime() <= Date.now();
  }

  // When the modal is opened and coords become available, autofill location
  useEffect(() => {
    if (showRequestModal && coords) {
      setReqLocation(`Lat ${coords.lat.toFixed(5)}, Lon ${coords.lon.toFixed(5)}`);
    }
  }, [showRequestModal, coords]);

  // Subscribe to Firestore for incoming requests for this hospital
  // Listen to both 'requested' (incoming) and 'accepted' (offers this hospital accepted)
  // CRITICAL: Uses hospitalId from hospitals collection for data isolation
  useEffect(() => {
    let unsubRequested = null;
    let unsubAccepted = null;
    let mounted = true;
    (async () => {
      try {
        const user = getCurrentUser('hospital');
        const uid = user?.uid || user?.id || null;
        const emailKey = (user?.email || '').replace(/[@.]/g, '_');
        const computedHospitalId = uid || emailKey;
        
        // CRITICAL: Use the stored hospitalId that was fetched from hospitals collection
        // This ensures data isolation - each hospital only sees their own accepted requests
        let hospitalId = computedHospitalId;
        try {
          const storedId = localStorage.getItem('current_hospital_id');
          if (storedId) {
            hospitalId = storedId;
            console.debug('✅ Firestore subscription using stored hospitalId:', hospitalId);
          }
        } catch (e) {
          console.error('Failed to retrieve stored hospitalId:', e);
        }
        
        console.debug('Firestore subscription initializing:', { uid, emailKey, hospitalId, authStatus });
        const fb = await initFirebase();
        if (!fb || !fb.db) {
          // Load from localStorage if Firestore not available
          console.debug('Firestore not available, loading from cache');
          try {
            const cached = localStorage.getItem('hospital_accepted_requests_' + hospitalId);
            if (cached && mounted) {
              const parsed = JSON.parse(cached);
              setRequests(parsed);
              console.debug('Loaded from cache:', { count: parsed.length, hospitalId });
            }
          } catch (e) {
            console.debug('Failed to load cached requests', e);
          }
          return;
        }
        const { collection, query, where, orderBy, onSnapshot } = await import('firebase/firestore');

        // Query for incoming requests (status == 'requested')
        const qRequested = query(collection(fb.db, 'donor_offers'), where('status', '==', 'requested'), orderBy('createdAt', 'desc'));

        // CRITICAL: Query for accepted offers that belong ONLY to this hospital
        // This ensures data isolation by filtering hospitalId == this hospital's ID
        const qAccepted = query(collection(fb.db, 'donor_offers'), where('status', '==', 'accepted'), where('hospitalId', '==', hospitalId), orderBy('acceptedAt', 'desc'));
        console.debug('Firestore queries set up (DATA ISOLATION ENABLED):', { qRequested: 'status=requested', qAccepted: `status=accepted AND hospitalId=${hospitalId}` });

        // temporary holders so we can merge snapshots
        let latestRequested = [];
        let latestAccepted = [];

        unsubRequested = onSnapshot(qRequested, (snap) => {
          latestRequested = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
          console.debug('📥 Firestore pending requests loaded:', { count: latestRequested.length, ids: latestRequested.map(r => r.id) });
          // merge accepted first, then requested, dedupe by id
          const mergedMap = new Map();
          (latestAccepted || []).forEach(i => mergedMap.set(i.id, i));
          (latestRequested || []).forEach(i => { if (!mergedMap.has(i.id)) mergedMap.set(i.id, i); });
          const merged = Array.from(mergedMap.values());
          if (mounted) {
            console.debug('🔀 Merging pending + accepted:', { pendingCount: latestRequested.length, acceptedCount: latestAccepted.length, totalMerged: merged.length });
            setRequests(merged);
            // Persist merged list to localStorage for recovery after reload/re-login
            // CRITICAL: Use hospitalId as cache key for data isolation
            try {
              const cacheKey = 'hospital_accepted_requests_' + hospitalId;
              localStorage.setItem(cacheKey, JSON.stringify(latestAccepted || []));
              console.debug('💾 Cached accepted requests (data isolation):', { cacheKey, count: latestAccepted.length });
            } catch (e) {
              console.debug('Failed to cache accepted requests', e);
            }
          }
        }, (err) => {
          console.error('❌ donor_offers requested onSnapshot error', err);
        });

        unsubAccepted = onSnapshot(qAccepted, (snap) => {
          console.debug('📨 Firestore accepted query callback triggered (DATA ISOLATED TO HOSPITAL):', { hospitalId });
          latestAccepted = snap.docs.map(d => {
            const data = d.data() || {};
            console.debug('  📄 Accepted offer from Firestore (for this hospital):', {
              id: d.id,
              hospitalId: data.hospitalId,
              status: data.status,
              donorName: data.donorName,
              bloodType: data.bloodType,
              acceptedAt: data.acceptedAt,
            });
            return { id: d.id, ...data };
          });
          console.debug(`📊 Total accepted offers from query (data isolated): ${latestAccepted.length}`, {
            count: latestAccepted.length,
            ids: latestAccepted.map(r => r.id),
            hospitalId,
          });
          // merge accepted first, then requested, dedupe by id
          const mergedMap = new Map();
          (latestAccepted || []).forEach(i => mergedMap.set(i.id, i));
          (latestRequested || []).forEach(i => { if (!mergedMap.has(i.id)) mergedMap.set(i.id, i); });
          const merged = Array.from(mergedMap.values());
          if (mounted) {
            console.debug('🔀 Merging accepted + pending (data isolated):', { acceptedCount: latestAccepted.length, pendingCount: latestRequested.length, totalMerged: merged.length });
            setRequests(merged);
            // Persist accepted offers to localStorage for recovery after reload/re-login
            // CRITICAL: Use hospitalId as cache key for data isolation
            try {
              const cacheKey = 'hospital_accepted_requests_' + hospitalId;
              localStorage.setItem(cacheKey, JSON.stringify(latestAccepted || []));
              console.debug('💾 Saved to localStorage (data isolation):', { cacheKey, count: latestAccepted.length, hospitalId });
            } catch (e) {
              console.error('❌ Failed to cache accepted requests:', e);
            }
          }
        }, (err) => {
          console.error('❌ donor_offers accepted onSnapshot error (DATA ISOLATION):', err, { hospitalId });
          // On subscription error, try loading from localStorage
          try {
            const cached = localStorage.getItem('hospital_accepted_requests_' + hospitalId);
            if (cached && mounted) {
              const parsed = JSON.parse(cached);
              console.warn('⚠️ Firestore subscription failed, loading from cache (data isolation):', { count: parsed.length, hospitalId });
              setRequests(parsed);
            }
          } catch (e) {
            console.error('❌ Failed to load cached requests on error:', e);
          }
        });

      } catch (e) {
        console.debug('Failed to subscribe to requests in Firestore', e);
        // On error, try loading from localStorage
        try {
          const user = getCurrentUser('hospital');
          const uid = user?.uid || user?.id || null;
          const emailKey = (user?.email || '').replace(/[@.]/g, '_');
          let hospitalId = uid || emailKey;
          try {
            const storedId = localStorage.getItem('current_hospital_id');
            if (storedId) {
              hospitalId = storedId;
            }
          } catch (e) {}
          
          const cached = localStorage.getItem('hospital_accepted_requests_' + hospitalId);
          if (cached && mounted) {
            const parsed = JSON.parse(cached);
            setRequests(parsed);
            console.debug('Loaded accepted requests from cache after Firestore error (data isolation):', { count: parsed.length, hospitalId });
          }
        } catch (cacheErr) {
          console.debug('Failed to load from cache', cacheErr);
        }
      }
    })();
    return () => { mounted = false; if (unsubRequested) unsubRequested(); if (unsubAccepted) unsubAccepted(); };
  }, [authStatus]);

  // Merge cached accepted requests with current requests to ensure they display after reload
  // Uses the stored hospitalId for data isolation
  useEffect(() => {
    if (authStatus !== 'allowed') {
      console.debug('🚫 Cache merge skipped: authStatus is not "allowed"', { authStatus });
      return;
    }
    
    let mounted = true;
    (async () => {
      try {
        const user = getCurrentUser('hospital');
        if (!user) {
          console.debug('🚫 Cache merge skipped: no user');
          return;
        }
        const uid = user?.uid || user?.id || null;
        const emailKey = (user?.email || '').replace(/[@.]/g, '_');
        const computedHospitalId = uid || emailKey;
        
        // CRITICAL: Use the stored hospitalId that was fetched from hospitals collection
        let hospitalId = computedHospitalId;
        try {
          const storedId = localStorage.getItem('current_hospital_id');
          if (storedId) {
            hospitalId = storedId;
            console.debug('✅ Cache merge using stored hospitalId:', hospitalId);
          }
        } catch (e) {
          console.error('Failed to retrieve stored hospitalId:', e);
        }
        
        console.debug('🔍 Cache merge starting (data isolation):', { uid, emailKey, hospitalId });
        
        // Load cached accepted requests using the hospital's ID
        const cached = localStorage.getItem('hospital_accepted_requests_' + hospitalId);
        if (!cached) {
          console.debug('⚠️ No cached accepted requests found for:', hospitalId);
          return;
        }
        
        try {
          const cachedAccepted = JSON.parse(cached);
          console.debug('📥 Loaded cached accepted requests (data isolated):', {
            count: cachedAccepted.length,
            hospitalId,
            ids: cachedAccepted.map(r => r.id),
            sample: cachedAccepted.length > 0 ? { id: cachedAccepted[0].id, status: cachedAccepted[0].status, hospitalId: cachedAccepted[0].hospitalId, donorName: cachedAccepted[0].donorName } : null,
          });
          
          if (!mounted) return;
          
          // Merge cached accepted requests with current requests
          // Keep all pending requests, add cached accepted ones
          // CRITICAL: Only add cached requests that belong to this hospital
          setRequests(prev => {
            const mergedMap = new Map();
            // First add all pending requests
            prev.forEach(r => {
              const status = (r.status || '').toString().toLowerCase();
              if (status === 'requested' || status === 'pending') {
                mergedMap.set(r.id, r);
              }
            });
            // Then add cached accepted ones (only those belonging to this hospital)
            cachedAccepted.forEach(r => {
              if (r.hospitalId === hospitalId) {
                mergedMap.set(r.id, r);
              } else {
                console.warn('⚠️ Skipping cached request from different hospital:', { requestHospitalId: r.hospitalId, currentHospitalId: hospitalId });
              }
            });
            
            const merged = Array.from(mergedMap.values());
            console.debug('🔀 Merged cache with current state (data isolation):', {
              beforeCount: prev.length,
              pendingKept: Array.from(mergedMap.values()).filter(r => (r.status || '').toString().toLowerCase() !== 'accepted').length,
              acceptedAdded: cachedAccepted.filter(r => r.hospitalId === hospitalId).length,
              afterCount: merged.length,
              hospitalId,
            });
            return merged;
          });
        } catch (e) {
          console.error('❌ Failed to parse cached accepted requests:', e);
        }
      } catch (e) {
        console.error('❌ Failed to merge cached requests:', e);
      }
    })();
    
    return () => { mounted = false; };
  }, [authStatus]);

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
                className="w-full px-3 py-2 border border-gray-200 text-red-500 rounded-lg"
              />
            </div>
            <div className="space-y-3">
                {requests.filter(isAcceptedAndNotYetReached).filter(r => {
                if (!acceptedSearch) return true;
                const q = acceptedSearch.toLowerCase();
                return (r.donor || '').toLowerCase().includes(q) || (r.bloodType || '').toLowerCase().includes(q) || (r.id||'').toLowerCase().includes(q);
              }).map((r) => (
                <button
                  key={r.id}
                  onClick={() => openAcceptedModal(r)}
                  className="p-3 bg-white rounded-lg border border-gray-100 text-left w-full hover:shadow-sm"
                  title={`Open request ${r.id} details`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {(() => {
                        const merged = (r && r.bookingId && bookingCache && bookingCache[r.bookingId]) ? { ...(r || {}), ...(bookingCache[r.bookingId] || {}) } : r;
                        return (
                          <>
                            <div className="font-medium text-gray-900">{merged.donorName || merged.donor || `Request ${merged.id}`}</div>

                            <div className="mt-2 text-xs text-gray-500">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span>{formatScheduledDateTime(merged)}</span>
                              </div>

                              <div className="mt-1 text-xs text-gray-500">
                                <strong>Amount:</strong> {merged.quantity || merged.qty || 1}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </button>
              ))}
              
              {/* Past accepted requests removed per UI change request */}
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
              <div className="p-4 rounded-xl bg-red-50 border"> <div className="text-xs text-gray-700">Accepted Requests</div> <div className="text-2xl font-bold text-red-600">{requests.filter(isAcceptedAndNotYetReached).length}</div> </div>
              <div className="p-4 rounded-xl bg-red-50 border"> <div className="text-xs text-gray-700">Notifications</div> <div className="text-2xl font-bold text-red-600">{notifications.length}</div> </div>
            </div>

            <div className="mt-6">
              <h4 className="text-lg font-semibold text-red-600">Incoming Requests</h4>
              <div className="mt-3 grid gap-3">
                {pendingRequests.map((r) => (
                  <div key={r.id} className="p-3 bg-red-50 rounded-lg border border-red-50 text-red-600">
                    <div className="flex items-center justify-between">
                      <div>
                          <div className="font-medium">{r.donorName || r.donor || `Request ${r.id}`}</div>

                          <div className="mt-2 text-xs text-gray-500">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span>{formatScheduledDateTime(r)}</span>
                            </div>

                            <div className="mt-1 text-xs text-gray-500">
                              <strong>Amount:</strong> {r.quantity || r.qty || 1}
                            </div>
                          </div>
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
                      <button onClick={enableGeolocation} className="w-full px-3 py-2 rounded bg-white border border-gray-500 mb-2 text-red-600">Enable location</button>
                    </div>
                </div>
              )}
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
                                          const user = getCurrentUser('hospital');
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

          {/* Accepted Request Details Modal */}
          {showAcceptedModal && selectedAcceptedRequest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => { setShowAcceptedModal(false); setSelectedAcceptedRequest(null); }} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-red-600">Request details</h3>
                  <button onClick={() => { setShowAcceptedModal(false); setSelectedAcceptedRequest(null); }} className="text-gray-500">Close</button>
                </div>

                <div className="space-y-3 text-sm text-gray-700">
                  {/* Show booking/appointment details when available */}
                  {selectedBooking ? (
                    <div className="mt-2 p-3 bg-gray-50 rounded-md border">
                      <div><strong>Appointment:</strong> {formatScheduledDateTime(selectedBooking)}</div>
                      {selectedBooking.donorName && <div><strong>Donor:</strong> {selectedBooking.donorName}</div>}
                      {selectedBooking.quantity && <div><strong>Quantity:</strong> {selectedBooking.quantity}</div>}
                      {selectedBooking.bloodType && <div><strong>Blood type:</strong> {selectedBooking.bloodType}</div>}
                      {getBookingLocationString(selectedBooking) ? (
                            <div><strong>Location:</strong> {getBookingLocationString(selectedBooking)}</div>
                          ) : null}

                      {/* Small map preview when numeric coords are present */}
                      {(() => {
                        const c = getBookingCoords(selectedBooking);
                        if (!c) return null;
                        const left = c.lon - 0.01;
                        const bottom = c.lat - 0.01;
                        const right = c.lon + 0.01;
                        const top = c.lat + 0.01;
                        const bbox = encodeURIComponent(`${left},${bottom},${right},${top}`);
                        const marker = encodeURIComponent(`${c.lat},${c.lon}`);
                        const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
                        return (
                          <div className="mt-2 rounded overflow-hidden border">
                            <iframe title="booking-map" src={src} className="w-full h-36" />
                          </div>
                        );
                      })()}
                    </div>
                  ) : selectedAcceptedRequest.bookingId ? (
                    <div className="text-sm text-gray-500 mt-2">Loading booking details…</div>
                  ) : null}
                </div>

                <div className="flex items-center justify-end gap-2 mt-4">
                  <button onClick={() => { setShowAcceptedModal(false); setSelectedAcceptedRequest(null); }} className="px-4 py-2 rounded-lg bg-white text-red-600 border">Close</button>
                  <button onClick={() => { if (selectedAcceptedRequest && selectedAcceptedRequest.status !== 'fulfilled') { markFulfilled(selectedAcceptedRequest.id); } }} className="px-4 py-2 rounded-lg bg-green-600 text-white">Mark fulfilled</button>
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