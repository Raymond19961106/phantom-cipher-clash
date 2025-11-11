import { useState } from 'react';
import { useAccount, useChainId, useWalletClient } from 'wagmi';
import { useFhevm, FhevmGoState } from '../../fhevm/useFhevm';
import { useEthersSigner } from '@/hooks/useEthersSigner';
import { getContractAddress, CONTRACT_ABI } from '@/config/contracts';
import { Contract } from 'ethers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

const DEPARTMENTS = [
  { id: 1, name: 'Engineering' },
  { id: 2, name: 'Product' },
  { id: 3, name: 'Design' },
  { id: 4, name: 'Marketing' },
  { id: 5, name: 'Sales' },
  { id: 6, name: 'Operations' },
  { id: 7, name: 'HR' },
  { id: 8, name: 'Finance' },
];

export function SubmitForm() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  
  // Use useFhevm which handles localhost mock mode automatically
  const { instance, status: fhevmStatus, error: fhevmError } = useFhevm({
    provider: walletClient?.transport as any,
    chainId: walletClient?.chain?.id,
    initialMockChains: { 31337: "http://127.0.0.1:8545" },
    enabled: isConnected && !!walletClient,
  });

  const zamaLoading = (fhevmStatus as FhevmGoState) === "loading";
  const zamaError = fhevmError;
  
  const signer = useEthersSigner();
  
  const [rating, setRating] = useState<number>(5);
  const [department, setDepartment] = useState<number>(1);
  const [feedback, setFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected || !signer) {
      setSubmitStatus('error');
      return;
    }

    if (!instance) {
      setSubmitStatus('error');
      console.error('Zama instance not initialized. Please check the console for errors.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const contractAddress = getContractAddress(chainId);
      if (!contractAddress) {
        throw new Error('Contract not deployed on this network');
      }

      // Encrypt rating
      const ratingInput = instance.createEncryptedInput(contractAddress, address!);
      ratingInput.add32(rating);
      const encryptedRating = await ratingInput.encrypt();

      // Encrypt department
      const departmentInput = instance.createEncryptedInput(contractAddress, address!);
      departmentInput.add32(department);
      const encryptedDepartment = await departmentInput.encrypt();

      // Create contract instance
      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);

      // Submit survey
      const tx = await contract.submitSurvey(
        encryptedRating.handles[0],
        encryptedDepartment.handles[0],
        '0x', // Empty feedback for now
        encryptedRating.inputProof,
        encryptedDepartment.inputProof
      );

      await tx.wait();
      setSubmitStatus('success');
      setFeedback('');
      setRating(5);
      setDepartment(1);
    } catch (error) {
      console.error('Error submitting survey:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Please connect your wallet to submit a survey</p>
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
    <Card>
      <CardHeader>
        <CardTitle>Submit Your Survey</CardTitle>
        <CardDescription>
          Your responses are encrypted before being sent to the blockchain, ensuring complete privacy.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="rating">Satisfaction Rating</Label>
            <Select
              value={rating.toString()}
              onValueChange={(value) => setRating(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select rating" />
              </SelectTrigger>
              <SelectContent>
                {[5, 4, 3, 2, 1].map((r) => (
                  <SelectItem key={r} value={r.toString()}>
                    {r} {r === 5 ? '⭐ Excellent' : r === 4 ? '⭐ Good' : r === 3 ? '⭐ Average' : r === 2 ? '⭐ Poor' : '⭐ Very Poor'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Select
              value={department.toString()}
              onValueChange={(value) => setDepartment(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id.toString()}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback">Additional Feedback (Optional)</Label>
            <Textarea
              id="feedback"
              placeholder="Share your thoughts..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
            />
          </div>

          {submitStatus === 'success' && (
            <div className="p-4 rounded-md bg-green-500/20 border border-green-500/50 text-green-400">
              Survey submitted successfully! Your encrypted response has been recorded.
            </div>
          )}

          {submitStatus === 'error' && (
            <div className="p-4 rounded-md bg-destructive/20 border border-destructive/50 text-destructive">
              Failed to submit survey. Please try again.
            </div>
          )}

          {zamaError && (
            <div className="p-4 rounded-md bg-yellow-500/20 border border-yellow-500/50 text-yellow-400">
              <p className="font-semibold">Encryption Service Error:</p>
              <p className="text-sm mt-1">{zamaError?.message || String(zamaError)}</p>
              <p className="text-xs mt-2">Please check your wallet connection and try refreshing the page.</p>
            </div>
          )}

          <Button
            type="submit"
            variant="default"
            className="w-full"
            disabled={isSubmitting || (fhevmStatus as FhevmGoState) === "loading" || (!instance && (fhevmStatus as FhevmGoState) !== "ready")}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4" />
                Submitting...
              </>
            ) : (
              'Submit Survey'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}


