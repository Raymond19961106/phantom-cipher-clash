import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { EmployeeSatisfactionSurvey, EmployeeSatisfactionSurvey__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EmployeeSatisfactionSurvey")) as EmployeeSatisfactionSurvey__factory;
  const surveyContract = (await factory.deploy()) as EmployeeSatisfactionSurvey;
  const surveyContractAddress = await surveyContract.getAddress();

  return { surveyContract, surveyContractAddress };
}

describe("EmployeeSatisfactionSurvey", function () {
  let signers: Signers;
  let surveyContract: EmployeeSatisfactionSurvey;
  let surveyContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ surveyContract, surveyContractAddress } = await deployFixture());
  });

  it("should initialize with deployer as manager", async function () {
    const isManager = await surveyContract.managers(signers.deployer.address);
    expect(isManager).to.be.true;
  });

  it("should allow manager to add another manager", async function () {
    const tx = await surveyContract.addManager(signers.alice.address);
    await tx.wait();

    const isManager = await surveyContract.managers(signers.alice.address);
    expect(isManager).to.be.true;
  });

  it("should allow manager to remove a manager", async function () {
    await surveyContract.addManager(signers.alice.address);
    const tx = await surveyContract.removeManager(signers.alice.address);
    await tx.wait();

    const isManager = await surveyContract.managers(signers.alice.address);
    expect(isManager).to.be.false;
  });

  it("should submit a survey response", async function () {
    const rating = 5;
    const department = 1;

    // Encrypt the rating and department
    const encryptedRating = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(rating)
      .encrypt();

    const encryptedDepartment = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(department)
      .encrypt();

    const emptyFeedback = "0x";

    const tx = await surveyContract
      .connect(signers.alice)
      .submitSurvey(
        encryptedRating.handles[0],
        encryptedDepartment.handles[0],
        emptyFeedback,
        encryptedRating.inputProof,
        encryptedDepartment.inputProof
      );
    await tx.wait();

    const responseCount = await surveyContract.getResponseCount();
    expect(responseCount).to.not.eq(ethers.ZeroHash);

    const clearCount = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      responseCount,
      surveyContractAddress,
      signers.deployer,
    );

    expect(clearCount).to.eq(1);
  });

  it("should aggregate multiple survey responses", async function () {
    const ratings = [5, 4, 3];
    const department = 1;

    for (const rating of ratings) {
      const encryptedRating = await fhevm
        .createEncryptedInput(surveyContractAddress, signers.alice.address)
        .add32(rating)
        .encrypt();

      const encryptedDepartment = await fhevm
        .createEncryptedInput(surveyContractAddress, signers.alice.address)
        .add32(department)
        .encrypt();

      const emptyFeedback = "0x";

      const tx = await surveyContract
        .connect(signers.alice)
        .submitSurvey(
          encryptedRating.handles[0],
          encryptedDepartment.handles[0],
          emptyFeedback,
          encryptedRating.inputProof,
          encryptedDepartment.inputProof
        );
      await tx.wait();
    }

    const responseCount = await surveyContract.getResponseCount();
    const totalRatingSum = await surveyContract.getTotalRatingSum();

    const clearCount = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      responseCount,
      surveyContractAddress,
      signers.deployer,
    );

    const clearSum = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      totalRatingSum,
      surveyContractAddress,
      signers.deployer,
    );

    expect(clearCount).to.eq(3);
    expect(clearSum).to.eq(12); // 5 + 4 + 3
  });

  it("should not allow non-manager to view statistics", async function () {
    const encryptedRating = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(5)
      .encrypt();

    const encryptedDepartment = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(1)
      .encrypt();

    await surveyContract
      .connect(signers.alice)
      .submitSurvey(
        encryptedRating.handles[0],
        encryptedDepartment.handles[0],
        "0x",
        encryptedRating.inputProof,
        encryptedDepartment.inputProof
      );

    await expect(
      surveyContract.connect(signers.alice).getResponseCount()
    ).to.be.revertedWith("Only managers can access this function");
  });
});

