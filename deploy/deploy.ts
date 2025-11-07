import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log(`Deploying EmployeeSatisfactionSurvey with deployer: ${deployer}`);

  const deployedSurvey = await deploy("EmployeeSatisfactionSurvey", {
    from: deployer,
    log: true,
    args: [],
  });

  console.log(`EmployeeSatisfactionSurvey contract deployed at: ${deployedSurvey.address}`);

  // Verify deployment
  if (deployedSurvey.newlyDeployed) {
    console.log("✅ Contract newly deployed");
  } else {
    console.log("ℹ️  Contract already deployed, using existing deployment");
  }
};
export default func;
func.id = "deploy_survey"; // id required to prevent reexecution
func.tags = ["EmployeeSatisfactionSurvey"];
