import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact Locally (--network localhost)
 * ===========================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the EmployeeSatisfactionSurvey contract
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the contract
 *
 *   npx hardhat --network localhost task:submit-survey --rating 5 --department 1
 *   npx hardhat --network localhost task:get-stats
 *
 *
 * Tutorial: Deploy and Interact on Sepolia (--network sepolia)
 * ===========================================================
 *
 * 1. Deploy the EmployeeSatisfactionSurvey contract
 *
 *   npx hardhat --network sepolia deploy
 *
 * 2. Interact with the contract
 *
 *   npx hardhat --network sepolia task:submit-survey --rating 5 --department 1
 *   npx hardhat --network sepolia task:get-stats
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost task:address
 *   - npx hardhat --network sepolia task:address
 */
task("task:address", "Prints the EmployeeSatisfactionSurvey address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const survey = await deployments.get("EmployeeSatisfactionSurvey");

  console.log("EmployeeSatisfactionSurvey address is " + survey.address);
});

/**
 * Example:
 *   - npx hardhat --network localhost task:submit-survey --rating 5 --department 1
 *   - npx hardhat --network sepolia task:submit-survey --rating 5 --department 1
 */
task("task:submit-survey", "Submits a survey response")
  .addOptionalParam("address", "Optionally specify the Survey contract address")
  .addParam("rating", "The satisfaction rating (1-5)")
  .addParam("department", "The department ID")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const rating = parseInt(taskArguments.rating);
    const department = parseInt(taskArguments.department);
    
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error(`Argument --rating must be an integer between 1 and 5`);
    }
    
    if (!Number.isInteger(department)) {
      throw new Error(`Argument --department must be an integer`);
    }

    await fhevm.initializeCLIApi();

    const surveyDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EmployeeSatisfactionSurvey");
    console.log(`EmployeeSatisfactionSurvey: ${surveyDeployment.address}`);

    const signers = await ethers.getSigners();

    const surveyContract = await ethers.getContractAt("EmployeeSatisfactionSurvey", surveyDeployment.address);

    // Encrypt the rating and department
    const encryptedRating = await fhevm
      .createEncryptedInput(surveyDeployment.address, signers[0].address)
      .add32(rating)
      .encrypt();

    const encryptedDepartment = await fhevm
      .createEncryptedInput(surveyDeployment.address, signers[0].address)
      .add32(department)
      .encrypt();

    // Empty feedback for now (can be extended)
    const emptyFeedback = "0x";

    const tx = await surveyContract
      .connect(signers[0])
      .submitSurvey(
        encryptedRating.handles[0],
        encryptedDepartment.handles[0],
        emptyFeedback,
        encryptedRating.inputProof,
        encryptedDepartment.inputProof
      );
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log(`Survey submission succeeded! Rating: ${rating}, Department: ${department}`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:get-stats
 *   - npx hardhat --network sepolia task:get-stats
 */
task("task:get-stats", "Gets aggregated survey statistics")
  .addOptionalParam("address", "Optionally specify the Survey contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const surveyDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EmployeeSatisfactionSurvey");
    console.log(`EmployeeSatisfactionSurvey: ${surveyDeployment.address}`);

    const signers = await ethers.getSigners();

    const surveyContract = await ethers.getContractAt("EmployeeSatisfactionSurvey", surveyDeployment.address);

    // Check if caller is a manager
    const isManager = await surveyContract.managers(signers[0].address);
    if (!isManager) {
      console.log("Warning: You are not a manager. Some functions may fail.");
    }

    const responseCount = await surveyContract.getResponseCount();
    const totalRatingSum = await surveyContract.getTotalRatingSum();
    const responseArrayLength = await surveyContract.getResponseArrayLength();

    console.log(`Response Array Length: ${responseArrayLength}`);

    if (responseCount === ethers.ZeroHash) {
      console.log("No responses yet");
      return;
    }

    const clearCount = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      responseCount,
      surveyDeployment.address,
      signers[0],
    );

    const clearSum = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      totalRatingSum,
      surveyDeployment.address,
      signers[0],
    );

    console.log(`Encrypted Response Count: ${responseCount}`);
    console.log(`Clear Response Count: ${clearCount}`);
    console.log(`Encrypted Rating Sum: ${totalRatingSum}`);
    console.log(`Clear Rating Sum: ${clearSum}`);
    
    if (clearCount > 0) {
      const average = Number(clearSum) / Number(clearCount);
      console.log(`Average Rating: ${average.toFixed(2)}`);
    }
  });
