// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BoxingBoyzToken is ERC20 {
    constructor() ERC20("Boxing Boyz Token", "BBT") {
        super._mint(msg.sender, 1_000_000_000 * 10**18);
    }
}
