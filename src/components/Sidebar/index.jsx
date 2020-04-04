// 
import ClickAwayListener from '@material-ui/core/ClickAwayListener'
import Drawer from '@material-ui/core/Drawer'
import SearchIcon from '@material-ui/icons/Search'
import { List } from 'immutable'
import SearchBar from 'material-ui-search-bar'
import * as React from 'react'
import { connect } from 'react-redux'

import SafeList from './SafeList'
import { sortedSafeListSelector } from './selectors'
import useSidebarStyles from './style'

import Spacer from 'components/Spacer'
import Button from 'components/layout/Button'
import Divider from 'components/layout/Divider'
import Hairline from 'components/layout/Hairline'
import Link from 'components/layout/Link'
import Row from 'components/layout/Row'
import { WELCOME_ADDRESS } from 'routes/routes'
import setDefaultSafe from 'routes/safe/store/actions/setDefaultSafe'
import { } from 'routes/safe/store/models/safe'
import { defaultSafeSelector, safeParamAddressFromStateSelector } from 'routes/safe/store/selectors'

const { useEffect, useMemo, useState } = React


export const SidebarContext = React.createContext({
  isOpen: false,
  toggleSidebar: () => {},
})


const filterBy = (filter, safes) =>
  safes.filter(
    (safe) =>
      !filter ||
      safe.address.toLowerCase().includes(filter.toLowerCase()) ||
      safe.name.toLowerCase().includes(filter.toLowerCase()),
  )

const Sidebar = ({ children, currentSafe, defaultSafe, safes, setDefaultSafeAction }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const classes = useSidebarStyles()

  useEffect(() => {
    setTimeout(() => {
      setFilter('')
    }, 300)
  }, [isOpen])

  const searchClasses = {
    input: classes.searchInput,
    root: classes.searchRoot,
    iconButton: classes.searchIconInput,
    searchContainer: classes.searchContainer,
  }

  const toggleSidebar = () => {
    setIsOpen((prevIsOpen) => !prevIsOpen)
  }

  const handleFilterChange = (value) => {
    setFilter(value)
  }

  const handleFilterCancel = () => {
    setFilter('')
  }

  const handleEsc = (e) => {
    if (e.keyCode === 27) {
      toggleSidebar()
    }
  }

  const filteredSafes = useMemo(() => filterBy(filter, safes), [safes, filter])

  return (
    <SidebarContext.Provider value={{ isOpen, toggleSidebar }}>
      <ClickAwayListener onClickAway={toggleSidebar}>
        <Drawer
          classes={{ paper: classes.sidebarPaper }}
          className={classes.sidebar}
          ModalProps={{ onBackdropClick: toggleSidebar }}
          onKeyDown={handleEsc}
          open={isOpen}
        >
          <Row align="center" className={classes.topComponents}>
            <Row align="center" className={classes.searchWrapper}>
              <SearchIcon className={classes.searchIcon} />
              <SearchBar
                classes={searchClasses}
                onCancelSearch={handleFilterCancel}
                onChange={handleFilterChange}
                placeholder="Search by name or address"
                searchIcon={<div />}
                value={filter}
              />
            </Row>
            <Divider className={classes.divider} />
            <Spacer className={classes.spacer} />
            <Button
              className={classes.addSafeBtn}
              color="primary"
              component={Link}
              onClick={toggleSidebar}
              size="small"
              to={WELCOME_ADDRESS}
              variant="contained"
            >
              + Add Safe
            </Button>
            <Spacer />
          </Row>
          <Hairline />
          <SafeList
            currentSafe={currentSafe}
            defaultSafe={defaultSafe}
            onSafeClick={toggleSidebar}
            safes={filteredSafes}
            setDefaultSafe={setDefaultSafeAction}
          />
        </Drawer>
      </ClickAwayListener>
      {children}
    </SidebarContext.Provider>
  )
}

export default connect(
  // $FlowFixMe
  (state) => ({
    safes: sortedSafeListSelector(state),
    defaultSafe: defaultSafeSelector(state),
    currentSafe: safeParamAddressFromStateSelector(state),
  }),
  { setDefaultSafeAction: setDefaultSafe },
)(Sidebar)
