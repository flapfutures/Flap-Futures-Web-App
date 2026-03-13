import { useState } from "react";
import { WalletButton } from "@/components/wallet-button";
import { WalletModal } from "@/components/wallet-modal";
import { useWalletContext } from "@/components/WalletProvider";

interface ConnectWalletProps {
  compact?: boolean;
}

export function ConnectWallet({ compact }: ConnectWalletProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { address, connect, disconnect } = useWalletContext();

  const handleConnect = async (provider: any) => {
    setModalOpen(false);
    await connect(provider);
  };

  if (compact) {
    return (
      <>
        <button
          onClick={() => address ? disconnect() : setModalOpen(true)}
          title={address ? `${address.slice(0,6)}…${address.slice(-4)} · Click to disconnect` : "Connect Wallet"}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: address ? "1px solid rgba(122,51,250,0.4)" : "1px solid rgba(255,255,255,0.1)",
            background: address ? "rgba(122,51,250,0.15)" : "rgba(255,255,255,0.04)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {address ? (
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          )}
        </button>
        <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onConnect={handleConnect} />
      </>
    );
  }

  return (
    <>
      <WalletButton
        address={address}
        onConnect={() => setModalOpen(true)}
        onDisconnect={disconnect}
      />
      <WalletModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConnect={handleConnect}
      />
    </>
  );
}
