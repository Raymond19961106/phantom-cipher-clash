import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { EmployeeSatisfactionSurvey, EmployeeSatisfactionSurvey__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
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
    signers = { 
      deployer: ethSigners[0], 
      alice: ethSigners[1], 
      bob: ethSigners[2],
      charlie: ethSigners[3]
    };
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
    const plaintextDepartmentId = 1;

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
        plaintextDepartmentId,
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
    const plaintextDepartmentId = 1;
    const signersList = [signers.alice, signers.bob, signers.deployer];

    for (let i = 0; i < ratings.length; i++) {
      const rating = ratings[i];
      const signer = signersList[i];

      const encryptedRating = await fhevm
        .createEncryptedInput(surveyContractAddress, signer.address)
        .add32(rating)
        .encrypt();

      const encryptedDepartment = await fhevm
        .createEncryptedInput(surveyContractAddress, signer.address)
        .add32(department)
        .encrypt();

      const emptyFeedback = "0x";

      const tx = await surveyContract
        .connect(signer)
        .submitSurvey(
          encryptedRating.handles[0],
          encryptedDepartment.handles[0],
          plaintextDepartmentId,
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
    const rating = 5;
    const department = 1;
    const plaintextDepartmentId = 1;

    const encryptedRating = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(rating)
      .encrypt();

    const encryptedDepartment = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(department)
      .encrypt();

    await surveyContract
      .connect(signers.alice)
      .submitSurvey(
        encryptedRating.handles[0],
        encryptedDepartment.handles[0],
        plaintextDepartmentId,
        "0x",
        encryptedRating.inputProof,
        encryptedDepartment.inputProof
      );

    await expect(
      surveyContract.connect(signers.alice).getResponseCount()
    ).to.be.revertedWith("Only managers can access this function");
  });

  it("should not allow duplicate submissions to the same department from same address", async function () {
    const rating = 5;
    const department = 1;
    const plaintextDepartmentId = 1;

    const encryptedRating = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(rating)
      .encrypt();

    const encryptedDepartment = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(department)
      .encrypt();

    const emptyFeedback = "0x";

    await surveyContract
      .connect(signers.alice)
      .submitSurvey(
        encryptedRating.handles[0],
        encryptedDepartment.handles[0],
        plaintextDepartmentId,
        emptyFeedback,
        encryptedRating.inputProof,
        encryptedDepartment.inputProof
      );

    const encryptedRating2 = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(4)
      .encrypt();

    const encryptedDepartment2 = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(department)
      .encrypt();

    // Try to submit to the same department again - should fail
    await expect(
      surveyContract
        .connect(signers.alice)
        .submitSurvey(
          encryptedRating2.handles[0],
          encryptedDepartment2.handles[0],
          plaintextDepartmentId, // Same department
          emptyFeedback,
          encryptedRating2.inputProof,
          encryptedDepartment2.inputProof
        )
    ).to.be.revertedWith("Address has already submitted a survey to this department");
  });

  it("should allow same address to submit to different departments", async function () {
    const rating1 = 5;
    const department1 = 1;
    const plaintextDept1 = 1;

    const rating2 = 4;
    const department2 = 2;
    const plaintextDept2 = 2;

    // Submit to department 1
    const encryptedRating1 = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(rating1)
      .encrypt();

    const encryptedDepartment1 = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(department1)
      .encrypt();

    await surveyContract
      .connect(signers.alice)
      .submitSurvey(
        encryptedRating1.handles[0],
        encryptedDepartment1.handles[0],
        plaintextDept1,
        "0x",
        encryptedRating1.inputProof,
        encryptedDepartment1.inputProof
      );

    // Submit to department 2 - should succeed
    const encryptedRating2 = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(rating2)
      .encrypt();

    const encryptedDepartment2 = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(department2)
      .encrypt();

    const tx = await surveyContract
      .connect(signers.alice)
      .submitSurvey(
        encryptedRating2.handles[0],
        encryptedDepartment2.handles[0],
        plaintextDept2,
        "0x",
        encryptedRating2.inputProof,
        encryptedDepartment2.inputProof
      );
    await tx.wait();

    // Verify both departments have received submissions
    const [dept1RatingSum, dept1Count] = await surveyContract.getDepartmentStats(plaintextDept1);
    const [dept2RatingSum, dept2Count] = await surveyContract.getDepartmentStats(plaintextDept2);

    const clearDept1Sum = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      dept1RatingSum,
      surveyContractAddress,
      signers.deployer,
    );
    const clearDept1Count = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      dept1Count,
      surveyContractAddress,
      signers.deployer,
    );

    const clearDept2Sum = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      dept2RatingSum,
      surveyContractAddress,
      signers.deployer,
    );
    const clearDept2Count = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      dept2Count,
      surveyContractAddress,
      signers.deployer,
    );

    expect(clearDept1Sum).to.eq(5);
    expect(clearDept1Count).to.eq(1);
    expect(clearDept2Sum).to.eq(4);
    expect(clearDept2Count).to.eq(1);
  });

  it("should handle edge case: minimum rating value", async function () {
    const rating = 1;
    const department = 1;
    const plaintextDepartmentId = 1;

    const encryptedRating = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(rating)
      .encrypt();

    const encryptedDepartment = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(department)
      .encrypt();

    const tx = await surveyContract
      .connect(signers.alice)
      .submitSurvey(
        encryptedRating.handles[0],
        encryptedDepartment.handles[0],
        plaintextDepartmentId,
        "0x",
        encryptedRating.inputProof,
        encryptedDepartment.inputProof
      );
    await tx.wait();

    const responseCount = await surveyContract.getResponseCount();
    const clearCount = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      responseCount,
      surveyContractAddress,
      signers.deployer,
    );
    expect(clearCount).to.eq(1);
  });

  it("should handle edge case: maximum rating value", async function () {
    const rating = 5;
    const department = 1;
    const plaintextDepartmentId = 1;

    const encryptedRating = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(rating)
      .encrypt();

    const encryptedDepartment = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(department)
      .encrypt();

    const tx = await surveyContract
      .connect(signers.alice)
      .submitSurvey(
        encryptedRating.handles[0],
        encryptedDepartment.handles[0],
        plaintextDepartmentId,
        "0x",
        encryptedRating.inputProof,
        encryptedDepartment.inputProof
      );
    await tx.wait();

    const responseCount = await surveyContract.getResponseCount();
    const clearCount = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      responseCount,
      surveyContractAddress,
      signers.deployer,
    );
    expect(clearCount).to.eq(1);
  });

  it("should prevent non-manager from adding managers", async function () {
    await expect(
      surveyContract.connect(signers.alice).addManager(signers.bob.address)
    ).to.be.revertedWith("Only managers can access this function");
  });

  it("should prevent non-manager from removing managers", async function () {
    await surveyContract.addManager(signers.alice.address);
    // bob is not a manager, so he should not be able to remove a manager
    await expect(
      surveyContract.connect(signers.bob).removeManager(signers.alice.address)
    ).to.be.revertedWith("Only managers can access this function");
  });

  it("should track department statistics", async function () {
    const dept1Ratings = [5, 4];
    const dept2Ratings = [3, 2];
    const plaintextDept1 = 1;
    const plaintextDept2 = 2;

    // Submit surveys for department 1
    for (let i = 0; i < dept1Ratings.length; i++) {
      const signer = i === 0 ? signers.alice : signers.bob;
      const rating = dept1Ratings[i];

      const encryptedRating = await fhevm
        .createEncryptedInput(surveyContractAddress, signer.address)
        .add32(rating)
        .encrypt();

      const encryptedDepartment = await fhevm
        .createEncryptedInput(surveyContractAddress, signer.address)
        .add32(plaintextDept1)
        .encrypt();

      await surveyContract
        .connect(signer)
        .submitSurvey(
          encryptedRating.handles[0],
          encryptedDepartment.handles[0],
          plaintextDept1,
          "0x",
          encryptedRating.inputProof,
          encryptedDepartment.inputProof
        );
    }

    // Submit surveys for department 2
    for (let i = 0; i < dept2Ratings.length; i++) {
      const signer = i === 0 ? signers.deployer : signers.charlie;
      const rating = dept2Ratings[i];

      const encryptedRating = await fhevm
        .createEncryptedInput(surveyContractAddress, signer.address)
        .add32(rating)
        .encrypt();

      const encryptedDepartment = await fhevm
        .createEncryptedInput(surveyContractAddress, signer.address)
        .add32(plaintextDept2)
        .encrypt();

      await surveyContract
        .connect(signer)
        .submitSurvey(
          encryptedRating.handles[0],
          encryptedDepartment.handles[0],
          plaintextDept2,
          "0x",
          encryptedRating.inputProof,
          encryptedDepartment.inputProof
        );
    }

    // Check department 1 stats
    const [dept1RatingSum, dept1Count] = await surveyContract.getDepartmentStats(plaintextDept1);
    const clearDept1Sum = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      dept1RatingSum,
      surveyContractAddress,
      signers.deployer,
    );
    const clearDept1Count = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      dept1Count,
      surveyContractAddress,
      signers.deployer,
    );

    expect(clearDept1Sum).to.eq(9); // 5 + 4
    expect(clearDept1Count).to.eq(2);

    // Check department 2 stats
    const [dept2RatingSum, dept2Count] = await surveyContract.getDepartmentStats(plaintextDept2);
    const clearDept2Sum = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      dept2RatingSum,
      surveyContractAddress,
      signers.deployer,
    );
    const clearDept2Count = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      dept2Count,
      surveyContractAddress,
      signers.deployer,
    );

    expect(clearDept2Sum).to.eq(5); // 3 + 2
    expect(clearDept2Count).to.eq(2);
  });

  it("should allow manager to grant department access", async function () {
    const rating = 5;
    const department = 3;
    const plaintextDepartmentId = 3;

    // Submit a survey first to initialize department stats
    const encryptedRating = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(rating)
      .encrypt();

    const encryptedDepartment = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(department)
      .encrypt();

    await surveyContract
      .connect(signers.alice)
      .submitSurvey(
        encryptedRating.handles[0],
        encryptedDepartment.handles[0],
        plaintextDepartmentId,
        "0x",
        encryptedRating.inputProof,
        encryptedDepartment.inputProof
      );

    // Add bob as manager (this will grant permissions for departments 1-8 if responses exist)
    await surveyContract.addManager(signers.bob.address);

    // Grant department access to bob for department 3
    const tx = await surveyContract.grantDepartmentAccess(signers.bob.address, plaintextDepartmentId);
    await tx.wait();

    // Bob should now be able to access department stats
    const [deptRatingSum, deptCount] = await surveyContract.connect(signers.bob).getDepartmentStats(plaintextDepartmentId);
    
    const clearDeptSum = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      deptRatingSum,
      surveyContractAddress,
      signers.bob,
    );
    const clearDeptCount = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      deptCount,
      surveyContractAddress,
      signers.bob,
    );

    expect(clearDeptSum).to.eq(5);
    expect(clearDeptCount).to.eq(1);
  });

  it("should allow manager to grant multiple department access", async function () {
    const plaintextDeptIds = [4, 5, 6];
    const ratings = [3, 4, 5];

    // First, submit surveys to initialize department stats
    for (let i = 0; i < plaintextDeptIds.length; i++) {
      const deptId = plaintextDeptIds[i];
      const rating = ratings[i];
      const signer = i === 0 ? signers.alice : (i === 1 ? signers.bob : signers.charlie);

      const encryptedRating = await fhevm
        .createEncryptedInput(surveyContractAddress, signer.address)
        .add32(rating)
        .encrypt();

      const encryptedDepartment = await fhevm
        .createEncryptedInput(surveyContractAddress, signer.address)
        .add32(deptId)
        .encrypt();

      await surveyContract
        .connect(signer)
        .submitSurvey(
          encryptedRating.handles[0],
          encryptedDepartment.handles[0],
          deptId,
          "0x",
          encryptedRating.inputProof,
          encryptedDepartment.inputProof
        );
    }

    // Add a new manager (charlie is already used, so we'll use deployer to add bob)
    // Actually, let's use a different approach - add bob as manager first
    await surveyContract.addManager(signers.bob.address);

    // Grant access to multiple departments
    const tx = await surveyContract.grantMultipleDepartmentAccess(signers.bob.address, plaintextDeptIds);
    await tx.wait();

    // Bob should be able to access all granted departments
    for (let i = 0; i < plaintextDeptIds.length; i++) {
      const deptId = plaintextDeptIds[i];
      const [deptRatingSum, deptCount] = await surveyContract.connect(signers.bob).getDepartmentStats(deptId);
      
      const clearDeptSum = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        deptRatingSum,
        surveyContractAddress,
        signers.bob,
      );
      const clearDeptCount = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        deptCount,
        surveyContractAddress,
        signers.bob,
      );

      expect(clearDeptSum).to.eq(ratings[i]);
      expect(clearDeptCount).to.eq(1);
    }
  });

  it("should not allow non-manager to grant department access", async function () {
    await expect(
      surveyContract.connect(signers.alice).grantDepartmentAccess(signers.bob.address, 1)
    ).to.be.revertedWith("Only managers can access this function");
  });

  it("should not allow granting access to non-manager address", async function () {
    await expect(
      surveyContract.grantDepartmentAccess(signers.alice.address, 1)
    ).to.be.revertedWith("Address is not a manager");
  });

  it("should return correct response array length", async function () {
    const initialLength = await surveyContract.getResponseArrayLength();
    expect(initialLength).to.eq(0);

    const rating = 5;
    const department = 1;
    const plaintextDepartmentId = 1;

    const encryptedRating = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(rating)
      .encrypt();

    const encryptedDepartment = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(department)
      .encrypt();

    await surveyContract
      .connect(signers.alice)
      .submitSurvey(
        encryptedRating.handles[0],
        encryptedDepartment.handles[0],
        plaintextDepartmentId,
        "0x",
        encryptedRating.inputProof,
        encryptedDepartment.inputProof
      );

    const newLength = await surveyContract.getResponseArrayLength();
    expect(newLength).to.eq(1);
  });
});

