# Encrypted Employee Satisfaction Survey

A privacy-preserving employee satisfaction survey system built with FHEVM (Fully Homomorphic Encryption Virtual Machine). This system allows employees to submit encrypted feedback while enabling management to view aggregated statistics without accessing individual responses.

## Overview

This project demonstrates the power of Fully Homomorphic Encryption (FHE) in creating truly private survey systems. Unlike traditional encrypted systems where data must be decrypted for processing, FHE allows computations to be performed directly on encrypted data. This means:

- **True Privacy**: Individual responses remain encrypted at all times
- **Aggregated Insights**: Management can view statistics without ever seeing individual responses
- **Trustless System**: No central authority can access individual data
- **Blockchain Integration**: Leverages Ethereum for decentralized storage and access control

## Demo Video

🎥 [Watch Demo Video](encrypted-satisfaction-survey.mp4)

## Live Demo

🚀 [Vercel Live Demo](https://encrypted-satisfaction-survey.vercel.app/)

## Contract Addresses

### Sepolia Testnet
- **EmployeeSatisfactionSurvey**: `0x5Cb8E1B308e219c689Fa4BC552CAA6d230B50F6f`

### Local Development (Hardhat)
- **EmployeeSatisfactionSurvey**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`

## Features

- **Encrypted Data Submission**: All survey responses (ratings, department, feedback) are encrypted using FHEVM
- **Privacy Protection**: Individual responses remain encrypted and private
- **Aggregated Analytics**: Management can view aggregated statistics (total responses, average rating) without decrypting individual responses
- **Role-Based Access**: Only managers can view aggregated statistics
- **Rainbow Wallet Integration**: Easy wallet connection using RainbowKit

## Architecture

### Smart Contract (`EmployeeSatisfactionSurvey.sol`)

#### Key Contract Code:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract EmployeeSatisfactionSurvey is SepoliaConfig {
    struct SurveyResponse {
        euint32 satisfactionRating; // 1-5 rating (encrypted)
        euint32 departmentId; // Department identifier (encrypted)
        bytes encryptedFeedback; // Encrypted feedback text
        uint256 timestamp;
        address employeeAddress;
    }

    mapping(address => bool) public managers;
    mapping(address => bool) public hasSubmitted;
    SurveyResponse[] public responses;

    // Encrypted aggregated statistics
    euint32 private totalRatingSum;
    euint32 private responseCount;

    // Submit encrypted survey response
    function submitSurvey(
        externalEuint32 encryptedRating,
        externalEuint32 encryptedDepartment,
        bytes calldata encryptedFeedback,
        bytes calldata ratingProof,
        bytes calldata departmentProof
    ) external {
        // Convert external encrypted inputs to internal euint32
        euint32 rating = FHE.fromExternal(encryptedRating, ratingProof);
        euint32 department = FHE.fromExternal(encryptedDepartment, departmentProof);

        // Store response
        responses.push(SurveyResponse({
            satisfactionRating: rating,
            departmentId: department,
            encryptedFeedback: encryptedFeedback,
            timestamp: block.timestamp,
            employeeAddress: msg.sender
        }));

        // Update encrypted aggregates homomorphically
        totalRatingSum = FHE.add(totalRatingSum, rating);
        responseCount = FHE.add(responseCount, FHE.asEuint32(1));

        // Grant decryption access to contract and managers
        FHE.allowThis(totalRatingSum);
        FHE.allowThis(responseCount);
        FHE.allow(totalRatingSum, deployer);
        FHE.allow(responseCount, deployer);

        hasSubmitted[msg.sender] = true;
    }

    // Manager-only functions to access encrypted statistics
    function getResponseCount() external view onlyManager returns (euint32) {
        return responseCount;
    }

    function getTotalRatingSum() external view onlyManager returns (euint32) {
        return totalRatingSum;
    }
}
```

#### Data Encryption/Decryption Logic:

**Frontend Encryption Process:**
1. **Input Creation**: Create encrypted inputs using FHEVM SDK
```javascript
const ratingInput = instance.createEncryptedInput(contractAddress, userAddress);
ratingInput.add32(rating); // Add rating value (1-5)
const encRating = await ratingInput.encrypt();
```

2. **Encryption**: Values are encrypted client-side before transmission
```javascript
const deptInput = instance.createEncryptedInput(contractAddress, userAddress);
deptInput.add32(department); // Add department ID
const encDept = await deptInput.encrypt();
```

3. **Transaction Submission**: Encrypted values + proofs sent to blockchain
```javascript
await contract.submitSurvey(
    encRating.handles[0],      // Encrypted rating
    encDept.handles[0],        // Encrypted department
    feedbackBytes,             // Encrypted feedback
    encRating.inputProof,      // Proof for rating encryption
    encDept.inputProof         // Proof for department encryption
);
```

**Backend Homomorphic Operations:**
1. **Aggregation**: Encrypted statistics are updated using homomorphic addition
```solidity
totalRatingSum = FHE.add(totalRatingSum, rating);
responseCount = FHE.add(responseCount, FHE.asEuint32(1));
```

2. **Access Control**: Only managers can access encrypted handles
```solidity
function getResponseCount() external view onlyManager returns (euint32) {
    return responseCount; // Returns encrypted handle, not plaintext
}
```

**Frontend Decryption Process:**
1. **Signature Generation**: Generate FHEVM decryption signature
```javascript
const sig = await FhevmDecryptionSignature.loadOrSign(
    instance,
    [contractAddress],
    ethersSigner,
    storage
);
```

2. **Decryption**: Manager decrypts aggregated statistics
```javascript
const res = await instance.userDecrypt(
    [{ handle: encryptedHandle, contractAddress }],
    sig.privateKey,
    sig.publicKey,
    sig.signature,
    sig.contractAddresses,
    sig.userAddress,
    sig.startTimestamp,
    sig.durationDays
);
```

**Security Features:**
- Individual responses remain encrypted and inaccessible
- Only aggregated statistics can be decrypted by authorized managers
- Homomorphic operations enable computation on encrypted data
- Zero-knowledge proofs ensure encryption validity

### Frontend
- Next.js 15 with React 19
- RainbowKit for wallet connection
- FHEVM SDK for encryption/decryption operations
- TypeScript for type safety

## Prerequisites

- Node.js >= 20
- npm >= 7.0.0
- Hardhat for contract development
- A Web3 wallet (Rainbow, MetaMask, etc.)

## Installation

1. Install dependencies:
```bash
npm install
cd frontend
npm install
```

2. Compile contracts:
```bash
npm run compile
```

3. Deploy contracts (localhost):
```bash
npx hardhat deploy --network localhost
```

4. Generate ABI files:
```bash
cd frontend
npm run genabi
```

5. Start the frontend:
```bash
cd frontend
npm run dev
```

## Testing

Run tests on localhost (mock FHEVM):
```bash
npm test
```

Run tests on Sepolia testnet:
```bash
npm run test:sepolia
```

## Usage

### For Employees

1. Connect your wallet using the Rainbow button in the top right
2. Navigate to the "Submit Survey" tab
3. Select your satisfaction rating (1-5)
4. Choose your department
5. Optionally add feedback
6. Click "Submit Survey"

Your responses are encrypted before being sent to the blockchain, ensuring your privacy.

### For Managers

1. Connect your wallet (must be a manager address)
2. Navigate to the "Management Dashboard" tab
3. View aggregated statistics:
   - Total number of responses
   - Total rating sum
   - Average rating
4. Click "Decrypt Statistics" to view decrypted values
5. Click "Refresh Statistics" to update the data

## Contract Functions

### Public Functions
- `submitSurvey(encryptedRating, encryptedDepartment, encryptedFeedback, ratingProof, departmentProof)`: Submit an encrypted survey response

### Manager-Only Functions
- `getResponseCount()`: Get the encrypted total number of responses
- `getTotalRatingSum()`: Get the encrypted sum of all ratings
- `getAverageRating()`: Get the encrypted average rating
- `getDepartmentStats(departmentId)`: Get department-specific statistics
- `addManager(address)`: Add a new manager
- `removeManager(address)`: Remove a manager

## Security Considerations

- All sensitive data is encrypted using FHEVM
- Individual responses cannot be decrypted by anyone except the contract itself
- Only aggregated statistics can be decrypted by managers
- Manager addresses are controlled by the contract owner

## Development

### Project Structure

```
encrypted-satisfaction-survey/
├── contracts/
│   └── EmployeeSatisfactionSurvey.sol
├── test/
│   ├── EmployeeSatisfactionSurvey.ts
│   └── EmployeeSatisfactionSurveySepolia.ts
├── deploy/
│   └── deploy.ts
├── frontend/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   └── abi/
└── tasks/
```

### Adding New Features

1. Update the smart contract in `contracts/`
2. Update tests in `test/`
3. Update frontend components in `frontend/components/`
4. Update hooks in `frontend/hooks/`

## Troubleshooting

### Common Issues

**FHEVM Initialization Failed**
- Ensure your Hardhat node supports FHEVM metadata
- For localhost testing, use a FHEVM-enabled Hardhat node
- Consider using Sepolia testnet for full FHEVM functionality

**Wallet Connection Issues**
- Ensure your wallet is connected to the correct network
- Check that the contract is deployed on the selected network
- Verify your wallet has sufficient funds for gas fees

**Decryption Errors**
- Only managers can decrypt statistics
- Ensure you have the correct manager permissions
- Check that FHE permissions were granted during manager addition

### Network Configuration

The project supports multiple networks:
- **Localhost**: For local development and testing
- **Sepolia**: Ethereum testnet with FHEVM support
- **Anvil**: Alternative local development network

Configure networks in `hardhat.config.ts` and update contract addresses in `frontend/abi/EmployeeSatisfactionSurveyAddresses.ts`.

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow Solidity style guide for contract code
- Use TypeScript strict mode for frontend code
- Write tests for all new features
- Update documentation for API changes
- Ensure all tests pass before submitting PR

## Performance Considerations

- **Gas Optimization**: The contract uses efficient FHE operations
- **Frontend Performance**: React hooks are optimized with useMemo and useCallback
- **Network Latency**: Consider using local networks for faster development

## Future Enhancements

Potential improvements for future versions:
- Support for multiple survey types
- Department-specific statistics with proper FHE key management
- Advanced analytics and reporting
- Integration with additional wallet providers
- Mobile app support

## License

BSD-3-Clause-Clear

## Acknowledgments

Built using:
- [FHEVM](https://github.com/zama-ai/fhevm) by Zama - Fully Homomorphic Encryption Virtual Machine
- [Hardhat](https://hardhat.org/) - Ethereum development environment
- [Next.js](https://nextjs.org/) - React framework
- [RainbowKit](https://rainbowkit.com/) - Wallet connection library
- [Wagmi](https://wagmi.sh/) - React Hooks for Ethereum
- [Ethers.js](https://ethers.org/) - Ethereum library

Special thanks to the Zama team for their groundbreaking work on FHEVM and privacy-preserving blockchain technology.
