const { expect } = require('chai');
const { ethers } = require('hardhat');

const ether = (number) => {
  return ethers.utils.parseEther(number.toString());
};

const now = () => {
  return Math.floor(Date.now() / 1000);
};

const addSeconds = async (seconds) => {
  await network.provider.send('evm_increaseTime', [seconds]);
  await network.provider.send('evm_mine');
};

let boxingBoyzNFT;
let boxingBoyzToken;
let boxingBoyzStaking;
let standardReward = ether(1000);
let legendReward = ether(1500);
let legendNFTIds = [1, 3, 5];
let nonLegendNFTIds = [3000, 3043, 4231, 5000];
let stakingTimeForRewards = 1814400; // 21 days in seconds

let owner;
let s1;
let s2;
let s3;

const feedStakingContract = async () => {
  await boxingBoyzToken.transfer(boxingBoyzStaking.address, ether('250000000'));
};

const mintApproveStake = async (tokenId) => {
  await boxingBoyzNFT.mint(owner.address, 2);
  await boxingBoyzNFT.approve(boxingBoyzStaking.address, tokenId);
  await boxingBoyzStaking.stake(tokenId);
};

const checkOwners = async (tokenId) => {
  expect(await boxingBoyzNFT.ownerOf(tokenId)).to.equal(
    boxingBoyzStaking.address
  );
  expect(await boxingBoyzNFT.ownerOf(tokenId)).to.not.equal(owner.address);
};

const stakeUnstakeExpect = async (tokenId, time, reward) => {
  await feedStakingContract();
  let beforeBalance = await boxingBoyzToken.balanceOf(owner.address);
  await mintApproveStake(tokenId);
  await checkOwners(tokenId);

  await addSeconds(time);
  await boxingBoyzStaking.unstake(tokenId);

  expect(await boxingBoyzToken.balanceOf(owner.address)).to.equal(
    beforeBalance.add(reward)
  );
};

