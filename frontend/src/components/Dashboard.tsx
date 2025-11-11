import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSignTypedData, useWalletClient } from 'wagmi';
import { useFhevm } from '../../fhevm/useFhevm';
import { useEthersSigner } from '@/hooks/useEthersSigner';
import { getContractAddress, CONTRACT_ABI } from '@/config/contracts';
import { Contract } from 'ethers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, BarChart3 } from 'lucide-react';

export function Dashboard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  
  // Use useFhevm which handles localhost mock mode automatically
  const { instance, status: fhevmStatus } = useFhevm({
    provider: walletClient?.transport as any,
    chainId: walletClient?.chain?.id,
    initialMockChains: { 31337: "http://127.0.0.1:8545" },
    enabled: isConnected && !!walletClient,
  });
  
  const zamaLoading = fhevmStatus === "loading";
  const signer = useEthersSigner();
  const { signTypedDataAsync } = useSignTypedData();
  
  const [isManager, setIsManager] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<{
    responseCount: number | null;
    totalRatingSum: number | null;
    averageRating: number | null;
  }>({
    responseCount: null,
    totalRatingSum: null,
    averageRating: null,
  });

  useEffect(() => {
    if (isConnected && signer) {
      checkManagerStatus();
    }
  }, [isConnected, signer, chainId]);

  const checkManagerStatus = async () => {
    if (!signer) return;

    try {
      const contractAddress = getContractAddress(chainId);
      if (!contractAddress) return;

      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      const managerStatus = await contract.managers(address);
      setIsManager(managerStatus);
    } catch (error) {
      console.error('Error checking manager status:', error);
      setIsManager(false);
    }
  };

  const loadStatistics = async () => {
    if (!isConnected || !instance || !signer || !isManager) return;

    setIsLoading(true);
    try {
      const contractAddress = getContractAddress(chainId);
      if (!contractAddress) {
        throw new Error('Contract not deployed on this network');
      }

      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);

      // Get encrypted statistics
      const [encryptedCount, encryptedSum] = await Promise.all([
        contract.getResponseCount(),
        contract.getTotalRatingSum(),
      ]);

      // Decrypt statistics using userDecrypt
      const keypair = instance.generateKeypair();
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = "10";
      const contractAddresses = [contractAddress];

      const eip712 = instance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays
      );

      const signature = await signTypedDataAsync({
        domain: eip712.domain as any,
        types: {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        primaryType: 'UserDecryptRequestVerification',
        message: eip712.message as any,
      });

      const decryptResult = await instance.userDecrypt(
        [
          { handle: encryptedCount, contractAddress },
          { handle: encryptedSum, contractAddress },
        ],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address!,
        startTimeStamp,
        durationDays,
      );

      const count = Number(decryptResult[encryptedCount] || 0);
      const sum = Number(decryptResult[encryptedSum] || 0);

      const average = count > 0 ? sum / count : 0;

      setStats({
        responseCount: Number(count),
        totalRatingSum: Number(sum),
        averageRating: average,
      });
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isManager && instance && signer) {
      loadStatistics();
    }
  }, [isManager, instance, signer, chainId]);

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Please connect your wallet to view the dashboard</p>
        </CardContent>
      </Card>
    );
  }

  if (!isManager) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            You are not authorized to view the management dashboard. Only managers can access aggregated statistics.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (zamaLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4" />
            <p className="text-muted-foreground">Initializing encryption service...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Management Dashboard
              </CardTitle>
              <CardDescription>
                View aggregated survey statistics (decrypted for managers only)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadStatistics}
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 text-primary" />
            </div>
          ) : stats.responseCount === null ? (
            <div className="text-center py-8 text-muted-foreground">
              Click "Refresh" to load statistics
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="text-sm text-muted-foreground mb-1">Total Responses</div>
                <div className="text-3xl font-bold text-primary">{stats.responseCount}</div>
              </div>
              <div className="p-4 rounded-lg bg-secondary/10 border border-secondary/20">
                <div className="text-sm text-muted-foreground mb-1">Total Rating Sum</div>
                <div className="text-3xl font-bold text-secondary">{stats.totalRatingSum}</div>
              </div>
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                <div className="text-sm text-muted-foreground mb-1">Average Rating</div>
                <div className="text-3xl font-bold text-accent">
                  {stats.averageRating !== null ? stats.averageRating.toFixed(2) : 'N/A'}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

