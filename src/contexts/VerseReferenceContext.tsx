import { createContext, useContext, useState, ReactNode } from 'react';
import { VerseReference } from '../types';


interface AppStateContextType {
  reference: VerseReference | null;
  isCaptionOpen: boolean;
  setReference: (reference: VerseReference | null) => void;
  setIsCaptionOpen: (isCaptionOpen: boolean) => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

interface AppStateContextProviderProps {
  children: ReactNode;
  initialReference?: VerseReference;
}

export function AppStateContextProvider({
  children,
  initialReference,
}: AppStateContextProviderProps) {
  const [reference, setReference] = useState<VerseReference | null>(initialReference ?? null);
  const [isCaptionOpen, setIsCaptionOpen] = useState<boolean>(false);

  return (
    <AppStateContext.Provider
      value={{ reference, isCaptionOpen, setReference, setIsCaptionOpen }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useVerseReference deve ser usado dentro de um AppStateProvider');
  }
  return context;
}