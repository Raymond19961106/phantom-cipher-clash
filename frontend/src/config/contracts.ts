import { EmployeeSatisfactionSurveyABI } from '../../abi/EmployeeSatisfactionSurveyABI';
import { EmployeeSatisfactionSurveyAddresses } from '../../abi/EmployeeSatisfactionSurveyAddresses';

export const CONTRACT_ABI = EmployeeSatisfactionSurveyABI.abi;
export const CONTRACT_ADDRESSES = EmployeeSatisfactionSurveyAddresses;

export function getContractAddress(chainId: number): `0x${string}` | undefined {
  const addressEntry = CONTRACT_ADDRESSES[chainId.toString() as keyof typeof CONTRACT_ADDRESSES];
  return addressEntry?.address as `0x${string}` | undefined;
}


