import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getPrograms, getUpcomingActivities, isNetworkError } from '../services/api';
import type { ProgramSummary, UpcomingActivity } from '../services/api';
import { CacheKeys, getCached, setCached } from '../services/offlineStorage';
import { useAuth } from './AuthContext';

interface ProgramContextType {
  activeProgram: ProgramSummary | null;
  upcomingActivities: UpcomingActivity[];
  isLoading: boolean;
  openChatRequest: boolean;
  programDataVersion: number;
  chatUnreadCount: number;
  refreshUpcoming: () => Promise<void>;
  notifyProgramDataChanged: () => Promise<void>;
  requestOpenChat: () => void;
  clearOpenChatRequest: () => void;
  setChatUnreadCount: (count: number) => void;
}

const ProgramContext = createContext<ProgramContextType | undefined>(undefined);

export function ProgramProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [activeProgram, setActiveProgram] = useState<ProgramSummary | null>(null);
  const [upcomingActivities, setUpcomingActivities] = useState<UpcomingActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openChatRequest, setOpenChatRequest] = useState(false);
  const [programDataVersion, setProgramDataVersion] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const refreshProgram = useCallback(async () => {
    try {
      const programs = await getPrograms();
      const active = programs.find((p) => p.status === 'active') || null;
      setActiveProgram(active);
      void setCached(CacheKeys.activeProgram, active);
    } catch (e) {
      if (isNetworkError(e)) {
        const cached = await getCached<ProgramSummary | null>(CacheKeys.activeProgram);
        setActiveProgram(cached ?? null);
        return;
      }
      if (__DEV__) console.error('[Program] Failed to fetch programs:', e);
      setActiveProgram(null);
    }
  }, []);

  const refreshUpcoming = useCallback(async () => {
    try {
      const activities = await getUpcomingActivities();
      setUpcomingActivities(activities);
      void setCached(CacheKeys.upcomingActivities, activities);
    } catch (e) {
      if (isNetworkError(e)) {
        const cached = await getCached<UpcomingActivity[]>(CacheKeys.upcomingActivities);
        setUpcomingActivities(cached ?? []);
        return;
      }
      if (__DEV__) console.error('[Program] Failed to fetch upcoming:', e);
      setUpcomingActivities([]);
    }
  }, []);

  const notifyProgramDataChanged = useCallback(async () => {
    setProgramDataVersion((v) => v + 1);
    await Promise.all([refreshProgram(), refreshUpcoming()]);
  }, [refreshProgram, refreshUpcoming]);

  const requestOpenChat = useCallback(() => {
    setOpenChatRequest(true);
  }, []);

  const clearOpenChatRequest = useCallback(() => {
    setOpenChatRequest(false);
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
      value={{
        activeProgram,
        upcomingActivities,
        isLoading,
        openChatRequest,
        programDataVersion,
        chatUnreadCount,
        refreshUpcoming,
        notifyProgramDataChanged,
        requestOpenChat,
        clearOpenChatRequest,
        setChatUnreadCount,
      }}
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
