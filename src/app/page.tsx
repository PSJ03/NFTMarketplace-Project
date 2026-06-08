'use client'
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import {
  MARKET_ADDRESS,
  MARKET_ABI,
  NFT_ADDRESS,
  NFT_ABI,
  TOKEN_ADDRESS,
  TOKEN_ABI,
} from './constants'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum: any
  }
}

interface NFTItem {
  tokenId: string
  price: string
  seller: string
  isListed: boolean
}

// 내 지갑용 NFT 인터페이스
interface MyNFTItem {
  tokenId: string
  isListed: boolean
  price: string
}

export default function Home() {
  const [account, setAccount] = useState<string>('')
  const [marketContract, setMarketContract] = useState<ethers.Contract | null>(
    null,
  )
  const [nftContract, setNftContract] = useState<ethers.Contract | null>(null)
  const [tokenContract, setTokenContract] = useState<ethers.Contract | null>(
    null,
  )

  const [nfts, setNfts] = useState<NFTItem[]>([])
  // 🔥 내 소유 NFT 상태 추가
  const [myNfts, setMyNfts] = useState<MyNFTItem[]>([])

  const [mintPrice, setMintPrice] = useState<string>('')
  const [transferAddress, setTransferAddress] = useState<string>('')
  const [transferAmount, setTransferAmount] = useState<string>('')

  // 🔥 탭 상태에 'mywallet' 추가
  const [currentTab, setCurrentTab] = useState<
    'home' | 'mint' | 'market' | 'faucet' | 'mywallet'
  >('home')
  const [tokenBalance, setTokenBalance] = useState<string>('0')

  useEffect(() => {
    const checkIfWalletIsConnected = async () => {
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const accounts = await provider.send('eth_accounts', [])
        if (accounts.length > 0) {
          setAccount(accounts[0])
          const signer = await provider.getSigner()
          setMarketContract(
            new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, signer),
          )
          setNftContract(new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer))
          setTokenContract(
            new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer),
          )
        }
      }
    }
    checkIfWalletIsConnected()
  }, [])

  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0])
          window.location.reload()
        } else {
          setAccount('')
        }
      })
    }
  }, [])

  const fetchBalance = useCallback(async () => {
    if (tokenContract && account) {
      try {
        const balance = await tokenContract.balanceOf(account)
        setTokenBalance(ethers.formatEther(balance))
      } catch (error) {
        console.error('잔액 불러오기 실패:', error)
      }
    }
  }, [tokenContract, account])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  const fetchItems = useCallback(async () => {
    if (!marketContract) return
    try {
      const tokenIds = await marketContract.fetchListedNFTs()

      // 🔥 [핵심 추가] Set을 이용해 중복된 토큰 ID를 깔끔하게 하나로 압축합니다.
      const uniqueTokenIds = Array.from(
        new Set(tokenIds.map((id: any) => id.toString())),
      )

      const items = await Promise.all(
        uniqueTokenIds.map(async (id: string) => {
          const listing = await marketContract.getListing(id)
          return {
            tokenId: id,
            price: ethers.formatEther(listing.price),
            seller: listing.seller,
            isListed: listing.isListed,
          }
        }),
      )
      setNfts(items.filter((item) => item.isListed))
    } catch (err) {
      console.error('목록 불러오기 실패:', err)
    }
  }, [marketContract])

  // 🔥 내 지갑의 NFT를 불러오는 함수 추가 (ERC721Enumerable 활용)
  const fetchMyNFTs = useCallback(async () => {
    if (!nftContract || !marketContract || !account) return
    try {
      const balance = await nftContract.balanceOf(account)
      const items: MyNFTItem[] = []

      for (let i = 0; i < Number(balance); i++) {
        const tokenId = await nftContract.tokenOfOwnerByIndex(account, i)
        // 해당 토큰이 마켓에 올라가 있는지 상태 확인
        const listing = await marketContract.getListing(tokenId)
        items.push({
          tokenId: tokenId.toString(),
          isListed: listing.isListed,
          price: listing.isListed ? ethers.formatEther(listing.price) : '0',
        })
      }
      setMyNfts(items)
    } catch (error) {
      console.error('내 NFT 불러오기 실패:', error)
    }
  }, [nftContract, marketContract, account])

  useEffect(() => {
    fetchItems()
    fetchMyNFTs() // 앱 로드 시 내 NFT도 같이 불러옴
  }, [fetchItems, fetchMyNFTs])

  async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
      const provider = new ethers.BrowserProvider(window.ethereum)
      try {
        await provider.send('wallet_requestPermissions', [{ eth_accounts: {} }])
        const accounts = await provider.send('eth_requestAccounts', [])
        setAccount(accounts[0])

        const signer = await provider.getSigner()
        setMarketContract(
          new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, signer),
        )
        setNftContract(new ethers.Contract(NFT_ADDRESS, NFT_ABI, signer))
        setTokenContract(new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer))
      } catch (error) {
        console.error('지갑 연결 취소:', error)
      }
    } else {
      alert('메타마스크를 설치해주세요!')
    }
  }

  function disconnectWallet() {
    setAccount('')
    setMarketContract(null)
    setNftContract(null)
    setTokenContract(null)
    setTokenBalance('0')
    setCurrentTab('home')
    alert('지갑 연결이 해제되었습니다.')
  }

  async function handleFreeFaucet() {
    if (!tokenContract || !account) return alert('지갑을 연결해주세요.')
    try {
      const amount = ethers.parseEther('1000')
      alert(
        '테스트 토큰(1,000 Token) 무상 발급을 신청합니다. 메타마스크 승인을 진행해주세요.',
      )
      const tx = await tokenContract.mint(account, amount)
      await tx.wait()
      alert('🎉 지갑으로 1,000 테스트 토큰이 정상 지급되었습니다!')
      fetchBalance()
    } catch (error: any) {
      console.error(error)
      alert(`발급 실패: ${error.reason || error.message}`)
    }
  }

  async function handleCustomTransfer() {
    if (!tokenContract) return alert('지갑을 연결해주세요.')
    if (!transferAddress || !transferAmount)
      return alert('받을 지갑 주소와 전송할 수량을 모두 입력해주세요.')
    try {
      const amount = ethers.parseEther(transferAmount)
      alert(
        `${transferAmount} Token 송금을 시작합니다. 메타마스크 승인을 진행해주세요.`,
      )
      const tx = await tokenContract.transfer(transferAddress, amount)
      await tx.wait()
      alert(`🎉 성공적으로 토큰을 전송했습니다!`)
      setTransferAddress('')
      setTransferAmount('')
      fetchBalance()
    } catch (error: any) {
      console.error(error)
      alert(`송금 실패: ${error.reason || error.message}`)
    }
  }

  async function handleMintAndList() {
    if (!nftContract || !marketContract) return alert('지갑 먼저 연결하세요!')
    if (!mintPrice) return alert('판매 가격을 입력하세요!')
    try {
      const dummyURI = 'https://example.com/nft-metadata.json'
      const tx1 = await nftContract.safeMint(account, dummyURI)
      await tx1.wait()

      const balance = await nftContract.balanceOf(account)
      const newlyMintedTokenId = await nftContract.tokenOfOwnerByIndex(
        account,
        Number(balance) - 1,
      )

      const tx2 = await nftContract.setApprovalForAll(MARKET_ADDRESS, true)
      await tx2.wait()

      const priceInWei = ethers.parseEther(mintPrice)
      const tx3 = await marketContract.listNFT(newlyMintedTokenId, priceInWei)
      await tx3.wait()

      alert(
        `🎉 성공! NFT #${newlyMintedTokenId.toString()} 이(가) 마켓에 등록되었습니다!`,
      )
      setMintPrice('')
      fetchItems()
      fetchMyNFTs()
      setCurrentTab('market')
    } catch (error: any) {
      console.error(error)
      alert(`등록 실패: ${error.reason || error.message}`)
    }
  }

  async function handleBuyNFT(tokenId: string, price: string) {
    if (!marketContract || !tokenContract)
      return alert('지갑 연결을 확인해주세요.')
    try {
      const priceInWei = ethers.parseEther(price)
      alert(
        '결제를 위해 지출 한도 승인이 필요합니다. 메타마스크 창이 뜨면 금액을 입력하고 승인해주세요.',
      )
      const tx1 = await tokenContract.approve(MARKET_ADDRESS, priceInWei)
      await tx1.wait()

      alert('승인 완료! 이어서 실제 구매(결제)를 진행합니다.')
      const tx2 = await marketContract.buyNFT(tokenId)
      await tx2.wait()

      alert('🎉 구매 성공! NFT 소유권이 이전되었습니다.')
      fetchItems()
      fetchMyNFTs() // 구매 완료 후 내 지갑 갱신
      fetchBalance()
    } catch (error: any) {
      console.error(error)
      alert(`구매 실패: ${error.reason || error.message}`)
    }
  }

  async function handleCancelListing(tokenId: string) {
    if (!marketContract) return alert('지갑 연결을 확인해주세요.')
    try {
      alert('판매 등록을 취소합니다. 메타마스크 승인을 진행해주세요.')
      const tx = await marketContract.cancelListing(tokenId)
      await tx.wait()

      alert('✅ 성공적으로 판매 등록이 취소되었습니다.')
      fetchItems()
      fetchMyNFTs()
    } catch (error: any) {
      console.error(error)
      alert(`취소 실패: ${error.reason || error.message}`)
    }
  }

  // 🔥 [기능 추가] 구매한 NFT 재판매(Resell) 로직
  async function handleResellNFT(tokenId: string) {
    if (!nftContract || !marketContract)
      return alert('지갑 연결을 확인해주세요.')

    const resellPrice = prompt('얼마에 재판매 하시겠습니까? (단위: Token)')
    if (
      !resellPrice ||
      isNaN(Number(resellPrice)) ||
      Number(resellPrice) <= 0
    ) {
      return alert('올바른 가격을 입력해주세요.')
    }

    try {
      alert(`재판매를 위해 마켓플레이스 권한을 확인합니다.`)
      // 현재 마켓플레이스에 권한이 부여되어 있는지 확인
      const isApproved = await nftContract.isApprovedForAll(
        account,
        MARKET_ADDRESS,
      )
      if (!isApproved) {
        alert(
          '마켓플레이스에 판매 권한을 위임합니다. 메타마스크 승인을 진행해주세요.',
        )
        const tx1 = await nftContract.setApprovalForAll(MARKET_ADDRESS, true)
        await tx1.wait()
      }

      alert(`${resellPrice} Token으로 마켓에 등록합니다.`)
      const priceInWei = ethers.parseEther(resellPrice)
      const tx2 = await marketContract.listNFT(tokenId, priceInWei)
      await tx2.wait()

      alert('🎉 성공적으로 재판매 등록이 완료되었습니다!')
      fetchItems()
      fetchMyNFTs()
      setCurrentTab('market') // 등록 후 마켓으로 이동
    } catch (error: any) {
      console.error(error)
      alert(`재판매 등록 실패: ${error.reason || error.message}`)
    }
  }

  return (
    <div className='min-h-screen bg-gray-50 text-gray-900 font-sans'>
      <nav className='bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-50'>
        <div className='flex space-x-6 items-center'>
          <h1
            className='text-2xl font-black text-blue-600 cursor-pointer'
            onClick={() => setCurrentTab('home')}
          >
            BlockMarket
          </h1>
          {account && (
            <>
              <button
                onClick={() => setCurrentTab('mint')}
                className={`font-semibold transition ${currentTab === 'mint' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-black'}`}
              >
                발행 및 등록
              </button>
              <button
                onClick={() => setCurrentTab('market')}
                className={`font-semibold transition ${currentTab === 'market' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-black'}`}
              >
                마켓플레이스
              </button>
              {/* 🔥 내 지갑 탭 추가 */}
              <button
                onClick={() => {
                  fetchMyNFTs()
                  setCurrentTab('mywallet')
                }}
                className={`font-semibold transition ${currentTab === 'mywallet' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-black'}`}
              >
                내 지갑 (My NFTs)
              </button>
              <button
                onClick={() => setCurrentTab('faucet')}
                className={`font-semibold transition ${currentTab === 'faucet' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-black'}`}
              >
                토큰 관리 (Faucet)
              </button>
            </>
          )}
        </div>
        <div>
          {!account ? (
            <button
              onClick={connectWallet}
              className='bg-blue-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-blue-700 shadow'
            >
              지갑 연결
            </button>
          ) : (
            <div className='flex items-center space-x-4'>
              <span className='font-bold text-blue-700 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 shadow-sm'>
                🪙 {Number(tokenBalance).toLocaleString()} Token
              </span>
              <span className='font-mono text-sm bg-gray-100 p-2 rounded-lg border border-gray-200'>
                👤 {account.slice(0, 6)}...{account.slice(-4)}
              </span>
              <button
                onClick={disconnectWallet}
                className='bg-red-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-600 shadow transition'
              >
                연결 해제
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className='max-w-5xl mx-auto p-8'>
        {/* Home, Mint, Faucet 탭 등은 이전과 완전히 동일하여 생략 없이 유지 */}
        {currentTab === 'home' && (
          <div className='text-center mt-20'>
            <h2 className='text-5xl font-extrabold mb-6 text-gray-800'>
              디지털 자산의 토큰화,
              <br />
              가장 안전한 거래 플랫폼
            </h2>
            <p className='text-lg text-gray-600 mb-10'>
              ERC-721 기반의 NFT를 발행하고 스마트 컨트랙트를 통해 중개인 없이
              투명하게 거래하세요.
            </p>
            {!account ? (
              <button
                onClick={connectWallet}
                className='bg-blue-600 text-white px-8 py-4 rounded-full text-xl font-bold hover:bg-blue-700 shadow-lg transform transition hover:scale-105'
              >
                지갑 연동하고 시작하기
              </button>
            ) : (
              <div className='space-x-4'>
                <button
                  onClick={() => setCurrentTab('mint')}
                  className='bg-purple-600 text-white px-8 py-4 rounded-full text-xl font-bold hover:bg-purple-700 shadow-lg transform transition hover:scale-105'
                >
                  내 NFT 발행하기
                </button>
                <button
                  onClick={() => setCurrentTab('market')}
                  className='bg-green-500 text-white px-8 py-4 rounded-full text-xl font-bold hover:bg-green-600 shadow-lg transform transition hover:scale-105'
                >
                  마켓플레이스 둘러보기
                </button>
              </div>
            )}
          </div>
        )}

        {currentTab === 'mint' && account && (
          <div className='max-w-2xl mx-auto bg-white p-10 rounded-2xl shadow-xl border border-gray-200 mt-10'>
            <h2 className='text-3xl font-bold mb-6 text-black border-b pb-4'>
              🎨 내 NFT 자동 발행 & 마켓 등록
            </h2>
            <p className='text-gray-600 mb-8 leading-relaxed'>
              가격만 입력하면 고유 ID 생성부터 마켓 등록까지 자동으로
              처리됩니다.
            </p>
            <div className='flex flex-col gap-4'>
              <label className='font-bold text-gray-700'>
                판매 가격 설정 (Token)
              </label>
              <input
                type='number'
                placeholder='예: 100'
                className='border-2 border-gray-300 p-4 rounded-xl text-black bg-gray-50 focus:border-blue-500 focus:outline-none text-lg'
                value={mintPrice}
                onChange={(e) => setMintPrice(e.target.value)}
              />
              <button
                onClick={handleMintAndList}
                className='mt-4 bg-purple-600 text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-purple-700 shadow-md transition'
              >
                🚀 스마트 컨트랙트로 발행 및 등록 실행
              </button>
            </div>
          </div>
        )}

        {currentTab === 'faucet' && account && (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-8 mt-6'>
            <div className='bg-white p-8 rounded-2xl shadow-xl border border-gray-200 flex flex-col justify-between'>
              <div>
                <h2 className='text-2xl font-bold mb-4 text-black border-b pb-2'>
                  🚰 무료 토큰 충전소 (Faucet)
                </h2>
                <p className='text-gray-600 mb-6 text-sm leading-relaxed'>
                  복잡한 입력 없이 버튼 클릭 한 번으로 테스트용{' '}
                  <strong>1,000 Token</strong>을 즉시 지갑으로 발급받습니다.
                </p>
              </div>
              <button
                onClick={handleFreeFaucet}
                className='w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-cyan-700 shadow-md transition transform hover:scale-[1.02]'
              >
                💧 1,000 테스트 토큰 받기
              </button>
            </div>

            <div className='bg-white p-8 rounded-2xl shadow-xl border border-gray-200'>
              <h2 className='text-2xl font-bold mb-4 text-black border-b pb-2'>
                💸 토큰 개별 전송 (Transfer)
              </h2>
              <p className='text-gray-600 mb-4 text-sm leading-relaxed'>
                현재 지갑에서 다른 특정 계정으로 원하는 액수만큼 토큰을 자유롭게
                전송합니다.
              </p>
              <div className='flex flex-col gap-3'>
                <input
                  type='text'
                  placeholder='받을 사람 지갑 주소 (0x...)'
                  className='border-2 border-gray-300 p-3 rounded-xl text-black bg-gray-50 text-sm focus:border-blue-500 focus:outline-none'
                  value={transferAddress}
                  onChange={(e) => setTransferAddress(e.target.value)}
                />
                <input
                  type='number'
                  placeholder='전송할 토큰 수량 (Token)'
                  className='border-2 border-gray-300 p-3 rounded-xl text-black bg-gray-50 text-sm focus:border-blue-500 focus:outline-none'
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
                <button
                  onClick={handleCustomTransfer}
                  className='mt-2 w-full bg-gray-800 text-white py-3 rounded-xl font-bold hover:bg-black transition shadow-sm'
                >
                  토큰 안전 전송하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 🔥 신규: 내 지갑 (My NFTs) 화면 */}
        {currentTab === 'mywallet' && account && (
          <div className='mt-8'>
            <h2 className='text-3xl font-bold mb-8 text-black flex items-center'>
              💼 내 소유의 NFT
              <span className='ml-4 text-sm bg-purple-100 text-purple-800 py-1 px-3 rounded-full'>
                보유량 {myNfts.length}건
              </span>
            </h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8'>
              {myNfts.length === 0 ? (
                <div className='col-span-full py-20 text-center text-gray-500 font-medium text-lg border-2 border-dashed border-gray-300 rounded-xl'>
                  아직 보유하신 NFT가 없습니다. 마켓플레이스에서 구매해 보세요!
                </div>
              ) : (
                myNfts.map((nft, index) => (
                  <div
                    key={index}
                    className='bg-white border border-gray-200 p-6 rounded-2xl shadow-lg hover:shadow-2xl transition transform hover:-translate-y-1 relative'
                  >
                    <div className='w-full h-40 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl mb-6 flex items-center justify-center text-white text-4xl font-black shadow-inner mt-4'>
                      #{nft.tokenId}
                    </div>

                    <div className='mb-6 text-center'>
                      <span className='text-sm font-bold text-gray-600 block mb-2'>
                        현재 상태
                      </span>
                      {nft.isListed ? (
                        <span className='bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold text-sm'>
                          마켓 판매 중 ({nft.price} Token)
                        </span>
                      ) : (
                        <span className='bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-bold text-sm'>
                          지갑 내 보관 중
                        </span>
                      )}
                    </div>

                    {/* 상태에 따른 버튼 렌더링 */}
                    {nft.isListed ? (
                      <button
                        onClick={() => handleCancelListing(nft.tokenId)}
                        className='w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 shadow-md transition'
                      >
                        판매 취소하기
                      </button>
                    ) : (
                      <button
                        onClick={() => handleResellNFT(nft.tokenId)}
                        className='w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 shadow-md transition'
                      >
                        재판매 등록 (Resell)
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 기존 마켓플레이스 화면 */}
        {currentTab === 'market' && account && (
          <div className='mt-8'>
            <h2 className='text-3xl font-bold mb-8 text-black flex items-center'>
              🛒 실시간 마켓 매물
              <span className='ml-4 text-sm bg-blue-100 text-blue-800 py-1 px-3 rounded-full'>
                총 {nfts.length}건
              </span>
            </h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8'>
              {nfts.length === 0 ? (
                <div className='col-span-full py-20 text-center text-gray-500 font-medium text-lg border-2 border-dashed border-gray-300 rounded-xl'>
                  현재 스마트 컨트랙트에 등록된 매물이 없습니다.
                </div>
              ) : (
                nfts.map((nft, index) => (
                  <div
                    key={index}
                    className='bg-white border border-gray-200 p-6 rounded-2xl shadow-lg hover:shadow-2xl transition transform hover:-translate-y-1 relative'
                  >
                    <div className='absolute top-4 left-4 bg-gray-800 text-white text-xs font-mono px-3 py-1 rounded-full shadow-sm z-10 opacity-90'>
                      Seller: {nft.seller.slice(0, 6)}...{nft.seller.slice(-4)}
                    </div>

                    <div className='w-full h-40 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl mb-6 flex items-center justify-center text-white text-4xl font-black shadow-inner mt-4'>
                      #{nft.tokenId}
                    </div>

                    <div className='mb-6 text-center'>
                      <span className='text-xs text-gray-500 block mb-1'>
                        판매 가격
                      </span>
                      <span className='text-3xl font-extrabold text-gray-900'>
                        {nft.price}{' '}
                        <span className='text-lg text-blue-600'>Token</span>
                      </span>
                    </div>

                    {nft.seller.toLowerCase() === account.toLowerCase() ? (
                      <button
                        onClick={() => handleCancelListing(nft.tokenId)}
                        className='w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600 shadow-md transition'
                      >
                        판매 취소하기
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuyNFT(nft.tokenId, nft.price)}
                        className='w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-md transition'
                      >
                        안전 결제하기
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
