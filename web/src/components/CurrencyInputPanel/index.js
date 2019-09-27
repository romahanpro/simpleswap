import React, { useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ethers } from 'ethers'
import { BigNumber } from '@uniswap/sdk'
import { useWeb3Context } from 'web3-react'
import styled from 'styled-components'
import escapeStringRegex from 'escape-string-regexp'
import { darken, transparentize } from 'polished'
import Tooltip from '@reach/tooltip'
import '@reach/tooltip/styles.css'
import { isMobile } from 'react-device-detect'

import { BorderlessInput } from '../../theme'
import { useTokenContract } from '../../hooks'
import { isAddress, calculateGasMargin, formatToUsd, formatTokenBalance, formatEthBalance } from '../../utils'
import { ReactComponent as DropDown } from '../../assets/images/dropdown.svg'
import Modal from '../Modal'
import TokenLogo from '../TokenLogo'
import SearchIcon from '../../assets/images/magnifying-glass.svg'
import { useTransactionAdder, usePendingApproval } from '../../contexts/Transactions'
import { useTokenDetails, useAllTokenDetails } from '../../contexts/Tokens'
import { ReactComponent as Close } from '../../assets/images/x.svg'
import { Spinner } from '../../theme'
import Circle from '../../assets/images/circle-grey.svg'
import { useUSDPrice } from '../../contexts/Application'
import { SIMPLESWAP_ADDRESSES } from '../../constants'

const GAS_MARGIN = ethers.utils.bigNumberify(1000)

const FlexRow = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;

  > *:not(:first-child) {
    margin-left: 12px;
  }
`

const SubCurrencySelect = styled.button`
  ${({ theme }) => theme.flexRowNoWrap}
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.5rem;
  padding: 0 0.75rem;
  border-radius: 0.25rem;
  outline: none;
  font-size: 1rem;
  line-height: 0;
  cursor: pointer;
  user-select: none;
  background: ${({ theme }) => theme.zumthorBlue};
  border: 1px solid ${({ theme }) => theme.nationBlue};
  color: ${({ theme }) => theme.nationBlue};
`

const InputRow = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 2rem;
`

const Input = styled.input`
  width: 100%;
  height: 2.5rem;
  padding: 0 1rem;
  font-size: 1rem;
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 0.25rem;
  color: ${({ error, theme }) => error && theme.salmonRed};
  background-color: ${({ theme }) => theme.white};
  -moz-appearance: textfield;
  user-select: none;

  &:focus {
    outline: none;
  }
`

const StyledBorderlessInput = styled(BorderlessInput)`
  min-height: 2.5rem;
  flex-shrink: 0;
  text-align: left;
  padding-left: 1.6rem;
  background-color: ${({ theme }) => theme.concreteGray};
`

const CurrencySelect = styled.button`
  align-items: center;
  font-size: 1rem;
  color: ${({ selected, theme }) => (selected ? theme.textColor : theme.royalBlue)};
  height: 2.5rem;
  border: 1px solid ${({ selected, theme }) => (selected ? theme.mercuryGray : theme.borderColor)};
  border-radius: 0.25rem;
  background-color: ${({ theme }) => theme.white};
  outline: none;
  cursor: pointer;
  user-select: none;

  :hover {
    border: 1px solid
      ${({ selected, theme }) => (selected ? darken(0.1, theme.mercuryGray) : darken(0.1, theme.borderColor))};
  }

  :focus {
    border: 1px solid ${({ theme }) => darken(0.1, theme.borderColor)};
  }

  :active {
    background-color: ${({ theme }) => theme.borderColor};
  }
`

const Aligner = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const StyledDropDown = styled(DropDown)`
  margin: 0 0.5rem 0 0.5rem;
  height: 35%;

  path {
    stroke: ${({ selected, theme }) => (selected ? theme.textColor : theme.royalBlue)};
  }
`

const InputPanel = styled.div`
  ${({ theme }) => theme.flexColumnNoWrap}
  box-shadow: 0 0px 36px 0 ${({ theme }) => transparentize(0.9, theme.shadowColor)};
  position: relative;
  border-radius: 0.25rem;
  background-color: ${({ theme }) => theme.white};
  z-index: 1;
`

