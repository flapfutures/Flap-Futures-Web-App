import { useState, useEffect, useCallback } from "react";
import { useWallet } from "./use-wallet";
import { ethers } from "ethers";

interface AuthState {
  authenticated: boolean;
  walletAddress: string | null;
  loading: boolean;
}

export function useAuth() {
  const { address, connect, provider } = useWallet();
  const [auth, setAuth] = useState<AuthState>({ authenticated: false, walletAddress: null, loading: true });
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setAuth({ authenticated: data.authenticated, walletAddress: data.walletAddress || null, loading: false });
      })
      .catch(() => setAuth({ authenticated: false, walletAddress: null, loading: false }));
  }, []);

  const signIn = useCallback(async (preferredProvider?: any) => {
    setSigning(true);
    try {
      let currentAddress = address;
      let currentProvider = provider;

      if (!currentAddress || !currentProvider) {
        const result = await connect(preferredProvider);
        if (!result) { setSigning(false); return false; }
        currentAddress = result.address;
        currentProvider = result.provider;
      }

      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ walletAddress: currentAddress }),
      });
      const { nonce, message } = await nonceRes.json();
      if (!nonce) { setSigning(false); return false; }

      const web3Provider = new ethers.BrowserProvider(currentProvider);
      const signer = await web3Provider.getSigner();
      const signature = await signer.signMessage(message);

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ walletAddress: currentAddress, signature, message }),
      });
      const verifyData = await verifyRes.json();
      if (verifyData.success) {
        setAuth({ authenticated: true, walletAddress: verifyData.walletAddress, loading: false });
        setSigning(false);
        return true;
      }
      setSigning(false);
      return false;
    } catch (err) {
      console.error("Sign in failed", err);
      setSigning(false);
      return false;
    }
  }, [address, provider, connect]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setAuth({ authenticated: false, walletAddress: null, loading: false });
  }, []);

  return { ...auth, signIn, signOut, signing };
}
