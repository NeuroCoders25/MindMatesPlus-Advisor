/**
 * UserDetailPanel — full-screen right-side slide-in drawer.
 *
 * Renders when userId is non-null. Animates in from translateX(100%) on mount.
 * ESC key closes the panel. Clicking the backdrop (left side) closes the panel.
 * All Firestore listeners live inside useUserDiagnosticData and are torn down
 * cleanly when userId changes to null or the component unmounts.
 */

import React, { useEffect, useState } from 'react';
import { useUserDiagnosticData } from '../../hooks/useUserDiagnosticData';
import PanelHeader from './PanelHeader';
import TabBar, { type TabName } from './TabBar';
import AdvisorActionBar from './AdvisorActionBar';
import OverviewTab    from './tabs/OverviewTab';
import DassScoresTab  from './tabs/DassScoresTab';
import MLPipelineTab  from './tabs/MLPipelineTab';
import BertHistoryTab from './tabs/BertHistoryTab';
import JournalsTab    from './tabs/JournalsTab';
import FeedbackTab    from './tabs/FeedbackTab';
import AboutTab       from './tabs/AboutTab';

interface Props {
  userId:  string | null;
  onClose: () => void;
}

export default function UserDetailPanel({ userId, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabName>('Overview');
  const [isVisible, setIsVisible]   = useState(false);

  const data = useUserDiagnosticData(userId);

  // ── Slide-in animation on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    // Reset to first tab on each new user
    setActiveTab('Overview');
    // Schedule visibility toggle on next animation frame so CSS transition fires
    const frame = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => {
      cancelAnimationFrame(frame);
      setIsVisible(false);
    };
  }, [userId]);

  // ── ESC key closes the panel ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [userId, onClose]);

  if (!userId) return null;

  // ── Tab content resolver ──────────────────────────────────────────────────────
  function renderTab() {
    switch (activeTab) {
      case 'Overview':      return <OverviewTab    data={data} userId={userId!} />;
      case 'DASS & Scores': return <DassScoresTab  data={data} />;
      case 'ML Pipeline':   return <MLPipelineTab  data={data} />;
      case 'BERT History':  return <BertHistoryTab data={data} />;
      case 'Journals':      return <JournalsTab    data={data} userId={userId!} />;
      case 'Feedback':      return <FeedbackTab    data={data} />;
      case 'About':         return <AboutTab       data={data} userId={userId!} />;
      default:              return null;
    }
  }

  return (
    <>
      {/*
        Backdrop — full-viewport dim layer.
        Clicking the backdrop closes the panel.
      */}
      <div
        className={[
          'fixed inset-0 z-[100] flex items-center justify-center',
          'transition-all duration-[250ms] ease-out',
          isVisible ? 'bg-black/50 backdrop-blur-[2px]' : 'bg-black/0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
        aria-label="Close panel"
      >
        {/*
          Centered Panel — stopPropagation prevents backdrop click from firing
          when the user clicks anywhere inside the panel.
        */}
        <div
          className={[
            'relative flex flex-col bg-white shadow-2xl overflow-hidden',
            'rounded-2xl',
            // sizing — desktop 780 px wide, 88 vh tall; mobile full-screen
            'w-[90vw] max-w-[780px] max-h-[88vh]',
            'max-[640px]:w-full max-[640px]:h-full max-[640px]:max-h-full max-[640px]:rounded-none',
            // scale + fade animation
            'transition-all duration-[280ms] ease-out',
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
          ].join(' ')}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="User mental health detail panel"
        >
          {/* Fixed header */}
          <PanelHeader
            profile={data.profile}
            mentalHealthProfile={data.mentalHealthProfile}
            onClose={onClose}
          />

          {/* Tab navigation */}
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Scrollable tab content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {data.loading && !data.profile ? (
              <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                Loading…
              </div>
            ) : data.error ? (
              <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
                {data.error}
              </div>
            ) : (
              renderTab()
            )}
          </div>

          {/* Fixed action bar at panel bottom */}
          <AdvisorActionBar userId={userId} data={data} />
        </div>
      </div>
    </>
  );
}
