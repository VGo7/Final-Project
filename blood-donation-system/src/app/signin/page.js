"use client";
import React, { useState } from 'react';
import { Heart, Mail, Lock } from 'lucide-react';

export default function SignInPage() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [remember, setRemember] = useState(false);
	const [error, setError] = useState('');

	function handleSubmit(e) {
		e.preventDefault();
		setError('');
		if (!email) return setError('Please enter your email.');
		if (!password) return setError('Please enter your password.');
		// TODO: hook up real auth - currently just logs
		console.log({ email, password, remember });
		setError('');
		// simulate success
		alert('Signed in (demo)');
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-linear-to-br from-red-50 via-white to-pink-50 py-12">
			<div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8">
				<div className="flex items-center space-x-3 mb-6">
					<div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center">
						<Heart className="w-6 h-6 text-red-600" />
					</div>
					<div>
						<h1 className="text-2xl font-bold text-gray-900">Sign in to The Donor</h1>
					</div>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

					<div>
						<label htmlFor="email" className="sr-only">Email</label>
						<div className="relative">
							<span className="absolute inset-y-0 left-0 pl-3 flex items-center text-red-600">
								<Mail className="w-5 h-5" />
							</span>
							<input
								id="email"
								name="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
								className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 text-red-600"
								required
							/>
						</div>
					</div>

					<div>
						<label htmlFor="password" className="sr-only">Password</label>
						<div className="relative">
							<span className="absolute inset-y-0 left-0 pl-3 flex items-center text-red-600">
								<Lock className="w-5 h-5" />
							</span>
							<input
								id="password"
								name="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="Enter your password"
								className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 text-red-600"
								required
							/>
						</div>
					</div>

					<div className="flex items-center justify-between">
						<a href="#" className="text-sm text-red-600 hover:underline">Forgot password?</a>
					</div>

					<div>
						<button type="submit" className="w-full px-4 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition">Sign In</button>
					</div>

					<div className="flex items-center gap-3">
						<hr className="flex-1 border-red-700" />
						<span className="text-sm text-red-700">or continue with</span>
						<hr className="flex-1 border-red-700" />
					</div>

					<div className="grid grid-cols-2 gap-3">
						<button type="button" className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-red-700 bg-red-600">
							<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12.79A9 9 0 1112.21 3"/></svg>
							<span className="text-sm">Google</span>
						</button>
						<button type="button" className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-red-700 bg-red-600">
							<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 2h-3a4 4 0 00-4 4v3H7v4h4v8h4v-8h3l1-4h-4V6a1 1 0 011-1h3z"/></svg>
							<span className="text-sm">Facebook</span>
						</button>
					</div>

					<p className="text-center text-sm text-gray-500">Don't have an account? <a href="/register" className="text-red-600 font-semibold">Sign up</a></p>
				</form>
			</div>
		</div>
	);
}

