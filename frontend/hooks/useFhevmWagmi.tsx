"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";

// Use CDN loading instead of direct import
declare global {
  interface Window {
    relayerSDK?: {
      initSDK: (options?: any) => Promise<boolean>;
      createInstance: (config: any) => Promise<any>;
      SepoliaConfig: any;
      __initialized__?: boolean;
    };
  }
}

export function useFhevmWagmi() {
  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [instance, setInstance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const loadSDKFromCDN = useCallback(async (): Promise<void> => {
    const SDK_CDN_URL = 'https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs';

    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.relayerSDK) {
        resolve();
        return;
      }

      // Check if script already exists
      const existingScript = document.querySelector(`script[src="${SDK_CDN_URL}"]`);
      if (existingScript) {
        // Wait a bit for it to load
        const checkInterval = setInterval(() => {
          if (window.relayerSDK) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          if (!window.relayerSDK) {
            reject(new Error('SDK script loaded but relayerSDK not available'));
          }
        }, 10000);
        return;
      }

      // Create and load script
      const script = document.createElement('script');
      script.src = SDK_CDN_URL;
      script.type = 'text/javascript';
      script.async = true;

      script.onload = () => {
        if (window.relayerSDK) {
          resolve();
        } else {
          reject(new Error('SDK script loaded but relayerSDK not available on window object'));
        }
      };

      script.onerror = () => {
        reject(new Error(`Failed to load Zama Relayer SDK from ${SDK_CDN_URL}`));
      };

      document.head.appendChild(script);
    });
  }, []);

  const initializeFhevm = useCallback(async () => {
    if (!isConnected || !address || !walletClient) {
      setError("Please connect your wallet first");
      return false;
    }

    if (instance) {
      return true;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Load SDK from CDN if not already loaded
      if (!window.relayerSDK) {
        console.log('Loading Zama Relayer SDK from CDN...');
        await loadSDKFromCDN();
      }

      if (!window.relayerSDK) {
        throw new Error('Failed to load Zama Relayer SDK from CDN');
      }

      const { initSDK, createInstance, SepoliaConfig } = window.relayerSDK;

      // Initialize SDK if not already initialized
      if (!window.relayerSDK.__initialized__) {
        await initSDK();
      }

      // Create FHEVM instance
      const config = {
        ...SepoliaConfig,
        network: walletClient.transport as any,
      };

      const fhevmInstance = await createInstance(config);
      setInstance(fhevmInstance);
      setIsInitialized(true);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize FHEVM";
      setError(errorMessage);
      console.error("Failed to initialize FHEVM:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, walletClient, instance, loadSDKFromCDN]);

  useEffect(() => {
    if (isConnected && address && walletClient && !instance && !isLoading) {
      initializeFhevm();
    }
  }, [isConnected, address, walletClient, instance, isLoading, initializeFhevm]);

  return {
    instance,
    isLoading,
    error,
    isInitialized,
    initializeFhevm,
  };
}

