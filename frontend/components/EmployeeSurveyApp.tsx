"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useFhevm } from "@/fhevm/useFhevm";
import { useEmployeeSurvey } from "@/hooks/useEmployeeSurvey";
import { useInMemoryStorage } from "@/hooks/useInMemoryStorage";
import { ethers } from "ethers";

export function EmployeeSurveyApp() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  
  // Use useFhevm which handles localhost mock mode automatically
  const { instance, status: fhevmStatus, error: fhevmError } = useFhevm({
    provider: walletClient?.transport as any,
    chainId: walletClient?.chain?.id,
    initialMockChains: { 31337: "http://127.0.0.1:8545" },
    enabled: isConnected && !!walletClient,
  });

  const [activeTab, setActiveTab] = useState<"submit" | "dashboard">("submit");
  const [rating, setRating] = useState<number>(5);
  const [department, setDepartment] = useState<number>(1);
  const [feedback, setFeedback] = useState<string>("");
  const [ethersSigner, setEthersSigner] = useState<ethers.JsonRpcSigner | undefined>(undefined);
  const [ethersReadonlyProvider, setEthersReadonlyProvider] = useState<ethers.ContractRunner | undefined>(undefined);

  useEffect(() => {
    if (walletClient) {
      const provider = new ethers.BrowserProvider(walletClient.transport as any);
      setEthersReadonlyProvider(provider);
    }
  }, [walletClient]);

  const sameChain = useRef((chainId: number | undefined) => true);
  const sameSigner = useRef((signer: any) => true);

  const survey = useEmployeeSurvey({
    instance: instance || undefined,
    fhevmDecryptionSignatureStorage,
    eip1193Provider: walletClient?.transport as any,
    chainId: walletClient?.chain?.id,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      alert("Please connect your wallet first");
      return;
    }
    survey.submitSurvey(rating, department, feedback);
    setFeedback("");
  };

  const averageRating = survey.clearResponseCount && survey.clearRatingSum
    ? Number(survey.clearRatingSum) / Number(survey.clearResponseCount)
    : null;

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
        <h2 className="text-2xl font-bold text-gray-800">Connect Your Wallet</h2>
        <p className="text-gray-600">Please connect your wallet to access the Employee Satisfaction Survey</p>
        <ConnectButton />
      </div>
    );
  }

  if (survey.isDeployed === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-6 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
        <h2 className="text-xl font-bold text-yellow-800">Contract Not Deployed</h2>
        <p className="text-yellow-700">
          The EmployeeSatisfactionSurvey contract is not deployed on this network.
          Please deploy the contract first.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("submit")}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === "submit"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Submit Survey
        </button>
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeTab === "dashboard"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Management Dashboard
        </button>
      </div>

      {/* Submit Survey Tab */}
      {activeTab === "submit" && (
        <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Employee Satisfaction Survey</h2>
          <p className="text-gray-600 mb-6">
            Your responses are encrypted to protect your privacy. Only aggregated statistics are visible to management.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Satisfaction Rating (1-5)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className={`w-12 h-12 rounded-full font-bold transition-colors ${
                      rating === value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={1}>Engineering</option>
                <option value={2}>Product</option>
                <option value={3}>Sales</option>
                <option value={4}>Marketing</option>
                <option value={5}>HR</option>
                <option value={6}>Operations</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feedback (Optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Share your thoughts and suggestions..."
              />
            </div>

            <button
              type="submit"
              disabled={!survey.canSubmit || survey.isSubmitting || fhevmStatus === "loading"}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {survey.isSubmitting
                ? "Submitting..."
                : fhevmStatus === "loading"
                  ? "Loading..."
                  : "Submit Survey"}
            </button>

            {survey.message && (
              <div
                className={`p-4 rounded-lg ${
                  survey.message.includes("failed") || survey.message.includes("error")
                    ? "bg-red-50 text-red-800"
                    : "bg-green-50 text-green-800"
                }`}
              >
                {survey.message}
              </div>
            )}

            {fhevmError && (
              <div className="p-4 rounded-lg bg-red-50 text-red-800">
                <p className="font-semibold">FHEVM Error:</p>
                <p className="text-sm mt-1">{fhevmError.message || String(fhevmError)}</p>
                {fhevmStatus === "error" && (
                  <p className="text-xs mt-2 text-red-600">
                    Note: For localhost testing, ensure your Hardhat node supports FHEVM or use Sepolia testnet.
                  </p>
                )}
              </div>
            )}
            
            {fhevmStatus === "error" && !fhevmError && (
              <div className="p-4 rounded-lg bg-yellow-50 text-yellow-800">
                <p className="font-semibold">FHEVM Initialization Failed</p>
                <p className="text-sm mt-1">
                  Unable to initialize FHEVM on localhost. This may be because:
                </p>
                <ul className="text-xs mt-2 list-disc list-inside">
                  <li>Your Hardhat node doesn't support FHEVM metadata</li>
                  <li>Network configuration issue</li>
                </ul>
                <p className="text-xs mt-2">
                  For full FHEVM functionality, please use Sepolia testnet or a FHEVM-enabled Hardhat node.
                </p>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Management Dashboard Tab */}
      {activeTab === "dashboard" && (
        <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Management Dashboard</h2>

          {!survey.isManager ? (
            <div className="p-6 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
              <p className="text-yellow-800 font-semibold">
                You are not authorized to view management statistics. Only managers can access this dashboard.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                  <h3 className="text-sm font-medium text-blue-600 mb-2">Total Responses</h3>
                  <p className="text-3xl font-bold text-blue-800">
                    {survey.clearResponseCount !== undefined
                      ? String(survey.clearResponseCount)
                      : survey.responseCountHandle && survey.responseCountHandle !== ethers.ZeroHash
                        ? "Encrypted"
                        : "0"}
                  </p>
                </div>

                <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                  <h3 className="text-sm font-medium text-green-600 mb-2">Total Rating Sum</h3>
                  <p className="text-3xl font-bold text-green-800">
                    {survey.clearRatingSum !== undefined
                      ? String(survey.clearRatingSum)
                      : survey.ratingSumHandle && survey.ratingSumHandle !== ethers.ZeroHash
                        ? "Encrypted"
                        : "0"}
                  </p>
                </div>

                <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                  <h3 className="text-sm font-medium text-purple-600 mb-2">Average Rating</h3>
                  <p className="text-3xl font-bold text-purple-800">
                    {averageRating !== null
                      ? averageRating.toFixed(2)
                      : survey.clearResponseCount && survey.clearRatingSum
                        ? "Calculating..."
                        : "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={survey.refreshStats}
                  disabled={!survey.canGetStats || survey.isRefreshing}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {survey.isRefreshing ? "Refreshing..." : "Refresh Statistics"}
                </button>

                <button
                  onClick={survey.decryptStats}
                  disabled={!survey.canDecrypt || survey.isDecrypting}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {survey.isDecrypting
                    ? "Decrypting..."
                    : survey.clearResponseCount !== undefined
                      ? "Statistics Decrypted"
                      : "Decrypt Statistics"}
                </button>
              </div>

              {survey.message && (
                <div
                  className={`p-4 rounded-lg ${
                    survey.message.includes("failed") || survey.message.includes("error")
                      ? "bg-red-50 text-red-800"
                      : "bg-blue-50 text-blue-800"
                  }`}
                >
                  {survey.message}
                </div>
              )}

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">Contract Information</h3>
                <p className="text-sm text-gray-600">
                  Contract Address:{" "}
                  <span className="font-mono text-xs">{survey.contractAddress || "Not deployed"}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

