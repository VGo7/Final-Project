"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Home, Check, X, LogOut, Bell } from "lucide-react";
import { signOut } from '@/utils/auth';

export default function AdminLanding() {
  const router = useRouter();

  // sample pending hospitals and donors (simulated)
  const [hospitals, setHospitals] = useState([
    { id: 'h1', name: 'City Hospital', address: '123 Main St', verified: 'pending' },
    { id: 'h2', name: 'Northside Clinic', address: '45 North Ave', verified: 'pending' },
  ]);

  const [donors, setDonors] = useState([
    { id: 'd1', name: 'Alex Donor', bloodType: 'O+', eligible: 'pending' },
    { id: 'd2', name: 'Sam Giver', bloodType: 'A-', eligible: 'pending' },
  ]);

  const [notifications, setNotifications] = useState([
    { id: 1, text: 'New hospital registration: City Hospital' },
    { id: 2, text: 'New donor application: Alex Donor' },
  ]);

  const [actionLoading, setActionLoading] = useState(null);

  function handleLogout() {
    try { signOut(); } catch (e) {}
    router.push('/signin');
  }

  async function acceptHospital(id) {
    setActionLoading(id);
    await new Promise((r) => setTimeout(r, 600));
    setHospitals((s) => s.map(h => h.id === id ? { ...h, verified: 'accepted' } : h));
    setNotifications((n) => [{ id: Date.now(), text: `Hospital ${id} accepted` }, ...n]);
    setActionLoading(null);
  }

  async function denyHospital(id) {
    setActionLoading(id);
    await new Promise((r) => setTimeout(r, 600));
    setHospitals((s) => s.map(h => h.id === id ? { ...h, verified: 'denied' } : h));
    setNotifications((n) => [{ id: Date.now(), text: `Hospital ${id} denied` }, ...n]);
    setActionLoading(null);
  }

  async function acceptDonor(id) {
    setActionLoading(id);
    await new Promise((r) => setTimeout(r, 600));
    setDonors((s) => s.map(d => d.id === id ? { ...d, eligible: 'accepted' } : d));
    setNotifications((n) => [{ id: Date.now(), text: `Donor ${id} accepted` }, ...n]);
    setActionLoading(null);
  }

  async function denyDonor(id) {
    setActionLoading(id);
    await new Promise((r) => setTimeout(r, 600));
    setDonors((s) => s.map(d => d.id === id ? { ...d, eligible: 'denied' } : d));
    setNotifications((n) => [{ id: Date.now(), text: `Donor ${id} denied` }, ...n]);
    setActionLoading(null);
  }

  const pendingHospitals = hospitals.filter(h => h.verified === 'pending');
  const pendingDonors = donors.filter(d => d.eligible === 'pending');

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
          {/* Left: Pending Hospitals */}
          <section className="bg-white rounded-3xl p-4 shadow-sm lg:col-span-1">
            <h4 className="font-semibold mb-3">Pending Hospitals</h4>
            {pendingHospitals.length === 0 && <div className="text-sm text-gray-500">No hospitals pending review.</div>}
            <div className="space-y-3">
              {pendingHospitals.map((h) => (
                <div key={h.id} className="p-3 bg-red-50 rounded-lg border border-red-50 flex flex-col gap-2">
                  <div className="font-medium">{h.name}</div>
                  <div className="text-xs text-gray-500">{h.address}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => acceptHospital(h.id)} disabled={actionLoading===h.id} className="flex-1 px-3 py-2 rounded bg-green-600 text-white flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" /> Accept
                    </button>
                    <button onClick={() => denyHospital(h.id)} disabled={actionLoading===h.id} className="flex-1 px-3 py-2 rounded bg-white border border-gray-200 text-gray-700 flex items-center justify-center gap-2">
                      <X className="w-4 h-4" /> Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Center: Stats and pending donors */}
          <section className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">Overview</h3>
                <p className="text-sm text-gray-500">Quick insights and actions</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-red-50 border"> <div className="text-xs text-gray-500">Hospitals pending</div> <div className="text-2xl font-bold">{pendingHospitals.length}</div> </div>
              <div className="p-4 rounded-xl bg-red-50 border"> <div className="text-xs text-gray-500">Donors pending</div> <div className="text-2xl font-bold">{pendingDonors.length}</div> </div>
              <div className="p-4 rounded-xl bg-red-50 border"> <div className="text-xs text-gray-500">Total notifications</div> <div className="text-2xl font-bold">{notifications.length}</div> </div>
            </div>

            <div className="mt-6">
              <h4 className="text-lg font-semibold">Pending Donors</h4>
              <div className="mt-3 grid gap-3">
                {pendingDonors.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-sm text-gray-500">Blood: {d.bloodType}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => acceptDonor(d.id)} disabled={actionLoading===d.id} className="px-3 py-2 rounded bg-green-600 text-white flex items-center gap-2"><Check className="w-4 h-4" /> Accept</button>
                      <button onClick={() => denyDonor(d.id)} disabled={actionLoading===d.id} className="px-3 py-2 rounded bg-white border border-gray-200 text-gray-700 flex items-center gap-2"><X className="w-4 h-4" /> Deny</button>
                    </div>
                  </div>
                ))}
                {pendingDonors.length === 0 && <div className="text-sm text-gray-500">No donors pending review.</div>}
              </div>
            </div>
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
              <button onClick={() => { setHospitals((s)=>s); setDonors((d)=>d); }} className="w-full px-4 py-2 rounded-lg bg-red-600 text-white font-semibold">Refresh</button>
              <button onClick={() => { setNotifications([]); }} className="w-full px-4 py-2 rounded-lg bg-white border border-gray-200">Clear notifications</button>
            </div>

            <div className="mt-auto text-sm text-gray-500">
              <div className="font-medium text-gray-700 mb-1">Last action</div>
              <div className="p-3 bg-white rounded-lg border border-gray-100">{notifications[0]?.text ?? 'No recent actions'}</div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
