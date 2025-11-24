"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Home, Check, X, LogOut, Bell, MapPin, Calendar, Heart } from "lucide-react";
import { signOut } from '@/utils/auth';

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

  const [actionLoading, setActionLoading] = useState(null);
  const [coords, setCoords] = useState(null);

  function handleLogout() {
    try { signOut(); } catch (e) {}
    router.push('/signin');
  }

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

  const pendingRequests = requests.filter(r => r.status === 'pending');

  return (
    <div className="min-h-screen bg-linear-to-br from-white via-red-50 to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
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
            <h4 className="font-semibold mb-3">Incoming Requests</h4>
            {pendingRequests.length === 0 && <div className="text-sm text-gray-500">No pending requests.</div>}
            <div className="space-y-3">
              {pendingRequests.map((r) => (
                <div key={r.id} className="p-3 bg-red-50 rounded-lg border border-red-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.donor}</div>
                      <div className="text-xs text-gray-500">Blood: {r.bloodType} • Qty: {r.quantity}</div>
                      <div className="text-xs text-gray-500">{r.location}</div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => acceptRequest(r.id)} disabled={actionLoading===r.id} className="px-3 py-2 rounded bg-green-600 text-white flex items-center gap-2"><Check className="w-4 h-4" />Accept</button>
                      <button onClick={() => denyRequest(r.id)} disabled={actionLoading===r.id} className="px-3 py-2 rounded bg-white border border-gray-200 text-gray-700 flex items-center gap-2"><X className="w-4 h-4" />Deny</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">Overview</h3>
                <p className="text-sm text-gray-500">Requests, drives and quick actions</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={shareNeeds} className="px-3 py-2 rounded bg-red-600 text-white">Share Needs</button>
                <button onClick={requestPickup} className="px-3 py-2 rounded bg-white border">Request Pickup</button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-red-50 border"> <div className="text-xs text-gray-500">Pending Requests</div> <div className="text-2xl font-bold">{pendingRequests.length}</div> </div>
              <div className="p-4 rounded-xl bg-red-50 border"> <div className="text-xs text-gray-500">Upcoming Drives</div> <div className="text-2xl font-bold">{drives.length}</div> </div>
              <div className="p-4 rounded-xl bg-red-50 border"> <div className="text-xs text-gray-500">Notifications</div> <div className="text-2xl font-bold">{notifications.length}</div> </div>
            </div>

            <div className="mt-6">
              <h4 className="text-lg font-semibold">Active Drives</h4>
              <div className="mt-3 grid gap-3">
                {drives.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-sm text-gray-500">Date: {d.date} • Slots: {d.slots}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setDrives(ds => ds.filter(x => x.id !== d.id))} className="px-3 py-2 rounded bg-white border">End</button>
                      <button onClick={() => setDrives(ds => ds.map(x => x.id===d.id?{...x, slots: Math.max(0,x.slots-1)}:x))} className="px-3 py-2 rounded bg-red-600 text-white">Use Slot</button>
                    </div>
                  </div>
                ))}
                {drives.length === 0 && <div className="text-sm text-gray-500">No upcoming drives.</div>}
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
              <button onClick={enableGeolocation} className="w-full px-4 py-2 rounded-lg bg-red-600 text-white font-semibold">Enable Geolocation</button>
              <button onClick={() => setRequests(r => [{ id: `r${Date.now()}`, donor: 'New Donor', bloodType: 'B+', quantity:1, status:'pending', location:'Nearby' }, ...r])} className="w-full px-4 py-2 rounded-lg bg-white border">Simulate Request</button>
            </div>

            <div className="mt-2">
              <h5 className="text-sm font-medium">Map preview</h5>
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
      </div>
    </div>
  );
}
