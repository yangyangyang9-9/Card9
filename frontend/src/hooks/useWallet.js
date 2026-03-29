import { useState, useEffect, useCallback } from 'react'
import { initContract, getContract, getProvider } from '../config/contract'
import { BSC_TESTNET, GUARANTEE_AMOUNT } from '../config/constants'
import { ethers } from 'ethers'

export function useWallet() {
  const [wallet, setWallet] = useState(null)
  const [contract, setContract] = useState(null)
  const [balance, setBalance] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState(null)

  const checkWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError('请安装 MetaMask 钱包')
      return false
    }
    return true
  }, [])

  const connect = useCallback(async () => {
    setIsConnecting(true)
    setError(null)
    
    try {
      if (!(await checkWallet())) {
        throw new Error('请安装 MetaMask 钱包')
      }

      const chainId = await window.ethereum.request({
        method: 'eth_chainId',
      })
      setChainId(chainId)

      if (chainId !== BSC_TESTNET.chainId) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BSC_TESTNET.chainId }],
          })
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [BSC_TESTNET],
            })
          } else {
            throw new Error('请手动切换到 BSC Testnet')
          }
        }
      }

      await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      const { contract: c, signer, provider: p } = await initContract()
      const address = await signer.getAddress()
      const bal = await p.getBalance(address)
      
      setWallet(address)
      setContract(c)
      setBalance(ethers.formatEther(bal))
      setChainId(await window.ethereum.request({ method: 'eth_chainId' }))
      
      return true
    } catch (err) {
      setError(err.message || '连接钱包失败')
      return false
    } finally {
      setIsConnecting(false)
    }
  }, [checkWallet])

  const checkBalance = useCallback(async () => {
    if (!wallet) return
    try {
      const p = getProvider()
      const bal = await p.getBalance(wallet)
      setBalance(ethers.formatEther(bal))
    } catch (err) {
      console.error('检查余额失败:', err)
    }
  }, [wallet])

  useEffect(() => {
    if (!window.ethereum) return

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        setWallet(null)
        setContract(null)
        setBalance(null)
      } else {
        connect()
      }
    }

    const handleChainChanged = () => {
      window.location.reload()
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
      window.ethereum.removeListener('chainChanged', handleChainChanged)
    }
  }, [connect])

  const hasEnoughBalance = balance && parseFloat(balance) >= parseFloat(GUARANTEE_AMOUNT)

  return {
    wallet,
    contract,
    balance,
    chainId,
    isConnecting,
    error,
    connect,
    checkBalance,
    hasEnoughBalance,
    isCorrectChain: chainId === BSC_TESTNET.chainId,
  }
}