describe('Boxing Boyz Staking', function () {
  before(async () => {
    this.nftContract = await ethers.getContractFactory('BoxingBoyzNFT');
    this.tokenContract = await ethers.getContractFactory('BoxingBoyzToken');
    this.stakingContract = await ethers.getContractFactory('BoxingBoyzStaking');

    [owner, s1, s2, s3] = await ethers.getSigners();
  });

  beforeEach(async () => {
    boxingBoyzNFT = await this.nftContract.deploy();
    await boxingBoyzNFT.deployed();

    boxingBoyzToken = await this.tokenContract.deploy();
    await boxingBoyzToken.deployed();

    boxingBoyzStaking = await this.stakingContract.deploy(
      legendNFTIds,
      standardReward,
      legendReward,
      boxingBoyzNFT.address,
      boxingBoyzToken.address,
      now() + 300,
      ether(4166667)
    );
    await boxingBoyzStaking.deployed();
  });

  /***************************************************
   *
   *
   *                  VIEWEVER FUNCTIONS
   *
   *
   ***************************************************/

  it('1b token minted to owner', async () => {
    // should be
    expect(await boxingBoyzToken.totalSupply()).to.equal(ether('1000000000'));
    expect(await boxingBoyzToken.balanceOf(owner.address)).to.equal(
      ether('1000000000')
    );

    // should not be
    expect(await boxingBoyzToken.totalSupply()).to.not.equal(ether('1'));
    expect(await boxingBoyzToken.balanceOf(owner.address)).to.not.equal(
      ether('1')
    );
  });

  it('check addresses of token and nft contracts in staking contract', async () => {
    // should be
    expect(await boxingBoyzStaking.BoxingBoyzNFT()).to.equal(
      boxingBoyzNFT.address
    );

    expect(await boxingBoyzStaking.BoxingBoyzToken()).to.equal(
      boxingBoyzToken.address
    );

    // should not be
    expect(await boxingBoyzStaking.BoxingBoyzNFT()).to.not.equal(owner.address);
    expect(await boxingBoyzStaking.BoxingBoyzToken()).to.not.equal(
      owner.address
    );
  });

  it('check claimed tokens', async () => {
    // should be
    expect(await boxingBoyzStaking.claimedTokens()).to.equal(ether(0));

    // should not be
    expect(await boxingBoyzStaking.claimedTokens()).to.not.equal(ether(1));
  });

  it('is legend nfts are correct', async () => {
    // should be
    for (let i = 0; i < legendNFTIds.length; i++) {
      expect(await boxingBoyzStaking.isLegend(legendNFTIds[i])).to.equal(true);
    }

    for (let i = 0; i < nonLegendNFTIds.length; i++) {
      expect(await boxingBoyzStaking.isLegend(nonLegendNFTIds[i])).to.equal(
        false
      );
    }

    // should not be
    for (let i = 0; i < legendNFTIds.length; i++) {
      expect(await boxingBoyzStaking.isLegend(legendNFTIds[i])).to.not.equal(
        false
      );
    }

    for (let i = 0; i < nonLegendNFTIds.length; i++) {
      expect(await boxingBoyzStaking.isLegend(nonLegendNFTIds[i])).to.not.equal(
        true
      );
    }
  });

  /***************************************************
   *
   *
   *                      STAKE
   *
   *
   ***************************************************/

  // staking contract can't transfer tokens from user without approve
  it('stake ~ owner - without approve - reverted', async () => {
    await boxingBoyzNFT.mint(owner.address, 1);
    await expect(boxingBoyzStaking.stake(0)).to.be.revertedWith(
      'ERC721: transfer caller is not owner nor approved'
    );
  });

  // user approves his token to behalf of staking contract and stake
  it('stake ~ owner - legal', async () => {
    await mintApproveStake(0);

    expect(await boxingBoyzStaking.stakingStartTimes(0)).to.not.equal(ether(0));
  });

  // somebody tries to stake unexisted token
  it('stake ~ not owner - non exist nft - reverted', async () => {
    await expect(boxingBoyzStaking.stake(1)).to.be.revertedWith(
      'ERC721: owner query for nonexistent token'
    );
  });

  // somebody tries to stake somebody's token without approve
  it('stake ~ not owner - without approve - reverted', async () => {
    await boxingBoyzNFT.mint(s1.address, 1);
    await expect(boxingBoyzStaking.stake(0)).to.be.revertedWith(
      "BoxingBoyz#Staking: You don't own this token!"
    );
  });

  // somebody tries to stake somebody's token with approve
  it('stake ~ not owner - with approve - reverted', async () => {
    await boxingBoyzNFT.mint(owner.address, 1);
    await boxingBoyzNFT.approve(boxingBoyzStaking.address, 0);

    await expect(boxingBoyzStaking.connect(s1).stake(0)).to.be.revertedWith(
      "BoxingBoyz#Staking: You don't own this token!"
    );
  });

  // owner stakes his standard token for 7 days and calculates his rewards. Which is 0
  it('stake ~ owner - for 7 days with standard nft', async () => {
    await mintApproveStake(0);
    await checkOwners(0);

    await addSeconds(stakingTimeForRewards / 3);
    expect(await boxingBoyzStaking.calculateRewards(0)).to.equal(ether(0));
    expect(await boxingBoyzStaking.calculateRewards(0)).to.not.equal(
      standardReward
    );
  });

  // owner stakes his legend token for 7 days and calculates his rewards. Which is 0
  it('stake ~ owner - for 7 days with legend nft', async () => {
    await mintApproveStake(1);
    await checkOwners(1);

    await addSeconds(stakingTimeForRewards / 3);
    expect(await boxingBoyzStaking.calculateRewards(1)).to.equal(ether(0));
    expect(await boxingBoyzStaking.calculateRewards(1)).to.not.equal(
      legendReward
    );
  });

  // owner stakes his standard token for 21 days and calculates his rewards. Which is 1 standard reward
  it('stake ~ owner - for 21 days with standard nft', async () => {
    await mintApproveStake(0);
    await checkOwners(0);

    await addSeconds(stakingTimeForRewards);
    expect(await boxingBoyzStaking.calculateRewards(0)).to.equal(
      standardReward
    );
  });

  // owner stakes his legend tokens for 21 days and calculates his rewards. Which is 1 legend reward
  it('stake ~ owner - for 21 days with legend nft', async () => {
    await mintApproveStake(1);
    await checkOwners(1);

    await addSeconds(stakingTimeForRewards);
    expect(await boxingBoyzStaking.calculateRewards(1)).to.equal(legendReward);
  });

  // owner stakes his standard token for 21 days and calculates his rewards. Which is 1 standard reward
  it('stake ~ owner - for 210 days with standard nft', async () => {
    await mintApproveStake(0);
    await checkOwners(0);

    await addSeconds(stakingTimeForRewards * 10);
    expect(await boxingBoyzStaking.calculateRewards(0)).to.equal(
      standardReward.mul('10')
    );
  });

  // owner stakes his legend tokens for 21 days and calculates his rewards. Which is 10 legend reward
  it('stake ~ owner - for 210 days with legend nft', async () => {
    await mintApproveStake(1);
    await checkOwners(1);

    await addSeconds(stakingTimeForRewards * 10);
    expect(await boxingBoyzStaking.calculateRewards(1)).to.equal(
      legendReward.mul('10')
    );
  });

  /***************************************************
   *
   *
   *                      UNSTAKE
   *
   *
   ***************************************************/

  // owner tries to unstake his not staked token
  it('unstake ~ owner - not staked token - reverted', async () => {
    await boxingBoyzNFT.mint(owner.address, 1);
    await expect(boxingBoyzStaking.unstake(0)).to.be.revertedWith(
      "BoxingBoyz#Staking: You don't own or you didn't staked this token!"
    );
  });

  // owner stakes his standard token and after 7 days he unstakes his token without rewards
  it('unstake ~ owner - stake and unstake standard token in 7 days', async () => {
    await stakeUnstakeExpect(0, stakingTimeForRewards / 3, ether(0));
  });

  // owner stakes his legend token and after 7 days he unstake his tokens without rewards
  it('unstake ~ owner - stake and unstake legend token in 7 days', async () => {
    await stakeUnstakeExpect(1, stakingTimeForRewards / 3, ether(0));
  });

  it('unstake ~ owner - stake and unstake standard token in 21 days', async () => {
    await stakeUnstakeExpect(0, stakingTimeForRewards, standardReward);
  });

  it('unstake ~ owner - stake and unstake legend token in 21 days', async () => {
    await stakeUnstakeExpect(1, stakingTimeForRewards, legendReward);
  });

  it('unstake ~ owner - stake and unstake standard token in 210 days', async () => {
    await stakeUnstakeExpect(
      0,
      stakingTimeForRewards * 10,
      standardReward.mul(10)
    );
  });

  it('unstake ~ owner - stake and unstake legend token in 210 days', async () => {
    await stakeUnstakeExpect(
      1,
      stakingTimeForRewards * 10,
      legendReward.mul(10)
    );
  });

  it('unstake ~ owner - before IEO standard token - zero reward', async () => {
    await stakeUnstakeExpect(0, 3, ether(0));
  });

  it('unstake ~ not owner - non exist token - reverted', async () => {
    await expect(boxingBoyzStaking.unstake(0)).to.be.revertedWith(
      "BoxingBoyz#Staking: You don't own or you didn't staked this token!"
    );
  });

  it('unstake ~ not owner - unstaked token - reverted', async () => {
    await boxingBoyzNFT.mint(owner.address, 1);
    await expect(boxingBoyzStaking.unstake(0)).to.be.revertedWith(
      "BoxingBoyz#Staking: You don't own or you didn't staked this token!"
    );
  });

  it('unstake ~ not owner - staked standard token - reverted', async () => {
    await mintApproveStake(0);

    await expect(boxingBoyzStaking.connect(s1).unstake(0)).to.be.revertedWith(
      "BoxingBoyz#Staking: You don't own or you didn't staked this token!"
    );
  });

  it('unstake ~ not owner - staked legend token - reverted', async () => {
    await mintApproveStake(1);

    await expect(boxingBoyzStaking.connect(s1).unstake(0)).to.be.revertedWith(
      "BoxingBoyz#Staking: You don't own or you didn't staked this token!"
    );
  });

  it('integrated - user stakes standard token for 3 seconds, ieo time changes to earlier time and user unstakes', async () => {
    const _beforeBalance = await boxingBoyzToken.balanceOf(owner.address);

    await mintApproveStake(0);

    await boxingBoyzStaking.setIEOTime(now() - 3);

    await boxingBoyzStaking.unstake(0);

    expect(await boxingBoyzToken.balanceOf(owner.address)).to.equal(
      _beforeBalance
    );
  });

  it('integrated - user stakes legend token for 3 seconds, ieo time changes to earlier time and user unstakes', async () => {
    const _beforeBalance = await boxingBoyzToken.balanceOf(owner.address);

    await mintApproveStake(1);

    await boxingBoyzStaking.setIEOTime(now() - 3);

    await boxingBoyzStaking.unstake(1);

    expect(await boxingBoyzToken.balanceOf(owner.address)).to.equal(
      _beforeBalance
    );
  });

  it('integrated - ieo time 50 days after launch - user stakes & unstakes for 21 days standard token', async () => {
    await boxingBoyzStaking.setIEOTime(1735127839 + 4320000);
    await stakeUnstakeExpect(0, stakingTimeForRewards, ether(0));
  });

  it('there are only 10 claimable tokens - user stakes for 21 days', async () => {
    let _boxingBoyzStaking = await this.stakingContract.deploy(
      legendNFTIds,
      standardReward,
      legendReward,
      boxingBoyzNFT.address,
      boxingBoyzToken.address,
      now() + 300,
      ether(10)
    );
    await _boxingBoyzStaking.deployed();
    await boxingBoyzToken.transfer(
      _boxingBoyzStaking.address,
      ether('250000000')
    );

    let _beforeBalance = await boxingBoyzToken.balanceOf(owner.address);
    await boxingBoyzNFT.mint(owner.address, 1);
    await boxingBoyzNFT.approve(_boxingBoyzStaking.address, 0);
    await _boxingBoyzStaking.stake(0);

    addSeconds(stakingTimeForRewards);

    await _boxingBoyzStaking.unstake(0);

    expect(await boxingBoyzToken.balanceOf(owner.address)).to.equal(
      _beforeBalance.add(ether(10))
    );
  });

  it('withdraw all tokens', async () => {
    feedStakingContract();
    let _beforeBalance = await boxingBoyzToken.balanceOf(owner.address);

    await boxingBoyzStaking.withdrawToken(
      boxingBoyzToken.address,
      ether(250000000)
    );

    expect(await boxingBoyzToken.balanceOf(owner.address)).to.equal(
      _beforeBalance.add(ether(250000000))
    );
  });

  it('remove from stakedTokensByAddress', async () => {
    await mintApproveStake(0);

    expect(
      (await boxingBoyzStaking.allStakedTokensByOwner(owner.address)).length
    ).to.equal(1);

    await boxingBoyzStaking.unstake(0);

    expect(
      (await boxingBoyzStaking.allStakedTokensByOwner(owner.address)).length
    ).to.equal(0);
  });
});
