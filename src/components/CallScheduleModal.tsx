// src/components/CallScheduleModal.tsx
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Video, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CallScheduleModalProps {
  /** "instant" shows only a title input; "scheduled" adds date + time pickers */
  mode: 'instant' | 'scheduled';
  onConfirm: (title: string, date?: Date) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CallScheduleModal({ mode, onConfirm, onClose }: CallScheduleModalProps) {
  const [title, setTitle] = useState('Group call');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  function handleConfirm() {
    if (!title.trim()) {
      setValidationError('Please enter a call title.');
      return;
    }

    if (mode === 'scheduled') {
      if (!dateStr || !timeStr) {
        setValidationError('Please select both a date and a time.');
        return;
      }
      const dt = new Date(`${dateStr}T${timeStr}`);
      if (isNaN(dt.getTime())) {
        setValidationError('The selected date or time is invalid.');
        return;
      }
      if (dt <= new Date()) {
        setValidationError('Scheduled time must be in the future.');
        return;
      }
      onConfirm(title.trim(), dt);
    } else {
      onConfirm(title.trim());
    }
  }

  function clearError() {
    if (validationError) setValidationError(null);
  }

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Card */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mode === 'instant' ? (
                <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
                  <Video className="text-green-600" size={20} />
                </div>
              ) : (
                <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center shrink-0">
                  <Calendar className="text-indigo-600" size={20} />
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {mode === 'instant' ? 'Start Group Call' : 'Schedule Group Call'}
                </h3>
                <p className="text-xs text-slate-500">
                  {mode === 'instant'
                    ? 'Launch a Jitsi Meet call right now'
                    : 'Set a date and time for an upcoming call'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 shrink-0"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Title input */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Call Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); clearError(); }}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                placeholder="e.g. Weekly check-in"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-50 transition-all"
                autoFocus
              />
            </div>

            {/* Date + Time pickers (scheduled only) */}
            {mode === 'scheduled' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={dateStr}
                    min={todayStr}
                    onChange={(e) => { setDateStr(e.target.value); clearError(); }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Time
                  </label>
                  <input
                    type="time"
                    value={timeStr}
                    onChange={(e) => { setTimeStr(e.target.value); clearError(); }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-50 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Validation error */}
            {validationError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                {validationError}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-5 bg-slate-50 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className={[
                'px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center gap-2',
                mode === 'instant'
                  ? 'bg-green-500 hover:bg-green-600 shadow-green-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200',
              ].join(' ')}
            >
              {mode === 'instant' ? (
                <><Video size={15} /> Start Call</>
              ) : (
                <><Calendar size={15} /> Schedule Call</>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
