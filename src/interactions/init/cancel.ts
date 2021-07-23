import type { Handler } from '~interactions/index.js'
import { cancelConfirmation, checkUserID } from './utils.js'

export const init__cancel: Handler = async ({ button, components }) => {
  const isUser = await checkUserID(button, components[0])
  if (!isUser) return

  await cancelConfirmation(button, 'Vote Cancelled.', 1500)
}