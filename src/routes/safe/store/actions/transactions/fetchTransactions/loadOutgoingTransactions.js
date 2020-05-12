// @flow
import ERC20Detailed from '@openzeppelin/contracts/build/contracts/ERC20Detailed.json'
import axios from 'axios'
import { List, Map, type RecordInstance } from 'immutable'

import addMockSafeCreationTx from '../utils/addMockSafeCreationTx'

import generateBatchRequests from '~/logic/contracts/generateBatchRequests'
import { decodeParamsFromSafeMethod } from '~/logic/contracts/methodIds'
import { buildTxServiceUrl } from '~/logic/safe/transactions/txHistory'
import { getTokenInfos } from '~/logic/tokens/store/actions/fetchTokens'
import { TOKEN_REDUCER_ID } from '~/logic/tokens/store/reducer/tokens'
import { ALTERNATIVE_TOKEN_ABI } from '~/logic/tokens/utils/alternativeAbi'
import {
  SAFE_TRANSFER_FROM_WITHOUT_DATA_HASH,
  isMultisendTransaction,
  isTokenTransfer,
  isUpgradeTransaction,
} from '~/logic/tokens/utils/tokenHelpers'
import { ZERO_ADDRESS, sameAddress } from '~/logic/wallets/ethAddresses'
import { EMPTY_DATA } from '~/logic/wallets/ethTransactions'
import { web3ReadOnly } from '~/logic/wallets/getWeb3'
import { makeConfirmation } from '~/routes/safe/store/models/confirmation'
import type { TransactionProps } from '~/routes/safe/store/models/transaction'
import { type Transaction, makeTransaction } from '~/routes/safe/store/models/transaction'

type ConfirmationServiceModel = {
  owner: string,
  submissionDate: Date,
  signature: string,
  transactionHash: string,
}

export type TxServiceModel = {
  to: string,
  value: number,
  data: ?string,
  operation: number,
  nonce: ?number,
  blockNumber: ?number,
  safeTxGas: number,
  baseGas: number,
  gasPrice: number,
  gasToken: string,
  refundReceiver: string,
  safeTxHash: string,
  submissionDate: ?string,
  executor: string,
  executionDate: ?string,
  confirmations: ConfirmationServiceModel[],
  isExecuted: boolean,
  isSuccessful: boolean,
  transactionHash: ?string,
  creationTx?: boolean,
}

export type SafeTransactionsType = {
  outgoing: Map<string, List<TransactionProps>>,
  cancel: Map<string, List<TransactionProps>>,
}

