"use client";

import { ethers } from "ethers";
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";

import { EmployeeSatisfactionSurveyAddresses } from "@/abi/EmployeeSatisfactionSurveyAddresses";
import { EmployeeSatisfactionSurveyABI } from "@/abi/EmployeeSatisfactionSurveyABI";

export type ClearValueType = {
  handle: string;
  clear: string | bigint | boolean;
};

type EmployeeSurveyInfoType = {
  abi: typeof EmployeeSatisfactionSurveyABI.abi;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

function getEmployeeSurveyByChainId(
  chainId: number | undefined
): EmployeeSurveyInfoType {
  if (!chainId) {
    return { abi: EmployeeSatisfactionSurveyABI.abi };
  }

  const entry =
    EmployeeSatisfactionSurveyAddresses[chainId.toString() as keyof typeof EmployeeSatisfactionSurveyAddresses];

  if (!("address" in entry) || entry.address === ethers.ZeroAddress) {
    return { abi: EmployeeSatisfactionSurveyABI.abi, chainId };
  }

  return {
    address: entry?.address as `0x${string}` | undefined,
    chainId: entry?.chainId ?? chainId,
    chainName: entry?.chainName,
    abi: EmployeeSatisfactionSurveyABI.abi,
  };
}

export const useEmployeeSurvey = (parameters: {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  eip1193Provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  sameChain: RefObject<(chainId: number | undefined) => boolean>;
  sameSigner: RefObject<
    (ethersSigner: ethers.JsonRpcSigner | undefined) => boolean
  >;
}) => {
  const {
    instance,
    fhevmDecryptionSignatureStorage,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  } = parameters;

  const [responseCount, setResponseCount] = useState<string | undefined>(undefined);
  const [totalRatingSum, setTotalRatingSum] = useState<string | undefined>(undefined);
  const [clearResponseCount, setClearResponseCount] = useState<ClearValueType | undefined>(undefined);
  const [clearRatingSum, setClearRatingSum] = useState<ClearValueType | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [isManager, setIsManager] = useState<boolean>(false);
  const [departmentStats, setDepartmentStats] = useState<Map<number, { ratingSum: string; count: string }>>(new Map());
  const [clearDepartmentStats, setClearDepartmentStats] = useState<Map<number, { ratingSum: bigint; count: bigint; average: number }>>(new Map());
  const [isLoadingDepartments, setIsLoadingDepartments] = useState<boolean>(false);

  const surveyRef = useRef<EmployeeSurveyInfoType | undefined>(undefined);
  const isRefreshingRef = useRef<boolean>(isRefreshing);
  const isDecryptingRef = useRef<boolean>(isDecrypting);
  const isSubmittingRef = useRef<boolean>(false);
  const clearResponseCountRef = useRef<ClearValueType | undefined>(undefined);
  const clearRatingSumRef = useRef<ClearValueType | undefined>(undefined);

  const employeeSurvey = useMemo(() => {
    const c = getEmployeeSurveyByChainId(chainId);
    surveyRef.current = c;

    if (!c.address) {
      setMessage(`EmployeeSatisfactionSurvey deployment not found for chainId=${chainId}.`);
    }

    return c;
  }, [chainId]);

  const isDeployed = useMemo(() => {
    if (!employeeSurvey) {
      return undefined;
    }
    return (Boolean(employeeSurvey.address) && employeeSurvey.address !== ethers.ZeroAddress);
  }, [employeeSurvey]);

  const canGetStats = useMemo(() => {
    return Boolean(employeeSurvey.address) && Boolean(ethersReadonlyProvider) && !isRefreshing;
  }, [employeeSurvey.address, ethersReadonlyProvider, isRefreshing]);

  const refreshStats = useCallback(async () => {
    if (isRefreshingRef.current) {
      return;
    }

    if (
      !surveyRef.current ||
      !surveyRef.current?.chainId ||
      !surveyRef.current?.address ||
      !ethersReadonlyProvider ||
      !ethersSigner
    ) {
      setResponseCount(undefined);
      setTotalRatingSum(undefined);
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    const thisChainId = surveyRef.current.chainId;
    const thisSurveyAddress = surveyRef.current.address;
    const thisEthersSigner = ethersSigner;

    const thisSurveyContract = new ethers.Contract(
      thisSurveyAddress,
      surveyRef.current.abi,
      ethersReadonlyProvider
    );

    try {
      // Check if user is manager
      const isMgr = await thisSurveyContract.managers(thisEthersSigner.address);
      
      if (sameChain.current(thisChainId) && thisSurveyAddress === surveyRef.current?.address) {
        setIsManager(isMgr);
        
        // Get response count and rating sum (only if manager)
        if (isMgr) {
          try {
            const count = await thisSurveyContract.getResponseCount();
            const sum = await thisSurveyContract.getTotalRatingSum();
            
            if (sameChain.current(thisChainId) && thisSurveyAddress === surveyRef.current?.address) {
              setResponseCount(count);
              setTotalRatingSum(sum);
            }
          } catch (err) {
            // Manager check passed but stats call failed
            console.error("Failed to get stats:", err);
          }
        } else {
          setResponseCount(undefined);
          setTotalRatingSum(undefined);
        }
      }
    } catch (err) {
      // Not a manager or error
      setIsManager(false);
      setResponseCount(undefined);
      setTotalRatingSum(undefined);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [ethersReadonlyProvider, ethersSigner, sameChain]);

  const refreshDepartmentStats = useCallback(async () => {
    if (isLoadingDepartments || !isManager) {
      return;
    }

    if (
      !surveyRef.current ||
      !surveyRef.current?.chainId ||
      !surveyRef.current?.address ||
      !ethersReadonlyProvider ||
      !ethersSigner
    ) {
      return;
    }

    setIsLoadingDepartments(true);

    const thisChainId = surveyRef.current.chainId;
    const thisSurveyAddress = surveyRef.current.address;
    const thisEthersSigner = ethersSigner;

    const thisSurveyContract = new ethers.Contract(
      thisSurveyAddress,
      surveyRef.current.abi,
      ethersReadonlyProvider
    );

    try {
      const departments = [1, 2, 3, 4, 5, 6]; // Engineering, Product, Sales, Marketing, HR, Operations
      const newStats = new Map<number, { ratingSum: string; count: string }>();

      for (const deptId of departments) {
        try {
          const [ratingSum, count] = await thisSurveyContract.getDepartmentStats(deptId);
          
          if (sameChain.current(thisChainId) && thisSurveyAddress === surveyRef.current?.address) {
            newStats.set(deptId, {
              ratingSum: ratingSum,
              count: count,
            });
          }
        } catch (err) {
          console.error(`Failed to get stats for department ${deptId}:`, err);
        }
      }

      if (sameChain.current(thisChainId) && thisSurveyAddress === surveyRef.current?.address) {
        setDepartmentStats(newStats);
      }
    } catch (err) {
      console.error("Failed to refresh department stats:", err);
    } finally {
      setIsLoadingDepartments(false);
    }
  }, [ethersReadonlyProvider, ethersSigner, sameChain, isManager]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    if (isManager) {
      refreshDepartmentStats();
    }
  }, [isManager, refreshDepartmentStats]);

  const canDecrypt = useMemo(() => {
    return (
      employeeSurvey.address &&
      instance &&
      ethersSigner &&
      !isRefreshing &&
      !isDecrypting &&
      isManager &&
      (responseCount || totalRatingSum) &&
      ((responseCount && responseCount !== ethers.ZeroHash && responseCount !== clearResponseCount?.handle) ||
       (totalRatingSum && totalRatingSum !== ethers.ZeroHash && totalRatingSum !== clearRatingSum?.handle))
    );
  }, [
    employeeSurvey.address,
    instance,
    ethersSigner,
    isRefreshing,
    isDecrypting,
    isManager,
    responseCount,
    totalRatingSum,
    clearResponseCount,
    clearRatingSum,
  ]);

  const decryptStats = useCallback(() => {
    if (isRefreshingRef.current || isDecryptingRef.current) {
      return;
    }

    if (!employeeSurvey.address || !instance || !ethersSigner || !isManager) {
      return;
    }

    if (!responseCount && !totalRatingSum) {
      return;
    }

    const thisChainId = chainId;
    const thisSurveyAddress = employeeSurvey.address;
    const thisEthersSigner = ethersSigner;

    isDecryptingRef.current = true;
    setIsDecrypting(true);
    setMessage("Starting decryption...");

    const run = async () => {
      const isStale = () =>
        thisSurveyAddress !== surveyRef.current?.address ||
        !sameChain.current(thisChainId) ||
        !sameSigner.current(thisEthersSigner);

      try {
        const sig: FhevmDecryptionSignature | null =
          await FhevmDecryptionSignature.loadOrSign(
            instance,
            [employeeSurvey.address as `0x${string}`],
            ethersSigner,
            fhevmDecryptionSignatureStorage
          );

        if (!sig) {
          setMessage("Unable to build FHEVM decryption signature");
          return;
        }

        if (isStale()) {
          setMessage("Ignore FHEVM decryption");
          return;
        }

        setMessage("Decrypting statistics...");

        const handles: Array<{ handle: string; contractAddress: string }> = [];
        if (responseCount && responseCount !== ethers.ZeroHash) {
          handles.push({ handle: responseCount, contractAddress: thisSurveyAddress });
        }
        if (totalRatingSum && totalRatingSum !== ethers.ZeroHash) {
          handles.push({ handle: totalRatingSum, contractAddress: thisSurveyAddress });
        }

        const res = await instance.userDecrypt(
          handles,
          sig.privateKey,
          sig.publicKey,
          sig.signature,
          sig.contractAddresses,
          sig.userAddress,
          sig.startTimestamp,
          sig.durationDays
        );

        if (isStale()) {
          setMessage("Ignore FHEVM decryption");
          return;
        }

        if (responseCount && responseCount !== ethers.ZeroHash) {
          setClearResponseCount({ handle: responseCount, clear: res[responseCount] || BigInt(0) });
          clearResponseCountRef.current = { handle: responseCount, clear: res[responseCount] || BigInt(0) };
        }

        if (totalRatingSum && totalRatingSum !== ethers.ZeroHash) {
          setClearRatingSum({ handle: totalRatingSum, clear: res[totalRatingSum] || BigInt(0) });
          clearRatingSumRef.current = { handle: totalRatingSum, clear: res[totalRatingSum] || BigInt(0) };
        }

        // Decrypt department stats if available
        if (departmentStats && departmentStats.size > 0) {
          const newClearDeptStats = new Map<number, { ratingSum: bigint; count: bigint; average: number }>();
          const allDeptHandles: Array<{ handle: string; contractAddress: string }> = [];
          const deptHandleMap = new Map<string, { deptId: number; type: 'sum' | 'count' }>();

          for (const [deptId, stats] of departmentStats.entries()) {
            if (stats.ratingSum && stats.ratingSum !== ethers.ZeroHash && stats.count && stats.count !== ethers.ZeroHash) {
              if (!allDeptHandles.find(h => h.handle === stats.ratingSum)) {
                allDeptHandles.push({ handle: stats.ratingSum, contractAddress: thisSurveyAddress });
                deptHandleMap.set(stats.ratingSum, { deptId, type: 'sum' });
              }
              if (!allDeptHandles.find(h => h.handle === stats.count)) {
                allDeptHandles.push({ handle: stats.count, contractAddress: thisSurveyAddress });
                deptHandleMap.set(stats.count, { deptId, type: 'count' });
              }
            }
          }

          if (allDeptHandles.length > 0) {
            try {
              const deptRes = await instance.userDecrypt(
                allDeptHandles,
                sig.privateKey,
                sig.publicKey,
                sig.signature,
                sig.contractAddresses,
                sig.userAddress,
                sig.startTimestamp,
                sig.durationDays
              );

              // Group results by department
              const deptData = new Map<number, { ratingSum?: bigint; count?: bigint }>();
              for (const [handle, value] of Object.entries(deptRes)) {
                const info = deptHandleMap.get(handle);
                if (info) {
                  const existing = deptData.get(info.deptId) || {};
                  if (info.type === 'sum') {
                    existing.ratingSum = BigInt(value || 0);
                  } else {
                    existing.count = BigInt(value || 0);
                  }
                  deptData.set(info.deptId, existing);
                }
              }

              // Calculate averages
              for (const [deptId, data] of deptData.entries()) {
                if (data.ratingSum !== undefined && data.count !== undefined) {
                  const average = data.count > 0 ? Number(data.ratingSum) / Number(data.count) : 0;
                  newClearDeptStats.set(deptId, {
                    ratingSum: data.ratingSum,
                    count: data.count,
                    average: average,
                  });
                }
              }

              if (sameChain.current(thisChainId) && thisSurveyAddress === surveyRef.current?.address) {
                setClearDepartmentStats(newClearDeptStats);
              }
            } catch (err) {
              console.error("Failed to decrypt department stats:", err);
            }
          }
        }

        setMessage("Decryption completed!");
      } catch (error: any) {
        const errorMsg = error?.message || "Unknown error";
        setMessage(`Decryption failed: ${errorMsg}`);
      } finally {
        isDecryptingRef.current = false;
        setIsDecrypting(false);
      }
    };

    run();
  }, [
    fhevmDecryptionSignatureStorage,
    ethersSigner,
    employeeSurvey.address,
    instance,
    responseCount,
    totalRatingSum,
    departmentStats,
    chainId,
    sameChain,
    sameSigner,
    isManager,
    instance,
    fhevmDecryptionSignatureStorage,
  ]);

  const canSubmit = useMemo(() => {
    return (
      Boolean(employeeSurvey.address) &&
      Boolean(instance) &&
      Boolean(ethersSigner) &&
      !isRefreshing &&
      !isSubmitting
    );
  }, [employeeSurvey.address, instance, ethersSigner, isRefreshing, isSubmitting]);

  const submitSurvey = useCallback(
    (rating: number, department: number, feedback: string = "") => {
      if (isRefreshingRef.current || isSubmittingRef.current) {
        return;
      }

      if (!employeeSurvey.address || !instance || !ethersSigner) {
        return;
      }

      if (rating < 1 || rating > 5) {
        setMessage("Rating must be between 1 and 5");
        return;
      }

      const thisChainId = chainId;
      const thisSurveyAddress = employeeSurvey.address;
      const thisEthersSigner = ethersSigner;
      const thisSurveyContract = new ethers.Contract(
        thisSurveyAddress,
        employeeSurvey.abi,
        thisEthersSigner
      );

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setMessage("Submitting survey...");

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisSurveyAddress !== surveyRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          // Create separate encrypted inputs for rating and department
          const ratingInput = instance.createEncryptedInput(
            thisSurveyAddress,
            thisEthersSigner.address
          );
          ratingInput.add32(rating);
          const encRating = await ratingInput.encrypt();

          const deptInput = instance.createEncryptedInput(
            thisSurveyAddress,
            thisEthersSigner.address
          );
          deptInput.add32(department);
          const encDept = await deptInput.encrypt();

          if (isStale()) {
            setMessage("Ignore submission");
            return;
          }

          setMessage("Sending transaction...");

          const feedbackBytes = ethers.toUtf8Bytes(feedback || "");

          const tx: ethers.TransactionResponse = await thisSurveyContract.submitSurvey(
            encRating.handles[0],  // rating
            encDept.handles[0],     // department
            department,             // plaintextDepartmentId
            feedbackBytes,
            encRating.inputProof,
            encDept.inputProof
          );

          setMessage(`Waiting for tx:${tx.hash}...`);

          const receipt = await tx.wait();

          setMessage(`Survey submitted! Status=${receipt?.status}`);

          if (isStale()) {
            setMessage("Ignore submission");
            return;
          }

          refreshStats();
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          setMessage(`Submission failed: ${errorMessage}`);
        } finally {
          isSubmittingRef.current = false;
          setIsSubmitting(false);
        }
      };

      run();
    },
    [
      ethersSigner,
      employeeSurvey.address,
      employeeSurvey.abi,
      instance,
      chainId,
      refreshStats,
      sameChain,
      sameSigner,
    ]
  );

  return {
    contractAddress: employeeSurvey.address,
    canDecrypt,
    canGetStats,
    canSubmit,
    submitSurvey,
    decryptStats,
    refreshStats,
    refreshDepartmentStats,
    message,
    clearResponseCount: clearResponseCount?.clear,
    clearRatingSum: clearRatingSum?.clear,
    responseCountHandle: responseCount,
    ratingSumHandle: totalRatingSum,
    departmentStats,
    clearDepartmentStats,
    isLoadingDepartments,
    isDecrypting,
    isRefreshing,
    isSubmitting,
    isDeployed,
    isManager,
  };
};

