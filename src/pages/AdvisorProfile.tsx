import React, { useRef, useState } from 'react';
import { User, Upload, Loader2, CheckCircle, XCircle, Users, Save, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { uploadImageToImageKit } from '../services/imageUploadService';
import AvailabilitySelector from '../components/AvailabilitySelector';

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

export default function AdvisorProfile() {
  const { advisorProfile, currentUser, updateAdvisorProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'discard'; message: string } | null>(null);

  function showToast(type: 'success' | 'discard', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  const name = advisorProfile?.name ?? 'Advisor';
  const role = advisorProfile?.role ?? '';
  const email = advisorProfile?.email ?? '';
  const initials = getInitials(name);
  const originalImageUrl = advisorProfile?.profileImageUrl;
  const previewImageUrl = localPreviewUrl ?? originalImageUrl;

  const [yearsOfExperience, setYearsOfExperience] = useState<string>(
    advisorProfile?.yearsOfExperience !== undefined ? String(advisorProfile.yearsOfExperience) : ''
  );
  const [qualifications, setQualifications] = useState(advisorProfile?.qualifications ?? '');
  const [about, setAbout] = useState(advisorProfile?.about ?? '');
  const [isModerator, setIsModerator] = useState(advisorProfile?.isModerator ?? false);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setSelectedImageFile(file);
    setLocalPreviewUrl(URL.createObjectURL(file));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSave() {
    if (!currentUser) return;
    setIsUploading(true);
    try {
      let profileImageUrl = originalImageUrl;

      if (selectedImageFile) {
        profileImageUrl = await uploadImageToImageKit(selectedImageFile, 'advisors');
        if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
        setSelectedImageFile(null);
        setLocalPreviewUrl(null);
      }

      const expNum = yearsOfExperience !== '' ? Number(yearsOfExperience) : undefined;
      const updates: Record<string, unknown> = {
        yearsOfExperience: expNum,
        qualifications,
        about,
        isModerator,
        ...(profileImageUrl && { profileImageUrl }),
      };

      await updateDoc(doc(db, 'advisors', currentUser.uid), updates);
      updateAdvisorProfile({
        yearsOfExperience: expNum,
        qualifications,
        about,
        isModerator,
        ...(profileImageUrl && { profileImageUrl }),
      });
    } catch (err) {
      console.error('Profile save failed:', err);
      setPhotoError('Save failed. Please try again.');
      setIsUploading(false);
      return;
    }
    setIsUploading(false);
    setIsEditing(false);
    showToast('success', 'Profile saved successfully');
  }

  function handleDiscard() {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setSelectedImageFile(null);
    setLocalPreviewUrl(null);
    setPhotoError('');
    setYearsOfExperience(advisorProfile?.yearsOfExperience !== undefined ? String(advisorProfile.yearsOfExperience) : '');
    setQualifications(advisorProfile?.qualifications ?? '');
    setAbout(advisorProfile?.about ?? '');
    setIsModerator(advisorProfile?.isModerator ?? false);
    setIsEditing(false);
    showToast('discard', 'Changes discarded');
  }

  const readOnlyInputClass = 'w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-slate-700 select-none cursor-default';
  const editableInputClass = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-50 transition-all';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-4xl mx-auto"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl font-semibold text-sm ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-slate-600 text-white'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <User className="text-brand-500" size={32} />
            Advisor Profile
          </h1>
          <p className="text-slate-500 mt-1">
            {isEditing ? 'Edit your personal profile, credentials, and moderator settings.' : 'Your personal profile, credentials, and moderator settings.'}
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-2xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-600 transition-all text-sm"
          >
            <Pencil size={16} />
            Edit Profile
          </button>
        )}
      </header>

      <div className="glass-card p-8">
        <h3 className="text-lg font-bold text-slate-800 mb-6">Profile Information</h3>
        <div className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative w-20 h-20 shrink-0">
              {previewImageUrl ? (
                <img
                  src={previewImageUrl}
                  alt={name}
                  className="w-20 h-20 rounded-3xl object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-3xl bg-brand-100 flex items-center justify-center text-brand-600 text-3xl font-bold border-4 border-white shadow-lg">
                  {initials}
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 rounded-3xl bg-black/40 flex items-center justify-center">
                  <Loader2 size={24} className="text-white animate-spin" />
                </div>
              )}
            </div>
            {isEditing && (
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <Upload size={14} />
                  Change Photo
                </button>
                {photoError && <p className="text-xs text-red-500">{photoError}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
              <input
                type="text"
                defaultValue={name}
                readOnly
                className={readOnlyInputClass}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Title</label>
              <input
                type="text"
                defaultValue={role}
                readOnly
                className={readOnlyInputClass}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
            <input
              type="email"
              defaultValue={email}
              readOnly
              className={readOnlyInputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Years of Experience</label>
              <input
                type="number"
                min={0}
                max={60}
                value={yearsOfExperience}
                onChange={e => isEditing && setYearsOfExperience(e.target.value)}
                readOnly={!isEditing}
                placeholder={isEditing ? 'e.g. 5' : '—'}
                className={isEditing ? editableInputClass : readOnlyInputClass}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Qualifications</label>
              <input
                type="text"
                value={qualifications}
                onChange={e => isEditing && setQualifications(e.target.value)}
                readOnly={!isEditing}
                placeholder={isEditing ? 'e.g. MSc Psychology, CBT Certified' : '—'}
                className={isEditing ? editableInputClass : readOnlyInputClass}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">About</label>
            <textarea
              rows={4}
              value={about}
              onChange={e => isEditing && setAbout(e.target.value)}
              readOnly={!isEditing}
              placeholder={isEditing ? 'Describe your specialization, approach, and what you help clients with...' : '—'}
              className={`${isEditing ? editableInputClass : readOnlyInputClass} resize-none`}
            />
          </div>

          <div className={`flex items-start justify-between p-4 bg-brand-50 border border-brand-100 rounded-2xl gap-4 ${!isEditing ? 'opacity-75' : ''}`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 bg-brand-100 rounded-xl">
                <Users size={16} className="text-brand-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Act as Peer Group Moderator</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  By enabling this, you consent to being assigned as a moderator in peer support groups. You can opt out at any time.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => isEditing && setIsModerator(v => !v)}
              disabled={!isEditing}
              className={`shrink-0 w-12 h-6 rounded-full p-1 transition-colors duration-200 ${isModerator ? 'bg-brand-500' : 'bg-slate-300'} ${!isEditing ? 'cursor-default' : ''}`}
              aria-pressed={isModerator}
              aria-label="Toggle moderator consent"
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${isModerator ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>

      <AvailabilitySelector />

      <AnimatePresence>
        {isEditing && (
          <motion.div
            key="edit-actions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center justify-end gap-3"
          >
            <button
              onClick={handleDiscard}
              className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Discard Changes
            </button>
            <button
              onClick={handleSave}
              disabled={isUploading}
              className="px-8 py-3 bg-brand-500 text-white rounded-2xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-600 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              {isUploading ? 'Saving...' : 'Save Profile'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
