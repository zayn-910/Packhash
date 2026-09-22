// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PacketRegistry {

    address public owner;
    bytes32 public merkleRoot;
    uint256 public packetCount;
    bool public anchored;

    event RootAnchored(bytes32 root, uint256 count, address indexed anchoredBy);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized: only owner can anchor evidence");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Anchor just the Merkle root + packet count — cheap, constant gas cost
    // regardless of how many packets were captured
    function anchorRoot(bytes32 root, uint256 count) public onlyOwner {
        require(!anchored, "Evidence already anchored. Immutable once set.");
        merkleRoot = root;
        packetCount = count;
        anchored = true;
        emit RootAnchored(root, count, msg.sender);
    }

    function getRoot() public view returns (bytes32) {
        return merkleRoot;
    }

    function getPacketCount() public view returns (uint256) {
        return packetCount;
    }
}
