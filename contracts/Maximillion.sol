pragma solidity ^0.5.16;

import "./GEther.sol";

/**
 * @title Compound's Maximillion Contract
 * @author Compound
 */
contract Maximillion {
    /**
     * @notice The default gEther market to repay in
     */
    GEther public gEther;

    /**
     * @notice Construct a Maximillion to repay max in a GEther market
     */
    constructor(GEther gEther_) public {
        gEther = gEther_;
    }

    /**
     * @notice msg.sender sends Ether to repay an account's borrow in the gEther market
     * @dev The provided Ether is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     */
    function repayBehalf(address borrower) public payable {
        repayBehalfExplicit(borrower, gEther);
    }

    /**
     * @notice msg.sender sends Ether to repay an account's borrow in a gEther market
     * @dev The provided Ether is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     * @param gEther_ The address of the gEther contract to repay in
     */
    function repayBehalfExplicit(address borrower, GEther gEther_) public payable {
        uint received = msg.value;
        uint borrows = gEther_.borrowBalanceCurrent(borrower);
        if (received > borrows) {
            gEther_.repayBorrowBehalf.value(borrows)(borrower);
            msg.sender.transfer(received - borrows);
        } else {
            gEther_.repayBorrowBehalf.value(received)(borrower);
        }
    }
}
