/// SPACE ID Agent ID 的只读表面。
/// 故意不包含 register / adminRegister：这个网站不领取、不铸造 Agent ID。
export const agentAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "ownerOfHandle",
    stateMutability: "view",
    inputs: [{ name: "handle", type: "string" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "handleOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "isValidHandle",
    stateMutability: "view",
    inputs: [{ name: "handle", type: "string" }],
    outputs: [{ type: "bool" }],
  },
] as const