const Container = styled.div`
  padding: 0.5rem 0
  border-radius: 0.25rem;
  border: 1px solid ${({ error, theme }) => (error ? theme.salmonRed : theme.borderColor)};

  background-color: ${({ theme }) => theme.white};
  :focus-within {
    border: 1px solid ${({ theme }) => theme.malibuBlue};
  }
`

const LabelRow = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  color: ${({ theme }) => theme.textBlack};
  font-size: 1.25rem;
  padding: 0.5rem 2rem;
  span:hover {
    color: ${({ theme }) => darken(0.2, theme.doveGray)};
  }
`

const LabelContainer = styled.div`
  flex: 1 1 auto;
  width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`

const ErrorSpan = styled.span`
  color: ${({ error, theme }) => error ? theme.salmonRed : theme.textBlack};
  :hover {
    cursor: pointer;
    color: ${({ error, theme }) => error && darken(0.1, theme.salmonRed)};
  }
`

const TokenModal = styled.div`
  ${({ theme }) => theme.flexColumnNoWrap}
  width: 100%;
`

const ModalHeader = styled.div`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0px 0px 0px 1rem;
  height: 60px;
`

const CloseColor = styled(Close)`
  path {
    stroke: ${({ theme }) => theme.textColor};
  }
`

const CloseIcon = styled.div`
  position: absolute;
  right: 1rem;
  top: 14px;
  &:hover {
    cursor: pointer;
    opacity: 0.6;
  }
`

const SearchContainer = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  justify-content: flex-start;
  padding: 0.5rem 1.5rem;
  background-color: ${({ theme }) => theme.concreteGray};
`

const TokenModalInfo = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  padding: 1rem 1.5rem;
  margin: 0.25rem 0.5rem;
  justify-content: center;
  user-select: none;
`

const TokenList = styled.div`
  flex-grow: 1;
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
`

const TokenModalRow = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  cursor: pointer;
  user-select: none;

  #symbol {
    color: ${({ theme }) => theme.doveGrey};
  }

  :hover {
    background-color: ${({ theme }) => theme.tokenRowHover};
  }

  ${({ theme }) => theme.mediaWidth.upToMedium`padding: 0.8rem 1rem;`}
`

const TokenRowLeft = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  align-items : center;
`

const TokenSymbolGroup = styled.div`
  ${({ theme }) => theme.flexColumnNoWrap};
  margin-left: 1rem;
`

const TokenFullName = styled.div`
  color: ${({ theme }) => theme.chaliceGray};
`

const TokenRowBalance = styled.div`
  font-size: 1rem;
  line-height: 20px;
`

const TokenRowUsd = styled.div`
  font-size: 1rem;
  line-height: 1.5rem;
  color: ${({ theme }) => theme.chaliceGray};
`

const TokenRowRight = styled.div`
  ${({ theme }) => theme.flexColumnNoWrap};
  align-items: flex-end;
`

const StyledTokenName = styled.span`
  margin: 0 0.25rem 0 0.25rem;
`

const SpinnerWrapper = styled(Spinner)`
  margin: 0 0.25rem 0 0.25rem;
  color: ${({ theme }) => theme.chaliceGray};
  opacity: 0.6;
