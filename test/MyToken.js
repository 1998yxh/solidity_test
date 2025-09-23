const hre = require("hardhat");
const { expect } = require("chai");

let MyTokenContract;

describe("MyToken contract", async () => {
    beforeEach( async function () {
        const MyToken = await hre.ethers.getContractFactory("MyToken");
        MyTokenContract = await MyToken.deploy(1000)
        MyTokenContract.waitForDeployment()
        let MyTokenAddress = await MyTokenContract.getAddress()
        expect(MyTokenAddress).to.have.length.greaterThan(0)
    })

    it("Should have correct name and symbol", async function () {
        expect(await MyTokenContract.name()).to.equal("MyToken");
        expect(await MyTokenContract.symbol()).to.equal("MTK");
    });

    it("test transfer", async function () {
        expect(await MyTokenContract.name()).to.equal("MyToken");
        expect(await MyTokenContract.symbol()).to.equal("MTK");
    });

});