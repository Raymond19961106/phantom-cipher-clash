import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedSurvey = await deploy("EmployeeSatisfactionSurvey", {
    from: deployer,
    log: true,
  });

  console.log(`EmployeeSatisfactionSurvey contract: `, deployedSurvey.address);

  const surveyContract = await hre.ethers.getContractAt(
    "EmployeeSatisfactionSurvey",
    deployedSurvey.address
  );
  const isManager = await surveyContract.managers(deployer);
  if (!isManager) {
    throw new Error("Deployer is not set as manager after deployment");
  }
  console.log(`Deployer ${deployer} verified as manager`);
};
export default func;
func.id = "deploy_survey";
func.tags = ["EmployeeSatisfactionSurvey"];
