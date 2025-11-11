import { useEffect, useState } from 'react';
import { useWalletClient } from 'wagmi';
import { BrowserProvider, JsonRpcSigner } from 'ethers';

export function useEthersSigner() {
  const { data: walletClient } = useWalletClient();
  const [signer, setSigner] = useState<JsonRpcSigner | undefined>(undefined);

  useEffect(() => {
    if (!walletClient) {
      setSigner(undefined);
      return;
    }

    const getSigner = async () => {
      try {
        const provider = new BrowserProvider(walletClient.transport as any);
        const signer = await provider.getSigner();
        setSigner(signer);
      } catch (error) {
        console.error('Failed to get signer:', error);
        setSigner(undefined);
      }
    };

    getSigner();
  }, [walletClient]);

  return signer;
}



