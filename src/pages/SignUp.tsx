import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Briefcase, Users, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uploadImageToImageKit } from '../services/imageUploadService';
import logo from '../assets/logo.png';

function getFirebaseError(code: string) {
  switch (code) {
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/invalid-email': return 'Invalid email address.';
    case 'auth/weak-password': return 'Password is too weak. Use at least 6 characters.';
    default: return 'Failed to create account. Please try again.';
  }
}

const fieldClass = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition';
const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5';

export default function SignUp() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'Advisor',
    password: '',
    confirm: '',
    yearsOfExperience: '',
    qualifications: '',
    about: '',
  });
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { signup } = useAuth();
  const navigate = useNavigate();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileFile(file);
    const reader = new FileReader();
    reader.onload = () => setProfilePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      return setError('Passwords do not match.');
    }
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    setError('');
    setLoading(true);
    try {
      let profileImageUrl = '';
      if (profileFile) {
        try {
          profileImageUrl = await uploadImageToImageKit(profileFile, 'advisor-profiles');
        } catch {
          setError('Profile photo upload failed. Please try again or remove the photo.');
          setLoading(false);
          return;
        }
      }
      await signup(form.email, form.password, form.name, form.role, {
        yearsOfExperience: form.yearsOfExperience !== '' ? Number(form.yearsOfExperience) : undefined,
        qualifications: form.qualifications,
        about: form.about,
        isModerator,
        profileImageUrl,
      });
      navigate('/');
    } catch (err: any) {
      setError(getFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1535] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-2">
          <img src={logo} alt="MindMates+" className="h-16 object-contain" />
          <p className="text-white/60 text-sm tracking-wide">Advisor Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Create account</h1>
          <p className="text-slate-500 text-sm mb-6">Register as an advisor on MindMates+</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── Profile Photo ── */}
            <div className="flex flex-col items-center gap-2 pb-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 hover:border-brand-400 overflow-hidden transition-colors focus:outline-none focus:ring-4 focus:ring-brand-50"
                aria-label="Upload profile photo"
              >
                {profilePreview ? (
                  <img src={profilePreview} alt="Profile preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={24} className="text-slate-400 mx-auto" />
                )}
                <div className="absolute bottom-0 right-0 w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center shadow-md">
                  <span className="text-white text-xs font-bold leading-none">+</span>
                </div>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {profileFile ? (
                <button
                  type="button"
                  onClick={() => { setProfileFile(null); setProfilePreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Remove photo
                </button>
              ) : (
                <p className="text-xs text-slate-400">Profile photo (optional)</p>
              )}
            </div>

            {/* ── Account Info ── */}
            <div>
              <label className={labelClass}>Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Dr. Jane Smith"
                  className={`${fieldClass} pl-10`}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="you@example.com"
                  className={`${fieldClass} pl-10`}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Role / Title</label>
              <div className="relative">
                <Briefcase size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={form.role}
                  onChange={(e) => update('role', e.target.value)}
                  className={`${fieldClass} pl-10 appearance-none`}
                >
                  <option>Advisor</option>
                  <option>Senior Psychologist</option>
                  <option>Psychologist</option>
                  <option>Counselor</option>
                  <option>Therapist</option>
                </select>
              </div>
            </div>

            {/* ── Professional Details ── */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-sm font-medium text-slate-700 mb-4">Professional Details</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Years of Experience</label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={form.yearsOfExperience}
                      onChange={(e) => update('yearsOfExperience', e.target.value)}
                      placeholder="e.g. 5"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Qualifications</label>
                    <input
                      type="text"
                      value={form.qualifications}
                      onChange={(e) => update('qualifications', e.target.value)}
                      placeholder="e.g. MSc Psychology"
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>About</label>
                  <textarea
                    rows={3}
                    value={form.about}
                    onChange={(e) => update('about', e.target.value)}
                    placeholder="Describe your specialization, approach, and what you help clients with..."
                    className={`${fieldClass} resize-none`}
                  />
                </div>

                <div className="flex items-start justify-between p-4 bg-brand-50 border border-brand-100 rounded-2xl gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-2 bg-brand-100 rounded-xl">
                      <Users size={14} className="text-brand-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Act as Peer Group Moderator</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Consent to being assigned as a moderator in peer support groups. You can opt out at any time.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModerator((v) => !v)}
                    className={`shrink-0 w-12 h-6 rounded-full p-1 transition-colors duration-200 ${isModerator ? 'bg-brand-500' : 'bg-slate-300'}`}
                    aria-pressed={isModerator}
                    aria-label="Toggle moderator consent"
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isModerator ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Password ── */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-sm font-medium text-slate-700 mb-4">Security</p>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      placeholder="Min. 6 characters"
                      className={`${fieldClass} pl-10 pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Confirm Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.confirm}
                      onChange={(e) => update('confirm', e.target.value)}
                      placeholder="••••••••"
                      className={`${fieldClass} pl-10 pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm mt-2"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-500 hover:text-brand-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
