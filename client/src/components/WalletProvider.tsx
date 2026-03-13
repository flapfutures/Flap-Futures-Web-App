import React, { createContext, useContext } from "react";
import { useWallet } from "@/hooks/use-wallet";

interface WalletContextType {
  address: string;
  chainId: string;
  connect: (provider?: any) => Promise<any>;
  disconnect: () => void;
  provider: any;
  pendingWallet: string | null;
  approvePendingWallet: () => void;
  rejectPendingWallet: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWallet();
  return (
    <WalletContext.Provider value={wallet}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWalletContext must be used within WalletProvider");
  return ctx;
}
