"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { switchToStudionet } from "@/lib/genlayer/client";
import { STUDIONET_CHAIN_ID } from "@/lib/genlayer/network";

interface WalletState {
  address: `0x${string}` | null;
  chainId: number | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  isConnecting: boolean;
  error: string | null;
}

interface WalletActions {
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  clearError: () => void;
}

type WalletContextValue = WalletState & WalletActions;

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    isConnected: false,
    isCorrectNetwork: false,
    isConnecting: false,
    error: null,
  });

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const set = useCallback((patch: Partial<WalletState>) => {
    if (mounted.current) setState(s => ({ ...s, ...patch }));
  }, []);

  const readChainId = useCallback(async (): Promise<number | null> => {
    if (typeof window === "undefined" || !window.ethereum) return null;
    try {
      const hex = await window.ethereum.request({ method: "eth_chainId" }) as string;
      return parseInt(hex, 16);
    } catch {
      return null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      set({ error: "No wallet extension found. Please install MetaMask." });
      return;
    }
    set({ isConnecting: true, error: null });
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      }) as string[];
      if (!accounts?.length) throw new Error("No accounts returned");
      const address = accounts[0] as `0x${string}`;
      const chainId = await readChainId();
      set({
        address,
        chainId,
        isConnected: true,
        isCorrectNetwork: chainId === STUDIONET_CHAIN_ID,
        isConnecting: false,
        error: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      set({ isConnecting: false, error: msg });
    }
  }, [set, readChainId]);

  const disconnect = useCallback(() => {
    set({
      address: null,
      chainId: null,
      isConnected: false,
      isCorrectNetwork: false,
      error: null,
    });
  }, [set]);

  const switchNetwork = useCallback(async () => {
    try {
      await switchToStudionet();
      const chainId = await readChainId();
      set({ chainId, isCorrectNetwork: chainId === STUDIONET_CHAIN_ID });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Switch failed";
      set({ error: msg });
    }
  }, [set, readChainId]);

  const clearError = useCallback(() => set({ error: null }), [set]);

  // Listen to wallet events
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (!accounts?.length) {
        disconnect();
      } else {
        set({ address: accounts[0] as `0x${string}` });
      }
    };

    const handleChainChanged = (...args: unknown[]) => {
      const chainIdHex = args[0] as string;
      const chainId = parseInt(chainIdHex, 16);
      set({ chainId, isCorrectNetwork: chainId === STUDIONET_CHAIN_ID });
    };

    const handleDisconnect = () => disconnect();

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);
    window.ethereum.on?.("disconnect", handleDisconnect);

    // Check if already connected
    window.ethereum.request({ method: "eth_accounts" })
      .then((accounts: unknown) => {
        const accs = accounts as string[];
        if (accs?.length) {
          readChainId().then(chainId => {
            set({
              address: accs[0] as `0x${string}`,
              chainId,
              isConnected: true,
              isCorrectNetwork: chainId === STUDIONET_CHAIN_ID,
            });
          });
        }
      })
      .catch(() => {});

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
      window.ethereum?.removeListener?.("disconnect", handleDisconnect);
    };
  }, [disconnect, readChainId, set]);

  const value: WalletContextValue = {
    ...state,
    connect,
    disconnect,
    switchNetwork,
    clearError,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
