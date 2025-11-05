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
};
export default func;
func.id = "deploy_survey"; // id required to prevent reexecution
func.tags = ["EmployeeSatisfactionSurvey"];
