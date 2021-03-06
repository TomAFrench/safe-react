// @flow
import { TextFieldProps } from '@material-ui/core/TextField'
import { withStyles } from '@material-ui/core/styles'
import React from 'react'

import Field from '~/components/forms/Field'
import TextField from '~/components/forms/TextField'

const styles = () => ({
  textarea: {
    '& > div': {
      height: '140px',
      paddingTop: '0',
      paddingBottom: '0',
      alignItems: 'auto',
      '& > textarea': {
        fontSize: '15px',
        letterSpacing: '-0.5px',
        lineHeight: '20px',
        height: '102px',
      },
    },
  },
})

const TextareaField = ({ classes, ...props }: TextFieldProps) => (
  <Field {...props} className={classes.textarea} component={TextField} multiline rows="5" />
)

export default withStyles(styles)(TextareaField)
