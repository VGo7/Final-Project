"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Users, MapPin, Mail, Lock } from 'lucide-react';
import { signUp, ADMIN_EMAIL, initFirebase } from '@/utils/auth';


export default function RegisterPage() {
	const router = useRouter();
	const [role, setRole] = useState('donor');
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState('');
	const [form, setForm] = useState({
		name: '',
		email: '',
		password: '',
		confirmPassword: '',
		phone: '',
		bloodType: 'O+',
		hospitalName: '',
		hospitalAddress: '',
	});
	const [error, setError] = useState('');

	function update(field, value) {
		setForm((s) => ({ ...s, [field]: value }));
	}

	async function handleSubmit(e) {
		e.preventDefault();
		setError('');
		setSuccess('');
		
		// Basic validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!form.email || !emailRegex.test(form.email)) return setError('Please enter a valid email.');
		if (!form.password || form.password.length < 8) return setError('Password must be at least 8 characters.');
		if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
		if (role === 'donor' && !form.name) return setError('Please enter your name.');
		if (role === 'donor' && !form.phone) return setError('Please enter your phone number.');
		if (role === 'hospital' && !form.hospitalName) return setError('Please enter the hospital name.');

		// Check for reserved admin email
		if (form.email === ADMIN_EMAIL) {
			setError('That email is reserved for the admin account.');
			return;
		}

		setLoading(true);
		try {
			const profile = (role === 'donor') ? {
				name: form.name,
				phone: form.phone || '',
				bloodType: form.bloodType,
			} : {
				hospitalName: form.hospitalName,
				hospitalAddress: form.hospitalAddress || '',
				phone: form.phone || '',
			};

			// Perform sign up and wait for it to complete
			const newUser = await signUp({ email: form.email.trim(), password: form.password, role, profile });

			// If Firebase is available and this is a hospital, persist a pending hospital record and wait for it
			if (role === 'hospital') {
				try {
					const fb = await initFirebase();
					if (fb && fb.db) {
						const { doc, setDoc } = await import('firebase/firestore');
						const hospitalId = newUser?.uid || newUser?.id || (form.email || '').replace(/[@.]/g, '_');
						await setDoc(doc(fb.db, 'hospitals', hospitalId), {
							name: form.hospitalName,
							address: form.hospitalAddress || '',
							phone: form.phone || '',
							email: form.email.trim(),
							verified: 'pending',
							createdAt: new Date().toISOString(),
							uid: newUser?.uid || null,
						});
					}
				} catch (e) {
					console.error('Failed to write hospital record to Firestore', e);
					// proceed anyway — user account exists but hospital doc might have failed to persist
				}
			}

			setSuccess(`Registered as ${role} — welcome!`);
			setForm((s) => ({ ...s, password: '', confirmPassword: '' }));

			// Route after work is complete
			const targetPage = role === 'hospital' ? '/hospital-landing' : '/donor-landing';
			router.push(targetPage);
		} catch (err) {
			setError(err?.message || 'Registration failed');
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-linear-to-br from-red-50 via-white to-pink-50 py-7">
			<div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6">
				<div className="flex items-center gap-4 mb-6">
					<div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center">
						<Heart className="w-6 h-6 text-red-600" />
					</div>
					<div>
						<h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
						<p className="text-sm text-gray-500">Select whether you're a donor or a hospital to continue.</p>
					</div>
				</div>

				<div className="mb-6">
					<div className="flex items-center gap-3">
						<label className={`px-4 py-2 rounded-lg cursor-pointer border ${role === 'donor' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-200'}`}>
							<input className="sr-only" type="radio" name="role" value="donor" checked={role === 'donor'} onChange={() => setRole('donor')} />
							<div className="flex items-center gap-2">
								<Users className={`w-5 h-5 ${role === 'donor' ? 'text-white' : 'text-red-600'}`} />
								<span className="font-medium">Donor</span>
							</div>
						</label>

						<label className={`px-4 py-2 rounded-lg cursor-pointer border ${role === 'hospital' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-200'}`}>
							<input className="sr-only" type="radio" name="role" value="hospital" checked={role === 'hospital'} onChange={() => setRole('hospital')} />
							<div className="flex items-center gap-2">
								<MapPin className={`w-5 h-5 ${role === 'hospital' ? 'text-white' : 'text-red-600'}`} />
								<span className="font-medium">Hospital</span>
							</div>
						</label>
					</div>
				</div>

				<form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{error && <div className="col-span-2 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
					{success && <div className="col-span-2 text-sm text-green-700 bg-green-50 p-2 rounded">{success}</div>}

					{/* Donor fields */}
					{role === 'donor' && (
						<>
							<div className="col-span-2 text-red-600 relative">
								<label htmlFor="name" className="sr-only">Full name</label>
								<Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-600" />
								<input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Full name" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600" />
							</div>

							<div className="text-red-600 relative">
								<label htmlFor="email" className="sr-only">Email</label>
								<Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-600" />
								<input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="Email" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600" />
							</div>

							<div className="text-red-600 relative">
								<label htmlFor="phone" className="sr-only">Phone</label>
								<Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-600" />
								<input id="phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Phone" required className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600" />
							</div>

							<div className="text-red-600">
								<label htmlFor="bloodType" className="sr-only">Blood type</label>
								<select id="bloodType" value={form.bloodType} onChange={(e) => update('bloodType', e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600">
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

							<div className="col-span-2 text-red-600 relative">
								<label htmlFor="password" className="sr-only">Password</label>
								<Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-600" />
								<input id="password" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Password" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600" />
							</div>

							<div className="col-span-2 relative">
								<label htmlFor="confirmPassword" className="sr-only">Confirm Password</label>
								<Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-600" />
								<input id="confirmPassword" type="password" value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} placeholder="Confirm Password" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 text-red-600" />
							</div>
						</>
					)}

					{/* Hospital fields */}
					{role === 'hospital' && (
						<>
							<div className="col-span-2 text-red-600 relative">
								<label htmlFor="hospitalName" className="sr-only">Hospital name</label>
								<MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-600" />
								<input id="hospitalName" value={form.hospitalName} onChange={(e) => update('hospitalName', e.target.value)} placeholder="Hospital name" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600" />
							</div>

							<div className="text-red-600 relative">
								<label htmlFor="email" className="sr-only">Email</label>
								<Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-600" />
								<input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="Contact email" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600" />
							</div>

							<div className="text-red-600 relative">
								<label htmlFor="phone" className="sr-only">Phone</label>
								<Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-600" />
								<input id="phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Contact phone" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600" />
							</div>

							<div className="col-span-2 text-red-600 relative">
								<label htmlFor="password" className="sr-only">Password</label>
								<Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-600" />
								<input id="password" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Choose a password" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600" />
							</div>

							<div className="col-span-2 text-red-600 relative">
								<label htmlFor="confirmPassword" className="sr-only">Confirm Password</label>
								<Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-600" />
								<input id="confirmPassword" type="password" value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} placeholder="Confirm Password" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600" />
							</div>
						</>
					)}

					<div className="col-span-2 flex items-center justify-between mt-2">
						<div className="text-sm text-gray-600">Already have an account? <a href="/signin" className="text-red-600 font-semibold">Sign in</a></div>
						<button type="submit" disabled={loading} aria-busy={loading} className={`px-6 py-3 rounded-lg font-semibold ${loading ? 'bg-red-400 text-white' : 'bg-red-600 text-white hover:bg-red-700'}`}>
							{loading ? 'Creating...' : 'Create account'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}