// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint32} from "@fhevm/solidity/lib/FHE.sol";

/// @title Survey Manager Interface
/// @notice Interface for managing employee satisfaction surveys
interface ISurveyManager {
    /// @notice Submit a survey response
    /// @param encryptedRating Encrypted satisfaction rating
    /// @param encryptedDepartment Encrypted department ID
    /// @param encryptedFeedback Encrypted feedback text
    /// @param ratingProof Proof for rating encryption
    /// @param departmentProof Proof for department encryption
    function submitSurvey(
        uint256 encryptedRating,
        uint256 encryptedDepartment,
        bytes calldata encryptedFeedback,
        bytes calldata ratingProof,
        bytes calldata departmentProof
    ) external;

    /// @notice Get response count
    /// @return Encrypted response count
    function getResponseCount() external view returns (euint32);

    /// @notice Get total rating sum
    /// @return Encrypted rating sum
    function getTotalRatingSum() external view returns (euint32);

    /// @notice Check if address has submitted
    /// @param user Address to check
    /// @return True if submitted
    function hasAddressSubmitted(address user) external view returns (bool);

    /// @notice Add a manager
    /// @param manager Manager address to add
    function addManager(address manager) external;
}
