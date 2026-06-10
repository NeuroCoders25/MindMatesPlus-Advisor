import React, { createContext, useContext, useState, useCallback } from 'react';
import ListenerChatModal from '../components/ListenerChatModal';

interface ListenerChatContextValue {
  openListenerChat: (connectionId?: string) => void;
}

const ListenerChatContext = createContext<ListenerChatContextValue>({
  openListenerChat: () => {},
});

export function useListenerChat() {
  return useContext(ListenerChatContext);
}

export function ListenerChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialId, setInitialId] = useState<string | undefined>();

  const openListenerChat = useCallback((connectionId?: string) => {
    setInitialId(connectionId);
    setIsOpen(true);
  }, []);

  return (
    <ListenerChatContext.Provider value={{ openListenerChat }}>
      {children}
      <ListenerChatModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialConnectionId={initialId}
      />
    </ListenerChatContext.Provider>
  );
}
