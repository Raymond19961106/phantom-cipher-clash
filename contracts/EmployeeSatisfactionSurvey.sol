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

    // Track which addresses have already submitted a survey to each department
    // mapping(address => mapping(uint32 => bool)) means: has this address submitted to this department?
    mapping(address => mapping(uint32 => bool)) public hasSubmittedToDepartment;

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

    event SurveySubmitted(uint256 indexed responseId, address indexed employee, uint256 timestamp);
    event ManagerAdded(address indexed manager, address indexed addedBy);
    event ManagerRemoved(address indexed manager, address indexed removedBy);

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
    /// @param encryptedDepartment Encrypted department ID (for privacy)
    /// @param plaintextDepartmentId Plaintext department ID (for statistics, department info is typically not sensitive)
    /// @param encryptedFeedback Encrypted feedback text
    /// @param ratingProof Proof for rating encryption
    /// @param departmentProof Proof for department encryption
    function submitSurvey(
        externalEuint32 encryptedRating,
        externalEuint32 encryptedDepartment,
        uint32 plaintextDepartmentId,
        bytes calldata encryptedFeedback,
        bytes calldata ratingProof,
        bytes calldata departmentProof
    ) external {
        require(!hasSubmittedToDepartment[msg.sender][plaintextDepartmentId], "Address has already submitted a survey to this department");

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

        euint32 one = FHE.asEuint32(1);
        
        // Update total statistics
        totalRatingSum = FHE.add(totalRatingSum, rating);
        responseCount = FHE.add(responseCount, one);

        // Update department-specific statistics using plaintext department ID
        departmentRatingSum[plaintextDepartmentId] = FHE.add(departmentRatingSum[plaintextDepartmentId], rating);
        departmentResponseCount[plaintextDepartmentId] = FHE.add(departmentResponseCount[plaintextDepartmentId], one);

        // Grant permissions for total stats
        FHE.allowThis(totalRatingSum);
        FHE.allowThis(responseCount);
        FHE.allow(totalRatingSum, deployer);
        FHE.allow(responseCount, deployer);
        
        // Grant permissions for department stats
        FHE.allowThis(departmentRatingSum[plaintextDepartmentId]);
        FHE.allowThis(departmentResponseCount[plaintextDepartmentId]);
        FHE.allow(departmentRatingSum[plaintextDepartmentId], deployer);
        FHE.allow(departmentResponseCount[plaintextDepartmentId], deployer);

        hasSubmittedToDepartment[msg.sender][plaintextDepartmentId] = true;

        emit SurveySubmitted(responses.length - 1, msg.sender, block.timestamp);
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
    /// @dev Note: This function only grants manager role. To grant FHE permissions for
    /// specific departments, use grantDepartmentAccess() or grantMultipleDepartmentAccess()
    function addManager(address manager) external onlyManager {
        managers[manager] = true;
        
        if (responses.length > 0) {
            // Grant permissions for total stats (these are always initialized when responses exist)
            FHE.allow(totalRatingSum, manager);
            FHE.allow(responseCount, manager);
        }
        
        emit ManagerAdded(manager, msg.sender);
    }

    /// @notice Remove a manager address
    /// @param manager The address to revoke manager privileges
    function removeManager(address manager) external onlyManager {
        managers[manager] = false;
        emit ManagerRemoved(manager, msg.sender);
    }

    /// @notice Grant FHE permissions to a manager for a specific department
    /// @param manager The manager address
    /// @param departmentId The department ID to grant permissions for
    /// @dev This function allows granting permissions for specific departments
    /// Useful when adding new managers or when new departments are added
    function grantDepartmentAccess(address manager, uint32 departmentId) external onlyManager {
        require(managers[manager], "Address is not a manager");
        FHE.allow(departmentRatingSum[departmentId], manager);
        FHE.allow(departmentResponseCount[departmentId], manager);
    }

    /// @notice Grant FHE permissions to a manager for multiple departments
    /// @param manager The manager address
    /// @param departmentIds Array of department IDs to grant permissions for
    /// @dev Batch function to grant permissions for multiple departments at once
    function grantMultipleDepartmentAccess(address manager, uint32[] calldata departmentIds) external onlyManager {
        require(managers[manager], "Address is not a manager");
        for (uint256 i = 0; i < departmentIds.length; i++) {
            FHE.allow(departmentRatingSum[departmentIds[i]], manager);
            FHE.allow(departmentResponseCount[departmentIds[i]], manager);
        }
    }
}
