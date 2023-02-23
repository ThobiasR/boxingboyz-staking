//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BoxingBoyzStaking is Ownable {
    // Boxing Boyz NFT contract
    IERC721 public BoxingBoyzNFT;

    // Boxing Boyz Token contract
    IERC20 public BoxingBoyzToken;

    // tokenId => staking start time
    mapping(uint256 => uint256) public stakingStartTimes;

    // ===== 1 SLOT
    // staking start time / contract deploy time
    uint32 public immutable launchTime;

    // If users do not stake by at least the following time, they will not receive any rewards
    uint32 public stakingTimeForRewards = 21 days;

    // before this time, there will be no rewards
    uint32 public IEOTime;

    // all staked token amount
    uint32 public totalStaked;
    // ===== 1 SLOT

    // how much tokens claimed for now
    uint256 public claimedTokens;

    // how much tokens can claim in a month
    uint256 public claimableTokensPerMonth;

    // if user's token is not legend, then he/she will get these amount of tokens as rewards
    uint256 public standardRewards;

    // for legend boyz
    uint256 public legendRewards;

    // legend boyz
    mapping(uint256 => bool) public isLegend;

    // staked tokens of an address
    mapping(address => uint256[]) public stakedTokensByAddress;

    // we have to know owners of tokens
    mapping(uint256 => address) public realOwners;

    constructor(
        uint256[] memory _legendBoyz,
        uint256 _standardRewards,
        uint256 _legendRewards,
        address _boxingBoyzNftAddress,
        address _boxingBoyzTokenAddress,
        uint32 _ieoTime,
        uint256 _claimableTokensPerMonth
    ) {
        launchTime = uint32(block.timestamp);
        standardRewards = _standardRewards;
        legendRewards = _legendRewards;

        for (uint256 i; i < _legendBoyz.length; i++) {
            isLegend[_legendBoyz[i]] = true;
        }

        BoxingBoyzNFT = IERC721(_boxingBoyzNftAddress);
        BoxingBoyzToken = IERC20(_boxingBoyzTokenAddress);

        IEOTime = _ieoTime;
        claimableTokensPerMonth = _claimableTokensPerMonth;
    }

    // FUNCTIONS
    function stake(uint256 tokenId) external {
        require(
            msg.sender == BoxingBoyzNFT.ownerOf(tokenId),
            "BoxingBoyz#Staking: You don't own this token!"
        );
        require(
            stakingStartTimes[tokenId] == 0,
            "BoxingBoyz#Staking: This token already staked!"
        );

        BoxingBoyzNFT.transferFrom(msg.sender, address(this), tokenId);
        stakingStartTimes[tokenId] = block.timestamp;
        stakedTokensByAddress[msg.sender].push(tokenId);
        realOwners[tokenId] = msg.sender;
        totalStaked++;
    }

    function unstake(uint256 tokenId) external {
        require(
            realOwners[tokenId] == msg.sender &&
                stakingStartTimes[tokenId] != 0,
            "BoxingBoyz#Staking: You don't own or you didn't staked this token!"
        );

        uint256 rewards = calculateRewards(tokenId);

        stakingStartTimes[tokenId] = 0;
        removeStakedTokenFromList(tokenId);
        realOwners[tokenId] = address(0);
        totalStaked--;

        BoxingBoyzNFT.transferFrom(address(this), msg.sender, tokenId);

        if (rewards > 0) {
            BoxingBoyzToken.transfer(msg.sender, rewards);
        }
    }

    function removeStakedTokenFromList(uint256 tokenId) private {
        uint256[] memory _list = stakedTokensByAddress[msg.sender];

        for (uint256 i; i < _list.length; i++) {
            if (tokenId == _list[i]) {
                stakedTokensByAddress[msg.sender][i] = _list[_list.length - 1];
                stakedTokensByAddress[msg.sender].pop();
                return;
            }
        }
    }

    function calculateRewards(uint256 tokenId) public view returns (uint256) {
        uint256 rewards;
        uint256 _startTime = stakingStartTimes[tokenId];
        uint256 stakeTime = block.timestamp - _startTime;

        if (
            _startTime == 0 ||
            block.timestamp < IEOTime ||
            stakingTimeForRewards > stakeTime
        ) return 0;

        uint256 _passedMonths = ((block.timestamp - launchTime) / 30 days) + 1;

        uint256 _availableTokens = (_passedMonths * claimableTokensPerMonth) -
            claimedTokens;

        if (!isLegend[tokenId]) {
            rewards = (stakeTime / stakingTimeForRewards) * standardRewards;
        } else {
            rewards = (stakeTime / stakingTimeForRewards) * legendRewards;
        }

        // if there is no enough tokens for user, send it all
        if (rewards > _availableTokens) {
            rewards = _availableTokens;
        }
        return rewards;
    }

    function allStakedTokensByOwner(address _owner)
        external
        view
        returns (uint256[] memory)
    {
        return stakedTokensByAddress[_owner];
    }

    function getAllInfo(uint256 tokenId)
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        uint256 rewardAmount = isLegend[tokenId]
            ? legendRewards
            : standardRewards;
        return (
            stakingStartTimes[tokenId],
            calculateRewards(tokenId),
            rewardAmount
        );
    }

    // Set / OnlyOwner FUNCTIONS
    function setStakingTimeForRewards(uint32 _new) external onlyOwner {
        stakingTimeForRewards = _new;
    }

    function setIEOTime(uint32 _new) external onlyOwner {
        IEOTime = _new;
    }

    function withdrawToken(address _tokenAddress, uint256 amount)
        external
        onlyOwner
    {
        IERC20(_tokenAddress).transfer(msg.sender, amount);
    }
}
