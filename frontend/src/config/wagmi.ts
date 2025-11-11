import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { defineChain } from 'viem';
import { http } from 'wagmi';

const localhostChain = defineChain({
  id: 31337,
  name: 'Localhost',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Localhost Explorer',
      url: 'http://localhost:8545',
    },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: 'Encrypted Satisfaction Survey',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'a4c3f8a6d7b2c1e8f9a5c3d2e1f4b6a9',
  chains: [localhostChain, sepolia],
  transports: {
    [localhostChain.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(),
  },
  ssr: false,
});

