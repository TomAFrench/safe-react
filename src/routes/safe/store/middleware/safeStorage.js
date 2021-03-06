// @flow
import { List } from 'immutable'
import type { Action, Store } from 'redux'

import { makeAddressBookEntry } from '~/logic/addressBook/model/addressBook'
import { addAddressBookEntry } from '~/logic/addressBook/store/actions/addAddressBookEntry'
import { saveDefaultSafe, saveSafes } from '~/logic/safe/utils'
import type { Token } from '~/logic/tokens/store/model/token'
import { tokensSelector } from '~/logic/tokens/store/selectors'
import { saveActiveTokens } from '~/logic/tokens/utils/tokensStorage'
import { ACTIVATE_TOKEN_FOR_ALL_SAFES } from '~/routes/safe/store/actions/activateTokenForAllSafes'
import { ADD_SAFE } from '~/routes/safe/store/actions/addSafe'
import { ADD_SAFE_OWNER } from '~/routes/safe/store/actions/addSafeOwner'
import { EDIT_SAFE_OWNER } from '~/routes/safe/store/actions/editSafeOwner'
import { REMOVE_SAFE } from '~/routes/safe/store/actions/removeSafe'
import { REMOVE_SAFE_OWNER } from '~/routes/safe/store/actions/removeSafeOwner'
import { REPLACE_SAFE_OWNER } from '~/routes/safe/store/actions/replaceSafeOwner'
import { SET_DEFAULT_SAFE } from '~/routes/safe/store/actions/setDefaultSafe'
import { UPDATE_SAFE } from '~/routes/safe/store/actions/updateSafe'
import { getActiveTokensAddressesForAllSafes, safesMapSelector } from '~/routes/safe/store/selectors'
import { type GlobalState } from '~/store/'

const watchedActions = [
  ADD_SAFE,
  UPDATE_SAFE,
  REMOVE_SAFE,
  ADD_SAFE_OWNER,
  REMOVE_SAFE_OWNER,
  REPLACE_SAFE_OWNER,
  EDIT_SAFE_OWNER,
  ACTIVATE_TOKEN_FOR_ALL_SAFES,
  SET_DEFAULT_SAFE,
]

const recalculateActiveTokens = (state: GlobalState): void => {
  const tokens = tokensSelector(state)
  const activeTokenAddresses = getActiveTokensAddressesForAllSafes(state)

  const activeTokens: List<Token> = tokens.withMutations((map) => {
    map.forEach((token: Token) => {
      if (!activeTokenAddresses.has(token.address)) {
        map.remove(token.address)
      }
    })
  })

  saveActiveTokens(activeTokens)
}

const safeStorageMware = (store: Store<GlobalState>) => (next: Function) => async (action: Action<*>) => {
  const handledAction = next(action)

  if (watchedActions.includes(action.type)) {
    const state: GlobalState = store.getState()
    const { dispatch } = store
    const safes = safesMapSelector(state)
    await saveSafes(safes.toJSON())

    switch (action.type) {
      case ACTIVATE_TOKEN_FOR_ALL_SAFES: {
        recalculateActiveTokens(state)
        break
      }
      case ADD_SAFE: {
        const { safe } = action.payload
        const ownersArray = safe.owners.toJS()
        // Adds the owners to the address book
        ownersArray.forEach((owner) => {
          dispatch(addAddressBookEntry(makeAddressBookEntry({ ...owner, isOwner: true })))
        })
        break
      }
      case UPDATE_SAFE: {
        const { activeTokens } = action.payload
        if (activeTokens) {
          recalculateActiveTokens(state)
        }
        break
      }
      case SET_DEFAULT_SAFE: {
        if (action.payload) {
          saveDefaultSafe(action.payload)
        }
        break
      }
      default:
        break
    }
  }

  return handledAction
}

export default safeStorageMware
