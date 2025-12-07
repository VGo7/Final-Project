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
  Check,
  X,
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

  // Requests loaded from Firestore for this donor (replaces local `recent` list)

  // profile fetched from Firestore (full name and blood type)
  const [fullName, setFullName] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [verified, setVerified] = useState(false);
  const [profilePhone, setProfilePhone] = useState('');

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
            setProfilePhone('');
            return;
          }

          try {
            const snap = await getDoc(doc(fb.db, 'users', user.uid));
            if (snap && snap.exists()) {
              const data = snap.data() || {};
              const name = data.name || data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || user.email || '';
              setFullName(name);
              setBloodType(data.bloodType || data.blood || '');
              setProfilePhone(data.phone || data.mobile || data.contact || '');
              setVerified(Boolean(data.verified));
            } else {
              setFullName('');
              setBloodType('');
              setProfilePhone('');
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
    let unsubHospitalOffers = null;
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
              const donorItems = snap.docs.map(d => ({ id: d.id, origin: 'donor', ...(d.data() || {}) }));
              // merge with any hospital_offers we have from another snapshot
              if (mounted) setRequests(prev => {
                const prevHosp = (prev || []).filter(p => p.origin === 'hospital');
                return [...donorItems, ...prevHosp];
              });
            }, (err) => {
              console.error('donor_offers onSnapshot error', err);
            });

            // also subscribe to public hospital requests so donors can see them
            const qHosp = query(collection(fb.db, 'hospital_offers'), where('status', '==', 'requested'), orderBy('createdAt', 'desc'));
            if (typeof unsubHospitalOffers === 'function') unsubHospitalOffers();
            unsubHospitalOffers = onSnapshot(qHosp, (snap) => {
              const hospItems = snap.docs.map(d => ({ id: d.id, origin: 'hospital', ...(d.data() || {}) }));
              if (mounted) setRequests(prev => {
                const prevDonor = (prev || []).filter(p => p.origin === 'donor');
                return [...prevDonor, ...hospItems];
              });
            }, (err) => {
              console.error('hospital_offers onSnapshot error', err);
            });

            // bookings for this donor
            const qBookings = query(collection(fb.db, 'bookings'), where('donorId', '==', uid));
            if (typeof unsubBookings === 'function') unsubBookings();
            unsubBookings = onSnapshot(qBookings, (snap) => {
              const items = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }))
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
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
      try { if (typeof unsubHospitalOffers === 'function') unsubHospitalOffers(); } catch (e) {}
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

    // Accept a hospital request (hospital_offers) and create an h_bookings entry
    async function acceptHospitalOffer(id) {
      if (!id) return;
      setBookingError('');
      setBookingSuccess('');
      setBookingLoading(true);
      try {
        if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
          setBookingError('Firebase not configured');
          setBookingLoading(false);
          return;
        }
        const fb = await initFirebase();
        if (!fb || !fb.db || !fb.auth) {
          setBookingError('Firebase unavailable');
          setBookingLoading(false);
          return;
        }
        const user = fb.auth.currentUser;
        const uid = user?.uid || null;
        const { doc, runTransaction, serverTimestamp, collection, addDoc } = await import('firebase/firestore');
        const offerRef = doc(fb.db, 'hospital_offers', id);

        const result = await runTransaction(fb.db, async (tx) => {
          const snap = await tx.get(offerRef);
          if (!snap.exists()) throw new Error('offer-not-found');
          const offer = snap.data() || {};
          const status = (offer.status || '').toString().toLowerCase();
          if (status && status !== 'requested' && status !== 'pending') throw new Error('already-processed');

          const bookingsRef = collection(fb.db, 'h_bookings');
          const newBookingRef = doc(bookingsRef);
          const booking = {
            donorId: uid,
            donorName: fullName || null,
            hospitalId: offer.hospitalId || null,
            hospitalName: offer.hospitalName || null,
            hospitalOfferId: id,
            date: offer.requestedDate || null,
            slot: offer.requestedSlot || null,
            quantity: Number(offer.quantity) || 1,
            bloodType: offer.bloodType || null,
            status: 'booked',
            createdAt: serverTimestamp(),
          };

          tx.set(newBookingRef, booking);
          tx.update(offerRef, {
            status: 'accepted',
            acceptedAt: serverTimestamp(),
            donorId: uid,
            donorName: fullName || null,
            bookingId: newBookingRef.id,
          });

          return { bookingId: newBookingRef.id, booking };
        });

        try {
          const notifsRef = collection(fb.db, 'notifications');
          await addDoc(notifsRef, {
            recipientId: (result && result.booking && result.booking.hospitalId) || null,
            type: 'hospital_request_accepted',
            hospitalOfferId: id,
            bookingId: result.bookingId,
            message: `${fullName || 'A donor'} accepted your request`,
            createdAt: serverTimestamp(),
            read: false,
          });
        } catch (e) {
          console.error('Failed to notify hospital', e);
        }

        // update local list
        setRequests(prev => (prev || []).map(r => r.id === id ? { ...(r || {}), status: 'accepted', donorId: uid, donorName: fullName, bookingId: result.bookingId } : r));
        setBookingSuccess('You accepted the request — appointment created');
      } catch (err) {
        console.error('acceptHospitalOffer error', err);
        setBookingError(err?.message || 'Failed to accept request');
      } finally {
        setBookingLoading(false);
      }
    }

    // Deny a hospital request (hospital_offers) — mark as denied and notify hospital
    async function denyHospitalOffer(id) {
      if (!id) return;
      setBookingError('');
      setBookingSuccess('');
      setBookingLoading(true);
      try {
        if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
          setBookingError('Firebase not configured');
          setBookingLoading(false);
          return;
        }
        const fb = await initFirebase();
        if (!fb || !fb.db || !fb.auth) {
          setBookingError('Firebase unavailable');
          setBookingLoading(false);
          return;
        }
        const user = fb.auth.currentUser;
        const uid = user?.uid || null;
        const { doc, updateDoc, serverTimestamp, getDoc, collection, addDoc } = await import('firebase/firestore');
        const offerRef = doc(fb.db, 'hospital_offers', id);

        // read existing offer to get hospitalId for notification
        let offer = null;
        try {
          const snap = await getDoc(offerRef);
          offer = snap.exists() ? (snap.data() || {}) : null;
        } catch (e) {
          console.debug('Could not read hospital offer before denying', e);
        }

        await updateDoc(offerRef, {
          status: 'denied',
          deniedAt: serverTimestamp(),
          donorId: uid,
          donorName: fullName || null,
        });

        // notify hospital user (if hospitalId present)
        try {
          const notifsRef = collection(fb.db, 'notifications');
          await addDoc(notifsRef, {
            recipientId: (offer && offer.hospitalId) || null,
            type: 'hospital_request_denied',
            hospitalOfferId: id,
            message: `${fullName || 'A donor'} denied your request`,
            createdAt: serverTimestamp(),
            read: false,
          });
        } catch (e) {
          console.error('Failed to notify hospital after denial', e);
        }

        // update local list
        setRequests(prev => (prev || []).map(r => r.id === id ? { ...(r || {}), status: 'denied', donorId: uid, donorName: fullName } : r));
        setBookingSuccess('You denied the request');
      } catch (err) {
        console.error('denyHospitalOffer error', err);
        setBookingError(err?.message || 'Failed to deny request');
      } finally {
        setBookingLoading(false);
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
      if (!isNaN(d.getTime())) return d;
    } catch (e) {}
    return null;
  }

  // Return a friendly date/time string for a request (falls back to raw fields)
  function formatScheduledDateTime(r) {
    if (!r) return 'Unscheduled';
    try {
      const raw = r.requestedDate || r.date || null;
      if (raw) {
        if (typeof raw.toDate === 'function') return raw.toDate().toLocaleString();
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d.toLocaleString();
        return String(raw);
      }
      const parts = [];
      if (r.requestedSlot) parts.push(String(r.requestedSlot));
      if (r.slot) parts.push(String(r.slot));
      return parts.length ? parts.join(' • ') : 'Unscheduled';
    } catch (e) {
      return 'Unscheduled';
    }
  }

  // Safely format location-like fields so we don't render raw objects into JSX
  function formatLocationField(v) {
    if (!v) return '';
    try {
      if (typeof v === 'object') {
        const lat = v.lat ?? v.latitude ?? v.latDegrees;
        const lon = v.lon ?? v.lng ?? v.longitude ?? v.lonDegrees;
        if (typeof lat === 'number' && typeof lon === 'number') {
          return `Lat ${lat.toFixed(5)}, Lon ${lon.toFixed(5)}`;
        }
        return Object.keys(v).length ? JSON.stringify(v) : '';
      }
      return String(v);
    } catch (e) {
      return '';
    }
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

  // Force Next Drive to always display 'None' so it's unaffected by data
  const nextDrive = 'None';

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

  // Modal for booking with extra donation details
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [modalSlot, setModalSlot] = useState('09:00');
  const [modalBloodType, setModalBloodType] = useState(bloodType || '');
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalPhone, setModalPhone] = useState('');
  const [modalWeight, setModalWeight] = useState('');
  const [modalLastDonation, setModalLastDonation] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [modalDob, setModalDob] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [attachLocation, setAttachLocation] = useState(false);
  const [modalLocation, setModalLocation] = useState(null);
  const [locationError, setLocationError] = useState('');

  // Autofill modal fields from profile when available (don't override user edits)
  useEffect(() => {
    if (profilePhone && !modalPhone) setModalPhone(profilePhone);
    if (bloodType && !modalBloodType) setModalBloodType(bloodType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilePhone, bloodType]);

  async function submitModalBooking(e) {
    e?.preventDefault?.();
    setBookingError('');
    setBookingLoading(true);
    console.debug('submitModalBooking start', { modalDate, modalSlot, modalBloodType, modalQuantity, modalPhone, modalWeight, modalLastDonation, modalDob, attachLocation, modalLocation });
    // If Firebase env not configured, inform the user explicitly
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      setBookingError('Firebase not configured in this environment — request cannot be sent to hospitals.');
      console.warn('submitModalBooking aborted: NEXT_PUBLIC_FIREBASE_API_KEY not set');
      setBookingLoading(false);
      return;
    }
    try {
      // client-side validation according to donation requirements
      setFieldErrors({});
      const errors = {};
      const today = new Date();
      if (!modalDate) errors.date = 'Please select a donation date.';
      else {
        const sel = new Date(modalDate + 'T00:00:00');
        if (sel < new Date(today.toDateString())) errors.date = 'Donation date cannot be in the past.';
      }
      // DOB / age check (must be >=18)
      if (!modalDob) errors.dob = 'Please enter your date of birth.';
      else {
        const dob = new Date(modalDob);
        if (isNaN(dob)) errors.dob = 'Invalid date of birth.';
        else {
          const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          if (age < 18) errors.dob = 'You must be at least 18 years old to donate.';
        }
      }
      // weight
      const weightNum = Number(modalWeight || 0);
      if (!modalWeight || isNaN(weightNum)) errors.weight = 'Please enter your weight.';
      else if (weightNum < 50) errors.weight = 'Minimum weight to donate is 50 kg.';
      // quantity
      const qtyNum = Number(modalQuantity || 0);
      if (!qtyNum || isNaN(qtyNum) || qtyNum < 1) errors.quantity = 'Quantity must be at least 1 unit.';
      // phone
      const phoneRe = /^\+?[0-9\s\-]{7,20}$/;
      if (!modalPhone || !phoneRe.test(modalPhone)) errors.phone = 'Enter a valid phone number.';
      // blood type
      const btRe = /^(A|B|AB|O)[+-]$/i;
      if (!modalBloodType || !btRe.test(modalBloodType)) errors.bloodType = 'Enter a blood type like O+, A-, AB+.';
      // last donation interval (minimum 56 days)
      if (modalLastDonation) {
        const last = new Date(modalLastDonation);
        if (!isNaN(last) && modalDate) {
          const sel = new Date(modalDate + 'T00:00:00');
          const diffDays = Math.floor((sel - last) / (24 * 60 * 60 * 1000));
          if (diffDays < 56) errors.lastDonation = 'At least 56 days must pass since your last donation.';
        }
      }
      // location: if user requested to attach location, ensure we have coords
      if (attachLocation && !modalLocation) {
        errors.location = 'Unable to obtain your current location. Please allow location access or uncheck the option.';
      }

      if (Object.keys(errors).length) {
        setFieldErrors(errors);
        setBookingLoading(false);
        return;
      }
      if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        const fb = await initFirebase();
        if (fb && fb.db && fb.auth) {
          const user = fb.auth.currentUser;
          const uid = user?.uid || null;
          const { collection, addDoc, serverTimestamp, query, where, getDocs } = await import('firebase/firestore');

          // create a donor_offers document representing this request that hospitals can accept/deny
          const offerPayload = {
            donorId: uid,
            donorName: fullName || null,
            phone: modalPhone || null,
            bloodType: modalBloodType || null,
            quantity: Number(qtyNum) || 1,
            weightKg: Number(weightNum) || null,
            lastDonationDate: modalLastDonation || null,
            dob: modalDob || null,
            location: modalLocation || null,
            notes: modalNotes || null,
            requestedDate: modalDate,
            requestedSlot: modalSlot,
            status: 'requested',
            createdAt: serverTimestamp(),
          };

          const offersRef = collection(fb.db, 'donor_offers');
          const offerDoc = await addDoc(offersRef, offerPayload);
          const offerId = offerDoc.id;

          // notify all hospital users so they can accept/deny this request
          try {
            const usersRef = collection(fb.db, 'users');
            const qHosp = query(usersRef, where('role', '==', 'hospital'));
            const snaps = await getDocs(qHosp);
            const notifRef = collection(fb.db, 'notifications');
            snaps.forEach(async (u) => {
              try {
                await addDoc(notifRef, {
                  recipientId: u.id,
                  type: 'donor_request',
                  donorOfferId: offerId,
                  message: `New donor request from ${fullName || 'a donor'}`,
                  createdAt: serverTimestamp(),
                  read: false,
                });
              } catch (e) {
                console.error('failed to create notification for hospital', u.id, e);
              }
            });
          } catch (e) {
            console.error('failed to notify hospitals', e);
          }

          setBookingSuccess('Request sent to hospitals');
          setShowBookingModal(false);
          // clear modal fields
          setModalQuantity(1);
          setModalPhone('');
          setModalWeight('');
          setModalLastDonation('');
          setModalNotes('');
          setModalDob('');
          setAttachLocation(false);
          setModalLocation(null);
          setLocationError('');
          setFieldErrors({});
          return;
        }
      }

      // fallback simulated booking
      await new Promise((res) => setTimeout(res, 800));
      setBookingSuccess(`Booked ${modalDate} at ${modalSlot}`);
      setShowBookingModal(false);
    } catch (err) {
      console.error('submitModalBooking error', err);
      setBookingError('Failed to book appointment.');
    } finally {
      setBookingLoading(false);
    }
  }

  // Request and attach user's current location when toggled in the modal
  function handleAttachLocationToggle(next) {
    setLocationError('');
    if (!next) {
      setAttachLocation(false);
      setModalLocation(null);
      return;
    }
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by your browser.');
      setAttachLocation(false);
      return;
    }
    setAttachLocation(true);
    try {
      navigator.geolocation.getCurrentPosition((pos) => {
        setModalLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationError('');
      }, (err) => {
        console.error('getCurrentPosition error', err);
        setLocationError('Location permission denied or unavailable.');
        setAttachLocation(false);
        setModalLocation(null);
      }, { enableHighAccuracy: true, maximumAge: 60 * 1000 });
    } catch (e) {
      console.error('handleAttachLocationToggle error', e);
      setLocationError('Failed to obtain location.');
      setAttachLocation(false);
      setModalLocation(null);
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
            <div className="p-4 rounded-xl border border-gray-100 max-h-[40vh] md:max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
              <h5 className="font-semibold mb-2 text-red-600">Incoming appointments</h5>
              <p className="text-xs text-gray-500 mb-3">Your accepted appointments by hospitals.</p>
              {(() => {
                // Merge accepted items and prioritize hospital-origin accepted requests
                const acceptedBookings = bookings.filter(b => (b.status || '').toString().toLowerCase() === 'accepted');
                const acceptedFromRequests = requests.filter(r => (r.status || '').toString().toLowerCase() === 'accepted');
                const hospitalAccepted = acceptedFromRequests.filter(r => (r.origin || '').toString().toLowerCase() === 'hospital');
                const otherAcceptedRequests = acceptedFromRequests.filter(r => (r.origin || '').toString().toLowerCase() !== 'hospital');
                // Order: hospital-origin accepted requests first, then bookings, then other accepted requests.
                const mergedAccepted = [
                  ...hospitalAccepted,
                  ...acceptedBookings.filter(b => !hospitalAccepted.some(h => h.id === b.donorOfferId)),
                  ...otherAcceptedRequests.filter(r => !acceptedBookings.some(b => b.donorOfferId === r.id) && !hospitalAccepted.some(h => h.id === r.id)),
                ];

                if (mergedAccepted.length === 0) {
                  return <div className="text-sm text-gray-500">No accepted appointments yet.</div>;
                }

                return (
                  <div className="space-y-3">
                    {mergedAccepted.map((b) => {
                      // b may be a booking (has donorOfferId/hospitalName) or a request (has requestedDate/requestedSlot)
                      // Check for requestedDate first (donor_offers), then appointmentDate (bookings), then date
                      const rawDate = b.requestedDate || b.appointmentDate || b.date;
                      const d = parseDateField(rawDate) || null;
                      const slot = b.requestedSlot || b.appointmentSlot || b.slot || '';
                      // Format the date - use parsed date if available, otherwise use raw string value
                      const dateStr = d ? d.toLocaleDateString() : (rawDate || '—');
                      const timeStr = slot ? String(slot) : '';
                      const hospitalName = b.hospitalName || b.hospital || b.location || b.acceptedBy?.email || 'Hospital';
                      return (
                        <div key={b.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                              <Calendar className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{hospitalName}</div>
                              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{dateStr}</span>
                                {timeStr && <span className="inline-flex items-center gap-1">{timeStr}</span>}
                              </div>
                              {b.bloodType && <div className="text-xs text-gray-600 mt-2">Blood: {b.bloodType} • Qty: {b.quantity || 1}</div>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
                    {requests.filter(r => (r.status || '').toString().toLowerCase() !== 'accepted').map((r) => (
                      r.origin === 'hospital' ? (
                        <div key={r.id} className="p-3 bg-red-50 rounded-lg border border-red-50 text-red-600">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{r.hospitalName || r.title || `Request ${r.id}`}</div>

                              <div className="mt-2 text-xs text-gray-500">
                                <div className="flex items-center gap-2">
                                    {(() => {
                                      const sched = formatScheduledDateTime(r);
                                      if (!sched || sched === 'Unscheduled') {
                                        return (
                                          <span className="inline-flex items-center gap-2 px-2 py-1 rounded bg-red-600 text-white text-xs font-medium">Urgent</span>
                                        );
                                      }
                                      return (
                                        <>
                                          <Calendar className="w-4 h-4 text-gray-400" />
                                          <span>{sched}</span>
                                        </>
                                      );
                                    })()}
                                  </div>

                                  <div className="mt-1 text-xs text-gray-500">
                                    <strong>Blood:</strong> {r.bloodType || 'Any'} {r.quantity || r.qty ? `• Qty: ${r.quantity || r.qty || 1}` : ''}
                                  </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => acceptHospitalOffer(r.id)} disabled={bookingLoading} className="px-3 py-2 rounded bg-green-600 text-white flex items-center gap-2"><Check className="w-4 h-4" />Accept</button>
                              <button onClick={() => denyHospitalOffer(r.id)} disabled={bookingLoading} className="px-3 py-2 rounded bg-white border border-gray-200 text-gray-700 flex items-center gap-2"><X className="w-4 h-4" />Deny</button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div key={r.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                          <div>
                            <div className="font-medium text-gray-900">{r.title || r.donor || r.hospitalName || `Request ${r.id}`}</div>
                            <div className="text-sm text-gray-500">{(formatLocationField(r.location) || r.hospital || r.message) || (r.bloodType ? `Blood: ${r.bloodType} • Qty: ${r.quantity || 1}` : '')}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-sm text-red-600">{r.status ? r.status : (r.createdAt ? new Date(r.createdAt).toLocaleString() : '')}</div>
                          </div>
                        </div>
                      )
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
              <button onClick={() => setShowBookingModal(true)} className="w-full px-4 py-2 rounded-lg bg-red-600 text-white font-semibold">Book an Appointment</button>
            </div>

            <div className="mt-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">Location</div>
                <div className="text-xs text-gray-500">{geoStatus === 'not-enabled' ? 'disabled' : geoStatus === 'fetching' ? 'requesting...' : geoStatus === 'allowed' ? 'allowed' : 'denied'}</div>
              </div>
              <div className="mt-2">
                {geoStatus !== 'allowed' && (
                  <button onClick={enableGeolocation} className="w-full px-3 py-2 rounded bg-white border border-gray-500 mb-2 text-red-600">Enable location</button>
                )}
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
              </div>
            </div>
            
          </aside>
          {showBookingModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowBookingModal(false)} />
              <form onSubmit={submitModalBooking} className="relative z-10 w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-xl font-semibold text-red-600">Book Appointment</h4>
                    <p className="text-xs text-gray-500">Provide the details below to complete your donation booking.</p>
                  </div>
                  <button type="button" onClick={() => setShowBookingModal(false)} aria-label="Close" className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                {bookingError && <div className="text-xs text-red-600 mb-2">{bookingError}</div>}
                {bookingSuccess && <div className="text-xs text-green-700 mb-2">{bookingSuccess}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600">Date <span className="text-red-600">*</span></label>
                    <input required type="date" value={modalDate} onChange={(e) => setModalDate(e.target.value)} className="w-full mt-1 p-2 border border-gray-500 text-red-600 rounded" />
                    {fieldErrors.date && <div className="text-xs text-red-600 mt-1">{fieldErrors.date}</div>}
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Time slot</label>
                    <select required value={modalSlot} onChange={(e) => setModalSlot(e.target.value)} className="w-full mt-1 p-2 border border-gray-500 text-red-600 rounded">
                      <option value="09:00">09:00</option>
                      <option value="10:00">10:00</option>
                      <option value="11:00">11:00</option>
                      <option value="13:00">13:00</option>
                      <option value="14:00">14:00</option>
                      <option value="15:00">15:00</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Blood type</label>
                    <input required value={modalBloodType} onChange={(e) => setModalBloodType(e.target.value)} placeholder="e.g. O+" className="w-full mt-1 p-2 border border-gray-500 text-red-600 rounded" />
                    {fieldErrors.bloodType && <div className="text-xs text-red-600 mt-1">{fieldErrors.bloodType}</div>}
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Quantity (units)</label>
                    <input required type="number" min={1} value={modalQuantity} onChange={(e) => setModalQuantity(Number(e.target.value || 1))} className="w-full mt-1 p-2 border border-gray-500 text-red-600 rounded" />
                    {fieldErrors.quantity && <div className="text-xs text-red-600 mt-1">{fieldErrors.quantity}</div>}
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Weight (kg)</label>
                    <input required value={modalWeight} onChange={(e) => setModalWeight(e.target.value)} placeholder="e.g. 70" className="w-full mt-1 p-2 border border-gray-500 text-red-600 rounded" />
                    {fieldErrors.weight && <div className="text-xs text-red-600 mt-1">{fieldErrors.weight}</div>}
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Date of birth</label>
                    <input required type="date" value={modalDob} onChange={(e) => setModalDob(e.target.value)} className="w-full mt-1 p-2 border border-gray-500 text-red-600 rounded" />
                    {fieldErrors.dob && <div className="text-xs text-red-600 mt-1">{fieldErrors.dob}</div>}
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Phone</label>
                    <input required value={modalPhone} onChange={(e) => setModalPhone(e.target.value)} placeholder="Mobile number" className="w-full mt-1 p-2 border border-gray-500 text-red-600 rounded" />
                    {fieldErrors.phone && <div className="text-xs text-red-600 mt-1">{fieldErrors.phone}</div>}
                  </div>

                  <div className="md:col-span-2 flex items-start gap-3">
                    <button type="button" onClick={() => handleAttachLocationToggle(!attachLocation)} className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${attachLocation ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-white border border-gray-200 text-gray-700'}`}>
                      <MapPin className="w-4 h-4" />
                      <span>{attachLocation ? 'Location attached' : 'Attach my current location'}</span>
                    </button>
                    <div className="flex flex-col">
                      {modalLocation ? (
                        <div className="text-xs text-gray-600">Attached: {modalLocation.lat.toFixed(4)}, {modalLocation.lon.toFixed(4)} <a href={`https://www.google.com/maps?q=${modalLocation.lat},${modalLocation.lon}`} target="_blank" rel="noreferrer" className="ml-2 text-xs text-blue-600 underline">Open map</a></div>
                      ) : (
                        <div className="text-xs text-gray-500">Include your coordinates to help hospitals locate you faster.</div>
                      )}
                      {locationError && <div className="text-xs text-red-600 mt-1">{locationError}</div>}
                      {fieldErrors.location && <div className="text-xs text-red-600 mt-1">{fieldErrors.location}</div>}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">Last donation date</label>
                    <input required type="date" value={modalLastDonation} onChange={(e) => setModalLastDonation(e.target.value)} className="w-full mt-1 p-2 border border-gray-500 text-red-600 rounded" />
                    {fieldErrors.lastDonation && <div className="text-xs text-red-600 mt-1">{fieldErrors.lastDonation}</div>}
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">Notes / health info</label>
                    <textarea required value={modalNotes} onChange={(e) => setModalNotes(e.target.value)} rows={3} className="w-full mt-1 p-2 border border-gray-500 text-red-600 rounded" />
                    <p className="text-xs text-gray-500 mt-1">Include any relevant health information (medications, recent travel, etc.).</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 mt-4">
                  <button type="button" onClick={() => setShowBookingModal(false)} className="px-4 py-2 rounded bg-white border border-red-600 text-red-600">Cancel</button>
                  <button type="submit" disabled={bookingLoading} className={`px-4 py-2 rounded bg-red-600 text-white font-semibold ${bookingLoading ? 'opacity-60' : 'hover:bg-red-700'}`}>
                    {bookingLoading ? 'Booking...' : 'Confirm'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
