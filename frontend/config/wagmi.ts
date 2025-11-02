import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { defineChain } from 'viem';
import { http } from 'wagmi';

/**
 * Custom localhost chain configuration for FHEVM development
 * Enables local testing of encrypted satisfaction survey contracts
 */
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
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [localhostChain, sepolia],
  transports: {
    [localhostChain.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(),
  },
  ssr: false,
});

