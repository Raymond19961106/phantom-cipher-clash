// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Encrypted Employee Satisfaction Survey
/// @notice A contract for collecting encrypted employee satisfaction feedback
/// @dev Each survey response is encrypted separately to protect employee privacy
contract EmployeeSatisfactionSurvey is SepoliaConfig {
    // Survey response structure
    struct SurveyResponse {
        euint32 satisfactionRating; // 1-5 rating
        euint32 departmentId; // Department identifier
        bytes encryptedFeedback; // Encrypted feedback text (stored as bytes)
        uint256 timestamp;
        address employeeAddress;
    }

    // Management addresses that can view aggregated reports
    mapping(address => bool) public managers;

    // Track which addresses have already submitted a survey
    mapping(address => bool) public hasSubmitted;

    // Deployer address (initial manager)
    address private deployer;
    
    // Survey responses
    SurveyResponse[] public responses;
    
    // Aggregated statistics (encrypted)
    euint32 private totalRatingSum;
    euint32 private responseCount;
    
    // Department-specific aggregates
    mapping(uint32 => euint32) public departmentRatingSum;
    mapping(uint32 => euint32) public departmentResponseCount;

    event SurveySubmitted(uint256 indexed responseId, address indexed employee);
    event ManagerAdded(address indexed manager);
    event ManagerRemoved(address indexed manager);

    modifier onlyManager() {
        require(managers[msg.sender], "Only managers can access this function");
        _;
    }

    constructor() {
        deployer = msg.sender;
        managers[msg.sender] = true;
    }

    /// @notice Submit a survey response with encrypted data
    /// @param encryptedRating Encrypted satisfaction rating (1-5)
    /// @param encryptedDepartment Encrypted department ID
    /// @param encryptedFeedback Encrypted feedback text
    /// @param ratingProof Proof for rating encryption
    /// @param departmentProof Proof for department encryption
    function submitSurvey(
        externalEuint32 encryptedRating,
        externalEuint32 encryptedDepartment,
        bytes calldata encryptedFeedback,
        bytes calldata ratingProof,
        bytes calldata departmentProof
    ) external {
        require(!hasSubmitted[msg.sender], "Address has already submitted a survey");

        euint32 rating = FHE.fromExternal(encryptedRating, ratingProof);
        euint32 department = FHE.fromExternal(encryptedDepartment, departmentProof);

        // Store the response
        responses.push(SurveyResponse({
            satisfactionRating: rating,
            departmentId: department,
            encryptedFeedback: encryptedFeedback,
            timestamp: block.timestamp,
            employeeAddress: msg.sender
        }));

        // Update aggregates
        totalRatingSum = FHE.add(totalRatingSum, rating);
        responseCount = FHE.add(responseCount, FHE.asEuint32(1));

        euint32 one = FHE.asEuint32(1);
        departmentRatingSum[0] = FHE.add(departmentRatingSum[0], rating);
        departmentResponseCount[0] = FHE.add(departmentResponseCount[0], one);

        // Allow contract and managers to decrypt aggregates
        FHE.allowThis(totalRatingSum);
        FHE.allowThis(responseCount);
        FHE.allowThis(departmentRatingSum[0]);
        FHE.allowThis(departmentResponseCount[0]);
        
        // Grant access to deployer (initial manager) for decryption
        FHE.allow(totalRatingSum, deployer);
        FHE.allow(responseCount, deployer);
        FHE.allow(departmentRatingSum[0], deployer);
        FHE.allow(departmentResponseCount[0], deployer);

        hasSubmitted[msg.sender] = true;

        emit SurveySubmitted(responses.length - 1, msg.sender);
    }

    /// @notice Get aggregated average rating (only managers)
    /// @return The encrypted average rating
    /// @dev Returns totalRatingSum for off-chain division calculation
    /// Note: Division in FHE is complex, so we return the sum and count separately
    /// The average can be calculated off-chain: average = totalRatingSum / responseCount
    function getAverageRating() external view onlyManager returns (euint32) {
        // Note: Division in FHE is complex, this is a simplified version
        // In production, you might need to use a different approach
        // We return the sum, and the frontend can calculate average = sum / count
        return totalRatingSum; // Return sum for decryption off-chain
    }

    /// @notice Get total response count (only managers)
    /// @return The encrypted response count
    function getResponseCount() external view onlyManager returns (euint32) {
        return responseCount;
    }

    /// @notice Get total rating sum (only managers)
    /// @return The encrypted rating sum
    function getTotalRatingSum() external view onlyManager returns (euint32) {
        return totalRatingSum;
    }

    /// @notice Get department statistics (only managers)
    /// @param departmentId The department ID
    /// @return ratingSum The encrypted rating sum for the department
    /// @return count The encrypted response count for the department
    function getDepartmentStats(uint32 departmentId) 
        external 
        view 
        onlyManager 
        returns (euint32 ratingSum, euint32 count) 
    {
        return (departmentRatingSum[departmentId], departmentResponseCount[departmentId]);
    }

    /// @notice Get the number of responses
    /// @return The number of survey responses
    function getResponseArrayLength() external view returns (uint256) {
        return responses.length;
    }

    /// @notice Add a manager address
    /// @param manager The address to grant manager privileges
    function addManager(address manager) external onlyManager {
        managers[manager] = true;
        emit ManagerAdded(manager);
    }

    /// @notice Remove a manager address
    /// @param manager The address to revoke manager privileges
    function removeManager(address manager) external onlyManager {
        managers[manager] = false;
        emit ManagerRemoved(manager);
    }
}
