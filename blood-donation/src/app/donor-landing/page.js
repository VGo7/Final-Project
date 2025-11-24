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
import { signOut } from '@/utils/auth';

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
  // notifications
  const [unreadNotifications, setUnreadNotifications] = useState(3);

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

  const stats = [
    { id: 1, label: "Donations", value: "12" },
    { id: 2, label: "Saved Lives", value: "36" },
    { id: 3, label: "Next Drive", value: "Nov 24" },
  ];

  const recent = [
    { id: 1, title: "Donation #12", desc: "City Hospital — O+", time: "2 days ago" },
    { id: 2, title: "Health Check", desc: "All clear — you’re eligible", time: "1 month ago" },
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
    setTimeout(() => {
      setBookingLoading(false);
      setBookingSuccess(`Booked ${selectedDate} at ${selectedSlot}`);
    }, 900);
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
              onClick={() => {
                // placeholder: show notifications or navigate
                setUnreadNotifications(0);
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
          {/* Booking column (left) */}
          <section className="bg-red-50 rounded-3xl p-4 shadow-sm lg:col-span-1 order-first lg:order-0">
            <div className="p-4 rounded-xl border border-red-100">
              <h5 className="font-semibold mb-2">Book a donation</h5>
              <p className="text-xs text-gray-500 mb-3">Pick a date and time to schedule your next donation.</p>
              {bookingError && <div className="text-xs text-red-600 mb-2">{bookingError}</div>}
              {bookingSuccess && <div className="text-xs text-green-700 mb-2">{bookingSuccess}</div>}
              <label className="text-xs text-gray-600">Date</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full mt-1 mb-2 p-2 border border-gray-200 rounded" />
              <label className="text-xs text-gray-600">Time slot</label>
              <select value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)} className="w-full mt-1 mb-3 p-2 border border-gray-200 rounded">
                <option value="09:00">09:00</option>
                <option value="10:00">10:00</option>
                <option value="11:00">11:00</option>
                <option value="13:00">13:00</option>
                <option value="14:00">14:00</option>
                <option value="15:00">15:00</option>
              </select>
              <button onClick={handleBooking} disabled={bookingLoading} className={`w-full px-3 py-2 rounded ${bookingLoading ? 'bg-red-400 text-white' : 'bg-red-600 text-white hover:bg-red-700'}`}>
                {bookingLoading ? 'Booking...' : 'Book donation'}
              </button>
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
                <button className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700">My Appointments</button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats.map((s) => (
                <div key={s.id} className="p-4 rounded-xl bg-red-50 border border-red-50/50 hover:scale-[1.01] transition-transform">
                  <div className="text-xs text-gray-500">{s.label}</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{s.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <h4 className="text-lg font-semibold text-gray-900">Recent Activity</h4>
              <div className="mt-3 grid gap-3">
                {recent.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                    <div>
                      <div className="font-medium text-gray-900">{r.title}</div>
                      <div className="text-sm text-gray-500">{r.desc}</div>
                    </div>
                    <div className="text-sm text-gray-400">{r.time}</div>
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
                <div className="font-semibold text-gray-900">Alex Donor</div>
                <div className="text-sm text-gray-500">O+ • Verified</div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button onClick={() => router.push('/find-drives')} className="w-full px-4 py-2 rounded-lg bg-red-600 text-white font-semibold">Find Drives</button>
              <button onClick={() => router.push('/appointments')} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-200">My Appointments</button>
            </div>

            <div className="mt-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Location</div>
                <div className="text-xs text-gray-500">{geoStatus === 'not-enabled' ? 'disabled' : geoStatus === 'fetching' ? 'requesting...' : geoStatus === 'allowed' ? 'allowed' : 'denied'}</div>
              </div>
              <div className="mt-2">
                <button onClick={enableGeolocation} className="w-full px-3 py-2 rounded bg-white border border-gray-100 mb-2">Enable location</button>
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

            <div className="mt-auto text-sm text-gray-500">
              <div className="font-medium text-gray-700 mb-1">Next appointment</div>
              <div className="p-3 bg-white rounded-lg border border-gray-100">Nov 24 • City Hospital</div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
