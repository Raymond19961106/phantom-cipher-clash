import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSignTypedData, useWalletClient } from 'wagmi';
import { useFhevm } from '../../fhevm/useFhevm';
import { useEthersSigner } from '@/hooks/useEthersSigner';
import { getContractAddress, CONTRACT_ABI } from '@/config/contracts';
import { Contract } from 'ethers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, BarChart3 } from 'lucide-react';

const DEPARTMENTS = [
  { id: 1, name: 'Engineering' },
  { id: 2, name: 'Product' },
  { id: 3, name: 'Sales' },
  { id: 4, name: 'Marketing' },
  { id: 5, name: 'HR' },
  { id: 6, name: 'Operations' },
];

type DepartmentStats = {
  ratingSum: string | null;
  count: string | null;
  clearRatingSum: number | null;
  clearCount: number | null;
  average: number | null;
};

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
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [departmentStats, setDepartmentStats] = useState<Map<number, DepartmentStats>>(new Map());

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

  const loadDepartmentStats = async () => {
    if (!isConnected || !instance || !signer || !isManager) return;

    setIsLoading(true);
    try {
      const contractAddress = getContractAddress(chainId);
      if (!contractAddress) {
        throw new Error('Contract not deployed on this network');
      }

      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      const newStats = new Map<number, DepartmentStats>();

      // Get encrypted statistics for each department
      for (const dept of DEPARTMENTS) {
        try {
          const [ratingSum, count] = await contract.getDepartmentStats(dept.id);
          newStats.set(dept.id, {
            ratingSum: ratingSum,
            count: count,
            clearRatingSum: null,
            clearCount: null,
            average: null,
          });
        } catch (error) {
          console.error(`Failed to get stats for department ${dept.id}:`, error);
          newStats.set(dept.id, {
            ratingSum: null,
            count: null,
            clearRatingSum: null,
            clearCount: null,
            average: null,
          });
        }
      }

      setDepartmentStats(newStats);
    } catch (error) {
      console.error('Error loading department statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const decryptDepartmentStats = async () => {
    if (!isConnected || !instance || !signer || !isManager) return;

    setIsDecrypting(true);
    try {
      const contractAddress = getContractAddress(chainId);
      if (!contractAddress) {
        throw new Error('Contract not deployed on this network');
      }

      // Collect all handles that need to be decrypted
      const handles: Array<{ handle: string; contractAddress: string }> = [];
      const handleMap = new Map<string, { deptId: number; type: 'sum' | 'count' }>();

      for (const [deptId, stats] of departmentStats.entries()) {
        if (stats.ratingSum && stats.ratingSum !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          if (!handles.find(h => h.handle === stats.ratingSum)) {
            handles.push({ handle: stats.ratingSum!, contractAddress });
            handleMap.set(stats.ratingSum!, { deptId, type: 'sum' });
          }
        }
        if (stats.count && stats.count !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          if (!handles.find(h => h.handle === stats.count)) {
            handles.push({ handle: stats.count!, contractAddress });
            handleMap.set(stats.count!, { deptId, type: 'count' });
          }
        }
      }

      if (handles.length === 0) {
        console.log('No handles to decrypt');
        return;
      }

      // Create decryption signature
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

      // Decrypt all handles at once
      const decryptResult = await instance.userDecrypt(
        handles,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address!,
        startTimeStamp,
        durationDays,
      );

      // Update stats with decrypted values
      const updatedStats = new Map(departmentStats);
      const deptData = new Map<number, { ratingSum?: number; count?: number }>();

      // Group decrypted values by department
      for (const [handle, value] of Object.entries(decryptResult)) {
        const info = handleMap.get(handle);
        if (info) {
          const existing = deptData.get(info.deptId) || {};
          if (info.type === 'sum') {
            existing.ratingSum = Number(value || 0);
          } else {
            existing.count = Number(value || 0);
          }
          deptData.set(info.deptId, existing);
        }
      }

      // Calculate averages and update stats
      for (const [deptId, data] of deptData.entries()) {
        const currentStats = updatedStats.get(deptId);
        if (currentStats && data.ratingSum !== undefined && data.count !== undefined) {
          const average = data.count > 0 ? data.ratingSum / data.count : 0;
          updatedStats.set(deptId, {
            ...currentStats,
            clearRatingSum: data.ratingSum,
            clearCount: data.count,
            average: average,
          });
        }
      }

      setDepartmentStats(updatedStats);
    } catch (error) {
      console.error('Error decrypting department statistics:', error);
    } finally {
      setIsDecrypting(false);
    }
  };

  useEffect(() => {
    if (isManager && instance && signer) {
      loadDepartmentStats();
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

  const hasAnyData = Array.from(departmentStats.values()).some(
    stats => stats.ratingSum !== null && stats.count !== null
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Department Statistics
              </CardTitle>
              <CardDescription>
                View statistics for each department separately (decrypted for managers only)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadDepartmentStats}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={decryptDepartmentStats}
                disabled={isDecrypting || !hasAnyData}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isDecrypting ? 'animate-spin' : ''}`} />
                {isDecrypting ? 'Decrypting...' : 'Decrypt'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : !hasAnyData ? (
            <div className="text-center py-8 text-muted-foreground">
              Click "Refresh" to load department statistics
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DEPARTMENTS.map((dept) => {
                const stats = departmentStats.get(dept.id);
                const hasData = stats && stats.ratingSum !== null && stats.count !== null;
                const isDecrypted = stats && stats.clearRatingSum !== null && stats.clearCount !== null;

                return (
                  <Card key={dept.id} className="bg-gray-800/50 border border-gray-700 hover:border-purple-500/50 transition-colors">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-100">{dept.name}</h3>
                        <div className="w-10 h-10 rounded-full bg-purple-600/80 flex items-center justify-center text-white font-bold">
                          {dept.id}
                        </div>
                      </div>

                      {hasData ? (
                        isDecrypted ? (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Average Rating:</span>
                              <span className="text-2xl font-bold text-purple-400">
                                {stats.average !== null ? stats.average.toFixed(2) : 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Total Responses:</span>
                              <span className="text-lg font-semibold text-gray-200">
                                {stats.clearCount}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Rating Sum:</span>
                              <span className="text-lg font-semibold text-gray-200">
                                {stats.clearRatingSum}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Status:</span>
                              <span className="text-sm font-medium text-purple-400">Encrypted</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-2">
                              Click "Decrypt" to view
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="text-sm text-gray-500">No data available</div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
