import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { EmployeeSatisfactionSurvey } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("EmployeeSatisfactionSurveySepolia", function () {
  let signers: Signers;
  let surveyContract: EmployeeSatisfactionSurvey;
  let surveyContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const surveyDeployment = await deployments.get("EmployeeSatisfactionSurvey");
      surveyContractAddress = surveyDeployment.address;
      surveyContract = await ethers.getContractAt("EmployeeSatisfactionSurvey", surveyDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("should submit a survey response", async function () {
    steps = 10;

    this.timeout(4 * 40000);

    const rating = 5;
    const department = 1;

    progress(`Encrypting rating '${rating}'...`);
    const encryptedRating = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(rating)
      .encrypt();

    progress(`Encrypting department '${department}'...`);
    const encryptedDepartment = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add32(department)
      .encrypt();

    progress(
      `Call submitSurvey() Survey=${surveyContractAddress} signer=${signers.alice.address}...`,
    );
    const tx = await surveyContract
      .connect(signers.alice)
      .submitSurvey(
        encryptedRating.handles[0],
        encryptedDepartment.handles[0],
        "0x",
        encryptedRating.inputProof,
        encryptedDepartment.inputProof
      );
    await tx.wait();

    progress(`Call getResponseCount()...`);
    const responseCount = await surveyContract.getResponseCount();
    expect(responseCount).to.not.eq(ethers.ZeroHash);

    progress(`Decrypting getResponseCount()=${responseCount}...`);
    const clearCount = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      responseCount,
      surveyContractAddress,
      signers.alice,
    );
    progress(`Clear getResponseCount()=${clearCount}`);

    expect(clearCount).to.be.gte(1);
  });
});

