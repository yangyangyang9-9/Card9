import { ethers } from 'ethers'

let provider = null
let signer = null
let contract = null

export async function initContract() {
  if (!window.ethereum) {
    throw new Error('请安装 MetaMask 钱包')
  }

  provider = new ethers.BrowserProvider(window.ethereum)
  signer = await provider.getSigner()
  
  const abiResponse = await fetch('/abi.json')
  const { abi } = await abiResponse.json()
  const { CONTRACT_ADDRESS } = await import('./constants')
  
  contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer)
  
  console.log('钱包地址:', await signer.getAddress())
  console.log('合约地址:', contract.target)
  
  return { provider, signer, contract }
}

export function getContract() {
  return contract
}

export function getProvider() {
  return provider
}

export function getSigner() {
  return signer
}
