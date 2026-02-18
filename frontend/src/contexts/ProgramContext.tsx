import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getPrograms, getUpcomingActivities } from '../services/api';
import type { ProgramSummary, UpcomingActivity } from '../services/api';
import { useAuth } from './AuthContext';

interface ProgramContextType {
  activeProgram: ProgramSummary | null;
  upcomingActivities: UpcomingActivity[];
  isLoading: boolean;
  refreshProgram: () => Promise<void>;
  refreshUpcoming: () => Promise<void>;
}

const ProgramContext = createContext<ProgramContextType | undefined>(undefined);

export function ProgramProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [activeProgram, setActiveProgram] = useState<ProgramSummary | null>(null);
  const [upcomingActivities, setUpcomingActivities] = useState<UpcomingActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProgram = useCallback(async () => {
    try {
      const programs = await getPrograms();
      const active = programs.find((p) => p.status === 'active') || null;
      setActiveProgram(active);
    } catch (e) {
      if (__DEV__) console.error('[Program] Failed to fetch programs:', e);
      setActiveProgram(null);
    }
  }, []);

  const refreshUpcoming = useCallback(async () => {
    try {
      const activities = await getUpcomingActivities();
      setUpcomingActivities(activities);
    } catch (e) {
      if (__DEV__) console.error('[Program] Failed to fetch upcoming:', e);
      setUpcomingActivities([]);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveProgram(null);
      setUpcomingActivities([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    Promise.all([refreshProgram(), refreshUpcoming()]).finally(() =>
      setIsLoading(false),
    );
  }, [isAuthenticated, refreshProgram, refreshUpcoming]);

  return (
    <ProgramContext.Provider
      value={{ activeProgram, upcomingActivities, isLoading, refreshProgram, refreshUpcoming }}
    >
      {children}
    </ProgramContext.Provider>
  );
}

export function useProgram() {
  const context = useContext(ProgramContext);
  if (!context) {
    throw new Error('useProgram must be used within a ProgramProvider');
  }
  return context;
}
