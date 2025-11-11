import { useState, useEffect } from 'react';
import { useChainId, useWalletClient } from 'wagmi';

// Use dynamic import to avoid bundling issues
// The SDK will be loaded from CDN via window.relayerSDK
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

export function useZamaInstance() {
  const [instance, setInstance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    let mounted = true;

    const initZama = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check if wallet is connected
        if (!walletClient) {
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }

        // Load SDK from CDN if not already loaded
        if (typeof window === 'undefined' || !window.relayerSDK) {
          console.log('Loading Zama Relayer SDK from CDN...');
          await loadSDKFromCDN();
        }

        if (!window.relayerSDK) {
          throw new Error('Failed to load Zama Relayer SDK from CDN');
        }

        const { initSDK, createInstance, SepoliaConfig } = window.relayerSDK;

        // Check if we're on localhost (chainId 31337)
        const isLocalhost = chainId === 31337;

        if (isLocalhost) {
          console.warn('Localhost network detected. FHEVM encryption may not work properly.');
          console.warn('For localhost testing, FHEVM requires a FHEVM-enabled Hardhat node.');
          // For localhost, we'll skip initialization and set instance to null
          // This allows the UI to show appropriate warnings
          if (mounted) {
            setError('FHEVM encryption is not fully supported on standard Hardhat localhost. Please use Sepolia testnet or a FHEVM-enabled Hardhat node for full functionality.');
            setInstance(null);
            setIsLoading(false);
          }
          return;
        }

        // Check if SDK is already initialized
        if (!window.relayerSDK.__initialized__) {
          console.log('Initializing FHE SDK...');
          await initSDK();
          console.log('FHE SDK initialized');
        } else {
          console.log('FHE SDK already initialized');
        }

        // Create config - use SepoliaConfig as base, but override network
        const config = {
          ...SepoliaConfig,
          network: walletClient.transport as any,
        };

        console.log('Creating FHE instance...');
        const zamaInstance = await createInstance(config);
        console.log('FHE instance created successfully');

        if (mounted) {
          setInstance(zamaInstance);
        }
      } catch (err: any) {
        console.error('Failed to initialize Zama instance:', err);
        if (mounted) {
          setError(err?.message || 'Failed to initialize encryption service');
          setInstance(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initZama();

    return () => {
      mounted = false;
    };
  }, [chainId, walletClient]);

  return { instance, isLoading, error };
}

// Load SDK from CDN
async function loadSDKFromCDN(): Promise<void> {
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
}