export const buildTransactionFrom = async (
  safeAddress: string,
  tx: TxServiceModel,
  knownTokens,
  code,
): Promise<Transaction> => {
  const confirmations = List(
    tx.confirmations.map((conf: ConfirmationServiceModel) =>
      makeConfirmation({
        owner: conf.owner,
        hash: conf.transactionHash,
        signature: conf.signature,
      }),
    ),
  )
  const modifySettingsTx = sameAddress(tx.to, safeAddress) && Number(tx.value) === 0 && !!tx.data
  const cancellationTx = sameAddress(tx.to, safeAddress) && Number(tx.value) === 0 && !tx.data
  const isERC721Token =
    (code && code.includes(SAFE_TRANSFER_FROM_WITHOUT_DATA_HASH)) ||
    (isTokenTransfer(tx.data, Number(tx.value)) && !knownTokens.get(tx.to))
  let isSendTokenTx = !isERC721Token && isTokenTransfer(tx.data, Number(tx.value))
  const isMultiSendTx = isMultisendTransaction(tx.data, Number(tx.value))
  const isUpgradeTx = isMultiSendTx && isUpgradeTransaction(tx.data)
  let customTx = !sameAddress(tx.to, safeAddress) && !!tx.data && !isSendTokenTx && !isUpgradeTx && !isERC721Token

  let refundParams = null
  if (tx.gasPrice > 0) {
    let refundSymbol = 'ETH'
    let refundDecimals = 18
    if (tx.gasToken !== ZERO_ADDRESS) {
      const gasToken = await getTokenInfos(tx.gasToken)
      refundSymbol = gasToken.symbol
      refundDecimals = gasToken.decimals
    }
    const feeString = (tx.gasPrice * (tx.baseGas + tx.safeTxGas)).toString().padStart(refundDecimals, 0)
    const whole = feeString.slice(0, feeString.length - refundDecimals) || '0'
    const fraction = feeString.slice(feeString.length - refundDecimals)

    const formattedFee = `${whole}.${fraction}`
    refundParams = {
      fee: formattedFee,
      symbol: refundSymbol,
    }
  }

  let symbol = 'ETH'
  let decimals = 18
  let decodedParams
  if (isSendTokenTx) {
    try {
      const token = await getTokenInfos(tx.to)

      symbol = token.symbol
      decimals = token.decimals
    } catch (e) {
      try {
        const [tokenSymbol, tokenDecimals] = await Promise.all(
          generateBatchRequests({
            abi: ALTERNATIVE_TOKEN_ABI,
            address: tx.to,
            methods: ['symbol', 'decimals'],
          }),
        )

        symbol = tokenSymbol
        decimals = tokenDecimals
      } catch (err) {
        // some contracts may implement the same methods as in ERC20 standard
        // we may falsely treat them as tokens, so in case we get any errors when getting token info
        // we fallback to displaying custom transaction
        isSendTokenTx = false
        customTx = true
      }
    }

    const params = web3ReadOnly.eth.abi.decodeParameters(['address', 'uint256'], tx.data.slice(10))
    decodedParams = {
      recipient: params[0],
      value: params[1],
    }
  } else if (modifySettingsTx && tx.data) {
    decodedParams = decodeParamsFromSafeMethod(tx.data)
  } else if (customTx && tx.data) {
    decodedParams = decodeParamsFromSafeMethod(tx.data)
  }

  return makeTransaction({
    symbol,
    nonce: tx.nonce,
    blockNumber: tx.blockNumber,
    value: tx.value.toString(),
    confirmations,
    decimals,
    recipient: tx.to,
    data: tx.data ? tx.data : EMPTY_DATA,
    operation: tx.operation,
    safeTxGas: tx.safeTxGas,
    baseGas: tx.baseGas,
    gasPrice: tx.gasPrice,
    gasToken: tx.gasToken || ZERO_ADDRESS,
    refundReceiver: tx.refundReceiver || ZERO_ADDRESS,
    refundParams,
    isExecuted: tx.isExecuted,
    isSuccessful: tx.isSuccessful,
    submissionDate: tx.submissionDate,
    executor: tx.executor,
    executionDate: tx.executionDate,
    executionTxHash: tx.transactionHash,
    safeTxHash: tx.safeTxHash,
    isTokenTransfer: isSendTokenTx,
    multiSendTx: isMultiSendTx,
    upgradeTx: isUpgradeTx,
    decodedParams,
    modifySettingsTx,
    customTx,
    cancellationTx,
    creationTx: tx.creationTx,
    origin: tx.origin,
  })
}

export const batchTxTokenRequest = (txs: any[]) => {
  const batch = new web3ReadOnly.BatchRequest()

  const whenTxsValues = txs.map((tx) => {
    const methods = [{ method: 'getCode', type: 'eth', args: [tx.to] }]
    return generateBatchRequests({
      abi: ERC20Detailed.abi,
      address: tx.to,
      batch,
      context: tx,
      methods,
    })
  })

  batch.execute()

  return Promise.all(whenTxsValues)
}

let prevSaveTransactionsEtag = null
export const loadOutgoingTransactions = async (
  safeAddress: string,
  getState: GetState,
): Promise<SafeTransactionsType> => {
  let transactions: TxServiceModel[] = addMockSafeCreationTx(safeAddress)

  try {
    const config = prevSaveTransactionsEtag
      ? {
          headers: {
            'If-None-Match': prevSaveTransactionsEtag,
          },
        }
      : undefined

    const url = buildTxServiceUrl(safeAddress)
    const response = await axios.get(url, config)
    if (response.data.count > 0) {
      if (prevSaveTransactionsEtag === response.headers.etag) {
        // The txs are the same as we currently have, we don't have to proceed
        return
      }
      transactions = transactions.concat(response.data.results)
      prevSaveTransactionsEtag = response.headers.etag
    }
  } catch (err) {
    if (err && err.response && err.response.status === 304) {
      // NOTE: this is the expected implementation, currently the backend is not returning 304.
      // So I check if the returned etag is the same instead (see above)
      return
    } else {
      console.error(`Requests for outgoing transactions for ${safeAddress} failed with 404`, err)
    }
  }

  const state = getState()
  const knownTokens = state[TOKEN_REDUCER_ID]
  const txsWithData = await batchTxTokenRequest(transactions)
  // In case that the etags don't match, we parse the new transactions and save them to the cache
  const txsRecord: Array<RecordInstance<TransactionProps>> = await Promise.all(
    txsWithData.map(([tx: TxServiceModel, code]) => buildTransactionFrom(safeAddress, tx, knownTokens, code)),
  )

  const groupedTxs = List(txsRecord).groupBy((tx) => (tx.get('cancellationTx') ? 'cancel' : 'outgoing'))

  return {
    outgoing: Map().set(safeAddress, groupedTxs.get('outgoing')),
    cancel: Map().set(safeAddress, groupedTxs.get('cancel')),
  }
}