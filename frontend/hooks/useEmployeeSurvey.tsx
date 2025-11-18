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

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

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
    chainId,
    sameChain,
    sameSigner,
    isManager,
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
        } catch (error: any) {
          setMessage(`Submission failed: ${error?.message || "Unknown error"}`);
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
    message,
    clearResponseCount: clearResponseCount?.clear,
    clearRatingSum: clearRatingSum?.clear,
    responseCountHandle: responseCount,
    ratingSumHandle: totalRatingSum,
    isDecrypting,
    isRefreshing,
    isSubmitting,
    isDeployed,
    isManager,
  };
};

