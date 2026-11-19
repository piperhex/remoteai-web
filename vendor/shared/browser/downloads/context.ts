import { createContext } from 'react';

export const WebsiteDownloadsContext = createContext<{
  enqueue: (url: URL, name: string) => void;
  open: () => void;
} | undefined>(undefined);
