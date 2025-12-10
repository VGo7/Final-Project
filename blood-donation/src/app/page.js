"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Heart, Droplet, Users, MapPin, Calendar, Phone, Mail, Clock, Award, Shield } from 'lucide-react';

export default function BloodDonationHome() {
  const [activeTab, setActiveTab] = useState('donate');

  // All common blood types (8 total). "urgent" flagged when units are low.
  const bloodTypes = [
    { type: 'A+', urgent: false, units: 12 },
    { type: 'A-', urgent: true, units: 7 },
    { type: 'B+', urgent: false, units: 24 },
    { type: 'B-', urgent: true, units: 6 },
    { type: 'AB+', urgent: false, units: 9 },
    { type: 'AB-', urgent: true, units: 5 },
    { type: 'O+', urgent: false, units: 20 },
    { type: 'O-', urgent: true, units: 8 },
  ];

  const stats = [
    { icon: Users, value: '10,000+', label: 'Active Donors' },
    { icon: Droplet, value: '50,000+', label: 'Lives Saved' },
    { icon: Award, value: '500+', label: 'Partner Hospitals' },
    { icon: Shield, value: '100%', label: 'Safe & Secure' },
  ];

  return (
  <div className="min-h-screen bg-linear-to-br from-red-50 via-white to-pink-50">
      {/* Navigation */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Heart className="w-8 h-8 text-red-600 fill-current" />
              <span className="text-2xl font-bold text-gray-800">The Donor</span>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#home" className="text-gray-700 hover:text-red-600 transition">Home</a>
              <a href="#donate" className="text-gray-700 hover:text-red-600 transition">Donate</a>
              <a href="#about" className="text-gray-700 hover:text-red-600 transition">About</a>
              <a href="#contact" className="text-gray-700 hover:text-red-600 transition">Contact</a>
            </div>
            <div className="flex space-x-3">
              <Link href="/signin" className="px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition">
                Sign In
              </Link>
              <Link href="/register" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                Register
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              {/* Simple tabs to switch context (Donate / Request) */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveTab('donate')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab === 'donate' ? 'bg-red-600 text-white' : 'bg-white text-red-600 border border-red-100'}`}
                  aria-pressed={activeTab === 'donate'}
                >
                  Donate
                </button>
                <button
                  onClick={() => setActiveTab('request')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab === 'request' ? 'bg-red-600 text-white' : 'bg-white text-red-600 border border-red-100'}`}
                  aria-pressed={activeTab === 'request'}
                >
                  Request Blood
                </button>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
                Every Drop Counts,
                <span className="text-red-600"> Every Life Matters</span>
              </h1>
              <p className="text-xl text-gray-600">
                Join our community of heroes. Donate blood, save lives, and make a lasting impact in your community.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="px-8 py-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                  Donate Now
                </button>
                <button className="px-8 py-4 bg-white text-red-600 border-2 border-red-600 rounded-lg font-semibold hover:bg-red-50 transition">
                  Find Blood
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="bg-linear-to-br from-red-100 to-pink-100 rounded-3xl p-6 shadow-2xl">
                {/* Responsive grid: 2 cols on xs, 4 on md to show all 8 cleanly */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {bloodTypes.map((blood, idx) => (
                    <div
                      key={idx}
                      className={`relative bg-white rounded-xl p-5 text-center shadow-md hover:shadow-lg transition transform hover:-translate-y-1 ${blood.urgent ? 'ring-2 ring-red-200' : ''}`}
                    >
                      <div className="flex items-center justify-center mx-auto mb-3 w-12 h-12 rounded-full bg-red-50">
                        <Droplet className={`w-6 h-6 ${blood.urgent ? 'text-red-600' : 'text-red-400'}`} />
                      </div>
                      <div className="text-2xl font-bold text-gray-800">{blood.type}</div>
                      <div className="text-sm text-gray-600 mt-1">{blood.units} units</div>
                      {blood.urgent && (
                        <span className="absolute top-3 right-3 inline-flex items-center px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-semibold">
                          URGENT
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-red-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={idx} className="text-center">
                  <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-3xl font-bold mb-1">{stat.value}</div>
                  <div className="text-red-100">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">How It Works</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Donating blood is simple and safe. Follow these easy steps to become a hero.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">1. Register & Schedule</h3>
              <p className="text-gray-600">Create an account and book your donation appointment at a convenient time and location.</p>
            </div>
            <div className="text-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">2. Donate Blood</h3>
              <p className="text-gray-600">Visit our center where trained professionals will guide you through a safe donation process.</p>
            </div>
            <div className="text-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">3. Save Lives</h3>
              <p className="text-gray-600">Your donation goes directly to those in need, potentially saving up to three lives.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-linear-to-br from-red-600 to-pink-600 rounded-3xl p-12 text-white">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl font-bold mb-4">Get In Touch</h2>
                <p className="text-red-100 mb-6">
                  Have questions? Need assistance? Our team is here to help 24/7.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Phone className="w-6 h-6" />
                    <span className="text-lg">+1 (555) 123-4567</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Mail className="w-6 h-6" />
                    <span className="text-lg">support@lifeblood.org</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-6 h-6" />
                    <span className="text-lg">123 Healthcare Ave, Medical District</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-8 text-gray-900">
                <h3 className="text-2xl font-bold mb-6">Quick Contact</h3>
                <form className="space-y-4">
                  <label className="sr-only" htmlFor="contact-name">Your Name</label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    placeholder="Your Name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
                  />

                  <label className="sr-only" htmlFor="contact-email">Your Email</label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    placeholder="Your Email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
                  />

                  <label className="sr-only" htmlFor="contact-message">Your Message</label>
                  <textarea
                    id="contact-message"
                    name="message"
                    placeholder="Your Message"
                    rows="4"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
                  ></textarea>
                  <button type="submit" className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold">
                    Send Message
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-7">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Heart className="w-6 h-6 text-red-600 fill-current" />
                <span className="text-xl font-bold">The Donor</span>
              </div>
              <p className="text-gray-400">Connecting donors with those in need, one drop at a time.</p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition">About Us</a></li>
                <li><a href="#" className="hover:text-white transition">Donate Blood</a></li>
                <li><a href="#" className="hover:text-white transition">Request Blood</a></li>
                <li><a href="#" className="hover:text-white transition">Eligibility</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition">FAQs</a></li>
                <li><a href="#" className="hover:text-white transition">Blood Types</a></li>
                <li><a href="#" className="hover:text-white transition">Health Tips</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-3 text-center text-gray-400">
            <p>&copy; 2025 The Donor Community Blood Donation System. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}