`

export default function CurrencyInputPanel({
  onValueChange = () => {},
  allBalances,
  renderInput,
  onCurrencySelected = () => {},
  title,
  description,
  extraText,
  extraTextClickHander = () => {},
  errorMessage,
  disableUnlock,
  disableTokenSelect,
  selectedTokenAddress = '',
  showUnlock,
  value,
  renderExchangeRate
}) {
  const { t } = useTranslation()

  const [modalIsOpen, setModalIsOpen] = useState(false)

  const { networkId } = useWeb3Context()

  const tokenContract = useTokenContract(selectedTokenAddress)

  const selectedTokenExchangeAddress = SIMPLESWAP_ADDRESSES[networkId]
  
  const pendingApproval = usePendingApproval(selectedTokenAddress)

  const addTransaction = useTransactionAdder()

  const allTokens = useAllTokenDetails()

  function renderUnlockButton() {
    if (disableUnlock || !showUnlock || selectedTokenAddress === 'ETH' || !selectedTokenAddress) {
      return null
    } else {
      if (!pendingApproval) {
        return (
          <SubCurrencySelect
            onClick={async () => {
              const estimatedGas = await tokenContract.estimate.approve(
                selectedTokenExchangeAddress,
                ethers.constants.MaxUint256
              )
              tokenContract
                .approve(selectedTokenExchangeAddress, ethers.constants.MaxUint256, {
                  gasLimit: calculateGasMargin(estimatedGas, GAS_MARGIN)
                })
                .then(response => {
                  addTransaction(response, { approval: selectedTokenAddress })
                })
            }}
          >
            {t('unlock')}
          </SubCurrencySelect>
        )
      } else {
        return <SubCurrencySelect>{t('pending')}</SubCurrencySelect>
      }
    }
  }

  function _renderExchangeRate() {
    if (typeof renderExchangeRate === 'function') {
      return renderExchangeRate()
    }
    return null
  }

  function _renderInput() {
    if (typeof renderInput === 'function') {
      return renderInput()
    }

    return (
      <>
        <InputRow>
          <FlexRow>
            <CurrencySelect
              selected={!!selectedTokenAddress}
              onClick={() => {
                if (!disableTokenSelect) {
                  setModalIsOpen(true)
                }
              }}
            >
              <Aligner>
                {
                  <StyledTokenName>
                    {(allTokens[selectedTokenAddress] && allTokens[selectedTokenAddress].symbol) || t('selectToken')}
                  </StyledTokenName>
                }
                {!disableTokenSelect && <StyledDropDown selected={!!selectedTokenAddress} />}
              </Aligner>
            </CurrencySelect>
            {renderUnlockButton()}
          </FlexRow>
          <ErrorSpan
            data-tip={'Enter max'}
            error={!!errorMessage}
            onClick={() => {
              extraTextClickHander()
            }}
          >
            <Tooltip
              label="Enter Max"
              style={{
                background: 'hsla(0, 0%, 0%, 0.75)',
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                padding: '0.5em 1em',
                marginTop: '-64px'
              }}
            >
              <span>{extraText}</span>
            </Tooltip>
          </ErrorSpan>
        </InputRow>
        <InputRow>
          <Input
            type="number"
            min="0"
            error={!!errorMessage}
            placeholder="0.0"
            step="0.000000000000000001"
            onChange={e => onValueChange(e.target.value)}
            onKeyPress={e => {
              const charCode = e.which ? e.which : e.keyCode

              // Prevent 'minus' character
              if (charCode === 45) {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
            value={value}
          />
        </InputRow>
      </>
    )
  }

  return (
    <InputPanel>
      <Container error={!!errorMessage}>
        <LabelRow>
          <LabelContainer>
            <span>{title}</span> <span>{description}</span>
          </LabelContainer>
          {_renderExchangeRate()}
        </LabelRow>
        {_renderInput()}
      </Container>
      {!disableTokenSelect && (
        <CurrencySelectModal
          isOpen={modalIsOpen}
          // isOpen={true}
          onDismiss={() => {
            setModalIsOpen(false)
          }}
          onTokenSelect={onCurrencySelected}
          allBalances={allBalances}
        />
      )}
    </InputPanel>
  )
}

function CurrencySelectModal({ isOpen, onDismiss, onTokenSelect, allBalances }) {
  const { t } = useTranslation()

  const [searchQuery, setSearchQuery] = useState('')
  useTokenDetails(searchQuery)

  const allTokens = useAllTokenDetails()

  const { account } = useWeb3Context()

  // BigNumber.js instance
  const ethPrice = useUSDPrice()

  const _usdAmounts = Object.keys(allTokens).map(k => {
    if (
      ethPrice &&
      allBalances &&
      allBalances[k] &&
      allBalances[k].ethRate &&
      !allBalances[k].ethRate.isNaN() &&
      allBalances[k].balance
    ) {
      const USDRate = ethPrice.times(allBalances[k].ethRate)
      const balanceBigNumber = new BigNumber(allBalances[k].balance.toString())
      const usdBalance = balanceBigNumber.times(USDRate).div(new BigNumber(10).pow(allTokens[k].decimals))
      return usdBalance
    } else {
      return null
    }
  })
  const usdAmounts =
    _usdAmounts &&
    Object.keys(allTokens).reduce(
      (accumulator, currentValue, i) => Object.assign({ [currentValue]: _usdAmounts[i] }, accumulator),
      {}
    )

  const tokenList = useMemo(() => {
    return Object.keys(allTokens)
      .sort((a, b) => {
        const aSymbol = allTokens[a].symbol.toLowerCase()
        const bSymbol = allTokens[b].symbol.toLowerCase()

        if (aSymbol === 'ETH'.toLowerCase() || bSymbol === 'ETH'.toLowerCase()) {
          return aSymbol === bSymbol ? 0 : aSymbol === 'ETH'.toLowerCase() ? -1 : 1
        }

        if (usdAmounts[a] && !usdAmounts[b]) {
          return -1
        } else if (usdAmounts[b] && !usdAmounts[a]) {
          return 1
        }

        // check for balance - sort by value
        if (usdAmounts[a] && usdAmounts[b]) {
          const aUSD = usdAmounts[a]
          const bUSD = usdAmounts[b]

          return aUSD.gt(bUSD) ? -1 : aUSD.lt(bUSD) ? 1 : 0
        }

        return aSymbol < bSymbol ? -1 : aSymbol > bSymbol ? 1 : 0
      })
      .map(k => {
        let balance
        let usdBalance
        // only update if we have data
        if (k === 'ETH' && allBalances && allBalances[k]) {
          balance = formatEthBalance(allBalances[k].balance)
          usdBalance = usdAmounts[k]
        } else if (allBalances && allBalances[k]) {
          balance = formatTokenBalance(allBalances[k].balance, allTokens[k].decimals)
          usdBalance = usdAmounts[k]
        }
        return {
          name: allTokens[k].name,
          symbol: allTokens[k].symbol,
          address: k,
          balance: balance,
          usdBalance: usdBalance
        }
      })
  }, [allBalances, allTokens, usdAmounts])

  const filteredTokenList = useMemo(() => {
    return tokenList.filter(tokenEntry => {
      // check the regex for each field
      const regexMatches = Object.keys(tokenEntry).map(tokenEntryKey => {
        return (
          typeof tokenEntry[tokenEntryKey] === 'string' &&
          !!tokenEntry[tokenEntryKey].match(new RegExp(escapeStringRegex(searchQuery), 'i'))
        )
      })

      return regexMatches.some(m => m)
    })
  }, [tokenList, searchQuery])

  function _onTokenSelect(address) {
    setSearchQuery('')
    onTokenSelect(address)
    onDismiss()
  }

  function renderTokenList() {
    if (!filteredTokenList.length) {
      return <TokenModalInfo>{t('noToken')}</TokenModalInfo>
    }

    return filteredTokenList.map(({ address, symbol, name, balance, usdBalance }) => {
      return (
        <TokenModalRow key={address} onClick={() => _onTokenSelect(address)}>
          <TokenRowLeft>
            <TokenLogo address={address} size={'2rem'} />
            <TokenSymbolGroup>
              <span id="symbol">{symbol}</span>
              <TokenFullName>{name}</TokenFullName>
            </TokenSymbolGroup>
          </TokenRowLeft>
          <TokenRowRight>
            {balance ? (
              <TokenRowBalance>{balance && (balance > 0 || balance === '<0.0001') ? balance : '-'}</TokenRowBalance>
            ) : account ? (
              <SpinnerWrapper src={Circle} alt="loader" />
            ) : (
              '-'
            )}
            <TokenRowUsd>
              {usdBalance ? (usdBalance.lt(0.01) ? '<$0.01' : '$' + formatToUsd(usdBalance)) : ''}
            </TokenRowUsd>
          </TokenRowRight>
        </TokenModalRow>
      )
    })
  }

  // manage focus on modal show
  const inputRef = useRef()

  function onInput(event) {
    const input = event.target.value
    const checksummedInput = isAddress(input)
    setSearchQuery(checksummedInput || input)
  }

  function clearInputAndDismiss() {
    setSearchQuery('')
    onDismiss()
  }

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={clearInputAndDismiss}
      minHeight={60}
      initialFocusRef={isMobile ? undefined : inputRef}
    >
      <TokenModal>
        <ModalHeader>
          <p>Select Token</p>
          <CloseIcon onClick={clearInputAndDismiss}>
            <CloseColor alt={'close icon'} />
          </CloseIcon>
        </ModalHeader>
        <SearchContainer>
          <img src={SearchIcon} alt="search" />
          <StyledBorderlessInput
            ref={inputRef}
            type="text"
            placeholder={isMobile ? t('searchOrPasteMobile') : t('searchOrPaste')}
            onChange={onInput}
          />
        </SearchContainer>
        <TokenList>{renderTokenList()}</TokenList>
      </TokenModal>
    </Modal>
  )
}